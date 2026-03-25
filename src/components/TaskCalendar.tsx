import { useMemo } from "react";
import { type Task, type Project } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskCalendarProps {
  tasks: Task[];
  projects?: Project[];
  month: number; // 0-indexed
  year: number;
  onMonthChange: (month: number, year: number) => void;
}

interface DayProjectGroup {
  projectId: string;
  projectName: string;
  tasks: Task[];
  hasOverdue: boolean;
  hasInProgress: boolean;
  allCompleted: boolean;
}

export function TaskCalendar({ tasks, projects = [], month, year, onMonthChange }: TaskCalendarProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthName = new Date(year, month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const projectMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => { map[p.id] = p.name; });
    return map;
  }, [projects]);

  const groupedByDay = useMemo(() => {
    const map: Record<number, DayProjectGroup[]> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayTasks: Task[] = [];
      tasks.forEach((task) => {
        const start = parseLocalDate(task.startDate);
        const end = parseLocalDate(task.endDate);
        if (date >= start && date <= end) {
          dayTasks.push(task);
        }
      });

      // Group by project
      const projectGroups: Record<string, Task[]> = {};
      dayTasks.forEach((t) => {
        if (!projectGroups[t.projectId]) projectGroups[t.projectId] = [];
        projectGroups[t.projectId].push(t);
      });

      map[d] = Object.entries(projectGroups).map(([pid, ptasks]) => {
        const hasOverdue = ptasks.some((t) => new Date(t.endDate) < new Date() && t.status !== "concluida");
        const hasInProgress = ptasks.some((t) => t.status === "em_andamento");
        const allCompleted = ptasks.every((t) => t.status === "concluida");
        return {
          projectId: pid,
          projectName: projectMap[pid] || "Projeto",
          tasks: ptasks,
          hasOverdue,
          hasInProgress,
          allCompleted,
        };
      });
    }
    return map;
  }, [tasks, projects, month, year, daysInMonth, projectMap]);

  const prevMonth = () => {
    if (month === 0) onMonthChange(11, year - 1);
    else onMonthChange(month - 1, year);
  };

  const nextMonth = () => {
    if (month === 11) onMonthChange(0, year + 1);
    else onMonthChange(month + 1, year);
  };

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-base font-semibold capitalize">{monthName}</h3>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 border rounded-lg overflow-hidden">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 bg-muted/50 border-b">
            {d}
          </div>
        ))}

        {cells.map((day, idx) => (
          <div
            key={idx}
            className={`min-h-[100px] border-b border-r p-1 ${
              day === null ? "bg-muted/20" : ""
            } ${day && isToday(day) ? "bg-primary/5" : ""}`}
          >
            {day && (
              <>
                <div className={`text-xs font-medium mb-0.5 px-1 ${isToday(day) ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  {day}
                </div>
                <div className="space-y-0.5 overflow-y-auto max-h-[80px]">
                  {groupedByDay[day]?.slice(0, 3).map((group) => {
                    const statusBorder = group.allCompleted
                      ? "border-l-2 border-l-success"
                      : group.hasInProgress
                        ? "border-l-2 border-l-info"
                        : group.hasOverdue
                          ? "border-l-2 border-l-destructive"
                          : "border-l-2 border-l-muted-foreground/30";
                    const statusBg = group.allCompleted
                      ? "bg-success/5"
                      : group.hasInProgress
                        ? "bg-info/5"
                        : group.hasOverdue
                          ? "bg-destructive/5"
                          : "bg-card";
                    const statusLabel = group.allCompleted
                      ? "Concluído"
                      : group.hasOverdue
                        ? "Atrasado"
                        : group.hasInProgress
                          ? "Em andamento"
                          : "Não iniciado";
                    return (
                      <div
                        key={group.projectId}
                        className={`text-[10px] leading-tight p-1 rounded ${statusBorder} ${statusBg} truncate`}
                        title={`${group.projectName} — ${group.tasks.length} tarefa(s) — ${statusLabel}`}
                      >
                        <span className="font-semibold">{group.projectName.length > 22 ? group.projectName.slice(0, 22) + "…" : group.projectName}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-muted-foreground">{group.tasks.length} tarefa{group.tasks.length > 1 ? "s" : ""}</span>
                          {group.hasOverdue && <span className="text-destructive font-medium">!</span>}
                        </div>
                      </div>
                    );
                  })}
                  {(groupedByDay[day]?.length || 0) > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">
                      +{groupedByDay[day].length - 3} mais
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
