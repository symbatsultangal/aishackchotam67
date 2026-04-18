export function ContextualDelta({
  current,
  previous,
  thresholdGood,
}: {
  current: number;
  previous?: number;
  thresholdGood?: number;
}) {
  if (previous === undefined) {
    const good = thresholdGood === undefined || current >= thresholdGood;
    return (
      <span className={good ? "text-green-600" : "text-amber-600"}>
        {good ? "норма для этого дня" : "стоит проверить"}
      </span>
    );
  }
  const delta = current - previous;
  if (delta === 0) return <span className="text-gray-400">без изменений</span>;
  return (
    <span className={delta > 0 ? "text-red-500" : "text-green-600"}>
      {delta > 0 ? "↑" : "↓"} {Math.abs(delta)} от вчера
    </span>
  );
}
