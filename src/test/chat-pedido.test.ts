// @vitest-environment node
import { describe, it, expect } from "vitest";
import { encodeDraft, extractMentions, isPedido, mentionToken, mentionsToPlain, stripMentions } from "../../supabase/functions/_shared/mentions";
import { demandTypeFor, mayConclude, validatePedido, DAILY_LIMIT } from "../../supabase/functions/chat-pedido/rules";

const P = "11111111-1111-4111-8111-111111111111";
const A = "22222222-2222-4222-8222-222222222222";
const B = "33333333-3333-4333-8333-333333333333";
const ME = "44444444-4444-4444-8444-444444444444";
const people = [{ id: A, status: "active" }, { id: B, status: "active" }, { id: ME, status: "active" }];
const text = (s: string) => `${mentionToken("p", P, "123 Edifício Sol")} ${mentionToken("u", A, "Ana")} ${s}`;

describe("menções", () => {
  it("monta e extrai tokens de projeto e pessoa", () => {
    expect(mentionToken("p", P, "Obra | A]")).toBe(`@[p:${P}|Obra A]`);
    expect(extractMentions(text("revisar"))).toEqual([{ type: "p", id: P, name: "123 Edifício Sol" }, { type: "u", id: A, name: "Ana" }]);
  });
  it("converte tokens em texto simples e remove para a descrição", () => {
    expect(mentionsToPlain(text("revisar"))).toBe("@123 Edifício Sol @Ana revisar");
    expect(stripMentions(text("revisar prancha"))).toBe("revisar prancha");
  });
  it("troca o @Nome digitado pelo token ao enviar", () => {
    expect(encodeDraft("@Ana veja @Obra X", [{ type: "u", id: A, name: "Ana" }, { type: "p", id: P, name: "Obra X" }])).toBe(`@[u:${A}|Ana] veja @[p:${P}|Obra X]`);
  });
  it("só é pedido com exatamente 1 projeto e 1 a 3 pessoas", () => {
    expect(isPedido(text("x"))).toBe(true);
    expect(isPedido(mentionToken("p", P, "X") + " só projeto")).toBe(false);
    expect(isPedido(mentionToken("u", A, "Ana") + " só pessoa")).toBe(false);
  });
});

describe("validação do pedido", () => {
  const base = { authorId: ME, project: { id: P }, people, todayCounts: {} };
  it("aceita pedido válido e devolve a descrição sem tokens", () => {
    expect(validatePedido({ ...base, text: text("revisar a prancha 3") })).toEqual({ ok: true, projectId: P, personIds: [A], description: "revisar a prancha 3" });
  });
  it("recusa texto com menos de 5 caracteres", () => { expect(validatePedido({ ...base, text: text("ok") }).ok).toBe(false); });
  it("recusa mencionar a si mesmo", () => { expect(validatePedido({ ...base, text: text("revisar tudo") + " " + mentionToken("u", ME, "Eu") }).ok).toBe(false); });
  it("recusa pessoa inativa ou projeto inexistente", () => {
    expect(validatePedido({ ...base, people: [{ id: A, status: "inactive" }], text: text("revisar tudo") }).ok).toBe(false);
    expect(validatePedido({ ...base, project: null, text: text("revisar tudo") }).ok).toBe(false);
  });
  it("limita a 20 pedidos por pessoa por dia", () => {
    expect(DAILY_LIMIT).toBe(20);
    expect(validatePedido({ ...base, todayCounts: { [A]: 19 }, text: text("revisar tudo") }).ok).toBe(true);
    expect(validatePedido({ ...base, todayCounts: { [A]: 20 }, text: text("revisar tudo") }).ok).toBe(false);
  });
  it("mapeia disciplina do projeto para o tipo de demanda", () => {
    expect(demandTypeFor("estrutural")).toBe("estrutura");
    expect(demandTypeFor("hidraulica")).toBe("hidraulica");
    expect(demandTypeFor("eletrica")).toBe("eletrica");
  });
});

describe("conclusão", () => {
  it("só o responsável pela demanda conclui", () => {
    expect(mayConclude(A, A)).toBe(true);
    expect(mayConclude(ME, A)).toBe(false);
    expect(mayConclude(A, null)).toBe(false);
  });
});
