/* eslint-disable no-console */
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { NovoServicoModal } from '@/components/NovoServicoModal'

interface Servico {
  id: number
  nome: string
  categoria: string | null
  preco: number
  tipo: string
  ativo: boolean
}

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buscarServicos()
  }, [])

  async function buscarServicos() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .order('id', { ascending: false })

      if (error) throw error
      setServicos(data || [])
    } catch (error) {
      console.error('Erro ao buscar serviços:', error)
      alert('Erro ao buscar serviços')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Serviços</h1>
            <p className="text-zinc-400">Gerencie os cortes, barbas e procedimentos da barbearia</p>
          </div>

          <NovoServicoModal
            onAddServico={async (novoServico: { nome: string; categoria?: string; preco: string | number }) => {
              try {
const { error } = await supabase
  .from('servicos')
  .insert([{
    nome: novoServico.nome,
    categoria: novoServico.categoria || 'Geral',
    preco: Number(novoServico.preco) || 0,
    tipo: 'servico',
    ativo: true
  }])

                if (error) throw error

                alert('Serviço cadastrado com sucesso!')
                buscarServicos()
              } catch (error) {
                console.error('ERRO SUPABASE:', error)
                alert('Erro ao salvar serviço no banco de dados.')
              }
            }}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <table className="w-full">
            <thead className="border-b border-zinc-800 bg-zinc-950">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-zinc-400">Serviço / Procedimento</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-zinc-400">Categoria</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-zinc-400">Preço Sugerido</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-sm text-zinc-500 font-medium">
                    Carregando tabela de serviços...
                  </td>
                </tr>
              ) : servicos.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-sm text-zinc-500 font-medium">
                    Nenhum serviço cadastrado ainda.
                  </td>
                </tr>
              ) : (
                servicos.map((servico) => (
                  <tr key={`servico-${servico.id}`} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-zinc-200">
                      {servico.nome}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">
                      {servico.categoria || 'Geral'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-400">
                      {(Number(servico.preco) || 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}