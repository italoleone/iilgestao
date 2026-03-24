import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ProjectOption {
  id: string;
  name: string;
  client?: string;
}

interface ProjectComboboxProps {
  projects: ProjectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
  triggerClassName?: string;
}

export function ProjectCombobox({
  projects,
  value,
  onValueChange,
  placeholder = "Selecionar projeto...",
  includeAll = false,
  allLabel = "Todos os projetos",
  className,
  triggerClassName,
}: ProjectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel = useMemo(() => {
    if (includeAll && value === "all") return allLabel;
    const found = projects.find((p) => p.id === value);
    return found?.name || "";
  }, [value, projects, includeAll, allLabel]);

  const filteredProjects = useMemo(() => {
    if (!search) return projects;
    const lower = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.client && p.client.toLowerCase().includes(lower))
    );
  }, [projects, search]);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              triggerClassName
            )}
          >
            <span className="truncate">
              {selectedLabel || placeholder}
            </span>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {value && value !== "all" && includeAll && (
                <X
                  className="h-3.5 w-3.5 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onValueChange("all");
                  }}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar projeto..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
              <CommandGroup>
                {includeAll && (
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      onValueChange("all");
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === "all" ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {allLabel}
                  </CommandItem>
                )}
                {filteredProjects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.id}
                    onSelect={() => {
                      onValueChange(project.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === project.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{project.name}</span>
                      {project.client && (
                        <span className="text-xs text-muted-foreground truncate">
                          {project.client}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
