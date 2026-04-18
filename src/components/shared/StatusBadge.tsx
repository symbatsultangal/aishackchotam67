import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

type StatusType = "incident" | "task" | "parser" | "substitution" | "document" | "compliance";

const labels: Record<string, string> = {
  open: "Открыт",
  in_progress: "В работе",
  resolved: "Решён",
  todo: "К выполнению",
  done: "Готово",
  canceled: "Отменено",
  pending: "Ожидает",
  processed: "Обработано",
  ignored: "Игнорировано",
  error: "Ошибка",
  ranked: "Подобраны",
  confirmed: "Подтверждено",
  applied: "Применено",
  uploaded: "Загружен",
  parsed: "Обработан",
  embedded: "Проиндексирован",
  pass: "Соответствует",
  warn: "Есть замечания",
  fail: "Нарушение",
};

function variantFor(status: string, type: StatusType) {
  if (["resolved", "done", "processed", "confirmed", "applied", "embedded", "pass"].includes(status)) {
    return "success" as const;
  }
  if (["error", "fail", "canceled"].includes(status)) return "danger" as const;
  if (["pending", "ranked", "uploaded", "parsed", "warn"].includes(status)) return "warning" as const;
  if (type === "incident" && status === "open") return "danger" as const;
  return "secondary" as const;
}

export function StatusBadge({ status, type }: { status: string; type: StatusType }) {
  return (
    <motion.span key={status} initial={{ scale: 1.2 }} animate={{ scale: 1 }}>
      <Badge variant={variantFor(status, type)}>{labels[status] ?? status}</Badge>
    </motion.span>
  );
}
