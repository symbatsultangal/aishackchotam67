import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Microphone, Plus, SquaresFour, Warning } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSchool } from "@/context/SchoolContext";
import { navItems } from "@/lib/navigation";

export function CommandPalette() {
  const navigate = useNavigate();
  const { currentUser, staff } = useSchool();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "?") setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const rows = useMemo(() => {
    const roleItems = navItems
      .filter((item) => currentUser && item.roles.includes(currentUser.role))
      .map((item) => ({
        label: `Перейти: ${item.label}`,
        description: item.path,
        icon: item.icon,
        action: () => navigate(item.path),
      }));
    const actions = [
      { label: "Новая задача", description: "Создать поручение", icon: Plus, action: () => navigate("/dashboard/tasks") },
      { label: "Инцидент", description: "Открыть мониторинг", icon: Warning, action: () => navigate("/dashboard/incidents") },
      { label: "Голосовая команда", description: "Записать поручение", icon: Microphone, action: () => navigate("/dashboard/voice") },
      { label: "Главная", description: "Вернуться на дашборд", icon: SquaresFour, action: () => navigate("/") },
    ];
    const staffRows = staff.slice(0, 8).map((member) => ({
      label: member.displayName,
      description: member.roles.join(", "),
      icon: CheckSquare,
      action: () => navigate("/admin/staff"),
    }));
    return [...roleItems, ...actions, ...staffRows].filter((row) =>
      `${row.label} ${row.description}`.toLowerCase().includes(query.toLowerCase()),
    );
  }, [currentUser, navigate, query, staff]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0">
        <DialogTitle className="sr-only">Командная палитра</DialogTitle>
        <div className="border-b border-gray-100 p-4">
          <Input
            autoFocus
            placeholder="Поиск или команда..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={`${row.label}-${row.description}`}
                className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-gray-50"
                type="button"
                onClick={() => {
                  row.action();
                  setOpen(false);
                }}
              >
                <Icon className="size-5 text-brand-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{row.label}</span>
                  <span className="block text-xs text-gray-400">{row.description}</span>
                </span>
                <span className="text-xs text-gray-400">Enter</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
