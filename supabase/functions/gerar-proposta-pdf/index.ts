import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import JSZip from "npm:jszip@3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtArea(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr: string): string {
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const d = new Date(dateStr + "T12:00:00");
  return `${String(d.getDate()).padStart(2, "0")} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function replaceInXml(xml: string, replacements: Record<string, string>): string {
  // DOCX XML may split {{FIELD}} across multiple <w:t> tags.
  // Strategy: first try direct replacement, then handle split tags.

  let result = xml;

  // Direct replacement for fields that aren't split
  for (const [key, value] of Object.entries(replacements)) {
    const placeholder = `{{${key}}}`;
    // Escape special XML chars in value
    const safeValue = value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
    result = result.split(placeholder).join(safeValue);
  }

  // Handle split placeholders: remove XML tags between {{ and }} 
  // Pattern: {{ possibly with XML tags in between, then FIELD_NAME, then }}
  for (const [key, value] of Object.entries(replacements)) {
    const safeValue = value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    // Build regex that matches {{ KEY }} with possible XML tags between chars
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const chars = `\\{\\{${escapedKey}\\}\\}`;
    // Insert optional XML tag pattern between each character
    let pattern = "";
    for (const ch of `{{${key}}}`) {
      if (pattern) pattern += "(?:<[^>]*>)*";
      pattern += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    try {
      const regex = new RegExp(pattern, "g");
      result = result.replace(regex, safeValue);
    } catch {
      // Skip if regex is invalid
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { proposal_id } = await req.json();
    if (!proposal_id) {
      return new Response(JSON.stringify({ error: "proposal_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch proposal with client
    const { data: proposal, error: pErr } = await supabase
      .from("commercial_proposals")
      .select("*, client:commercial_clients(*)")
      .eq("id", proposal_id)
      .single();

    if (pErr || !proposal) {
      return new Response(JSON.stringify({ error: "Proposta não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine template file based on scope
    const scope = proposal.scope || "residencial";
    const templateFile = `escopo_${scope}.docx`;

    // Download template from storage
    const { data: fileData, error: fileErr } = await supabase.storage
      .from("proposal-templates")
      .download(templateFile);

    if (fileErr || !fileData) {
      return new Response(
        JSON.stringify({ error: `Template "${templateFile}" não encontrado no storage. Faça upload do arquivo primeiro.` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const disciplines = proposal.disciplines || {};
    const area = Number(proposal.area_m2) || 0;
    const totalValue = Number(proposal.total_value) || 0;
    const valEstrutural = Number(disciplines.estrutural) || 0;
    const valHidraulica = Number(disciplines.hidraulica) || 0;
    const valEletrica = Number(disciplines.eletrica) || 0;
    const valFundacoes = Number(disciplines.fundacoes) || 0;
    const hasFundacoes = valFundacoes > 0;

    // Build replacements map
    const replacements: Record<string, string> = {
      NOME_OBRA: proposal.project_name || "",
      CLIENTE: proposal.client?.name || "",
      ATENCAO: proposal.client?.contact_name || "",
      AREA: fmtArea(area),
      CIDADE: proposal.client?.city || "Marília",
      DATA_EMISSAO: fmtDate(proposal.proposal_date),
      ARQUIVO_REF_1: proposal.arquivo_ref_1 || "",
      ARQUIVO_REF_2: proposal.arquivo_ref_2 || "",
      VALOR_ESTRUTURA: valEstrutural > 0 ? fmtBRL(valEstrutural) : "—",
      VALOR_FUNDACOES: hasFundacoes ? fmtBRL(valFundacoes) : "—",
      VALOR_HIDRAULICA: valHidraulica > 0 ? fmtBRL(valHidraulica) : "—",
      VALOR_ELETRICA: valEletrica > 0 ? fmtBRL(valEletrica) : "—",
      VALOR_TOTAL: fmtBRL(totalValue),
      // Parcelas
      PARCELA_ACEITE: fmtBRL(totalValue * 0.10),
      PARCELA_EP_ESTRUTURA: valEstrutural > 0 ? fmtBRL(valEstrutural * 0.30) : "—",
      PARCELA_EP_HIDRAULICA: valHidraulica > 0 ? fmtBRL(valHidraulica * 0.30) : "—",
      PARCELA_EP_ELETRICA: valEletrica > 0 ? fmtBRL(valEletrica * 0.30) : "—",
      PARCELA_PPE_ESTRUTURA: valEstrutural > 0 ? fmtBRL(valEstrutural * 0.25) : "—",
      PARCELA_PPE_FUNDACOES: hasFundacoes ? fmtBRL(valFundacoes * 0.45) : "—",
      PARCELA_PPE_HIDRAULICA: valHidraulica > 0 ? fmtBRL(valHidraulica * 0.25) : "—",
      PARCELA_PPE_ELETRICA: valEletrica > 0 ? fmtBRL(valEletrica * 0.25) : "—",
      PARCELA_PE_ESTRUTURA: valEstrutural > 0 ? fmtBRL(valEstrutural * 0.35) : "—",
      PARCELA_PE_FUNDACOES: hasFundacoes ? fmtBRL(valFundacoes * 0.45) : "—",
      PARCELA_PE_HIDRAULICA: valHidraulica > 0 ? fmtBRL(valHidraulica * 0.35) : "—",
      PARCELA_PE_ELETRICA: valEletrica > 0 ? fmtBRL(valEletrica * 0.35) : "—",
    };

    // Process DOCX (it's a ZIP of XML files)
    const arrayBuffer = await fileData.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Replace placeholders in all XML files inside the DOCX
    const xmlFiles = Object.keys(zip.files).filter(
      (name) => name.endsWith(".xml") || name.endsWith(".xml.rels")
    );

    for (const fileName of xmlFiles) {
      const content = await zip.file(fileName)?.async("string");
      if (content) {
        const replaced = replaceInXml(content, replacements);
        zip.file(fileName, replaced);
      }
    }

    // Generate the filled DOCX
    const docxBuffer = await zip.generateAsync({ type: "uint8array" });

    const safeName = `Proposta_${(proposal.client?.name || "cliente").replace(/[^a-zA-Z0-9]/g, "_")}_${(proposal.project_name || "projeto").replace(/[^a-zA-Z0-9]/g, "_")}.docx`;

    return new Response(docxBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (err) {
    console.error("Error generating proposal document:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
