import { createFileRoute, redirect } from "@tanstack/react-router";

// Hostnames que pertencem ao app do motorista (PWA instalado no celular).
const MOTORISTA_HOSTS = ["app.rota013.com.br"];

function destinoPorHost(host: string | undefined): "/motorista" | "/login" {
  if (!host) return "/login";
  return MOTORISTA_HOSTS.includes(host.toLowerCase()) ? "/motorista" : "/login";
}

export const Route = createFileRoute("/")({
  beforeLoad: ({ location }) => {
    // SSR: usa o host da request. Cliente: usa window.location.hostname.
    const host =
      typeof window !== "undefined"
        ? window.location.hostname
        : // @ts-expect-error - host pode vir do request em SSR
          (location as { host?: string }).host;
    throw redirect({ to: destinoPorHost(host) });
  },
});
