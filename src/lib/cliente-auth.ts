import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { desregistrarPushCliente } from "@/lib/push-native";

const TOKEN_KEY = "rota013_cliente_token";

export type ClienteSessao = {
  codigo: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
};

export function getClienteToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setClienteToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearClienteToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function carregarCliente(token: string): Promise<ClienteSessao | null> {
  const { data, error } = await supabase.rpc("cliente_me", { _token: token });
  if (error || !data) return null;
  return data as unknown as ClienteSessao;
}

export function useCliente() {
  const [cliente, setCliente] = useState<ClienteSessao | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    const token = getClienteToken();
    if (!token) {
      setCliente(null);
      setLoading(false);
      return;
    }
    const c = await carregarCliente(token);
    if (!c) clearClienteToken();
    setCliente(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const logout = useCallback(async () => {
    const token = getClienteToken();
    // Remove o token de push deste aparelho ANTES de encerrar a sessão, pra o
    // aparelho não continuar recebendo notificações do cliente que está saindo.
    await desregistrarPushCliente().catch(() => undefined);
    if (token) {
      await supabase.rpc("cliente_logout", { _token: token });
    }
    clearClienteToken();
    setCliente(null);
  }, []);

  return { cliente, loading, recarregar, logout };
}
