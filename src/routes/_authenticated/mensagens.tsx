import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mensagens")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mensagens — Rota 013 Beta" }] }),
  component: MensagensPage,
});

function MensagensPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mensagens</h1>
        <p className="text-sm text-muted-foreground">Templates de WhatsApp e mensagens em massa.</p>
      </div>
      <Card className="p-10 flex flex-col items-center justify-center gap-3 text-center border-dashed">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Construction className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="font-semibold">Em construção</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Este módulo será implementado na próxima fase do plano de portagem.
          </p>
        </div>
      </Card>
    </div>
  );
}
