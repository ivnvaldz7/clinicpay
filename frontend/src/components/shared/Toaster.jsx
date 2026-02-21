import { CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";
import { useToastStore } from "@/store/toast.store";
import { cn } from "@/lib/utils";

const ICONS = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />,
  error:   <XCircle      className="h-4 w-4 text-red-500     shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500  shrink-0 mt-0.5" />,
};

const BORDER = {
  success: "border-l-emerald-500",
  error:   "border-l-red-500",
  warning: "border-l-amber-500",
};

const ToastItem = ({ id, message, type }) => {
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className={cn(
        "flex items-start gap-3 w-80 rounded-lg border border-l-4 bg-card px-4 py-3 shadow-lg",
        BORDER[type] ?? "border-l-primary",
      )}
    >
      {ICONS[type]}
      <p className="flex-1 text-sm text-foreground leading-snug">{message}</p>
      <button
        onClick={() => dismiss(id)}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export const Toaster = () => {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
};
