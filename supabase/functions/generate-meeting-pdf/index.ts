import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Same as escapeXml but preserves <strong> tags already injected
function escapeXml2(text: string): string {
  return text
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, "&amp;")
    .replace(/<(?!\/?strong>)/g, "&lt;")
    .replace(/(?<!<\/?strong)>/g, "&gt;");
}

function buildMinutesContent(raw: string): string {
  const lines = raw.split("\n");
  let html = "";
  let inSection = 0;
  let tableHeaderDone = false;
  let tableOpen = false;
  let listOpen = false;
  let proxOpen = false;
  let resumoOpen = false;
  let sectionOpen = false;

  function closePending() {
    if (tableOpen) {
      html += `</tbody></table>`;
      tableOpen = false;
      tableHeaderDone = false;
    }
    if (listOpen) {
      html += `</ul>`;
      listOpen = false;
    }
    if (proxOpen) {
      html += `</div>`;
      proxOpen = false;
    }
    if (resumoOpen) {
      html += `</div>`;
      resumoOpen = false;
    }
  }

  function closeSection() {
    closePending();
    if (sectionOpen) {
      html += `</div>`;
      sectionOpen = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip doc title and meta header lines
    if (line.startsWith("## ATA DE REUNIÃO")) continue;
    if (/^\*\*(Reunião|Data|Horário|Participantes):\*\*/.test(line)) continue;
    if (line === "---") continue;

    // Section headers ### N. TITLE
    const secMatch = line.match(/^###\s+(\d+)\.\s+(.+)/);
    if (secMatch) {
      closeSection();
      inSection = parseInt(secMatch[1]);
      const title = secMatch[2].replace(/\*\*/g, "");
      html += `<div class="sec"><div class="sec-hdr"><div class="sec-num">${inSection}</div><div class="sec-ttl">${escapeXml(title)}</div><div class="sec-rule"></div></div>`;
      sectionOpen = true;
      if (inSection === 1) {
        html += `<div class="resumo">`;
        resumoOpen = true;
      }
      continue;
    }

    // Section 1: paragraph text inside resumo box
    if (inSection === 1) {
      const txt = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      html += `<p>${escapeXml2(txt)}</p>`;
      continue;
    }

    // Bullet points
    if ((line.startsWith("- ") || line.startsWith("* ")) && inSection !== 3) {
      const txt = line
        .replace(/^[-*]\s+/, "")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

      if (inSection === 2) {
        if (!listOpen) {
          html += `<ul class="dec-list">`;
          listOpen = true;
        }
        html += `<li>${escapeXml2(txt)}</li>`;
      } else if (inSection === 4) {
        html += `<div class="obs-item"><div class="obs-dot"></div><div>${escapeXml2(txt)}</div></div>`;
      } else if (inSection === 5) {
        if (!proxOpen) {
          html += `<div class="prox-grid">`;
          proxOpen = true;
        }
        const dateMatch = txt.match(/\((.*?)\)$/) || txt.match(/—\s*([\d\/]+)$/);
        const clean = txt
          .replace(/\s*\(.*?\)$/, "")
          .replace(/\s*—\s*[\d\/]+$/, "")
          .trim();
        const dateStr = dateMatch ? dateMatch[1] : "";
        html += `<div class="prox-item"><p>${escapeXml2(clean)}</p>${
          dateStr ? `<div class="prox-date">${escapeXml(dateStr)}</div>` : ""
        }</div>`;
      } else {
        html += `<p style="font-size:9.5px;color:#2a2a2a;line-height:1.7;margin:5px 0">${escapeXml2(txt)}</p>`;
      }
      continue;
    }

    // Table header separator |---|
    if (line.startsWith("|") && line.includes("---")) {
      tableHeaderDone = true;
      continue;
    }

    // Table rows (section 3)
    if (line.startsWith("|") && inSection === 3) {
      const cells = line
        .split("|")
        .filter((c) => c.trim())
        .map((c) => c.trim());

      if (!tableOpen && !tableHeaderDone) {
        // Header row
        html += `<table class="tbl"><thead><tr>`;
        cells.forEach((c) => {
          html += `<th>${escapeXml(c.replace(/\*\*/g, ""))}</th>`;
        });
        html += `</tr></thead><tbody>`;
        tableOpen = true;
      } else if (tableOpen) {
        html += `<tr>`;
        cells.forEach((c, i) => {
          let content = escapeXml(c.replace(/\*\*/g, ""));
          if (i === cells.length - 1) {
            if (/conclu/i.test(c)) content = `<span class="bk">Concluído</span>`;
            else content = `<span class="bp">Pendente</span>`;
          }
          html += `<td>${content}</td>`;
        });
        html += `</tr>`;
      }
      continue;
    }

    // Plain paragraph fallback
    const txt = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html += `<p style="font-size:9.5px;color:#2a2a2a;line-height:1.7;margin:5px 0">${escapeXml2(txt)}</p>`;
  }

  closeSection();
  return html;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meeting_id } = await req.json();
    if (!meeting_id) throw new Error("meeting_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: meeting, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meeting_id)
      .single();

    if (error || !meeting) throw new Error("Meeting not found");

    const { data: project } = await supabase
      .from("projects")
      .select("name, client")
      .eq("id", meeting.project_id)
      .single();

    const speakerMap = (meeting.speaker_map as Record<string, string>) || {};

    const dateFormatted = meeting.date?.split("-").reverse().join("/") || "—";
    const timeRange = `${meeting.start_time || ""}${meeting.end_time ? " — " + meeting.end_time : ""}`;
    const docNum = `ATA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const participantNames = Object.values(speakerMap).filter(Boolean) as string[];
    const participantChips = participantNames
      .map((n) => `<span class="chip">${escapeXml(n)}</span>`)
      .join("");
    const signatureBlocks =
      participantNames.length > 0
        ? participantNames
            .slice(0, 4)
            .map(
              (n) =>
                `<div class="sign-block"><div class="sign-line"></div><div class="sign-name">${escapeXml(n)}</div><div class="sign-role">Participante</div></div>`
            )
            .join("")
        : `<div class="sign-block"><div class="sign-line"></div><div class="sign-name">_______________</div><div class="sign-role">Participante</div></div><div class="sign-block"><div class="sign-line"></div><div class="sign-name">_______________</div><div class="sign-role">Participante</div></div>`;

    const minutesContent = buildMinutesContent(meeting.minutes_text || "");

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
@page{size:A4;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1A1A;background:#fff}
.hdr{padding:28px 48px 20px;border-bottom:3px solid #D2E100;display:flex;justify-content:space-between;align-items:flex-end}
.logo-main{font-size:28px;font-weight:700;letter-spacing:6px;color:#1A1A1A;line-height:1}
.logo-sub{font-size:7px;letter-spacing:5px;text-transform:uppercase;color:#888;margin-top:4px}
.hdr-right{text-align:right}
.doc-label{font-size:7px;letter-spacing:3px;text-transform:uppercase;color:#888}
.doc-type{font-size:15px;font-weight:700;color:#1A1A1A;letter-spacing:1px;margin-top:2px}
.doc-num{font-size:8px;color:#aaa;margin-top:3px}
.meta-strip{display:grid;grid-template-columns:2fr 1fr 1fr;background:#F7F7F4;border-bottom:0.5px solid #E0DFD8}
.meta-cell{padding:13px 18px;border-right:0.5px solid #E0DFD8}
.meta-cell:last-child{border-right:none;text-align:right}
.meta-lbl{font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:3px}
.meta-val{font-size:10px;font-weight:600;color:#1A1A1A}
.part-bar{padding:10px 18px;background:#FEFEFE;border-bottom:0.5px solid #E8E7E0;display:flex;align-items:center;gap:10px}
.part-lbl{font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#999;min-width:72px;flex-shrink:0}
.part-chips{display:flex;gap:5px;flex-wrap:wrap}
.chip{background:#F0F5C4;border:0.5px solid #C8D800;color:#4A5500;font-size:8px;padding:3px 9px;border-radius:2px;font-weight:500}
.body{padding:26px 48px 0}
.sec{margin-top:20px}
.sec:first-child{margin-top:0}
.sec-hdr{display:flex;align-items:center;gap:7px;margin-bottom:10px;page-break-after:avoid}
.sec-num{width:18px;height:18px;background:#D2E100;color:#3A4500;font-size:8px;font-weight:800;border-radius:2px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sec-ttl{font-size:8px;font-weight:700;color:#1A1A1A;letter-spacing:2.5px;text-transform:uppercase}
.sec-rule{flex:1;height:0.5px;background:#E0DFD8}
.resumo{background:#FAFAF7;border-left:3px solid #D2E100;padding:12px 14px}
.resumo p{font-size:9.5px;color:#2a2a2a;line-height:1.8;margin:0}
.resumo p+p{margin-top:7px}
.dec-list{list-style:none;padding:0;margin:0}
.dec-list li{font-size:9.5px;color:#2a2a2a;line-height:1.7;padding:5px 0 5px 14px;border-bottom:0.5px solid #EEEEE8;position:relative}
.dec-list li:last-child{border-bottom:none}
.dec-list li::before{content:'';position:absolute;left:0;top:13px;width:5px;height:5px;background:#D2E100;border-radius:1px}
.tbl{width:100%;border-collapse:collapse;font-size:9px}
.tbl thead tr{background:#F0F5C4}
.tbl thead th{color:#4A5500;font-size:7px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:6px 9px;text-align:left;border-bottom:1.5px solid #D2E100}
.tbl thead th:first-child{width:22px;text-align:center}
.tbl tbody tr{border-bottom:0.5px solid #EEEEE8}
.tbl tbody tr:last-child{border-bottom:none}
.tbl td{padding:7px 9px;color:#2a2a2a;line-height:1.5;vertical-align:top}
.tbl td:first-child{text-align:center;color:#bbb;font-weight:700}
.bp{background:#FFF7E0;color:#7A5300;font-size:7px;padding:2px 6px;border-radius:2px;white-space:nowrap;border:0.5px solid #E8C860}
.bk{background:#E8F5D8;color:#2A5A0A;font-size:7px;padding:2px 6px;border-radius:2px;white-space:nowrap;border:0.5px solid #A8D870}
.obs-item{display:flex;gap:9px;padding:6px 0;border-bottom:0.5px solid #EEEEE8;font-size:9.5px;color:#2a2a2a;line-height:1.65}
.obs-item:last-child{border-bottom:none}
.obs-dot{width:5px;height:5px;background:#D2E100;border-radius:1px;flex-shrink:0;margin-top:6px}
.prox-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.prox-item{border:0.5px solid #E0DFD8;border-left:2.5px solid #D2E100;padding:9px 11px;background:#FAFAF7}
.prox-item p{font-size:9.5px;color:#2a2a2a;margin:0;line-height:1.55}
.prox-date{font-size:7.5px;color:#999;margin-top:4px}
.sign-area{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:24px;padding-bottom:30px}
.sign-block{text-align:center}
.sign-line{height:0.5px;background:#C8C8C0;margin-bottom:7px}
.sign-name{font-size:9px;font-weight:700;color:#1A1A1A}
.sign-role{font-size:7.5px;color:#999;margin-top:1px}
.footer{border-top:3px solid #D2E100;padding:10px 48px;display:flex;justify-content:space-between;align-items:center;background:#FAFAF7}
.footer span{font-size:7.5px;color:#999}
@media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
  <div class="hdr">
    <div>
      <div class="logo-main">LEONE</div>
      <div class="logo-sub">Engenharia</div>
    </div>
    <div class="hdr-right">
      <div class="doc-label">Documento</div>
      <div class="doc-type">Ata de Reunião</div>
      <div class="doc-num">${docNum}</div>
    </div>
  </div>
  <div class="meta-strip">
    <div class="meta-cell">
      <div class="meta-lbl">Projeto</div>
      <div class="meta-val">${escapeXml(project?.name || meeting.name)}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-lbl">Data</div>
      <div class="meta-val">${dateFormatted}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-lbl">Horário</div>
      <div class="meta-val">${timeRange}</div>
    </div>
  </div>
  <div class="part-bar">
    <div class="part-lbl">Participantes</div>
    <div class="part-chips">${participantChips || '<span class="chip">Não identificados</span>'}</div>
  </div>
  <div class="body">
    ${minutesContent}
    <div class="sign-area">
      ${signatureBlocks}
    </div>
  </div>
  <div class="footer">
    <span>Leone Engenharia · Leone Suite</span>
    <span>Documento gerado automaticamente</span>
    <span>${dateFormatted} · Página 1</span>
  </div>
</body>
</html>`;

    return new Response(
      JSON.stringify({ html: htmlContent, meeting_name: meeting.name, date: dateFormatted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-meeting-pdf error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
