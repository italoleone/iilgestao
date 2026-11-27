import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link, useNavigate } from "react-router-dom";
import { MessageSquare, Send, X, ArrowUp, ExternalLink, Loader2, Bot } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import { supabase } from "@/integrations/supabase/client";
import { callAssistant, callChatPedido, messageActions, timestampBR, type MessageActionId, type ChatMessage } from "@/lib/assistant";
import { chatSendAction } from "@/lib/demandRequests";
import { encodeDraft, isPedido, mentionsToPlain, splitMentions, type Mention } from "@/lib/mentions";
import { MentionPicker, activeMentionQuery, filterMentionOptions, useMentionOptions } from "./MentionPicker";
import { cn } from "@/lib/utils";

export async function callChatAssistant(body: { action: "reply" } | { action: "decide"; message_id: string; choice: "aprovar" | "recusar" }) {
  const delays = [4000, 8000, 12000];
  for (let attempt = 0; ; attempt++) {
    try { return await callAssistant(body); }
    catch (e) {
      const isExecutionLock = e instanceof Error && "status" in e && e.status === 409
        && /execução do assistente já começou|aguarde a conclusão/i.test(e.message);
      const delay = delays[attempt];
      if (!isExecutionLock || delay === undefined) throw e;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

const chip = "mx-0.5 inline-flex items-center rounded-full bg-accent/20 px-2 py-0.5 align-baseline text-xs font-semibold";
function MessageBody({ body, onProject }: { body: string; onProject: (id: string) => void }) {
  return <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed">{splitMentions(body).map((piece, i) => typeof piece !== "string"
    ? piece.type === "p"
      ? <button key={i} type="button" className={cn(chip, "hover:bg-accent/40")} onClick={() => onProject(piece.id)}>@{piece.name}</button>
      : <span key={i} className={chip}>@{piece.name}</span>
    : piece.split(/(\*\*[^*]+\*\*)/g).map((part, j) => part.startsWith("**") && part.endsWith("**") ? <strong key={`${i}-${j}`}>{part.slice(2, -2)}</strong> : part))}</p>;
}

export function AssistantChat() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { messages, unread } = useAssistantChat(profile?.id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryReply, setRetryReply] = useState(false);
  const [picks, setPicks] = useState<Mention[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ id: string; project: string } | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const mentionData = useMentionOptions(open);
  const options = useMemo(() => mention ? filterMentionOptions(mentionData.data, mention.query, profile?.id) : [], [mention, mentionData.data, profile?.id]);
  const openProject = (id: string) => { setOpen(false); navigate(`/projetos/${id}`); };
  const updateMention = (text: string, caret: number) => { const m = activeMentionQuery(text, caret); setMention(m); if (m?.query !== mention?.query) setHighlighted(0); };
  const pick = (o: Mention) => {
    if (!mention) return;
    const caret = input.current?.selectionStart ?? draft.length;
    const label = `@${o.name.replace(/[|\]\[]/g, " ").replace(/\s+/g, " ").trim()} `;
    const next = draft.slice(0, mention.start) + label + draft.slice(caret);
    setDraft(next); setPicks(p => [...p.filter(x => !(x.type === o.type && x.id === o.id)), o]); setMention(null);
    requestAnimationFrame(() => { const el = input.current; if (el) { el.focus(); const pos = mention.start + label.length; el.setSelectionRange(pos, pos); } });
  };
  const viewport = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const reading = useRef(false);
  const latestKnown = useRef<string | null>(null);
  const nearBottom = useRef(true);
  const rows = useMemo(() => {
    const map = new Map((messages.data?.pages.flatMap(p => p.rows) ?? []).map(m => [m.id, m]));
    return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  }, [messages.data]);
  useEffect(() => { setOpen(false); setDraft(""); setReplyingTo(null); setError(null); latestKnown.current = null; }, [profile?.id]);
  useEffect(() => {
    if (!open) return;
    nearBottom.current = true;
    const frame = requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: "end" }));
    return () => cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => {
    const latest = rows.at(-1);
    if (!latest) return;
    if (latestKnown.current && latestKnown.current !== latest.id && latest.sender === "agente" && !open && !latest.read_at) {
      toast.custom(id => <Button variant="outline" className="h-auto w-full max-w-sm flex-col items-start gap-1 whitespace-normal bg-popover p-4 text-left shadow-lg" onClick={() => { setOpen(true); toast.dismiss(id); }}>
        <span className="flex items-center gap-2 font-semibold"><Bot className="h-4 w-4" /> Assistente Leone: nova mensagem</span>
        <span className="line-clamp-2 text-xs text-muted-foreground break-words">{mentionsToPlain(latest.body).replace(/\*\*/g, "").slice(0, 180)}</span>
      </Button>, { id: `assistant-message-${latest.id}`, duration: 8000, position: "bottom-right", style: { bottom: "80px" } });
    }
    latestKnown.current = latest.id;
    if (open && nearBottom.current) bottom.current?.scrollIntoView({ block: "end" });
  }, [rows, open]);
  useEffect(() => {
    if (!open || !profile?.id || !unread.data || reading.current) return;
    reading.current = true;
    void (async () => {
      const { error: readError } = await supabase.from("chat_messages").update({ read_at: new Date().toISOString() }).eq("user_id", profile.id).eq("sender", "agente").is("read_at", null);
      if (readError) setError("Não foi possível marcar as mensagens como lidas.");
      else { await unread.refetch(); }
      reading.current = false;
    })();
  }, [open, profile?.id, unread.data]);
  const processReply = async () => {
    setSending(true); setError(null);
    try { await callChatAssistant({ action: "reply" }); setRetryReply(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível tratar a resposta."); setRetryReply(true); }
    finally {
      await Promise.all([messages.refetch(), unread.refetch(), queryClient.invalidateQueries({ queryKey: ["agent-followups"] }), queryClient.invalidateQueries({ queryKey: ["task-delay-reasons"] })]);
      setSending(false);
    }
  };
  const send = async () => {
    const body = draft.trim();
    if (!profile || !body || body.length > 10000 || sending) return;
    setSending(true); setError(null); setMention(null);
    const encoded = encodeDraft(body, picks);
    if (chatSendAction(encoded, replyingTo?.id ?? null) === "responder_pedido" && replyingTo) {
      try {
        await callChatPedido({ action: "responder_pedido", demand_id: replyingTo.id, texto: encoded });
        setDraft(""); setPicks([]); setReplyingTo(null); nearBottom.current = true;
        await queryClient.invalidateQueries({ queryKey: ["demand-conversation"] });
      } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar a resposta."); }
      finally { await Promise.all([messages.refetch(), unread.refetch()]); setSending(false); }
      return;
    }
    if (isPedido(encoded)) {
      try { await callChatPedido({ action: "pedido", body: encoded }); setDraft(""); setPicks([]); nearBottom.current = true; }
      catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar o pedido."); }
      finally { await Promise.all([messages.refetch(), unread.refetch()  ]); setSending(false); }
      return;
    }
    const { error: insertError } = await supabase.from("chat_messages").insert({ user_id: profile.id, sender: "usuario", body: encoded });
    if (insertError) { setError(insertError.message); setSending(false); return; }
    setDraft(""); setPicks([]); nearBottom.current = true;
    await messages.refetch();
    await processReply();
  };
  const decide = async (message: ChatMessage, choice: MessageActionId) => {
    if (choice === "responder_pedido") {
      if (!message.demand_id) return;
      const project = splitMentions(message.body).find(p => typeof p !== "string" && p.type === "p");
      setReplyingTo({ id: message.demand_id, project: typeof project === "object" ? project.name : "projeto" });
      setError(null); setRetryReply(false); input.current?.focus();
      return;
    }
    const messageId = message.id;
    if (deciding) return;
    setDeciding(messageId); setError(null);
    try {
      if (choice === "concluir_pedido" || choice === "ja_feito") await callChatPedido({ action: choice, message_id: messageId });
      else await callChatAssistant({ action: "decide", message_id: messageId, choice });
    }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível registrar a decisão."); }
    finally {
      await Promise.all([messages.refetch(), queryClient.invalidateQueries({ queryKey: ["agent-followups"] }), queryClient.invalidateQueries({ queryKey: ["task-delay-reasons"] })]);
      setDeciding(null);
    }
  };
  if (!profile) return null;
  return <>
    {!open && <Button size="icon" className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:bg-accent/90" aria-label="Abrir Assistente Leone" title="Assistente Leone" onClick={() => { nearBottom.current = true; setOpen(true); }}>
      <MessageSquare className="h-6 w-6" />
      {(unread.data ?? 0) > 0 && <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-destructive px-1 text-xs font-semibold text-destructive-foreground" aria-label={`${unread.data} mensagens não lidas`}>{(unread.data ?? 0) > 99 ? "99+" : unread.data}</span>}
    </Button>}
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content aria-describedby={undefined} onEscapeKeyDown={e => { if (mention) { e.preventDefault(); setMention(null); } }} onInteractOutside={e => e.preventDefault()} className="fixed inset-0 z-50 flex h-dvh min-h-0 w-full flex-col border border-border bg-card text-card-foreground shadow-xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[560px] sm:max-h-[calc(100dvh-48px)] sm:w-[380px] sm:max-w-[calc(100vw-32px)] sm:rounded-lg">
          <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-base tracking-normal"><Bot className="h-5 w-5 text-muted-foreground" /> Assistente Leone</DialogTitle>
            <Button variant="ghost" size="icon" aria-label="Fechar Assistente Leone" onClick={() => setOpen(false)}><X /></Button>
          </header>
          <div ref={viewport} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" onScroll={() => { const el = viewport.current; if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
            {messages.hasNextPage && <Button variant="ghost" className="mb-4 w-full text-xs" disabled={messages.isFetchingNextPage} onClick={async () => {
              const el = viewport.current; const before = el?.scrollHeight ?? 0; const top = el?.scrollTop ?? 0;
              nearBottom.current = false; await messages.fetchNextPage();
              requestAnimationFrame(() => { if (el) el.scrollTop = top + el.scrollHeight - before; });
            }}><ArrowUp />{messages.isFetchingNextPage ? "Carregando…" : "Carregar anteriores"}</Button>}
            {messages.isPending && <p className="text-center text-sm text-muted-foreground">Carregando conversa…</p>}
            {messages.error && <div className="space-y-2 text-sm text-destructive"><p>Não foi possível carregar a conversa.</p><Button variant="outline" size="sm" onClick={() => void messages.refetch()}>Tentar novamente</Button></div>}
            {!messages.isPending && !messages.error && rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem no momento.</p>}
            <div className="space-y-4" role="log" aria-label="Mensagens do Assistente Leone">
              {rows.map(m => <article key={m.id} className={cn("flex", m.sender === "usuario" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[90%] min-w-0 rounded-lg px-3 py-2.5", m.sender === "usuario" ? "bg-primary text-primary-foreground" : "border bg-muted text-foreground")}>
                  <MessageBody body={m.body} onProject={openProject} />
                  {m.task_id && m.kind === "cobranca" && <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0 text-xs"><Link to={`/tarefas/${m.task_id}`} onClick={() => setOpen(false)}>Abrir tarefa <ExternalLink className="h-3 w-3" /></Link></Button>}
                  {messageActions(m.actions).length > 0 && <div className="mt-3 flex flex-wrap gap-2">
                    {messageActions(m.actions).map(a => <Button key={a.id} variant={a.id === "recusar" || a.id === "responder_pedido" ? "outline" : "default"} size="sm" className="h-auto min-h-9 whitespace-normal text-xs" disabled={(a.id !== "responder_pedido" && !!m.action_taken) || !!deciding} onClick={() => void decide(m, a.id)}>{deciding === m.id && <Loader2 className="h-3 w-3 animate-spin" />}{a.label}</Button>)}
                    {m.action_taken && <p className="w-full text-xs font-medium">{m.action_taken === "aprovar" ? "Aprovado" : m.action_taken === "concluir_pedido" ? "Concluído" : m.action_taken === "ja_feito" ? "Já estava feito" : "Recusado"}</p>}
                  </div>}
                  <time dateTime={m.created_at} className={cn("mt-1.5 block text-right text-[10px]", m.sender === "usuario" ? "text-primary-foreground/70" : "text-muted-foreground")}>{timestampBR(m.created_at)}</time>
                </div>
              </article>)}
            </div>
            {sending && <p className="pt-3 text-xs text-muted-foreground" role="status">Assistente digitando…</p>}
            <div ref={bottom} />
          </div>
          {error && <div className="shrink-0 border-t px-4 py-2 text-xs text-destructive" role="alert"><p className="break-words">{error}</p>{retryReply && <Button variant="link" size="sm" disabled={sending} className="px-0 text-xs" onClick={() => void processReply()}>Tentar tratar a resposta novamente</Button>}</div>}
          {replyingTo && <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-muted px-3 py-2"><p className="min-w-0 break-words text-xs">Respondendo ao pedido sobre @{replyingTo.project}</p><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Cancelar resposta" onClick={() => setReplyingTo(null)}><X className="h-4 w-4" /></Button></div>}
          <form className="relative flex shrink-0 items-end gap-2 border-t bg-card p-3" onSubmit={e => { e.preventDefault(); void send(); }}>
            {mention && <MentionPicker options={options} highlighted={highlighted} onHover={setHighlighted} onPick={pick} />}
            <Textarea ref={input} aria-label="Mensagem para o Assistente Leone" placeholder="Mensagem… (use @ para citar projeto ou pessoa)" maxLength={10000} value={draft}
              onChange={e => { setDraft(e.target.value); updateMention(e.target.value, e.target.selectionStart); }}
              onClick={e => updateMention(e.currentTarget.value, e.currentTarget.selectionStart)}
              onBlur={() => setTimeout(() => setMention(null), 150)}
              onKeyDown={e => {
                if (!mention) return;
                if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setMention(null); }
                else if (options.length && e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => (h + 1) % options.length); }
                else if (options.length && e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => (h - 1 + options.length) % options.length); }
                else if (options.length && (e.key === "Enter" || e.key === "Tab")) { e.preventDefault(); pick(options[highlighted] ?? options[0]); }
              }} className="max-h-28 min-h-10 resize-none" rows={2} disabled={sending} />
            <Button type="submit" size="icon" aria-label="Enviar mensagem" title="Enviar" disabled={sending || !draft.trim()}><Send /></Button>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  </>;
}
