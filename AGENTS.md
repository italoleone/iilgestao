# Architecture rules
- Keep the collection agent inside `supabase/functions/agent-cobranca`; its pure rules are shared only with tests so no server secrets or agent logic enter the frontend.
- Run agent rule tests with its dedicated Vitest configuration; these server-only tests must not load the browser setup.
- Serialize agent actions with a compare-and-swap lease on the singleton settings timestamp; deterministic message IDs deduplicate retries without adding tables.
- Pause automated AI processing through the existing agent mode on terminal gateway configuration/access failures, preserving the safe failure reason in the director's chat.