import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

// Hostnames que pertencem ao app do motorista (PWA instalado no celular).
const MOTORISTA_HOSTS = ["app.rota013.com.br"];

function destinoPorHost(host: string | undefined): "/motorista" | "/login" {
  if (!host) return "/login";
  return MOTORISTA_HOSTS.includes(host.toLowerCase()) ? "/motorista" : "/login";
}

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const host = typeof window !== "undefined" ? window.location.hostname : undefined;
    navigate({ to: destinoPorHost(host), replace: true });
  }, [navigate]);
  return null;
}
