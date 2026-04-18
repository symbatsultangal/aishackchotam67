import { Copy, SignOut } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { logout } from "@/lib/auth";
import type { CurrentUser } from "@/types";

const roleLabels: Record<CurrentUser["role"], string> = {
  director: "Директор",
  viceprincipal: "Завуч",
  teacher: "Учитель",
  admin: "Администратор",
  kitchen: "Питание",
  facilities: "Хозяйственная часть",
};

export function ProfileDrawer({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CurrentUser;
}) {
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-6">
        <SheetTitle className="sr-only">Профиль</SheetTitle>
        <div className="flex flex-col items-center text-center">
          <AvatarInitials name={user.name} size="lg" className="bg-brand-accent text-white" />
          <h2 className="mt-4 text-xl font-medium text-gray-900">{user.name}</h2>
          <Badge className="mt-2">{roleLabels[user.role]}</Badge>
        </div>
        <Separator className="my-6" />
        <div className="flex flex-col gap-4 text-sm">
          <div>
            <p className="text-gray-400">Email</p>
            <button
              className="mt-1 flex min-h-11 w-full items-center justify-between rounded-lg text-left text-gray-700 hover:bg-gray-50"
              onClick={() => {
                void navigator.clipboard.writeText(user.email);
                toast.success("Email скопирован");
              }}
              type="button"
            >
              <span>{user.email}</span>
              <Copy aria-hidden />
            </button>
          </div>
          <div>
            <p className="text-gray-400">Staff ID</p>
            <p className="mt-1 text-gray-700">{user.staffId}</p>
          </div>
        </div>
        <Separator className="my-6" />
        <Button
          variant="ghost"
          className="w-full justify-start text-red-500 hover:text-red-600"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          <SignOut aria-hidden />
          Выйти из системы
        </Button>
      </SheetContent>
    </Sheet>
  );
}
