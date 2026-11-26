import { TASK_STATUS_LABELS, STATUS_LABELS } from "@/types";

export interface AuditRow {
  id: number;
  table_name: string;
  record_id: string | null;
  action: string;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
  changed_fields: string[] | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
}

export const TABLE_LABELS: Record<string, string> = {
  tasks: "Tarefa", projects: "Projeto", demands: "Demanda", schedule_allocations: "Cronograma",
  coordenador_projetistas: "Equipe", time_entries: "Horas", receivables: "A receber", payables: "A pagar",
  commercial_proposals: "Proposta", commercial_clients: "Cliente", project_financials: "Valor de venda",
  profile_costs: "Valor-hora", user_roles: "Perfil de acesso", profiles: "Usuário", bonus_salary: "Salário (bônus)",
  bonus_config: "Config. bonificação", proposal_billing_schedule: "Faturamento (proposta)",
  project_billing_schedule: "Faturamento (projeto)", meetings: "Reunião",
};

export const TABLE_GROUPS: Record<string, string[]> = {
  Tarefas: ["tasks"],
  Projetos: ["projects"],
  Demandas: ["demands"],
  Cronograma: ["schedule_allocations", "coordenador_projetistas"],
  Horas: ["time_entries"],
  Financeiro: ["receivables", "payables", "project_financials", "project_billing_schedule", "profile_costs", "bonus_salary", "bonus_config"],
  Comercial: ["commercial_proposals", "commercial_clients", "proposal_billing_schedule"],
  Usuários: ["profiles", "user_roles"],
};

const FIELD_LABELS: Record<string, string> = {
  status: "Status", name: "Nome", responsible: "Responsável", start_date: "Início", end_date: "Término",
  estimated_hours: "Horas estimadas", hours_worked: "Horas trabalhadas", deadline: "Prazo",
  rejection_reason: "Motivo da reprovação", is_done: "Feita", description: "Descrição", priority: "Prioridade",
  assigned_to: "Responsável", coordenador_id: "Coordenador", projetista_id: "Projetista", project_id: "Projeto",
  stage_name: "Etapa", date: "Data", entry_type: "Tipo", label: "Rótulo", notes: "Observações",
  amount: "Valor", due_date: "Vencimento", sale_value: "Valor de venda", cost_per_hour: "Valor-hora",
  role: "Perfil", discipline: "Disciplina", client: "Cliente", kanban_assignee_id: "Responsável (Kanban)",
};
const PERSON_FIELDS = new Set(["responsible", "assigned_to", "coordenador_id", "projetista_id", "kanban_assignee_id", "created_by", "user_id"]);
export const HIDDEN_FIELDS = new Set(["status_changed_at", "updated_at", "projetista_nome", "kanban_assignee_nome", "done_at", "created_at"]);

const tz = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const formatAuditDate = (iso: string) => tz.format(new Date(iso)).replace(",", "");

export function formatValue(field: string, v: any, table: string, names: Map<string, string>): string {
  if (v === null || v === undefined || v === "") return "—";
  if (field === "status") {
    return (table === "projects" ? (STATUS_LABELS as any)[v] : (TASK_STATUS_LABELS as any)[v]) || String(v);
  }
  if (PERSON_FIELDS.has(field)) return names.get(String(v)) || String(v);
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function describeChanges(row: AuditRow, names: Map<string, string>): string[] {
  if (row.action === "INSERT") return ["Criou"];
  if (row.action === "DELETE") return ["Excluiu"];
  const fields = (row.changed_fields ?? Object.keys(row.new_data ?? {})).filter((f) => !HIDDEN_FIELDS.has(f));
  return fields.map((f) => {
    const label = FIELD_LABELS[f] || f;
    return `${label}: ${formatValue(f, row.old_data?.[f], row.table_name, names)} → ${formatValue(f, row.new_data?.[f], row.table_name, names)}`;
  });
}

export function recordTitle(row: AuditRow): string | null {
  const d = row.new_data ?? row.old_data;
  return (d?.name || d?.description || d?.project_name || null) as string | null;
}
