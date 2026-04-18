import { useMemo, useState } from "react";
import { Bell, Circle } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AIChat } from "@/components/AIChat";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationPanel } from "@/components/NotificationPanel";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Button } from "@/components/ui/button";
import { useSchool } from "@/context/SchoolContext";
import { navItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function currentDateLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

export function AppLayout({ simple = false }: { simple?: boolean }) {
  const location = useLocation();
  const { currentUser } = useSchool();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const items = useMemo(
    () => navItems.filter((item) => currentUser && item.roles.includes(currentUser.role)),
    [currentUser],
  );
  const pageName = items.find((item) => location.pathname === item.path)?.label ?? "Главная";

  if (!currentUser) return null;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {!simple ? (
        <aside className="group fixed inset-y-0 left-0 z-20 hidden w-16 flex-col bg-brand-purple transition-all duration-200 hover:w-60 md:flex">
          <div className="flex h-16 items-center justify-center">
            <div className="flex size-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-brand-purple">
              A
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-white transition-colors hover:bg-white/10",
                      isActive && "bg-brand-accent",
                    )
                  }
                >
                  <Icon className="size-6 shrink-0" aria-hidden />
                  <span className="truncate opacity-0 transition-opacity group-hover:opacity-100">
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </nav>
          <button
            className="m-3 flex min-h-11 items-center justify-center gap-3 rounded-lg text-white hover:bg-white/10"
            onClick={() => setProfileOpen(true)}
            type="button"
          >
            <AvatarInitials name={currentUser.name} className="bg-white/15 text-white" />
            <span className="hidden truncate text-sm group-hover:block">{currentUser.name}</span>
          </button>
        </aside>
      ) : null}
      <header
        className={cn(
          "sticky top-0 z-10 flex h-14 items-center justify-between border-b border-gray-100 bg-white px-4 md:px-8",
          !simple && "md:ml-16",
        )}
      >
        <div className="text-sm text-gray-500">Home &gt; {pageName}</div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className="size-2 animate-pulse rounded-full bg-green-500" />
            Live
          </span>
          <span className="hidden items-center gap-1 text-xs text-gray-400 sm:flex">
            <Circle className="size-2 fill-green-500 text-green-500" aria-hidden />
            {currentDateLabel()}
          </span>
          {!simple ? (
            <motion.div
              whileHover={{ rotate: [0, 15, -15, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setNotificationsOpen(true)}
              >
                <Bell aria-hidden />
                <span className="absolute right-2 top-2 size-2 rounded-full bg-error" />
                <span className="sr-only">Уведомления</span>
              </Button>
            </motion.div>
          ) : null}
          <button
            className="flex size-10 items-center justify-center rounded-full bg-brand-accent text-sm font-medium text-white"
            onClick={() => setProfileOpen(true)}
            type="button"
          >
            <AvatarInitials name={currentUser.name} className="bg-transparent text-white" />
          </button>
        </div>
      </header>
      <main className={cn("pb-24", !simple && "md:ml-16")}>
        <div className={cn("mx-auto px-4 py-8 md:px-8", simple ? "max-w-5xl" : "max-w-4xl")}>
          <Outlet />
        </div>
      </main>
      {!simple ? (
        <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t border-gray-100 bg-white md:hidden">
          {items.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={`mobile-${item.path}`}
                to={item.path}
                className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-gray-500"
              >
                <Icon className="size-5" aria-hidden />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      ) : null}
      <ProfileDrawer open={profileOpen} onOpenChange={setProfileOpen} user={currentUser} />
      {!simple ? (
        <>
          <NotificationPanel open={notificationsOpen} onOpenChange={setNotificationsOpen} />
          <CommandPalette />
          <AIChat />
        </>
      ) : null}
    </div>
  );
}
