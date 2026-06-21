import { Link } from "@tanstack/react-router";
import { LogoRota013 } from "@/components/logo-rota013";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const nav = [
  { to: "/parceiros", label: "Quero ser parceiro" },
  { to: "/como-funciona", label: "Como funciona" },
  { to: "/quem-somos", label: "Quem somos" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link to="/" className="flex items-center" onClick={() => setOpen(false)}>
          <LogoRota013 className="text-2xl" />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition"
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {n.label}
            </Link>
          ))}
          <Link to="/cliente/login" className="ml-2">
            <Button size="sm" className="rounded-xl">Entrar</Button>
          </Link>
        </nav>

        <button
          className="md:hidden p-2 rounded-lg hover:bg-muted"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/60 bg-background">
          <div className="mx-auto max-w-6xl px-5 py-3 flex flex-col gap-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground"
                activeOptions={{ exact: true }}
                activeProps={{ className: "text-foreground font-medium" }}
              >
                {n.label}
              </Link>
            ))}
            <Link to="/cliente/login" onClick={() => setOpen(false)}>
              <Button size="sm" className="mt-2 w-full rounded-xl">Entrar</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-16">
      <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <LogoRota013 className="text-xl" />
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Rota013 — CNPJ: 67.507.908/0001-67
          </div>
          <a
            href="mailto:contato@rota013.com.br"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            contato@rota013.com.br
          </a>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Link to="/como-funciona" className="hover:text-foreground">Como funciona</Link>
          <Link to="/parceiros" className="hover:text-foreground">Quero ser parceiro</Link>
          <Link to="/quem-somos" className="hover:text-foreground">Quem somos</Link>
          <Link to="/instalar" className="hover:text-foreground">Instalar app</Link>
          <Link to="/termos" className="hover:text-foreground">Termos de Uso</Link>
          <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
        </nav>
      </div>
    </footer>
  );
}
