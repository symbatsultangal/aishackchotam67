import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { ContextualDelta } from "@/components/shared/ContextualDelta";

export function KPICard({
  icon: Icon,
  value,
  label,
  delta,
  color = "#6B2FA0",
  onClick,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  delta?: number;
  color?: string;
  onClick?: () => void;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString("ru-RU"));

  useEffect(() => {
    const controls = animate(count, value, { duration: 0.8, ease: "easeOut" });
    return controls.stop;
  }, [count, value]);

  return (
    <motion.button
      className="min-h-24 rounded-lg bg-white p-5 text-left"
      style={{ color }}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(17, 24, 39, 0.08)" }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      type="button"
      onClick={onClick}
    >
      <Icon className="size-5" aria-hidden />
      <motion.span className="mt-3 block text-3xl font-bold tabular-nums" data-number>
        {rounded}
      </motion.span>
      <span className="mt-1 block text-xs text-gray-500">{label}</span>
      <span className="mt-1 block text-xs">
        <ContextualDelta current={value} previous={delta} />
      </span>
    </motion.button>
  );
}
