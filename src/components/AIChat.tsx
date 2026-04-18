import { useState } from "react";
import { PaperPlaneTilt, Sparkle, X } from "@phosphor-icons/react";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSchool } from "@/context/SchoolContext";

type Message = {
  role: "user" | "assistant";
  text: string;
};

export function AIChat() {
  const { schoolId } = useSchool();
  const retrieve = useAction(api["modules/rag/retrieval"].retrieveContext);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Спроси меня о нормативах, задачах или школьных процедурах." },
  ]);

  async function send() {
    if (!schoolId || !input.trim()) return;
    const question = input.trim();
    setInput("");
    setMessages((current) => [...current, { role: "user", text: question }]);
    setLoading(true);
    try {
      const chunks = await retrieve({ schoolId, queryText: question, limit: 4 });
      const answer =
        chunks.length > 0
          ? chunks.map((chunk) => chunk.text.slice(0, 220)).join("\n\n")
          : "В базе документов пока нет подходящего ответа.";
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        className="fixed bottom-20 right-5 z-20 flex size-14 items-center justify-center rounded-full bg-brand-accent text-white shadow-2xl md:bottom-6"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Sparkle className="size-6" aria-hidden />
        <span className="sr-only">AI Ассистент</span>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-20 right-5 z-30 flex h-[32rem] w-[min(380px,calc(100vw-2rem))] flex-col rounded-xl bg-white shadow-2xl md:bottom-6"
    >
      <div className="flex h-14 items-center justify-between border-b border-gray-100 px-4">
        <p className="font-medium text-gray-900">AI Ассистент</p>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-brand-accent px-4 py-2 text-sm text-white"
                  : "mr-auto max-w-[85%] rounded-2xl border border-gray-100 bg-white px-4 py-2 text-sm text-gray-700"
              }
            >
              {message.text}
            </div>
          ))}
          {loading ? <div className="text-sm text-gray-400">Ищем ответ...</div> : null}
        </div>
      </div>
      <div className="flex gap-2 border-t border-gray-100 p-3">
        <Textarea
          className="max-h-28 min-h-11"
          placeholder="Напиши вопрос..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <Button size="icon" onClick={() => void send()}>
          <PaperPlaneTilt aria-hidden />
        </Button>
      </div>
    </motion.div>
  );
}
