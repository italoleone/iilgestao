import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useAssistantChat", () => ({ useAssistantChat: vi.fn() }));
import { callChatAssistant } from "../components/assistant/AssistantChat";
import { callAssistant } from "../lib/assistant";

const lockMessages = [
  "Outra execução do assistente já começou.",
  "O assistente está tratando outra solicitação. Aguarde a conclusão e tente novamente.",
];
const conflict = (message: string, status = 409) => ({
  data: null,
  error: { message: "Erro na função", context: new Response(JSON.stringify({ error: message }), { status }) },
});

beforeEach(() => { vi.useFakeTimers(); invoke.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe("Chat — repetição somente em trava de execução", () => {
  for (const action of ["reply", "decide"] as const) {
    for (const message of lockMessages) {
      it(`${action}: repete a trava em 4s, 8s e 12s e mantém o pedido`, async () => {
        const body = action === "reply" ? { action } : { action, message_id: "mensagem", choice: "aprovar" as const };
        invoke.mockImplementation(() => Promise.resolve(conflict(message)));
        invoke.mockImplementationOnce(() => Promise.resolve(conflict(message)))
          .mockImplementationOnce(() => Promise.resolve(conflict(message)))
          .mockImplementationOnce(() => Promise.resolve(conflict(message)))
          .mockResolvedValueOnce({ data: { ok: true }, error: null });
        const result = callChatAssistant(body);
        for (const [index, delay] of [4000, 8000, 12000].entries()) {
          await vi.advanceTimersByTimeAsync(delay - 1);
          expect(invoke).toHaveBeenCalledTimes(index + 1);
          await vi.advanceTimersByTimeAsync(1);
          expect(invoke).toHaveBeenCalledTimes(index + 2);
        }
        await expect(result).resolves.toEqual({ ok: true });
        for (const call of invoke.mock.calls) expect(call).toEqual(["agent-cobranca", { body }]);
      });
    }
  }

  it("encerra após três novas tentativas e preserva o erro", async () => {
    invoke.mockImplementation(() => Promise.resolve(conflict(lockMessages[0])));
    const result = callChatAssistant({ action: "reply" });
    const assertion = expect(result).rejects.toThrow(lockMessages[0]);
    await vi.advanceTimersByTimeAsync(24000);
    await assertion;
    expect(invoke).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  for (const message of [
    "A tarefa mudou de responsável ou de status; a data não foi alterada.",
    "Esta cobrança não está mais aguardando aprovação.",
    "Uma cobrança real não pode ser decidida enquanto o assistente está em teste.",
  ]) {
    it(`não repete outro 409: ${message}`, async () => {
      invoke.mockResolvedValue(conflict(message));
      await expect(callChatAssistant({ action: "decide", message_id: "mensagem", choice: "recusar" })).rejects.toThrow(message);
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });
  }

  it("não repete mensagem de trava sem status 409", async () => {
    invoke.mockResolvedValue(conflict(lockMessages[0], 503));
    await expect(callChatAssistant({ action: "reply" })).rejects.toThrow(lockMessages[0]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("não altera a chamada Rodar agora", async () => {
    invoke.mockResolvedValue(conflict(lockMessages[0]));
    await expect(callAssistant({ action: "run", force: true })).rejects.toThrow(lockMessages[0]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});