export type Discipline = 'estrutural' | 'hidraulica' | 'eletrica';
export type UserRole = 'admin' | 'gerente' | 'coordenador' | 'projetista';
export type ProjectStatus = 'em_andamento' | 'concluido' | 'atrasado' | 'pausado';
export type StageStatus = 'pendente' | 'em_andamento' | 'concluido' | 'revisao';

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
  hoursWorked: number;
  stages: Stage[];
  revisions: Revision[];
}

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  stageId: string;
  startTime: string;
  endTime?: string;
  duration: number; // minutes
}

export interface Alert {
  id: string;
  type: 'atrasado' | 'prazo_proximo' | 'sobrecarga' | 'prejuizo';
  message: string;
  severity: 'high' | 'medium' | 'low';
  projectId?: string;
  userId?: string;
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

export const STAGE_NAMES = [
  'Estudo Preliminar',
  'Anteprojeto',
  'Pré-executivo',
  'Executivo',
  'Liberação para Obra',
  'Revisão',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  coordenador: 'Coordenador',
  projetista: 'Projetista',
};
