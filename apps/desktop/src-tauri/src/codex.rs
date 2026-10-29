use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    env, fs,
    io::{BufRead, BufReader, Read, Seek, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc::{self, SyncSender},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const SHUTDOWN_GRACE: Duration = Duration::from_millis(500);
const VERSION_PROBE_TIMEOUT: Duration = Duration::from_secs(2);
const VERSION_OUTPUT_LIMIT: u64 = 4096;
const GENERAL_INSTRUCTIONS: &str = "You are the intelligence provider inside VOID Mind, a general-purpose workspace for natural conversation, reasoning, writing, explanation, brainstorming, study, and everyday assistance. Respond as a calm general-purpose assistant. Do not use shell commands, edit files, inspect repositories, invoke tools, or request project access. Answer directly in natural language.";

type PendingResponse = Result<Value, String>;
type PendingMap = Arc<Mutex<HashMap<u64, SyncSender<PendingResponse>>>>;
type SharedInput = Arc<Mutex<Option<ChildStdin>>>;

#[derive(Clone, Default)]
pub struct CodexRuntimeManager {
    inner: Arc<Mutex<CodexManagerState>>,
}

#[derive(Default)]
struct CodexManagerState {
    client: Option<Arc<CodexClient>>,
    last_exit_code: Option<i32>,
    last_error: Option<String>,
}

struct CodexClient {
    child: Mutex<Child>,
    stdin: SharedInput,
    pending: PendingMap,
    next_id: AtomicU64,
    alive: Arc<AtomicBool>,
    executable_path: PathBuf,
    version: String,
    neutral_cwd: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexRuntimeStatus {
    installed: bool,
    running: bool,
    state: &'static str,
    executable_path: Option<String>,
    version: Option<String>,
    neutral_workspace: Option<String>,
    exit_code: Option<i32>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAccountState {
    state: &'static str,
    auth_mode: Option<String>,
    email: Option<String>,
    plan_type: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexLoginStart {
    flow: String,
    login_id: String,
    auth_url: Option<String>,
    verification_url: Option<String>,
    user_code: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexReasoningEffort {
    id: String,
    description: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexServiceTier {
    id: String,
    name: String,
    description: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexModel {
    id: String,
    display_name: String,
    description: String,
    is_default: bool,
    reasoning_efforts: Vec<CodexReasoningEffort>,
    default_reasoning_effort: Option<String>,
    input_modalities: Vec<String>,
    supports_personality: bool,
    service_tiers: Vec<CodexServiceTier>,
    default_service_tier: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexThreadRequest {
    model: String,
    context_instructions: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexThreadBinding {
    remote_thread_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexResumeRequest {
    remote_thread_id: String,
    model: String,
    context_instructions: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexTurnRequest {
    remote_thread_id: String,
    message: String,
    model: String,
    reasoning_effort: Option<String>,
    service_tier: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexTurnBinding {
    turn_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexInterruptRequest {
    remote_thread_id: String,
    turn_id: String,
}

impl CodexRuntimeStatus {
    fn not_installed() -> Self {
        Self {
            installed: false,
            running: false,
            state: "notInstalled",
            executable_path: None,
            version: None,
            neutral_workspace: None,
            exit_code: None,
            error: None,
        }
    }

    fn ready(path: &Path, version: String) -> Self {
        Self {
            installed: true,
            running: false,
            state: "ready",
            executable_path: Some(path.to_string_lossy().into_owned()),
            version: Some(version),
            neutral_workspace: None,
            exit_code: None,
            error: None,
        }
    }

    fn running(client: &CodexClient) -> Self {
        Self {
            installed: true,
            running: true,
            state: "running",
            executable_path: Some(client.executable_path.to_string_lossy().into_owned()),
            version: Some(client.version.clone()),
            neutral_workspace: Some(client.neutral_cwd.to_string_lossy().into_owned()),
            exit_code: None,
            error: None,
        }
    }
}

impl CodexClient {
    fn request(&self, method: &str, params: Option<Value>) -> Result<Value, String> {
        if !self.alive.load(Ordering::Acquire) {
            return Err("The Codex runtime is not running.".into());
        }
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = mpsc::sync_channel(1);
        self.pending
            .lock()
            .map_err(|_| "Codex request state is unavailable.".to_string())?
            .insert(id, sender);
        let mut request = json!({ "method": method, "id": id });
        if let Some(params) = params {
            request["params"] = params;
        }
        if let Err(error) = self.write_message(&request) {
            if let Ok(mut pending) = self.pending.lock() {
                pending.remove(&id);
            }
            return Err(error);
        }
        match receiver.recv_timeout(REQUEST_TIMEOUT) {
            Ok(response) => response,
            Err(_) => {
                if let Ok(mut pending) = self.pending.lock() {
                    pending.remove(&id);
                }
                Err(format!("Codex did not answer {method} in time."))
            }
        }
    }

    fn notify(&self, method: &str) -> Result<(), String> {
        self.write_message(&json!({ "method": method }))
    }

    fn write_message(&self, message: &Value) -> Result<(), String> {
        let mut input = self
            .stdin
            .lock()
            .map_err(|_| "Codex input is unavailable.".to_string())?;
        if !self.alive.load(Ordering::Acquire) {
            return Err("The Codex runtime is not running.".into());
        }
        let stdin = input
            .as_mut()
            .ok_or_else(|| "Codex input is closed.".to_string())?;
        serde_json::to_writer(&mut *stdin, message)
            .map_err(|_| "Could not encode a Codex protocol request.".to_string())?;
        stdin
            .write_all(b"\n")
            .and_then(|_| stdin.flush())
            .map_err(|_| "Could not write to the Codex runtime.".to_string())
    }

    fn shutdown(&self) {
        self.alive.store(false, Ordering::Release);
        fail_pending(&self.pending, "The Codex runtime stopped.");
        // Closing the shared input sends EOF even while the reader owns a clone.
        // Never wait for a writer holding the pipe: killing the owned child below
        // releases a blocked write instead of blocking application exit on it.
        let input_closed = if let Ok(mut input) = self.stdin.try_lock() {
            input.take();
            true
        } else {
            false
        };
        if let Ok(mut child) = self.child.lock() {
            let deadline = Instant::now() + SHUTDOWN_GRACE;
            while input_closed {
                match child.try_wait() {
                    Ok(Some(_)) => break,
                    Err(_) => break,
                    Ok(None) if Instant::now() >= deadline => break,
                    Ok(None) => thread::sleep(Duration::from_millis(10)),
                }
            }
            if child.try_wait().ok().flatten().is_none() {
                let _ = child.kill();
            }
            let _ = child.wait();
        }
        if let Ok(mut input) = self.stdin.try_lock() {
            input.take();
        }
    }
}

impl CodexRuntimeManager {
    pub fn stop_for_shutdown(&self) {
        let client = self
            .inner
            .lock()
            .ok()
            .and_then(|mut state| state.client.take());
        if let Some(client) = client {
            client.shutdown();
        }
    }

    fn status(&self) -> CodexRuntimeStatus {
        let Ok(mut state) = self.inner.lock() else {
            return CodexRuntimeStatus::not_installed();
        };
        let client = state.client.clone();
        if let Some(client) = client {
            let exit = client
                .child
                .lock()
                .ok()
                .and_then(|mut child| child.try_wait().ok().flatten());
            if let Some(exit) = exit {
                client.alive.store(false, Ordering::Release);
                state.client = None;
                state.last_exit_code = exit.code();
                state.last_error = Some("The Codex runtime exited.".into());
            } else if client.alive.load(Ordering::Acquire) {
                return CodexRuntimeStatus::running(&client);
            }
        }

        match locate_codex() {
            Some(path) => {
                let mut status = CodexRuntimeStatus::ready(&path, codex_version(&path));
                status.exit_code = state.last_exit_code;
                status.error = state.last_error.clone();
                if status.error.is_some() {
                    status.state = "error";
                }
                status
            }
            None => CodexRuntimeStatus::not_installed(),
        }
    }

    fn start(&self, app: &AppHandle) -> Result<CodexRuntimeStatus, String> {
        let mut manager = self
            .inner
            .lock()
            .map_err(|_| "Codex runtime state is unavailable.".to_string())?;
        if let Some(client) = manager.client.clone() {
            if client.alive.load(Ordering::Acquire)
                && client
                    .child
                    .lock()
                    .map_err(|_| "Codex process state is unavailable.".to_string())?
                    .try_wait()
                    .map_err(|error| format!("Could not inspect Codex: {error}"))?
                    .is_none()
            {
                return Ok(CodexRuntimeStatus::running(&client));
            }
            client.shutdown();
            manager.client = None;
        }

        let executable = locate_codex().ok_or_else(|| {
            "Codex is not installed or is not available on this device's PATH.".to_string()
        })?;
        let version = codex_version(&executable);
        let neutral_cwd = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("Could not locate app data: {error}"))?
            .join("codex-workspace");
        fs::create_dir_all(&neutral_cwd)
            .map_err(|error| format!("Could not prepare the neutral Codex workspace: {error}"))?;

        let mut command = Command::new(&executable);
        command
            .arg("app-server")
            .arg("--stdio")
            .current_dir(&neutral_cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        let mut child = command
            .spawn()
            .map_err(|error| format!("Could not start Codex app-server: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Codex app-server did not expose stdin.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Codex app-server did not expose stdout.".to_string())?;
        let stderr = child.stderr.take();

        let pending = Arc::new(Mutex::new(HashMap::new()));
        let alive = Arc::new(AtomicBool::new(true));
        let stdin = Arc::new(Mutex::new(Some(stdin)));
        let event_app = app.clone();
        spawn_reader(
            stdout,
            Arc::clone(&stdin),
            Arc::clone(&pending),
            Arc::clone(&alive),
            move |event| {
                let _ = event_app.emit("void-mind://codex-event", event);
            },
        );
        if let Some(stderr) = stderr {
            thread::spawn(move || {
                for line in BufReader::new(stderr).lines() {
                    if line.is_err() {
                        break;
                    }
                }
            });
        }

        let client = Arc::new(CodexClient {
            child: Mutex::new(child),
            stdin,
            pending,
            next_id: AtomicU64::new(1),
            alive,
            executable_path: executable,
            version,
            neutral_cwd,
        });
        if let Err(error) = client.request(
            "initialize",
            Some(json!({
                "clientInfo": {
                    "name": "void_mind",
                    "title": "VOID Mind",
                    "version": env!("CARGO_PKG_VERSION")
                },
                "capabilities": null
            })),
        ) {
            client.shutdown();
            return Err(format!("Codex protocol initialization failed: {error}"));
        }
        if let Err(error) = client.notify("initialized") {
            client.shutdown();
            return Err(format!("Codex protocol initialization failed: {error}"));
        }
        manager.client = Some(Arc::clone(&client));
        manager.last_exit_code = None;
        manager.last_error = None;
        Ok(CodexRuntimeStatus::running(&client))
    }

    fn client(&self, app: &AppHandle) -> Result<Arc<CodexClient>, String> {
        self.start(app)
            .map_err(|error| user_error_message(&error))?;
        self.inner
            .lock()
            .map_err(|_| "Codex runtime state is unavailable.".to_string())?
            .client
            .clone()
            .ok_or_else(|| "The Codex runtime is unavailable.".to_string())
    }
}

fn spawn_reader<F>(
    stdout: ChildStdout,
    stdin: SharedInput,
    pending: PendingMap,
    alive: Arc<AtomicBool>,
    emit: F,
) -> thread::JoinHandle<()>
where
    F: Fn(Value) + Send + 'static,
{
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else {
                break;
            };
            let message: Value = match serde_json::from_str(&line) {
                Ok(value) => value,
                Err(_) => {
                    emit(json!({
                        "type": "protocolError",
                        "category": "protocolMismatch",
                        "message": "Codex returned a malformed protocol message."
                    }));
                    continue;
                }
            };
            if message.get("method").is_some() && message.get("id").is_some() {
                reject_server_request(&stdin, &message);
                continue;
            }
            if dispatch_response(&pending, &message) {
                continue;
            }
            if let Some(event) = normalize_notification(&message) {
                emit(event);
            }
        }
        alive.store(false, Ordering::Release);
        fail_pending(
            &pending,
            "The Codex runtime exited before completing the request.",
        );
        emit(json!({
            "type": "runtimeExited",
            "category": "runtimeExited",
            "message": "The Codex runtime exited."
        }));
    })
}

fn dispatch_response(pending: &PendingMap, message: &Value) -> bool {
    if message.get("method").is_some() {
        return false;
    }
    let Some(id) = message.get("id").and_then(Value::as_u64) else {
        return false;
    };
    let response = if let Some(error) = message.get("error") {
        Err(user_error_message(&protocol_error(error)))
    } else {
        Ok(message.get("result").cloned().unwrap_or(Value::Null))
    };
    if let Ok(mut requests) = pending.lock() {
        if let Some(sender) = requests.remove(&id) {
            let _ = sender.send(response);
        }
    }
    true
}

fn reject_server_request(stdin: &SharedInput, request: &Value) {
    let response = json!({
        "id": request.get("id").cloned().unwrap_or(Value::Null),
        "error": {
            "code": -32601,
            "message": "VOID Mind does not expose tools or approval workflows."
        }
    });
    if let Ok(mut input) = stdin.lock() {
        let Some(writer) = input.as_mut() else {
            return;
        };
        let _ = serde_json::to_writer(&mut *writer, &response);
        let _ = writer.write_all(b"\n");
        let _ = writer.flush();
    }
}

fn normalize_notification(message: &Value) -> Option<Value> {
    let method = message.get("method")?.as_str()?;
    let params = message.get("params").cloned().unwrap_or(Value::Null);
    match method {
        "account/login/completed" => {
            let error = params
                .get("error")
                .and_then(error_detail)
                .map(user_error_message);
            Some(json!({
                "type": "loginCompleted",
                "loginId": params.get("loginId").cloned().unwrap_or(Value::Null),
                "success": params.get("success").and_then(Value::as_bool).unwrap_or(false),
                "error": error
            }))
        }
        "account/updated" => Some(json!({
            "type": "accountUpdated",
            "authMode": params.get("authMode").cloned().unwrap_or(Value::Null),
            "planType": params.get("planType").cloned().unwrap_or(Value::Null)
        })),
        "item/agentMessage/delta" => Some(json!({
            "type": "assistantDelta",
            "threadId": params.get("threadId").cloned().unwrap_or(Value::Null),
            "turnId": params.get("turnId").cloned().unwrap_or(Value::Null),
            "itemId": params.get("itemId").cloned().unwrap_or(Value::Null),
            "delta": params.get("delta").cloned().unwrap_or(Value::String(String::new()))
        })),
        "turn/completed" => {
            let turn = params.get("turn").cloned().unwrap_or(Value::Null);
            Some(json!({
                "type": "turnCompleted",
                "threadId": params.get("threadId").cloned().unwrap_or(Value::Null),
                "turnId": turn.get("id").cloned().unwrap_or(Value::Null),
                "status": turn.get("status").cloned().unwrap_or(Value::String("failed".into())),
                "error": turn.get("error").and_then(|error| error.get("message")).cloned().unwrap_or(Value::Null)
            }))
        }
        "error" => {
            let detail = params
                .get("error")
                .and_then(error_detail)
                .unwrap_or("Codex generation failed.");
            Some(json!({
                "type": "error",
                "threadId": params.get("threadId").cloned().unwrap_or(Value::Null),
                "turnId": params.get("turnId").cloned().unwrap_or(Value::Null),
                "category": error_category(detail),
                "message": user_error_message(detail),
                "willRetry": params.get("willRetry").and_then(Value::as_bool).unwrap_or(false)
            }))
        }
        "model/rerouted" => Some(json!({
            "type": "modelRerouted",
            "fromModel": params.get("fromModel").or_else(|| params.get("from")).cloned().unwrap_or(Value::Null),
            "toModel": params.get("toModel").or_else(|| params.get("to")).cloned().unwrap_or(Value::Null),
            "reason": params.get("reason").cloned().unwrap_or(Value::Null)
        })),
        "account/rateLimits/updated" => Some(json!({ "type": "usageUpdated" })),
        _ => None,
    }
}

fn fail_pending(pending: &PendingMap, message: &str) {
    if let Ok(mut requests) = pending.lock() {
        for (_, sender) in requests.drain() {
            let _ = sender.send(Err(message.to_string()));
        }
    }
}

fn protocol_error(error: &Value) -> String {
    error
        .get("message")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .unwrap_or_else(|| "Codex rejected the protocol request.".into())
}

fn error_detail(error: &Value) -> Option<&str> {
    error
        .as_str()
        .or_else(|| error.get("message").and_then(Value::as_str))
}

fn error_category(message: &str) -> &'static str {
    let message = message.to_ascii_lowercase();
    if message.contains("sandbox") || message.contains("effective :root") {
        "sandboxUnavailable"
    } else if message.contains("not installed")
        || message.contains("not available on this device")
        || message.contains("install codex")
    {
        "runtimeMissing"
    } else if message.contains("runtime stopped")
        || message.contains("runtime exited")
        || message.contains("runtime is unavailable")
        || message.contains("runtime is not running")
    {
        "runtimeUnavailable"
    } else if message.contains("auth")
        || message.contains("login")
        || message.contains("unauthorized")
        || message.contains("chatgpt account")
    {
        "authenticationRequired"
    } else if message.contains("rate") || message.contains("usage") || message.contains("limit") {
        "usageLimit"
    } else if message.contains("network")
        || message.contains("connection")
        || message.contains("reach openai")
        || message.contains("dns")
    {
        "networkUnavailable"
    } else if message.contains("model") {
        "modelUnavailable"
    } else if message.contains("protocol")
        || message.contains("initialize")
        || message.contains("json")
    {
        "protocolMismatch"
    } else {
        "generationFailed"
    }
}

fn user_error_message(message: &str) -> String {
    match error_category(message) {
        "sandboxUnavailable" => "Codex could not create the restricted conversation sandbox on this device. Check the Codex sandbox setup and try again. Access was not broadened.".into(),
        "runtimeMissing" => {
            "Install Codex or make it available to VOID Mind, then try again.".into()
        }
        "runtimeUnavailable" => "The Codex runtime is not available. Try reconnecting.".into(),
        "authenticationRequired" => "Connect your ChatGPT account to continue.".into(),
        "usageLimit" => "The connected account has reached a current usage limit.".into(),
        "networkUnavailable" => {
            "Codex could not reach OpenAI. Check the network and try again.".into()
        }
        "modelUnavailable" => "The selected model is not currently available.".into(),
        "protocolMismatch" => {
            "This Codex version returned an unsupported protocol response.".into()
        }
        _ => "Codex could not complete this response.".into(),
    }
}

fn is_codex_name(path: &Path) -> bool {
    matches!(
        path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "codex" | "codex.exe" | "codex.cmd" | "codex.bat"
    )
}

#[cfg(windows)]
fn native_codex_from_npm_shim(shim: &Path) -> Option<PathBuf> {
    let extension = shim
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension != "cmd" && extension != "bat" {
        return None;
    }

    let (platform_package, target_triple) = match std::env::consts::ARCH {
        "x86_64" => ("codex-win32-x64", "x86_64-pc-windows-msvc"),
        "aarch64" => ("codex-win32-arm64", "aarch64-pc-windows-msvc"),
        _ => return None,
    };

    let npm_root = shim.parent()?;
    let launcher_root = npm_root.join("node_modules").join("@openai").join("codex");
    let relative_native = Path::new("vendor")
        .join(target_triple)
        .join("bin")
        .join("codex.exe");
    [
        launcher_root
            .join("node_modules")
            .join("@openai")
            .join(platform_package)
            .join(&relative_native),
        npm_root
            .join("node_modules")
            .join("@openai")
            .join(platform_package)
            .join(&relative_native),
        launcher_root.join(&relative_native),
    ]
    .into_iter()
    .find_map(|candidate| {
        (candidate.is_file() && is_codex_name(&candidate))
            .then(|| candidate.canonicalize().ok())
            .flatten()
    })
}

fn resolve_codex_candidate(path: &Path) -> Option<PathBuf> {
    let metadata = path.metadata().ok()?;
    if !metadata.is_file() || !is_codex_name(path) {
        return None;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if metadata.permissions().mode() & 0o111 == 0 {
            return None;
        }
    }
    #[cfg(windows)]
    if matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "cmd" | "bat"
    ) {
        return native_codex_from_npm_shim(path);
    }
    path.canonicalize().ok()
}

fn locate_codex() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(path) = env::var_os("PATH") {
        for directory in env::split_paths(&path) {
            #[cfg(windows)]
            for name in ["codex.exe", "codex.cmd", "codex.bat"] {
                candidates.push(directory.join(name));
            }
            #[cfg(not(windows))]
            candidates.push(directory.join("codex"));
        }
    }
    #[cfg(windows)]
    if let Some(local) = env::var_os("LOCALAPPDATA") {
        let bin = PathBuf::from(local)
            .join("OpenAI")
            .join("Codex")
            .join("bin");
        if let Ok(entries) = fs::read_dir(bin) {
            for entry in entries.flatten() {
                candidates.push(entry.path().join("codex.exe"));
            }
        }
    }
    let mut seen = HashSet::new();
    let candidates: Vec<PathBuf> = candidates
        .into_iter()
        .filter_map(|path| resolve_codex_candidate(&path))
        .filter(|path| seen.insert(path.clone()))
        .collect();
    #[cfg(windows)]
    {
        let deadline = Instant::now() + VERSION_PROBE_TIMEOUT;
        for path in &candidates {
            let Some(remaining) = deadline.checked_duration_since(Instant::now()) else {
                break;
            };
            if supports_mxc_version(&codex_version_with_timeout(path, remaining)) {
                return Some(path.clone());
            }
        }
    }
    candidates.into_iter().next()
}

#[cfg(any(windows, test))]
fn supports_mxc_version(version: &str) -> bool {
    let mut parts = version.split(['.', '-']);
    let major = parts.next().and_then(|part| part.parse::<u32>().ok());
    let minor = parts.next().and_then(|part| part.parse::<u32>().ok());
    matches!(
        (major, minor),
        (Some(1..), Some(_)) | (Some(0), Some(162..))
    )
}

fn codex_version(path: &Path) -> String {
    codex_version_with_timeout(path, VERSION_PROBE_TIMEOUT)
}

fn codex_version_with_timeout(path: &Path, timeout: Duration) -> String {
    let mut command = Command::new(path);
    command.arg("--version");
    capture_version_output(command, timeout)
        .ok()
        .and_then(parse_codex_version)
        .unwrap_or_else(|| "Unknown".into())
}

#[derive(Debug, PartialEq, Eq)]
enum VersionProbeError {
    Io,
    Timeout,
    OutputLimit,
    NonzeroExit,
}

fn stop_version_probe(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

fn capture_version_output(
    mut command: Command,
    timeout: Duration,
) -> Result<Vec<u8>, VersionProbeError> {
    if timeout.is_zero() {
        return Err(VersionProbeError::Timeout);
    }
    // Anonymous output avoids pipe backpressure/reader threads. The OS removes
    // the file after its last handle closes, including error/timeout paths.
    let mut output = tempfile::tempfile().map_err(|_| VersionProbeError::Io)?;
    command
        .stdin(Stdio::null())
        .stdout(output.try_clone().map_err(|_| VersionProbeError::Io)?)
        .stderr(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let deadline = Instant::now() + timeout;
    let mut child = command.spawn().map_err(|_| VersionProbeError::Io)?;
    loop {
        if Instant::now() >= deadline {
            stop_version_probe(&mut child);
            return Err(VersionProbeError::Timeout);
        }
        match output.metadata() {
            Ok(metadata) if metadata.len() <= VERSION_OUTPUT_LIMIT => {}
            Ok(_) => {
                stop_version_probe(&mut child);
                return Err(VersionProbeError::OutputLimit);
            }
            Err(_) => {
                stop_version_probe(&mut child);
                return Err(VersionProbeError::Io);
            }
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Err(VersionProbeError::NonzeroExit);
                }
                output.rewind().map_err(|_| VersionProbeError::Io)?;
                let mut bytes = Vec::new();
                output
                    .take(VERSION_OUTPUT_LIMIT + 1)
                    .read_to_end(&mut bytes)
                    .map_err(|_| VersionProbeError::Io)?;
                return if bytes.len() as u64 > VERSION_OUTPUT_LIMIT {
                    Err(VersionProbeError::OutputLimit)
                } else {
                    Ok(bytes)
                };
            }
            Ok(None) => {}
            Err(_) => {
                stop_version_probe(&mut child);
                return Err(VersionProbeError::Io);
            }
        }
        let Some(remaining) = deadline.checked_duration_since(Instant::now()) else {
            stop_version_probe(&mut child);
            return Err(VersionProbeError::Timeout);
        };
        thread::sleep(remaining.min(Duration::from_millis(10)));
    }
}

fn parse_codex_version(bytes: Vec<u8>) -> Option<String> {
    let value = String::from_utf8(bytes).ok()?;
    let value = value.trim().trim_start_matches("codex-cli ");
    (!value.is_empty() && value.len() <= 128 && !value.chars().any(char::is_control))
        .then(|| value.to_string())
}

fn required_string(value: &Value, key: &str) -> Result<String, String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| "This Codex version returned an unsupported protocol response.".to_string())
}

fn isolated_conversation_config(neutral_cwd: &Path) -> Value {
    let mut filesystem = serde_json::Map::new();
    filesystem.insert(":minimal".into(), Value::String("read".into()));
    filesystem.insert(
        neutral_cwd.to_string_lossy().into_owned(),
        Value::String("read".into()),
    );

    let mut config = json!({
        "default_permissions": "void_mind",
        "permissions": {
            "void_mind": {
                "description": "Isolated general-purpose conversation",
                "filesystem": filesystem,
                "network": { "enabled": false }
            }
        }
    });
    if cfg!(windows) {
        config["windows"] = json!({ "sandbox": "mxc" });
    }
    config
}

fn context_instructions(value: Option<String>) -> String {
    match value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        Some(value) => format!(
            "Follow these explicit user-owned VOID Mind response and workspace instructions when relevant:\n\n{value}"
        ),
        None => "No additional response or workspace instructions are active.".into(),
    }
}

#[tauri::command]
pub fn codex_status(state: tauri::State<'_, CodexRuntimeManager>) -> CodexRuntimeStatus {
    state.status()
}

#[tauri::command]
pub fn codex_start(
    app: AppHandle,
    state: tauri::State<'_, CodexRuntimeManager>,
) -> Result<CodexRuntimeStatus, String> {
    state
        .start(&app)
        .map_err(|error| user_error_message(&error))
}

#[tauri::command]
pub fn codex_stop(
    state: tauri::State<'_, CodexRuntimeManager>,
) -> Result<CodexRuntimeStatus, String> {
    state.stop_for_shutdown();
    Ok(state.status())
}

#[tauri::command]
pub fn codex_account(
    app: AppHandle,
    state: tauri::State<'_, CodexRuntimeManager>,
) -> Result<CodexAccountState, String> {
    let response = state
        .client(&app)?
        .request("account/read", Some(json!({ "refreshToken": false })))?;
    let Some(account) = response.get("account").filter(|value| !value.is_null()) else {
        return Ok(CodexAccountState {
            state: "disconnected",
            auth_mode: None,
            email: None,
            plan_type: None,
        });
    };
    let auth_mode = account
        .get("type")
        .and_then(Value::as_str)
        .map(str::to_owned);
    let connected = auth_mode.as_deref() == Some("chatgpt");
    Ok(CodexAccountState {
        state: if connected {
            "connected"
        } else {
            "unsupported"
        },
        auth_mode,
        email: account
            .get("email")
            .and_then(Value::as_str)
            .map(str::to_owned),
        plan_type: account
            .get("planType")
            .and_then(Value::as_str)
            .map(str::to_owned),
    })
}

#[tauri::command]
pub fn codex_login_start(
    app: AppHandle,
    state: tauri::State<'_, CodexRuntimeManager>,
    flow: String,
) -> Result<CodexLoginStart, String> {
    let params = match flow.as_str() {
        "browser" => json!({
            "type": "chatgpt",
            "useHostedLoginSuccessPage": true,
            "appBrand": "chatgpt"
        }),
        "deviceCode" => json!({ "type": "chatgptDeviceCode" }),
        _ => return Err("Unsupported Codex login flow.".into()),
    };
    let response = state
        .client(&app)?
        .request("account/login/start", Some(params))?;
    let response_type = required_string(&response, "type")?;
    Ok(CodexLoginStart {
        flow: if response_type == "chatgptDeviceCode" {
            "deviceCode".into()
        } else {
            "browser".into()
        },
        login_id: required_string(&response, "loginId")?,
        auth_url: response
            .get("authUrl")
            .and_then(Value::as_str)
            .map(str::to_owned),
        verification_url: response
            .get("verificationUrl")
            .and_then(Value::as_str)
            .map(str::to_owned),
        user_code: response
            .get("userCode")
            .and_then(Value::as_str)
            .map(str::to_owned),
    })
}

#[tauri::command]
pub fn codex_login_cancel(
    app: AppHandle,
    state: tauri::State<'_, CodexRuntimeManager>,
    login_id: String,
) -> Result<(), String> {
    state
        .client(&app)?
        .request("account/login/cancel", Some(json!({ "loginId": login_id })))?;
    Ok(())
}

#[tauri::command]
pub fn codex_logout(
    app: AppHandle,
    state: tauri::State<'_, CodexRuntimeManager>,
) -> Result<(), String> {
    state.client(&app)?.request("account/logout", None)?;
    Ok(())
}

#[tauri::command]
pub fn codex_models(
    app: AppHandle,
    state: tauri::State<'_, CodexRuntimeManager>,
) -> Result<Vec<CodexModel>, String> {
    let response = state.client(&app)?.request(
        "model/list",
        Some(json!({ "limit": 100, "includeHidden": false })),
    )?;
    let data = response
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            "This Codex version returned an unsupported protocol response.".to_string()
        })?;
    data.iter()
        .map(|model| {
            let reasoning_efforts = model
                .get("supportedReasoningEfforts")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|effort| {
                    Some(CodexReasoningEffort {
                        id: effort.get("reasoningEffort")?.as_str()?.to_string(),
                        description: effort
                            .get("description")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string(),
                    })
                })
                .collect();
            let service_tiers = model
                .get("serviceTiers")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|tier| {
                    Some(CodexServiceTier {
                        id: tier.get("id")?.as_str()?.to_string(),
                        name: tier
                            .get("name")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string(),
                        description: tier
                            .get("description")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string(),
                    })
                })
                .collect();
            Ok(CodexModel {
                id: required_string(model, "id")?,
                display_name: required_string(model, "displayName")?,
                description: model
                    .get("description")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                is_default: model
                    .get("isDefault")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                reasoning_efforts,
                default_reasoning_effort: model
                    .get("defaultReasoningEffort")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                input_modalities: model
                    .get("inputModalities")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(|item| item.as_str().map(str::to_owned))
                    .collect(),
                supports_personality: model
                    .get("supportsPersonality")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                service_tiers,
                default_service_tier: model
                    .get("defaultServiceTier")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
            })
        })
        .collect()
}

#[tauri::command]
pub fn codex_thread_start(
    app: AppHandle,
    state: tauri::State<'_, CodexRuntimeManager>,
    request: CodexThreadRequest,
) -> Result<CodexThreadBinding, String> {
    let client = state.client(&app)?;
    let response = client.request(
        "thread/start",
        Some(json!({
            "model": request.model,
            "cwd": client.neutral_cwd,
            "approvalPolicy": "never",
            "config": isolated_conversation_config(&client.neutral_cwd),
            "baseInstructions": GENERAL_INSTRUCTIONS,
            "developerInstructions": context_instructions(request.context_instructions),
            "serviceName": "void_mind",
            "ephemeral": false
        })),
    )?;
    Ok(CodexThreadBinding {
        remote_thread_id: required_string(
            response.get("thread").ok_or_else(|| {
                "This Codex version returned an unsupported protocol response.".to_string()
            })?,
            "id",
        )?,
    })
}

#[tauri::command]
pub fn codex_thread_resume(
    app: AppHandle,
    state: tauri::State<'_, CodexRuntimeManager>,
    request: CodexResumeRequest,
) -> Result<CodexThreadBinding, String> {
    let client = state.client(&app)?;
    let response = client.request(
        "thread/resume",
        Some(json!({
            "threadId": request.remote_thread_id,
            "model": request.model,
            "cwd": client.neutral_cwd,
            "approvalPolicy": "never",
            "config": isolated_conversation_config(&client.neutral_cwd),
            "baseInstructions": GENERAL_INSTRUCTIONS,
            "developerInstructions": context_instructions(request.context_instructions)
        })),
    )?;
    Ok(CodexThreadBinding {
        remote_thread_id: required_string(
            response.get("thread").ok_or_else(|| {
                "This Codex version returned an unsupported protocol response.".to_string()
            })?,
            "id",
        )?,
    })
}

#[tauri::command]
pub fn codex_turn_start(
    app: AppHandle,
    state: tauri::State<'_, CodexRuntimeManager>,
    request: CodexTurnRequest,
) -> Result<CodexTurnBinding, String> {
    let message = request.message.trim();
    if message.is_empty() {
        return Err("Message cannot be empty.".into());
    }
    if message.len() > 200_000 {
        return Err("Message and selected context are too large for this conversation.".into());
    }
    let response = state.client(&app)?.request(
        "turn/start",
        Some(json!({
            "threadId": request.remote_thread_id,
            "input": [{ "type": "text", "text": message, "text_elements": [] }],
            "approvalPolicy": "never",
            "model": request.model,
            "effort": request.reasoning_effort,
            "serviceTierForTurn": request.service_tier
        })),
    )?;
    Ok(CodexTurnBinding {
        turn_id: required_string(
            response.get("turn").ok_or_else(|| {
                "This Codex version returned an unsupported protocol response.".to_string()
            })?,
            "id",
        )?,
    })
}

#[tauri::command]
pub fn codex_turn_interrupt(
    app: AppHandle,
    state: tauri::State<'_, CodexRuntimeManager>,
    request: CodexInterruptRequest,
) -> Result<(), String> {
    state.client(&app)?.request(
        "turn/interrupt",
        Some(json!({
            "threadId": request.remote_thread_id,
            "turnId": request.turn_id
        })),
    )?;
    Ok(())
}

#[tauri::command]
pub fn open_codex_auth_url(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = tauri::Url::parse(&url).map_err(|_| "Codex returned an invalid login URL.")?;
    if parsed.scheme() != "https" {
        return Err("Codex login must use a secure HTTPS URL.".into());
    }
    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    let allowed = ["chatgpt.com", "openai.com"]
        .iter()
        .any(|domain| host == *domain || host.ends_with(&format!(".{domain}")));
    if !allowed {
        return Err("Codex returned an unexpected login host.".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|_| "Could not open the secure Codex sign-in page.".to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        error_category, is_codex_name, isolated_conversation_config, normalize_notification,
        resolve_codex_candidate, user_error_message,
    };
    use serde_json::json;
    use std::path::{Path, PathBuf};

    // Runs only in a child test binary selected by the process tests below.
    #[test]
    #[ignore = "isolated stdio fixture; invoked by lifecycle tests"]
    fn stdio_process_fixture() {
        use std::io::{self, BufRead, Write};
        assert_eq!(std::env::var("VOID_MIND_STDIO_FIXTURE").as_deref(), Ok("1"));
        println!(); // Separate libtest's status prefix from protocol output.
        io::stdout().flush().unwrap();
        if let Ok(mode) = std::env::var("VOID_MIND_VERSION_FIXTURE") {
            match mode.as_str() {
                "version" => {
                    println!("codex-cli 0.165.0");
                    std::process::exit(0);
                }
                "hang" => {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                    std::process::exit(0);
                }
                "large" => {
                    let _ = io::stdout().write_all(&vec![b'x'; 16_384]);
                    std::process::exit(0);
                }
                "fail" => std::process::exit(7),
                _ => panic!("Unsupported version fixture"),
            }
        }
        for line in io::stdin().lock().lines() {
            let request: serde_json::Value = serde_json::from_str(&line.unwrap()).unwrap();
            match request["method"].as_str().unwrap() {
                "crash" => std::process::exit(7),
                "hold" => {
                    // A notification proves receipt without answering the request.
                    println!("{}", json!({"method": "account/updated", "params": {}}));
                    io::stdout().flush().unwrap();
                }
                _ => {
                    println!(
                        "{}",
                        json!({"id": request["id"], "result": {"ready": true}})
                    );
                    io::stdout().flush().unwrap();
                }
            }
        }
        if std::env::var("VOID_MIND_IGNORE_EOF").as_deref() == Ok("1") {
            std::thread::sleep(std::time::Duration::from_secs(60));
        }
    }

    struct TestRuntime {
        client: std::sync::Arc<super::CodexClient>,
        reader: Option<std::thread::JoinHandle<()>>,
        hold_received: std::sync::Arc<std::sync::atomic::AtomicBool>,
    }

    fn version_fixture(mode: &str) -> std::process::Command {
        let mut command = std::process::Command::new(std::env::current_exe().unwrap());
        command
            .args([
                "--exact",
                "codex::tests::stdio_process_fixture",
                "--ignored",
                "--nocapture",
            ])
            .env("VOID_MIND_STDIO_FIXTURE", "1")
            .env("VOID_MIND_VERSION_FIXTURE", mode);
        command
    }

    #[test]
    fn version_probe_collects_success_and_rejects_nonzero_exit() {
        let output = super::capture_version_output(
            version_fixture("version"),
            std::time::Duration::from_secs(5),
        )
        .unwrap();
        assert!(String::from_utf8(output)
            .unwrap()
            .contains("codex-cli 0.165.0"));
        assert_eq!(
            super::capture_version_output(
                version_fixture("fail"),
                std::time::Duration::from_secs(5)
            ),
            Err(super::VersionProbeError::NonzeroExit)
        );
    }

    #[test]
    fn version_probe_times_out_an_actual_hanging_child() {
        let started = std::time::Instant::now();
        assert_eq!(
            super::capture_version_output(
                version_fixture("hang"),
                std::time::Duration::from_millis(200)
            ),
            Err(super::VersionProbeError::Timeout)
        );
        assert!(started.elapsed() < std::time::Duration::from_secs(5));
    }

    #[test]
    fn version_probe_rejects_excessive_output_and_spawn_failure() {
        assert_eq!(
            super::capture_version_output(
                version_fixture("large"),
                std::time::Duration::from_secs(5)
            ),
            Err(super::VersionProbeError::OutputLimit)
        );
        let missing =
            std::env::temp_dir().join(format!("void-mind-missing-{}", uuid::Uuid::new_v4()));
        assert_eq!(
            super::capture_version_output(
                std::process::Command::new(&missing),
                std::time::Duration::ZERO
            ),
            Err(super::VersionProbeError::Timeout)
        );
        assert_eq!(
            super::capture_version_output(
                std::process::Command::new(missing),
                std::time::Duration::from_secs(1)
            ),
            Err(super::VersionProbeError::Io)
        );
    }

    #[test]
    fn version_labels_reject_empty_invalid_multiline_and_oversized_values() {
        assert_eq!(
            super::parse_codex_version(b"codex-cli 0.165.0-alpha.1.2\n".to_vec()),
            Some("0.165.0-alpha.1.2".into())
        );
        for bytes in [
            vec![],
            vec![255],
            b"version\nextra".to_vec(),
            vec![b'x'; 129],
        ] {
            assert!(super::parse_codex_version(bytes).is_none());
        }
    }

    #[test]
    #[ignore = "explicit host check; requires an installed official Codex runtime"]
    fn installed_runtime_version_probe() {
        let executable = super::locate_codex().expect("No installed Codex runtime found");
        let version = super::codex_version(&executable);
        assert_ne!(version, "Unknown", "Installed runtime version probe failed");
        #[cfg(windows)]
        assert!(super::supports_mxc_version(&version));
        println!("Installed Codex version confirmed: {version}");
    }

    impl TestRuntime {
        fn start() -> Self {
            Self::start_with_eof_behavior(false)
        }

        fn start_with_eof_behavior(ignore_eof: bool) -> Self {
            use std::{
                process::{Command, Stdio},
                sync::{
                    atomic::{AtomicBool, AtomicU64},
                    Arc, Mutex,
                },
            };
            let executable = std::env::current_exe().unwrap();
            let mut child = Command::new(&executable)
                .args([
                    "--exact",
                    "codex::tests::stdio_process_fixture",
                    "--ignored",
                    "--nocapture",
                ])
                .env("VOID_MIND_STDIO_FIXTURE", "1")
                .env("VOID_MIND_IGNORE_EOF", if ignore_eof { "1" } else { "0" })
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .spawn()
                .unwrap();
            let stdin = Arc::new(Mutex::new(child.stdin.take()));
            let stdout = child.stdout.take().unwrap();
            let pending = Arc::new(Mutex::new(Default::default()));
            let alive = Arc::new(AtomicBool::new(true));
            let hold_received = Arc::new(AtomicBool::new(false));
            let received = hold_received.clone();
            let reader = super::spawn_reader(
                stdout,
                stdin.clone(),
                pending.clone(),
                alive.clone(),
                move |event| {
                    if event["type"] == "accountUpdated" {
                        received.store(true, std::sync::atomic::Ordering::Release);
                    }
                },
            );
            let client = Arc::new(super::CodexClient {
                child: Mutex::new(child),
                stdin,
                pending,
                alive,
                next_id: AtomicU64::new(1),
                executable_path: executable,
                version: "test fixture".into(),
                neutral_cwd: std::env::temp_dir(),
            });
            Self {
                client,
                reader: Some(reader),
                hold_received,
            }
        }
    }

    impl Drop for TestRuntime {
        fn drop(&mut self) {
            self.client.shutdown();
            if let Some(reader) = self.reader.take() {
                reader.join().unwrap();
            }
        }
    }

    #[test]
    fn real_child_exit_fails_in_flight_requests_and_disables_new_requests() {
        use std::sync::atomic::Ordering;
        let runtime = TestRuntime::start();
        assert_eq!(
            runtime.client.request("initialize", None).unwrap(),
            json!({"ready": true})
        );
        assert_eq!(
            runtime.client.request("crash", None).unwrap_err(),
            "The Codex runtime exited before completing the request."
        );
        assert!(!runtime.client.alive.load(Ordering::Acquire));
        assert!(runtime.client.pending.lock().unwrap().is_empty());
        assert_eq!(
            runtime.client.request("initialize", None).unwrap_err(),
            "The Codex runtime is not running."
        );
        assert_eq!(
            runtime.client.child.lock().unwrap().wait().unwrap().code(),
            Some(7)
        );
    }

    #[test]
    fn shutdown_reaps_a_real_child_and_releases_an_unanswered_request() {
        use std::{
            sync::atomic::Ordering,
            thread,
            time::{Duration, Instant},
        };
        let runtime = TestRuntime::start();
        runtime.client.request("initialize", None).unwrap();
        let client = runtime.client.clone();
        let request = thread::spawn(move || client.request("hold", None));
        let deadline = Instant::now() + Duration::from_secs(2);
        while !runtime.hold_received.load(Ordering::Acquire) {
            assert!(
                Instant::now() < deadline,
                "Child did not receive the request"
            );
            thread::sleep(Duration::from_millis(5));
        }
        // Synchronize with the completed write before testing cooperative EOF.
        drop(runtime.client.stdin.lock().unwrap());
        runtime.client.shutdown();
        let error = request.join().unwrap().unwrap_err();
        assert!(
            error == "The Codex runtime stopped."
                || error == "The Codex runtime exited before completing the request."
                || error == "Could not write to the Codex runtime."
                || error == "The Codex runtime is not running."
        );
        assert!(!runtime.client.alive.load(Ordering::Acquire));
        assert!(runtime.client.pending.lock().unwrap().is_empty());
        assert!(
            runtime
                .client
                .child
                .lock()
                .unwrap()
                .try_wait()
                .unwrap()
                .unwrap()
                .success(),
            "Cooperative child should exit on EOF without being killed"
        );
        runtime.client.shutdown(); // Repeated app-exit cleanup remains safe.
    }

    #[test]
    fn shutdown_kills_and_reaps_a_child_that_ignores_eof() {
        let runtime = TestRuntime::start_with_eof_behavior(true);
        runtime.client.request("initialize", None).unwrap();
        let started = std::time::Instant::now();
        runtime.client.shutdown();
        assert!(started.elapsed() >= super::SHUTDOWN_GRACE);
        assert!(started.elapsed() < std::time::Duration::from_secs(5));
        assert!(!runtime
            .client
            .child
            .lock()
            .unwrap()
            .wait()
            .unwrap()
            .success());
        assert!(runtime.client.stdin.lock().unwrap().is_none());
    }

    #[test]
    fn shutdown_does_not_wait_for_an_owned_input_lock() {
        let runtime = TestRuntime::start();
        runtime.client.request("initialize", None).unwrap();
        let input = runtime.client.stdin.lock().unwrap();
        let started = std::time::Instant::now();
        runtime.client.shutdown();
        assert!(started.elapsed() < std::time::Duration::from_secs(5));
        assert!(!runtime
            .client
            .child
            .lock()
            .unwrap()
            .wait()
            .unwrap()
            .success());
        drop(input);
        runtime.client.shutdown();
        assert!(runtime.client.stdin.lock().unwrap().is_none());
    }

    #[test]
    fn manager_exit_takes_and_stops_its_owned_client() {
        let runtime = TestRuntime::start();
        runtime.client.request("initialize", None).unwrap();
        let manager = super::CodexRuntimeManager::default();
        manager.inner.lock().unwrap().client = Some(runtime.client.clone());
        manager.stop_for_shutdown();
        assert!(manager.inner.lock().unwrap().client.is_none());
        assert!(runtime
            .client
            .child
            .lock()
            .unwrap()
            .wait()
            .unwrap()
            .success());
        manager.stop_for_shutdown();
    }

    #[test]
    fn correlates_out_of_order_responses_without_consuming_other_requests() {
        use super::{dispatch_response, PendingMap};
        use std::sync::{mpsc, Arc, Mutex};
        let pending: PendingMap = Arc::new(Mutex::new(Default::default()));
        let (first, first_result) = mpsc::sync_channel(1);
        let (second, second_result) = mpsc::sync_channel(1);
        pending.lock().unwrap().insert(1, first);
        pending.lock().unwrap().insert(2, second);
        assert!(!dispatch_response(
            &pending,
            &json!({"method":"account/updated", "id":1})
        ));
        assert!(dispatch_response(
            &pending,
            &json!({"id":99,"result":"stale"})
        ));
        assert!(dispatch_response(
            &pending,
            &json!({"id":2,"result":"second"})
        ));
        assert_eq!(second_result.recv().unwrap().unwrap(), json!("second"));
        assert!(first_result.try_recv().is_err());
        assert!(dispatch_response(
            &pending,
            &json!({"id":2,"result":"duplicate"})
        ));
        dispatch_response(
            &pending,
            &json!({"id":1,"error":{"message":"401 unauthorized secret-detail"}}),
        );
        assert_eq!(
            first_result.recv().unwrap().unwrap_err(),
            "Connect your ChatGPT account to continue."
        );
        assert!(pending.lock().unwrap().is_empty());
    }

    #[test]
    fn runtime_failure_releases_every_pending_request() {
        use super::{fail_pending, PendingMap};
        use std::sync::{mpsc, Arc, Mutex};
        let pending: PendingMap = Arc::new(Mutex::new(Default::default()));
        let mut receivers = Vec::new();
        for id in 1..=3 {
            let (sender, receiver) = mpsc::sync_channel(1);
            pending.lock().unwrap().insert(id, sender);
            receivers.push(receiver);
        }
        fail_pending(&pending, "The Codex runtime stopped.");
        for receiver in receivers {
            assert_eq!(
                receiver.try_recv().unwrap().unwrap_err(),
                "The Codex runtime stopped."
            );
        }
        assert!(pending.lock().unwrap().is_empty());
        fail_pending(&pending, "The Codex runtime stopped.");
    }

    #[test]
    fn accepts_only_codex_executable_names() {
        assert!(is_codex_name(Path::new("codex.exe")));
        assert!(is_codex_name(Path::new("codex")));
        assert!(!is_codex_name(Path::new("powershell.exe")));
    }

    #[test]
    fn discovery_skips_missing_files_directories_and_unrelated_names() {
        let root =
            std::env::temp_dir().join(format!("void-mind-discovery-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        assert!(resolve_codex_candidate(&root.join("codex.exe")).is_none());
        let directory = root.join("codex");
        std::fs::create_dir(&directory).unwrap();
        assert!(resolve_codex_candidate(&directory).is_none());
        let unrelated = root.join("unrelated.exe");
        std::fs::write(&unrelated, []).unwrap();
        assert!(resolve_codex_candidate(&unrelated).is_none());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn discovery_requires_execute_permission_on_unix() {
        use std::os::unix::fs::PermissionsExt;
        let root =
            std::env::temp_dir().join(format!("void-mind-permissions-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let binary = root.join("codex");
        std::fs::write(&binary, "#!/bin/sh\nexit 0\n").unwrap();
        std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o600)).unwrap();
        assert!(resolve_codex_candidate(&binary).is_none());
        std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o700)).unwrap();
        assert_eq!(resolve_codex_candidate(&binary), binary.canonicalize().ok());
        assert!(std::process::Command::new(&binary)
            .status()
            .unwrap()
            .success());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recognizes_runtime_versions_with_official_mxc_support() {
        assert!(!super::supports_mxc_version("0.153.4"));
        assert!(!super::supports_mxc_version("Unknown"));
        assert!(super::supports_mxc_version("0.162.0"));
        assert!(super::supports_mxc_version("0.165.0-alpha.1.2"));
    }

    #[cfg(windows)]
    #[test]
    fn resolves_the_native_binary_behind_an_official_npm_shim() {
        use std::{
            fs,
            time::{SystemTime, UNIX_EPOCH},
        };

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("void-mind-codex-shim-{nonce}"));
        let shim = root.join("codex.cmd");
        let (platform_package, target_triple) = match std::env::consts::ARCH {
            "x86_64" => ("codex-win32-x64", "x86_64-pc-windows-msvc"),
            "aarch64" => ("codex-win32-arm64", "aarch64-pc-windows-msvc"),
            _ => return,
        };
        let native = root
            .join("node_modules")
            .join("@openai")
            .join("codex")
            .join("node_modules")
            .join("@openai")
            .join(platform_package)
            .join("vendor")
            .join(target_triple)
            .join("bin")
            .join("codex.exe");
        fs::create_dir_all(native.parent().unwrap()).unwrap();
        fs::write(&shim, "@echo off").unwrap();
        fs::write(&native, []).unwrap();

        assert_eq!(resolve_codex_candidate(&shim), native.canonicalize().ok());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn normalizes_stream_and_login_notifications() {
        let delta = normalize_notification(&json!({
            "method": "item/agentMessage/delta",
            "params": {
                "threadId": "thread-1",
                "turnId": "turn-1",
                "itemId": "item-1",
                "delta": "Hello"
            }
        }))
        .expect("delta event");
        assert_eq!(delta["type"], "assistantDelta");
        assert_eq!(delta["delta"], "Hello");

        let login = normalize_notification(&json!({
            "method": "account/login/completed",
            "params": { "loginId": "login-1", "success": true, "error": null }
        }))
        .expect("login event");
        assert_eq!(login["type"], "loginCompleted");
        assert_eq!(login["success"], true);

        let failed_login = normalize_notification(&json!({
            "method": "account/login/completed",
            "params": {
                "loginId": "login-2",
                "success": false,
                "error": { "message": "401 unauthorized secret-detail" }
            }
        }))
        .expect("failed login event");
        assert_eq!(
            failed_login["error"],
            "Connect your ChatGPT account to continue."
        );
        assert!(!failed_login.to_string().contains("secret-detail"));
    }

    #[test]
    fn ignores_unrelated_events_and_handles_missing_completion_fields() {
        assert!(
            normalize_notification(&json!({ "method": "thread/started", "params": {} })).is_none()
        );
        let event = normalize_notification(&json!({
            "method": "turn/completed",
            "params": { "threadId": "thread-1", "turn": {} }
        }))
        .expect("completion event");
        assert_eq!(event["status"], "failed");
    }

    #[test]
    fn maps_errors_without_exposing_protocol_details() {
        assert_eq!(
            error_category("elevated Windows sandbox requires effective :root read access"),
            "sandboxUnavailable"
        );
        assert_eq!(error_category("401 unauthorized"), "authenticationRequired");
        assert_eq!(error_category("Codex is not installed"), "runtimeMissing");
        assert_eq!(error_category("rate limit reached"), "usageLimit");
        let account_error = user_error_message("401 unauthorized");
        assert_eq!(user_error_message(&account_error), account_error);
        assert_eq!(
            user_error_message("invalid json protocol"),
            "This Codex version returned an unsupported protocol response."
        );
    }

    #[test]
    fn isolates_general_conversations_to_minimal_runtime_and_neutral_workspace() {
        let neutral = PathBuf::from(r"C:\Users\person\AppData\Roaming\VOID Mind\codex-workspace");
        let config = isolated_conversation_config(&neutral);
        let filesystem = &config["permissions"]["void_mind"]["filesystem"];

        assert_eq!(config["default_permissions"], "void_mind");
        if cfg!(windows) {
            assert_eq!(config["windows"]["sandbox"], "mxc");
        }
        assert_eq!(filesystem[":minimal"], "read");
        assert_eq!(filesystem[neutral.to_string_lossy().as_ref()], "read");
        assert!(filesystem.get(":root").is_none());
        assert_eq!(
            config["permissions"]["void_mind"]["network"]["enabled"],
            false
        );
    }
}
