import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/auth";

export function useCurrentUser() {
  const [user, setUser] = useState(getCurrentUser);

  useEffect(() => {
    function syncUser() {
      setUser(getCurrentUser());
    }
    window.addEventListener("storage", syncUser);
    window.addEventListener("digital-vp-auth-change", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("digital-vp-auth-change", syncUser);
    };
  }, []);

  return user;
}
