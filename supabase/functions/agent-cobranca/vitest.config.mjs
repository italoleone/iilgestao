// Run from the project root: bunx vitest run --config supabase/functions/agent-cobranca/vitest.config.mjs
export default {
  test: {
    environment: "node",
    include: ["src/test/agent-cobranca.test.ts"],
    setupFiles: [],
  },
};