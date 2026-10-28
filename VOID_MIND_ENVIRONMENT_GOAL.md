# VOID Mind — Environment & ChatGPT Account Provider Goal

## Mission

Advance `./void-mind` from its newly established standalone foundation into the first genuinely useful **VOID Mind environment**.

The Python model laboratory now enters **standby**.

Do not expand training, datasets, evals, LoRA/QLoRA, manifests, model lineage, or local-model research during this goal unless a tiny compatibility fix is strictly required because of repository changes.

The current priority is the product itself:

> VOID Mind is a standalone, local-first-aware AI workspace whose primary immediate provider should be a supported ChatGPT/Codex account through official OpenAI Codex integration, while local llama.cpp remains a secondary provider.

The objective of this goal is not to build every future Mind feature. It is to turn the foundation into a coherent environment centered on:

- account-based AI access
- conversations
- workspaces
- provider/model selection
- explicit knowledge/context foundations
- clean onboarding
- strong navigation
- polished interaction
- the established VOID Mind visual identity
- future extensibility without exposing implementation complexity

Work only in:

```text
./void-mind
```

The sibling:

```text
./void
```

is READ-ONLY reference material.

It may be inspected for visual identity, reusable architecture ideas, packaging conventions, or the exact VOID logo, but it must remain untouched.

---

# 1. Product Definition

VOID Mind is not merely:

- a local model UI
- a Codex skin
- a coding tool
- an ML lab
- an API playground
- a settings dashboard

It is a **general-purpose intelligence workspace**.

The user should be able to open it to:

- talk
- think
- write
- explain
- brainstorm
- study
- organize conversations
- work within persistent contexts
- choose how intelligence is provided
- gradually build useful personal/work knowledge around projects

Programming is one capability among many.

The experience must remain useful even for someone who never asks a programming question.

---

# 2. Immediate Product Hierarchy

For this phase, prioritize:

```text
VOID Mind
├── Home
├── Conversations
├── Workspaces
├── Knowledge
├── Models / Providers
└── Settings
```

Current priority order:

1. ChatGPT/Codex account provider
2. Conversation experience
3. Workspaces
4. Provider/model UX
5. Knowledge foundation
6. overall product polish

Do not build Memory, MCP, agents, eval arena, voice, training UI, or Mind Mini yet.

---

# 3. Provider Priority

The provider order changes conceptually.

Primary:

```text
OpenAI Codex / ChatGPT account
```

Secondary:

```text
Local llama.cpp / GGUF
```

Future:

```text
OpenAI API
Anthropic
Gemini
other providers
```

The local provider must remain working and clean, but it should no longer dominate onboarding or product messaging.

Do not remove it.

Do not expand it significantly in this goal.

---

# 4. Official OpenAI Integration Only

Implement ChatGPT-account access using only **official OpenAI Codex mechanisms**.

Preferred integration:

```text
VOID Mind
→ managed Codex app-server process
→ official app-server protocol
→ ChatGPT account authentication
→ model discovery
→ threads / turns
→ streaming events
```

Do NOT:

- reverse engineer ChatGPT web endpoints
- copy OAuth tokens from browsers
- intercept session cookies
- ask users to paste access or refresh tokens
- implement unofficial OAuth
- imitate OpenCode authentication hacks
- persist OpenAI refresh tokens yourself
- scrape chatgpt.com
- use undocumented private endpoints when an official app-server path exists

Treat the installed/current Codex app-server protocol as the source of truth.

Where needed, inspect:

- current official Codex documentation
- current official OpenAI `openai/codex` protocol schemas
- the installed `codex` CLI/app-server capabilities
- generated protocol types

Do not hardcode assumptions from stale examples if the installed protocol differs.

---

# 5. Important Account Semantics

Do not implement the generic identity-only "Sign in with ChatGPT" partner login and assume it grants model usage.

The desired flow is specifically the **Codex account authentication flow exposed by the official Codex runtime/app-server**.

VOID Mind should delegate authentication to Codex.

Conceptually:

```text
user clicks Continue with ChatGPT
↓
VOID Mind asks app-server to begin ChatGPT login
↓
app-server returns official auth URL / login attempt
↓
VOID Mind opens system browser
↓
user authenticates with OpenAI
↓
app-server receives completion
↓
VOID Mind reads account state
↓
available Codex models are discovered
↓
user can start a conversation
```

Support the actual login variants exposed by the installed current protocol where practical, including browser OAuth and device-code flow if available.

Do not reimplement the token exchange.

Codex remains responsible for credential storage.

---

# 6. ChatGPT Plans

Do not hardcode VOID Mind as "paid accounts only."

The UI should simply communicate:

```text
Continue with ChatGPT
```

and let official Codex authentication/account capabilities determine availability and limits.

If account metadata exposes plan type, it may be shown discreetly in the account/provider details.

Do not invent plan capabilities.

Do not promise unlimited usage.

Usage is governed by the user's OpenAI/Codex account and current plan.

---

# 7. Codex Runtime Manager

Create a robust Codex runtime manager.

Responsibilities:

- locate `codex` executable
- verify it is executable
- detect version where practical
- launch `codex app-server`
- communicate through its supported transport/protocol
- initialize correctly
- monitor process health
- restart only when appropriate
- shut down cleanly on application exit
- surface useful errors
- avoid orphaned processes
- avoid duplicate app-server instances owned by the same VOID Mind session
- never expose arbitrary process launching through frontend parameters

The frontend must not be able to spawn arbitrary commands.

Tauri/Rust commands must remain narrowly scoped.

---

# 8. Codex Discovery / Setup UX

If Codex is not installed:

do not crash.

Show a polished state such as:

```text
OpenAI Codex

Codex is required to connect a ChatGPT account.

[ Setup instructions ]
[ Check again ]
```

Do not silently download or install executables unless there is a later explicitly designed install flow.

For now, detection + guidance is enough.

If Codex is installed:

```text
OpenAI Codex

Ready to connect.

[ Continue with ChatGPT ]
```

If already authenticated through the local Codex installation, detect that state and offer immediate use rather than forcing login again.

---

# 9. Authentication UX

The authentication experience should feel native to VOID Mind.

Desired states:

```text
Not installed
Ready
Connecting
Waiting for browser
Connected
Expired / authentication required
Error
```

Use the established black/glacial-white design.

No giant OAuth diagnostics screen.

The primary action should be simple.

Example:

```text
OPENAI

Use your ChatGPT account with Codex.

[ Continue with ChatGPT ]
```

After connection:

```text
OPENAI

● Connected

ChatGPT account
Plan: Plus        // only if actual account metadata provides it

[ Manage ]
```

Account email may be shown in detailed provider settings if returned by official account state, but avoid displaying personal information unnecessarily throughout the UI.

---

# 10. Authentication Security

Do not expose raw auth tokens to React.

Do not log:

- access tokens
- refresh tokens
- cookies
- authorization codes
- secrets

Do not put them in:

- localStorage
- Zustand persistence
- exported settings
- logs
- crash reports
- frontend state

Let Codex own its authentication storage.

VOID Mind should store only safe metadata/preferences required by its UX.

---

# 11. App-Server Protocol Layer

Build a dedicated protocol/client layer.

Do not scatter raw JSON-RPC method strings throughout React components.

Conceptually:

```text
CodexProcess
      ↓
CodexRpcClient
      ↓
CodexProvider
      ↓
mind-core provider contract
      ↓
UI
```

Responsibilities should be clearly separated.

Handle:

- request IDs
- responses
- notifications
- errors
- cancellation
- malformed messages
- process termination
- protocol initialization
- protocol-version differences where practical

Prefer official generated schema/types if they can be incorporated maintainably.

Do not manually approximate a huge protocol if generated official types are available.

---

# 12. Account Operations

Implement the official equivalents of:

- get current account
- begin ChatGPT login
- receive login completion
- cancel login if supported
- logout
- refresh/re-read account state

Account state should drive the UI.

Do not fake "connected" merely because the process is running.

---

# 13. Model Discovery

After authentication, query the app-server model catalog.

Use actual model metadata.

Where available, normalize:

- id
- display name
- description
- default status
- supported reasoning efforts
- default reasoning effort
- supported input modalities
- personality support
- service/speed tiers
- availability information

The UI should not hardcode specific current OpenAI model names.

Model offerings change.

The provider must render what the installed/current Codex runtime reports.

---

# 14. Model Picker

The normal chat model picker should be simple.

Example:

```text
GPT-5.x Codex ▾
```

or whatever actual display name the provider reports.

Detailed picker may show:

```text
Model
Reasoning
Service tier
```

only when supported.

Do not expose every protocol field by default.

Keep detailed controls under a secondary panel.

---

# 15. Reasoning Control

If the selected model reports multiple supported reasoning efforts, expose a clean human-facing selector.

Do not invent unsupported options.

Possible presentation:

```text
Reasoning
Auto
Low
Medium
High
```

but only use labels/options actually reported by the provider, mapped cleanly.

If only one effort exists, do not show unnecessary controls.

---

# 16. Provider Capabilities

Extend the provider capability system so the UI adapts instead of assuming every provider behaves identically.

Possible capabilities:

```text
streaming
cancellation
reasoning
images
audio
files
tools
accountAuth
local
remote
threadPersistence
```

Do not expose unsupported actions.

If Codex reports image input support:

prepare the architecture for it.

Actual attachment UX may remain limited if not reliable within this goal.

---

# 17. Codex as a General-Purpose Provider

Important product constraint:

Codex is being integrated as a provider inside a general-purpose AI environment.

Do not redesign VOID Mind into a coding agent merely because Codex itself is agent-oriented.

The default conversation experience should NOT expose:

- terminal
- shell commands
- repository mutations
- patch diffs
- git tools
- coding task dashboards
- autonomous agents
- file editing

unless a future feature explicitly enables them.

---

# 18. Restricted Codex Thread Environment

When starting Codex threads for normal VOID Mind conversation, use the least-privileged configuration available.

Do not point it at the user's project directories by default.

Do not give it the `./void-mind` repository as working context for ordinary user chats.

If a current working directory is required, use an isolated app-managed neutral directory such as:

```text
<app-data>/codex-workspace/
```

The directory should contain no user files unless the user explicitly attaches/imports them through a future supported workflow.

Prefer:

- no workspace tool access if protocol allows
- otherwise safest available sandbox/read-only behavior
- no arbitrary command execution surfaced by VOID Mind
- no automatic approvals

If the current Codex protocol makes fully tool-free conversational use impossible, implement the safest practical configuration and clearly document the limitation.

Do not weaken security merely to hide an approval prompt.

---

# 19. Conversation Instructions

When using the Codex provider, configure the thread so it behaves as closely as practical to VOID Mind's intended general-purpose assistant role.

The product identity should prioritize:

- natural conversation
- reasoning
- writing
- explanation
- brainstorming
- study
- general assistance

Do not inject repository-specific coding context.

Do not claim that the Codex runtime is identical to consumer ChatGPT.

Document provider-specific behavior honestly.

---

# 20. Thread Mapping

Map VOID Mind conversations cleanly to Codex threads.

Store provider-specific thread identifiers as provider metadata, not as the core conversation identity.

Conceptually:

```text
VoidConversation
  id
  title
  messages
  providerBinding {
    providerId: "openai-codex"
    remoteThreadId: "..."
  }
```

This allows:

- switching providers later
- exporting conversations without leaking protocol internals
- preserving product-owned conversation identity

Be careful when switching provider mid-conversation.

Do not silently assume a local llama conversation can be resumed as the same Codex thread.

---

# 21. Thread Lifecycle

Use official thread operations where appropriate.

Support a reliable subset:

- create/start
- resume
- list/restore where useful
- archive if necessary internally
- continue turns
- cancellation

Do not build every app-server feature.

Forking/branching may be architecturally prepared but is not required unless it naturally fits.

---

# 22. Streaming

Streaming must feel excellent.

Map app-server notifications/events into normalized VOID Mind stream events.

UI behavior:

- first token/activity appears quickly
- smooth incremental text
- no duplicate chunks
- no flickering whole-message replacement
- stop works
- partial message is preserved sensibly
- final message persists
- error state remains understandable

Do not dump raw protocol event JSON into the chat.

---

# 23. Cancellation

Stop must cancel the active provider turn, not merely stop rendering.

Expected:

```text
Generate
→ streaming
→ Stop
→ app-server cancellation
→ UI settles
→ partial assistant content remains or is intentionally marked
```

No zombie generation continuing invisibly.

---

# 24. Errors

Create user-understandable error categories.

Examples:

```text
Codex not installed
Authentication required
Login cancelled
Network unavailable
Usage limit reached
Model unavailable
Runtime exited
Protocol mismatch
Generation failed
```

Technical details may be accessible through:

```text
Details
```

Do not show Rust/JSON-RPC internals as primary UX.

---

# 25. Usage / Rate Limit State

If the current official protocol exposes account rate-limit or usage-state notifications, support them in the provider layer.

Use them carefully.

Do not build a giant telemetry dashboard.

Possible small provider detail:

```text
Usage
Available
```

or a concise warning when the runtime reports a limit.

Never infer billing information that the protocol does not provide.

---

# 26. Home

Add a real VOID Mind Home surface.

Home is not an analytics dashboard.

It should feel like entering the environment.

Purpose:

- start thinking quickly
- resume recent context
- enter a workspace
- see active intelligence provider

Possible composition:

```text
VOID MIND

What are you thinking about?

[ Ask anything... ]

Recent
- ...
- ...

Workspaces
- ...

Intelligence
OpenAI Codex · Connected
```

Keep it sparse.

Darkness should dominate.

No KPI cards.

No fake statistics.

No token charts.

No "productivity score."

---

# 27. Home Visual Center

The Home surface should make strong use of the established identity:

> Darkness is the environment. Light is the interface.

The main prompt/composer can become the primary luminous object.

Think:

```text
almost-total black
+
one glacial-white interactive focal region
+
subtle light spill
+
very restrained surrounding content
```

Do not turn Home into a standard dashboard grid.

---

# 28. Conversations Area

Keep the conversation-first foundation, but refine it as a real environment.

Required polish:

- recent grouping where useful
- pinned support if easy and clean
- rename
- delete with confirmation
- search
- keyboard creation shortcut
- correct empty states
- conversation title behavior
- model/provider indication
- smooth navigation between conversations
- preserved scroll state where reasonable
- comfortable long-form reading

Do not overload messages with metadata.

---

# 29. Workspaces — Make Them Real

Workspaces should move from placeholder to first functional version.

A Workspace is not a coding workspace.

It is a persistent intelligence context.

Examples conceptually:

```text
VOID
University
Writing
Personal Research
Travel
```

Do not ship fake example workspaces as user data.

A Workspace should support:

- id
- name
- optional description
- optional custom instructions
- preferred provider
- preferred model
- optional preferred reasoning level
- created/updated timestamps
- conversations belonging to that workspace
- future knowledge references
- future memory scope

---

# 30. Workspace UX

Implement:

- create workspace
- rename
- edit description
- delete with confirmation
- select
- list conversations inside
- start chat inside workspace
- workspace instructions
- preferred provider/model
- clean empty state

Workspace should feel lightweight.

Do not make users configure ten fields before starting.

Suggested creation:

```text
New Workspace

Name
[ VOID ]

[ Create ]
```

Everything else editable later.

---

# 31. Global vs Workspace Conversations

Support:

```text
Global conversations
Workspace conversations
```

A conversation may belong to zero or one workspace for now.

Do not implement complex multi-workspace sharing yet.

Moving a conversation between workspaces may be supported if simple and safe.

---

# 32. Workspace Instructions

Workspace instructions are explicit user-owned context.

They should be visible/editable.

Examples:

```text
Use terminology from this project.
Prefer concise technical explanations.
Answer in Portuguese unless asked otherwise.
```

Do not hide them as invisible permanent memory.

When using a provider, integrate them through the provider's supported instruction mechanism.

Avoid duplicating them into every visible message.

---

# 33. Knowledge — First Useful Foundation

Knowledge should evolve beyond a completely fake placeholder, but do not build a giant RAG stack yet.

Implement the first explicit content layer.

At minimum support a safe local catalog of user-added knowledge items.

Possible first supported types:

- `.md`
- `.txt`

Optional if robust:

- `.json`

PDF ingestion may remain deferred unless an existing safe extraction path is trivial.

Each item should track:

- id
- title
- source filename
- type
- workspace
- added date
- size
- local content/reference
- processing status

---

# 34. Knowledge Storage

Knowledge belongs inside app-managed storage.

Do not depend forever on arbitrary source file paths.

When importing a supported file:

- user explicitly selects it
- copy/import it into app-managed workspace storage or store its content safely
- preserve source metadata
- never scan directories automatically
- never index the whole computer

Deleting a knowledge item should delete its app-managed copy/content, not the user's original source file.

---

# 35. Knowledge Context — Conservative First Version

Do not prematurely add vector databases/embeddings if unnecessary.

For this phase, implement one of these honest approaches:

## Option A — explicit manual context
User chooses which workspace documents are included in a conversation.

or

## Option B — small-document deterministic context
For small Markdown/text collections, inject selected/relevant explicitly chosen content within safe context limits.

If robust retrieval requires a later dedicated goal, stop there.

Do not call simple text concatenation "RAG."

Do not build a fake semantic-search UI.

Document the current behavior accurately.

---

# 36. Future Retrieval Boundary

Design Knowledge so a later retrieval system can add:

```text
chunking
embeddings
hybrid search
reranking
source citations
context budgets
```

without rewriting Workspace and Knowledge domain models.

But do not implement them merely to satisfy architecture diagrams.

---

# 37. Source Visibility

Whenever knowledge is actually used in provider context, make it visible to the user.

Example:

```text
Context
2 workspace sources
```

Clicking should reveal which items were included.

The user should not have to guess what VOID Mind sent.

This principle will matter later for memory/tools too.

---

# 38. Context Inspector Foundation

Create a restrained "Context" inspector or popover for a conversation.

It may show:

- active workspace
- workspace instructions
- explicitly included knowledge
- provider
- model

Do NOT show:

- token telemetry by default
- giant prompt dumps
- raw system messages
- protocol JSON

Advanced diagnostics may exist later.

---

# 39. Models / Providers Area

Turn Models into a more coherent "Intelligence" or provider-management surface if that improves UX.

It should communicate:

```text
OPENAI
Codex / ChatGPT account
Connected

LOCAL
llama.cpp
Available / not configured
```

Future providers may appear as "Coming later" only if that does not become fake UI.

Prefer not to list unsupported brands just for decoration.

---

# 40. Provider Selection

Allow:

- global default provider/model
- workspace preferred provider/model
- conversation-level override

Resolution order:

```text
conversation override
→ workspace preference
→ global default
```

Make this logic explicit and tested.

If a provider becomes unavailable, fall back only with user visibility.

Do not silently send a conversation to another remote provider.

---

# 41. Onboarding

Redesign onboarding around the new provider priority.

Suggested first-run flow:

```text
VOID MIND
Your intelligence workspace.

[ Continue ]
```

Then:

```text
Choose how to begin

[ Continue with ChatGPT ]
Recommended

[ Use a local model ]

[ Explore first ]
```

Do not claim every ChatGPT account is guaranteed access.

Use language such as:

```text
Connect through the official Codex runtime.
Availability and usage depend on your OpenAI account.
```

---

# 42. Onboarding — Local Option

The local option remains.

It may offer:

```text
Use llama.cpp
```

but should no longer make first-run setup look like a GGUF configuration utility.

If the user chooses local:

guide them to the existing local provider setup.

Do not expand local model downloading in this goal.

---

# 43. Explore Without Provider

Allow the app to open without any provider.

Home, Workspaces, settings, and knowledge organization may still be explored.

Chat composer should explain that an intelligence provider must be selected before generation.

No dead-end onboarding lock.

---

# 44. Settings

Organize Settings around human concepts.

Suggested categories:

```text
General
Appearance
Intelligence
Privacy
Advanced
```

Avoid a single giant technical settings page.

---

# 45. General Settings

Possible:

- launch behavior
- default home destination
- confirmation behavior
- language preference if already supported
- conversation retention

Do not invent lots of settings just because a Settings page exists.

---

# 46. Intelligence Settings

Contain:

- default provider
- default model
- reasoning setting when supported
- profiles
- local-provider technical config
- Codex runtime status

Deep runtime details belong under Advanced.

---

# 47. Privacy

Clearly explain per provider.

Example:

```text
OpenAI Codex
Messages are processed by OpenAI according to your connected account and applicable terms.

Local llama.cpp
Inference stays on this device.
```

Do not market the entire app as "100% private" when a remote provider is selected.

Local-first-aware is not the same thing as local-only.

---

# 48. Profiles

Keep Profiles useful, but do not let them compete with Workspaces.

Difference:

```text
Workspace
= persistent context/project boundary

Profile
= behavior/style configuration
```

Profiles may include:

- General
- Creative
- Analytical
- Concise
- Custom

A workspace may select a preferred profile later if useful.

Do not overbuild profile automation.

---

# 49. Visual Identity — Preserve Direction

Keep the visual direction established in the previous goal.

Core rule:

> Darkness is the environment. Light is the interface.

Do not regress to:

- gray SaaS dashboard
- border-everything UI
- terminal emulator
- CRT scanlines
- green
- cyan cyberpunk
- excessive card grids
- dense telemetry

---

# 50. Home Lighting Language

Home should be the strongest demonstration of the identity.

Use:

- almost absolute black
- large negative space
- one or two luminous focus points
- cold white bloom
- subtle haze
- restrained reflections
- gentle luminance gradients

The screen should feel spatial.

Do not fake 3D if it harms usability.

---

# 51. Chromatic Glitch

Continue restrained chromatic displacement only as a rare accent.

Possible triggers:

- login completion
- provider switch
- model switch
- focus transition
- boot
- meaningful error recovery

Never use it as constant text decoration.

---

# 52. Boot

Keep:

```text
VOID symbol
trace
fill
MIND reveal
```

Do not alter the logo geometry.

Do not turn the intro into a long loading screen.

If app initialization takes longer than the intro:

transition to a clean loading state rather than artificially looping the logo.

---

# 53. Connection Animation

A successful ChatGPT account connection is a good place for one of the rare identity moments.

Example:

```text
Connecting...
↓
brief white bloom
↓
tiny chromatic separation
↓
Connected
```

Keep it subtle and fast.

---

# 54. Typography

Continue moving away from forcing every conversation into a terminal-like mono font.

Use readable body typography for long-form assistant content.

Monospace remains appropriate for:

- code
- small technical labels
- identifiers
- advanced diagnostics

Visual identity should come from composition/light, not merely from monospaced text.

---

# 55. Keyboard UX

Support useful desktop shortcuts.

At minimum, consider:

```text
Ctrl/Cmd + N
new chat

Ctrl/Cmd + K
quick switcher/search

Ctrl/Cmd + ,
settings

Esc
close modal/drawer
```

Use platform-appropriate labels.

Do not hijack common text-editing shortcuts.

---

# 56. Quick Switcher

Implement a simple command/quick switcher if it fits cleanly.

It should search/navigate:

- conversations
- workspaces
- main destinations

Do not turn it into an agent command system.

This is navigation, not a shell.

---

# 57. Search

Conversation search should remain fast.

Workspace search/navigation may reuse the same infrastructure.

Knowledge item search may be simple metadata/text title search for now.

Do not imply semantic search unless implemented.

---

# 58. Persistence

Extend current versioned persistence for:

- account/provider safe metadata
- global default provider/model
- workspaces
- workspace instructions
- workspace conversations
- workspace provider/model preference
- knowledge metadata
- selected context
- UI navigation state where sensible

Never persist Codex auth secrets yourself.

---

# 59. Export / Import Boundary

Do not build a huge backup system now unless existing persistence already supports it.

But ensure future export can separate:

```text
safe product data
from
provider secrets
```

Codex authentication must never be exported.

---

# 60. Lab Standby

The `lab/` subtree is now frozen for product purposes.

Rules:

- keep it intact
- keep tests passing if touched indirectly
- do not add new training commands
- do not add datasets
- do not run expensive training
- do not add model downloads
- do not redesign model lineage
- do not integrate lab UI
- do not expose lab navigation in the desktop app

The lab remains part of the repository for the future.

This goal is about VOID Mind the product.

---

# 61. llama.cpp Standby

The llama.cpp provider remains supported but secondary.

Rules:

- keep existing provider working
- preserve its tests
- preserve managed/external runtime if already present
- fix regressions
- do not spend major goal time improving quantization/model management
- do not add model download catalogs
- do not make local setup the default onboarding path

---

# 62. Security Boundaries

Maintain strict boundaries.

No arbitrary shell.

No arbitrary process command from frontend.

No default project filesystem access through Codex.

No automatic directory scanning.

No silent file ingestion.

No remote listener.

No raw token persistence.

No hidden telemetry.

No provider fallback without visibility.

---

# 63. Tauri Scope

Tauri commands should be narrowly scoped around:

- Codex executable detection
- Codex app-server lifecycle
- safe browser opening if needed
- safe app-data paths
- existing llama runtime
- explicit file-selection/import for Knowledge
- app lifecycle cleanup

Do not create a generic `run_command(command: string)` API.

---

# 64. Testing — Codex Runtime

Add meaningful tests for:

- executable not found
- process launch
- initialization
- clean shutdown
- child crash
- malformed JSON-RPC
- request correlation
- login-state transition
- login cancellation
- model-list normalization
- unsupported capability
- stream event normalization
- cancellation
- error mapping

Use mocks/fixtures where real OpenAI authentication cannot run in CI.

---

# 65. Testing — Provider Resolution

Test:

```text
global provider
workspace preference
conversation override
provider unavailable
model missing
```

No silent incorrect fallback.

---

# 66. Testing — Workspaces

Test:

- create
- rename
- delete
- persistence
- conversation ownership
- instructions
- preferred provider/model
- migration from old persistence without workspaces

---

# 67. Testing — Knowledge

Test:

- import supported text file
- metadata
- workspace association
- deletion does not delete original source
- app-managed copy/content cleanup
- unsupported type
- size limits
- malformed text where relevant
- context inclusion behavior

---

# 68. Real Account Manual QA

If the environment permits interactive browser authentication, perform a genuine end-to-end test.

Test:

```text
Launch VOID Mind
→ Codex detected
→ Continue with ChatGPT
→ browser opens
→ authenticate
→ app reflects connected account
→ model list loads
→ start chat
→ send general non-coding prompt
→ stream response
→ stop
→ continue
→ restart app
→ account remains usable via Codex-managed credentials
```

Do not expose or print credentials while testing.

If interactive authentication cannot be completed because of sandbox limitations, do not fake success.

Report exact blocker.

---

# 69. General-Purpose QA Prompts

If a real account can be used, test non-coding prompts intentionally.

Examples:

```text
"Explain why the sky looks blue in simple terms."

"Rewrite this paragraph to sound clearer."

"Help me brainstorm names for a science-fiction city."

"Compare two study strategies."

"Explain opportunity cost with an everyday example."
```

The point is to verify that VOID Mind feels like a general intelligence workspace, not a repository assistant.

Do not benchmark quality extensively in this goal.

---

# 70. Visual QA

Manually inspect:

- boot
- Home
- provider setup
- ChatGPT login state
- connected state
- model picker
- conversation
- workspace list
- workspace detail
- Knowledge empty state
- Knowledge item list
- Settings
- small desktop window

Look specifically for:

- too much gray
- too many borders
- too many cards
- weak black/white contrast
- generic SaaS appearance
- overused glitch
- cramped reading
- excessive technical text

Fix obvious visual regressions before declaring completion.

---

# 71. Documentation

Update/create docs to reflect this phase.

At least update:

```text
docs/PRODUCT.md
docs/ARCHITECTURE.md
docs/PROVIDERS.md
docs/DESIGN.md
README.md
```

Add if useful:

```text
docs/CODEX_PROVIDER.md
docs/WORKSPACES.md
docs/KNOWLEDGE.md
```

---

# 72. CODEX_PROVIDER Documentation

Document:

- why official Codex app-server was chosen
- runtime architecture
- authentication ownership
- account states
- model discovery
- thread mapping
- security/sandbox choices
- limitations
- protocol compatibility strategy
- troubleshooting

Do not document secret/token locations.

---

# 73. Product Documentation Honesty

Clearly label:

```text
Implemented
Foundation
Deferred
Experimental
```

Do not claim:

- generic ChatGPT API access
- full ChatGPT product feature parity
- unlimited account usage
- full RAG
- autonomous agents
- model training inside the app

unless actually true.

---

# 74. Repository Hygiene

Do not touch:

```text
./void
```

Do not expand:

```text
lab/
```

except compatibility fixes.

Keep:

- generated artifacts ignored
- binaries ignored
- credentials ignored
- logs free of secrets
- repo clean after commits

---

# 75. Suggested Implementation Checkpoints

Use checkpoints approximately like:

## Checkpoint A
Inspect current repo + official Codex runtime/protocol.

## Checkpoint B
Codex process + JSON-RPC client.

## Checkpoint C
Account/login/model discovery.

## Checkpoint D
Codex provider conversation streaming.

## Checkpoint E
Home + onboarding + provider UX.

## Checkpoint F
Functional Workspaces.

## Checkpoint G
Knowledge first useful foundation.

## Checkpoint H
visual/accessibility polish.

## Checkpoint I
tests/docs/build/manual QA.

Do not create commits merely to match these names if a cleaner commit plan exists.

---

# 76. Build / Validation

Run the repository's actual commands.

Expected categories:

```text
lint
typecheck
frontend tests
provider tests
persistence tests
Rust tests
production build
Tauri build
lab regression tests
git diff --check
```

The lab should still pass its existing tests, but do not expand lab coverage for unrelated future work.

---

# 77. Definition of Done

The goal is complete only when the relevant points below are true:

1. VOID Mind prioritizes ChatGPT/Codex account access over llama.cpp in its product UX.
2. Official Codex app-server integration exists.
3. No unofficial ChatGPT OAuth/token scraping exists.
4. Codex executable detection is robust.
5. Codex app-server lifecycle is managed safely.
6. JSON-RPC/protocol handling is centralized.
7. Current account state can be read.
8. ChatGPT login can be initiated through official Codex flow.
9. System browser/device flow is handled as supported.
10. Logout works through official runtime.
11. No auth secrets enter frontend persistence.
12. Model discovery uses actual app-server data.
13. Model names are not hardcoded.
14. Reasoning controls adapt to actual model capabilities.
15. A Codex-backed VOID Mind conversation can stream.
16. Stop cancels the actual provider turn.
17. Provider/thread IDs are cleanly separated from VOID Mind conversation IDs.
18. Normal chats do not receive project-directory access by default.
19. Codex is presented as a provider, not as the identity of the whole product.
20. llama.cpp still works as secondary provider.
21. lab remains preserved and in standby.
22. Home is a real polished product surface.
23. onboarding prioritizes Continue with ChatGPT.
24. app can still be explored without a configured provider.
25. Workspaces are functional.
26. workspace-specific chats work.
27. workspace instructions work.
28. workspace provider/model preferences work.
29. Knowledge supports at least a safe honest first version for explicit text/Markdown imports.
30. no directory is scanned automatically.
31. Knowledge use is visible in conversation context.
32. Context inspector/foundation exists.
33. provider selection resolution is deterministic and tested.
34. current black/glacial-white identity is preserved/improved.
35. UI does not regress into gray dashboard styling.
36. glitch remains restrained.
37. long-form conversation reading is comfortable.
38. keyboard navigation works.
39. security boundaries remain narrow.
40. docs accurately reflect implementation.
41. relevant TypeScript/Rust tests pass.
42. production/Tauri build passes.
43. existing Python lab tests still pass.
44. `git diff --check` passes.
45. `./void` remains untouched.
46. interactive account/inference QA is reported honestly as passed or blocked.
47. known protocol/runtime limitations are documented.

---

# 78. Explicitly Deferred

Do NOT expand scope into:

- new model training
- datasets
- LoRA/QLoRA
- local A1/A2 work
- GGUF catalog/download system
- vector database unless absolutely necessary for a minimal knowledge slice
- advanced RAG
- automatic memory
- MCP
- autonomous agents
- generic shell
- repository editing
- Codex coding workspace
- multi-agent orchestration
- API-key providers
- Anthropic
- Gemini
- OpenAI API provider
- voice
- image generation
- Eval Arena
- observability dashboards
- Mind Mini
- VOID Home
- Orbit integration

Those remain later phases.

---

# 79. Final Product Test

The most important test is conceptual.

At the end, a new user should be able to:

```text
Install/open VOID Mind
↓
see a distinctive quiet black/glacial-white environment
↓
choose Continue with ChatGPT
↓
authenticate through official Codex
↓
select an available model
↓
have a normal general-purpose conversation
↓
create a Workspace
↓
start a conversation within it
↓
add explicit Markdown/text knowledge
↓
understand what context is active
↓
return later and continue
```

without:

- API keys
- a GGUF
- seeing a terminal
- understanding llama.cpp
- understanding JSON-RPC
- configuring ports
- seeing token telemetry
- being asked for repository access

That is the product experience this phase should establish.

---

# 80. Final Report

When finished, report:

- commits created
- architecture changes
- Codex runtime implementation
- official protocol/version used
- account login flow implemented
- account metadata available
- models discovered
- reasoning/model controls
- conversation/thread mapping
- security model
- Home implementation
- onboarding implementation
- Workspaces implementation
- Knowledge implementation
- llama.cpp regression status
- lab regression status
- visual changes
- automated tests
- Tauri build results
- manual QA
- whether a real ChatGPT account login was completed
- whether a real streamed Codex response was completed
- any environment blocker
- intentionally deferred features
- git status
- confirmation that `./void` remained unchanged

Do not claim completion of capabilities that could not be exercised.

The success criterion is not feature count.

The success criterion is that VOID Mind now feels like the beginning of a coherent standalone intelligence environment rather than a local-model prototype.
