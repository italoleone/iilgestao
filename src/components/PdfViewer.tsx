import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Type,
  Pencil,
  ArrowUpRight,
  Highlighter,
  Save,
  Trash2,
  X,
  Loader2,
  MessageSquare,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type AnnotationTool = "none" | "text" | "draw" | "arrow" | "highlight";

interface Annotation {
  id: string;
  tool: AnnotationTool;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  points?: { x: number; y: number }[];
  endX?: number;
  endY?: number;
  color: string;
  userName: string;
  createdAt: string;
}

interface PdfViewerProps {
  fileUrl: string;
  attachmentId: string;
  taskId: string;
  fileName: string;
  sheetTitle: string;
  onClose: () => void;
}

const TOOL_COLORS: Record<AnnotationTool, string> = {
  none: "#000",
  text: "#ef4444",
  draw: "#3b82f6",
  arrow: "#f97316",
  highlight: "#facc15",
};

export function PdfViewer({ fileUrl, attachmentId, taskId, fileName, sheetTitle, onClose }: PdfViewerProps) {
  const { profile } = useAuth();
  const canAnnotate = profile?.role === "admin_geral" || profile?.role === "admin" || profile?.role === "planejamento";

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("none");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [currentDraw, setCurrentDraw] = useState<{ x: number; y: number }[]>([]);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);
  const [highlightStart, setHighlightStart] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Load annotations
  useEffect(() => {
    const loadAnnotations = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("pdf_annotations")
        .select("*")
        .eq("attachment_id", attachmentId);
      if (data && data.length > 0) {
        const allAnnotations: Annotation[] = [];
        data.forEach((row: any) => {
          const parsed = row.annotation_data as Annotation[];
          if (Array.isArray(parsed)) {
            allAnnotations.push(...parsed);
          }
        });
        setAnnotations(allAnnotations);
      }
      setLoading(false);
    };
    loadAnnotations();
  }, [attachmentId]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    // Delete existing annotations for this user+attachment
    await supabase
      .from("pdf_annotations")
      .delete()
      .eq("attachment_id", attachmentId)
      .eq("user_id", profile.id);

    const myAnnotations = annotations.filter((a) => a.userName === profile.name);
    if (myAnnotations.length > 0) {
      await supabase.from("pdf_annotations").insert({
        attachment_id: attachmentId,
        task_id: taskId,
        user_id: profile.id,
        user_name: profile.name,
        annotation_data: myAnnotations as any,
      });
    }

    setSaving(false);
    toast.success("Anotações salvas com sucesso!");
  };

  const getRelativePos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!canAnnotate || activeTool === "none") return;
    const pos = getRelativePos(e);

    if (activeTool === "text") {
      setTextInput({ x: pos.x, y: pos.y, value: "" });
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!canAnnotate) return;
    const pos = getRelativePos(e);

    if (activeTool === "draw") {
      setDrawing(true);
      setCurrentDraw([pos]);
    } else if (activeTool === "arrow") {
      setArrowStart(pos);
    } else if (activeTool === "highlight") {
      setHighlightStart(pos);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!canAnnotate) return;
    const pos = getRelativePos(e);
    if (activeTool === "draw" && drawing) {
      setCurrentDraw((prev) => [...prev, pos]);
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (!canAnnotate || !profile) return;
    const pos = getRelativePos(e);

    if (activeTool === "draw" && drawing && currentDraw.length > 1) {
      setAnnotations((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          tool: "draw",
          page: currentPage,
          x: 0, y: 0,
          points: currentDraw,
          color: TOOL_COLORS.draw,
          userName: profile.name,
          createdAt: new Date().toISOString(),
        },
      ]);
      setDrawing(false);
      setCurrentDraw([]);
    } else if (activeTool === "arrow" && arrowStart) {
      setAnnotations((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          tool: "arrow",
          page: currentPage,
          x: arrowStart.x, y: arrowStart.y,
          endX: pos.x, endY: pos.y,
          color: TOOL_COLORS.arrow,
          userName: profile.name,
          createdAt: new Date().toISOString(),
        },
      ]);
      setArrowStart(null);
    } else if (activeTool === "highlight" && highlightStart) {
      const w = pos.x - highlightStart.x;
      const h = pos.y - highlightStart.y;
      if (Math.abs(w) > 5 && Math.abs(h) > 5) {
        setAnnotations((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            tool: "highlight",
            page: currentPage,
            x: Math.min(highlightStart.x, pos.x),
            y: Math.min(highlightStart.y, pos.y),
            width: Math.abs(w),
            height: Math.abs(h),
            color: TOOL_COLORS.highlight,
            userName: profile.name,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      setHighlightStart(null);
    }
  };

  const confirmText = () => {
    if (!textInput || !textInput.value.trim() || !profile) return;
    setAnnotations((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        tool: "text",
        page: currentPage,
        x: textInput.x,
        y: textInput.y,
        text: textInput.value.trim(),
        color: TOOL_COLORS.text,
        userName: profile.name,
        createdAt: new Date().toISOString(),
      },
    ]);
    setTextInput(null);
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  };

  const pageAnnotations = annotations.filter((a) => a.page === currentPage);

  const tools: { tool: AnnotationTool; icon: any; label: string }[] = [
    { tool: "text", icon: Type, label: "Texto" },
    { tool: "draw", icon: Pencil, label: "Desenho" },
    { tool: "arrow", icon: ArrowUpRight, label: "Seta" },
    { tool: "highlight", icon: Highlighter, label: "Destaque" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{sheetTitle}</p>
            <p className="text-xs text-muted-foreground truncate">{fileName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pagination */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono tabular-nums px-2">
              {currentPage} / {numPages || "?"}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= numPages} onClick={() => setCurrentPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1 ml-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono tabular-nums w-12 text-center">{Math.round(scale * 100)}%</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {canAnnotate && (
            <Button variant="default" size="sm" className="gap-1.5 ml-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Salvar Anotações
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {canAnnotate && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <span className="text-xs text-muted-foreground mr-2">Ferramentas:</span>
          {tools.map(({ tool, icon: Icon, label }) => (
            <Button
              key={tool}
              variant={activeTool === tool ? "default" : "outline"}
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => setActiveTool(activeTool === tool ? "none" : tool)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
          <Badge variant="secondary" className="ml-auto text-xs gap-1">
            <MessageSquare className="h-3 w-3" />
            {annotations.length} anotação(ões)
          </Badge>
        </div>
      )}

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex justify-center bg-muted/20 p-4">
        <div
          ref={canvasRef}
          className="relative"
          style={{ cursor: activeTool !== "none" ? "crosshair" : "default" }}
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        >
          {pdfLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPdfLoading(false); }}
            onLoadError={() => { setPdfLoading(false); toast.error("Erro ao carregar PDF."); }}
            loading={null}
          >
            <Page pageNumber={currentPage} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
          </Document>

          {/* Render annotations overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
            {pageAnnotations.map((ann) => {
              if (ann.tool === "draw" && ann.points && ann.points.length > 1) {
                const d = ann.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                return <path key={ann.id} d={d} stroke={ann.color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
              }
              if (ann.tool === "arrow" && ann.endX !== undefined && ann.endY !== undefined) {
                const dx = ann.endX - ann.x;
                const dy = ann.endY - ann.y;
                const angle = Math.atan2(dy, dx);
                const headLen = 12;
                return (
                  <g key={ann.id}>
                    <line x1={ann.x} y1={ann.y} x2={ann.endX} y2={ann.endY} stroke={ann.color} strokeWidth={2.5} />
                    <polygon
                      points={`${ann.endX},${ann.endY} ${ann.endX - headLen * Math.cos(angle - 0.4)},${ann.endY - headLen * Math.sin(angle - 0.4)} ${ann.endX - headLen * Math.cos(angle + 0.4)},${ann.endY - headLen * Math.sin(angle + 0.4)}`}
                      fill={ann.color}
                    />
                  </g>
                );
              }
              if (ann.tool === "highlight" && ann.width && ann.height) {
                return <rect key={ann.id} x={ann.x} y={ann.y} width={ann.width} height={ann.height} fill={ann.color} opacity={0.3} />;
              }
              return null;
            })}

            {/* Current drawing preview */}
            {drawing && currentDraw.length > 1 && (
              <path
                d={currentDraw.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
                stroke={TOOL_COLORS.draw}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                opacity={0.6}
              />
            )}
          </svg>

          {/* Text annotations */}
          {pageAnnotations
            .filter((a) => a.tool === "text")
            .map((ann) => (
              <div
                key={ann.id}
                className="absolute flex items-start gap-1 pointer-events-auto group"
                style={{ left: ann.x, top: ann.y, zIndex: 20 }}
              >
                <div className="bg-destructive/90 text-destructive-foreground rounded px-2 py-1 text-xs max-w-[200px] shadow-md">
                  <p className="font-medium">{ann.text}</p>
                  <p className="text-[10px] opacity-80 mt-0.5">{ann.userName}</p>
                </div>
                {canAnnotate && ann.userName === profile?.name && (
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 bg-destructive rounded-full flex items-center justify-center"
                    onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                )}
              </div>
            ))}

          {/* Text input popup */}
          {textInput && (
            <div
              className="absolute z-30 bg-card border rounded-lg shadow-lg p-2 flex gap-2"
              style={{ left: textInput.x, top: textInput.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                value={textInput.value}
                onChange={(e) => setTextInput((prev) => prev ? { ...prev, value: e.target.value } : null)}
                placeholder="Comentário..."
                className="h-8 text-sm w-48"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") confirmText(); if (e.key === "Escape") setTextInput(null); }}
              />
              <Button size="sm" className="h-8" onClick={confirmText} disabled={!textInput.value.trim()}>
                OK
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setTextInput(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Annotations sidebar at bottom */}
      {annotations.length > 0 && (
        <div className="border-t bg-card p-3 max-h-40 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Anotações nesta página ({pageAnnotations.length})</p>
          <div className="flex flex-wrap gap-2">
            {pageAnnotations.map((ann) => (
              <div key={ann.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ann.color }} />
                <span className="font-medium">{ann.tool === "text" ? ann.text : ann.tool === "draw" ? "Desenho" : ann.tool === "arrow" ? "Seta" : "Destaque"}</span>
                <span className="text-muted-foreground">– {ann.userName}</span>
                {canAnnotate && ann.userName === profile?.name && (
                  <button onClick={() => deleteAnnotation(ann.id)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
