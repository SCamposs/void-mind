# Connections

## Approved direction — 2026-10-28

The user approved **Continue with ChatGPT** as the primary connection and a discreet **Use API key** alternative in Intelligence. The first API-key integration is OpenAI. Other remote providers remain deferred.

This supersedes the environment goal's deferral of API-key providers and its requirement that Codex own all authentication. The supported Sign in with ChatGPT plan-usage flow now provides an official direct path for local open-source applications. No separate Codex installation is required for this path. Existing Codex-bound conversations remain available through the legacy provider; they are not silently rebound.

Implementation uses only public, documented endpoints. OAuth state, PKCE, nonce, signature/issuer/audience/expiry verification and granted inference scopes are mandatory. Credentials belong in the operating system credential store, never product persistence or exports. The API-key input exists transiently in the connection form and is cleared after submission. No token is returned to React.

ChatGPT and API access are distinct providers and model catalogs. There is no automatic fallback between them. Direct conversations send their explicit history and selected workspace context with `store:false` and no tools. Stop closes the active HTTP stream.

References:

- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://developers.openai.com/siwc/ui-ux-guidelines

Status: implementation in progress; fresh account consent and real API-key inference require user-owned credentials and are not yet validated.
