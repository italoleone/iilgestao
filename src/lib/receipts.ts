export type ReceiptStatus = "pago" | "em_aberto" | "previsto" | "cancelado";
export type DisplayStatus = ReceiptStatus | "vencido";

export interface Receipt {
  id: string;
  project_id: string;
  invoice_group: string | null;
  invoice_number: string | null;
  has_invoice: boolean;
  description: string;
  gross_amount: number;
  net_amount: number | null;
  split_pct: number | null;
  issue_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  payment_method: string | null;
  status: ReceiptStatus;
  needs_review: boolean;
  review_note: string | null;
  source: string;
  source_ref: string | null;
  contact: string | null;
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  pago: "Pago", em_aberto: "Em aberto", vencido: "Vencido", previsto: "Previsto", cancelado: "Cancelado",
};

/** Hoje em America/Sao_Paulo, no formato YYYY-MM-DD. */
export function todaySP(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

/** Vencido = em aberto com vencimento antes de hoje (não é gravado). */
export function isOverdue(r: Pick<Receipt, "status" | "due_date">, today = todaySP()): boolean {
  return r.status === "em_aberto" && !!r.due_date && r.due_date < today;
}

export function displayStatus(r: Pick<Receipt, "status" | "due_date">, today = todaySP()): DisplayStatus {
  return isOverdue(r, today) ? "vencido" : r.status;
}

export interface ReceiptTotals {
  sale_value: number | null;
  recebido_bruto: number; recebido_liquido: number; em_aberto: number; vencido: number; previsto: number;
  saldo_a_receber: number; sem_valor_venda: boolean;
}

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function computeTotals(rows: Pick<Receipt, "status" | "due_date" | "gross_amount" | "net_amount">[], saleValue: number | null | undefined, today = todaySP()): ReceiptTotals {
  let bruto = 0, liq = 0, aberto = 0, venc = 0, prev = 0;
  for (const r of rows) {
    if (r.status === "pago") { bruto += n(r.gross_amount); liq += n(r.net_amount); }
    else if (r.status === "em_aberto") { aberto += n(r.gross_amount); if (isOverdue(r, today)) venc += n(r.gross_amount); }
    else if (r.status === "previsto") prev += n(r.gross_amount);
  }
  const sale = saleValue == null ? null : n(saleValue);
  return {
    sale_value: sale, recebido_bruto: r2(bruto), recebido_liquido: r2(liq), em_aberto: r2(aberto), vencido: r2(venc), previsto: r2(prev),
    saldo_a_receber: r2((sale ?? 0) - bruto), sem_valor_venda: !sale,
  };
}

const SHORT: [RegExp, string][] = [[/estrut/i, "EST"], [/hidr/i, "HID"], [/el[eé]tr/i, "ELE"], [/alven/i, "ALV"]];
export function disciplineShort(text: string): string {
  for (const [re, s] of SHORT) if (re.test(text)) return s;
  return text.slice(0, 3).toUpperCase();
}

/** "parte de NF X (EST 60% / HID 20%)" quando a cobrança foi dividida; null caso contrário. */
export function splitLabel(row: Receipt, all: Receipt[], labelOf: (r: Receipt) => string = (r) => disciplineShort(r.description)): string | null {
  if (!row.invoice_group) return null;
  const group = all.filter((r) => r.invoice_group === row.invoice_group);
  if (group.length < 2) return null;
  const parts = group.map((r) => `${labelOf(r)} ${r.split_pct != null ? `${Number(r.split_pct).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}%` : "?"}`);
  return `parte de NF ${row.invoice_number || "S/NF"} (${parts.join(" / ")})`;
}

export function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
