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
