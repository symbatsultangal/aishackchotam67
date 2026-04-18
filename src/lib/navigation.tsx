import {
  ArrowsClockwise,
  ChartBar,
  CheckSquare,
  ClipboardText,
  Files,
  ForkKnife,
  Microphone,
  SquaresFour,
  Tray,
  Users,
  Warning,
} from "@phosphor-icons/react";
import type React from "react";
import type { DemoRole } from "@/types";

export type NavItem = {
  label: string;
  path: string;
  icon: React.ElementType;
  roles: DemoRole[];
};

export const navItems: NavItem[] = [
  { label: "Главная", path: "/dashboard", icon: SquaresFour, roles: ["director"] },
  { label: "Посещаемость", path: "/dashboard/attendance", icon: ClipboardText, roles: ["director"] },
  { label: "Инциденты", path: "/dashboard/incidents", icon: Warning, roles: ["director"] },
  { label: "Задачи", path: "/dashboard/tasks", icon: CheckSquare, roles: ["director"] },
  { label: "Замены", path: "/dashboard/substitutions", icon: ArrowsClockwise, roles: ["director"] },
  { label: "Документы", path: "/dashboard/documents", icon: Files, roles: ["director"] },
  { label: "Очередь", path: "/dashboard/queue", icon: Tray, roles: ["director"] },
  { label: "Голос", path: "/dashboard/voice", icon: Microphone, roles: ["director"] },
  { label: "Аналитика", path: "/dashboard/analytics", icon: ChartBar, roles: ["director"] },
  { label: "Главная", path: "/vp", icon: SquaresFour, roles: ["viceprincipal"] },
  { label: "Расписание", path: "/vp/schedule", icon: ClipboardText, roles: ["viceprincipal"] },
  { label: "Замены", path: "/vp/substitutions", icon: ArrowsClockwise, roles: ["viceprincipal"] },
  { label: "Инциденты", path: "/vp/incidents", icon: Warning, roles: ["viceprincipal"] },
  { label: "Кабинет", path: "/teacher", icon: SquaresFour, roles: ["teacher"] },
  { label: "Задачи", path: "/teacher/tasks", icon: CheckSquare, roles: ["teacher"] },
  { label: "Расписание", path: "/teacher/schedule", icon: ClipboardText, roles: ["teacher"] },
  { label: "Сотрудники", path: "/admin/staff", icon: Users, roles: ["admin"] },
  { label: "Документы", path: "/admin/documents", icon: Files, roles: ["admin"] },
  { label: "Питание", path: "/kitchen", icon: ForkKnife, roles: ["kitchen"] },
  { label: "Задачи", path: "/facilities", icon: CheckSquare, roles: ["facilities"] },
];
