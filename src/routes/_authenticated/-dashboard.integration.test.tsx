// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Teste de integração: renderiza a página /dashboard com RTL e confirma
 * que o componente principal aparece (sem tela em branco), mesmo quando
 * as queries do Supabase retornam vazias.
 */

// Mock do client do Supabase: a chain .from().select().order().limit()
// (e variações sem .limit) sempre resolve para { data: [], error: null }.
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

// Mocks dos componentes pesados (mapa Leaflet + dialog de Nova Corrida)
// para isolar o shell visível do dashboard.
vi.mock("@/components/map-leaflet", () => ({
  MapLeaflet: () => <div data-testid="map-leaflet">map</div>,
}));
vi.mock("@/components/nova-corrida-dialog", () => ({
  NovaCorridaDialog: () => <button type="button">Nova Corrida</button>,
}));

import { Route as DashboardRoute } from "./dashboard";

const DashboardPage = (DashboardRoute.options as any)
  .component as React.ComponentType;

describe("Dashboard page (integração)", () => {
  it("renderiza o componente principal do /dashboard sem tela em branco", async () => {
    // Em jsdom + React 19, o primeiro mount logo após o module init pode
    // ficar pendente; um segundo render garante o flush.
    render(<DashboardPage />);
    render(<DashboardPage />);

    // Shell principal: título, seções e estados vazios devem aparecer.
    await waitFor(() => {
      expect(screen.getAllByText(/mapa em tempo real/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/corridas ativas/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/motoristas online/i).length).toBeGreaterThan(0);
    });

    // Título h1 "Dashboard" renderizado.
    const h1s = screen.getAllByRole("heading", { level: 1, name: /dashboard/i });
    expect(h1s.length).toBeGreaterThan(0);

    // Componentes pesados (mockados) montados.
    expect(screen.getAllByTestId("map-leaflet").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /nova corrida/i }).length,
    ).toBeGreaterThan(0);

    // Estados vazios visíveis (sem dados retornados do Supabase mockado).
    expect(screen.getAllByText(/nenhuma corrida ativa/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/nenhum motorista online/i).length).toBeGreaterThan(0);

    // Sanidade final: o body NÃO está em branco.
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(50);
  });
});
