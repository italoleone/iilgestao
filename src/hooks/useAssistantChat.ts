import { useEffect } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage } from "@/lib/assistant";

const PAGE = 100;
type Cursor = { created_at: string; id: string } | null;
export function useAssistantChat(userId: string | undefined) {
  const client = useQueryClient();
  const messages = useInfiniteQuery({
    queryKey: ["assistant-chat", userId], enabled: !!userId,
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      if (!userId) return { rows: [] as ChatMessage[], hasMore: false };
      let q = supabase.from("chat_messages").select("*").eq("user_id", userId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE + 1);
      if (pageParam) q = q.or(`created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`);
      const { data, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []).slice(0, PAGE), hasMore: (data?.length ?? 0) > PAGE };
    },
    getNextPageParam: page => {
      const last = page.rows.at(-1);
      return page.hasMore && last ? { created_at: last.created_at, id: last.id } : undefined;
    },
    refetchInterval: 60000, refetchOnWindowFocus: true, staleTime: 10000,
  });
  const unread = useQuery({
    queryKey: ["assistant-unread", userId], enabled: !!userId,
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("sender", "agente").is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    }, refetchInterval: 60000, refetchOnWindowFocus: true, staleTime: 10000,
  });
  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let connected = false;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (disposed) return;
        void client.invalidateQueries({ queryKey: ["assistant-chat", userId] });
        void client.invalidateQueries({ queryKey: ["assistant-unread", userId] });
      }, 250);
    };
    const connect = () => {
      const current = supabase.channel(`assistant-${userId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `user_id=eq.${userId}` }, refresh)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `user_id=eq.${userId}` }, refresh)
        .subscribe(status => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            const state = client.getQueryState(["assistant-chat", userId]);
            if (connected || (state && Date.now() - state.dataUpdatedAt > 10000 && state.fetchStatus !== "fetching")) refresh();
            connected = true;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            clearTimeout(reconnect);
            reconnect = setTimeout(() => {
              if (!disposed) { void supabase.removeChannel(current); connect(); }
            }, 5000);
          }
        });
      channel = current;
    };
    const visibility = () => { if (document.visibilityState === "visible") refresh(); };
    connect();
    document.addEventListener("visibilitychange", visibility);
    return () => { disposed = true; clearTimeout(timer); clearTimeout(reconnect); if (channel) void supabase.removeChannel(channel); document.removeEventListener("visibilitychange", visibility); };
  }, [userId, client]);
  return { messages, unread };
}