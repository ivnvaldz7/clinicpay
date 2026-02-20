import { useEffect, useState } from "react";
import { authApi } from "@/api/auth.api";
import { useAuthStore } from "@/store/auth.store";

/**
 * On mount, tries to get a new accessToken via the httpOnly cookie.
 * If the cookie is valid, also fetches the current user and stores both.
 * Shows nothing until the check is done so there's no flash to /login.
 */
export const AuthProvider = ({ children }) => {
  const [ready, setReady] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const { data: refreshData } = await authApi.refresh();
        const { data: meData } = await authApi.me();
        setAuth(refreshData.accessToken, meData.user);
      } catch {
        // No valid session — stay logged out
      } finally {
        setReady(true);
      }
    };
    hydrate();
  }, [setAuth]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return children;
};
