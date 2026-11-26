export const APPROVAL_STATUSES = ["aguardando_aprovacao", "aguardando_coordenador", "aguardando_planejamento"];
export const OPEN_STATUSES = ["aguardando_resposta", "resposta_recebida", ...APPROVAL_STATUSES];
export const OVERDUE_STATUSES = ["nao_iniciada", "em_andamento", "pausada", "reprovada"];
export const REASON_CATEGORIES = [
  "falta_informacao_cliente", "aguardando_arquitetura_ou_complementares",
  "outras_prioridades_sobrecarga", "revisao_retrabalho", "problema_tecnico",
  "ausencia", "ja_entregue", "outro",
] as const;

export function localClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  return { today, hour: Number(get("hour")), weekday: dateNumber(today).getUTCDay() };
}

function dateNumber(value: string) { return new Date(`${value}T00:00:00Z`); }
export function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(dateNumber(value).getTime()) && dateNumber(value).toISOString().slice(0, 10) === value;
}
export function formatDate(value: string | null) { return value ? value.split("-").reverse().join("/") : "não informada"; }
export function daysBetween(start: string, end: string) { return Math.round((dateNumber(end).getTime() - dateNumber(start).getTime()) / 86400000); }
// Exclude today, include the proposed delivery day; weekends do not consume the allowance.
export function businessDays(today: string, end: string) {
  let count = 0;
  const cursor = dateNumber(today);
  const last = dateNumber(end);
  while (cursor < last) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) count++;
  }
  return count;
}
export const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export function nextRunDay(today: string, weekdays: number[]) {
  const start = dateNumber(today).getUTCDay();
  for (let offset = 1; offset <= 7; offset++) if (weekdays.includes((start + offset) % 7)) return WEEKDAYS[(start + offset) % 7];
  return null;
}
export function shouldRun(settings: { mode: string; run_hour: number; last_run_date: string | null }, clock: ReturnType<typeof localClock>, force: boolean) {
  return settings.mode !== "desligado" && (force || (clock.hour >= settings.run_hour && settings.last_run_date !== clock.today));
}
export function shouldSimulate(mode: string, followupIsTest: boolean) { return mode === "teste" || followupIsTest; }
export type Stage = "coordenador" | "planejamento";
/** Legacy "aguardando_aprovacao" is the coordinator stage. */
export function stageOf(status: string): Stage | null {
  if (status === "aguardando_aprovacao" || status === "aguardando_coordenador") return "coordenador";
  if (status === "aguardando_planejamento") return "planejamento";
  return null;
}
/** First approval stage for a proposed date: coordinator, or planning when the project has none. */
export function firstStage(coordinatorId: string | null): Stage { return coordinatorId ? "coordenador" : "planejamento"; }
export const STAGE_STATUS: Record<Stage, string> = { coordenador: "aguardando_coordenador", planejamento: "aguardando_planejamento" };
/** In test mode the test recipient decides every stage; otherwise only the stage owner. */
export function mayDecide(userId: string, stage: Stage, coordinatorId: string | null, plannerId: string | null, simulated: boolean, testRecipient: string | null) {
  if (simulated) return !!testRecipient && userId === testRecipient;
  return stage === "coordenador" ? !!coordinatorId && userId === coordinatorId : !!plannerId && userId === plannerId;
}
export type DecisionPlan = { status: string; final: boolean; approved: boolean; changeTask: boolean; next: Stage | null; stageDecision: "aprovado" | "recusado" | "simulado"; decision: "aprovado" | "recusado" | "simulado" | null };
export function planDecision(stage: Stage, choice: "aprovar" | "recusar", coordinatorId: string | null, plannerId: string | null, simulated: boolean): DecisionPlan {
  const ok = simulated ? "simulado" : "aprovado";
  if (choice === "recusar") return { status: "resolvido", final: true, approved: false, changeTask: false, next: null, stageDecision: "recusado", decision: "recusado" };
  if (stage === "coordenador" && coordinatorId !== plannerId) return { status: STAGE_STATUS.planejamento, final: false, approved: false, changeTask: false, next: "planejamento", stageDecision: ok, decision: null };
  return { status: "resolvido", final: true, approved: true, changeTask: !simulated, next: null, stageDecision: ok, decision: ok };
}
/** Approval reminders: pending for more than 1 day since the stage started or the last reminder, max 3. */
export const MAX_APPROVAL_REMINDERS = 3;
export function needsApprovalReminder(since: string, reminders: number, now = new Date()) {
  return reminders < MAX_APPROVAL_REMINDERS && now.getTime() - new Date(since).getTime() > 86400000;
}
export function selectOldestPerPerson<T extends { responsible: string | null; end_date: string | null; status: string; id: string }>(tasks: T[], busy: Set<string>, today: string, cap: number) {
  const selected: T[] = [];
  const seen = new Set(busy);
  for (const task of [...tasks].sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? "") || a.id.localeCompare(b.id))) {
    if (!task.responsible || !task.end_date || task.end_date >= today || !OVERDUE_STATUSES.includes(task.status) || seen.has(task.responsible)) continue;
    selected.push(task);
    seen.add(task.responsible);
    if (selected.length === cap) break;
  }
  return selected;
}