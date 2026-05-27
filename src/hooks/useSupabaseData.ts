import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Discipline, ProjectStatus, TaskStatus, Project, Task, Stage } from "@/types";
import { STAGE_NAMES } from "@/types";

// --- DB row types ---
interface DbProject {
  id: string;
  name: string;
  client: string;
  discipline: string;
  start_date: string;
  deadline: string;
  status: string;
  responsible: string;
  team: string[];
  hours_worked: number;
  stages: any;
  revisions: any;
  created_at: string;
}

interface DbTask {
  id: string;
  name: string;
  project_id: string;
  discipline: string;
  stage_name: string;
  responsible: string;
  start_date: string;
  end_date: string;
  estimated_hours: number;
  hours_worked: number;
  status: string;
  created_at: string;
}

export interface DbTimeEntry {
  id: string;
  task_id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  created_at: string;
}

interface DbProfile {
  id: string;
  name: string;
  email: string;
  discipline: string | null;
  cost_per_hour: number | null;
  monthly_capacity_hours: number | null;
  avatar_url: string | null;
  status: string;
}

// --- Mappers ---
function mapProject(row: DbProject): Project {
  const stages: Stage[] = Array.isArray(row.stages) ? row.stages : [];
  // Ensure stages have proper structure
  const validStages = stages.length > 0 ? stages : STAGE_NAMES.map((name, i) => ({
    id: `s_${row.id}_${i}`,
    name,
    responsible: row.responsible,
    deadline: row.deadline,
    status: "pendente" as const,
    hoursSpent: 0,
  }));

  return {
    id: row.id,
    name: row.name,
    client: row.client,
    discipline: row.discipline as Discipline,
    startDate: row.start_date,
    deadline: row.deadline,
    status: row.status as ProjectStatus,
    responsible: row.responsible,
    team: row.team || [row.responsible],
    hoursSold: row.hours_sold,
    saleValue: row.sale_value,
    hoursWorked: row.hours_worked,
    stages: validStages,
    revisions: Array.isArray(row.revisions) ? row.revisions : [],
  };
}

function mapTask(row: DbTask): Task {
  return {
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    discipline: row.discipline as Discipline,
    stageName: row.stage_name,
    responsible: row.responsible,
    startDate: row.start_date,
    endDate: row.end_date,
    estimatedHours: Number(row.estimated_hours),
    hoursWorked: Number(row.hours_worked),
    status: row.status as TaskStatus,
    attachments: [],
  };
}

// --- Hooks ---
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchProjects = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setTimeout(() => fetchProjects(false), 5000);
    } else if (data) {
      setProjects((data as unknown as DbProject[]).map(mapProject));
    }
    if (isInitial) setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchProjects(true);

    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const setupChannel = () => {
      const name = `projects-changes-${Math.random().toString(36).slice(2)}`;
      const channel = supabase
        .channel(name)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "projects" },
          () => { fetchProjects(false); }
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            try { supabase.removeChannel(channel); } catch (_) {}
            reconnectTimeout = setTimeout(() => {
              if (!cancelled) channelRef.current = setupChannel();
            }, 3000);
          }
        });
      channelRef.current = channel;
      return channel;
    };

    setupChannel();

    const interval = setInterval(() => fetchProjects(false), 60000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchProjects(false);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      try { if (channelRef.current) supabase.removeChannel(channelRef.current); } catch (_) {}
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchProjects]);

  return { projects, loading, refetch: fetchProjects, setProjects };
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchTasks = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) {
      setTimeout(() => fetchTasks(false), 5000);
    } else if (data) {
      setTasks((data as unknown as DbTask[]).map(mapTask));
    }
    if (isInitial) setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchTasks(true);

    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const setupChannel = () => {
      const name = `tasks-changes-${Math.random().toString(36).slice(2)}`;
      const channel = supabase
        .channel(name)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tasks" },
          () => { fetchTasks(false); }
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            try { supabase.removeChannel(channel); } catch (_) {}
            reconnectTimeout = setTimeout(() => {
              if (!cancelled) channelRef.current = setupChannel();
            }, 3000);
          }
        });
      channelRef.current = channel;
      return channel;
    };

    setupChannel();

    const interval = setInterval(() => fetchTasks(false), 60000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchTasks(false);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      try { if (channelRef.current) supabase.removeChannel(channelRef.current); } catch (_) {}
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchTasks]);

  return { tasks, loading, refetch: fetchTasks, setTasks };
}

export function useTimeEntries(taskId?: string, projectId?: string) {
  const [entries, setEntries] = useState<DbTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchEntries = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    let query = supabase.from("time_entries").select("*").order("created_at", { ascending: false });
    if (taskId) query = query.eq("task_id", taskId);
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (!error && data) {
      setEntries(data as unknown as DbTimeEntry[]);
    }
    if (isInitial) setLoading(false);
  }, [taskId, projectId]);

  useEffect(() => {
    let cancelled = false;
    fetchEntries(true);

    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const setupChannel = () => {
      const name = `time-entries-changes-${Math.random().toString(36).slice(2)}`;
      const channel = supabase
        .channel(name)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "time_entries" },
          () => { fetchEntries(false); }
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            try { supabase.removeChannel(channel); } catch (_) {}
            reconnectTimeout = setTimeout(() => {
              if (!cancelled) channelRef.current = setupChannel();
            }, 3000);
          }
        });
      channelRef.current = channel;
      return channel;
    };

    setupChannel();

    const interval = setInterval(() => fetchEntries(false), 60000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchEntries(false);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      try { if (channelRef.current) supabase.removeChannel(channelRef.current); } catch (_) {}
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchEntries]);

  return { entries, loading, refetch: fetchEntries };
}

export function useActiveProfiles() {
  const [profiles, setProfiles] = useState<DbProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("status", "active")
      .order("name")
      .then(({ data }) => {
        if (data) setProfiles(data as unknown as DbProfile[]);
        setLoading(false);
      });
  }, []);

  return { profiles, loading };
}

// Helper to get a profile by ID from a list
export function getProfileById(profiles: DbProfile[], id: string) {
  return profiles.find(p => p.id === id);
}
