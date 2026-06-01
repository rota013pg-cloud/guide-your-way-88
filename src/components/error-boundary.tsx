import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
};

type State = { hasError: boolean; message: string | null };

/**
 * Error boundary genérico para isolar falhas de subárvores (ex.: mapa Leaflet,
 * widgets externos). Mostra um estado de erro acessível em vez de derrubar a
 * página inteira.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? "Erro desconhecido" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (typeof console !== "undefined") {
      console.error("[ErrorBoundary]", this.props.label ?? "", error, info);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div
        role="alert"
        data-testid="error-boundary-fallback"
        className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center"
      >
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          Não foi possível carregar {this.props.label ?? "este componente"}.
        </p>
        {this.state.message && (
          <p className="text-xs text-muted-foreground">{this.state.message}</p>
        )}
      </div>
    );
  }
}
