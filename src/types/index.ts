export type Discipline = 'estrutural' | 'hidraulica' | 'eletrica';
export type UserRole = 'admin' | 'gerente' | 'coordenador' | 'projetista';
export type ProjectStatus = 'em_andamento' | 'concluido' | 'atrasado' | 'pausado';
export type StageStatus = 'pendente' | 'em_andamento' | 'concluido' | 'revisao';
export type TaskStatus = 'nao_iniciada' | 'em_andamento' | 'concluida' | 'aguardando_validacao' | 'aprovada' | 'reprovada' | 'enviado_cliente';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  discipline: Discipline;
  avatar?: string;
  costPerHour: number;
  monthlyCapacityHours: number;
}

export interface Stage {
  id: string;
  name: string;
  responsible: string;
  deadline: string;
  status: StageStatus;
  hoursSpent: number;
}

export interface Revision {
  id: string;
  version: string;
  date: string;
  responsible: string;
  description: string;
}

export interface Task {
  id: string;
  name: string;
  projectId: string;
  discipline: Discipline;
  stageName: string;
  responsible: string;
  startDate: string;
  endDate: string;
  estimatedHours: number;
  hoursWorked: number;
  status: TaskStatus;
  attachments: TaskAttachment[];
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  discipline: Discipline;
  startDate: string;
  deadline: string;
  status: ProjectStatus;
  responsible: string;
  team: string[];
  hoursSold: number;
  saleValue: number;
  hoursWorked: number;
  stages: Stage[];
  revisions: Revision[];
}

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  taskId: string;
  stageId: string;
  startTime: string;
  endTime?: string;
  duration: number; // minutes
}

export interface TimeRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface Alert {
  id: string;
  type: 'atrasado' | 'prazo_proximo' | 'sobrecarga' | 'prejuizo' | 'tarefa_atrasada' | 'tarefa_prazo_proximo' | 'tarefa_nao_iniciada';
  message: string;
  severity: 'high' | 'medium' | 'low';
  projectId?: string;
  userId?: string;
  taskId?: string;
}

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  estrutural: 'Projetos Estruturais',
  hidraulica: 'Instalações Hidráulicas',
  eletrica: 'Instalações Elétricas',
};

export const DISCIPLINE_SHORT: Record<Discipline, string> = {
  estrutural: 'Estrutural',
  hidraulica: 'Hidráulica',
  eletrica: 'Elétrica',
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  atrasado: 'Atrasado',
  pausado: 'Pausado',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  nao_iniciada: 'Não iniciada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  aguardando_validacao: 'Aguardando Validação',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
  enviado_cliente: 'Enviado ao Cliente',
};

export const STAGE_NAMES = [
  'Estudo Preliminar',
  'Anteprojeto',
  'Pré-executivo',
  'Executivo',
  'Liberação para Obra',
  'Revisão',
];

export const ROLE_LABELS: Record<string, string> = {
  admin_geral: 'Diretor',
  admin: 'Gerente',
  planejamento: 'Coordenador',
  projetista: 'Projetista',
};
