// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
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

afterEach(() => {
  cleanup();
});

describe("Dashboard page (integração)", () => {
  it("o componente está exportado pela rota /dashboard", () => {
    expect(DashboardPage).toBeTypeOf("function");
  });

  it("renderiza o shell principal sem tela em branco", async () => {
    const { container } = render(<DashboardPage />);

    // Título principal (h1) do dashboard precisa aparecer.
    expect(
      await screen.findByRole("heading", { level: 1, name: /dashboard/i }),
    ).toBeInTheDocument();

    // Sanidade: o container tem conteúdo (uma tela branca seria vazia).
    expect(container.textContent?.length ?? 0).toBeGreaterThan(20);
  });

  it("monta as seções principais (mapa, corridas, motoristas)", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/mapa em tempo real/i)).toBeInTheDocument();
      expect(screen.getByText(/corridas ativas/i)).toBeInTheDocument();
      expect(screen.getByText(/motoristas online/i)).toBeInTheDocument();
    });

    expect(screen.getByTestId("map-leaflet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /nova corrida/i }),
    ).toBeInTheDocument();
  });

  it("mostra os estados vazios quando não há dados", async () => {
    render(<DashboardPage />);

    expect(
      await screen.findByText(/nenhuma corrida ativa/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/nenhum motorista online/i)).toBeInTheDocument();
  });
});
