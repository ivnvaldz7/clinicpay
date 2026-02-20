import { useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/api/auth.api";

export const useAuth = () => {
  const { accessToken, user, setAuth, logout: clearStore } = useAuthStore();

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login({ email, password });
    setAuth(data.accessToken, data.user);
    return data.user;
  }, [setAuth]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearStore();
    }
  }, [clearStore]);

  return {
    user,
    accessToken,
    isAuthenticated: !!accessToken,
    login,
    logout,
  };
};
