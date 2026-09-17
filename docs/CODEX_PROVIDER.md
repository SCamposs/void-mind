# Codex Provider

VOID Mind uses the official Codex app-server as its primary intelligence provider. The desktop backend discovers only an executable named `codex` or `codex.exe` from `PATH` and supported user-scoped installation locations, then owns one supervised stdio child process.

## Protocol lifecycle

1. Spawn `codex app-server --stdio` with piped stdin/stdout and a drained stderr.
2. Send `initialize`, then the `initialized` notification.
3. Correlate request IDs centrally and normalize only product-relevant notifications.
4. On application exit, close stdin and kill/wait for the child if required.

Malformed lines, timeouts, exits, and unsupported server requests become bounded errors. Tokens, authorization URLs, raw protocol payloads, prompts, and assistant content are not logged.

## Account

`account/read`, browser login, device-code login, login cancellation, and logout are forwarded to app-server. The runtime owns credentials. VOID Mind holds only transient account presentation state and never persists a token.

## Conversation safety

Local conversations persist the returned Codex thread ID. Start and resume requests use a neutral app-data directory, `approvalPolicy: never`, `sandbox: read-only`, and general-purpose instructions. Turns repeat the no-approval/read-only policy and disable network access for sandboxed tools. The product exposes no tool or approval workflow and rejects server-initiated requests.

The active response profile is combined with the visible Workspace instructions and explicitly selected Knowledge sources before a thread starts or resumes. This keeps response controls consistent across Codex and llama.cpp without creating hidden context.

## Models and errors

The catalog comes from `model/list`; display names, defaults, input modalities, reasoning efforts, and service tiers are not hardcoded. Provider selection never silently falls back. Errors are sanitized into user-facing categories while details remain bounded.
