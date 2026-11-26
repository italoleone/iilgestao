// @vitest-environment node
import { describe, it, expect } from "vitest";
import { businessDays, isDate, localClock, mayDecide, nextRunDay, selectOldestPerPerson, shouldRun, shouldSimulate } from "../../supabase/functions/agent-cobranca/rules";

describe("Assistente Leone — regras de cobrança", () => {
  it("usa o dia e hora de São Paulo, inclusive ao cruzar a meia-noite UTC", () => {
    expect(localClock(new Date("2026-11-27T01:00:00Z"))).toEqual({ today: "2026-11-26", hour: 22, weekday: 4 });
    expect(localClock(new Date("2026-11-27T12:00:00Z"))).toEqual({ today: "2026-11-27", hour: 9, weekday: 5 });
  });
  it("aguarda 9h e não roda duas vezes no mesmo dia sem force", () => {
    const settings = { mode: "ativo", run_hour: 9, last_run_date: null };
    expect(shouldRun(settings, { today: "2026-11-27", hour: 8, weekday: 5 }, false)).toBe(false);
    expect(shouldRun(settings, { today: "2026-11-27", hour: 9, weekday: 5 }, false)).toBe(true);
    expect(shouldRun({ ...settings, last_run_date: "2026-11-27" }, { today: "2026-11-27", hour: 10, weekday: 5 }, false)).toBe(false);
    expect(shouldRun({ ...settings, last_run_date: "2026-11-27" }, { today: "2026-11-27", hour: 8, weekday: 5 }, true)).toBe(true);
  });
  it("desligado não executa nem com force", () => {
    expect(shouldRun({ mode: "desligado", run_hour: 9, last_run_date: null }, { today: "2026-11-27", hour: 12, weekday: 5 }, true)).toBe(false);
  });
  it("conta até 3 dias úteis sem incluir sábado/domingo e sem contar hoje", () => {
    expect(businessDays("2026-11-27", "2026-12-02")).toBe(3);
    expect(businessDays("2026-11-27", "2026-12-03")).toBe(4);
    expect(businessDays("2026-11-27", "2026-11-27")).toBe(0);
  });
  it("recusa datas inexistentes ou formatos diferentes de YYYY-MM-DD", () => {
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("27/11/2026")).toBe(false);
    expect(isDate("2026-12-02")).toBe(true);
  });
  it("o próximo dia de execução segue segunda/quarta/sexta", () => {
    expect(nextRunDay("2026-11-26", [1, 3, 5])).toBe("sexta");
    expect(nextRunDay("2026-11-27", [1, 3, 5])).toBe("segunda");
  });
  it("testes nunca alteram tarefas, mesmo depois de mudar o modo global", () => {
    expect(shouldSimulate("teste", false)).toBe(true);
    expect(shouldSimulate("ativo", true)).toBe(true);
    expect(shouldSimulate("ativo", false)).toBe(false);
  });
  it("somente coordenador, Diretor ou destinatário de teste decidem", () => {
    expect(mayDecide("coordenador", "projetista", "coordenador", false, "teste")).toBe(true);
    expect(mayDecide("diretor", "admin_geral", "coordenador", false, "teste")).toBe(true);
    expect(mayDecide("gerente", "admin", "coordenador", false, "teste")).toBe(false);
    expect(mayDecide("teste", "projetista", "coordenador", true, "teste")).toBe(true);
    expect(mayDecide("teste", "projetista", "coordenador", false, "teste")).toBe(false);
  });
  it("seleciona só a tarefa mais atrasada por pessoa sem cobrança aberta", () => {
    const task = (id: string, responsible: string, end_date: string, status = "em_andamento") => ({ id, responsible, end_date, status });
    expect(selectOldestPerPerson([
      task("nova", "ana", "2026-11-25"), task("antiga", "ana", "2026-11-01"),
      task("ocupada", "bia", "2026-10-01"), task("validacao", "caio", "2026-10-01", "aguardando_validacao"),
      task("aprovada", "dani", "2026-10-01", "aprovada"), task("concluida", "eli", "2026-10-01", "concluida"),
      task("enviada", "fabio", "2026-10-01", "enviado_cliente"), task("hoje", "gabi", "2026-11-26"),
      task("pausada", "igor", "2026-11-02", "pausada"), task("reprovada", "joao", "2026-11-03", "reprovada"),
      task("nao_iniciada", "lara", "2026-11-04", "nao_iniciada"),
    ], new Set(["bia"]), "2026-11-26", 50).map(t => t.id)).toEqual(["antiga", "pausada", "reprovada", "nao_iniciada"]);
  });
  it("modo teste limita novas cobranças a cinco", () => {
    const tasks = Array.from({ length: 8 }, (_, n) => ({ id: String(n), responsible: `pessoa-${n}`, end_date: "2026-11-01", status: "nao_iniciada" }));
    expect(selectOldestPerPerson(tasks, new Set(), "2026-11-26", 5)).toHaveLength(5);
  });
});