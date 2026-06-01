import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "operador" | null;

export function useRole() {
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const carregar = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        if (active) { setRole(null); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .order("role", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setRole((data?.role as AppRole) ?? "operador");
      setLoading(false);
    };
    carregar();
    return () => { active = false; };
  }, []);

  return { role, loading, isAdmin: role === "admin" };
}
