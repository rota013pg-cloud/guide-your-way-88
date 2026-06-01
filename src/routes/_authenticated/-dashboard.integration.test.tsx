// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Teste de integração: renderiza a página /dashboard com RTL e confirma
 * que o componente principal aparece (sem tela em branco), incluindo o
 * wrapper real do MapLeaflet (somente o inner — que carrega react-leaflet
 * — é mockado para não exigir um runtime de DOM com dimensões reais).
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

// IMPORTANTE: mockamos somente o inner (que importa react-leaflet + CSS),
// para que o componente real MapLeaflet (wrapper com Suspense + estado
// `mounted`) seja exercitado no teste.
vi.mock("@/components/map-leaflet-inner", () => ({
  default: ({ motoristas }: { motoristas: Array<{ codigo: string }> }) => (
    <div
      data-testid="map-inner"
      data-motoristas-count={motoristas.length}
      style={{ height: "100%", width: "100%" }}
    >
      map-inner
    </div>
  ),
}));

vi.mock("@/components/nova-corrida-dialog", () => ({
  NovaCorridaDialog: () => <button type="button">Nova Corrida</button>,
}));

import { Route as DashboardRoute } from "./dashboard";
import { MapLeaflet } from "@/components/map-leaflet";

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
    expect(
      screen.getAllByRole("heading", { level: 1, name: /dashboard/i }).length,
    ).toBeGreaterThan(0);

    // Botão "Nova Corrida" (mockado) montado.
    expect(
      screen.getAllByRole("button", { name: /nova corrida/i }).length,
    ).toBeGreaterThan(0);

    // Estados vazios visíveis.
    expect(screen.getAllByText(/nenhuma corrida ativa/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/nenhum motorista online/i).length).toBeGreaterThan(0);

    // Wrapper do mapa: o MapLeaflet REAL eventualmente substitui o
    // placeholder de carregamento pelo inner (mockado). Sem erro de runtime.
    await waitFor(
      () => {
        expect(screen.getAllByTestId("map-inner").length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    // Sanidade: body não está em branco.
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(50);
  });
});

describe("MapLeaflet (wrapper)", () => {
  it("monta um container de mapa (placeholder → inner) sem erro", async () => {
    // Render duplo para garantir flush do useEffect/Suspense em jsdom.
    render(<MapLeaflet motoristas={[]} />);
    const { container } = render(<MapLeaflet motoristas={[]} />);

    // Antes do useEffect rodar, o wrapper renderiza um placeholder de
    // carregamento (div com altura/largura completas). Não deve estar vazio.
    expect(container.firstChild).not.toBeNull();
    expect((container.firstChild as HTMLElement).tagName).toBe("DIV");

    // Após mount + resolução do Suspense, o inner (mockado) aparece.
    await waitFor(
      () => {
        expect(screen.getAllByTestId("map-inner").length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    // E recebe a prop motoristas (lista vazia neste cenário).
    const inner = screen.getAllByTestId("map-inner")[0];
    expect(inner.getAttribute("data-motoristas-count")).toBe("0");
  });

  it("propaga marcadores para o inner quando há motoristas", async () => {
    render(
      <MapLeaflet
        motoristas={[
          { codigo: "M01", nome: "Alpha", lat: -23.96, lng: -46.33, status: "Online" },
          { codigo: "M02", nome: "Bravo", lat: -23.95, lng: -46.34, status: "Em corrida" },
        ]}
      />,
    );
    render(
      <MapLeaflet
        motoristas={[
          { codigo: "M01", nome: "Alpha", lat: -23.96, lng: -46.33, status: "Online" },
          { codigo: "M02", nome: "Bravo", lat: -23.95, lng: -46.34, status: "Em corrida" },
        ]}
      />,
    );

    await waitFor(() => {
      const inners = screen.getAllByTestId("map-inner");
      expect(inners.length).toBeGreaterThan(0);
      expect(inners.some((el) => el.getAttribute("data-motoristas-count") === "2")).toBe(true);
    });
  });
});
