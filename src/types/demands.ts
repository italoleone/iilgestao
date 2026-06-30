export const DEMAND_TYPE_LABELS: Record<string, string> = {
  estrutura: "Estrutura",
  alvenaria_estrutural: "Alvenaria Estrutural",
  hidraulica: "Hidráulica",
  eletrica: "Elétrica",
};

export const DEMAND_TYPE_COLORS: Record<string, { badge: string; dot: string }> = {
  estrutura: { badge: "bg-blue-500/10 text-blue-600 border-blue-500/20", dot: "bg-blue-500" },
  alvenaria_estrutural: { badge: "bg-orange-500/10 text-orange-600 border-orange-500/20", dot: "bg-orange-500" },
  hidraulica: { badge: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20", dot: "bg-cyan-500" },
  eletrica: { badge: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", dot: "bg-yellow-500" },
};

export const DEMAND_TYPES = ["estrutura", "alvenaria_estrutural", "hidraulica", "eletrica"] as const;
export type DemandType = typeof DEMAND_TYPES[number];
