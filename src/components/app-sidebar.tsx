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

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const visibleGestao = gestao.filter((i) => !i.adminOnly || isAdmin);

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
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-black text-primary-foreground">
            R
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-bold">Rota 013</div>
              <div className="text-[10px] text-muted-foreground">Beta 2.0</div>
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
