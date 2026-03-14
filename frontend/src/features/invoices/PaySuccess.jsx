import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PaySuccess = () => {
  const [params] = useSearchParams();
  const invoiceId = params.get("invoiceId");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm">
        <div className="rounded-full bg-emerald-100 p-5">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">¡Pago recibido!</h1>
          <p className="text-muted-foreground text-sm">
            Tu pago fue procesado exitosamente. Recibirás una confirmación por email.
          </p>
          {invoiceId && (
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Ref: {invoiceId}
            </p>
          )}
        </div>

        <Button asChild variant="outline">
          <Link to="/login">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
};
