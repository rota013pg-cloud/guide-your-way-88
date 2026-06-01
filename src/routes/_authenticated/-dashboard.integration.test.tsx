// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Teste de integração: renderiza a página /dashboard com RTL e confirma
 * que o componente principal aparece (sem tela em branco), mesmo quando
 * as queries do Supabase retornam vazias.
 */

// Mock do client do Supabase: encadeamento .from().select().order().limit()
// resolve para { data: [], error: null }. Realtime channel é noop.
vi.mock("@/integrations/supabase/client", () => {
  const builder: any = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    update: vi.fn(() => builder),
    eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };
  return {
    supabase: {
      from: vi.fn(() => builder),
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      auth: {
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: null }, error: null }),
        ),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    },
  };
});

// Mock dos componentes pesados (mapa Leaflet + dialog Nova Corrida) para
// isolar o que estamos testando: o shell visível do dashboard.
vi.mock("@/components/map-leaflet", () => ({
  MapLeaflet: () => <div data-testid="map-leaflet">map</div>,
}));
vi.mock("@/components/nova-corrida-dialog", () => ({
  NovaCorridaDialog: () => <button>Nova Corrida</button>,
}));

import { Route as DashboardRoute } from "./dashboard";
const DashboardPage = (DashboardRoute.options as any).component as React.FC;


describe("Dashboard page (integração)", () => {
  it("renderiza o título principal sem tela em branco", async () => {
    const { container } = render(<DashboardPage />);

    // O título "Dashboard" é o componente principal do shell.
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();

    // Sanidade: o DOM não está vazio (tela branca seria <body></body>).
    expect(container.textContent?.length ?? 0).toBeGreaterThan(20);
  });

  it("monta as seções principais (mapa, corridas, motoristas)", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/mapa em tempo real/i)).toBeInTheDocument();
      expect(screen.getByText(/corridas ativas/i)).toBeInTheDocument();
      expect(screen.getByText(/motoristas online/i)).toBeInTheDocument();
    });

    // Mocks dos componentes pesados aparecem montados.
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
