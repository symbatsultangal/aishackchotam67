import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { DemoRole } from "@/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function useRoleGuard(allowedRoles: DemoRole[]) {
  const navigate = useNavigate();
  const user = useCurrentUser();

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      navigate("/login", { replace: true });
    }
  }, [allowedRoles, navigate, user]);

  return { user, loading: false };
}
