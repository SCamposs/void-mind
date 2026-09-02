# VOID Mind Product

## Register

product

## Users

VOID Mind is for people who want a focused desktop space for natural conversation, reasoning, brainstorming, writing, study, explanation, and personal knowledge work with local AI. The primary workflow is an uninterrupted conversation with an explicitly selected model, with technical configuration kept outside the reading surface.

## Product Purpose

VOID Mind is a standalone, general-purpose, local-first AI workspace. Success means it is useful as a conversation product today while its core, provider, persistence, and model-lab boundaries can support future Workspaces, Knowledge, Memory, and optional providers without turning the app into an IDE or agent dashboard.

## Brand Personality

Quiet, luminous, deliberate.

The product should feel capable and private. It should support concentration without looking sterile, theatrical, or technical for its own sake.

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
2. Local behavior is explicit. Provider location, privacy, and failure states are truthful and legible.
3. Complexity moves outward. Models and Settings own technical controls; chat remains quiet.
4. Foundations stay honest. Future surfaces explain their boundary without fabricated data.
5. Shared identity does not mean cloned appearance. VOID provides the exact symbol and proven runtime lessons; VOID Mind establishes its own thinking-space visual system.

## Accessibility & Inclusion

The implemented target is WCAG 2.2 AA for text contrast, keyboard access, semantic controls, visible focus, non-color-only status, and readable type. Major motion respects `prefers-reduced-motion`; reduced-motion users do not wait through the boot animation. The desktop layout remains usable in smaller windows without horizontal page scrolling.

## Surface Status

| Surface | Status | Scope |
| --- | --- | --- |
| Conversations | Implemented | Persisted conversation management and streamed local chat |
| Models | Implemented | Local endpoint discovery and managed-runtime configuration |
| Settings | Implemented | Profiles, advanced generation controls, retention, and intro preference |
| Workspaces | Foundation | Deliberate empty state and documented future boundary |
| Knowledge | Foundation | Deliberate empty state and documented future boundary |
| Memory | Future | Inspectable, editable, disableable, deletable, exportable user control |
| Remote providers | Future | Explicit provider-specific privacy and credential handling |
| Mind Mini | Future | Reduced subset of shared core inside VOID |
| Model Lab UI | Future | The Python lab remains canonical today |

## Product Boundaries

Knowledge is explicit material supplied by the user. Memory is information deliberately saved or learned from usage. They remain separate domains.

VOID Mind may gain optional tools later, but arbitrary shell execution, repository mutation, broad filesystem access, hidden telemetry, and autonomous commands are outside the product foundation.

Orbit remains part of the broader VOID ecosystem and may become the presence of future Mind Mini. It is not the primary standalone interface.
