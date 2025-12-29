'use client'

type Props = {
  onClose: () => void
}

export default function UpgradeModal({ onClose }: Props) {
  async function buy(packageId: string) {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/credits/buy?package_id=${packageId}`, {
      method: 'POST',
      credentials: 'include'
    })
    alert('Créditos adicionados com sucesso!')
    onClose()
  }

  async function upgrade(planId: string) {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/plans/upgrade?plan_id=${planId}`, {
      method: 'POST',
      credentials: 'include'
    })
    alert('Plano atualizado com sucesso!')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg space-y-6">
        <h2 className="text-2xl font-bold">Limite atingido 😅</h2>
        <p className="text-gray-600">
          Você atingiu o limite do seu plano atual. Escolha uma opção para continuar:
        </p>

        <div className="space-y-3">
          <Option
            title="Plano Profissional"
            desc="200 folhas por mês"
            price="R$ 49/mês"
            onClick={() => upgrade('pro')}
          />
          <Option
            title="Plano Enterprise"
            desc="350 folhas por mês"
            price="R$ 99/mês"
            onClick={() => upgrade('enterprise')}
          />
        </div>

        <div className="border-t pt-4 space-y-2">
          <p className="text-sm text-gray-500">Ou compre créditos avulsos:</p>
          <Option
            title="+20 folhas"
            desc="Crédito único"
            price="R$ 9"
            onClick={() => buy('20')}
          />
          <Option
            title="+50 folhas"
            desc="Crédito único"
            price="R$ 19"
            onClick={() => buy('50')}
          />
        </div>

        <button
          onClick={onClose}
          className="w-full border rounded-xl py-2 hover:bg-gray-100"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}

function Option({
  title,
  desc,
  price,
  onClick
}: {
  title: string
  desc: string
  price: string
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="border rounded-xl p-4 flex justify-between items-center hover:border-black cursor-pointer"
    >
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-gray-500">{desc}</p>
      </div>
      <p className="font-bold">{price}</p>
    </div>
  )
}
