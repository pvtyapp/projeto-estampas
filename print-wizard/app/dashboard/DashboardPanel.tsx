"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { api } from "@/lib/apiClient";
import type { Session } from "@supabase/supabase-js";

type Usage = {
  plan: string;
  used: number;
  limit: number;
  credits: number;
  status: string;
};

export default function DashboardPanel() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async (session: Session | null) => {
      if (!session?.access_token) return;

      try {
        const data = await api("/me/usage");
        if (mounted) setUsage(data);
      } catch (e) {
        console.warn("Erro ao carregar usage:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) load(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        load(session);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <div className="p-4">Carregando uso...</div>;
  if (!usage) return null;

  return (
    <div className="border rounded p-4">
      <div>Plano: {usage.plan}</div>
      <div>Uso: {usage.used} / {usage.limit}</div>
      <div>Créditos: {usage.credits}</div>
      <div>Status: {usage.status}</div>
    </div>
  );
}
