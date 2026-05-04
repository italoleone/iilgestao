import { useState, useEffect, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  FileUp,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  FileText,
  Send,
  MessageSquare,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  taskId: string;
  isResponsible: boolean;
  isCoordinator: boolean;
}

interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  created_at: string;
}

interface ReviewComment {
  id: string;
  user_id: string;
  user_name: string;
  comment: string;
  page: number | null;
  created_at: string;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function TaskReviewFile({ taskId, isResponsible, isCoordinator }: Props) {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.0);

  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentPage, setCommentPage] = useState<string>("");
  const [posting, setPosting] = useState(false);

  const role = profile?.role || "";
  const canComment = isCoordinator || isResponsible || role === "admin_geral" || role === "admin";

  // Load attachment
  const loadAttachment = useCallback(async () => {
    const { data } = await supabase
      .from("task_attachments")
      .select("id, file_path, file_name, uploaded_by, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const { data: prof } = await supabase
        .from("profiles").select("name").eq("id", data.uploaded_by).maybeSingle();
      const att: Attachment = { ...(data as any), uploaded_by_name: prof?.name };
      setAttachment(att);
      const { data: signed } = await supabase.storage
        .from("task-files")
        .createSignedUrl(data.file_path, 3600);
      setPdfUrl(signed?.signedUrl || null);
    } else {
      setAttachment(null);
      setPdfUrl(null);
    }
  }, [taskId]);

  // Load comments
  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from("task_review_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    if (data) setComments(data as ReviewComment[]);
  }, [taskId]);

  useEffect(() => { loadAttachment(); loadComments(); }, [loadAttachment, loadComments]);

  useEffect(() => {
    const ch = supabase.channel(`review-${taskId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_review_comments", filter: `task_id=eq.${taskId}` }, () => loadComments())
      .on("postgres_changes", { event: "*", schema: "public", table: "task_attachments", filter: `task_id=eq.${taskId}` }, () => loadAttachment())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId, loadComments, loadAttachment]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Apenas arquivos PDF são aceitos.");
      return;
    }
    setUploading(true);
    try {
      const path = `${taskId}/review.pdf`;
      const { error: upErr } = await supabase.storage
        .from("task-files")
        .upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;

      // Remove previous DB rows for this task and insert a fresh one
      await supabase.from("task_attachments").delete().eq("task_id", taskId);
      const { error: insErr } = await supabase.from("task_attachments").insert({
        task_id: taskId,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        sheet_title: "Arquivo para Revisão",
        uploaded_by: profile.id,
      });
      if (insErr) throw insErr;

      toast.success("PDF enviado com sucesso!");
      setPage(1);
      await loadAttachment();
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !profile) return;
    setPosting(true);
    const { error } = await supabase.from("task_review_comments").insert({
      task_id: taskId,
      user_id: profile.id,
      user_name: profile.name || "",
      comment: newComment.trim(),
      page: commentPage ? Number(commentPage) : null,
    });
    setPosting(false);
    if (error) { toast.error("Erro ao comentar: " + error.message); return; }
    setNewComment("");
    setCommentPage("");
    loadComments();
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> Arquivo para Revisão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload section - only responsible */}
        {isResponsible && (
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {attachment ? "Substituir PDF" : "Enviar PDF para Revisão"}
            </Button>
            {attachment && (
              <span className="text-xs text-muted-foreground">
                {attachment.file_name} • {fmtDateTime(attachment.created_at)} • {attachment.uploaded_by_name || "—"}
              </span>
            )}
          </div>
        )}
        {!isResponsible && attachment && (
          <div className="text-xs text-muted-foreground">
            {attachment.file_name} • Enviado em {fmtDateTime(attachment.created_at)} por {attachment.uploaded_by_name || "—"}
          </div>
        )}

        {/* Viewer */}
        {pdfUrl ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs tabular-nums px-1">
                  {page} / {numPages || "—"}
                </span>
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => setPage(p => Math.min(numPages || p, p + 1))} disabled={page >= numPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs tabular-nums px-1">{Math.round(scale * 100)}%</span>
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => setScale(s => Math.min(3, s + 0.2))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="h-[600px] overflow-auto bg-muted/10 flex justify-center p-2">
              <Document
                file={pdfUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div className="py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
                error={<p className="text-sm text-destructive py-10">Erro ao carregar PDF.</p>}
              >
                <Page pageNumber={page} scale={scale} renderAnnotationLayer={false} renderTextLayer={false} />
              </Document>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            {isResponsible ? "Nenhum PDF enviado ainda." : "Aguardando envio do arquivo pelo projetista."}
          </p>
        )}

        {/* Comments */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4" /> Comentários de Revisão
            <Badge variant="secondary" className="ml-1 text-xs">{comments.length}</Badge>
          </div>

          {canComment && (
            <div className="space-y-2">
              <Textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Escreva um comentário de revisão..."
                rows={2}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="Página (opcional)"
                  value={commentPage}
                  onChange={e => setCommentPage(e.target.value)}
                  className="w-40 h-9"
                />
                <Button size="sm" onClick={handlePostComment} disabled={!newComment.trim() || posting} className="gap-1.5">
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Comentar
                </Button>
              </div>
            </div>
          )}

          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Nenhum comentário ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {comments.map(c => (
                <div key={c.id} className="p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{c.user_name}</span>
                    <div className="flex items-center gap-2">
                      {c.page && <Badge variant="outline" className="text-[10px]">Pág. {c.page}</Badge>}
                      <span className="text-[11px] text-muted-foreground">{fmtDateTime(c.created_at)}</span>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
