import { User, Project, TimeEntry, Alert, Task } from '@/types';

export const currentUser: User = {
  id: '',
  name: '',
  email: '',
  role: 'projetista',
  discipline: 'estrutural',
  costPerHour: 0,
  monthlyCapacityHours: 176,
};

export const users: User[] = [];

export const projects: Project[] = [];

export const tasks: Task[] = [];

export const timeEntries: TimeEntry[] = [];

export const alerts: Alert[] = [];

// Helper functions
export const getUserById = (id: string): User | undefined => {
  return users.find(u => u.id === id);
};

export const getActiveProjects = (): Project[] => {
  return projects.filter(p => p.status === 'em_andamento');
};

export const getProjectCost = (project: Project): number => {
  return project.hoursWorked * (getUserById(project.responsible)?.costPerHour || 0);
};

export const getTasksByProject = (projectId: string): Task[] => {
  return tasks.filter(t => t.projectId === projectId);
};

export const getProjectTaskHours = (projectId: string): { estimated: number; worked: number } => {
  const projectTasks = getTasksByProject(projectId);
  return {
    estimated: projectTasks.reduce((sum, t) => sum + t.estimatedHours, 0),
    worked: projectTasks.reduce((sum, t) => sum + t.hoursWorked, 0),
  };
};

export const getUserAllocatedHours = (userId: string): number => {
  return tasks
    .filter(t => t.responsible === userId && t.status !== 'concluida')
    .reduce((sum, t) => sum + t.estimatedHours, 0);
};

export const getUserWorkedHours = (userId: string): number => {
  return tasks
    .filter(t => t.responsible === userId)
    .reduce((sum, t) => sum + t.hoursWorked, 0);
};
