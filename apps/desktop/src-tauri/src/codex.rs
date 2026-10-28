use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    env, fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc::{self, SyncSender},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const GENERAL_INSTRUCTIONS: &str = "You are the intelligence provider inside VOID Mind, a general-purpose workspace for natural conversation, reasoning, writing, explanation, brainstorming, study, and everyday assistance. Respond as a calm general-purpose assistant. Do not use shell commands, edit files, inspect repositories, invoke tools, or request project access. Answer directly in natural language.";

type PendingResponse = Result<Value, String>;
type PendingMap = Arc<Mutex<HashMap<u64, SyncSender<PendingResponse>>>>;

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
    stdin: Arc<Mutex<ChildStdin>>,
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
        let mut stdin = self
            .stdin
            .lock()
            .map_err(|_| "Codex input is unavailable.".to_string())?;
        serde_json::to_writer(&mut *stdin, message)
            .map_err(|_| "Could not encode a Codex protocol request.".to_string())?;
        stdin
            .write_all(b"\n")
            .and_then(|_| stdin.flush())
            .map_err(|_| "Could not write to the Codex runtime.".to_string())
    }

    fn shutdown(&self) {
        self.alive.store(false, Ordering::Release);
        if let Ok(mut child) = self.child.lock() {
            if child.try_wait().ok().flatten().is_none() {
                let _ = child.kill();
            }
            let _ = child.wait();
        }
        fail_pending(&self.pending, "The Codex runtime stopped.");
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
        let stdin = Arc::new(Mutex::new(stdin));
        spawn_reader(
            stdout,
            Arc::clone(&stdin),
            Arc::clone(&pending),
            Arc::clone(&alive),
            app.clone(),
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

fn spawn_reader(
    stdout: ChildStdout,
    stdin: Arc<Mutex<ChildStdin>>,
    pending: PendingMap,
    alive: Arc<AtomicBool>,
    app: AppHandle,
) {
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else {
                break;
            };
            let message: Value = match serde_json::from_str(&line) {
                Ok(value) => value,
                Err(_) => {
                    let _ = app.emit(
                        "void-mind://codex-event",
                        json!({
                            "type": "protocolError",
                            "category": "protocolMismatch",
                            "message": "Codex returned a malformed protocol message."
                        }),
                    );
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
                let _ = app.emit("void-mind://codex-event", event);
            }
        }
        alive.store(false, Ordering::Release);
        fail_pending(
            &pending,
            "The Codex runtime exited before completing the request.",
        );
        let _ = app.emit(
            "void-mind://codex-event",
            json!({
                "type": "runtimeExited",
                "category": "runtimeExited",
                "message": "The Codex runtime exited."
            }),
        );
    });
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

fn reject_server_request(stdin: &Arc<Mutex<ChildStdin>>, request: &Value) {
    let response = json!({
        "id": request.get("id").cloned().unwrap_or(Value::Null),
        "error": {
            "code": -32601,
            "message": "VOID Mind does not expose tools or approval workflows."
        }
    });
    if let Ok(mut writer) = stdin.lock() {
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
    if !path.is_file() || !is_codex_name(path) {
        return None;
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
    candidates
        .into_iter()
        .find_map(|path| resolve_codex_candidate(&path))
}

fn codex_version(path: &Path) -> String {
    let mut command = Command::new(path);
    command.arg("--version").stdin(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|value| value.trim().trim_start_matches("codex-cli ").to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Unknown".into())
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

    json!({
        "default_permissions": "void_mind",
        "permissions": {
            "void_mind": {
                "description": "Isolated general-purpose conversation",
                "filesystem": filesystem,
                "network": { "enabled": false }
            }
        }
    })
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
        assert_eq!(filesystem[":minimal"], "read");
        assert_eq!(filesystem[neutral.to_string_lossy().as_ref()], "read");
        assert!(filesystem.get(":root").is_none());
        assert_eq!(
            config["permissions"]["void_mind"]["network"]["enabled"],
            false
        );
    }
}
