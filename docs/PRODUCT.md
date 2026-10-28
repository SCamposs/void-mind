# VOID Mind Product

## Register

product

## Users

VOID Mind is for people who want a focused desktop space for natural conversation, reasoning, brainstorming, writing, study, explanation, and personal knowledge work. The primary workflow is an uninterrupted conversation with an explicitly selected intelligence and visible context, with technical configuration kept outside the reading surface.

## Product Purpose

VOID Mind is a standalone, general-purpose intelligence environment. ChatGPT through the official Codex runtime is the primary experience; local llama.cpp remains a supported secondary provider. The product is not an IDE or agent dashboard.

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
| Intelligence | Implemented | ChatGPT account, live Codex catalog, adaptive reasoning/tier controls, and local runtime |
| Settings | Implemented | Profiles, advanced generation controls, retention, and intro preference |
| Workspaces | Implemented | CRUD, instructions, conversation grouping, and inherited provider preference |
| Knowledge | Implemented first layer | Explicit Markdown/text imports, managed copies, previews, and conversation selection |
| Memory | Future | Inspectable, editable, disableable, deletable, exportable user control |
| Additional remote providers | Future | Explicit provider-specific privacy and credential handling |
| Mind Mini | Future | Reduced subset of shared core inside VOID |
| Model Lab UI | Future | The Python lab remains canonical today |

## Product Boundaries

Knowledge is explicit material supplied by the user. Memory is information deliberately saved or learned from usage. They remain separate domains.

The Codex provider is intentionally conversation-only: read-only sandbox, approvals disabled, neutral workspace, no exposed tool workflow, and no autonomous commands. Knowledge is transmitted only when visibly selected for a conversation using a remote provider.

Orbit remains part of the broader VOID ecosystem and may become the presence of future Mind Mini. It is not the primary standalone interface.
