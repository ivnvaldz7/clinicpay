import { useToastStore } from "@/store/toast.store";

export const useToast = () => {
  const toast = useToastStore((s) => s.toast);
  return {
    success: (message) => toast({ message, type: "success" }),
    error: (message) => toast({ message, type: "error" }),
    warning: (message) => toast({ message, type: "warning" }),
  };
};
