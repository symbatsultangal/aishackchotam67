import { useEffect, useState } from "react";
import { formatRelativeMinutes } from "@/lib/utils";

export function useFreshness(dependency: unknown) {
  const [updatedAt, setUpdatedAt] = useState(Date.now());

  useEffect(() => {
    if (dependency !== undefined) {
      setUpdatedAt(Date.now());
    }
  }, [dependency]);

  return {
    updatedAt,
    label: `Обновлено ${formatRelativeMinutes(updatedAt)}`,
    refresh: () => setUpdatedAt(Date.now()),
  };
}
