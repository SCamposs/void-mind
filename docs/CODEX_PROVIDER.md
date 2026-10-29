# Codex Provider

VOID Mind retains the official Codex app-server for legacy conversation bindings. The primary connection is now direct official Sign in with ChatGPT; it does not require Codex installation (see CONNECTIONS.md). For the legacy path, the desktop backend discovers a native `codex` or `codex.exe` from `PATH` and supported user-scoped installation locations, resolving supported Windows npm shims to the native executable, then owns one supervised stdio child process.

## Protocol lifecycle

1. Spawn `codex app-server --stdio` with piped stdin/stdout and a drained stderr.
2. Send `initialize`, then the `initialized` notification.
3. Correlate request IDs centrally and normalize only product-relevant notifications.
4. On application exit, close stdin and kill/wait for the child if required.

Malformed lines, timeouts, exits, and unsupported server requests become bounded errors. Tokens, authorization URLs, raw protocol payloads, prompts, and assistant content are not logged.

Version probes have a two-second deadline and monitor a 4 KiB output threshold. Output is captured in an OS-cleaned anonymous temporary file, avoiding a blocked output pipe or detached reader thread. Excess output, launch/I/O failure, nonzero exit, invalid UTF-8 and invalid version labels return `Unknown`; deadline/output failures terminate and reap the owned probe child. Windows MXC candidate selection shares a two-second probe budget and deduplicates canonical executable paths. These bounds apply to version probing, not all possible OS filesystem/process-creation delays or arbitrary descendant processes. Permission profiles are unchanged.

## Account

`account/read`, browser login, device-code login, login cancellation, and logout are forwarded to app-server. The runtime owns credentials. VOID Mind holds only transient account presentation state and never persists a token.

## Conversation safety

Local conversations persist the returned Codex thread ID. Start and resume requests use a neutral app-data directory, `approvalPolicy: never`, and the named `void_mind` default-permissions profile. That profile grants read access only to the minimal runtime and neutral workspace, with network disabled. Turns preserve that profile instead of overriding it with the broader legacy read-only sandbox. The product exposes no tool or approval workflow and rejects server-initiated requests.

The initial local protocol probe accepted the profile shape, but an elevated Windows process rejected restricted filesystem access because its sandbox required effective root read access. Mind retained the restrictive policy and reported failure; it did not silently broaden access. Subsequent MXC-backed native account inference, Stop and contextual continuation passed. Effective filesystem-denial validation remains open.

Follow-up MXC probe: the PATH npm runtime was 0.153.4 and rejected `windows.sandbox = "mxc"`; the installed desktop runtime was 0.165.0-alpha.1.2 and accepted ephemeral thread creation with MXC and the same minimal-read/network-disabled profile. Windows discovery now prefers an installed runtime at least 0.162 (the documented MXC CLI baseline) and explicitly requests MXC per conversation. It does not silently fall back to legacy sandbox implementations or broaden filesystem permissions. Unsupported device/policy/runtime combinations fail closed. Native legacy inference subsequently passed; filesystem-denial validation is still required.

An explicit no-inference reproduction is available as `node scripts/probe-codex.mjs <codex.exe> <neutral-workspace>`. It performs initialization, model discovery and ephemeral thread creation with the same minimal filesystem/network policy, without printing account data or submitting a turn. Historical probes on this machine initialized both installed runtimes and returned catalogs. Before the MXC change, the npm runtime failed thread creation while loading environment instructions with `CreateProcessWithLogonW failed: 267`; the desktop runtime failed because the elevated Windows sandbox required effective `:root` read access. The later MXC receipts in VALIDATION.md supersede the earlier inference blocker; broad root access remains an unacceptable workaround.

The active response profile is combined with the visible Workspace instructions and explicitly selected Knowledge sources before a thread starts or resumes. This keeps response controls consistent across Codex and llama.cpp without creating hidden context.

## Models and errors

The catalog comes from `model/list`; display names, defaults, input modalities, reasoning efforts, and service tiers are not hardcoded. Provider selection never silently falls back. Errors are sanitized into user-facing categories while details remain bounded.
