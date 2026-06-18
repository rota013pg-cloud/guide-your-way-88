import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bike, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente/app/")({
  ssr: false,
  component: ClienteAppHome,
});

function ClienteAppHome() {
  return (
    <div className="px-4 py-5 space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Para onde vamos?</h2>
        <p className="text-sm text-muted-foreground">Mototáxi rápido e seguro no Litoral Sul.</p>
      </div>

      {/* Placeholder do mapa — Fase B */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="aspect-square bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
          <div className="text-center text-muted-foreground text-sm px-6">
            <Bike className="size-10 mx-auto mb-2 text-primary" />
            <p>O mapa com motociclistas online aparecerá aqui em breve.</p>
          </div>
        </div>
      </Card>

      {/* Formulário */}
      <Card className="rounded-2xl p-4 space-y-3">
        <Field icon={<MapPin className="size-4 text-primary" />} placeholder="Endereço de origem" />
        <Field icon={<MapPin className="size-4 text-destructive" />} placeholder="Endereço de destino" />
        <button className="flex items-center gap-2 text-xs text-primary font-medium">
          <Plus className="size-4" />
          Adicionar parada
        </button>
        <Button
          className="w-full rounded-xl"
          size="lg"
          onClick={() => toast.info("Em breve: solicitação de corrida.")}
        >
          Solicitar corrida
        </Button>
      </Card>
    </div>
  );
}

function Field({ icon, placeholder }: { icon: React.ReactNode; placeholder: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
      {icon}
      <input
        type="text"
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        disabled
      />
    </div>
  );
}
