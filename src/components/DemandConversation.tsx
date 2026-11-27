import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { callChatPedido, timestampBR } from "@/lib/assistant";
import { mentionsToPlain } from "@/lib/mentions";

type ConversationDemand = { id: string; created_by: string; assigned_to: string | null; description: string; created_at: string; source?: string; source_message_id?: string | null };
type Comment = { id: string; author_id: string; body: string; kind: string; created_at: string };
export function DemandConversation({ demand, count, projectName, personName, onChanged }: {
  demand: ConversationDemand; count: number; projectName: string; personName: (id: string) => string; onChanged: () => void;
}) {
  const { profile } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const participant = profile?.id === demand.created_by || profile?.id === demand.assigned_to;
  const history = useQuery({
    queryKey: ["demand-conversation", demand.id], enabled: open,
    queryFn: async () => {
      const [comments, original] = await Promise.all([
        fetchAllRows<Comment>(() => supabase.from("demand_comments").select("id,author_id,body,kind,created_at").eq("demand_id", demand.id).order("created_at")),
        demand.source_message_id ? supabase.from("chat_messages").select("body").eq("id", demand.source_message_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return { comments, original: original.data?.body };
    }, refetchOnWindowFocus: true, refetchInterval: open ? 60000 : false,
  });
  const send = async () => {
    if (!draft.trim() || sending || !participant) return;
    setSending(true); setError(null);
    try {
      await callChatPedido({ action: "responder_pedido", demand_id: demand.id, texto: draft.trim() });
      setDraft("");
      await history.refetch();
      await client.invalidateQueries({ queryKey: ["assistant-chat"] });
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar a resposta."); }
    finally { setSending(false); }
  };
  return <>
    <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-1 text-xs" onClick={() => setOpen(true)}><MessageSquare className="h-3.5 w-3.5" />Conversa ({count})</Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg" aria-describedby={undefined}>
        <SheetHeader className="pr-6"><SheetTitle>Conversa do pedido</SheetTitle><p className="break-words text-sm text-muted-foreground">{projectName}</p></SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-5" role="log" aria-label="Histórico do pedido">
          <article className="border-l-2 border-accent pl-3">
            <p className="text-sm font-semibold">Pedido por {personName(demand.created_by)}</p>
            <time className="text-xs text-muted-foreground">{timestampBR(demand.created_at)}</time>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{history.data?.original ? mentionsToPlain(history.data.original) : demand.description.replace(/^\[Pedido via chat\]\s*/, "")}</p>
          </article>
          {history.isPending && <p className="text-sm text-muted-foreground">Carregando conversa…</p>}
          {history.error && <p className="text-sm text-destructive">Não foi possível carregar o histórico.</p>}
          {history.data?.comments.map(c => <article key={c.id} className="border-l-2 border-border pl-3">
            <p className="text-sm font-semibold">{personName(c.author_id)}</p>
            <time className="text-xs text-muted-foreground">{timestampBR(c.created_at)}</time>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{mentionsToPlain(c.body)}</p>
          </article>)}
        </div>
        {participant && demand.source === "chat" && <form className="space-y-2 border-t pt-3" onSubmit={e => { e.preventDefault(); void send(); }}>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="flex items-end gap-2"><Textarea aria-label="Resposta ao pedido" value={draft} maxLength={10000} onChange={e => setDraft(e.target.value)} rows={3} disabled={sending} /><Button type="submit" size="icon" aria-label="Enviar resposta" disabled={sending || !draft.trim()}><Send className="h-4 w-4" /></Button></div>
        </form>}
      </SheetContent>
    </Sheet>
  </>;
}