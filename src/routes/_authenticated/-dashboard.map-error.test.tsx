// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Cenário de falha: o MapLeaflet lança um erro ao renderizar. A página
 * /dashboard deve mostrar um estado de erro (via ErrorBoundary) e continuar
 * renderizando o resto do shell — nunca uma tela em branco.
 */

vi.mock("@/integrations/supabase/client", () => {
  const makeBuilder = (): any => {
    const builder: any = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      update: vi.fn(() => builder),
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (resolve: any) => resolve({ data: [], error: null }),
    };
    return builder;
  };
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };
  return {
    supabase: {
      from: vi.fn(() => makeBuilder()),
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  };
});

// Força o MapLeaflet a lançar durante a renderização.
vi.mock("@/components/map-leaflet", () => ({
  MapLeaflet: () => {
    throw new Error("Falha simulada no MapLeaflet");
  },
}));

vi.mock("@/components/nova-corrida-dialog", () => ({
  NovaCorridaDialog: () => <button type="button">Nova Corrida</button>,
}));

import { Route as DashboardRoute } from "./dashboard";

const DashboardPage = (DashboardRoute.options as any)
  .component as React.ComponentType;

describe("Dashboard — falha no MapLeaflet", () => {
  it("exibe estado de erro do mapa e mantém o restante do shell visível", async () => {
    // Silencia o console.error esperado do React + ErrorBoundary.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Em jsdom + React 19, o primeiro mount logo após o module init pode
    // ficar pendente; um segundo render garante o flush.
    render(<DashboardPage />);
    render(<DashboardPage />);

    // O fallback do ErrorBoundary aparece no lugar do mapa.
    await waitFor(() => {
      expect(
        screen.getAllByTestId("error-boundary-fallback").length,
      ).toBeGreaterThan(0);
    });

    // O texto amigável menciona o componente que falhou (o mapa).
    expect(
      screen.getAllByText(/não foi possível carregar o mapa/i).length,
    ).toBeGreaterThan(0);

    // É um alert acessível.
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);

    // O resto do dashboard CONTINUA renderizando (não é tela em branco):
    expect(
      screen.getAllByRole("heading", { level: 1, name: /dashboard/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/mapa em tempo real/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/corridas ativas/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/motoristas online/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /nova corrida/i }).length,
    ).toBeGreaterThan(0);

    // Sanidade final: body tem bastante conteúdo.
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(50);

    errSpy.mockRestore();
  });
});
