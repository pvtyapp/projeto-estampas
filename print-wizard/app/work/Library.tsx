"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

type Print = {
  id: string;
  name: string;
  sku: string;
  slots?: {
    front?: { url: string; width_cm: number; height_cm: number };
    back?: { url: string; width_cm: number; height_cm: number };
    extra?: { url: string; width_cm: number; height_cm: number };
  };
};

type Props = {
  onJobCreated?: (jobId: string) => void;
};

export default function Library({ onJobCreated }: Props) {
  const [prints, setPrints] = useState<Print[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
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

  function setPrintQty(id: string, value: number) {
    setQty(q => ({ ...q, [id]: Math.max(0, value) }));
  }

  async function createJob() {
    const items = prints
      .map(p => ({
        print_id: p.id,
        qty: qty[p.id] || 0,
        width_cm: p.slots?.front?.width_cm || 10,
        height_cm: p.slots?.front?.height_cm || 10,
      }))
      .filter(i => i.qty > 0);

    if (items.length === 0) {
      alert("Informe a quantidade de pelo menos uma estampa.");
      return;
    }

    try {
      setCreating(true);

      const res = await api("/print-jobs", {
        method: "POST",
        body: JSON.stringify({ items }),
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
        {creating ? "Gerando..." : "Gerar folhas"}
      </button>

      {loading && <p>Carregando...</p>}

      {!loading &&
        prints.map(p => (
          <div key={p.id} className="border p-3 rounded mb-2 flex items-center justify-between">
            <div>
              <b>{p.name}</b>
              <div className="text-xs text-gray-500">{p.sku}</div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                className="w-20 border rounded px-2 py-1 text-sm"
                value={qty[p.id] || ""}
                placeholder="Qtd"
                onChange={e => setPrintQty(p.id, Number(e.target.value))}
              />
              <span className="text-xs text-gray-500">un</span>
            </div>
          </div>
        ))}
    </div>
  );
}
