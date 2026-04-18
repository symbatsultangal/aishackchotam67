import { useEffect, useState } from "react";

export function AppLoader() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 10000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white">
      <div className="flex size-16 animate-pulse items-center justify-center rounded-full bg-brand-accent text-3xl font-light text-white">
        A
      </div>
      <p className="mt-4 text-xl font-light text-brand-purple">Digital Vice Principal</p>
      {slow ? (
        <p className="mt-2 text-sm text-gray-500">Проблема с подключением. Повторяем...</p>
      ) : null}
      <div className="fixed bottom-0 left-0 h-1 w-full overflow-hidden bg-purple-100">
        <div className="h-full w-1/2 animate-progress bg-brand-accent" />
      </div>
    </div>
  );
}
