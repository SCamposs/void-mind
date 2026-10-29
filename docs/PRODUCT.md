# VOID Mind Product

## Register

product

## Users

VOID Mind is for people who want a focused desktop space for natural conversation, reasoning, brainstorming, writing, study, explanation, and personal knowledge work. The primary workflow is an uninterrupted conversation with an explicitly selected intelligence and visible context, with technical configuration kept outside the reading surface.

## Product Purpose

VOID Mind is a standalone, general-purpose intelligence environment. ChatGPT through official Sign in with ChatGPT plan authorization is the primary connection; an OpenAI API key is a discreet alternative. The Codex runtime remains available for existing conversations; local llama.cpp remains a supported secondary provider. The product is not an IDE or agent dashboard.

## Brand Personality

Quiet, luminous, deliberate.

The product should feel capable and private. It should support concentration without looking sterile, theatrical, or technical for its own sake.

The product boundary includes desktop chrome and distribution. The app uses an integrated VOID titlebar. For distribution, the approved direction is a native Windows installer with VOID header/sidebar artwork and icons; a full NSIS dark skin is intentionally excluded after visual inspection.

## Anti-references

VOID Mind must not resemble:

- a coding agent or repository editor
- a generic SaaS chatbot clone
- a GGUF dashboard with a chat window
- a gray-card dashboard
- a cyberpunk, hacker, CRT, or green-terminal interface
- a dense three-column inspector
- an agent telemetry console
- generic AI sparkle/star branding
- a giant-orb product centered on Orbit

## Design Principles

1. Conversation comes first. Content, reading, and a calm composer dominate the primary surface.
2. Provider behavior is explicit. Location, selected context, privacy, inheritance, and failure states are truthful and legible.
3. Complexity moves outward. Models and Settings own technical controls; chat remains quiet.
4. Foundations stay honest. Future surfaces explain their boundary without fabricated data.
5. Shared identity does not mean cloned appearance. VOID provides the exact symbol and proven runtime lessons; VOID Mind establishes its own thinking-space visual system.

## Accessibility & Inclusion

The implemented target is WCAG 2.2 AA for text contrast, keyboard access, semantic controls, visible focus, non-color-only status, and readable type. Major motion respects `prefers-reduced-motion`; reduced-motion users do not wait through the boot animation. The desktop layout remains usable in smaller windows without horizontal page scrolling.

## Surface Status

| Surface | Status | Scope |
| --- | --- | --- |
| Home | Implemented | Luminous entry composer, recent conversations, workspaces, and provider state |
| Conversations | Implemented | Persisted management, Codex thread binding, streaming, interruption, and context inspection |
| Intelligence | Implemented; direct login/inference/Stop observed | Primary ChatGPT sign-in, discreet OpenAI API key, separate account/catalog handling, legacy Codex and local runtime. Real API-key QA deferred by the user to issue #2; credential refresh/revocation QA remains open |
| Settings | Implemented | Profiles, advanced generation controls, retention, intro preference, and automatic/manual update checks |
| Workspaces | Implemented | CRUD, instructions, conversation grouping, and inherited provider preference |
| Knowledge | Implemented first layer | Explicit Markdown/text imports, managed copies, previews, and conversation selection |
| Memory | Future | Inspectable, editable, disableable, deletable, exportable user control |
| Additional remote providers | Future | Explicit provider-specific privacy and credential handling |
| Mind Mini | Future | Reduced subset of shared core inside VOID |
| Model Lab UI | Future | The Python lab remains canonical today |

## Product Boundaries

Titles use deterministic extraction without an additional inference request. The isolated Qwen3-0.6B experiment is closed with a NO-GO for the evaluated configurations; no training, new benchmark or title integration belongs in this goal. A future optional connected-provider title request would require opt-in, clear quota/cost disclosure, minimal context, background execution, manual-rename protection and deterministic fallback. See [LOCAL_TITLE_EVALUATION.md](LOCAL_TITLE_EVALUATION.md).

Knowledge is explicit material supplied by the user. Memory is information deliberately saved or learned from usage. They remain separate domains.

The Codex provider is intentionally conversation-only: read-only sandbox, approvals disabled, neutral workspace, no exposed tool workflow, and no autonomous commands. Knowledge is transmitted only when visibly selected for a conversation using a remote provider.

Orbit remains part of the broader VOID ecosystem and may become the presence of future Mind Mini. It is not the primary standalone interface.

## Shared controls

All app-authored buttons, text fields, multiline fields, numbers, checkboxes, switches, selectors, segmented choices and disclosures are composed from source-owned wrappers around Base UI. Scroll Area owns primary page/conversation scrolling; text editors, code blocks and popup lists use the same restrained native scrollbar fallback. Quick switcher and the first ChatGPT-plan confirmation use Base UI Dialog for focus containment and dismissal. Typography and colors remain the VOID tokens. Native Tauri file dialogs and installer controls remain platform-owned, as previously approved.

## Conversation creation and titles

New conversation opens a transient draft. It enters history, recents, workspace counts and persistence only when the first message is sent. There is at most one unsent draft, and historical empty placeholders are removed during migration without discarding archived content. Titles currently derive locally from the first user message; no separate model request is made for naming. The user can rename a saved conversation. Automatic model-generated naming is not implemented.

## Visual transfer to VOID

The established direction is stable enough to plan the subsequent visual refactor of VOID. Carry over the black/glacial-white tokens, Urbanist/Barlow hierarchy, shared Base UI wrappers, restrained focus/scrollbar states, integrated titlebar language and canonical mark. Adapt those foundations to VOID's existing surfaces; Mind's conversation/provider domain is not a template for VOID's product structure. Avoid scattering local control styles or coupling VOID to Mind state. [DESIGN.md](DESIGN.md) and the source controls/tokens remain the concrete references.

Implementation belongs after the alpha.1 completion gates in a separately scoped phase. The sibling VOID repository remains read-only throughout the current Mind goal. Technical checks and screenshots establish implementation evidence; they do not replace human visual acceptance.
