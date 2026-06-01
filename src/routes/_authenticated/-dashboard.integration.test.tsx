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
  it("renderiza o shell principal sem tela em branco", async () => {
    render(<DashboardPage />);

    // O dashboard é o componente principal: deve montar mapa, corridas e
    // motoristas. Se a tela ficasse em branco nenhum desses textos apareceria.
    await waitFor(() => {
      expect(screen.getByText(/mapa em tempo real/i)).toBeInTheDocument();
      expect(screen.getByText(/corridas ativas/i)).toBeInTheDocument();
      expect(screen.getByText(/motoristas online/i)).toBeInTheDocument();
    });

    // Título principal renderizado.
    expect(
      screen.getByRole("heading", { level: 1, name: /dashboard/i }),
    ).toBeInTheDocument();

    // Componentes pesados (mockados) aparecem montados.
    expect(screen.getByTestId("map-leaflet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /nova corrida/i }),
    ).toBeInTheDocument();

    // Sanidade: o body tem conteúdo (uma tela branca seria vazia).
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(50);
  });

  it("mostra os estados vazios quando o Supabase retorna sem dados", async () => {
    render(<DashboardPage />);

    expect(
      await screen.findByText(/nenhuma corrida ativa/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/nenhum motorista online/i)).toBeInTheDocument();
  });
});
