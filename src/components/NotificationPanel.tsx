import { BellSlash, CheckSquare, Tray, Warning } from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useSchool } from "@/context/SchoolContext";
import { formatRelativeMinutes } from "@/lib/utils";

function routeForTemplate(templateKey: string) {
  if (templateKey.includes("incident")) return "/dashboard/incidents";
  if (templateKey.includes("substitution")) return "/dashboard/substitutions";
  if (templateKey.includes("task")) return "/dashboard/tasks";
  return "/dashboard";
}

export function NotificationPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { schoolId } = useSchool();
  const notifications =
    useQuery(api["modules/ops/notifications"].listRecent, schoolId ? { schoolId } : "skip") ?? [];
  const markSent = useMutation(api["modules/ops/notifications"].markSent);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof notifications>();
    for (const notification of notifications) {
      const key = notification.templateKey;
      map.set(key, [...(map.get(key) ?? []), notification]);
    }
    return Array.from(map.entries()).map(([key, rows]) => ({ key, rows }));
  }, [notifications]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(28rem,100vw)] p-0">
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-6">
          <SheetTitle>Уведомления</SheetTitle>
        </div>
        <div className="p-4">
          {grouped.length === 0 ? (
            <EmptyState
              icon={BellSlash}
              title="Вы в курсе всего"
              subtitle="Новых уведомлений нет"
            />
          ) : (
            <div className="flex flex-col gap-2">
              {grouped.map(({ key, rows }) => {
                const first = rows[0];
                const Icon = key.includes("incident")
                  ? Warning
                  : key.includes("task")
                    ? CheckSquare
                    : Tray;
                const title =
                  rows.length > 1
                    ? `${rows.length} новых события`
                    : typeof first?.payload?.text === "string"
                      ? first.payload.text.split("\n")[0]
                      : key;
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border-l-2 border-brand-accent bg-purple-50/30 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-1 size-5 text-brand-accent" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{title}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {first ? formatRelativeMinutes(first._creationTime) : ""}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              navigate(routeForTemplate(key));
                              onOpenChange(false);
                            }}
                          >
                            Просмотреть
                          </Button>
                          {first && first.status !== "sent" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void markSent({
                                  notificationId: first._id as Id<"notifications">,
                                  status: "sent",
                                }).then(() => toast.success("Уведомление отмечено"))
                              }
                            >
                              Отметить
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
