// @vitest-environment node
import { describe, it, expect } from "vitest";
import { firstStage, mayDecide, needsApprovalReminder, planDecision, stageOf, STAGE_STATUS } from "../../supabase/functions/agent-cobranca/rules";

const COORD = "coord", PLAN = "rebeca", TEST = "teste";
describe("Assistente Leone — dupla aprovação de nova data", () => {
  it("toda nova data começa no coordenador; sem coordenador vai direto ao planejamento", () => {
    expect(STAGE_STATUS[firstStage(COORD)]).toBe("aguardando_coordenador");
    expect(STAGE_STATUS[firstStage(null)]).toBe("aguardando_planejamento");
    expect(stageOf("aguardando_aprovacao")).toBe("coordenador");
  });
  it("fluxo completo: coordenador aprova → planejamento aprova → a data muda", () => {
    const first = planDecision("coordenador", "aprovar", COORD, PLAN, false);
    expect(first).toMatchObject({ status: "aguardando_planejamento", next: "planejamento", changeTask: false, final: false, stageDecision: "aprovado" });
    expect(planDecision("planejamento", "aprovar", COORD, PLAN, false)).toMatchObject({ status: "resolvido", final: true, approved: true, changeTask: true, decision: "aprovado" });
  });
  it("coordenador recusa: encerra sem ir ao planejamento e sem mudar a data", () => {
    expect(planDecision("coordenador", "recusar", COORD, PLAN, false)).toMatchObject({ status: "resolvido", next: null, changeTask: false, decision: "recusado" });
  });
  it("planejamento recusa: encerra sem mudar a data", () => {
    expect(planDecision("planejamento", "recusar", COORD, PLAN, false)).toMatchObject({ status: "resolvido", changeTask: false, approved: false, decision: "recusado" });
  });
  it("coordenador que também é o planejamento: uma aprovação basta", () => {
    expect(planDecision("coordenador", "aprovar", PLAN, PLAN, false)).toMatchObject({ status: "resolvido", next: null, changeTask: true, decision: "aprovado" });
  });
  it("pessoa errada não decide nenhuma etapa", () => {
    expect(mayDecide(COORD, "coordenador", COORD, PLAN, false, TEST)).toBe(true);
    expect(mayDecide(PLAN, "coordenador", COORD, PLAN, false, TEST)).toBe(false);
    expect(mayDecide(COORD, "planejamento", COORD, PLAN, false, TEST)).toBe(false);
    expect(mayDecide(PLAN, "planejamento", COORD, PLAN, false, TEST)).toBe(true);
    expect(mayDecide(TEST, "planejamento", COORD, PLAN, false, TEST)).toBe(false);
  });
  it("modo teste: o destinatário de teste decide as duas etapas, aprovações são simuladas e a tarefa não muda", () => {
    expect(mayDecide(TEST, "coordenador", COORD, PLAN, true, TEST)).toBe(true);
    expect(mayDecide(TEST, "planejamento", COORD, PLAN, true, TEST)).toBe(true);
    expect(mayDecide(COORD, "coordenador", COORD, PLAN, true, TEST)).toBe(false);
    expect(planDecision("coordenador", "aprovar", COORD, PLAN, true).stageDecision).toBe("simulado");
    expect(planDecision("planejamento", "aprovar", COORD, PLAN, true)).toMatchObject({ changeTask: false, decision: "simulado" });
  });
  it("lembrete de aprovação só depois de mais de 1 dia e no máximo 3", () => {
    const now = new Date("2026-11-27T12:00:00Z");
    expect(needsApprovalReminder("2026-11-26T13:00:00Z", 0, now)).toBe(false);
    expect(needsApprovalReminder("2026-11-26T11:00:00Z", 2, now)).toBe(true);
    expect(needsApprovalReminder("2026-11-20T11:00:00Z", 3, now)).toBe(false);
  });
});
