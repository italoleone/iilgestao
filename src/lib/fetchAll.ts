/**
 * Busca todas as linhas de uma consulta paginando com .range(),
 * contornando o limite de 1.000 linhas por requisição do PostgREST.
 * `buildQuery` deve retornar uma consulta nova a cada chamada.
 * Sempre acrescenta .order("id") como desempate para ordenação estável.
 */
export async function fetchAllRows<T>(buildQuery: () => any, pageSize = 1000): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await buildQuery()
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
