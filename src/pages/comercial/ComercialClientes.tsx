import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCommercialClients, useCreateClient, useUpdateClient, useClientHistory, type CommercialClient, type ProposalDisciplines } from "@/hooks/useCommercialData";
import { Plus, Search, History, Edit } from "lucide-react";
import { DISCIPLINE_SHORT } from "@/types";
import { Label } from "@/components/ui/label";

export default function ComercialClientes() {
  const { data: clients = [], isLoading } = useCommercialClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CommercialClient | null>(null);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contact_name: "", phone: "", email: "", city: "", notes: "" });

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingClient(null);
    setForm({ name: "", contact_name: "", phone: "", email: "", city: "", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (c: CommercialClient) => {
    setEditingClient(c);
    setForm({
      name: c.name,
      contact_name: c.contact_name || "",
      phone: c.phone || "",
      email: c.email || "",
      city: c.city || "",
      notes: c.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingClient) {
      updateClient.mutate({ id: editingClient.id, ...form }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createClient.mutate(form as any, { onSuccess: () => setDialogOpen(false) });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />Novo Cliente</Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar clientes..." className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.contact_name || "—"}</TableCell>
                    <TableCell>{c.phone || "—"}</TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell>{c.city || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setHistoryClientId(c.id)} title="Histórico">
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create/Edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome / Razão social *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Nome do contato</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={handleSave} className="w-full" disabled={!form.name.trim()}>
                {editingClient ? "Salvar" : "Criar Cliente"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* History dialog */}
        <ClientHistoryDialog clientId={historyClientId} onClose={() => setHistoryClientId(null)} />
      </div>
    </AppLayout>
  );
}

function ClientHistoryDialog({ clientId, onClose }: { clientId: string | null; onClose: () => void }) {
  const { data: history = [] } = useClientHistory(clientId);

  return (
    <Dialog open={!!clientId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de Propostas</DialogTitle>
        </DialogHeader>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma proposta anterior para este cliente.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Área (m²)</TableHead>
                <TableHead>Estrutural</TableHead>
                <TableHead>Hidráulica</TableHead>
                <TableHead>Elétrica</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.project_name}</TableCell>
                  <TableCell>{p.area_m2}</TableCell>
                  {(["estrutural", "hidraulica", "eletrica"] as const).map((d) => {
                    const val = p.disciplines?.[d];
                    const rpm = val && p.area_m2 > 0 ? (val / p.area_m2).toFixed(2) : "—";
                    return (
                      <TableCell key={d}>
                        {val ? `R$ ${val.toLocaleString("pt-BR")}` : "—"}
                        <br />
                        <span className="text-xs text-muted-foreground">{rpm !== "—" ? `R$ ${rpm}/m²` : ""}</span>
                      </TableCell>
                    );
                  })}
                  <TableCell>{new Date(p.proposal_date).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
