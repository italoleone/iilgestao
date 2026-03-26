import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Leone brand colors
const BRAND = {
  black: "#1A1A1A",
  green: "#D2E100",
  gray: "#666666",
  lightGray: "#F5F5F5",
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const charWidth = fontSize * 0.5;
  const maxChars = Math.floor(maxWidth / charWidth);
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length > maxChars) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + " " + word : word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines.length ? lines : [""];
}

function generatePdfContent(meeting: any, project: any, speakerMap: Record<string, string>): string {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;
  let currentY = pageHeight - margin;
  let pageNum = 1;
  const pages: string[] = [];
  let currentPageContent = "";

  const dateFormatted = meeting.date
    ? meeting.date.split("-").reverse().join("/")
    : "—";

  function addNewPage() {
    // Add footer to current page
    currentPageContent += `
      <text x="${margin}" y="30" font-size="7" fill="${BRAND.gray}" font-family="Helvetica">
        Leone Engenharia — ${escapeXml(project?.name || "")}
      </text>
      <text x="${pageWidth - margin}" y="30" font-size="7" fill="${BRAND.gray}" font-family="Helvetica" text-anchor="end">
        Página ${pageNum}
      </text>
      <line x1="${margin}" y1="40" x2="${pageWidth - margin}" y2="40" stroke="${BRAND.green}" stroke-width="1"/>
    `;
    pages.push(currentPageContent);
    currentPageContent = "";
    pageNum++;
    currentY = pageHeight - margin;
  }

  function ensureSpace(needed: number) {
    if (currentY - needed < 60) {
      addNewPage();
    }
  }

  // ── HEADER ──
  // Logo text
  currentPageContent += `
    <rect x="0" y="${pageHeight - 90}" width="${pageWidth}" height="90" fill="${BRAND.black}"/>
    <text x="${margin}" y="${pageHeight - 55}" font-size="22" fill="white" font-family="Helvetica" font-weight="bold">LEONE</text>
    <text x="${margin + 108}" y="${pageHeight - 55}" font-size="8" fill="${BRAND.green}" font-family="Helvetica" letter-spacing="3">ENGENHARIA</text>
    <text x="${pageWidth - margin}" y="${pageHeight - 55}" font-size="9" fill="white" font-family="Helvetica" text-anchor="end">ATA DE REUNIÃO</text>
    <rect x="${margin}" y="${pageHeight - 95}" width="${contentWidth}" height="3" fill="${BRAND.green}"/>
  `;
  currentY = pageHeight - 110;

  // ── META INFO BOX ──
  ensureSpace(80);
  currentPageContent += `
    <rect x="${margin}" y="${currentY - 70}" width="${contentWidth}" height="65" fill="${BRAND.lightGray}" rx="3"/>
    <text x="${margin + 12}" y="${currentY - 50}" font-size="8" fill="${BRAND.gray}" font-family="Helvetica">PROJETO</text>
    <text x="${margin + 12}" y="${currentY - 38}" font-size="10" fill="${BRAND.black}" font-family="Helvetica" font-weight="bold">${escapeXml(project?.name || meeting.name)}</text>
    <text x="${margin + 300}" y="${currentY - 50}" font-size="8" fill="${BRAND.gray}" font-family="Helvetica">DATA</text>
    <text x="${margin + 300}" y="${currentY - 38}" font-size="10" fill="${BRAND.black}" font-family="Helvetica" font-weight="bold">${dateFormatted}</text>
    <text x="${margin + 12}" y="${currentY - 18}" font-size="8" fill="${BRAND.gray}" font-family="Helvetica">HORÁRIO</text>
    <text x="${margin + 12}" y="${currentY - 6}" font-size="10" fill="${BRAND.black}" font-family="Helvetica">${meeting.start_time || ""}${meeting.end_time ? " — " + meeting.end_time : ""}</text>
  `;

  // Participants from speaker_map
  const participants = Object.values(speakerMap || {}).filter(Boolean);
  if (participants.length > 0) {
    currentPageContent += `
      <text x="${margin + 300}" y="${currentY - 18}" font-size="8" fill="${BRAND.gray}" font-family="Helvetica">PARTICIPANTES</text>
      <text x="${margin + 300}" y="${currentY - 6}" font-size="9" fill="${BRAND.black}" font-family="Helvetica">${escapeXml(participants.join(", "))}</text>
    `;
  }

  currentY -= 85;

  // ── MINUTES CONTENT ──
  const minutesText = meeting.minutes_text || "";
  const lines = minutesText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      currentY -= 8;
      continue;
    }

    // Section headers (### or ##)
    if (trimmed.startsWith("##")) {
      const headerText = trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, "");
      ensureSpace(30);
      currentY -= 10;

      // Green accent bar + header
      currentPageContent += `
        <rect x="${margin}" y="${currentY - 12}" width="3" height="14" fill="${BRAND.green}"/>
        <text x="${margin + 10}" y="${currentY}" font-size="11" fill="${BRAND.black}" font-family="Helvetica" font-weight="bold">${escapeXml(headerText)}</text>
      `;
      currentY -= 22;
      continue;
    }

    // Table header line (|---|)
    if (trimmed.startsWith("|") && trimmed.includes("---")) {
      continue;
    }

    // Table row
    if (trimmed.startsWith("|")) {
      const cells = trimmed
        .split("|")
        .filter((c) => c.trim())
        .map((c) => c.trim());
      ensureSpace(20);
      const colWidth = contentWidth / cells.length;
      cells.forEach((cell, i) => {
        const cleanCell = cell.replace(/\*\*/g, "");
        currentPageContent += `
          <text x="${margin + i * colWidth + 5}" y="${currentY}" font-size="8" fill="${BRAND.black}" font-family="Helvetica">${escapeXml(cleanCell)}</text>
        `;
      });
      currentY -= 16;
      continue;
    }

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const bulletText = trimmed.replace(/^[-*]\s*/, "").replace(/\*\*/g, "");
      const wrappedLines = wrapText(bulletText, contentWidth - 20, 9);
      ensureSpace(wrappedLines.length * 14 + 4);
      wrappedLines.forEach((wl, i) => {
        if (i === 0) {
          currentPageContent += `
            <circle cx="${margin + 5}" cy="${currentY - 3}" r="2" fill="${BRAND.green}"/>
            <text x="${margin + 14}" y="${currentY}" font-size="9" fill="${BRAND.black}" font-family="Helvetica">${escapeXml(wl)}</text>
          `;
        } else {
          currentPageContent += `
            <text x="${margin + 14}" y="${currentY}" font-size="9" fill="${BRAND.black}" font-family="Helvetica">${escapeXml(wl)}</text>
          `;
        }
        currentY -= 14;
      });
      continue;
    }

    // Bold text lines (**text**)
    const cleanLine = trimmed.replace(/\*\*/g, "");
    const isBold = trimmed.includes("**");
    const wrappedLines = wrapText(cleanLine, contentWidth, 9);
    ensureSpace(wrappedLines.length * 14);
    wrappedLines.forEach((wl) => {
      currentPageContent += `
        <text x="${margin}" y="${currentY}" font-size="9" fill="${BRAND.black}" font-family="Helvetica"${isBold ? ' font-weight="bold"' : ""}>${escapeXml(wl)}</text>
      `;
      currentY -= 14;
    });
  }

  // Add separator
  currentY -= 10;
  ensureSpace(20);
  currentPageContent += `
    <line x1="${margin}" y1="${currentY}" x2="${pageWidth - margin}" y2="${currentY}" stroke="${BRAND.green}" stroke-width="1"/>
  `;
  currentY -= 20;

  // Final page footer
  addNewPage();

  // Build full SVG-based PDF
  // We'll use a simplified approach: return the minutes as formatted text
  // and generate a proper PDF on the client side, or use a text-based PDF generator

  return JSON.stringify({ pages, pageCount: pages.length, pageWidth, pageHeight });
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

    // Fetch project info
    const { data: project } = await supabase
      .from("projects")
      .select("name, client")
      .eq("id", meeting.project_id)
      .single();

    const speakerMap = (meeting.speaker_map as Record<string, string>) || {};

    // Use AI to generate a clean, well-formatted markdown for the PDF
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

    // Generate HTML-based PDF content
    const dateFormatted = meeting.date?.split("-").reverse().join("/") || "—";
    const participants = Object.values(speakerMap).filter(Boolean).join(", ") || "Não identificados";

    const minutesHtml = (meeting.minutes_text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^### (.*$)/gm, '<h3 style="color:#1A1A1A;border-left:3px solid #D2E100;padding-left:8px;margin-top:16px;font-size:13px;">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 style="color:#1A1A1A;border-left:4px solid #D2E100;padding-left:10px;margin-top:20px;font-size:15px;">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.*$)/gm, '<li style="margin-bottom:4px;font-size:11px;">$1</li>')
      .replace(/\n/g, "<br/>");

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1A1A1A; font-size: 11px; line-height: 1.6; }
  .header { background: #1A1A1A; padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; }
  .header .logo { color: white; font-size: 22px; font-weight: bold; letter-spacing: 2px; }
  .header .logo span { color: #D2E100; font-size: 8px; letter-spacing: 4px; display: block; }
  .header .doc-type { color: white; font-size: 10px; letter-spacing: 3px; }
  .accent-bar { height: 3px; background: #D2E100; }
  .meta-box { background: #F5F5F5; margin: 20px 40px; padding: 16px 20px; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .meta-label { font-size: 8px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .meta-value { font-size: 11px; font-weight: bold; margin-top: 2px; }
  .content { padding: 10px 40px 60px 40px; }
  .content h2, .content h3 { margin-top: 18px; margin-bottom: 8px; }
  .content li { margin-left: 16px; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 10px 40px; border-top: 1px solid #D2E100; display: flex; justify-content: space-between; font-size: 8px; color: #666; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">LEONE<span>ENGENHARIA</span></div>
    <div class="doc-type">ATA DE REUNIÃO</div>
  </div>
  <div class="accent-bar"></div>
  <div class="meta-box">
    <div><div class="meta-label">Projeto</div><div class="meta-value">${escapeXml(project?.name || meeting.name)}</div></div>
    <div><div class="meta-label">Data</div><div class="meta-value">${dateFormatted}</div></div>
    <div><div class="meta-label">Horário</div><div class="meta-value">${meeting.start_time || ""}${meeting.end_time ? " — " + meeting.end_time : ""}</div></div>
    <div><div class="meta-label">Participantes</div><div class="meta-value">${escapeXml(participants)}</div></div>
  </div>
  <div class="content">
    ${minutesHtml}
  </div>
  <div class="footer">
    <span>Leone Engenharia — ${escapeXml(project?.name || "")}</span>
    <span>Documento gerado automaticamente</span>
  </div>
</body>
</html>`;

    return new Response(JSON.stringify({ html: htmlContent, meeting_name: meeting.name, date: dateFormatted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-meeting-pdf error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
