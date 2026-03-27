import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveTimer {
  id: string;
  task_id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  started_at: string;
}

export function useActiveTimers() {
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchTimers = useCallback(async () => {
    const { data } = await supabase
      .from("active_timers")
      .select("*");
    if (data) setActiveTimers(data as unknown as ActiveTimer[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchTimers();

    const channel = supabase
      .channel("active_timers_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_timers" },
        () => {
          fetchTimers();
        }
      )
      .subscribe();

    // Poll every 30s as fallback for realtime issues
    const poll = setInterval(fetchTimers, 30000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [fetchTimers]);

  return { activeTimers, loaded, refetch: fetchTimers };
}

/**
 * Start a timer using atomic backend function.
 * Automatically stops any existing timer for the user (saving time entry).
 * Updates task status to em_andamento if needed.
 */
export async function startActiveTimer(taskId: string, projectId: string, _userId?: string, _userName?: string) {
  const { error } = await supabase.rpc("fn_start_timer", {
    _task_id: taskId,
    _project_id: projectId,
  });
  if (error) {
    console.error("Error starting timer:", error);
    throw error;
  }
}

/**
 * Stop the current user's timer using atomic backend function.
 * Calculates duration server-side, creates time entry, updates task hours.
 * Returns info about the stopped timer.
 */
export async function stopActiveTimer(_userId?: string): Promise<{
  stopped: boolean;
  task_id?: string;
  duration_minutes?: number;
  new_hours_worked?: number;
}> {
  const { data, error } = await supabase.rpc("fn_stop_timer");
  if (error) {
    console.error("Error stopping timer:", error);
    throw error;
  }
  return data as any || { stopped: false };
}

export function getTimerForTask(activeTimers: ActiveTimer[], taskId: string): ActiveTimer[] {
  return activeTimers.filter(t => t.task_id === taskId);
}
