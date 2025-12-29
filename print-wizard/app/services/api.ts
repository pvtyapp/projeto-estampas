const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------- PRINTS ----------

export async function createPrint(data: {
  name: string;
  sku: string;
  width_cm: number;
  height_cm: number;
  is_composite: boolean;
}) {
  const res = await fetch(`${API_URL}/prints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Erro ao criar estampa");
  return res.json();
}

export async function uploadPrintFile(printId: string, file: File) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/prints/${printId}/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!res.ok) throw new Error("Erro ao subir arquivo");
  return res.json();
}

// ---------- LIBRARY ----------

export async function listPrints() {
  const res = await fetch(`${API_URL}/prints`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Erro ao listar estampas");
  return res.json();
}

export async function listBlocks() {
  const res = await fetch(`${API_URL}/blocks`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Erro ao listar blocos");
  return res.json();
}

export async function createBlock(name: string) {
  const res = await fetch(`${API_URL}/blocks`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Erro ao criar bloco");
  return res.json();
}
