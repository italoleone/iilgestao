import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, FileText, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface MeetingRecorderProps {
  projectId: string;
  onRecordingSaved: () => void;
  mode: "remoto" | "presencial";
}

const MAX_DURATION = 7200; // 2 hours in seconds

export function MeetingRecorder({ projectId, onRecordingSaved, mode }: MeetingRecorderProps) {
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<string>("");
  const mimeTypeRef = useRef<string>("audio/webm");

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (recording) {
      timerRef.current = window.setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= MAX_DURATION) {
            stopRecording();
            toast.info("Limite de 2 horas atingido. Gravação finalizada.");
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording, stopRecording]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const saveRecording = async (blob: Blob) => {
    if (!user) return;
    setSaving(true);

    try {
      const now = new Date();
      const endTime = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const dateStr = now.toLocaleDateString("pt-BR");
      const ext = mimeTypeRef.current.includes("webm") ? "webm" : "m4a";
      const fileName = `${projectId}/${Date.now()}.${ext}`;

      toast.info("Salvando gravação...");

      const { error: uploadError } = await supabase.storage
        .from("meeting-audio")
        .upload(fileName, blob, { contentType: mimeTypeRef.current });

      if (uploadError) {
        toast.error("Erro ao salvar áudio: " + uploadError.message);
        return;
      }

      const { data: meeting, error: insertError } = await (supabase as any)
        .from("meetings")
        .insert({
          project_id: projectId,
          name: `Reunião ${dateStr}`,
          date: now.toISOString().split("T")[0],
          start_time: startTimeRef.current,
          end_time: endTime,
          audio_path: fileName,
          processing_status: "pendente",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (insertError || !meeting) {
        toast.error("Erro ao registrar reunião: " + (insertError?.message || "Erro desconhecido"));
        return;
      }

      toast.success("Gravação salva! Processando transcrição e ata...");
      onRecordingSaved();

      supabase.functions.invoke("process-meeting", {
        body: { meeting_id: meeting.id },
      });
    } finally {
      setSaving(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      mimeTypeRef.current = mimeType;
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const contentType = mimeType.includes("webm") ? "audio/webm" : "audio/mp4";
        const blob = new Blob(chunksRef.current, { type: contentType });
        await saveRecording(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      mediaRecorder.start(1000);
      setRecording(true);
      setElapsed(0);
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  };

  const saveManualMeeting = async () => {
    if (!user || !manualText.trim()) return;
    setSavingManual(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR");
      const startTime = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const { data: meeting, error } = await (supabase as any)
        .from("meetings")
        .insert({
          project_id: projectId,
          name: `Reunião Presencial ${dateStr}`,
          date: now.toISOString().split("T")[0],
          start_time: startTime,
          end_time: null,
          audio_path: null,
          processing_status: "pendente",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (error || !meeting) {
        toast.error("Erro ao registrar reunião: " + (error?.message || "Erro desconhecido"));
        return;
      }

      toast.success("Reunião registrada! Gerando ata...");
      setManualText("");
      setManualOpen(false);
      onRecordingSaved();

      supabase.functions.invoke("process-meeting", {
        body: { meeting_id: meeting.id, manual_notes: manualText.trim() },
      });
    } finally {
      setSavingManual(false);
    }
  };

  if (mode === "presencial") {
    if (!manualOpen) {
      return (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setManualOpen(true)}>
          <FileText className="h-4 w-4" />
          Registrar Ata Manual
        </Button>
      );
    }
    return (
      <div className="w-full space-y-2">
        <Textarea
          placeholder="Digite as anotações da reunião presencial. A IA irá estruturar a ata automaticamente..."
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          rows={5}
          className="text-sm resize-none"
        />
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setManualOpen(false);
              setManualText("");
            }}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="gap-2"
            disabled={savingManual || !manualText.trim()}
            onClick={saveManualMeeting}
          >
            {savingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Salvar e Gerar Ata
          </Button>
        </div>
      </div>
    );
  }

  if (saving) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Mic className="h-4 w-4 animate-spin" /> Salvando...
      </Button>
    );
  }

  if (recording) {
    return (
      <Button variant="destructive" size="sm" className="gap-2" onClick={stopRecording}>
        <Square className="h-4 w-4" />
        Parar Gravação ({formatTime(elapsed)})
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={startRecording}>
      <Mic className="h-4 w-4" />
      Gravar Reunião
    </Button>
  );
}
