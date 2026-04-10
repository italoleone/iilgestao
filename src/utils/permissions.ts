import type { AppRole } from "@/contexts/AuthContext";

export function canAccessComercial(role: AppRole): boolean {
  return role === "admin_geral" || role === "admin";
}

export function canAccessFinanceiro(role: AppRole): boolean {
  return role === "admin_geral" || role === "admin";
}

export function canAccessPlanejamento(role: AppRole): boolean {
  return role !== "projetista";
}

export function canAccessDashboard(role: AppRole): boolean {
  return role === "admin_geral" || role === "admin";
}

export function canCreateProject(role: AppRole): boolean {
  return role === "admin_geral" || role === "admin" || role === "planejamento" || role === "coordenador";
}

export function canCreateTask(role: AppRole): boolean {
  return role !== "projetista";
}

export interface TaskFilter {
  /** If set, only show tasks from projects where responsible = this userId */
  byProjectResponsible?: string;
  /** If set, only show tasks where responsible = this userId */
  byTaskResponsible?: string;
  /** If true, hide tasks without a scheduled date (start_date or end_date) */
  requireScheduledDate?: boolean;
}

/**
 * Returns the filter constraints to apply when listing tasks.
 * - diretor / gerente / planejamento: no filter (sees everything)
 * - coordenador: only tasks from projects they coordinate, and only if scheduled
 * - projetista: only tasks assigned to them
 */
export function getTaskFilter(role: AppRole, userId: string): TaskFilter {
  switch (role) {
    case "admin_geral":
    case "admin":
    case "planejamento":
      return {};
    case "coordenador":
      return {
        byProjectResponsible: userId,
        requireScheduledDate: true,
      };
    case "projetista":
      return {
        byTaskResponsible: userId,
      };
    default:
      return { byTaskResponsible: userId };
  }
}
