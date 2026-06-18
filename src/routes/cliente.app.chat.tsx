import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Phone } from "lucide-react";

export const Route = createFileRoute("/cliente/app/chat")({
  ssr: false,
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="px-4 py-5 space-y-4">
      <h2 className="text-2xl font-bold">Falar com a Central</h2>

      <Card className="p-6 rounded-2xl text-center space-y-3">
        <MessageCircle className="size-12 mx-auto text-primary" />
        <h3 className="font-semibold">Chat com a Central</h3>
        <p className="text-sm text-muted-foreground">
          O chat integrado estará disponível em breve. Enquanto isso, fale conosco pelo WhatsApp.
        </p>
        <Button asChild className="w-full rounded-xl">
          <a href="https://wa.me/5513900000000" target="_blank" rel="noopener noreferrer">
            <Phone className="size-4 mr-2" />
            Abrir no WhatsApp
          </a>
        </Button>
      </Card>
    </div>
  );
}
