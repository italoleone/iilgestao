import { useState, useMemo, useCallback } from "react";
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

const normalize = (str: string) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function highlightMatch(text: string, query: string) {
  if (!query) return <>{text}</>;
  const normText = normalize(text);
  const normQuery = normalize(query);
  const idx = normText.indexOf(normQuery);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-primary">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
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
    const normSearch = normalize(search);
    return projects.filter(
      (p) =>
        normalize(p.name).includes(normSearch) ||
        (p.client && normalize(p.client).includes(normSearch))
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
            <span className="truncate flex-1 text-left">
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
        <PopoverContent
          className="min-w-[320px] max-w-[520px] w-max p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar projeto..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[340px]">
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
                        "mr-2 h-4 w-4 shrink-0",
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
                        "mr-2 h-4 w-4 shrink-0",
                        value === project.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="whitespace-normal break-words leading-snug">
                        {highlightMatch(project.name, search)}
                      </span>
                      {project.client && (
                        <span className="text-xs text-muted-foreground whitespace-normal break-words">
                          {highlightMatch(project.client, search)}
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