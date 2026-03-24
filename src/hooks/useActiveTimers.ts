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

  const fetchTimers = useCallback(async () => {
    const { data } = await supabase
      .from("active_timers")
      .select("*");
    if (data) setActiveTimers(data as unknown as ActiveTimer[]);
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTimers]);

  return { activeTimers, refetch: fetchTimers };
}

export async function startActiveTimer(taskId: string, projectId: string, userId: string, userName: string) {
  // Delete any existing timer for this user first
  await supabase.from("active_timers").delete().eq("user_id", userId);
  await supabase.from("active_timers").insert({
    task_id: taskId,
    project_id: projectId,
    user_id: userId,
    user_name: userName,
  });
}

export async function stopActiveTimer(userId: string) {
  await supabase.from("active_timers").delete().eq("user_id", userId);
}

export function getTimerForTask(activeTimers: ActiveTimer[], taskId: string): ActiveTimer[] {
  return activeTimers.filter(t => t.task_id === taskId);
}
