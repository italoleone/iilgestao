import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface MeetingRecorderProps {
  projectId: string;
  onRecordingSaved: () => void;
}

const MAX_DURATION = 7200; // 2 hours in seconds

export function MeetingRecorder({ projectId, onRecordingSaved }: MeetingRecorderProps) {
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
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

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("meeting-audio")
        .upload(fileName, blob, { contentType: mimeTypeRef.current });

      if (uploadError) {
        toast.error("Erro ao salvar áudio: " + uploadError.message);
        return;
      }

      // Create meeting record
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

      // Fire and forget - process in background
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

      // Detect supported mime type
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
