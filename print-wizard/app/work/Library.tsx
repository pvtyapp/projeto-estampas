"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export default function Library() {
  const [prints, setPrints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Biblioteca</h2>
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
