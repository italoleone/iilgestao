import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let meetingId: string | undefined;

  try {
    const body = await req.json();
    meetingId = body.meeting_id;

    if (!meetingId) throw new Error("meeting_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Update status to processing
    await supabase
      .from("meetings")
      .update({ processing_status: "processando" })
      .eq("id", meetingId);

    // Fetch meeting record
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) throw new Error("Meeting not found");

    // Download audio from storage
    const { data: audioData, error: audioError } = await supabase.storage
      .from("meeting-audio")
      .download(meeting.audio_path);

    if (audioError || !audioData) throw new Error("Audio file not found in storage");

    // Convert to base64
    const arrayBuffer = await audioData.arrayBuffer();
    const base64Audio = uint8ArrayToBase64(new Uint8Array(arrayBuffer));

    // Determine audio format from file extension
    const audioFormat = meeting.audio_path.endsWith(".m4a") ? "m4a" : "webm";

    // Step 1: Transcribe audio using Gemini multimodal
    console.log("Starting transcription...");
    const transcriptionResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Transcreva o áudio a seguir em português brasileiro. Retorne apenas a transcrição completa e fiel, sem comentários adicionais. Se houver múltiplos falantes, indique trocas de falante quando possível.",
                },
                {
                  type: "input_audio",
                  input_audio: {
                    data: base64Audio,
                    format: audioFormat,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!transcriptionResponse.ok) {
      const errText = await transcriptionResponse.text();
      console.error("Transcription API error:", transcriptionResponse.status, errText);
      throw new Error(`Transcription failed [${transcriptionResponse.status}]`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    const transcription =
      transcriptionResult.choices?.[0]?.message?.content || "";

    if (!transcription) {
      throw new Error("Empty transcription returned");
    }

    console.log("Transcription complete. Generating minutes...");

    // Step 2: Generate structured meeting minutes from transcription
    const minutesResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Você é um assistente especializado em gerar atas de reunião profissionais e estruturadas em português brasileiro. 

A partir da transcrição fornecida, gere uma ata com o seguinte formato:

## Ata de Reunião

### Resumo Geral
[resumo conciso e objetivo do que foi discutido na reunião]

### Decisões Tomadas
- [lista clara e objetiva das decisões tomadas durante a reunião]

### Pendências
- [lista de tarefas pendentes, ações a serem tomadas, com responsáveis quando mencionados]

### Observações Relevantes
- [quaisquer pontos importantes mencionados que não se encaixem nas categorias acima]

Se a transcrição estiver vazia, muito curta ou ininteligível, indique isso claramente e gere uma ata com as informações disponíveis.
Seja objetivo e profissional.`,
            },
            {
              role: "user",
              content: `Reunião: ${meeting.name}\nData: ${meeting.date}\nHorário: ${meeting.start_time}${meeting.end_time ? " - " + meeting.end_time : ""}\n\nTranscrição da reunião:\n\n${transcription}`,
            },
          ],
        }),
      }
    );

    if (!minutesResponse.ok) {
      // Save transcription even if minutes generation fails
      await supabase
        .from("meetings")
        .update({
          transcription,
          processing_status: "erro_ata",
        })
        .eq("id", meetingId);

      const errText = await minutesResponse.text();
      console.error("Minutes API error:", minutesResponse.status, errText);
      throw new Error("Minutes generation failed");
    }

    const minutesResult = await minutesResponse.json();
    const minutesText = minutesResult.choices?.[0]?.message?.content || "";

    // Update meeting with results
    await supabase
      .from("meetings")
      .update({
        transcription,
        minutes_text: minutesText,
        processing_status: "concluido",
      })
      .eq("id", meetingId);

    console.log("Meeting processing complete for:", meetingId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-meeting error:", error);

    // Try to update status to error
    if (meetingId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase
          .from("meetings")
          .update({ processing_status: "erro" })
          .eq("id", meetingId);
      } catch (updateErr) {
        console.error("Failed to update meeting status:", updateErr);
      }
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
