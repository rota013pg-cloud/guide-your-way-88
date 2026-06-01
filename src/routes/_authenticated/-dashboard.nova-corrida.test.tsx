// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

/**
 * Integração: clicar em "Nova corrida" no /dashboard abre o diálogo e o
 * estado é preservado MESMO quando o MapLeaflet falha (ErrorBoundary cobre
 * o mapa, mas o resto da página — incluindo o diálogo — segue funcional).
 */

vi.mock("@/integrations/supabase/client", () => {
  const makeBuilder = (): any => {
    const builder: any = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      update: vi.fn(() => builder),
      eq: vi.fn(() => builder),
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

// Mapa que SEMPRE falha — força o ErrorBoundary do dashboard a entrar em ação.
vi.mock("@/components/map-leaflet", () => ({
  MapLeaflet: () => {
    throw new Error("Falha simulada no MapLeaflet");
  },
}));

import { Route as DashboardRoute } from "./dashboard";

const DashboardPage = (DashboardRoute.options as any)
  .component as React.ComponentType;

describe("Dashboard — Nova Corrida com mapa em falha", () => {
  it("abre o diálogo ao clicar no botão e mantém o estado mesmo com o mapa falhando", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    render(<DashboardPage />);
    render(<DashboardPage />);

    // ErrorBoundary do mapa apareceu (confirma cenário de falha).
    await waitFor(() => {
      expect(
        screen.getAllByTestId("error-boundary-fallback").length,
      ).toBeGreaterThan(0);
    });

    // Diálogo ainda NÃO está aberto.
    expect(screen.queryByRole("dialog")).toBeNull();

    // Clica no botão "Nova corrida" (gatilho do Dialog).
    const triggers = screen.getAllByRole("button", { name: /nova corrida/i });
    await user.click(triggers[triggers.length - 1]);

    // Diálogo abre.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: /nova corrida/i }),
    ).toBeInTheDocument();

    // Estado do formulário é preservado entre interações.
    const origem = within(dialog).getByLabelText(/origem/i);
    await user.type(origem, "Rua A, 123");
    expect(origem).toHaveValue("Rua A, 123");

    const nome = within(dialog).getByLabelText(/^nome$/i);
    await user.type(nome, "João");
    expect(nome).toHaveValue("João");

    // Origem continua com o valor digitado (estado não foi resetado).
    expect(origem).toHaveValue("Rua A, 123");

    // O fallback do mapa continua presente — a falha NÃO derrubou o diálogo.
    expect(
      screen.getAllByTestId("error-boundary-fallback").length,
    ).toBeGreaterThan(0);

    errSpy.mockRestore();
  });
});
