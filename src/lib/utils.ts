import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BackendRole, DemoRole } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null) {
  if (!name) {
    return "A";
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function avatarColor(name?: string | null) {
  const palette = [
    "bg-purple-100 text-brand-purple",
    "bg-amber-100 text-amber-700",
    "bg-green-100 text-green-700",
    "bg-blue-100 text-blue-700",
    "bg-rose-100 text-rose-700",
    "bg-gray-100 text-gray-700",
  ];
  const key = name ?? "A";
  const hash = key.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function backendRole(role: DemoRole): BackendRole {
  return role === "viceprincipal" ? "vice_principal" : role;
}

export function routeForRole(role?: DemoRole | BackendRole | string) {
  if (role === "director") return "/dashboard";
  if (role === "viceprincipal" || role === "vice_principal") return "/vp";
  if (role === "teacher") return "/teacher";
  if (role === "admin") return "/admin/staff";
  if (role === "kitchen") return "/kitchen";
  if (role === "facilities") return "/facilities";
  return "/login";
}

export function formatRelativeMinutes(timestamp: number) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "только что";
  if (minutes === 1) return "1 мин. назад";
  return `${minutes} мин. назад`;
}

export function safePercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}
