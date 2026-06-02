import { createFileRoute, Navigate } from "@tanstack/react-router";

// Rota dedicada para o app instalado em operador.rota013.com.br/painel.
// Garante que abrir esse caminho leve direto ao painel do operador
// (e não para o app do motorista). Se não estiver logado, /dashboard
// está sob _authenticated e redireciona para /login automaticamente.
export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Painel do Operador — Rota 013" },
      { name: "description", content: "Painel de operação Rota 013." },
    ],
  }),
  component: PainelRedirect,
});

function PainelRedirect() {
  return <Navigate to="/dashboard" replace />;
}
