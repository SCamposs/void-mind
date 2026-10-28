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

Local conversations persist the returned Codex thread ID. Start and resume requests use a neutral app-data directory, `approvalPolicy: never`, and the named `void_mind` default-permissions profile. That profile grants read access only to the minimal runtime and neutral workspace, with network disabled. Turns preserve that profile instead of overriding it with the broader legacy read-only sandbox. The product exposes no tool or approval workflow and rejects server-initiated requests.

The local protocol probe accepted the profile shape, but an elevated Windows process rejected restricted filesystem access because its sandbox required effective root read access. Mind retains the restrictive policy and reports failure; it does not silently broaden access. End-to-end account inference and filesystem isolation still require validation in a normal, non-elevated desktop session.

Follow-up MXC probe: the PATH npm runtime is 0.153.4 and rejects `windows.sandbox = "mxc"`; the installed desktop runtime is 0.165.0-alpha.1.2 and accepted ephemeral thread creation with MXC and the same minimal-read/network-disabled profile. Windows discovery now prefers an installed runtime at least 0.162 (the documented MXC CLI baseline) and explicitly requests MXC per conversation. It does not silently fall back to legacy sandbox implementations or broaden filesystem permissions. Unsupported device/policy/runtime combinations fail closed. Full inference and filesystem-denial validation are still required.

An explicit no-inference reproduction is available as `node scripts/probe-codex.mjs <codex.exe> <neutral-workspace>`. It performs initialization, model discovery and ephemeral thread creation with the same minimal filesystem/network policy, without printing account data or submitting a turn. On this machine both installed runtimes initialized and returned a model catalog. The npm runtime failed thread creation while loading environment instructions with `CreateProcessWithLogonW failed: 267`; the desktop runtime failed because the elevated Windows sandbox required effective `:root` read access. The exact runtime/setup compatibility fix remains unresolved; broad root access is not an accepted workaround.

The active response profile is combined with the visible Workspace instructions and explicitly selected Knowledge sources before a thread starts or resumes. This keeps response controls consistent across Codex and llama.cpp without creating hidden context.

## Models and errors

The catalog comes from `model/list`; display names, defaults, input modalities, reasoning efforts, and service tiers are not hardcoded. Provider selection never silently falls back. Errors are sanitized into user-facing categories while details remain bounded.
