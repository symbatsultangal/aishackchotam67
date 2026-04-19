import { useMemo, useState } from "react";
import {
  ArrowsClockwise,
  BellSlash,
  ChartBar,
  CheckCircle,
  CheckSquare,
  ClipboardText,
  Export,
  FilePdf,
  Files,
  ForkKnife,
  Kanban,
  List,
  Microphone,
  Minus,
  Plus,
  Printer,
  SmileyBlank,
  Spinner,
  Tray,
  UploadSimple,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { VoiceModal } from "@/components/VoiceModal";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineEdit } from "@/components/shared/InlineEdit";
import { KPICard } from "@/components/shared/KPICard";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionLabel } from "@/components/shared/SectionLabel";
import { ChartSkeleton, SkeletonCard, SkeletonRow } from "@/components/shared/Skeletons";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSchool } from "@/context/SchoolContext";
import { useFreshness } from "@/hooks/useFreshness";
import { cn, formatRelativeMinutes, safePercent, todayIso } from "@/lib/utils";

type TaskStatus = "todo" | "in_progress" | "done" | "canceled";
type IncidentStatus = "open" | "in_progress" | "resolved";
type Priority = "low" | "medium" | "high";

const taskColumns: Array<{ status: TaskStatus; label: string }> = [
  { status: "todo", label: "К выполнению" },
  { status: "in_progress", label: "В процессе" },
  { status: "done", label: "Готово" },
  { status: "canceled", label: "Отменено" },
];

const incidentColumns: Array<{ status: IncidentStatus; label: string }> = [
  { status: "open", label: "Открытые" },
  { status: "in_progress", label: "В работе" },
  { status: "resolved", label: "Решены" },
];

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function Section({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-10", className)}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("border-b border-gray-100 py-3", className)}>{children}</div>;
}

function StaffName({ id }: { id?: Id<"staff"> }) {
  const { staffById } = useSchool();
  return <>{id ? staffById.get(id)?.displayName ?? staffById.get(id)?.fullName ?? "Сотрудник" : "Сотрудник"}</>;
}

function ClassCode({ id }: { id?: Id<"classes"> }) {
  const { classById } = useSchool();
  return <>{id ? classById.get(id)?.code ?? "Класс" : "Класс"}</>;
}

function timeBanner(openIncidentCount: number, missingClasses: number) {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  if (openIncidentCount > 0) {
    return { color: "bg-red-50 text-red-700", text: "Требуется внимание: есть открытые инциденты." };
  }
  if (hour < 9) {
    return {
      color: "bg-amber-50 text-amber-700",
      text: `Рабочий день начинается. ${missingClasses} классов ещё не сдали посещаемость.`,
    };
  }
  if (hour >= 17) {
    return { color: "bg-blue-50 text-blue-700", text: "Школьный день завершён. Итоги ниже." };
  }
  if (day === 5) {
    return { color: "bg-amber-50 text-amber-700", text: "Конец недели — не забудь недельный отчёт." };
  }
  return { color: "bg-green-50 text-green-700", text: "Школа работает в штатном режиме." };
}

function EmptyDataState() {
  return (
    <div className="rounded-lg bg-white p-5 text-sm text-gray-500">
      Загружаем данные...
    </div>
  );
}

export function DirectorDashboard() {
  const { schoolId, currentUser, currentStaff, classes, staffById } = useSchool();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const overview = useQuery(
    api["modules/dashboard/overview"].getOverview,
    schoolId ? { schoolId } : "skip",
  );
  const attendance = useQuery(
    api["modules/ops/attendance"].listByDate,
    schoolId ? { schoolId, date: todayIso() } : "skip",
  );
  const queues = useQuery(
    api["modules/dashboard/queues"].listReviewQueues,
    schoolId ? { schoolId } : "skip",
  );
  const substitutions = useQuery(
    api["modules/substitutions/requests"].listToday,
    schoolId ? { schoolId } : "skip",
  );
  const notifications = useQuery(
    api["modules/ops/notifications"].listRecent,
    schoolId ? { schoolId } : "skip",
  );
  const analytics = useQuery(
    api["modules/dashboard/analytics"].getSeries,
    schoolId ? { schoolId, days: 7 } : "skip",
  );
  const confirmOverride = useMutation(api["modules/substitutions/requests"].confirmOverride);
  const freshness = useFreshness(overview);

  const missingClasses = Math.max(0, classes.length - (attendance?.length ?? 0));
  const banner = timeBanner(overview?.openIncidentCount ?? 0, missingClasses);
  const present = attendance?.reduce((sum, row) => sum + row.presentCount, 0) ?? 0;
  const absent = attendance?.reduce((sum, row) => sum + row.absentCount, 0) ?? 0;
  const percent = safePercent(present, present + absent);

  return (
    <PageFrame>
      <PageHeader
        title={
          new Date().getHours() < 12
            ? `Қайырлы таң, ${currentUser?.name ?? "директор"}`
            : `Добрый день, ${currentUser?.name ?? "директор"}`
        }
        subtitle={new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
        refreshedAt={freshness.label}
        onRefresh={freshness.refresh}
      />
      <motion.div className={cn("mb-10 rounded-xl px-5 py-3 text-sm font-medium", banner.color)}>
        {banner.text}
      </motion.div>
      <div className="mb-10 grid gap-5 md:grid-cols-4">
        <KPICard icon={Warning} value={overview?.openIncidentCount ?? 0} label="Инциденты" />
        <KPICard icon={CheckSquare} value={overview?.taskCounts.todo ?? 0} label="Задачи сегодня" />
        <KPICard icon={Spinner} value={overview?.taskCounts.inProgress ?? 0} label="В процессе" />
        <KPICard icon={ArrowsClockwise} value={overview?.substitutionCount ?? 0} label="Замены" />
      </div>
      <div className="mb-10 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => setVoiceOpen(true)}>
          <Microphone aria-hidden /> Голосовая команда
        </Button>
        <Button variant="ghost">
          <Plus aria-hidden /> Новая задача
        </Button>
        <Button variant="ghost">
          <Warning aria-hidden /> Инцидент
        </Button>
        <Button variant="ghost" onClick={() => window.print()}>
          <ForkKnife aria-hidden /> Питание
        </Button>
      </div>
      <Section label="ПОСЕЩАЕМОСТЬ СЕГОДНЯ">
        <p className="mb-3 text-sm text-gray-500">
          {attendance?.length ?? 0}/{classes.length} классов сдали отчёт
          {missingClasses > 0 ? <span className="text-amber-600"> · {missingClasses} ещё не сдали</span> : null}
        </p>
        {attendance === undefined ? (
          Array.from({ length: 5 }).map((_, index) => <SkeletonRow key={index} />)
        ) : attendance.length === 0 ? (
          <EmptyState icon={ClipboardText} title="Данных пока нет" subtitle="Учителя ещё не отправили отчёты" />
        ) : (
          attendance.map((record) => {
            const rowPercent = safePercent(record.presentCount, record.presentCount + record.absentCount);
            return (
              <Row key={record._id}>
                <div className="grid items-center gap-3 md:grid-cols-[4rem_10rem_1fr_7rem]">
                  <div className="font-medium text-gray-900"><ClassCode id={record.classId} /></div>
                  <div className="text-sm text-gray-500">
                    <StaffName id={classes.find((classDoc) => classDoc._id === record.classId)?.homeroomTeacherId} />
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        rowPercent > 85 ? "bg-brand-accent" : rowPercent >= 70 ? "bg-amber-500" : "bg-red-500",
                      )}
                      style={{ width: `${rowPercent}%` }}
                    />
                  </div>
                  <div className="text-right text-sm tabular-nums" data-number>
                    {record.presentCount}/{record.presentCount + record.absentCount}
                  </div>
                </div>
              </Row>
            );
          })
        )}
        <p className="pt-3 text-sm text-gray-500">
          Итого: {present} / {present + absent} учеников — {percent}% по школе
        </p>
      </Section>
      <Section label="ПИТАНИЕ">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-700">
            Порций заказано: <span className="font-medium tabular-nums">{overview?.mealSummary?.totalMeals ?? 0}</span> ·
            Отсутствуют: <span className="font-medium tabular-nums">{overview?.mealSummary?.totalAbsent ?? 0}</span>
          </p>
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer aria-hidden /> Печать отчёта
          </Button>
        </div>
      </Section>
      <Section label="ТРЕБУЕТ ВНИМАНИЯ">
        {(overview?.openIncidentCount ?? 0) === 0 && (overview?.taskCounts.todo ?? 0) === 0 ? (
          <EmptyState icon={SmileyBlank} title="Всё в порядке" subtitle="Сейчас нет срочных событий" />
        ) : (
          <div>
            {(notifications ?? []).slice(0, 6).map((notification) => (
              <Row key={notification._id}>
                <div className="flex items-center gap-3">
                  <span className="size-2 rounded-full bg-error" />
                  <p className="flex-1 text-sm font-medium text-gray-900">
                    {typeof notification.payload?.text === "string" ? notification.payload.text.split("\n")[0] : notification.templateKey}
                  </p>
                  <span className="text-xs text-gray-400">{formatRelativeMinutes(notification._creationTime)}</span>
                </div>
              </Row>
            ))}
          </div>
        )}
      </Section>
      <Section label="ПРЕДЛОЖЕНИЯ ПО ЗАМЕНАМ">
        {(substitutions ?? []).length === 0 ? (
          <EmptyState icon={UsersThree} title="Все учителя на месте" subtitle="Замены сегодня не нужны" />
        ) : (
          <AnimatePresence>
            {(substitutions ?? []).slice(0, 5).map((request) => (
              <motion.div key={request._id} exit={{ opacity: 0, x: 40, transition: { duration: 0.25 } }}>
                <Row className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-gray-500">
                      <StaffName id={request.absentTeacherId} /> →{" "}
                      <span className="font-medium text-gray-900">
                        {staffById.get(request.chosenCandidates[0]?.staffId)?.displayName ?? "кандидат подбирается"}
                      </span>
                    </p>
                    <Button
                      size="sm"
                      disabled={!request.chosenCandidates[0] || !currentStaff}
                      onClick={() => {
                        const candidate = request.chosenCandidates[0];
                        if (!candidate) return;
                        void confirmOverride({
                          requestId: request._id,
                          candidateStaffId: candidate.staffId,
                        }).then(() => toast.success("Замена подтверждена"));
                      }}
                    >
                      Подтвердить замену
                    </Button>
                  </div>
                </Row>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </Section>
      <Section label="ВХОДЯЩИЕ СООБЩЕНИЯ">
        {queues?.pendingMessages.length ? (
          queues.pendingMessages.slice(0, 3).map((message) => (
            <Row key={message._id}>
              <p className="text-sm italic text-gray-600">{message.rawText ?? "Telegram сообщение"}</p>
              <StatusBadge status={message.parserStatus} type="parser" />
            </Row>
          ))
        ) : (
          <EmptyState icon={Tray} title="Очередь пуста" subtitle="Все сообщения обработаны" />
        )}
      </Section>
      <Section label="ПОСЛЕДНИЕ СОБЫТИЯ">
        {(notifications ?? []).slice(0, 10).map((notification) => (
          <Row key={notification._id}>
            <div className="grid gap-3 text-sm md:grid-cols-[5rem_1fr]">
              <span className="font-mono text-xs text-gray-400">
                {new Date(notification._creationTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span>{typeof notification.payload?.text === "string" ? notification.payload.text : notification.templateKey}</span>
            </div>
          </Row>
        ))}
      </Section>
      <Section label="МИНИ-АНАЛИТИКА">
        {analytics === undefined ? (
          <ChartSkeleton />
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={analytics.attendanceByDay}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="percent" stroke="#6B2FA0" dot={{ fill: "#F5A623" }} />
              </LineChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={analytics.incidentsByDay}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="high" fill="#6B2FA0" opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>
      <VoiceModal open={voiceOpen} onOpenChange={setVoiceOpen} />
    </PageFrame>
  );
}

export function AttendancePage() {
  const { schoolId, classes, currentStaff } = useSchool();
  const [date, setDate] = useState(todayIso());
  const attendance = useQuery(
    api["modules/ops/attendance"].listByDate,
    schoolId ? { schoolId, date } : "skip",
  );
  const meal = useQuery(
    api["modules/ops/attendance"].getMealSummary,
    schoolId ? { schoolId, date } : "skip",
  );
  const submitFact = useMutation(api["modules/ops/attendance"].submitDashboardFact);
  const freshness = useFreshness(attendance);
  const submitted = attendance?.length ?? 0;
  const missing = Math.max(0, classes.length - submitted);
  const totalStudents = attendance?.reduce((sum, row) => sum + row.presentCount + row.absentCount, 0) ?? 0;

  return (
    <PageFrame>
      <PageHeader title="Посещаемость" subtitle="Ежедневные отчёты классов" refreshedAt={freshness.label} onRefresh={freshness.refresh} />
      <div className="mb-10 flex flex-wrap items-center gap-3">
        <Input className="max-w-44" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <p className="text-sm text-gray-500">Данные за {date} · {freshness.label}</p>
      </div>
      <div className="mb-10 flex flex-wrap gap-8 text-sm">
        <span className="text-green-600">✓ {submitted} сдали</span>
        <span className="text-red-500">✗ {missing} не сдали</span>
        <span className="text-gray-500 tabular-nums">{totalStudents} всего учеников</span>
      </div>
      {attendance === undefined ? (
        Array.from({ length: 5 }).map((_, index) => <SkeletonRow key={index} />)
      ) : attendance.length === 0 ? (
        <EmptyState icon={ClipboardText} title="Данных пока нет" subtitle="Учителя ещё не отправили отчёты" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3">Класс</th>
                <th>Учитель</th>
                <th>Присутствуют</th>
                <th>Отсутствуют</th>
                <th>Питание</th>
                <th>Уверенность AI</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((record) => (
                <tr key={record._id} className="border-b border-gray-100">
                  <td className="py-3 font-medium"><ClassCode id={record.classId} /></td>
                  <td className="text-gray-500"><StaffName id={classes.find((item) => item._id === record.classId)?.homeroomTeacherId} /></td>
                  <td className="tabular-nums">{record.presentCount}</td>
                  <td className="tabular-nums">{record.absentCount}</td>
                  <td className="tabular-nums">{record.mealCount}</td>
                  <td>
                    <div className="h-1.5 w-24 rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-brand-accent" style={{ width: `${Math.round(record.confidence * 100)}%` }} />
                    </div>
                  </td>
                  <td><StatusBadge status="processed" type="parser" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-10 rounded-lg bg-white p-5">
        <p className="text-base font-medium text-gray-900">Питание</p>
        <p className="mt-2 text-sm text-gray-500">
          Порций: {meal?.totalMeals ?? 0} · Отсутствуют: {meal?.totalAbsent ?? 0}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(meal?.missingClasses ?? []).map((code) => <Badge key={code} variant="secondary">{code}</Badge>)}
        </div>
        <Button className="mt-5" variant="ghost" onClick={() => window.print()}>
          <Printer aria-hidden /> Распечатать отчёт
        </Button>
      </div>
      {classes[0] && currentStaff ? (
        <Button
          className="mt-5"
          variant="outline"
          onClick={() =>
            void submitFact({
              schoolId: schoolId as Id<"schools">,
              date,
              classId: classes[0]._id,
              staffId: currentStaff._id,
              presentCount: 0,
              absentCount: 0,
              mealCount: 0,
              confidence: 1,
            }).then(() => toast.success(`Посещаемость за ${classes[0]?.code} сохранена`))
          }
        >
          Сохранить изменения
        </Button>
      ) : null}
    </PageFrame>
  );
}

export function IncidentsPage() {
  const { schoolId, currentStaff } = useSchool();
  const incidents = useQuery(api["modules/ops/incidents"].listOpen, schoolId ? { schoolId } : "skip");
  const updateStatus = useMutation(api["modules/ops/incidents"].updateStatus);
  const createManual = useMutation(api["modules/ops/incidents"].createManual);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [hidden, setHidden] = useState<Set<Id<"incidents">>>(new Set());
  const [title, setTitle] = useState("");
  const visible = (incidents ?? []).filter((incident) => !hidden.has(incident._id));
  const freshness = useFreshness(incidents);

  async function moveIncident(incident: Doc<"incidents">, status: IncidentStatus) {
    setHidden((current) => new Set(current).add(incident._id));
    try {
      await updateStatus({ incidentId: incident._id, status });
      toast.success(status === "resolved" ? "Инцидент закрыт" : "Статус инцидента обновлён");
    } catch {
      setHidden((current) => {
        const next = new Set(current);
        next.delete(incident._id);
        return next;
      });
      toast.error("Не удалось сохранить. Попробуй ещё раз");
    }
  }

  return (
    <PageFrame>
      <PageHeader
        title="Инциденты"
        subtitle="Мониторинг и решение проблем в школе"
        refreshedAt={freshness.label}
        onRefresh={freshness.refresh}
        action={
          <button type="button" onClick={() => setView(view === "kanban" ? "list" : "kanban")}>
            {view === "kanban" ? <List aria-hidden /> : <Kanban aria-hidden />}
          </button>
        }
      />
      <p className="mb-6 text-sm text-gray-500">
        {visible.length} открытых · {visible.filter((incident) => incident.severity === "high").length} критический
      </p>
      <div className="mb-10 flex gap-2">
        <Input placeholder="Что произошло?" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Button
          disabled={!schoolId || !currentStaff || !title.trim()}
          onClick={() => {
            if (!schoolId || !currentStaff) return;
            void createManual({
              schoolId,
              reportedByStaffId: currentStaff._id,
              category: "operations",
              title,
              description: title,
              severity: "medium",
            }).then(() => {
              setTitle("");
              toast.success("Инцидент добавлен");
            });
          }}
        >
          Добавить
        </Button>
      </div>
      {incidents === undefined ? (
        <SkeletonCard />
      ) : visible.length === 0 ? (
        <EmptyState icon={SmileyBlank} title="Спокойный день — инцидентов нет" subtitle="Если что-то произошло, Telegram бот оповестит автоматически" />
      ) : view === "kanban" ? (
        <div className="grid gap-5 md:grid-cols-3">
          {incidentColumns.map((column) => (
            <div key={column.status}>
              <p className="mb-4 text-xs uppercase tracking-wider text-gray-500">{column.label}</p>
              <div className="flex flex-col gap-3">
                {visible
                  .filter((incident) => incident.status === column.status)
                  .map((incident) => (
                    <motion.div
                      key={incident._id}
                      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(17, 24, 39, 0.08)" }}
                      className="overflow-hidden rounded-xl bg-white shadow-sm"
                    >
                      <div className={cn("h-1", incident.severity === "high" ? "bg-red-500" : incident.severity === "medium" ? "bg-yellow-400" : "bg-gray-300")} />
                      <div className="p-5">
                        <p className="font-medium text-gray-900">{incident.title}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-gray-500">{incident.description}</p>
                        <div className="mt-4 flex items-center justify-between gap-2">
                          <Badge variant={incident.severity === "high" ? "danger" : "warning"}>{incident.category}</Badge>
                          <Button size="sm" onClick={() => void moveIncident(incident, "resolved")}>Решено</Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        visible.map((incident) => (
          <Row key={incident._id}>
            <div className="grid gap-3 md:grid-cols-[1fr_6rem_8rem_8rem]">
              <p className="font-medium">{incident.title}</p>
              <Badge variant={incident.severity === "high" ? "danger" : "warning"}>{incident.severity}</Badge>
              <StatusBadge status={incident.status} type="incident" />
              <Button size="sm" variant="ghost" onClick={() => void moveIncident(incident, "resolved")}>Закрыть</Button>
            </div>
          </Row>
        ))
      )}
    </PageFrame>
  );
}

export function TasksPage({ mine = false }: { mine?: boolean }) {
  const { schoolId, currentStaff, staffById } = useSchool();
  const tasks = useQuery(
    api["modules/ops/tasks"].listBoard,
    schoolId ? { schoolId, assigneeStaffId: mine && currentStaff ? currentStaff._id : undefined } : "skip",
  );
  const createBatch = useMutation(api["modules/ops/tasks"].createBatch);
  const updateStatus = useMutation(api["modules/ops/tasks"].updateStatus);
  const updateDetails = useMutation(api["modules/ops/tasks"].updateDetails);
  const [localTasks, setLocalTasks] = useState<Doc<"tasks">[] | null>(null);
  const [title, setTitle] = useState("");
  const rows = localTasks ?? tasks ?? [];
  const active = rows.filter((task) => task.status !== "done" && task.status !== "canceled").length;
  const overdue = rows.filter((task) => task.dueAt && new Date(task.dueAt) < new Date()).length;
  const freshness = useFreshness(tasks);

  async function optimisticStatus(task: Doc<"tasks">, status: TaskStatus) {
    const previous = rows;
    setLocalTasks(rows.map((row) => (row._id === task._id ? { ...row, status } : row)));
    try {
      await updateStatus({ taskId: task._id, status });
      toast.success(status === "done" ? "Задача выполнена!" : "Статус задачи обновлён");
    } catch {
      setLocalTasks(previous);
      toast.error("Не удалось сохранить. Попробуй ещё раз");
    }
  }

  return (
    <PageFrame>
      <PageHeader title={mine ? "Мои задачи" : "Задачи"} subtitle={mine ? "Личные поручения на сегодня" : "Управляй делами школы"} refreshedAt={freshness.label} onRefresh={freshness.refresh} />
      <p className="mb-6 text-sm text-gray-500">{active} активных · <span className={overdue > 0 ? "text-red-500" : ""}>{overdue} просрочено</span></p>
      {!mine ? (
        <div className="mb-10 flex gap-2">
          <Input placeholder="Добавить задачу" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Button
            disabled={!schoolId || !currentStaff || !title.trim()}
            onClick={() => {
              if (!schoolId || !currentStaff) return;
              void createBatch({
                schoolId,
                tasks: [{
                  source: "manual",
                  title,
                  description: title,
                  assigneeStaffId: currentStaff._id,
                  creatorStaffId: currentStaff._id,
                  priority: "medium",
                }],
              }).then(() => {
                setTitle("");
                toast.success(`Задача назначена ${currentStaff.displayName}`);
              });
            }}
          >
            Добавить задачу
          </Button>
        </div>
      ) : null}
      {tasks === undefined ? (
        <SkeletonCard />
      ) : rows.length === 0 ? (
        <EmptyState icon={CheckCircle} title="Все задачи выполнены!" subtitle="Отличная работа команды сегодня" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-4">
          {taskColumns.map((column) => (
            <div key={column.status}>
              <p className="mb-4 text-xs uppercase tracking-wider text-gray-500">{column.label}</p>
              <div className="flex flex-col gap-3">
                {rows.filter((task) => task.status === column.status).map((task) => (
                  <motion.div key={task._id} whileHover={{ y: -2 }} className={cn("rounded-lg border-l-[3px] bg-white p-5 shadow-sm", task.priority === "high" ? "border-red-500" : task.priority === "medium" ? "border-amber-500" : "border-blue-500")}>
                    <InlineEdit
                      value={task.title}
                      className="text-base font-medium text-gray-900"
                      onSave={async (nextTitle) => {
                        await updateDetails({ taskId: task._id, title: nextTitle });
                        toast.success("Название задачи обновлено");
                      }}
                    />
                    <p className="mt-2 line-clamp-2 text-sm text-gray-500">{task.description}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <AvatarInitials name={staffById.get(task.assigneeStaffId)?.displayName} />
                      <span className="text-sm text-gray-500">{staffById.get(task.assigneeStaffId)?.displayName ?? "Сотрудник"}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span className={cn("text-xs text-gray-400", task.dueAt && new Date(task.dueAt) < new Date() && "font-medium text-red-500")}>
                        {task.dueAt ? new Date(task.dueAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "Без срока"}
                      </span>
                      <select
                        className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs"
                        value={task.status}
                        onChange={(event) => void optimisticStatus(task, event.target.value as TaskStatus)}
                      >
                        {taskColumns.map((item) => <option key={item.status} value={item.status}>{item.label}</option>)}
                      </select>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageFrame>
  );
}

export function SubstitutionsPage() {
  const { schoolId, staffById } = useSchool();
  const requests = useQuery(api["modules/substitutions/requests"].listToday, schoolId ? { schoolId } : "skip");
  const confirmOverride = useMutation(api["modules/substitutions/requests"].confirmOverride);
  const [hidden, setHidden] = useState<Set<Id<"substitutionRequests">>>(new Set());
  const visible = (requests ?? []).filter((request) => !hidden.has(request._id));
  const freshness = useFreshness(requests);

  return (
    <PageFrame>
      <PageHeader title="Замены" subtitle="Управление заменами учителей" refreshedAt={freshness.label} onRefresh={freshness.refresh} />
      {requests === undefined ? (
        <SkeletonCard />
      ) : visible.length === 0 ? (
        <EmptyState icon={UsersThree} title="Все учителя на месте" subtitle="Замены сегодня не нужны" />
      ) : (
        <div className="flex flex-col gap-5">
          {visible.map((request) => (
            <motion.div key={request._id} exit={{ opacity: 0, x: 40 }} className="rounded-xl bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">Отсутствует: <StaffName id={request.absentTeacherId} /></p>
                  <p className="mt-1 text-sm text-gray-500">Причина: {request.reason}</p>
                  <p className="mt-1 text-sm text-gray-700">Уроки: {request.lessons.join(", ")}</p>
                </div>
                <StatusBadge status={request.status} type="substitution" />
              </div>
              {request.status === "ranked" && request.chosenCandidates.length > 0 ? (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  {request.chosenCandidates.slice(0, 3).map((candidate) => (
                    <Row key={candidate.staffId}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <AvatarInitials name={staffById.get(candidate.staffId)?.displayName} />
                          <div>
                            <p className="font-medium">{staffById.get(candidate.staffId)?.displayName ?? "Кандидат"}</p>
                            <p className="text-xs text-green-600">✓ Совпадение · {Math.round(candidate.score)}%</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setHidden((current) => new Set(current).add(request._id));
                            void confirmOverride({ requestId: request._id, candidateStaffId: candidate.staffId })
                              .then(() => toast.success(`Замена для ${staffById.get(request.absentTeacherId)?.displayName ?? "учителя"} подтверждена`))
                              .catch(() => {
                                setHidden((current) => {
                                  const next = new Set(current);
                                  next.delete(request._id);
                                  return next;
                                });
                                toast.error("Не удалось сохранить. Попробуй ещё раз");
                              });
                          }}
                        >
                          Подтвердить
                        </Button>
                      </div>
                    </Row>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-gray-500">Ищем кандидатов на замену...</p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </PageFrame>
  );
}

export function DocumentsPage({ adminOnly = false }: { adminOnly?: boolean }) {
  const { schoolId, currentUser } = useSchool();
  const retrieve = useAction(api["modules/rag/retrieval"].retrieveContext);
  const checkTarget = useAction(api["modules/rag/compliance"].checkTarget);
  const rewritePlainLanguage = useAction(api["modules/rag/compliance"].rewritePlainLanguage);
  const createUploadUrl = useMutation(api["modules/rag/documents"].createUploadUrl);
  const registerUpload = useMutation(api["modules/rag/documents"].registerUpload);
  const deleteDocument = useMutation(api["modules/rag/documents"].deleteDocument);
  const documents = useQuery(
    api["modules/rag/documents"].getDocumentStatus,
    schoolId ? { schoolId } : "skip",
  );
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [complianceText, setComplianceText] = useState("");
  const [complianceResult, setComplianceResult] = useState<"pass" | "warn" | "fail" | null>(null);
  const [loading, setLoading] = useState(false);
  const [rewrite, setRewrite] = useState("");
  const freshness = useFreshness(documents);
  const canUpload = currentUser?.role === "admin" || currentUser?.role === "director" || adminOnly;

  async function ask() {
    if (!schoolId || !query.trim()) return;
    setLoading(true);
    try {
      const chunks = await retrieve({ schoolId, queryText: query, limit: 6 });
      setAnswer(chunks.length ? chunks.map((chunk) => chunk.text.slice(0, 260)).join("\n\n") : "По запросу ничего не найдено. Попробуй другой запрос.");
    } finally {
      setLoading(false);
    }
  }

  async function upload(file: File) {
    if (!schoolId) return;
    setLoading(true);
    try {
      const uploadUrl = await createUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      const json = (await response.json()) as { storageId: Id<"_storage"> };
      await registerUpload({
        schoolId,
        storageId: json.storageId,
        title: file.name.replace(/\.[^.]+$/, ""),
        code: file.name,
        language: "ru",
        version: "1",
      });
      toast.success("Документ загружен и отправлен на индексацию");
    } catch {
      toast.error("Ошибка при загрузке файла. Попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageFrame>
      <PageHeader title="Документы и нормативы" subtitle="Поиск по базе знаний и загрузка документов" refreshedAt={freshness.label} onRefresh={freshness.refresh} />
      <div className="mb-10 flex gap-2">
        <Input className="h-12 rounded-full" placeholder="Задай вопрос о нормативах, приказах, процедурах..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button className="h-12 rounded-full" onClick={() => void ask()}>Искать</Button>
      </div>
      {loading && !answer ? <p className="mb-10 text-sm text-gray-500">Ищем ответ в базе документов...</p> : null}
      {answer ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-10 rounded-lg bg-white p-5">
          <p className="text-base leading-relaxed text-gray-700">{answer}</p>
          <Button
            className="mt-5"
            variant="ghost"
            onClick={() => {
              if (!schoolId) return;
              void rewritePlainLanguage({ schoolId, sourceText: answer }).then((result) => setRewrite(result.text));
            }}
          >
            Переписать проще
          </Button>
          {rewrite ? <p className="mt-4 rounded-lg bg-purple-50 p-4 text-sm text-gray-700">{rewrite}</p> : null}
        </motion.div>
      ) : null}
      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Библиотека</TabsTrigger>
          <TabsTrigger value="compliance">Проверка</TabsTrigger>
          <TabsTrigger value="order">Составить приказ</TabsTrigger>
        </TabsList>
        <TabsContent value="compliance" className="mt-6">
          <Textarea placeholder="Введи текст для проверки соответствия нормативам..." value={complianceText} onChange={(event) => setComplianceText(event.target.value)} />
          <Button
            className="mt-3"
            disabled={!schoolId || !complianceText.trim()}
            onClick={() => {
              if (!schoolId) return;
              setLoading(true);
              void checkTarget({ schoolId, inputText: complianceText, targetType: "freeform" })
                .then((result) => {
                  setComplianceResult(result.result);
                  toast.success("Проверка соответствия завершена");
                })
                .finally(() => setLoading(false));
            }}
          >
            {loading ? "Проверяем соответствие..." : "Проверить соответствие"}
          </Button>
          {complianceResult ? (
            <div className={cn("mt-5 rounded-xl p-5 text-sm", complianceResult === "pass" ? "bg-green-50 text-green-700" : complianceResult === "warn" ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700")}>
              {complianceResult === "pass" ? "Соответствует нормам" : complianceResult === "warn" ? "Есть замечания" : "Нарушение обнаружено"}
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="order" className="mt-6">
          <OrderDraftFlow />
        </TabsContent>
        <TabsContent value="library" className="mt-6">
          <Section label="БИБЛИОТЕКА ДОКУМЕНТОВ">
            {canUpload ? (
              <label className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 p-8 text-center hover:border-brand-accent">
                <UploadSimple className="size-12 text-gray-300" aria-hidden />
                <span className="mt-3 text-sm text-gray-500">Перетащи PDF или нажми для выбора</span>
                <input className="hidden" type="file" accept="application/pdf,text/plain" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }} />
              </label>
            ) : null}
            {documents === undefined ? (
              <SkeletonCard />
            ) : documents.length === 0 ? (
              <EmptyState icon={Files} title="Документов нет" subtitle="Загрузи первый документ для RAG поиска" />
            ) : (
              documents.map((document) => (
                <Row key={document._id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <FilePdf className="size-6 text-brand-accent" aria-hidden />
                      <div>
                        <p className="font-medium text-gray-900">{document.title}</p>
                        <p className="text-xs text-gray-400">{document.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={document.parseStatus} type="document" />
                      {canUpload ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void deleteDocument({ documentId: document._id }).then(() => toast.success("Документ удалён"))}
                        >
                          Удалить
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Row>
              ))
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </PageFrame>
  );
}

function OrderDraftFlow() {
  const { schoolId, currentStaff } = useSchool();
  const templates = useQuery(api["modules/rag/orderGenerator"].listTemplates);
  const startDraft = useAction(api["modules/rag/orderGenerator"].startOrderDraft);
  const answerQuestion = useAction(api["modules/rag/orderGenerator"].answerOrderQuestion);

  const [templateKey, setTemplateKey] = useState("");
  const [instruction, setInstruction] = useState("");
  const [draftId, setDraftId] = useState<Id<"orderDrafts"> | null>(null);
  const [answerInput, setAnswerInput] = useState("");
  const [busy, setBusy] = useState(false);

  const draft = useQuery(
    api["modules/rag/orderGenerator"].getOrderDraft,
    draftId ? { draftId } : "skip",
  );

  async function handleStart() {
    if (!schoolId || !currentStaff || !templateKey) return;
    setBusy(true);
    try {
      const result = await startDraft({
        schoolId,
        createdByStaffId: currentStaff._id,
        templateKey,
        initialInstruction: instruction || "Составить приказ",
      });
      setDraftId(result.draftId);
    } catch {
      toast.error("Не удалось начать составление приказа");
    } finally {
      setBusy(false);
    }
  }

  async function handleAnswer() {
    if (!draftId || !answerInput.trim()) return;
    setBusy(true);
    try {
      await answerQuestion({ draftId, answerText: answerInput.trim() });
      setAnswerInput("");
    } catch {
      toast.error("Не удалось отправить ответ");
    } finally {
      setBusy(false);
    }
  }

  if (!draftId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Выбери шаблон приказа и опиши, что нужно оформить.</p>
        <select
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          value={templateKey}
          onChange={(e) => setTemplateKey(e.target.value)}
        >
          <option value="">— выбери шаблон —</option>
          {(templates ?? []).map((t) => (
            <option key={t.key} value={t.key}>{t.title}</option>
          ))}
        </select>
        {templateKey ? (
          <p className="text-xs text-gray-400">{templates?.find((t) => t.key === templateKey)?.description}</p>
        ) : null}
        <Textarea
          placeholder="Дополнительные инструкции (необязательно)..."
          rows={3}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
        <Button
          className="w-full"
          disabled={!templateKey || busy || !schoolId}
          onClick={() => void handleStart()}
        >
          {busy ? <Spinner className="animate-spin" aria-hidden /> : null}
          Начать составление
        </Button>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="py-8 text-center">
        <Spinner className="mx-auto size-8 animate-spin text-brand-accent" aria-hidden />
        <p className="mt-3 text-sm text-gray-500">Загружаем черновик...</p>
      </div>
    );
  }

  if (draft.status === "collecting" && draft.pendingQuestion) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-wide text-brand-accent">Сбор данных для приказа</p>
        {draft.answers.length > 0 ? (
          <div className="space-y-2">
            {draft.answers.map((a, i) => (
              <div key={i} className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-700">{a.question}</p>
                <p className="text-gray-500">{a.answer}</p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="rounded-lg border border-brand-accent/30 bg-purple-50 p-4">
          <p className="text-sm font-medium text-gray-800">{draft.pendingQuestion}</p>
        </div>
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder="Введи ответ..."
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAnswer(); } }}
          />
          <Button disabled={busy || !answerInput.trim()} onClick={() => void handleAnswer()}>
            {busy ? <Spinner className="animate-spin" aria-hidden /> : "Ответить"}
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setDraftId(null); setTemplateKey(""); setInstruction(""); }}>
          Отменить
        </Button>
      </div>
    );
  }

  if (draft.status === "drafting") {
    return (
      <div className="py-8 text-center">
        <Spinner className="mx-auto size-8 animate-spin text-brand-accent" aria-hidden />
        <p className="mt-3 text-sm text-gray-500">Составляем текст приказа с использованием нормативной базы...</p>
      </div>
    );
  }

  if (draft.status === "draft" || draft.status === "final") {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-wide text-brand-accent">
          {draft.status === "draft" ? "Черновик приказа" : "Финальная версия"}
        </p>
        {draft.complianceCheckId ? (
          <Badge className="bg-green-100 text-green-700">Проверка соответствия выполнена</Badge>
        ) : null}
        <div className="whitespace-pre-wrap rounded-lg border bg-white p-5 text-sm leading-relaxed text-gray-800">
          {draft.generatedText}
        </div>
        {draft.citations.length > 0 ? (
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="mb-2 text-xs font-medium uppercase text-gray-500">Ссылки на нормативы</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-gray-600">
              {draft.citations.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        ) : null}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (draft.generatedText) {
                void navigator.clipboard.writeText(draft.generatedText);
                toast.success("Текст скопирован в буфер обмена");
              }
            }}
          >
            Скопировать
          </Button>
          <Button variant="outline" onClick={() => { setDraftId(null); setTemplateKey(""); setInstruction(""); }}>
            Новый приказ
          </Button>
        </div>
      </div>
    );
  }

  if (draft.status === "error") {
    return (
      <div className="py-6 text-center">
        <Warning className="mx-auto size-10 text-red-500" aria-hidden />
        <p className="mt-3 text-sm text-gray-600">Произошла ошибка при составлении приказа. Попробуй ещё раз.</p>
        <Button className="mt-4" variant="outline" onClick={() => { setDraftId(null); setTemplateKey(""); setInstruction(""); }}>
          Начать сначала
        </Button>
      </div>
    );
  }

  return (
    <div className="py-8 text-center">
      <Spinner className="mx-auto size-8 animate-spin text-brand-accent" aria-hidden />
      <p className="mt-3 text-sm text-gray-500">Обработка...</p>
    </div>
  );
}

export function ReviewQueuePage() {
  const { schoolId } = useSchool();
  const queues = useQuery(api["modules/dashboard/queues"].listReviewQueues, schoolId ? { schoolId } : "skip");
  const freshness = useFreshness(queues);
  return (
    <PageFrame>
      <PageHeader title="Очередь проверки" subtitle="Входящие Telegram сообщения и ожидающие подтверждения" refreshedAt={freshness.label} onRefresh={freshness.refresh} />
      <Tabs defaultValue="messages">
        <TabsList>
          <TabsTrigger value="messages">Сообщения Telegram</TabsTrigger>
          <TabsTrigger value="substitutions">Замены на проверке</TabsTrigger>
        </TabsList>
        <TabsContent value="messages" className="mt-6">
          {queues === undefined ? <SkeletonCard /> : queues.pendingMessages.length === 0 ? (
            <EmptyState icon={Tray} title="Очередь пуста" subtitle="Все сообщения обработаны" />
          ) : queues.pendingMessages.map((message) => (
            <Row key={message._id}>
              <p className="font-medium text-gray-900">{message.telegramUserId}</p>
              <p className="mt-1 line-clamp-2 text-sm italic text-gray-600">{message.rawText ?? "Сообщение без текста"}</p>
              <div className="mt-2"><StatusBadge status={message.parserStatus} type="parser" /></div>
            </Row>
          ))}
        </TabsContent>
        <TabsContent value="substitutions" className="mt-6">
          {queues?.pendingSubstitutions.length ? queues.pendingSubstitutions.map((request) => (
            <Row key={request._id}>
              <div className="flex items-center justify-between">
                <span><StaffName id={request.absentTeacherId} /> · {request.date}</span>
                <StatusBadge status={request.status} type="substitution" />
              </div>
            </Row>
          )) : <EmptyState icon={Tray} title="Очередь пуста" subtitle="Все сообщения обработаны" />}
        </TabsContent>
      </Tabs>
    </PageFrame>
  );
}

export function VoiceCommandPage() {
  const [open, setOpen] = useState(false);
  return (
    <PageFrame>
      <PageHeader title="Голосовые команды" subtitle="Загрузи или запиши команду директора" />
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-xl bg-white p-12 text-center">
        <Microphone className="size-20 animate-pulse text-brand-accent" aria-hidden />
        <p className="mt-6 text-xl font-medium text-gray-900">Загрузи аудиофайл с командой</p>
        <p className="mt-2 text-sm text-gray-500">После загрузки команда будет расшифрована и превращена в задачи</p>
        <Button className="mt-8 h-12 w-full" onClick={() => setOpen(true)}>Записать команду</Button>
      </div>
      <VoiceModal open={open} onOpenChange={setOpen} />
    </PageFrame>
  );
}

export function AnalyticsPage() {
  const { schoolId } = useSchool();
  const [days, setDays] = useState(30);
  const analytics = useQuery(api["modules/dashboard/analytics"].getSeries, schoolId ? { schoolId, days } : "skip");
  const freshness = useFreshness(analytics);
  return (
    <PageFrame>
      <PageHeader
        title="Аналитика"
        subtitle="Показатели работы школы"
        refreshedAt={freshness.label}
        onRefresh={freshness.refresh}
        action={<button type="button" onClick={() => window.print()}><Export aria-hidden /> Экспорт PDF</button>}
      />
      <div className="mb-10 flex gap-2">
        {[7, 30, 90].map((value) => (
          <Button key={value} variant={days === value ? "default" : "outline"} size="sm" onClick={() => setDays(value)}>
            {value} дней
          </Button>
        ))}
      </div>
      {analytics === undefined ? <ChartSkeleton /> : (
        <div className="grid gap-10 md:grid-cols-2">
          <Section label="ПОСЕЩАЕМОСТЬ" className="mb-0">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={analytics.attendanceByDay}>
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <ReferenceLine y={85} stroke="#9CA3AF" strokeDasharray="3 3" label="Норма" />
                <Line dataKey="percent" stroke="#6B2FA0" dot={{ fill: "#F5A623" }} />
              </LineChart>
            </ResponsiveContainer>
          </Section>
          <Section label="ПИТАНИЕ" className="mb-0">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.mealsByDay}><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="totalMeals" fill="#6B2FA0" opacity={0.8} /></BarChart>
            </ResponsiveContainer>
          </Section>
          <Section label="ИНЦИДЕНТЫ" className="mb-0">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.incidentsByDay}><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="medium" stackId="a" fill="#F5A623" /><Bar dataKey="high" stackId="a" fill="#EF4444" /></BarChart>
            </ResponsiveContainer>
          </Section>
          <Section label="ВЫПОЛНЕНИЕ ЗАДАЧ" className="mb-0">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={analytics.taskStatus} dataKey="value" nameKey="name" outerRadius={80}>{analytics.taskStatus.map((_, index) => <Cell key={index} fill={["#6B2FA0", "#22C55E", "#F59E0B", "#9CA3AF"][index % 4]} />)}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </Section>
          <Section label="АНОМАЛИИ" className="md:col-span-2">
            {analytics.anomalies.length ? analytics.anomalies.map((item) => (
              <Row key={`${item.kind}-${item.date}-${item.description}`}>
                <span className="mr-3 inline-block size-2 rounded-full bg-error" />
                <span className="text-sm text-gray-700">{item.description}</span>
                <span className="ml-3 text-xs text-gray-400">{item.date}</span>
              </Row>
            )) : <EmptyState icon={CheckCircle} title="Аномалий нет" subtitle="Показатели выглядят спокойно" />}
          </Section>
        </div>
      )}
    </PageFrame>
  );
}

export function VPDashboard() {
  return (
    <PageFrame>
      <PageHeader title="Добрый день, Гүлнар" subtitle="Вот что важно сегодня" />
      <Section label="МОИ ИНЦИДЕНТЫ"><IncidentsPage /></Section>
      <Section label="ПРЕДЛОЖЕНИЯ ПО ЗАМЕНАМ"><SubstitutionsPage /></Section>
      <Section label="РАСПИСАНИЕ СЕГОДНЯ"><SchedulePage todayOnly /></Section>
    </PageFrame>
  );
}

function teacherLoadColor(count: number | undefined): string {
  if (!count || count < 3) return "text-green-700 bg-green-50";
  if (count <= 5) return "text-yellow-700 bg-yellow-50";
  return "text-red-700 bg-red-50";
}

export function SchedulePage({ todayOnly = false }: { todayOnly?: boolean }) {
  const { schoolId, classes, staffById } = useSchool();
  const schedule = useQuery(api["modules/schoolCore/schedule"].getToday, schoolId ? { schoolId } : "skip");
  const teacherLoad = useQuery(api["modules/schoolCore/schedule"].getTeacherLoadToday, schoolId ? { schoolId } : "skip");
  const applyOverride = useMutation(api["modules/schoolCore/schedule"].applyManualOverride);
  const cancelOv = useMutation(api["modules/schoolCore/schedule"].cancelOverride);
  const previewConflict = useQuery(
    api["modules/schoolCore/schedule"].previewOverride,
    "skip",
  );
  const [dragSource, setDragSource] = useState<{ classId: string; lesson: number; teacherId: string; roomId: string; subject: string } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [conflictCells, setConflictCells] = useState<Set<string>>(new Set());

  function handleDragStart(classId: string, lesson: number, teacherId: string, roomId: string, subject: string) {
    setDragSource({ classId, lesson, teacherId, roomId, subject });
    const teacherCells = new Set<string>();
    if (schedule) {
      for (const row of schedule) {
        if (String(row.activeTeacherId) === teacherId && row.lessonNumber !== lesson) {
          teacherCells.add(`${row.classId}-${row.lessonNumber - 1}`);
        }
      }
    }
    setConflictCells(teacherCells);
  }

  function handleDragEnd() {
    setDragSource(null);
    setDragOverTarget(null);
    setConflictCells(new Set());
  }

  async function handleDrop(targetClassId: string, targetLesson: number) {
    if (!dragSource || !schoolId || !schedule) return;
    const targetRow = schedule.find(
      (item) => item.classId === targetClassId && item.lessonNumber === targetLesson,
    );
    if (!targetRow) return;

    const today = todayIso();
    try {
      const overrideId = await applyOverride({
        schoolId,
        date: today,
        classId: targetClassId as Id<"classes">,
        lessonNumber: targetLesson,
        originalTeacherId: targetRow.activeTeacherId,
        substituteTeacherId: dragSource.teacherId as Id<"staff">,
        roomId: targetRow.activeRoomId ?? (targetRow as any).roomId,
        subject: targetRow.subject,
      });
      toast.success("Замена применена", {
        action: {
          label: "Отменить",
          onClick: () => void cancelOv({ overrideId }).then(() => toast.info("Замена отменена")),
        },
      });
    } catch {
      toast.error("Не удалось применить замену");
    }
    handleDragEnd();
  }

  return (
    <PageFrame>
      {!todayOnly ? <PageHeader title="Расписание" subtitle="Учебная сетка на неделю" /> : null}
      {schedule === undefined ? <SkeletonCard /> : (
        <>
          {teacherLoad && !todayOnly ? (
            <div className="mb-4 flex items-center gap-4 text-xs">
              <span className="text-gray-500">Нагрузка учителя:</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-green-100" />&lt;3</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-yellow-100" />3–5</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-red-100" />&ge;6</span>
              {!todayOnly ? <span className="ml-auto text-gray-400">Перетащи ячейку для замены</span> : null}
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-lg bg-white">
            <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `5rem repeat(${Math.max(classes.length, 1)}, minmax(7rem,1fr))` }}>
              <div className="border-b border-gray-100 p-3 text-xs uppercase tracking-wider text-gray-500">Урок</div>
              {classes.map((classDoc) => <div key={classDoc._id} className="border-b border-gray-100 p-3 text-xs font-medium text-gray-500">{classDoc.code}</div>)}
              {Array.from({ length: 8 }).map((_, lessonIndex) => (
                <div key={`lesson-${lessonIndex}`} className="contents">
                  <div className="border-b border-gray-100 p-3 text-sm tabular-nums">{lessonIndex + 1}</div>
                  {classes.map((classDoc) => {
                    const row = schedule.find((item) => item.classId === classDoc._id && item.lessonNumber === lessonIndex + 1);
                    const load = row && teacherLoad ? teacherLoad[String(row.activeTeacherId)] : undefined;
                    const loadStyle = teacherLoad ? teacherLoadColor(load) : "";
                    const cellKey = `${classDoc._id}-${lessonIndex}`;
                    const isConflict = conflictCells.has(cellKey);
                    const isDragOver = dragOverTarget === cellKey;
                    return (
                      <div
                        key={cellKey}
                        draggable={!!row && !todayOnly}
                        onDragStart={() => {
                          if (row) handleDragStart(String(classDoc._id), lessonIndex + 1, String(row.activeTeacherId), String(row.activeRoomId ?? (row as any).roomId), row.subject);
                        }}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragSource) setDragOverTarget(cellKey);
                        }}
                        onDragLeave={() => setDragOverTarget(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          void handleDrop(String(classDoc._id), lessonIndex + 1);
                        }}
                        className={cn(
                          "min-h-16 border-b border-gray-100 p-3 transition-colors",
                          row?.overrideId && "bg-orange-50 text-orange-700",
                          isConflict && "ring-2 ring-inset ring-red-400 bg-red-50",
                          isDragOver && !isConflict && "ring-2 ring-inset ring-blue-400 bg-blue-50",
                          row && !todayOnly && "cursor-grab active:cursor-grabbing",
                        )}
                      >
                        {row ? (
                          <>
                            <p className="text-sm font-medium">{row.subject}</p>
                            <p className={cn("text-xs", loadStyle || "text-gray-500")} title={load != null ? `${load} уроков сегодня` : undefined}>
                              {staffById.get(row.activeTeacherId)?.displayName ?? "Учитель"}
                              {load != null ? <span className="ml-1 text-[10px] opacity-70">({load})</span> : null}
                            </p>
                          </>
                        ) : <span className="text-gray-200">—</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </PageFrame>
  );
}

export function TeacherCabinet() {
  const { currentUser, currentStaff, classes, schoolId } = useSchool();
  const [present, setPresent] = useState(25);
  const [absent, setAbsent] = useState(0);
  const [reasons, setReasons] = useState("");
  const submitFact = useMutation(api["modules/ops/attendance"].submitDashboardFact);
  const schedule = useQuery(api["modules/schoolCore/schedule"].getToday, schoolId ? { schoolId } : "skip");
  const classDoc = classes.find((item) => item.homeroomTeacherId === currentStaff?._id) ?? classes[0];
  const hour = new Date().getHours();
  return (
    <PageFrame>
      <div className="mx-auto max-w-2xl">
        <PageHeader title={hour < 12 ? `Сәлем, ${currentUser?.name.split(" ")[0] ?? "Марат"}! Жаңа күн басталды.` : `Сәлем, ${currentUser?.name.split(" ")[0] ?? "Марат"}. Күн жартысынан өтті.`} subtitle="Кабинет учителя" />
        <Section label="TODAY'S SCHEDULE">
          {(schedule ?? []).filter((row) => row.activeTeacherId === currentStaff?._id).map((row) => (
            <Row key={row._id}><p className="text-xs text-gray-400">Урок {row.lessonNumber}</p><p className="font-medium">{row.subject} · <ClassCode id={row.classId} /></p></Row>
          ))}
        </Section>
        <Section label="ОТЧЁТ О ПОСЕЩАЕМОСТИ">
          <div className="rounded-lg bg-white p-5">
            <p className="text-xl font-medium text-gray-900">{classDoc?.code ?? "Класс не найден"}</p>
            <p className="mt-1 text-sm text-amber-600">Сдай до 09:00 — отчёт важен для питания</p>
            {[
              ["Присутствуют", present, setPresent],
              ["Отсутствуют", absent, setAbsent],
            ].map(([label, value, setter]) => (
              <div key={label as string} className="mt-5 flex items-center justify-between">
                <span className="text-sm text-gray-500">{label as string}</span>
                <div className="flex items-center gap-4">
                  <Button size="icon" variant="outline" onClick={() => (setter as React.Dispatch<React.SetStateAction<number>>)((current) => Math.max(0, current - 1))}><Minus aria-hidden /></Button>
                  <span className="text-2xl font-bold tabular-nums">{value as number}</span>
                  <Button size="icon" onClick={() => (setter as React.Dispatch<React.SetStateAction<number>>)((current) => current + 1)}><Plus aria-hidden /></Button>
                </div>
              </div>
            ))}
            <Textarea className="mt-5" placeholder="Причины отсутствий (необязательно)..." value={reasons} onChange={(event) => setReasons(event.target.value)} />
            <Button
              className="mt-5 h-12 w-full rounded-xl"
              disabled={!schoolId || !currentStaff || !classDoc}
              onClick={() => {
                if (!schoolId || !currentStaff || !classDoc) return;
                void submitFact({ schoolId, staffId: currentStaff._id, classId: classDoc._id, date: todayIso(), presentCount: present, absentCount: absent, mealCount: present, confidence: 1 })
                  .then(() => toast.success(`Посещаемость за ${classDoc.code} сохранена`));
              }}
            >
              Отправить посещаемость
            </Button>
          </div>
        </Section>
        <Section label="MY TASKS"><TasksPage mine /></Section>
      </div>
    </PageFrame>
  );
}

const TIMELINE_HOURS = Array.from({ length: 11 }, (_, i) => 8 + i);

function TimelineStrip({ tasks }: { tasks: Array<{ _id: string; title: string; description: string; priority: string; scheduledHour: number; relatedIncidentId?: string }> }) {
  const scheduled = tasks.filter((t) => t.scheduledHour >= 8 && t.scheduledHour <= 18);
  const unscheduled = tasks.filter((t) => t.scheduledHour < 8 || t.scheduledHour > 18);
  return (
    <div className="mt-4">
      <div className="relative rounded-lg bg-white p-4">
        {TIMELINE_HOURS.map((hour) => {
          const hourTasks = scheduled.filter((t) => t.scheduledHour === hour);
          return (
            <div key={hour} className="flex min-h-12 border-b border-gray-50">
              <div className="w-14 shrink-0 py-2 text-xs tabular-nums text-gray-400">{String(hour).padStart(2, "0")}:00</div>
              <div className="flex flex-1 flex-wrap items-start gap-2 py-1">
                {hourTasks.map((task) => (
                  <div
                    key={task._id}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs",
                      task.relatedIncidentId ? "bg-red-50 text-red-700" :
                      task.priority === "high" ? "bg-orange-50 text-orange-700" :
                      task.priority === "medium" ? "bg-yellow-50 text-yellow-700" :
                      "bg-blue-50 text-blue-700",
                    )}
                  >
                    <p className="font-medium">{task.title}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {unscheduled.length > 0 ? (
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium uppercase text-gray-400">Без времени</p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((task) => (
              <div key={task._id} className="rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-600">{task.title}</div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function KitchenPage() {
  const { schoolId, classes, currentStaff } = useSchool();
  const meal = useQuery(api["modules/ops/attendance"].getMealSummary, schoolId ? { schoolId, date: todayIso() } : "skip");
  const attendance = useQuery(api["modules/ops/attendance"].listByDate, schoolId ? { schoolId, date: todayIso() } : "skip");
  const myTasks = useQuery(
    api["modules/ops/tasks"].listTodayByAssignee,
    schoolId && currentStaff ? { schoolId, staffId: currentStaff._id, date: todayIso() } : "skip",
  );
  const kitchenEvents = useMemo(() => {
    const base: Array<{ _id: string; title: string; description: string; priority: string; scheduledHour: number; relatedIncidentId?: string }> = [
      { _id: "cutoff", title: "Крайний срок сдачи посещаемости", description: "", priority: "high", scheduledHour: 9 },
    ];
    if (myTasks) {
      for (const t of myTasks) base.push(t as any);
    }
    return base;
  }, [myTasks]);
  return (
    <PageFrame>
      <PageHeader title="Питание сегодня" subtitle={new Date().toLocaleDateString("ru-RU")} />
      <div className="mb-10">
        <p className="text-4xl font-bold text-brand-purple tabular-nums">Всего порций: {meal?.totalMeals ?? 0}</p>
        <p className="mt-3 text-2xl text-gray-600">Отсутствует: {meal?.totalAbsent ?? 0} учеников</p>
      </div>
      <Section label="МОЙ ДЕНЬ">
        <TimelineStrip tasks={kitchenEvents} />
      </Section>
      <Section label="ПОСЕЩАЕМОСТЬ ПО КЛАССАМ">
        <div className="rounded-lg bg-white">
          {(attendance ?? []).map((record) => (
            <Row key={record._id} className="px-5 text-lg">
              <div className="grid grid-cols-3 gap-4">
                <span><ClassCode id={record.classId} /></span>
                <span className="text-gray-500"><StaffName id={classes.find((classDoc) => classDoc._id === record.classId)?.homeroomTeacherId} /></span>
                <span className="text-right tabular-nums">{record.mealCount}</span>
              </div>
            </Row>
          ))}
        </div>
      </Section>
      <Button className="mt-8 h-14 w-full text-lg" onClick={() => window.print()}>Распечатать</Button>
    </PageFrame>
  );
}

export function FacilitiesPage() {
  const { schoolId, currentStaff } = useSchool();
  const timelineTasks = useQuery(
    api["modules/ops/tasks"].listTodayByAssignee,
    schoolId && currentStaff ? { schoolId, staffId: currentStaff._id, date: todayIso() } : "skip",
  );
  const tasks = useQuery(api["modules/ops/tasks"].listBoard, schoolId && currentStaff ? { schoolId, assigneeStaffId: currentStaff._id } : "skip");
  const updateStatus = useMutation(api["modules/ops/tasks"].updateStatus);
  const [hidden, setHidden] = useState<Set<Id<"tasks">>>(new Set());
  const rows = (tasks ?? []).filter((task) => task.status !== "done" && !hidden.has(task._id));
  return (
    <PageFrame>
      <PageHeader title="Мои задачи" subtitle="Хозяйственные поручения" />
      {timelineTasks && timelineTasks.length > 0 ? (
        <Section label="МОЙ ДЕНЬ">
          <TimelineStrip tasks={timelineTasks as any} />
        </Section>
      ) : null}
      <Section label="ВСЕ ЗАДАЧИ">
        {tasks === undefined ? <SkeletonCard /> : rows.length === 0 ? (
          <EmptyState icon={CheckCircle} title="Все задачи выполнены!" subtitle="Отличная работа команды сегодня" />
        ) : rows.map((task) => (
          <motion.div key={task._id} className="mb-6 border-b border-gray-100 pb-6" exit={{ opacity: 0 }}>
            <h2 className="text-xl font-medium text-gray-900">{task.title}</h2>
            <p className="mt-2 text-gray-500">{task.description}</p>
            <p className="mt-3 text-sm text-gray-500">{task.priority === "high" ? "Высокий приоритет" : "Обычный приоритет"}</p>
            <Button className="mt-4 h-14 w-full bg-green-500 text-lg hover:bg-green-600" onClick={() => {
              setHidden((current) => new Set(current).add(task._id));
              void updateStatus({ taskId: task._id, status: "done" }).then(() => toast.success("Задача выполнена!"));
            }}>
              Отметить выполненной
            </Button>
          </motion.div>
        ))}
      </Section>
    </PageFrame>
  );
}

export function StaffPage() {
  const { schoolId } = useSchool();
  const staff = useQuery(api["modules/schoolCore/staff"].listBySchool, schoolId ? { schoolId } : "skip");
  const updateStaff = useMutation(api["modules/schoolCore/staff"].updateStaff);
  return (
    <PageFrame>
      <PageHeader title="Сотрудники" subtitle="Управление персоналом школы" />
      {staff === undefined ? <SkeletonCard /> : staff.map((member) => (
        <Row key={member._id}>
          <div className="grid items-center gap-4 md:grid-cols-[1fr_8rem_8rem]">
            <div className="flex items-center gap-3">
              <AvatarInitials name={member.displayName} />
              <div>
                <p className="font-medium text-gray-900">{member.fullName}</p>
                <p className="text-sm text-gray-500">{member.subjects.join(", ") || "Без предмета"}</p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-500">
              Telegram
              <Switch checked={member.telegramEnabled} onCheckedChange={(checked) => void updateStaff({ staffId: member._id, patch: { telegramEnabled: checked } }).then(() => toast.success("Настройки сотрудника обновлены"))} />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-500">
              Dashboard
              <Switch checked={member.dashboardAccess} onCheckedChange={(checked) => void updateStaff({ staffId: member._id, patch: { dashboardAccess: checked } }).then(() => toast.success("Настройки сотрудника обновлены"))} />
            </label>
          </div>
        </Row>
      ))}
    </PageFrame>
  );
}
