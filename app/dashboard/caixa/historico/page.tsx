'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
const { usuario, negado } = useGuard('estoque')
if (negado) return null
interface Fechamento {
  id: number
  valor_final: number
  valor_contado: number
  diferenca_caixa: number
  closed_at: string
}

export default function HistoricoCaixaPage() {
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([])

  useEffect(() => {
    buscarFechamentos()
  }, [])

  async function buscarFechamentos() {
    const { data, error } = await supabase
      .from('controle_caixa')
      .select('*')
      .eq('status', 'fechado')
      .order('closed_at', { ascending: false })

    if (error) {
      alert('Erro ao buscar histórico.')
      return
    }

    setFechamentos(data || [])
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 p-8">
        <h1 className="text-3xl font-black tracking-widest uppercase mb-8">
          Histórico de Fechamentos
        </h1>

        <div className="overflow-auto border border-zinc-800 rounded-2xl">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900">
              <tr className="text-zinc-400 uppercase tracking-widest">
                <th className="p-4 text-left">Data</th>
                <th className="p-4 text-left">Esperado</th>
                <th className="p-4 text-left">Contado</th>
                <th className="p-4 text-left">Diferença</th>
              </tr>
            </thead>

            <tbody>
              {fechamentos.map((f) => (
                <tr
                  key={f.id}
                  className="border-t border-zinc-800"
                >
                  <td className="p-4">
                    {new Date(f.closed_at).toLocaleString('pt-BR')}
                  </td>

                  <td className="p-4">
                    {Number(f.valor_final).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })}
                  </td>

                  <td className="p-4">
                    {Number(f.valor_contado).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })}
                  </td>

                  <td
                    className={`p-4 font-bold ${
                      Number(f.diferenca_caixa) < 0
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {Number(f.diferenca_caixa).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
