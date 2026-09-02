# Workspaces

A Workspace is a durable context boundary for related conversations. It has a name, description, instructions, and an optional preferred provider/model configuration.

Resolution follows one order:

1. explicit conversation override
2. workspace preference
3. global default

If the resolved provider or model is unavailable, VOID Mind stops and explains the mismatch. It never moves the conversation to another provider implicitly.

Deleting a workspace detaches its conversations and removes its app-managed Knowledge entries. Conversations themselves are preserved. A new conversation can be created within the selected workspace from Home.
