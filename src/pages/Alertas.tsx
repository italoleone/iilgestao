import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { alerts, getUserById, projects } from "@/data/mockData";
import { AlertTriangle, Clock, TrendingDown, Users } from "lucide-react";

const severityColors = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-warning text-warning-foreground",
  low: "bg-info text-info-foreground",
};

const severityLabels = {
  high: "Crítico",
  medium: "Atenção",
  low: "Info",
};

const typeIcons = {
  atrasado: AlertTriangle,
  prazo_proximo: Clock,
  sobrecarga: Users,
  prejuizo: TrendingDown,
};

export default function Alertas() {
  const sorted = [...alerts].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <h1 className="text-2xl font-bold">Alertas</h1>
          <p className="text-muted-foreground mt-1">{alerts.length} alertas ativos</p>
        </div>

        <div className="space-y-3">
          {sorted.map((alert, i) => {
            const Icon = typeIcons[alert.type];
            return (
              <Card
                key={alert.id}
                className="shadow-sm animate-reveal-up"
                style={{ animationDelay: `${(i + 1) * 60}ms`, animationFillMode: "backwards" }}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  <div className={`p-2 rounded-lg ${alert.severity === "high" ? "bg-destructive/10" : alert.severity === "medium" ? "bg-warning/10" : "bg-info/10"}`}>
                    <Icon className={`h-4 w-4 ${alert.severity === "high" ? "text-destructive" : alert.severity === "medium" ? "text-warning" : "text-info"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                  </div>
                  <Badge variant="secondary" className={severityColors[alert.severity]}>
                    {severityLabels[alert.severity]}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
