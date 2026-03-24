import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { getUserById, projects } from "@/data/mockData";
import { TASK_STATUS_LABELS, type Task, type TaskStatus } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const taskStatusColors: Record<TaskStatus, string> = {
  nao_iniciada: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluida: "bg-success text-success-foreground",
};

interface TaskCalendarProps {
  tasks: Task[];
  month: number; // 0-indexed
  year: number;
  onMonthChange: (month: number, year: number) => void;
  onTaskClick: (task: Task) => void;
}

export function TaskCalendar({ tasks, month, year, onMonthChange, onTaskClick }: TaskCalendarProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sunday

  const monthName = new Date(year, month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const tasksByDay = useMemo(() => {
    const map: Record<number, Task[]> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      map[d] = [];
    }
    tasks.forEach((task) => {
      const start = new Date(task.startDate);
      const end = new Date(task.endDate);
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        if (date >= start && date <= end) {
          map[d].push(task);
        }
      }
    });
    return map;
  }, [tasks, month, year, daysInMonth]);

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

  // Build grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-base font-semibold capitalize">{monthName}</h3>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 border rounded-lg overflow-hidden">
        {/* Week day headers */}
        {weekDays.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 bg-muted/50 border-b">
            {d}
          </div>
        ))}

        {/* Day cells */}
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
                  {tasksByDay[day]?.slice(0, 3).map((task) => {
                    const responsible = getUserById(task.responsible);
                    const isOverdue = new Date(task.endDate) < new Date() && task.status !== "concluida";
                    const statusBorder = task.status === "concluida"
                      ? "border-l-2 border-l-success"
                      : task.status === "em_andamento"
                        ? "border-l-2 border-l-info"
                        : isOverdue
                          ? "border-l-2 border-l-destructive"
                          : "border-l-2 border-l-muted-foreground/30";
                    const statusBg = task.status === "concluida"
                      ? "bg-success/5"
                      : task.status === "em_andamento"
                        ? "bg-info/5"
                        : isOverdue
                          ? "bg-destructive/5"
                          : "bg-card";
                    return (
                      <div
                        key={task.id}
                        className={`text-[10px] leading-tight p-1 rounded ${statusBorder} ${statusBg} truncate`}
                        title={`${task.name} — ${responsible?.name} — ${
                          isOverdue ? "ATRASADA" : task.status === "concluida" ? "Concluída" : task.status === "em_andamento" ? "Em andamento" : "Não iniciada"
                        }`}
                      >
                        <span className="font-medium">{task.name.length > 18 ? task.name.slice(0, 18) + "…" : task.name}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-muted-foreground">{responsible?.name?.split(" ")[0]}</span>
                          {isOverdue && <span className="text-destructive font-medium">!</span>}
                        </div>
                      </div>
                    );
                  })}
                  {(tasksByDay[day]?.length || 0) > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">
                      +{tasksByDay[day].length - 3} mais
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
