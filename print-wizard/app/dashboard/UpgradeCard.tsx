"use client";

export default function UpgradeCard() {
  return (
    <div className="rounded-xl border p-6 shadow-sm bg-white flex flex-col justify-between">
      <div>
        <h2 className="text-lg font-semibold mb-2">Precisa de mais?</h2>
        <p className="text-sm text-gray-500">
          Compre créditos extras ou troque de plano.
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded-lg bg-black text-white py-2 hover:bg-gray-800">
          Comprar créditos
        </button>
        <button className="flex-1 rounded-lg border py-2 hover:bg-gray-100">
          Trocar plano
        </button>
      </div>
    </div>
  );
}
