import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, formatBRL, parseBRL } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { STATUS_LABEL, todaySP, type DisplayStatus, type Receipt, type ReceiptStatus } from "@/lib/receipts";

const STATUS_CLASS: Record<DisplayStatus, string> = {
  pago: "bg-success text-success-foreground",
  em_aberto: "bg-warning text-warning-foreground",
  vencido: "bg-destructive text-destructive-foreground",
  previsto: "bg-muted text-muted-foreground",
  cancelado: "bg-muted text-muted-foreground line-through",
};

export function ReceiptStatusBadge({ status }: { status: DisplayStatus }) {
  return <Badge className={cn("border-0 text-[11px] hover:opacity-90", STATUS_CLASS[status])}>{STATUS_LABEL[status]}</Badge>;
}

const moneyStr = (v: number | null | undefined) => (v == null ? "" : formatBRL(Number(v)).replace(/^R\$\s?/, ""));

interface FormState {
  description: string; invoice_number: string; has_invoice: boolean; invoice_group: string; split_pct: string;
  gross: string; net: string; issue_date: string; due_date: string; paid_date: string;
  payment_method: string; status: ReceiptStatus; needs_review: boolean; review_note: string; contact: string;
}

function toForm(r?: Partial<Receipt> | null): FormState {
  return {
    description: r?.description ?? "", invoice_number: r?.invoice_number ?? "", has_invoice: r?.has_invoice ?? true,
    invoice_group: r?.invoice_group ?? "", split_pct: r?.split_pct != null ? String(r.split_pct) : "",
    gross: moneyStr(r?.gross_amount), net: moneyStr(r?.net_amount), issue_date: r?.issue_date ?? "", due_date: r?.due_date ?? "",
    paid_date: r?.paid_date ?? "", payment_method: r?.payment_method ?? "", status: (r?.status as ReceiptStatus) ?? "em_aberto",
    needs_review: r?.needs_review ?? false, review_note: r?.review_note ?? "", contact: r?.contact ?? "",
  };
}

export function ReceiptDialog({ open, onOpenChange, projectId, receipt, userId, onSaved, projects }: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId?: string; receipt?: Receipt | null; userId?: string;
  onSaved: () => void; projects?: { id: string; name: string }[];
}) {
  const [f, setF] = useState<FormState>(toForm(receipt));
  const [proj, setProj] = useState(projectId ?? receipt?.project_id ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setF(toForm(receipt)); setProj(projectId ?? receipt?.project_id ?? ""); } }, [open, receipt, projectId]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const gross = parseBRL(f.gross);
    if (!proj) return toast.error("Escolha o projeto");
    if (!f.description.trim()) return toast.error("Informe a descrição");
    if (!f.gross.trim() || !Number.isFinite(gross)) return toast.error("Informe o valor bruto");
    if (f.status === "pago" && !f.paid_date) return toast.error("Informe a data do pagamento");
    const payload = {
      project_id: proj, description: f.description.trim(),
      invoice_number: f.has_invoice ? (f.invoice_number.trim() || null) : "S/NF", has_invoice: f.has_invoice,
      invoice_group: f.invoice_group.trim() || null, split_pct: f.split_pct.trim() ? Number(f.split_pct.replace(",", ".")) : null,
      gross_amount: gross, net_amount: f.net.trim() ? parseBRL(f.net) : null,
      issue_date: f.issue_date || null, due_date: f.due_date || null, paid_date: f.paid_date || null,
      payment_method: f.payment_method || null, status: f.status, needs_review: f.needs_review,
      review_note: f.review_note.trim() || null, contact: f.contact.trim() || null,
    };
    setSaving(true);
    const { error } = receipt
      ? await supabase.from("project_receipts").update(payload).eq("id", receipt.id)
      : await supabase.from("project_receipts").insert({ ...payload, created_by: userId ?? null });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success(receipt ? "Recebimento atualizado" : "Recebimento adicionado");
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{receipt ? "Editar recebimento" : "Adicionar recebimento"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {projects && !projectId && (
            <div className="col-span-2 space-y-1"><Label>Projeto</Label>
              <Select value={proj} onValueChange={setProj}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
          <div className="col-span-2 space-y-1"><Label>Descrição</Label><Textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="col-span-2 flex items-center gap-2"><Switch checked={f.has_invoice} onCheckedChange={(v) => set("has_invoice", v)} /><Label>Teve nota fiscal</Label></div>
          {f.has_invoice && <div className="space-y-1"><Label>Nº da NF</Label><Input value={f.invoice_number} onChange={(e) => set("invoice_number", e.target.value)} /></div>}
          <div className="space-y-1"><Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => set("status", v as ReceiptStatus)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(["pago", "em_aberto", "previsto", "cancelado"] as ReceiptStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label>Valor bruto (R$)</Label><Input inputMode="decimal" value={f.gross} onChange={(e) => set("gross", e.target.value)} /></div>
          <div className="space-y-1"><Label>Valor líquido (R$)</Label><Input inputMode="decimal" value={f.net} onChange={(e) => set("net", e.target.value)} /></div>
          <div className="space-y-1"><Label>Emissão</Label><Input type="date" value={f.issue_date} onChange={(e) => set("issue_date", e.target.value)} /></div>
          <div className="space-y-1"><Label>Vencimento</Label><Input type="date" value={f.due_date} onChange={(e) => set("due_date", e.target.value)} /></div>
          <div className="space-y-1"><Label>Pagamento</Label><Input type="date" value={f.paid_date} onChange={(e) => set("paid_date", e.target.value)} /></div>
          <div className="space-y-1"><Label>Forma</Label>
            <Select value={f.payment_method || "none"} onValueChange={(v) => set("payment_method", v === "none" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">—</SelectItem><SelectItem value="boleto">Boleto</SelectItem><SelectItem value="transferencia">Transferência</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1"><Label>Grupo da cobrança</Label><Input placeholder="mesma NF dividida" value={f.invoice_group} onChange={(e) => set("invoice_group", e.target.value)} /></div>
          <div className="space-y-1"><Label>% desta linha</Label><Input inputMode="decimal" value={f.split_pct} onChange={(e) => set("split_pct", e.target.value)} /></div>
          <div className="col-span-2 space-y-1"><Label>Contato</Label><Input value={f.contact} onChange={(e) => set("contact", e.target.value)} /></div>
          <div className="col-span-2 flex items-center gap-2"><Switch checked={f.needs_review} onCheckedChange={(v) => set("needs_review", v)} /><Label>Precisa conferir</Label></div>
          {f.needs_review && <div className="col-span-2 space-y-1"><Label>O que conferir</Label><Input value={f.review_note} onChange={(e) => set("review_note", e.target.value)} /></div>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MarkPaidDialog({ receipt, onOpenChange, onSaved }: { receipt: Receipt | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [date, setDate] = useState(todaySP());
  const [net, setNet] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (receipt) { setDate(todaySP()); setNet(moneyStr(receipt.net_amount ?? receipt.gross_amount)); } }, [receipt]);
  const save = async () => {
    if (!receipt || !date) return toast.error("Informe a data do pagamento");
    if (!net.trim()) return toast.error("Informe o valor líquido");
    setSaving(true);
    const { error } = await supabase.from("project_receipts").update({ status: "pago", paid_date: date, net_amount: parseBRL(net) }).eq("id", receipt.id);
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Marcado como pago"); onOpenChange(false); onSaved();
  };
  return (
    <Dialog open={!!receipt} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Marcar como pago</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Data do pagamento</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Valor líquido recebido (R$)</Label><Input inputMode="decimal" value={net} onChange={(e) => setNet(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>Confirmar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
