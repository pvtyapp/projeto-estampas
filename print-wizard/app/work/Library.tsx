"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

type Props = {
  onJobCreated?: (jobId: string) => void;
};

export default function Library({ onJobCreated }: Props) {
  const [prints, setPrints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await api("/prints");
      setPrints(data);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar biblioteca");
    } finally {
      setLoading(false);
    }
  }

  async function createJob() {
    if (prints.length === 0) {
      alert("Adicione pelo menos uma estampa.");
      return;
    }

    try {
      setCreating(true);

      const res = await api("/print-jobs", {
        method: "POST",
        body: JSON.stringify({
          items: prints.map(p => ({
            print_id: p.id,
            qty: 1,
            width_cm: p.slots?.front?.width_cm || 10,
            height_cm: p.slots?.front?.height_cm || 10
          }))
        })
      });

      onJobCreated?.(res.job_id);
    } catch (e: any) {
      alert(e.message || "Erro ao criar job");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Biblioteca</h2>

      <button
        onClick={createJob}
        disabled={loading || creating}
        className="mb-4 px-3 py-1 rounded bg-black text-white disabled:opacity-50"
      >
        {creating ? "Gerando..." : "Gerar folha"}
      </button>

      {loading && <p>Carregando...</p>}

      {!loading &&
        prints.map(p => (
          <div key={p.id} className="border p-2 rounded mb-2">
            <b>{p.name}</b> — {p.sku}
          </div>
        ))}
    </div>
  );
}
