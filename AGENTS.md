# Architecture rules
- Keep the collection agent inside `supabase/functions/agent-cobranca`; its pure rules are shared only with tests so no server secrets or agent logic enter the frontend.
- Run agent rule tests with its dedicated Vitest configuration; these server-only tests must not load the browser setup.
- Serialize agent actions with a compare-and-swap lease on the singleton settings timestamp; deterministic message IDs deduplicate retries without adding tables.
- Pause automated AI processing through the existing agent mode on terminal gateway configuration/access failures, preserving the safe failure reason in the director's chat.
- Keep assistant chat queries user-scoped, cursor-paginated and cached in React Query; filtered Realtime events, focus refresh and minute polling keep messages current without background loading indicators.
- New delivery dates always go through two approval stages (project coordinator, then the configured planning approver), with stage tagged on message actions so stale buttons cannot decide twice.
- Save agent settings with a timestamp compare-and-swap and never overwrite execution state; this keeps the director's form from invalidating an active lease.- Chat requests (@projeto + @pessoa) live in `supabase/functions/chat-pedido`, separate from the collection agent so they work in any agent mode and never take its lease; mention token helpers live in `supabase/functions/_shared/mentions.ts` and are re-exported to the frontend.
- Chat request replies and completion use service-only transactional RPCs; the demand status trigger owns completion comments and notices so chat and Demandas cannot send duplicate notices.
- Project receipts live in `project_receipts` (admin_geral/admin only); "vencido" is computed (em_aberto + due_date before today in São Paulo) in `src/lib/receipts.ts` and the `project_receipt_totals` view, never stored.
