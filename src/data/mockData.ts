import { User, Project, TimeEntry, Alert, Task } from '@/types';

export const currentUser: User = {
  id: 'u1',
  name: 'Marco Leone',
  email: 'marco@iileone.com.br',
  role: 'admin',
  discipline: 'estrutural',
  costPerHour: 180,
  monthlyCapacityHours: 176,
};

export const users: User[] = [
  currentUser,
  { id: 'u2', name: 'Ana Beatriz Costa', email: 'ana@iileone.com.br', role: 'gerente', discipline: 'estrutural', costPerHour: 150, monthlyCapacityHours: 176 },
  { id: 'u3', name: 'Rafael Mendes', email: 'rafael@iileone.com.br', role: 'coordenador', discipline: 'estrutural', costPerHour: 120, monthlyCapacityHours: 176 },
  { id: 'u4', name: 'Camila Torres', email: 'camila@iileone.com.br', role: 'coordenador', discipline: 'hidraulica', costPerHour: 120, monthlyCapacityHours: 176 },
  { id: 'u5', name: 'Lucas Ferreira', email: 'lucas@iileone.com.br', role: 'coordenador', discipline: 'eletrica', costPerHour: 120, monthlyCapacityHours: 176 },
  { id: 'u6', name: 'Juliana Rocha', email: 'juliana@iileone.com.br', role: 'projetista', discipline: 'estrutural', costPerHour: 85, monthlyCapacityHours: 176 },
  { id: 'u7', name: 'Pedro Almeida', email: 'pedro@iileone.com.br', role: 'projetista', discipline: 'hidraulica', costPerHour: 85, monthlyCapacityHours: 176 },
  { id: 'u8', name: 'Mariana Silva', email: 'mariana@iileone.com.br', role: 'projetista', discipline: 'eletrica', costPerHour: 85, monthlyCapacityHours: 176 },
  { id: 'u9', name: 'Thiago Nascimento', email: 'thiago@iileone.com.br', role: 'projetista', discipline: 'estrutural', costPerHour: 80, monthlyCapacityHours: 176 },
  { id: 'u10', name: 'Fernanda Lopes', email: 'fernanda@iileone.com.br', role: 'projetista', discipline: 'hidraulica', costPerHour: 80, monthlyCapacityHours: 176 },
];

export const projects: Project[] = [
  {
    id: 'p1', name: 'Edifício Panorama Tower', client: 'Construtora Horizonte', discipline: 'estrutural',
    startDate: '2026-01-15', deadline: '2026-04-30', status: 'em_andamento', responsible: 'u3',
    team: ['u3', 'u6', 'u9'], hoursSold: 480, saleValue: 62400, hoursWorked: 312,
    stages: [
      { id: 's1', name: 'Estudo Preliminar', responsible: 'u3', deadline: '2026-02-01', status: 'concluido', hoursSpent: 48 },
      { id: 's2', name: 'Anteprojeto', responsible: 'u6', deadline: '2026-02-20', status: 'concluido', hoursSpent: 72 },
      { id: 's3', name: 'Pré-executivo', responsible: 'u6', deadline: '2026-03-15', status: 'concluido', hoursSpent: 96 },
      { id: 's4', name: 'Executivo', responsible: 'u9', deadline: '2026-04-10', status: 'em_andamento', hoursSpent: 64 },
      { id: 's5', name: 'Liberação para Obra', responsible: 'u3', deadline: '2026-04-25', status: 'pendente', hoursSpent: 0 },
      { id: 's6', name: 'Revisão', responsible: 'u3', deadline: '2026-04-30', status: 'pendente', hoursSpent: 0 },
    ],
    revisions: [
      { id: 'r1', version: 'V1', date: '2026-02-01', responsible: 'u3', description: 'Versão inicial do estudo preliminar' },
      { id: 'r2', version: 'V2', date: '2026-03-10', responsible: 'u6', description: 'Revisão do anteprojeto com ajustes estruturais' },
    ],
  },
  {
    id: 'p2', name: 'Residencial Villa Serena', client: 'Incorporadora Sol', discipline: 'hidraulica',
    startDate: '2026-02-01', deadline: '2026-05-15', status: 'em_andamento', responsible: 'u4',
    team: ['u4', 'u7', 'u10'], hoursSold: 320, saleValue: 41600, hoursWorked: 145,
    stages: [
      { id: 's7', name: 'Estudo Preliminar', responsible: 'u4', deadline: '2026-02-15', status: 'concluido', hoursSpent: 32 },
      { id: 's8', name: 'Anteprojeto', responsible: 'u7', deadline: '2026-03-10', status: 'concluido', hoursSpent: 56 },
      { id: 's9', name: 'Pré-executivo', responsible: 'u7', deadline: '2026-04-05', status: 'em_andamento', hoursSpent: 40 },
      { id: 's10', name: 'Executivo', responsible: 'u10', deadline: '2026-04-30', status: 'pendente', hoursSpent: 0 },
      { id: 's11', name: 'Liberação para Obra', responsible: 'u4', deadline: '2026-05-10', status: 'pendente', hoursSpent: 0 },
      { id: 's12', name: 'Revisão', responsible: 'u4', deadline: '2026-05-15', status: 'pendente', hoursSpent: 0 },
    ],
    revisions: [
      { id: 'r3', version: 'V1', date: '2026-02-15', responsible: 'u4', description: 'Estudo preliminar entregue' },
    ],
  },
  {
    id: 'p3', name: 'Centro Comercial Atlântica', client: 'Grupo Atlântica', discipline: 'eletrica',
    startDate: '2025-11-01', deadline: '2026-03-15', status: 'atrasado', responsible: 'u5',
    team: ['u5', 'u8'], hoursSold: 400, hoursWorked: 420,
    stages: [
      { id: 's13', name: 'Estudo Preliminar', responsible: 'u5', deadline: '2025-11-20', status: 'concluido', hoursSpent: 40 },
      { id: 's14', name: 'Anteprojeto', responsible: 'u8', deadline: '2025-12-15', status: 'concluido', hoursSpent: 80 },
      { id: 's15', name: 'Pré-executivo', responsible: 'u8', deadline: '2026-01-20', status: 'concluido', hoursSpent: 110 },
      { id: 's16', name: 'Executivo', responsible: 'u5', deadline: '2026-02-28', status: 'revisao', hoursSpent: 130 },
      { id: 's17', name: 'Liberação para Obra', responsible: 'u5', deadline: '2026-03-10', status: 'pendente', hoursSpent: 0 },
      { id: 's18', name: 'Revisão', responsible: 'u5', deadline: '2026-03-15', status: 'pendente', hoursSpent: 0 },
    ],
    revisions: [
      { id: 'r4', version: 'V1', date: '2025-11-20', responsible: 'u5', description: 'Estudo preliminar' },
      { id: 'r5', version: 'V2', date: '2026-01-10', responsible: 'u8', description: 'Alteração no dimensionamento geral' },
      { id: 'r6', version: 'V3', date: '2026-02-28', responsible: 'u5', description: 'Revisão executivo - correções cliente' },
    ],
  },
  {
    id: 'p4', name: 'Galpão Industrial Progresso', client: 'Indústrias Progresso', discipline: 'estrutural',
    startDate: '2026-03-01', deadline: '2026-06-30', status: 'em_andamento', responsible: 'u3',
    team: ['u3', 'u6'], hoursSold: 560, hoursWorked: 48,
    stages: [
      { id: 's19', name: 'Estudo Preliminar', responsible: 'u3', deadline: '2026-03-20', status: 'em_andamento', hoursSpent: 32 },
      { id: 's20', name: 'Anteprojeto', responsible: 'u6', deadline: '2026-04-15', status: 'pendente', hoursSpent: 0 },
      { id: 's21', name: 'Pré-executivo', responsible: 'u6', deadline: '2026-05-10', status: 'pendente', hoursSpent: 0 },
      { id: 's22', name: 'Executivo', responsible: 'u3', deadline: '2026-06-05', status: 'pendente', hoursSpent: 0 },
      { id: 's23', name: 'Liberação para Obra', responsible: 'u3', deadline: '2026-06-25', status: 'pendente', hoursSpent: 0 },
      { id: 's24', name: 'Revisão', responsible: 'u3', deadline: '2026-06-30', status: 'pendente', hoursSpent: 0 },
    ],
    revisions: [],
  },
  {
    id: 'p5', name: 'Hospital Regional Norte', client: 'Governo do Estado', discipline: 'hidraulica',
    startDate: '2026-01-10', deadline: '2026-07-30', status: 'em_andamento', responsible: 'u4',
    team: ['u4', 'u7'], hoursSold: 720, hoursWorked: 198,
    stages: [
      { id: 's25', name: 'Estudo Preliminar', responsible: 'u4', deadline: '2026-02-10', status: 'concluido', hoursSpent: 56 },
      { id: 's26', name: 'Anteprojeto', responsible: 'u7', deadline: '2026-03-20', status: 'em_andamento', hoursSpent: 88 },
      { id: 's27', name: 'Pré-executivo', responsible: 'u7', deadline: '2026-05-01', status: 'pendente', hoursSpent: 0 },
      { id: 's28', name: 'Executivo', responsible: 'u4', deadline: '2026-06-15', status: 'pendente', hoursSpent: 0 },
      { id: 's29', name: 'Liberação para Obra', responsible: 'u4', deadline: '2026-07-15', status: 'pendente', hoursSpent: 0 },
      { id: 's30', name: 'Revisão', responsible: 'u4', deadline: '2026-07-30', status: 'pendente', hoursSpent: 0 },
    ],
    revisions: [
      { id: 'r7', version: 'V1', date: '2026-02-10', responsible: 'u4', description: 'Entrega estudo preliminar' },
    ],
  },
  {
    id: 'p6', name: 'Escola Técnica Municipal', client: 'Prefeitura Municipal', discipline: 'eletrica',
    startDate: '2026-02-15', deadline: '2026-04-15', status: 'em_andamento', responsible: 'u5',
    team: ['u5', 'u8'], hoursSold: 240, hoursWorked: 164,
    stages: [
      { id: 's31', name: 'Estudo Preliminar', responsible: 'u5', deadline: '2026-02-28', status: 'concluido', hoursSpent: 24 },
      { id: 's32', name: 'Anteprojeto', responsible: 'u8', deadline: '2026-03-10', status: 'concluido', hoursSpent: 48 },
      { id: 's33', name: 'Pré-executivo', responsible: 'u8', deadline: '2026-03-25', status: 'concluido', hoursSpent: 56 },
      { id: 's34', name: 'Executivo', responsible: 'u5', deadline: '2026-04-08', status: 'em_andamento', hoursSpent: 36 },
      { id: 's35', name: 'Liberação para Obra', responsible: 'u5', deadline: '2026-04-12', status: 'pendente', hoursSpent: 0 },
      { id: 's36', name: 'Revisão', responsible: 'u5', deadline: '2026-04-15', status: 'pendente', hoursSpent: 0 },
    ],
    revisions: [
      { id: 'r8', version: 'V1', date: '2026-02-28', responsible: 'u5', description: 'Preliminar aprovado' },
      { id: 'r9', version: 'V2', date: '2026-03-18', responsible: 'u8', description: 'Ajustes no quadro de cargas' },
    ],
  },
  {
    id: 'p7', name: 'Condomínio Parque das Águas', client: 'Construtora Onda', discipline: 'estrutural',
    startDate: '2025-10-01', deadline: '2026-02-28', status: 'concluido', responsible: 'u3',
    team: ['u3', 'u9'], hoursSold: 380, hoursWorked: 352,
    stages: [
      { id: 's37', name: 'Estudo Preliminar', responsible: 'u3', deadline: '2025-10-20', status: 'concluido', hoursSpent: 36 },
      { id: 's38', name: 'Anteprojeto', responsible: 'u9', deadline: '2025-11-15', status: 'concluido', hoursSpent: 64 },
      { id: 's39', name: 'Pré-executivo', responsible: 'u9', deadline: '2025-12-20', status: 'concluido', hoursSpent: 88 },
      { id: 's40', name: 'Executivo', responsible: 'u3', deadline: '2026-01-30', status: 'concluido', hoursSpent: 104 },
      { id: 's41', name: 'Liberação para Obra', responsible: 'u3', deadline: '2026-02-15', status: 'concluido', hoursSpent: 32 },
      { id: 's42', name: 'Revisão', responsible: 'u3', deadline: '2026-02-28', status: 'concluido', hoursSpent: 28 },
    ],
    revisions: [
      { id: 'r10', version: 'V1', date: '2025-10-20', responsible: 'u3', description: 'Preliminar' },
      { id: 'r11', version: 'V2', date: '2025-12-20', responsible: 'u9', description: 'Pré-executivo revisado' },
      { id: 'r12', version: 'V3', date: '2026-02-28', responsible: 'u3', description: 'Versão final liberada' },
    ],
  },
];

export const tasks: Task[] = [
  // Edifício Panorama Tower (p1) — Executivo stage
  { id: 't1', name: 'Armação de Lajes do Térreo', projectId: 'p1', discipline: 'estrutural', stageName: 'Executivo', responsible: 'u9', startDate: '2026-03-15', endDate: '2026-03-28', estimatedHours: 24, hoursWorked: 18, status: 'em_andamento', attachments: [] },
  { id: 't2', name: 'Armação de Vigas V1 a V12', projectId: 'p1', discipline: 'estrutural', stageName: 'Executivo', responsible: 'u9', startDate: '2026-03-28', endDate: '2026-04-05', estimatedHours: 20, hoursWorked: 6, status: 'em_andamento', attachments: [] },
  { id: 't3', name: 'Detalhamento de Pilares P1 a P8', projectId: 'p1', discipline: 'estrutural', stageName: 'Executivo', responsible: 'u6', startDate: '2026-03-20', endDate: '2026-04-02', estimatedHours: 16, hoursWorked: 12, status: 'em_andamento', attachments: [] },
  { id: 't4', name: 'Planta de Formas do 1º Pavimento', projectId: 'p1', discipline: 'estrutural', stageName: 'Executivo', responsible: 'u6', startDate: '2026-04-02', endDate: '2026-04-10', estimatedHours: 18, hoursWorked: 0, status: 'nao_iniciada', attachments: [] },

  // Residencial Villa Serena (p2) — Pré-executivo
  { id: 't5', name: 'Dimensionamento da Rede de Esgoto', projectId: 'p2', discipline: 'hidraulica', stageName: 'Pré-executivo', responsible: 'u7', startDate: '2026-03-10', endDate: '2026-03-25', estimatedHours: 20, hoursWorked: 14, status: 'em_andamento', attachments: [] },
  { id: 't6', name: 'Rede de Água Fria — Prumadas', projectId: 'p2', discipline: 'hidraulica', stageName: 'Pré-executivo', responsible: 'u7', startDate: '2026-03-15', endDate: '2026-03-30', estimatedHours: 16, hoursWorked: 8, status: 'em_andamento', attachments: [] },
  { id: 't7', name: 'Memorial de Cálculo Hidráulico', projectId: 'p2', discipline: 'hidraulica', stageName: 'Pré-executivo', responsible: 'u10', startDate: '2026-03-20', endDate: '2026-04-05', estimatedHours: 12, hoursWorked: 0, status: 'nao_iniciada', attachments: [] },

  // Centro Comercial Atlântica (p3) — Executivo (atrasado)
  { id: 't8', name: 'Quadro de Distribuição — Bloco A', projectId: 'p3', discipline: 'eletrica', stageName: 'Executivo', responsible: 'u8', startDate: '2026-02-01', endDate: '2026-02-20', estimatedHours: 32, hoursWorked: 38, status: 'em_andamento', attachments: [] },
  { id: 't9', name: 'Diagrama Unifilar Geral', projectId: 'p3', discipline: 'eletrica', stageName: 'Executivo', responsible: 'u5', startDate: '2026-02-15', endDate: '2026-03-05', estimatedHours: 28, hoursWorked: 30, status: 'em_andamento', attachments: [] },
  { id: 't10', name: 'Projeto de SPDA', projectId: 'p3', discipline: 'eletrica', stageName: 'Executivo', responsible: 'u8', startDate: '2026-02-20', endDate: '2026-03-10', estimatedHours: 24, hoursWorked: 26, status: 'em_andamento', attachments: [] },

  // Galpão Industrial Progresso (p4) — Estudo Preliminar
  { id: 't11', name: 'Levantamento de Cargas', projectId: 'p4', discipline: 'estrutural', stageName: 'Estudo Preliminar', responsible: 'u3', startDate: '2026-03-01', endDate: '2026-03-12', estimatedHours: 16, hoursWorked: 14, status: 'em_andamento', attachments: [] },
  { id: 't12', name: 'Pré-dimensionamento da Cobertura', projectId: 'p4', discipline: 'estrutural', stageName: 'Estudo Preliminar', responsible: 'u6', startDate: '2026-03-10', endDate: '2026-03-20', estimatedHours: 12, hoursWorked: 4, status: 'em_andamento', attachments: [] },
  { id: 't13', name: 'Concepção Estrutural — Fundações', projectId: 'p4', discipline: 'estrutural', stageName: 'Estudo Preliminar', responsible: 'u3', startDate: '2026-03-15', endDate: '2026-03-25', estimatedHours: 14, hoursWorked: 0, status: 'nao_iniciada', attachments: [] },

  // Hospital Regional Norte (p5) — Anteprojeto
  { id: 't14', name: 'Rede de Água Quente — Central', projectId: 'p5', discipline: 'hidraulica', stageName: 'Anteprojeto', responsible: 'u7', startDate: '2026-02-20', endDate: '2026-03-15', estimatedHours: 28, hoursWorked: 22, status: 'em_andamento', attachments: [] },
  { id: 't15', name: 'Sistema de Combate a Incêndio', projectId: 'p5', discipline: 'hidraulica', stageName: 'Anteprojeto', responsible: 'u7', startDate: '2026-03-01', endDate: '2026-03-20', estimatedHours: 24, hoursWorked: 16, status: 'em_andamento', attachments: [] },
  { id: 't16', name: 'Rede de Gases Medicinais', projectId: 'p5', discipline: 'hidraulica', stageName: 'Anteprojeto', responsible: 'u4', startDate: '2026-03-05', endDate: '2026-03-25', estimatedHours: 20, hoursWorked: 8, status: 'em_andamento', attachments: [] },

  // Escola Técnica Municipal (p6) — Executivo
  { id: 't17', name: 'Iluminação das Salas de Aula', projectId: 'p6', discipline: 'eletrica', stageName: 'Executivo', responsible: 'u8', startDate: '2026-03-25', endDate: '2026-04-05', estimatedHours: 16, hoursWorked: 10, status: 'em_andamento', attachments: [] },
  { id: 't18', name: 'Projeto de Tomadas e Circuitos', projectId: 'p6', discipline: 'eletrica', stageName: 'Executivo', responsible: 'u5', startDate: '2026-03-28', endDate: '2026-04-08', estimatedHours: 14, hoursWorked: 6, status: 'em_andamento', attachments: [] },

  // Completed project tasks (p7)
  { id: 't19', name: 'Armação de Fundações', projectId: 'p7', discipline: 'estrutural', stageName: 'Executivo', responsible: 'u9', startDate: '2026-01-05', endDate: '2026-01-20', estimatedHours: 32, hoursWorked: 34, status: 'concluida', attachments: [] },
  { id: 't20', name: 'Planta de Formas — Térreo', projectId: 'p7', discipline: 'estrutural', stageName: 'Executivo', responsible: 'u3', startDate: '2026-01-10', endDate: '2026-01-30', estimatedHours: 40, hoursWorked: 42, status: 'concluida', attachments: [] },
];

export const alerts: Alert[] = [
  { id: 'a1', type: 'atrasado', message: 'Centro Comercial Atlântica está 7 dias atrasado', severity: 'high', projectId: 'p3' },
  { id: 'a2', type: 'prejuizo', message: 'Centro Comercial Atlântica ultrapassou as horas vendidas em 5%', severity: 'high', projectId: 'p3' },
  { id: 'a3', type: 'prazo_proximo', message: 'Escola Técnica Municipal vence em 24 dias', severity: 'medium', projectId: 'p6' },
  { id: 'a4', type: 'sobrecarga', message: 'Rafael Mendes está com 142% da capacidade alocada', severity: 'high', userId: 'u3' },
  { id: 'a5', type: 'sobrecarga', message: 'Mariana Silva está com 118% da capacidade alocada', severity: 'medium', userId: 'u8' },
  { id: 'a6', type: 'prazo_proximo', message: 'Edifício Panorama Tower — etapa Executivo vence em 19 dias', severity: 'low', projectId: 'p1' },
  { id: 'a7', type: 'tarefa_atrasada', message: 'Tarefa "Quadro de Distribuição — Bloco A" está 30 dias atrasada', severity: 'high', taskId: 't8', projectId: 'p3' },
  { id: 'a8', type: 'tarefa_prazo_proximo', message: 'Tarefa "Armação de Lajes do Térreo" vence em 6 dias', severity: 'medium', taskId: 't1', projectId: 'p1' },
  { id: 'a9', type: 'tarefa_nao_iniciada', message: 'Tarefa "Memorial de Cálculo Hidráulico" não foi iniciada e já passou da data prevista', severity: 'medium', taskId: 't7', projectId: 'p2' },
];

export function getUserById(id: string): User | undefined {
  return users.find(u => u.id === id);
}

export function getProjectsByDiscipline(discipline: string): Project[] {
  return projects.filter(p => p.discipline === discipline);
}

export function getActiveProjects(): Project[] {
  return projects.filter(p => p.status === 'em_andamento' || p.status === 'atrasado');
}

export function getTasksByProject(projectId: string): Task[] {
  return tasks.filter(t => t.projectId === projectId);
}

export function getTasksByUser(userId: string): Task[] {
  return tasks.filter(t => t.responsible === userId);
}

export function getProjectTaskHours(projectId: string): { estimated: number; worked: number } {
  const projectTasks = getTasksByProject(projectId);
  return {
    estimated: projectTasks.reduce((s, t) => s + t.estimatedHours, 0),
    worked: projectTasks.reduce((s, t) => s + t.hoursWorked, 0),
  };
}

export function getUserAllocatedHours(userId: string): number {
  return tasks
    .filter(t => t.responsible === userId && t.status !== 'concluida')
    .reduce((sum, t) => sum + t.estimatedHours, 0);
}

export function getUserWorkedHours(userId: string): number {
  return tasks
    .filter(t => t.responsible === userId)
    .reduce((sum, t) => sum + t.hoursWorked, 0);
}

export function getProjectCost(project: Project): number {
  const projectTasks = getTasksByProject(project.id);
  return projectTasks.reduce((cost, task) => {
    const user = getUserById(task.responsible);
    if (!user) return cost;
    return cost + (task.hoursWorked * user.costPerHour);
  }, 0);
}

export function getProjectRevenue(project: Project): number {
  return project.hoursSold * 130;
}
