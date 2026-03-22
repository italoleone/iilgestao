import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { users, projects, tasks, getUserAllocatedHours, getUserWorkedHours } from "@/data/mockData";
import { ROLE_LABELS, DISCIPLINE_SHORT } from "@/types";

export default function Equipe() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="text-muted-foreground mt-1">{users.length} colaboradores</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((user, i) => {
            const allocatedHours = getUserAllocatedHours(user.id);
            const workedHours = getUserWorkedHours(user.id);
            const capacityPct = Math.round((allocatedHours / user.monthlyCapacityHours) * 100);
            const overloaded = capacityPct > 100;
            const userTasks = tasks.filter(
              (t) => t.responsible === user.id && t.status !== "concluida"
            );

            return (
              <Card
                key={user.id}
                className="shadow-sm animate-reveal-up"
                style={{ animationDelay: `${(i + 1) * 60}ms`, animationFillMode: "backwards" }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground shrink-0">
                      {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base">{user.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">{ROLE_LABELS[user.role]}</Badge>
                        <span className="text-xs text-muted-foreground">{DISCIPLINE_SHORT[user.discipline]}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Carga de trabalho</span>
                      <span className={`font-medium tabular-nums ${overloaded ? "text-destructive" : ""}`}>
                        {capacityPct}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(capacityPct, 100)}
                      className={`h-2 ${overloaded ? "[&>div]:bg-destructive" : ""}`}
                    />
                    {overloaded && (
                      <p className="text-xs text-destructive mt-1">⚠ Usuário sobrecarregado</p>
                    )}
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Horas alocadas (tarefas)</span>
                    <span className="tabular-nums">{allocatedHours}h / {user.monthlyCapacityHours}h</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Horas realizadas</span>
                    <span className="tabular-nums">{workedHours}h</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custo/hora</span>
                    <span className="tabular-nums">R$ {user.costPerHour}</span>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Tarefas ativas ({userTasks.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {userTasks.slice(0, 3).map((t) => (
                        <Badge key={t.id} variant="secondary" className="text-xs">
                          {t.name.length > 20 ? t.name.slice(0, 20) + "…" : t.name}
                        </Badge>
                      ))}
                      {userTasks.length > 3 && (
                        <Badge variant="secondary" className="text-xs">+{userTasks.length - 3}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
