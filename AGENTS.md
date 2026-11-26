# Architecture rules
- Keep the collection agent inside `supabase/functions/agent-cobranca`; its pure rules are shared only with tests so no server secrets or agent logic enter the frontend.
- Run agent rule tests with its dedicated Vitest configuration; these server-only tests must not load the browser setup.
- Serialize agent actions with a compare-and-swap lease on the singleton settings timestamp; deterministic message IDs deduplicate retries without adding tables.
- Pause automated AI processing through the existing agent mode on terminal gateway configuration/access failures, preserving the safe failure reason in the director's chat.
- Keep assistant chat queries user-scoped, cursor-paginated and cached in React Query; filtered Realtime events, focus refresh and minute polling keep messages current without background loading indicators.
- Save agent settings with a timestamp compare-and-swap and never overwrite execution state; this keeps the director's form from invalidating an active lease.