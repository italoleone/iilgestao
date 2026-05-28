import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Play, FileText, Loader2, AlertCircle, Download, Users, Eye } from "lucide-react";
import { formatDateBR } from "@/lib/utils";
import { toast } from "sonner";

interface Meeting {
  id: string;
  project_id: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string | null;
  audio_path: string | null;
  transcription: string | null;
  minutes_text: string | null;
  processing_status: string;
  created_by: string;
  created_at: string;
  speaker_map: Record<string, string> | null;
  pdf_path: string | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  processando: { label: "Processando...", className: "bg-warning text-warning-foreground" },
  concluido: { label: "Concluído", className: "bg-success text-success-foreground" },
  erro: { label: "Erro", className: "bg-destructive text-destructive-foreground" },
  erro_ata: { label: "Erro na ata", className: "bg-destructive text-destructive-foreground" },
};

interface MeetingsListProps {
  projectId: string;
  refreshKey: number;
}

export function MeetingsList({ projectId, refreshKey }: MeetingsListProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [dialogMode, setDialogMode] = useState<"minutes" | "transcription" | "speakers">("minutes");
  const [editingSpeakers, setEditingSpeakers] = useState<Record<string, string>>({});
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");

  const fetchMeetings = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("meetings")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setMeetings((data as Meeting[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings, refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel(`meetings-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meetings",
          filter: `project_id=eq.${projectId}`,
        },
        () => fetchMeetings()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, fetchMeetings]);

  const getAudioUrl = async (path: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from("meeting-audio")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível carregar o áudio.");
      return "";
    }
    return data.signedUrl;
  };

  const handleRetryProcessing = async (meetingId: string) => {
    await (supabase as any)
      .from("meetings")
      .update({ processing_status: "pendente" })
      .eq("id", meetingId);

    supabase.functions.invoke("process-meeting", {
      body: { meeting_id: meetingId },
    });
  };

  const handleSaveSpeakers = async () => {
    if (!selectedMeeting) return;
    await (supabase as any)
      .from("meetings")
      .update({ speaker_map: editingSpeakers })
      .eq("id", selectedMeeting.id);

    toast.success("Participantes atualizados!");
    setSelectedMeeting({ ...selectedMeeting, speaker_map: editingSpeakers });
    fetchMeetings();
  };

  const handleDownloadPdf = async (meeting: Meeting) => {
    setGeneratingPdf(meeting.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-meeting-pdf", {
        body: { meeting_id: meeting.id },
      });

      if (error || !data?.html) {
        toast.error("Erro ao gerar PDF");
        return;
      }

      // Open HTML content in a new window for printing as PDF
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        // Auto-trigger print dialog for PDF save
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch {
      toast.error("Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const openDialog = async (meeting: Meeting, mode: "minutes" | "transcription" | "speakers") => {
    setSelectedMeeting(meeting);
    setDialogMode(mode);
    setAudioUrl("");
    if (mode !== "speakers" && meeting.audio_path) {
      const url = await getAudioUrl(meeting.audio_path);
      setAudioUrl(url);
    }
    if (mode === "speakers") {
      setEditingSpeakers(meeting.speaker_map || {});
    }
  };

  // Apply speaker names to transcription text
  const getFormattedTranscription = (meeting: Meeting) => {
    let text = meeting.transcription || "";
    const map = meeting.speaker_map || {};
    Object.entries(map).forEach(([key, name]) => {
      if (name && name !== key) {
        text = text.split(key).join(`[${name}]`);
      }
    });
    return text;
  };

  const getSpeakerNames = (meeting: Meeting) => {
    const map = meeting.speaker_map || {};
    const names = Object.values(map).filter((v) => v && !v.startsWith("[Voz"));
    return names.length > 0 ? names.join(", ") : null;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma reunião gravada. Use o botão acima para gravar sua primeira reunião.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {meetings.map((meeting) => {
          const status = statusConfig[meeting.processing_status] || statusConfig.pendente;
          const isProcessing = meeting.processing_status === "processando";
          const isError = meeting.processing_status === "erro" || meeting.processing_status === "erro_ata";
          const isDone = meeting.processing_status === "concluido";
          const speakerNames = getSpeakerNames(meeting);

          return (
            <div
              key={meeting.id}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{meeting.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateBR(meeting.date)} • {meeting.start_time}
                  {meeting.end_time ? ` - ${meeting.end_time}` : ""}
                </p>
                {speakerNames && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Users className="h-3 w-3" /> {speakerNames}
                  </p>
                )}
              </div>

              <Badge variant="secondary" className={`${status.className} shrink-0`}>
                {isProcessing && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                {status.label}
              </Badge>

              <div className="flex items-center gap-1 shrink-0">
                {meeting.audio_path && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Ouvir áudio"
                    onClick={async () => {
                      const url = await getAudioUrl(meeting.audio_path!);
                      if (!url) return;
                      const audio = new Audio(url);
                      audio.play();
                    }}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}

                {isDone && meeting.transcription && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Ver transcrição"
                    onClick={() => openDialog(meeting, "transcription")}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}

                {isDone && meeting.minutes_text && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Ver ata"
                    onClick={() => openDialog(meeting, "minutes")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                )}

                {isDone && meeting.minutes_text && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Baixar PDF"
                    disabled={generatingPdf === meeting.id}
                    onClick={() => handleDownloadPdf(meeting)}
                  >
                    {generatingPdf === meeting.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                )}

                {isDone && meeting.speaker_map && Object.keys(meeting.speaker_map).length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Editar participantes"
                    onClick={() => openDialog(meeting, "speakers")}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                )}

                {isError && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    title="Tentar novamente"
                    onClick={() => handleRetryProcessing(meeting.id)}
                  >
                    <AlertCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedMeeting} onOpenChange={() => setSelectedMeeting(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedMeeting?.name} —{" "}
              {dialogMode === "minutes" ? "Ata" : dialogMode === "transcription" ? "Transcrição" : "Participantes"}
            </DialogTitle>
          </DialogHeader>

          {dialogMode === "minutes" && (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {selectedMeeting?.minutes_text}
            </div>
          )}

          {dialogMode === "transcription" && selectedMeeting && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono bg-muted/30 p-4 rounded-lg">
              {getFormattedTranscription(selectedMeeting)}
            </div>
          )}

          {dialogMode === "speakers" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Associe cada voz identificada ao nome do participante:
              </p>
              {Object.entries(editingSpeakers).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24 shrink-0">{key}</span>
                  <span className="text-muted-foreground">→</span>
                  <Input
                    value={value}
                    onChange={(e) =>
                      setEditingSpeakers((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder="Nome do participante"
                    className="flex-1"
                  />
                </div>
              ))}
              <Button onClick={handleSaveSpeakers} className="w-full mt-2">
                Salvar Participantes
              </Button>
            </div>
          )}

          {selectedMeeting?.audio_path && dialogMode !== "speakers" && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Áudio da reunião:</p>
              <audio
                controls
                className="w-full"
                src={getAudioUrl(selectedMeeting.audio_path)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
