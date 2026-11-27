// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { computeTotals, displayStatus, isOverdue, splitLabel, type Receipt } from "../lib/receipts";

const T = "2026-11-27";
const row = (o: Partial<Receipt>): Receipt => ({ id: crypto.randomUUID(), project_id: "p", invoice_group: null, invoice_number: null, has_invoice: true, description: "", gross_amount: 0, net_amount: null, split_pct: null, issue_date: null, due_date: null, paid_date: null, payment_method: null, status: "em_aberto", needs_review: false, review_note: null, source: "manual", source_ref: null, contact: null, ...o });

describe("Saldo e vencido", () => {
  it("vencido = em aberto com vencimento antes de hoje", () => {
    expect(isOverdue({ status: "em_aberto", due_date: "2026-11-26" }, T)).toBe(true);
    expect(isOverdue({ status: "em_aberto", due_date: T }, T)).toBe(false);
    expect(isOverdue({ status: "previsto", due_date: "2026-01-01" }, T)).toBe(false);
    expect(displayStatus({ status: "em_aberto", due_date: "2026-10-01" }, T)).toBe("vencido");
  });
  it("saldo = venda − recebido bruto; cancelado não conta", () => {
    const t = computeTotals([
      row({ status: "pago", gross_amount: 6000, net_amount: 5400 }),
      row({ status: "em_aberto", gross_amount: 2000, due_date: "2026-11-01" }),
      row({ status: "em_aberto", gross_amount: 1000, due_date: "2026-12-10" }),
      row({ status: "previsto", gross_amount: 500 }),
      row({ status: "cancelado", gross_amount: 9999 }),
    ], 10000, T);
    expect(t).toMatchObject({ recebido_bruto: 6000, recebido_liquido: 5400, em_aberto: 3000, vencido: 2000, previsto: 500, saldo_a_receber: 4000, sem_valor_venda: false });
  });
  it("sem valor de venda é sinalizado", () => {
    expect(computeTotals([], 0, T).sem_valor_venda).toBe(true);
    expect(computeTotals([], null, T).sem_valor_venda).toBe(true);
  });
  it("rótulo de NF dividida", () => {
    const g = [row({ invoice_group: "g", invoice_number: "123", description: "Estrutura", split_pct: 60 }), row({ invoice_group: "g", invoice_number: "123", description: "Hidráulica", split_pct: 20 }), row({ invoice_group: "g", invoice_number: "123", description: "Elétrica", split_pct: 20 })];
    expect(splitLabel(g[0], g)).toBe("parte de NF 123 (EST 60% / HID 20% / ELE 20%)");
    expect(splitLabel(g[0], [g[0]])).toBeNull();
  });
});

describe("RLS de project_receipts — PostgreSQL isolado", () => {
  const db = new PGlite();
  const ids = { admin_geral: "11111111-1111-4111-8111-111111111111", admin: "22222222-2222-4222-8222-222222222222", coordenador: "33333333-3333-4333-8333-333333333333", projetista: "44444444-4444-4444-8444-444444444444" };
  const P = "55555555-5555-4555-8555-555555555555";
  const as = async (uid: string, sql: string) => {
    await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${uid}',false);`);
    try { return await db.query<any>(sql); } finally { await db.exec("RESET ROLE"); }
  };
  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      CREATE TYPE public.app_role AS ENUM ('admin_geral','admin','planejamento','coordenador','projetista');
      CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
      CREATE FUNCTION public.has_role(_u uuid, _r public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role=_r) $$;
      CREATE TABLE public.projects(id uuid PRIMARY KEY);
      CREATE TABLE public.project_financials(project_id uuid PRIMARY KEY, sale_value numeric);
      ALTER TABLE public.project_financials ENABLE ROW LEVEL SECURITY;
      CREATE POLICY fin ON public.project_financials FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin_geral') OR public.has_role(auth.uid(),'admin'));
      GRANT SELECT ON public.project_financials TO authenticated;
      CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
      CREATE FUNCTION public.fn_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
      GRANT USAGE ON SCHEMA public, auth TO authenticated;
    `);
    await db.exec(readFileSync("drizzle/migrations/0006_project_receipts.sql", "utf8").replace(/--> statement-breakpoint/g, ""));
    await db.exec(`
      INSERT INTO public.user_roles VALUES ('${ids.admin_geral}','admin_geral'),('${ids.admin}','admin'),('${ids.coordenador}','coordenador'),('${ids.projetista}','projetista');
      INSERT INTO public.projects VALUES ('${P}'); INSERT INTO public.project_financials VALUES ('${P}', 10000);
      INSERT INTO public.project_receipts(project_id, description, gross_amount, net_amount, status, due_date) VALUES
        ('${P}','NF 1',6000,5400,'pago',NULL), ('${P}','NF 2',2000,NULL,'em_aberto','2000-01-01'), ('${P}','NF 3',500,NULL,'previsto',NULL);
    `);
  });
  it("coordenador e projetista não leem nem gravam nada", async () => {
    for (const r of ["coordenador", "projetista"] as const) {
      expect((await as(ids[r], "SELECT * FROM public.project_receipts")).rows).toHaveLength(0);
      expect((await as(ids[r], "SELECT * FROM public.project_receipt_totals WHERE sale_value IS NOT NULL OR recebido_bruto > 0")).rows).toHaveLength(0);
      await expect(as(ids[r], `INSERT INTO public.project_receipts(project_id,description,gross_amount,status) VALUES ('${P}','x',1,'pago')`)).rejects.toThrow();
      expect((await as(ids[r], "UPDATE public.project_receipts SET gross_amount=0 RETURNING id")).rows).toHaveLength(0);
      expect((await as(ids[r], "DELETE FROM public.project_receipts RETURNING id")).rows).toHaveLength(0);
    }
  });
  it("Diretor e Gerente leem; a view calcula saldo e vencido", async () => {
    for (const r of ["admin_geral", "admin"] as const) {
      expect((await as(ids[r], "SELECT * FROM public.project_receipts")).rows).toHaveLength(3);
      const [t] = (await as(ids[r], `SELECT * FROM public.project_receipt_totals WHERE project_id='${P}'`)).rows;
      expect(Number(t.recebido_bruto)).toBe(6000); expect(Number(t.recebido_liquido)).toBe(5400);
      expect(Number(t.em_aberto)).toBe(2000); expect(Number(t.vencido)).toBe(2000); expect(Number(t.previsto)).toBe(500);
      expect(Number(t.saldo_a_receber)).toBe(4000); expect(t.sem_valor_venda).toBe(false);
    }
  });
  it("status inválido é recusado", async () => {
    await expect(as(ids.admin, `INSERT INTO public.project_receipts(project_id,description,gross_amount,status) VALUES ('${P}','x',1,'vencido')`)).rejects.toThrow();
  });
});
