import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Microphone, Spinner, Warning } from "@phosphor-icons/react";
import { useMutation, useQuery, useAction } from "convex/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSchool } from "@/context/SchoolContext";

type EditableTask = {
  title: string;
  description: string;
  assigneeStaffId: Id<"staff"> | null;
  dueAt: string | null;
  dueText: string;
  priority: "low" | "medium" | "high";
  matchConfidence: "exact" | "fuzzy" | "none";
  candidateStaffIds: Id<"staff">[];
  originalAssigneeName: string;
};

export function VoiceModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { schoolId, currentStaff } = useSchool();
  const createUploadUrl = useMutation(api["modules/ops/voice"].createDashboardUpload);
  const submitAudio = useMutation(api["modules/ops/voice"].submitDashboardAudio);
  const submitTranscript = useMutation(api["modules/ops/voice"].submitDashboardTranscript);
  const confirmCommand = useAction(api["modules/ops/voice"].confirmDirectorCommand);

  const [recording, setRecording] = useState(false);
  const [commandId, setCommandId] = useState<Id<"voiceCommands"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualTranscript, setManualTranscript] = useState("");
  const [editableTasks, setEditableTasks] = useState<EditableTask[]>([]);
  const [confirming, setConfirming] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const status = useQuery(
    api["modules/ops/voice"].getCommandStatus,
    commandId ? { commandId } : "skip",
  );

  const staffDirectory = useMemo(() => status?.staffDirectory ?? [], [status]);

  // Sync LLM plan → editable state when the plan lands.
  useEffect(() => {
    if (status?.status === "planned" && status.plan?.tasks) {
      setEditableTasks(
        status.plan.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          assigneeStaffId: task.assigneeStaffId,
          dueAt: task.dueAt,
          dueText: task.dueText,
          priority: task.priority,
          matchConfidence: task.matchConfidence,
          candidateStaffIds: task.candidateStaffIds,
          originalAssigneeName: task.assigneeName,
        })),
      );
    }
  }, [status?.status, status?.plan]);

  useEffect(() => {
    if (status?.status === "routed") {
      if (status.substitutionRequestId) {
        toast.success("Создана заявка на замену. Открой экран замен.");
      } else {
        toast.success("Задачи созданы и отправлены исполнителям.");
      }
      // Reset modal state after a brief display window.
      const timer = setTimeout(() => {
        setCommandId(null);
        setEditableTasks([]);
        onOpenChange(false);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [status?.status, status?.substitutionRequestId, onOpenChange]);

  async function upload(blob: Blob) {
    if (!schoolId || !currentStaff) {
      toast.error("Не удалось сохранить. Проверь соединение.");
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await createUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      const json = (await response.json()) as { storageId: Id<"_storage"> };
      const nextCommandId = await submitAudio({
        schoolId,
        createdByStaffId: currentStaff._id,
        audioStorageId: json.storageId,
      });
      setCommandId(nextCommandId);
    } catch {
      toast.error("Ошибка при загрузке файла. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function submitManualTranscript() {
    if (!schoolId || !currentStaff || !manualTranscript.trim()) return;
    setBusy(true);
    try {
      const nextCommandId = await submitTranscript({
        schoolId,
        createdByStaffId: currentStaff._id,
        transcript: manualTranscript.trim(),
      });
      setCommandId(nextCommandId);
      setManualTranscript("");
    } catch {
      toast.error("Не удалось отправить текст команды.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    // Fallback path for browsers that don't support MediaRecorder
    // (e.g. older Safari): surface typing UI instead of crashing.
    if (typeof window === "undefined" || typeof (window as any).MediaRecorder === "undefined") {
      toast.info("Браузер не поддерживает запись — напиши текст ниже.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void upload(new Blob(chunksRef.current, { type: "audio/webm" }));
      };
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Не удалось получить доступ к микрофону.");
    }
  }

  function updateTask(index: number, patch: Partial<EditableTask>) {
    setEditableTasks((prev) =>
      prev.map((task, i) => (i === index ? { ...task, ...patch } : task)),
    );
  }

  function removeTask(index: number) {
    setEditableTasks((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitConfirmed() {
    if (!commandId) return;
    const invalid = editableTasks.some((task) => !task.assigneeStaffId);
    if (invalid) {
      toast.error("У каждой задачи должен быть исполнитель.");
      return;
    }
    setConfirming(true);
    try {
      await confirmCommand({
        commandId,
        editedPlan: {
          tasks: editableTasks.map((task) => ({
            title: task.title,
            description: task.description,
            assigneeStaffId: task.assigneeStaffId as Id<"staff">,
            dueAt: task.dueAt ?? undefined,
            priority: task.priority,
          })),
        },
      });
    } catch {
      toast.error("Не удалось создать задачи.");
    } finally {
      setConfirming(false);
    }
  }

  async function submitSubstitutionConfirmed() {
    if (!commandId) return;
    setConfirming(true);
    try {
      await confirmCommand({ commandId });
    } catch {
      toast.error("Не удалось создать заявку на замену.");
    } finally {
      setConfirming(false);
    }
  }

  const intent = status?.intent ?? null;
  const plan = status?.plan ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl p-8">
        <DialogTitle className="sr-only">Голосовая команда</DialogTitle>

        {!commandId ? (
          <RecordingPanel
            recording={recording}
            busy={busy}
            onToggle={toggleRecording}
            manualTranscript={manualTranscript}
            onManualChange={setManualTranscript}
            onManualSubmit={submitManualTranscript}
          />
        ) : status?.status === "routed" ? (
          <div className="flex flex-col items-center py-8">
            <CheckCircle className="size-12 text-green-600" aria-hidden />
            <p className="mt-4 text-lg font-medium">Готово</p>
          </div>
        ) : status?.status === "planned" && plan ? (
          <PlanReviewPanel
            intent={intent}
            transcript={status.transcript ?? ""}
            plan={plan}
            editableTasks={editableTasks}
            staffDirectory={staffDirectory}
            confirming={confirming}
            onUpdateTask={updateTask}
            onRemoveTask={removeTask}
            onConfirmTasks={submitConfirmed}
            onConfirmSubstitution={submitSubstitutionConfirmed}
            onCancel={() => {
              setCommandId(null);
              setEditableTasks([]);
            }}
          />
        ) : (
          <ProcessingPanel transcript={status?.transcript} status={status?.status} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecordingPanel({
  recording,
  busy,
  onToggle,
  manualTranscript,
  onManualChange,
  onManualSubmit,
}: {
  recording: boolean;
  busy: boolean;
  onToggle: () => void;
  manualTranscript: string;
  onManualChange: (value: string) => void;
  onManualSubmit: () => void;
}) {
  return (
    <div className="text-center">
      <motion.div animate={recording ? { scale: [1, 1.08, 1] } : { scale: 1 }}>
        <Microphone className="mx-auto size-16 text-brand-accent" aria-hidden />
      </motion.div>
      <p className="mt-6 text-xl font-medium text-gray-900">
        {recording ? "Запись..." : "Нажми, чтобы говорить"}
      </p>
      <div className="mt-5 flex justify-center gap-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className="h-8 w-1 animate-waveform rounded-full bg-brand-accent"
            style={{ animationDelay: `${index * 80}ms` }}
          />
        ))}
      </div>
      <Button className="mt-6 w-full" onClick={() => void onToggle()} disabled={busy}>
        {busy ? <Spinner className="animate-spin" aria-hidden /> : null}
        {recording ? "Остановить запись" : "Начать запись"}
      </Button>
      <div className="mt-6 border-t pt-4 text-left">
        <p className="text-sm font-medium text-gray-700">Или набери текст команды</p>
        <Textarea
          className="mt-2"
          rows={3}
          placeholder="Например: Марат, закупи воду на завтра к 14:00"
          value={manualTranscript}
          onChange={(event) => onManualChange(event.target.value)}
        />
        <Button
          className="mt-2 w-full"
          variant="outline"
          disabled={busy || !manualTranscript.trim()}
          onClick={() => void onManualSubmit()}
        >
          Отправить текст
        </Button>
      </div>
    </div>
  );
}

function ProcessingPanel({
  transcript,
  status,
}: {
  transcript?: string;
  status?: string;
}) {
  return (
    <div className="py-6 text-center">
      <Spinner className="mx-auto size-10 animate-spin text-brand-accent" aria-hidden />
      <p className="mt-4 text-sm text-gray-600">
        {status === "uploaded" || status === "transcribed"
          ? "Расшифровываем аудио..."
          : "Планируем задачи..."}
      </p>
      {transcript ? (
        <p className="mt-3 text-sm italic text-gray-500">{transcript}</p>
      ) : null}
    </div>
  );
}

function PlanReviewPanel({
  intent,
  transcript,
  plan,
  editableTasks,
  staffDirectory,
  confirming,
  onUpdateTask,
  onRemoveTask,
  onConfirmTasks,
  onConfirmSubstitution,
  onCancel,
}: {
  intent: string | null;
  transcript: string;
  plan: NonNullable<NonNullable<ReturnType<typeof useQuery<any>>>>["plan"] extends infer P
    ? P
    : any;
  editableTasks: EditableTask[];
  staffDirectory: Array<{ _id: Id<"staff">; displayName: string; fullName: string }>;
  confirming: boolean;
  onUpdateTask: (index: number, patch: Partial<EditableTask>) => void;
  onRemoveTask: (index: number) => void;
  onConfirmTasks: () => void;
  onConfirmSubstitution: () => void;
  onCancel: () => void;
}) {
  // Narrow intent for rendering.
  if (intent === "substitution" && plan?.substitution) {
    return (
      <div>
        <p className="text-xs uppercase tracking-wide text-brand-accent">Распознано: замена</p>
        <p className="mt-2 text-sm italic text-gray-600">«{transcript}»</p>
        <div className="mt-4 rounded-lg bg-orange-50 p-4">
          <p className="text-sm">
            <strong>Отсутствует:</strong> {plan.substitution.absentTeacherName}
            {plan.substitution.absentTeacherStaffId ? (
              <Badge className="ml-2 bg-green-100 text-green-700">сопоставлено</Badge>
            ) : (
              <Badge className="ml-2 bg-red-100 text-red-700">не найдено</Badge>
            )}
          </p>
          <p className="text-sm">
            <strong>Дата:</strong> {plan.substitution.date}
          </p>
          <p className="text-sm">
            <strong>Уроки:</strong> {plan.substitution.lessons.join(", ") || "—"}
          </p>
          <p className="text-sm">
            <strong>Причина:</strong> {plan.substitution.reason}
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Отменить
          </Button>
          <Button
            onClick={() => void onConfirmSubstitution()}
            disabled={confirming || !plan.substitution.absentTeacherStaffId}
          >
            {confirming ? <Spinner className="animate-spin" aria-hidden /> : null}
            Создать заявку
          </Button>
        </div>
      </div>
    );
  }

  if (intent === "unclear" || editableTasks.length === 0) {
    return (
      <div className="py-6 text-center">
        <Warning className="mx-auto size-10 text-amber-500" aria-hidden />
        <p className="mt-4 text-sm text-gray-700">
          Не получилось понять команду. Попробуй ещё раз с более чёткой формулировкой.
        </p>
        <p className="mt-3 text-sm italic text-gray-500">«{transcript}»</p>
        <Button className="mt-4" variant="outline" onClick={onCancel}>
          Закрыть
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-brand-accent">Предпросмотр задач</p>
      <p className="mt-2 text-sm italic text-gray-600">«{transcript}»</p>
      <div className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto">
        {editableTasks.map((task, index) => (
          <TaskRow
            key={index}
            task={task}
            staffDirectory={staffDirectory}
            onUpdate={(patch) => onUpdateTask(index, patch)}
            onRemove={() => onRemoveTask(index)}
          />
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Отменить
        </Button>
        <Button
          onClick={() => void onConfirmTasks()}
          disabled={confirming || editableTasks.length === 0}
        >
          {confirming ? <Spinner className="animate-spin" aria-hidden /> : null}
          Подтвердить и создать
        </Button>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  staffDirectory,
  onUpdate,
  onRemove,
}: {
  task: EditableTask;
  staffDirectory: Array<{ _id: Id<"staff">; displayName: string; fullName: string }>;
  onUpdate: (patch: Partial<EditableTask>) => void;
  onRemove: () => void;
}) {
  const confidence = task.matchConfidence;
  const badgeClass =
    confidence === "exact"
      ? "bg-green-100 text-green-700"
      : confidence === "fuzzy"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";
  const badgeText =
    confidence === "exact"
      ? "точное совпадение"
      : confidence === "fuzzy"
        ? "подобрано"
        : "выбери исполнителя";

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <Input
          className="font-medium"
          value={task.title}
          onChange={(event) => onUpdate({ title: event.target.value })}
        />
        <Button variant="ghost" size="sm" onClick={onRemove}>
          ✕
        </Button>
      </div>
      <Textarea
        className="mt-2"
        rows={2}
        value={task.description}
        onChange={(event) => onUpdate({ description: event.target.value })}
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Исполнитель</label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
            value={task.assigneeStaffId ?? ""}
            onChange={(event) =>
              onUpdate({
                assigneeStaffId: (event.target.value || null) as Id<"staff"> | null,
                matchConfidence: event.target.value ? "exact" : "none",
              })
            }
          >
            <option value="">— выбери —</option>
            {staffDirectory.map((staff) => (
              <option key={staff._id} value={staff._id}>
                {staff.displayName}
              </option>
            ))}
          </select>
          <div className="mt-1 flex items-center gap-2">
            <Badge className={badgeClass}>{badgeText}</Badge>
            {task.originalAssigneeName ? (
              <span className="text-xs text-gray-500">из фразы: «{task.originalAssigneeName}»</span>
            ) : null}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">Срок</label>
          <Input
            type="datetime-local"
            value={task.dueAt ? toDatetimeLocal(task.dueAt) : ""}
            onChange={(event) =>
              onUpdate({
                dueAt: event.target.value
                  ? new Date(event.target.value).toISOString()
                  : null,
              })
            }
          />
          {task.dueText ? (
            <p className="mt-1 text-xs text-gray-500">из фразы: «{task.dueText}»</p>
          ) : null}
        </div>
      </div>
      <div className="mt-2">
        <label className="text-xs text-gray-500">Приоритет</label>
        <select
          className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
          value={task.priority}
          onChange={(event) =>
            onUpdate({ priority: event.target.value as "low" | "medium" | "high" })
          }
        >
          <option value="low">низкий</option>
          <option value="medium">средний</option>
          <option value="high">высокий</option>
        </select>
      </div>
    </div>
  );
}

function toDatetimeLocal(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    // strip seconds + TZ, take local
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}`;
  } catch {
    return "";
  }
}
