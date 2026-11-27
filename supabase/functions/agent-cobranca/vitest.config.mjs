// Run from the project root: bunx vitest run --config supabase/functions/agent-cobranca/vitest.config.mjs
import { fileURLToPath } from "node:url";
export default {
  resolve: { alias: { "@": fileURLToPath(new URL("../../../src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/test/agent-cobranca.test.ts", "src/test/assistant-ui-rules.test.ts", "src/test/chat-pedido.test.ts", "src/test/agent-dupla-aprovacao.test.ts", "src/test/demand-conversation.test.ts", "src/test/assistant-chat-retry.test.ts", "src/test/project-receipts.test.ts"],
    setupFiles: [],
  },
};