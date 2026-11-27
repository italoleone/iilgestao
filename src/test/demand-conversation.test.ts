// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { requestsForMe, filterRequestScope, chatSendAction } from "../lib/demandRequests";
import { replyRecipient } from "../../supabase/functions/chat-pedido/rules";
import { mentionToken } from "../../supabase/functions/_shared/mentions";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";
const P = "55555555-5555-4555-8555-555555555555";
const db = new PGlite();

describe("Pedidos para mim", () => {
  it("inclui pendentes atribuídos ao usuário em qualquer papel, sem depender do coordenador", () => {
    const pending = { id: "meu", assigned_to: B, created_by: A, is_done: false, created_at: "2026-11-27T10:00:00Z", coordenador_id: C };
    const newer = { ...pending, id: "novo", created_at: "2026-11-27T11:00:00Z" };
    const done = { ...pending, id: "feito", is_done: true };
    const other = { ...pending, id: "outro", assigned_to: C };
    expect(requestsForMe([pending, newer, done, other], B).map(d => d.id)).toEqual(["novo", "meu"]);
    expect(requestsForMe([pending], C)).toEqual([]);
    expect(requestsForMe([pending], undefined)).toEqual([]);
  });
  it("filtra para mim ou criadas por mim sem confundir os participantes", () => {
    const rows = [{ assigned_to: B, created_by: A, is_done: false, created_at: "" }, { assigned_to: A, created_by: C, is_done: true, created_at: "" }];
    expect(filterRequestScope(rows, "assigned", A)).toEqual([rows[1]]);
    expect(filterRequestScope(rows, "created", A)).toEqual([rows[0]]);
    expect(filterRequestScope(rows, "all", A)).toEqual(rows);
  });
  it("resposta com @ não cria pedido nem chama cobrança", () => {
    const text = `${mentionToken("p", P, "MEREB")} ${mentionToken("u", B, "Bruno")} já está feito`;
    expect(chatSendAction(text, D)).toBe("responder_pedido");
    expect(chatSendAction(text, null)).toBe("pedido");
    expect(chatSendAction("texto sem menções", null)).toBe("reply");
  });
});

describe("Conversa e gatilho — PostgreSQL isolado", () => {
  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      CREATE TABLE public.profiles(id uuid PRIMARY KEY, name text, status text);
      CREATE TABLE public.projects(id uuid PRIMARY KEY, name text);
      CREATE TABLE public.demands(id uuid PRIMARY KEY, project_id uuid, created_by uuid, assigned_to uuid, source text, description text, is_done boolean DEFAULT false, done_at timestamptz);
      CREATE TABLE public.chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, sender text, kind text, body text, demand_id uuid, actions jsonb, processed_at timestamptz);
      CREATE TABLE public.audit_log(table_name text, record_id text);
      CREATE FUNCTION public.fn_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN INSERT INTO public.audit_log VALUES(TG_TABLE_NAME,NEW.id::text); RETURN NULL; END $$;
      CREATE FUNCTION public.is_active_user() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND status='active') $$;
      GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role,anon;
      GRANT ALL ON public.demands,public.profiles,public.projects,public.chat_messages TO service_role;
      GRANT SELECT ON public.demands TO authenticated;
    `);
    const migration = readFileSync("drizzle/migrations/0005_conversa_pedidos_chat.sql", "utf8");
    await db.exec(migration.split("DO $block$")[0]);
    await db.exec(`CREATE TRIGGER trg_demands_pedido_concluido AFTER UPDATE ON public.demands FOR EACH ROW EXECUTE FUNCTION public.fn_demands_pedido_concluido();
      INSERT INTO public.profiles VALUES('${A}','Ana','active'),('${B}','Bruno','active'),('${C}','Carla','active');
      INSERT INTO public.projects VALUES('${P}','1129 - MEREB');`);
  }, 30000);
  beforeEach(async () => {
    await db.exec(`RESET ROLE; SELECT set_config('test.uid','',false); TRUNCATE public.chat_messages,public.demand_comments,public.audit_log,public.demands CASCADE;
      INSERT INTO public.demands VALUES('${D}','${P}','${A}','${B}','chat','[Pedido via chat] Verificar o MEREB',false,null);`);
  });
  afterAll(async () => { await db.close(); });

  it("responsável responde ao solicitante e solicitante responde ao responsável", async () => {
    expect(replyRecipient(B, { created_by: A, assigned_to: B })).toBe(A);
    expect(replyRecipient(A, { created_by: A, assigned_to: B })).toBe(B);
    await db.exec(`SET ROLE service_role; SELECT public.fn_respond_chat_pedido('${D}','${B}','Já está feito'); SELECT public.fn_respond_chat_pedido('${D}','${A}','Obrigado por confirmar'); RESET ROLE;`);
    const { rows } = await db.query<{ user_id: string; body: string; actions: { id: string }[] }>("SELECT user_id,body,actions FROM public.chat_messages WHERE sender='agente' ORDER BY body");
    const toA = rows.find(r => r.user_id === A);
    const toB = rows.find(r => r.user_id === B);
    expect(toA?.body).toContain("Bruno respondeu sobre @[p:");
    expect(toA?.actions.map(a => a.id)).toEqual(["responder_pedido"]);
    expect(toB?.body).toContain("Ana respondeu sobre @[p:");
    expect(toB?.actions.map(a => a.id)).toEqual(["concluir_pedido", "responder_pedido"]);
    expect((await db.query("SELECT * FROM public.demand_comments")).rows).toHaveLength(2);
  });
  it("Já estava feito cria um comentário e um único aviso mesmo ao repetir", async () => {
    await db.exec(`SET ROLE service_role; SELECT public.fn_finish_chat_pedido('${D}','${B}','ja_feito'); SELECT public.fn_finish_chat_pedido('${D}','${B}','ja_feito'); RESET ROLE;`);
    const comments = (await db.query<{kind: string; body: string}>("SELECT kind,body FROM public.demand_comments")).rows;
    const messages = (await db.query<{user_id: string; body: string}>("SELECT user_id,body FROM public.chat_messages")).rows;
    expect(comments).toEqual([{ kind: "ja_feito", body: "Já estava feito" }]);
    expect(messages).toHaveLength(1);
    expect(messages[0].user_id).toBe(A);
    expect(messages[0].body).toContain("já estava feito.");
    expect((await db.query<{is_done: boolean}>("SELECT is_done FROM public.demands")).rows[0].is_done).toBe(true);
  });
  it("concluir e reabrir pela tela gravam histórico e uma nova conclusão avisa uma vez", async () => {
    await db.exec(`SELECT set_config('test.uid','${B}',false); UPDATE public.demands SET is_done=true WHERE id='${D}'; UPDATE public.demands SET is_done=false WHERE id='${D}'; UPDATE public.demands SET is_done=true WHERE id='${D}';`);
    expect((await db.query<{kind:string}>("SELECT kind FROM public.demand_comments ORDER BY created_at,id")).rows.map(r => r.kind).sort()).toEqual(["concluido", "concluido", "reaberto"]);
    expect((await db.query("SELECT * FROM public.chat_messages")).rows).toHaveLength(2);
    expect((await db.query("SELECT * FROM public.audit_log WHERE table_name='demand_comments'")).rows).toHaveLength(3);
  });
  it("não participante não pode responder e só assigned_to pode concluir", async () => {
    expect(replyRecipient(C, { created_by: A, assigned_to: B })).toBeNull();
    await expect(db.query(`SELECT public.fn_respond_chat_pedido('${D}','${C}','Não sou participante')`)).rejects.toThrow("Somente participantes");
    await expect(db.query(`SELECT public.fn_finish_chat_pedido('${D}','${A}','concluido')`)).rejects.toThrow("Somente o responsável");
    expect((await db.query("SELECT * FROM public.demand_comments")).rows).toHaveLength(0);
  });
  it("resposta com tokens mantém só a demanda original e fica processada para não virar cobrança", async () => {
    const text = `${mentionToken("p", P, "MEREB")} ${mentionToken("u", B, "Bruno")} já foi verificado`;
    await db.query("SELECT public.fn_respond_chat_pedido($1,$2,$3)", [D, A, text]);
    expect((await db.query("SELECT * FROM public.demands")).rows).toHaveLength(1);
    expect((await db.query<{body: string}>("SELECT body FROM public.demand_comments")).rows[0].body).toBe(text);
    expect((await db.query("SELECT * FROM public.chat_messages WHERE sender='usuario' AND processed_at IS NOT NULL")).rows).toHaveLength(1);
  });
  it("autenticados não inserem comentários nem chamam as RPCs diretamente", async () => {
    await db.exec(`SELECT set_config('test.uid','${B}',false); SET ROLE authenticated;`);
    expect((await db.query("SELECT * FROM public.demand_comments")).rows).toHaveLength(0);
    await expect(db.query(`INSERT INTO public.demand_comments(demand_id,author_id,body) VALUES('${D}','${B}','Direto')`)).rejects.toThrow("permission denied");
    await expect(db.query(`SELECT public.fn_respond_chat_pedido('${D}','${B}','Direto')`)).rejects.toThrow("permission denied");
    await expect(db.query(`SELECT public.fn_finish_chat_pedido('${D}','${B}','concluido')`)).rejects.toThrow("permission denied");
    await db.exec("RESET ROLE;");
  });
});