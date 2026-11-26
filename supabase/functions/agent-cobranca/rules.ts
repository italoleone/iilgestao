export const OPEN_STATUSES = ["aguardando_resposta", "resposta_recebida", "aguardando_aprovacao"];
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
export function mayDecide(userId: string, role: string | null, coordinatorId: string | null, isTest: boolean, testRecipient: string | null) {
  return role === "admin_geral" || userId === coordinatorId || (isTest && userId === testRecipient);
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