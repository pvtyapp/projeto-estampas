"use client";

export default function UsageCard({ usage }: { usage: any }) {
  const percent = Math.min(100, Math.round((usage.used / usage.limit) * 100));

  return (
    <div className="rounded-xl border p-6 shadow-sm bg-white">
      <h2 className="text-lg font-semibold mb-2">Seu plano</h2>

      <p className="text-sm text-gray-500">{usage.plan}</p>

      <div className="mt-4">
        <div className="flex justify-between text-sm mb-1">
          <span>{usage.used} usadas</span>
          <span>{usage.limit} limite</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Renova em {new Date(usage.billing_cycle_start).toLocaleDateString()}
      </p>
    </div>
  );
}
