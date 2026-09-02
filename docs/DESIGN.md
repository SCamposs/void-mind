---
name: VOID Mind
description: A local-first AI workspace shaped by absolute darkness and isolated glacial light.
colors:
  environment: "oklch(0% 0 0)"
  environment-soft: "oklch(7% 0 0)"
  surface: "oklch(10.5% 0 0)"
  surface-raised: "oklch(14% 0 0)"
  interface-light: "oklch(97.5% 0.008 250)"
  text: "oklch(91% 0.008 250)"
  muted: "oklch(70% 0.008 250)"
  faint: "oklch(52% 0.006 250)"
  border: "oklch(28% 0.006 250)"
  disruption-red: "oklch(69% 0.17 356.8)"
  disruption-cyan: "oklch(78% 0.14 215)"
typography:
  title:
    fontFamily: "Segoe UI Variable, Segoe UI, Inter, system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 520
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Segoe UI Variable, Segoe UI, Inter, system-ui, sans-serif"
    fontSize: "0.94rem"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "normal"
  label:
    fontFamily: "Cascadia Code, SFMono-Regular, Consolas, monospace"
    fontSize: "0.68rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.interface-light}"
    textColor: "{colors.environment}"
    rounded: "{rounded.sm}"
    padding: "9px 13px"
  button-secondary:
    backgroundColor: "{colors.environment}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "9px 13px"
  input:
    backgroundColor: "{colors.environment-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "9px 10px"
---

# Design System: VOID Mind

## Overview

**Creative North Star: "The Black Ice Chamber"**

VOID Mind feels like a silent observatory at night: the room disappears, one cold instrument surface remains readable, and light collects only where attention is required. Darkness is the environment. Light is the interface. Negative space is structural and the conversation carries the visual weight.

This is a product surface, so familiar controls remain familiar. The atmosphere comes from the absolute-black field, typography, selective luminosity, and rare chromatic separation, never from constant animation or decorative chrome. It rejects gray-card dashboards, cyberpunk spectacle, CRT nostalgia, green terminals, telemetry panels, and giant-orb identity.

**Key Characteristics:**

- near-absolute black regions with almost no visible container edge
- glacial-white state, focus, identity, and primary action light
- proportional reading typography with mono reserved for short technical labels and code
- one calm left navigation and one spacious primary surface
- restrained, state-driven motion with immediate reduced-motion resolution

## Colors

The palette is overwhelmingly achromatic. Cold chroma appears in the ice-white interface light; red and cyan exist only as momentary displacement or a restrained error disruption.

### Primary

- **Interface Light:** the primary action, selected state, focus, VOID symbol, and generation luminance.

### Secondary

- **Disruption Red:** rare error and brief chromatic-separation channel. It never becomes a page accent.
- **Disruption Cyan:** the second brief chromatic-separation channel. It does not label ordinary status.

### Neutral

- **Environment:** the dominant application field and boot background.
- **Environment Soft:** composer, code surface, and quiet navigation layer.
- **Surface / Surface Raised:** hover and selected structure used only when hierarchy requires it.
- **Text / Muted / Faint:** descending reading and metadata hierarchy.
- **Border:** sparse structural separation, not a box around every region.

### Named Rules

**The Darkness Rule.** Large regions remain black. A medium-gray application shell is prohibited.

**The Earned Light Rule.** White light indicates identity, focus, selection, active generation, or a primary action. Decorative glow on every control is prohibited.

**The Displacement Rule.** Red and cyan may separate for a fraction of a second around identity or recovery. Permanent RGB text and neon palettes are prohibited.

## Typography

**Display Font:** Segoe UI Variable (with Inter and system sans fallbacks)

**Body Font:** Segoe UI Variable (with Inter and system sans fallbacks)

**Label/Mono Font:** Cascadia Code (with SFMono-Regular and Consolas fallbacks)

**Character:** Quiet, contemporary, and optimized for sustained reading. The same proportional family carries headings and prose; mono identifies short system facts and code without turning the product into a terminal.

### Hierarchy

- **Display** (420, responsive 2–3.5rem): the Home and onboarding invitation.
- **Title** (520, 1.45rem, 1.25): page identity in Intelligence, Settings, Workspaces, and Knowledge.
- **Conversation title** (550, 0.88rem, 1.5): a restrained working-context label.
- **Body** (400, 0.94rem, 1.72): Markdown and assistant responses, capped at 72 characters.
- **UI text** (400 to 560, 0.72rem to 0.82rem): controls, navigation, and settings.
- **Label** (400, 0.68rem, 0.04em tracking): short provider, privacy, and role labels only.
- **Code** (400, 0.8rem, 1.6): internally scrolling blocks.

### Named Rules

**The Reading Rule.** Conversation prose is never forced into monospace. Long-form content stays between 65 and 75 characters per line.

**The Quiet Label Rule.** Uppercase and wide tracking are reserved for the MIND identity. Interface sentences remain normal case.

## Elevation

The system is flat by default. Depth comes from near-black tonal steps and disappearance into the environment. Small glows are semantic responses around focus, active light, and the boot symbol. There are no wide decorative drop shadows.

### Shadow Vocabulary

- **Light response** (`0 0 8px color-mix(in oklch, var(--mind-ice) 34%, transparent)`): primary hover or connected state.
- **Identity bloom** (radial light with soft falloff): boot reveal only.
- **Navigation occlusion** (black scrim): small-window drawer separation.

### Named Rules

**The Flat-Until-Active Rule.** Resting surfaces use tone, spacing, or a hairline. Luminous depth appears only in response to state.

## Components

### Buttons

- **Shape:** restrained rounding (6px).
- **Primary:** ice-white fill, black text, compact 9px by 13px padding.
- **Hover / Focus:** slightly brighter fill, small light response, explicit two-pixel focus outline.
- **Secondary:** transparent black field, one-pixel neutral border, muted text that brightens on hover.
- **Icon:** familiar 34px square hit area without a visible resting box.

### Cards / Containers

- **Corner Style:** 6px to 10px only where a bounded control needs it.
- **Background:** black or one near-black tonal step.
- **Shadow Strategy:** none at rest.
- **Border:** sparse hairlines for real separation only.
- **Internal Padding:** 12px to 24px based on task density.

Conversation messages are not cards. Role, spacing, brightness, and a faint separator create distinction.

### Inputs / Fields

- **Style:** near-black fill, six-pixel corners, one-pixel neutral edge.
- **Focus:** interface-light edge and the global visible focus outline.
- **Error / Disabled:** error text includes language, not color alone; disabled controls retain legible labels.

### Navigation

The primary navigation is a quiet left rail with standard icons and labels. Active state uses one raised near-black tone and glacial-white content. At narrow widths it becomes an off-canvas drawer with an accessible close scrim. Conversation history independently collapses at medium widths.

### Boot Identity

The exact parent VOID path is traced, filled with glacial white, and never geometrically altered. MIND resolves below it from blur and wider tracking. One brief red/cyan displacement may occur after resolution. Reduced motion removes the trace, displacement, and wait.

## Do's and Don'ts

### Do:

- **Do** keep the environment at near-absolute black and reserve surfaces for functional hierarchy.
- **Do** use glacial white for focus, active state, identity, and primary action.
- **Do** keep conversation prose proportional, comfortable, and no wider than 72 characters.
- **Do** expose clear hover, focus, active, disabled, loading, error, and reduced-motion behavior.
- **Do** let code blocks scroll internally and side navigation collapse before content becomes cramped.
- **Do** keep account, provider, model, and generation parameters in Intelligence and Settings.
- **Do** show selected workspace and Knowledge context before it affects a conversation.

### Don't:

- **Don't** build a gray-card dashboard or dense three-column inspector.
- **Don't** use CRT scanlines, noise grids, phosphor, terminal green, or dense monospace telemetry.
- **Don't** use permanent RGB text, cyberpunk neon, continuous glitch, or glowing controls everywhere.
- **Don't** turn assistant messages into giant boxed cards.
- **Don't** use the exact VOID symbol as raw material for distortion or redraw its geometry.
- **Don't** center the standalone product around a giant Orbit orb.
- **Don't** hide controls or state so deeply that minimalism becomes invisibility.
- **Don't** add fake statistics, workspaces, knowledge indexing, memory, or provider status.
