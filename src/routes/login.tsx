import { createFileRoute, Navigate } from "@tanstack/react-router";

// Compatibilidade: rota antiga /login agora redireciona para /operador/login.
export const Route = createFileRoute("/login")({
  component: () => <Navigate to="/operador/login" replace />,
});
