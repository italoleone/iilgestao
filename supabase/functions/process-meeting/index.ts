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

async function callAI(apiKey: string, messages: any[], model = "google/gemini-2.5-flash") {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`AI API error [${response.status}]:`, errText);
    throw new Error(`AI call failed [${response.status}]`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let meetingId: string | undefined;

  try {
    const body = await req.json();
    meetingId = body.meeting_id;
    const manual_notes: string | undefined = body.manual_notes;

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

    // ──────────────────────────────────────────────────
    // STEP 1: Obtain transcription
    // ──────────────────────────────────────────────────
    let transcription: string;

    if (manual_notes) {
      // Presencial: use the manual notes directly as the "transcription"
      console.log("Using manual notes (presencial mode)...");
      transcription = `[Anotações manuais]\n${manual_notes}`;
    } else {
      // Remoto: download audio and transcribe as before
      const { data: audioData, error: audioError } = await supabase.storage
        .from("meeting-audio")
        .download(meeting.audio_path);

      if (audioError || !audioData) throw new Error("Audio file not found in storage");

      const arrayBuffer = await audioData.arrayBuffer();
      const base64Audio = uint8ArrayToBase64(new Uint8Array(arrayBuffer));

      const audioFormat = meeting.audio_path.endsWith(".m4a") ? "m4a" : "webm";

      console.log("Starting transcription with diarization...");

      transcription = await callAI(
        lovableApiKey,
        [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Você é um transcritor profissional de alta precisão. Transcreva o áudio a seguir em português brasileiro com as seguintes regras obrigatórias:

1. DIARIZAÇÃO: Identifique TODOS os falantes diferentes e atribua rótulos sequenciais: [Voz 1], [Voz 2], [Voz 3], etc.
2. FORMATO: Cada trecho de fala deve começar com o rótulo do falante em uma nova linha:
   [Voz 1]: texto da fala aqui.
   [Voz 2]: resposta aqui.
3. PÓS-PROCESSAMENTO obrigatório:
   - Remova vícios de linguagem ("é", "ah", "né", "tipo", "então" quando usados como preenchimento)
   - Corrija pontuação automaticamente
   - Organize frases de forma clara e coesa
   - Mantenha o significado original intacto
4. Se houver apenas um falante, use [Voz 1] para todo o áudio.
5. NÃO adicione comentários, resumos ou interpretações. Apenas a transcrição limpa e formatada.
6. Seja EXTREMAMENTE preciso com nomes próprios, termos técnicos e números mencionados.`,
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
        "google/gemini-2.5-pro"
      );

      if (!transcription) {
        throw new Error("Empty transcription returned");
      }
    }

    console.log("Transcription complete. Generating professional minutes...");

    // Extract speaker labels for speaker_map initialization
    const speakerLabels = [...new Set(transcription.match(/\[Voz \d+\]/g) || [])];
    const speakerMap: Record<string, string> = {};
    speakerLabels.forEach((label) => {
      speakerMap[label] = label; // Default: [Voz 1] -> [Voz 1]
    });

    // ──────────────────────────────────────────────────
    // STEP 2: Professional structured minutes
    // ──────────────────────────────────────────────────
    const minutesResponse = await callAI(
      lovableApiKey,
      [
        {
          role: "system",
          content: `Você é um secretário executivo especializado em gerar atas de reunião profissionais, formais e estruturadas em português brasileiro.

A ata deve seguir EXATAMENTE este formato:

## ATA DE REUNIÃO

**Reunião:** [nome da reunião]
**Data:** [data]
**Horário:** [horário início - horário fim]
**Participantes:** [listar os falantes identificados na transcrição]

---

### 1. RESUMO EXECUTIVO
[Resumo conciso, objetivo e profissional do que foi discutido. Máximo 3-4 parágrafos. Linguagem formal.]

### 2. DECISÕES TOMADAS
- [Decisão 1 — clara e objetiva]
- [Decisão 2]
(Se nenhuma decisão clara foi tomada, indique: "Nenhuma decisão formal foi registrada nesta reunião.")

### 3. PENDÊNCIAS E AÇÕES
| # | Ação | Responsável | Prazo |
|---|------|-------------|-------|
| 1 | [descrição da ação] | [responsável ou "A definir"] | [prazo ou "A definir"] |

### 4. OBSERVAÇÕES TÉCNICAS
- [Observações técnicas relevantes discutidas]
(Se não houver, omita esta seção)

### 5. PRÓXIMOS PASSOS
- [Próximos passos definidos]

---

REGRAS:
- Linguagem FORMAL e PROFISSIONAL
- Clareza e objetividade absolutas
- Documento pronto para envio ao cliente
- Se a transcrição estiver curta ou ininteligível, gere a ata com as informações disponíveis e indique limitações
- NÃO invente informações que não estejam na transcrição`,
        },
        {
          role: "user",
          content: `Reunião: ${meeting.name}\nData: ${meeting.date}\nHorário: ${meeting.start_time}${meeting.end_time ? " - " + meeting.end_time : ""}\n\nTranscrição da reunião:\n\n${transcription}`,
        },
      ],
      "google/gemini-2.5-pro"
    );

    if (!minutesResponse) {
      // Save transcription even if minutes fail
      await supabase
        .from("meetings")
        .update({
          transcription,
          speaker_map: speakerMap,
          processing_status: "erro_ata",
        })
        .eq("id", meetingId);
      throw new Error("Minutes generation failed - empty response");
    }

    // Update meeting with results
    await supabase
      .from("meetings")
      .update({
        transcription,
        minutes_text: minutesResponse,
        speaker_map: speakerMap,
        processing_status: "concluido",
      })
      .eq("id", meetingId);

    console.log("Meeting processing complete for:", meetingId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-meeting error:", error);

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
