import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  UserSquare,
  DollarSign,
  Tag,
  History,
  Settings,
  MessageSquare,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  UserCog,
  StickyNote,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useRole } from "@/hooks/use-role";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useState } from "react";

type Item = { title: string; url: string; icon: typeof LayoutDashboard; adminOnly?: boolean };

const operacional: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Corridas", url: "/corridas", icon: ListChecks },
  { title: "Motoristas", url: "/motoristas", icon: Users },
  { title: "Clientes", url: "/clientes", icon: UserSquare },
  { title: "Mural", url: "/mural", icon: StickyNote },
];

const gestao: Item[] = [
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Tarifas", url: "/tarifas", icon: Tag, adminOnly: true },
  { title: "Histórico", url: "/historico", icon: History },
  { title: "Mensagens", url: "/mensagens", icon: MessageSquare },
  { title: "Usuários", url: "/usuarios", icon: UserCog, adminOnly: true },
  { title: "Configurações", url: "/configuracoes", icon: Settings, adminOnly: true },
  { title: "Cobertura", url: "/cobertura", icon: ShieldCheck, adminOnly: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const { theme, toggle } = useTheme();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (path: string) => currentPath === path;
  const [userNome, setUserNome] = useState<string>("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("usuarios_painel").select("nome").eq("user_id", uid).maybeSingle();
      const email = u.user?.email ?? "";
      const emailLimpo = email.endsWith("@painel.local") ? "" : email;
      if (active) setUserNome(data?.nome ?? emailLimpo ?? "");
    })();
    return () => { active = false; };
  }, []);

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const visibleGestao = gestao.filter((i) => !i.adminOnly || isAdmin);
  const iniciais = (userNome || "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const renderItem = (item: Item) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild isActive={isActive(item.url)}>
        <Link to={item.url} className="flex items-center gap-2">
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div
            className="logo-r013 text-2xl leading-none"
            style={{ color: "hsl(var(--foreground))" }}
          >
            Rota<span>013</span>
          </div>
          {!collapsed && (
            <div className="leading-tight ml-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Beta 2.0</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operacional</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{operacional.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{visibleGestao.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40">
          <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
            {iniciais}
          </div>
          {!collapsed && (
            <div className="leading-tight min-w-0 flex-1">
              <div className="text-xs font-semibold truncate">{userNome || "—"}</div>
              <div className="text-[10px] text-muted-foreground">{isAdmin ? "Administrador" : "Operador"}</div>
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={toggle} className="w-full justify-start">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {!collapsed && (
            <span className="ml-2">{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={sair} className="w-full">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
