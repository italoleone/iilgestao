// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { canAccessAgents, canSeeDelayReasons, needsActivationConfirmation, validateAgentSettings, messageActions, timestampBR, type AgentSettings } from "../lib/assistant";

const settings: AgentSettings = { id: 1, mode: "teste", test_recipient_id: "destinatario", auto_limit_business_days: 3, run_weekdays: [1, 3, 5], run_hour: 9, max_reminders: 3, updated_at: "2026-11-26T18:00:00Z", last_run_date: null, planning_approver_id: "rebeca" };
describe("Assistente Leone — permissões e configuração", () => {
  it("apenas Diretor acessa Agentes", () => {
    expect(canAccessAgents("admin_geral")).toBe(true);
    for (const role of ["admin", "planejamento", "coordenador", "projetista", ""]) expect(canAccessAgents(role)).toBe(false);
  });
  it("justificativas são visíveis para responsável da tarefa e do projeto", () => {
    expect(canSeeDelayReasons("projetista", "pessoa", "pessoa", "coordenador")).toBe(true);
    expect(canSeeDelayReasons("coordenador", "pessoa", "outra", "pessoa")).toBe(true);
    expect(canSeeDelayReasons("coordenador", "pessoa", "outra", "outro")).toBe(false);
    expect(canSeeDelayReasons("projetista", "pessoa", "outra", "outro")).toBe(false);
  });
  it("Diretor, Gerente e Planejamento veem justificativas mesmo sem vínculo", () => {
    for (const role of ["admin_geral", "admin", "planejamento"]) expect(canSeeDelayReasons(role, "pessoa", "outra", "outro")).toBe(true);
  });
  it("confirmar é obrigatório antes de sair de Teste ou Desligado para Ativo", () => {
    expect(needsActivationConfirmation("teste", "ativo")).toBe(true);
    expect(needsActivationConfirmation("desligado", "ativo")).toBe(true);
    expect(needsActivationConfirmation("ativo", "ativo")).toBe(false);
    expect(needsActivationConfirmation("ativo", "teste")).toBe(false);
  });
  it("exige responsável pelo planejamento", () => {
    expect(validateAgentSettings({ ...settings, planning_approver_id: null })).not.toBeNull();
  });
  it("modo teste exige destinatário", () => {
    expect(validateAgentSettings(settings)).toBeNull();
    expect(validateAgentSettings({ ...settings, test_recipient_id: null })).not.toBeNull();
    expect(validateAgentSettings({ ...settings, mode: "ativo", test_recipient_id: null })).toBeNull();
  });
  it("configuração rejeita hora fora de 0–23 e dias fora de 0–6", () => {
    expect(validateAgentSettings({ ...settings, run_hour: 24 })).not.toBeNull();
    expect(validateAgentSettings({ ...settings, run_hour: -1 })).not.toBeNull();
    expect(validateAgentSettings({ ...settings, run_weekdays: [7] })).not.toBeNull();
    expect(validateAgentSettings({ ...settings, run_weekdays: [] })).not.toBeNull();
  });
  it("aceita somente decisões aprovar/recusar fornecidas pela mensagem", () => {
    expect(messageActions([{ id: "aprovar", label: "Aprovar" }, { id: "recusar", label: "Recusar" }, { id: "outro", label: "Inválido" }]).map(a => a.id)).toEqual(["aprovar", "recusar"]);
    expect(messageActions(null)).toEqual([]);
  });
  it("pedido no chat não oferece mais 'Já estava feito', nem em mensagens antigas", () => {
    const old = [{ id: "concluir_pedido", label: "Concluído" }, { id: "ja_feito", label: "Já estava feito" }, { id: "responder_pedido", label: "Responder" }];
    expect(messageActions(old).map(a => a.label)).toEqual(["Concluído", "Responder"]);
  });
  it("horário da conversa usa São Paulo na mudança de dia UTC", () => {
    expect(timestampBR("2026-11-27T01:15:00Z")).toBe("26/11 22:15");
  });
});