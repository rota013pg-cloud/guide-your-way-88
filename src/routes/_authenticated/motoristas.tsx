import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/motoristas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Motoristas — Rota 013 Beta" }] }),
  component: MotoristasPage,
});

function MotoristasPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Motoristas</h1>
        <p className="text-sm text-muted-foreground">Cadastro, fotos, documentos e geração de credenciais de acesso.</p>
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
