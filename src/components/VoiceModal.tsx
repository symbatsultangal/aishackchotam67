import { useEffect, useRef, useState } from "react";
import { Microphone, Spinner } from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSchool } from "@/context/SchoolContext";

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
  const [recording, setRecording] = useState(false);
  const [commandId, setCommandId] = useState<Id<"voiceCommands"> | null>(null);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const status = useQuery(
    api["modules/ops/voice"].getCommandStatus,
    commandId ? { commandId } : "skip",
  );

  useEffect(() => {
    if (status?.status === "routed" && status.tasks.length > 0) {
      toast.success(`Создано ${status.tasks.length} задач из голосовой команды`);
    }
  }, [status]);

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

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
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
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-12 text-center">
        <DialogTitle className="sr-only">Голосовая команда</DialogTitle>
        <motion.div animate={recording ? { scale: [1, 1.08, 1] } : { scale: 1 }}>
          <Microphone className="mx-auto size-16 text-brand-accent" aria-hidden />
        </motion.div>
        <p className="mt-6 text-xl font-medium text-gray-900">
          {recording ? "Запись..." : "Нажми чтобы говорить"}
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
        <Button className="mt-8 w-full" onClick={() => void toggleRecording()} disabled={busy}>
          {busy ? <Spinner className="animate-spin" aria-hidden /> : null}
          {recording ? "Остановить запись" : "Начать запись"}
        </Button>
        {status?.transcript ? (
          <p className="mt-5 text-sm italic text-gray-600">{status.transcript}</p>
        ) : busy || status?.status === "uploaded" || status?.status === "transcribed" ? (
          <p className="mt-5 text-sm text-gray-500">Расшифровываем аудио...</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
