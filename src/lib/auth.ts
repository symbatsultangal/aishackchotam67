import type { CurrentUser, DemoRole } from "@/types";
import { backendRole } from "@/lib/utils";

const STORAGE_KEY = "digital-vp-current-user";

type DemoAccount = {
  email: string;
  password: string;
  role: DemoRole;
  name: string;
  staffId: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "director@school.demo",
    password: "demo1234",
    role: "director",
    name: "Айдар Бекович",
    staffId: "demo-director",
  },
  {
    email: "vp@school.demo",
    password: "demo1234",
    role: "viceprincipal",
    name: "Гүлнар Асанова",
    staffId: "demo-vp",
  },
  {
    email: "teacher@school.demo",
    password: "demo1234",
    role: "teacher",
    name: "Марат Сейткали",
    staffId: "demo-teacher",
  },
  {
    email: "admin@school.demo",
    password: "demo1234",
    role: "admin",
    name: "Дина Қасымова",
    staffId: "demo-admin",
  },
  {
    email: "kitchen@school.demo",
    password: "demo1234",
    role: "kitchen",
    name: "Айгүл Нұрова",
    staffId: "demo-kitchen",
  },
  {
    email: "facilities@school.demo",
    password: "demo1234",
    role: "facilities",
    name: "Болат Ержанов",
    staffId: "demo-facilities",
  },
];

function toCurrentUser(account: DemoAccount): CurrentUser {
  return {
    email: account.email,
    role: account.role,
    backendRole: backendRole(account.role),
    name: account.name,
    staffId: account.staffId,
  };
}

export function login(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const account = DEMO_ACCOUNTS.find(
    (candidate) => candidate.email === normalizedEmail && candidate.password === password,
  );
  if (!account) {
    throw new Error("Заполни корректные данные демо-аккаунта");
  }
  const user = toCurrentUser(account);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("digital-vp-auth-change"));
  return user;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("digital-vp-auth-change"));
}

export function getCurrentUser(): CurrentUser | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
