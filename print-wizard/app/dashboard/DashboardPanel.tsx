"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { api } from "@/lib/apiClient";

export default function DashboardPanel() {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      try {
        const data = await api("/me/usage");
        if (mounted) setUsage(data);
      } catch (e) {
        console.warn("Usage ainda não disponível:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      load();
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
