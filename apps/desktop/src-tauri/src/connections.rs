//! Direct OpenAI connections. All network credentials stay on this side of IPC.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use futures_util::StreamExt;
use jsonwebtoken::{decode, decode_header, jwk::JwkSet, Algorithm, DecodingKey, Validation};
use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::Mutex,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

const AUTH: &str = "https://auth.openai.com";
const API: &str = "https://api.openai.com/v1";
const SERVICE: &str = "com.void.mind.connections";
const PLAN_SCOPE: &str = "chatgpt.tokens.use.direct";

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn random() -> String {
    format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple())
}
fn network_error(_: reqwest::Error) -> String {
    "Could not reach OpenAI. Check your connection and try again.".into()
}
fn vault_error(_: impl std::fmt::Display) -> String {
    "The system credential store is unavailable. Unlock it and try again.".into()
}

#[derive(Clone, Default, Serialize, Deserialize)]
struct Vault {
    #[serde(skip)]
    dirty: bool,
    host_id: String,
    accounts: Vec<Account>,
    active: Option<String>,
    api_key: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct Account {
    client_id: String,
    subject: String,
    email: Option<String>,
    access_token: Option<String>,
    refresh_token: Option<String>,
    id_token: Option<String>,
    expires_at: u64,
    earliest_refresh_at: u64,
    scopes: Vec<String>,
    welcomed: bool,
}

// Windows Credential Manager has a per-entry size limit. Store an immutable,
// bounded revision in small entries, then switch its manifest only after all
// chunks are written. A failed save leaves the previous credential readable.
#[derive(Serialize, Deserialize)]
struct Manifest {
    revision: String,
    chunks: usize,
}

fn entry(name: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, name).map_err(vault_error)
}
fn manifest() -> Result<Option<Manifest>, String> {
    match entry("manifest")?.get_password() {
        Ok(value) => serde_json::from_str(&value).map(Some).map_err(vault_error),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(vault_error(error)),
    }
}
fn cleanup_revision(value: &Manifest) {
    for index in 0..value.chunks.min(256) {
        if let Ok(item) = entry(&format!("{}:{index}", value.revision)) {
            let _ = item.delete_credential();
        }
    }
}
fn load_vault() -> Result<Vault, String> {
    let Some(found) = manifest()? else {
        return Ok(Vault::default());
    };
    if found.chunks > 256 || Uuid::parse_str(&found.revision).is_err() {
        return Err(vault_error("invalid manifest"));
    }
    let mut data = Vec::new();
    for index in 0..found.chunks {
        data.extend(
            entry(&format!("{}:{index}", found.revision))?
                .get_secret()
                .map_err(vault_error)?,
        );
    }
    serde_json::from_slice(&data).map_err(vault_error)
}
fn save_vault(value: &Vault) -> Result<(), String> {
    let data = serde_json::to_vec(value).map_err(vault_error)?;
    if data.len() > 256_000 {
        return Err("Too many saved connections. Remove an unused account first.".into());
    }
    let previous = manifest()?;
    let next = Manifest {
        revision: Uuid::new_v4().to_string(),
        chunks: data.len().div_ceil(1000),
    };
    let result = (|| {
        for (index, chunk) in data.chunks(1000).enumerate() {
            entry(&format!("{}:{index}", next.revision))?
                .set_secret(chunk)
                .map_err(vault_error)?;
        }
        entry("manifest")?
            .set_password(&serde_json::to_string(&next).map_err(vault_error)?)
            .map_err(vault_error)
    })();
    if result.is_err() {
        cleanup_revision(&next);
    } else if let Some(old) = previous {
        cleanup_revision(&old);
    }
    result
}
async fn persist(value: &Vault) -> Result<(), String> {
    let copy = value.clone();
    tauri::async_runtime::spawn_blocking(move || save_vault(&copy))
        .await
        .map_err(vault_error)?
}

pub struct Connections {
    vault: Mutex<Option<Vault>>,
    login: Mutex<Option<(String, CancellationToken)>>,
    requests: Mutex<HashMap<String, CancellationToken>>,
    client: Client,
}
impl Default for Connections {
    fn default() -> Self {
        Self {
            vault: Mutex::new(None),
            login: Mutex::new(None),
            requests: Mutex::new(HashMap::new()),
            client: Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(Duration::from_secs(15))
                .read_timeout(Duration::from_secs(90))
                .user_agent("VOID-Mind/0.2.0")
                .build()
                .expect("HTTP client initialization"),
        }
    }
}
impl Connections {
    async fn vault(&self) -> Result<tokio::sync::MutexGuard<'_, Option<Vault>>, String> {
        let mut guard = self.vault.lock().await;
        if guard.is_none() {
            *guard = Some(
                tauri::async_runtime::spawn_blocking(load_vault)
                    .await
                    .map_err(vault_error)??,
            );
        }
        Ok(guard)
    }
    async fn cancel_requests(&self) {
        for token in self.requests.lock().await.values() {
            token.cancel();
        }
    }
    async fn token(&self, provider: &str) -> Result<String, String> {
        let mut guard = self.vault().await?;
        let vault = guard.as_mut().unwrap();
        if provider == "openai-api" {
            return vault
                .api_key
                .clone()
                .ok_or("Connect an OpenAI API key first.".into());
        }
        if provider != "openai-chatgpt" {
            return Err("Unsupported connection.".into());
        }
        let account = vault
            .accounts
            .iter_mut()
            .find(|a| Some(&a.client_id) == vault.active.as_ref())
            .ok_or("Connect ChatGPT first.")?;
        if !account.scopes.iter().any(|scope| scope == PLAN_SCOPE) {
            return Err(
                "ChatGPT plan use was not authorized. Reconnect and enable plan use.".into(),
            );
        }
        if account.expires_at <= now() + 60 {
            if now() < account.earliest_refresh_at {
                return Err("ChatGPT session is not ready to renew. Try again shortly.".into());
            }
            let refresh = account
                .refresh_token
                .clone()
                .ok_or("Sign in to ChatGPT again.")?;
            let response = self
                .client
                .post(format!("{AUTH}/api/accounts/oauth/token"))
                .form(&[
                    ("grant_type", "refresh_token"),
                    ("client_id", &account.client_id),
                    ("refresh_token", &refresh),
                    ("resource", API),
                ])
                .send()
                .await
                .map_err(network_error)?;
            let tokens: TokenResponse = read_json(response).await?;
            apply_tokens(account, tokens, false)?;
            vault.dirty = true;
        }
        // Retry a failed vault write before ever using its rotating replacement.
        if vault.dirty {
            persist(vault).await?;
            vault.dirty = false;
        }
        account_token(vault)
    }
}
fn account_token(vault: &Vault) -> Result<String, String> {
    vault
        .accounts
        .iter()
        .find(|a| Some(&a.client_id) == vault.active.as_ref())
        .filter(|a| a.scopes.iter().any(|scope| scope == PLAN_SCOPE))
        .and_then(|a| a.access_token.clone())
        .ok_or("Sign in to ChatGPT again.".into())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatus {
    accounts: Vec<AccountSummary>,
    active_account_id: Option<String>,
    api_connected: bool,
    welcome_pending: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AccountSummary {
    id: String,
    email: Option<String>,
    connected: bool,
    plan_authorized: bool,
}
fn snapshot(vault: &Vault) -> ConnectionStatus {
    ConnectionStatus {
        accounts: vault
            .accounts
            .iter()
            .map(|a| AccountSummary {
                id: a.client_id.clone(),
                email: a.email.clone(),
                connected: a.refresh_token.is_some()
                    || (a.access_token.is_some() && a.expires_at > now()),
                plan_authorized: a.scopes.iter().any(|s| s == PLAN_SCOPE),
            })
            .collect(),
        active_account_id: vault.active.clone(),
        api_connected: vault.api_key.is_some(),
        welcome_pending: vault.accounts.iter().any(|a| {
            Some(&a.client_id) == vault.active.as_ref()
                && !a.welcomed
                && a.scopes.iter().any(|s| s == PLAN_SCOPE)
        }),
    }
}
#[tauri::command]
pub async fn connections_status(
    manager: State<'_, Arc<Connections>>,
) -> Result<ConnectionStatus, String> {
    Ok(snapshot(manager.vault().await?.as_ref().unwrap()))
}
#[tauri::command]
pub fn connection_usage(app: AppHandle) -> Result<(), String> {
    app.opener()
        .open_url("https://chatgpt.com/settings/usage", None::<&str>)
        .map_err(|_| "Could not open your browser.".into())
}
#[tauri::command]
pub async fn connection_welcome_seen(manager: State<'_, Arc<Connections>>) -> Result<(), String> {
    let mut guard = manager.vault().await?;
    let vault = guard.as_mut().unwrap();
    for account in &mut vault.accounts {
        if Some(&account.client_id) == vault.active.as_ref() {
            account.welcomed = true;
        }
    }
    persist(vault).await
}
#[tauri::command]
pub async fn connection_select(
    manager: State<'_, Arc<Connections>>,
    account_id: String,
) -> Result<(), String> {
    manager.cancel_requests().await;
    let mut guard = manager.vault().await?;
    let vault = guard.as_mut().unwrap();
    if !vault.accounts.iter().any(|a| a.client_id == account_id) {
        return Err("Account not found.".into());
    }
    vault.active = Some(account_id);
    persist(vault).await
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    token_type: String,
    expires_in: u64,
    scope: Option<String>,
    earliest_refresh_at: Option<u64>,
}
fn apply_tokens(account: &mut Account, tokens: TokenResponse, initial: bool) -> Result<(), String> {
    if !tokens.token_type.eq_ignore_ascii_case("bearer")
        || tokens.access_token.is_empty()
        || tokens.expires_in == 0
    {
        return Err("OpenAI returned an invalid authorization.".into());
    }
    if initial && tokens.scope.is_none() {
        return Err("OpenAI did not confirm granted permissions.".into());
    }
    account.access_token = Some(tokens.access_token);
    if let Some(refresh) = tokens.refresh_token {
        account.refresh_token = Some(refresh);
    }
    if let Some(id) = tokens.id_token {
        account.id_token = Some(id);
    }
    account.expires_at = now().saturating_add(tokens.expires_in);
    account.earliest_refresh_at = tokens.earliest_refresh_at.unwrap_or(0);
    if let Some(scope) = tokens.scope {
        account.scopes = scope.split_whitespace().map(str::to_owned).collect();
    }
    Ok(())
}
async fn read_json<T: serde::de::DeserializeOwned>(response: Response) -> Result<T, String> {
    if !response.status().is_success() {
        return Err(http_error(response.status().as_u16()));
    }
    let data = bounded_body(response, 2_000_000).await?;
    serde_json::from_slice(&data).map_err(|_| "OpenAI returned an unreadable response.".into())
}
async fn bounded_body(response: Response, max: usize) -> Result<Vec<u8>, String> {
    let mut stream = response.bytes_stream();
    let mut body = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(network_error)?;
        if body.len() + chunk.len() > max {
            return Err("OpenAI response exceeded the supported size.".into());
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}
fn http_error(status: u16) -> String {
    match status {
        401 => "OpenAI authorization expired or the key is invalid. Reconnect in Intelligence.",
        403 => "This account does not have access to that OpenAI feature or model.",
        429 => "OpenAI usage limit reached. Review your plan usage or API balance.",
        500..=599 => "OpenAI is temporarily unavailable. Try again shortly.",
        _ => "OpenAI could not accept this request. Check the selected model and connection.",
    }
    .into()
}

#[derive(Deserialize, Clone)]
struct Claims {
    sub: String,
    nonce: Option<String>,
    email: Option<String>,
}
async fn validate_identity(
    client: &Client,
    token: &str,
    client_id: &str,
    nonce: &str,
) -> Result<Claims, String> {
    let error =
        || "Could not verify the ChatGPT account identity. Start sign-in again.".to_string();
    let header = decode_header(token).map_err(|_| error())?;
    if header.alg != Algorithm::RS256 {
        return Err(error());
    }
    let jwks: JwkSet = read_json(
        client
            .get(format!("{AUTH}/.well-known/jwks.json"))
            .send()
            .await
            .map_err(network_error)?,
    )
    .await?;
    let key = jwks
        .find(header.kid.as_deref().ok_or_else(error)?)
        .ok_or_else(error)?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&[client_id]);
    validation.set_issuer(&[AUTH]);
    validation.set_required_spec_claims(&["exp", "iss", "aud", "sub"]);
    validation.leeway = 0;
    let claims = decode::<Claims>(
        token,
        &DecodingKey::from_jwk(key).map_err(|_| error())?,
        &validation,
    )
    .map_err(|_| error())?
    .claims;
    if claims.sub.is_empty() || claims.nonce.as_deref() != Some(nonce) {
        return Err(error());
    }
    Ok(claims)
}

struct LoginAttempt {
    state: String,
    nonce: String,
    verifier: String,
    redirect: String,
    previous: Option<Account>,
}
fn authorize_url(attempt: &LoginAttempt, host: &str) -> Result<String, String> {
    let mut url = reqwest::Url::parse(&format!("{AUTH}/api/accounts/authorize"))
        .map_err(|_| "Invalid authorization configuration.")?;
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(attempt.verifier.as_bytes()));
    {
        let mut query = url.query_pairs_mut();
        query.extend_pairs([
            (
                "client_id",
                attempt
                    .previous
                    .as_ref()
                    .map(|a| a.client_id.as_str())
                    .unwrap_or("dynamic_agent_client"),
            ),
            ("ext_agent_host_id", host),
            ("response_type", "code"),
            ("redirect_uri", &attempt.redirect),
            (
                "scope",
                "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
            ),
            ("resource", API),
            ("state", &attempt.state),
            ("nonce", &attempt.nonce),
            ("code_challenge_method", "S256"),
            ("code_challenge", &challenge),
        ]);
        if attempt.previous.is_none() {
            query.append_pair("agent_name_hint", "VOID Mind");
        }
        if let Some(account) = &attempt.previous {
            if let Some(token) = &account.id_token {
                query.append_pair("id_token_hint", token);
            }
        }
    }
    Ok(url.into())
}
fn callback(request: &str, attempt: &LoginAttempt) -> Result<(String, String), String> {
    let mut first = request.lines().next().unwrap_or("").split_whitespace();
    if first.next() != Some("GET") {
        return Err("Invalid sign-in callback.".into());
    }
    let path = first.next().ok_or("Invalid sign-in callback.")?;
    if !path.starts_with("/auth/callback?") {
        return Err("Invalid sign-in callback.".into());
    }
    let parsed = reqwest::Url::parse(&format!("http://127.0.0.1{path}"))
        .map_err(|_| "Invalid sign-in callback.")?;
    let mut params = HashMap::new();
    for (key, value) in parsed.query_pairs() {
        if params.insert(key.to_string(), value.to_string()).is_some() {
            return Err("Duplicate sign-in callback parameter.".into());
        }
    }
    if params.get("state") != Some(&attempt.state) {
        return Err("Sign-in state did not match. Start again.".into());
    }
    if params.contains_key("error") {
        return Err("ChatGPT sign-in was declined or cancelled.".into());
    }
    let issued = params
        .get("client_id")
        .filter(|id| !id.is_empty() && id.as_str() != "dynamic_agent_client");
    let id = match &attempt.previous {
        Some(old) => {
            if issued.is_some_and(|id| id != &old.client_id) {
                return Err("The returned ChatGPT registration did not match.".into());
            }
            old.client_id.clone()
        }
        None => issued
            .cloned()
            .ok_or("ChatGPT registration did not complete.")?,
    };
    Ok((
        params
            .get("code")
            .filter(|c| !c.is_empty())
            .cloned()
            .ok_or("ChatGPT did not return an authorization code.")?,
        id,
    ))
}

#[tauri::command]
pub async fn connection_login(
    app: AppHandle,
    manager: State<'_, Arc<Connections>>,
    account_id: Option<String>,
) -> Result<String, String> {
    let mut pending = manager.login.lock().await;
    if pending.is_some() {
        return Err("A ChatGPT sign-in is already in progress.".into());
    }
    let (previous, host) = {
        let mut guard = manager.vault().await?;
        let vault = guard.as_mut().unwrap();
        if vault.host_id.is_empty() {
            vault.host_id = format!("urn:uuid:{}", Uuid::new_v4());
            persist(vault).await?;
        }
        let previous = match account_id {
            Some(id) => Some(
                vault
                    .accounts
                    .iter()
                    .find(|a| a.client_id == id)
                    .cloned()
                    .ok_or("Account not found.")?,
            ),
            None => None,
        };
        (previous, vault.host_id.clone())
    };
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|_| "Could not open the local sign-in callback.")?;
    let attempt = LoginAttempt {
        state: random(),
        nonce: random(),
        verifier: random(),
        redirect: format!(
            "http://127.0.0.1:{}/auth/callback",
            listener
                .local_addr()
                .map_err(|_| "Could not prepare sign-in.")?
                .port()
        ),
        previous,
    };
    let url = authorize_url(&attempt, &host)?;
    let login_id = Uuid::new_v4().to_string();
    let cancel = CancellationToken::new();
    // The URL (possibly including an ID-token hint) never crosses IPC or logs.
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|_| "Could not open your browser. Check the default browser and try again.")?;
    *pending = Some((login_id.clone(), cancel.clone()));
    let owned = manager.inner().clone();
    let id = login_id.clone();
    tauri::async_runtime::spawn(async move {
        let result = tokio::select! {
            _ = cancel.cancelled() => Err("Sign-in cancelled.".to_string()),
            result = tokio::time::timeout(Duration::from_secs(600), finish_login(&owned, &listener, &attempt)) => result.unwrap_or_else(|_| Err("Sign-in timed out. Try again.".into())),
        };
        let mut pending = owned.login.lock().await;
        if pending.as_ref().is_some_and(|(current, _)| current == &id) {
            *pending = None;
        }
        let _ = app.emit(
            "void-mind://connection-login",
            json!({"loginId": id, "success": result.is_ok(), "error": result.err()}),
        );
    });
    Ok(login_id)
}
async fn finish_login(
    manager: &Connections,
    listener: &TcpListener,
    attempt: &LoginAttempt,
) -> Result<(), String> {
    let (code, client_id) = loop {
        let (mut socket, _) = listener
            .accept()
            .await
            .map_err(|_| "Sign-in callback failed.")?;
        let mut request = vec![0_u8; 16_384];
        let mut used = 0;
        let read = tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                if used == request.len() {
                    return Err(());
                }
                let size = socket.read(&mut request[used..]).await.map_err(|_| ())?;
                if size == 0 {
                    return Err(());
                }
                used += size;
                if request[..used].windows(4).any(|w| w == b"\r\n\r\n") {
                    return Ok(());
                }
            }
        })
        .await;
        let parsed = if matches!(read, Ok(Ok(()))) {
            callback(std::str::from_utf8(&request[..used]).unwrap_or(""), attempt)
        } else {
            Err("Invalid sign-in callback.".into())
        };
        let valid = parsed.is_ok();
        let body = if valid {
            "Authorization received. You can return to VOID Mind."
        } else {
            "Authorization was not accepted. Return to VOID Mind and try again."
        };
        let reply = format!("HTTP/1.1 {}\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nContent-Security-Policy: default-src 'none'\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{body}", if valid { "200 OK" } else { "400 Bad Request" }, body.len());
        let _ =
            tokio::time::timeout(Duration::from_secs(2), socket.write_all(reply.as_bytes())).await;
        match parsed {
            Ok(value) => break value,
            Err(error) if error.contains("declined") => return Err(error),
            Err(_) => continue,
        }
    };
    let response = manager
        .client
        .post(format!("{AUTH}/api/accounts/oauth/token"))
        .form(&[
            ("grant_type", "authorization_code"),
            ("client_id", client_id.as_str()),
            ("code", &code),
            ("code_verifier", &attempt.verifier),
            ("redirect_uri", &attempt.redirect),
            ("resource", API),
        ])
        .send()
        .await
        .map_err(network_error)?;
    let tokens: TokenResponse = read_json(response).await?;
    let claims = validate_identity(
        &manager.client,
        tokens
            .id_token
            .as_deref()
            .ok_or("OpenAI did not return an account identity.")?,
        &client_id,
        &attempt.nonce,
    )
    .await?;
    if attempt
        .previous
        .as_ref()
        .is_some_and(|a| a.subject != claims.sub)
    {
        return Err("The authenticated ChatGPT account did not match the selected account.".into());
    }
    let mut account = Account {
        client_id: client_id.clone(),
        subject: claims.sub,
        email: claims.email,
        access_token: None,
        refresh_token: None,
        id_token: None,
        expires_at: 0,
        earliest_refresh_at: 0,
        scopes: vec![],
        welcomed: attempt.previous.as_ref().is_some_and(|a| a.welcomed),
    };
    apply_tokens(&mut account, tokens, true)?;
    manager.cancel_requests().await;
    let mut guard = manager.vault().await?;
    let mut next = guard.as_ref().unwrap().clone();
    if let Some(saved) = next.accounts.iter().find(|a| a.client_id == client_id) {
        if saved.subject != account.subject {
            return Err("The ChatGPT registration identity did not match.".into());
        }
        account.welcomed = saved.welcomed;
    }
    next.accounts.retain(|a| a.client_id != client_id);
    next.accounts.push(account);
    next.active = Some(client_id);
    persist(&next).await?;
    *guard = Some(next);
    Ok(())
}
#[tauri::command]
pub async fn connection_login_cancel(
    manager: State<'_, Arc<Connections>>,
    login_id: String,
) -> Result<(), String> {
    if let Some((id, token)) = manager.login.lock().await.as_ref() {
        if id == &login_id {
            token.cancel();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn connection_api_save(
    manager: State<'_, Arc<Connections>>,
    key: String,
) -> Result<(), String> {
    let key = key.trim();
    if key.len() < 16 || key.len() > 4096 || !key.is_ascii() || key.contains(char::is_whitespace) {
        return Err("Enter a valid OpenAI API key.".into());
    }
    // Verify access before replacing a working saved key. Never return the body.
    let response = manager
        .client
        .get(format!("{API}/models"))
        .bearer_auth(key)
        .send()
        .await
        .map_err(network_error)?;
    let _: Value = read_json(response).await?;
    manager.cancel_requests().await;
    let mut guard = manager.vault().await?;
    let mut next = guard.as_ref().unwrap().clone();
    next.api_key = Some(key.into());
    persist(&next).await?;
    *guard = Some(next);
    Ok(())
}
#[derive(Deserialize)]
struct Discovery {
    revocation_endpoint: String,
}
#[tauri::command]
pub async fn connection_disconnect(
    manager: State<'_, Arc<Connections>>,
    provider: String,
) -> Result<Option<String>, String> {
    manager.cancel_requests().await;
    let mut guard = manager.vault().await?;
    let mut next = guard.as_ref().unwrap().clone();
    let mut warning = None;
    if provider == "openai-api" {
        next.api_key = None;
    } else if provider == "openai-chatgpt" {
        let account = next
            .accounts
            .iter_mut()
            .find(|a| Some(&a.client_id) == next.active.as_ref())
            .ok_or("Account not found.")?;
        if let Some(refresh) = &account.refresh_token {
            let revoke = async {
                let discovery: Discovery = read_json(
                    manager
                        .client
                        .get(format!("{AUTH}/.well-known/openid-configuration"))
                        .send()
                        .await
                        .map_err(network_error)?,
                )
                .await?;
                let url = reqwest::Url::parse(&discovery.revocation_endpoint)
                    .map_err(|_| "Invalid revocation endpoint.")?;
                if url.scheme() != "https" || url.host_str() != Some("auth.openai.com") {
                    return Err("Invalid revocation endpoint.".to_string());
                }
                for retry in 0..3 {
                    if retry > 0 {
                        tokio::time::sleep(Duration::from_millis(250 * (1 << retry))).await;
                    }
                    if let Ok(response) = manager
                        .client
                        .post(url.clone())
                        .form(&[
                            ("token", refresh.as_str()),
                            ("token_type_hint", "refresh_token"),
                            ("client_id", &account.client_id),
                        ])
                        .send()
                        .await
                    {
                        if response.status().is_success() {
                            return Ok(());
                        }
                        if !response.status().is_server_error() {
                            break;
                        }
                    }
                }
                Err("Revocation was not confirmed.".into())
            }
            .await;
            if revoke.is_err() {
                warning = Some("Disconnected on this device. Remote revocation was not confirmed; disconnect VOID Mind in ChatGPT settings.".into());
            }
        }
        account.access_token = None;
        account.refresh_token = None;
        account.id_token = None;
        account.scopes.clear();
    } else {
        return Err("Unsupported connection.".into());
    }
    persist(&next).await?;
    *guard = Some(next);
    Ok(warning)
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RemoteModel {
    id: String,
    display_name: String,
}
fn model_catalog(value: &Value, provider: &str) -> Result<Vec<RemoteModel>, String> {
    let field = if provider == "openai-chatgpt" {
        "models"
    } else {
        "data"
    };
    let items = value[field]
        .as_array()
        .ok_or("OpenAI returned an unsupported model catalog.")?;
    Ok(items
        .iter()
        .filter(|item| provider != "openai-chatgpt" || item["visibility"] == "list")
        .filter_map(|item| {
            let id = item[if provider == "openai-chatgpt" {
                "slug"
            } else {
                "id"
            }]
            .as_str()?;
            if id.is_empty() {
                return None;
            }
            Some(RemoteModel {
                id: id.into(),
                display_name: item["display_name"].as_str().unwrap_or(id).into(),
            })
        })
        .collect())
}
#[tauri::command]
pub async fn connection_models(
    manager: State<'_, Arc<Connections>>,
    provider: String,
) -> Result<Vec<RemoteModel>, String> {
    let token = manager.token(&provider).await?;
    let value: Value = read_json(
        manager
            .client
            .get(format!("{API}/models"))
            .bearer_auth(token)
            .send()
            .await
            .map_err(network_error)?,
    )
    .await?;
    model_catalog(&value, &provider)
}

#[derive(Deserialize)]
pub struct InputMessage {
    role: String,
    content: String,
}
#[derive(Deserialize)]
pub struct GenerateRequest {
    provider: String,
    model: String,
    messages: Vec<InputMessage>,
    instructions: String,
}
fn response_body(request: &GenerateRequest) -> Result<Value, String> {
    if request.model.is_empty()
        || request.model.len() > 256
        || request.messages.is_empty()
        || request.messages.len() > 2000
        || request.instructions.len() > 256_000
    {
        return Err("This conversation exceeds the supported request size.".into());
    }
    let mut size = request.instructions.len();
    let mut input = vec![];
    for message in &request.messages {
        if !matches!(message.role.as_str(), "user" | "assistant") {
            return Err("Unsupported message role.".into());
        }
        size += message.content.len();
        if size > 4_000_000 {
            return Err("This conversation is too large. Start a new conversation with the context you need.".into());
        }
        input.push(json!({"role":message.role,"content":message.content}));
    }
    // Use the common documented subset. In particular plan usage rejects
    // temperature, max_output_tokens and server-side conversation references.
    Ok(
        json!({"model":request.model,"input":input,"instructions":request.instructions,"store":false,"stream":true,"tools":[]}),
    )
}
fn stream_event(value: &Value) -> Result<Option<Value>, String> {
    match value["type"].as_str().unwrap_or("") {
        "response.output_text.delta" => Ok(Some(
            json!({"type":"token", "content": value["delta"].as_str().ok_or("OpenAI returned an invalid text event.")?}),
        )),
        "response.completed" => Ok(Some(json!({"type":"done"}))),
        "response.failed" | "response.incomplete" | "error" => {
            let code = value
                .pointer("/response/error/code")
                .or_else(|| value.get("code"))
                .and_then(Value::as_str)
                .unwrap_or("");
            Err(match code {
                "subscription_sharing_usage_limit_exceeded" | "subscription_sharing_usage_unavailable" => "ChatGPT plan usage is unavailable or its limit was reached. Open Manage usage to review it.",
                "invalid_api_key" => "The OpenAI API key is invalid. Reconnect in Intelligence.",
                "insufficient_quota" => "OpenAI API balance is unavailable. Review your API billing.",
                _ => "OpenAI could not complete this response. Your partial answer has been kept.",
            }.into())
        }
        _ => Ok(None),
    }
}
#[derive(Default)]
struct SseDecoder {
    buffer: Vec<u8>,
}
impl SseDecoder {
    fn push(&mut self, chunk: &[u8]) -> Result<Vec<Value>, String> {
        self.buffer.extend_from_slice(chunk);
        if self.buffer.len() > 2_000_000 {
            return Err("OpenAI stream event exceeded the supported size.".into());
        }
        let mut values = vec![];
        loop {
            let boundary = self
                .buffer
                .windows(2)
                .position(|w| w == b"\n\n")
                .map(|p| (p, 2))
                .or_else(|| {
                    self.buffer
                        .windows(4)
                        .position(|w| w == b"\r\n\r\n")
                        .map(|p| (p, 4))
                });
            let Some((end, skip)) = boundary else {
                break;
            };
            let raw: Vec<u8> = self.buffer.drain(..end + skip).collect();
            let text = std::str::from_utf8(&raw[..end])
                .map_err(|_| "OpenAI returned invalid stream text.")?;
            let data = text
                .lines()
                .filter_map(|line| {
                    line.strip_prefix("data:")
                        .map(|s| s.strip_prefix(' ').unwrap_or(s))
                })
                .collect::<Vec<_>>()
                .join("\n");
            if data.is_empty() || data == "[DONE]" {
                continue;
            }
            values.push(
                serde_json::from_str(&data)
                    .map_err(|_| "OpenAI returned an unreadable stream event.")?,
            );
        }
        Ok(values)
    }
}
#[tauri::command]
pub async fn connection_generate(
    app: AppHandle,
    manager: State<'_, Arc<Connections>>,
    request_id: String,
    request: GenerateRequest,
) -> Result<(), String> {
    if Uuid::parse_str(&request_id).is_err() {
        return Err("Invalid generation identifier.".into());
    }
    let body = response_body(&request)?;
    let cancel = CancellationToken::new();
    {
        let mut active = manager.requests.lock().await;
        if active
            .remove(&request_id)
            .is_some_and(|token| token.is_cancelled())
        {
            return Err("Generation stopped.".into());
        }
        active.retain(|_, token| !token.is_cancelled());
        if !active.is_empty() {
            return Err("Wait for the current response or stop it first.".into());
        }
        active.insert(request_id.clone(), cancel.clone());
    }
    // Renewal may rotate a refresh token. Let it finish and persist before
    // honoring Stop, so cancellation cannot discard the replacement credential.
    let token = manager.token(&request.provider).await;
    let generate = async {
        let token = token?;
        let response = manager
            .client
            .post(format!("{API}/responses"))
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .map_err(network_error)?;
        if !response.status().is_success() {
            return Err(http_error(response.status().as_u16()));
        }
        let mut stream = response.bytes_stream();
        let mut decoder = SseDecoder::default();
        let _ = app.emit(
            "void-mind://connection-stream",
            json!({"requestId":request_id,"type":"start"}),
        );
        while let Some(chunk) = stream.next().await {
            for value in decoder.push(&chunk.map_err(network_error)?)? {
                if let Some(mut event) = stream_event(&value)? {
                    event["requestId"] = json!(request_id);
                    let done = event["type"] == "done";
                    app.emit("void-mind://connection-stream", event)
                        .map_err(|_| "Could not deliver the response to the app.")?;
                    if done {
                        return Ok(());
                    }
                }
            }
        }
        Err("The connection ended before OpenAI completed the response. Your partial answer has been kept.".into())
    };
    let result = tokio::select! { _ = cancel.cancelled() => Err("Generation stopped.".into()), result = generate => result };
    manager.requests.lock().await.remove(&request_id);
    result
}
#[tauri::command]
pub async fn connection_cancel(
    manager: State<'_, Arc<Connections>>,
    request_id: String,
) -> Result<(), String> {
    if Uuid::parse_str(&request_id).is_err() {
        return Err("Invalid generation identifier.".into());
    }
    let mut requests = manager.requests.lock().await;
    if let Some(token) = requests.get(&request_id) {
        token.cancel();
    } else if requests.len() < 32 {
        let token = CancellationToken::new();
        token.cancel();
        requests.insert(request_id, token);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn account() -> Account {
        Account {
            client_id: "issued-client".into(),
            subject: "verified-subject".into(),
            email: Some("test@example.invalid".into()),
            access_token: Some("test-access-secret".into()),
            refresh_token: Some("test-refresh-secret".into()),
            id_token: Some("test-id-secret".into()),
            expires_at: now() + 3600,
            earliest_refresh_at: 0,
            scopes: vec![PLAN_SCOPE.into()],
            welcomed: false,
        }
    }
    #[test]
    fn status_never_serializes_credentials_or_host_identity() {
        let vault = Vault {
            host_id: "private-host-id".into(),
            accounts: vec![account()],
            active: Some("issued-client".into()),
            api_key: Some("test-api-secret".into()),
            dirty: true,
        };
        let safe = serde_json::to_string(&snapshot(&vault)).unwrap();
        for secret in [
            "test-access-secret",
            "test-refresh-secret",
            "test-id-secret",
            "test-api-secret",
            "private-host-id",
            "verified-subject",
        ] {
            assert!(!safe.contains(secret));
        }
        assert!(snapshot(&vault).welcome_pending);
        assert!(!serde_json::to_string(&vault).unwrap().contains("dirty"));
    }
    #[test]
    fn renewal_replaces_scopes_and_tokens_and_revoked_permission_cannot_infer() {
        let mut account = account();
        apply_tokens(
            &mut account,
            TokenResponse {
                access_token: "new-access".into(),
                refresh_token: Some("rotating-refresh".into()),
                id_token: None,
                token_type: "Bearer".into(),
                expires_in: 3600,
                scope: Some("openid".into()),
                earliest_refresh_at: Some(123),
            },
            false,
        )
        .unwrap();
        assert_eq!(account.refresh_token.as_deref(), Some("rotating-refresh"));
        assert_eq!(account.earliest_refresh_at, 123);
        assert_eq!(account.scopes, vec!["openid"]);
        let vault = Vault {
            accounts: vec![account],
            active: Some("issued-client".into()),
            ..Vault::default()
        };
        assert!(account_token(&vault).is_err());
        let mut attempt = attempt();
        attempt.previous = Some(vault.accounts[0].clone());
        assert!(callback(
            "GET /auth/callback?state=secret-state&code=x&client_id=another-client HTTP/1.1",
            &attempt
        )
        .is_err());
    }
    fn attempt() -> LoginAttempt {
        LoginAttempt {
            state: "secret-state".into(),
            nonce: "nonce".into(),
            verifier: random(),
            redirect: "http://127.0.0.1:1234/auth/callback".into(),
            previous: None,
        }
    }
    #[test]
    fn authorization_uses_pkce_and_official_dynamic_registration() {
        let attempt = attempt();
        let url = reqwest::Url::parse(&authorize_url(&attempt, "urn:uuid:test").unwrap()).unwrap();
        let params: HashMap<_, _> = url.query_pairs().collect();
        assert_eq!(url.host_str(), Some("auth.openai.com"));
        assert_eq!(params["client_id"], "dynamic_agent_client");
        assert_eq!(params["code_challenge_method"], "S256");
        assert_ne!(params["code_challenge"], attempt.verifier);
        assert!(!url.as_str().contains("client_secret"));
    }
    #[test]
    fn callback_rejects_state_duplicates_and_entrypoint_as_issued_id() {
        let a = attempt();
        assert!(callback(
            "GET /auth/callback?code=x&state=wrong&client_id=issued HTTP/1.1",
            &a
        )
        .is_err());
        assert!(callback(
            "GET /auth/callback?code=x&state=secret-state&state=other&client_id=issued HTTP/1.1",
            &a
        )
        .is_err());
        assert!(callback(
            "GET /auth/callback?code=x&state=secret-state&client_id=dynamic_agent_client HTTP/1.1",
            &a
        )
        .is_err());
        assert_eq!(
            callback(
                "GET /auth/callback?code=x&state=secret-state&client_id=issued HTTP/1.1",
                &a
            )
            .unwrap(),
            ("x".into(), "issued".into())
        );
    }
    #[test]
    fn catalogs_are_separate_and_plan_visibility_is_respected() {
        let value = json!({"models":[{"slug":"a","display_name":"A","visibility":"list"},{"slug":"hidden","visibility":"hide"}],"data":[{"id":"b"}]});
        assert_eq!(model_catalog(&value, "openai-chatgpt").unwrap().len(), 1);
        assert_eq!(model_catalog(&value, "openai-api").unwrap()[0].id, "b");
    }
    #[test]
    fn decoder_preserves_split_unicode_and_requires_explicit_completion() {
        let mut parser = SseDecoder::default();
        let data =
            "data: {\"type\":\"response.output_text.delta\",\"delta\":\"céu\"}\r\n\r\n".as_bytes();
        let split = data.iter().position(|b| *b == 0xc3).unwrap() + 1;
        assert!(parser.push(&data[..split]).unwrap().is_empty());
        assert_eq!(
            stream_event(&parser.push(&data[split..]).unwrap()[0])
                .unwrap()
                .unwrap()["content"],
            "céu"
        );
        assert!(parser.push(b"data: [DONE]\n\n").unwrap().is_empty());
        assert!(stream_event(&json!({"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded","message":"SECRET"}}})).unwrap_err().contains("Manage usage"));
        assert_eq!(
            stream_event(&json!({"type":"response.completed"}))
                .unwrap()
                .unwrap()["type"],
            "done"
        );
    }
    #[test]
    fn requests_have_no_tools_server_history_or_rejected_plan_options() {
        let request = GenerateRequest {
            provider: "openai-chatgpt".into(),
            model: "actual-model".into(),
            messages: vec![InputMessage {
                role: "user".into(),
                content: "Hello".into(),
            }],
            instructions: "Explicit workspace".into(),
        };
        let body = response_body(&request).unwrap();
        assert_eq!(body["store"], false);
        assert_eq!(body["stream"], true);
        assert_eq!(body["tools"], json!([]));
        for field in [
            "temperature",
            "max_output_tokens",
            "previous_response_id",
            "conversation",
        ] {
            assert!(body.get(field).is_none());
        }
        assert_eq!(body["instructions"], "Explicit workspace");
    }
}
