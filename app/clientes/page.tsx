/* eslint-disable no-console */
'use client'

import { useEffect, useState, Fragment } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { NovoClienteModal } from '@/components/NovoClienteModal'
const { usuario, negado } = useGuard('estoque')
if (negado) return null
interface Cliente {
  id: number
  nome: string
  telefone?: string
  permite_fiado: boolean
  ativo: boolean
  saldo: number
  movimentacoes: any[]
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [linhasExpandidas, setLinhasExpandidas] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    setLoading(true)
    try {
      const { data: dataClientes, error: errCli } = await supabase
        .from('clientes')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true })

      if (errCli) throw errCli

      const { data: dataHistorico, error: errHist } = await supabase
        .from('historico_ficha')
        .select('*')
        .order('created_at', { ascending: false })

      if (errHist) throw errHist

      const historico = dataHistorico || []

      const clientesProcessados = (dataClientes || []).map(cliente => {
        const transacoes = historico.filter(h => h.cliente_id === cliente.id)

        // BUG 1: lógica corrigida para somar todos os valores diretamente.
        // Débitos salvos com valor POSITIVO (forma_pagamento = 'ficha')
        // Créditos salvos com valor NEGATIVO (acertos via caixa com qualquer forma de pagamento)
        // Isso funciona independente de como a forma de pagamento foi registrada.
        const saldoCalculado = transacoes.reduce((acc, mov) => {
          return acc + Number(mov.valor)
        }, 0)

        return {
          ...cliente,
          saldo: Math.max(0, saldoCalculado),
          movimentacoes: transacoes
        }
      })

      setClientes(clientesProcessados)
    } catch (err: unknown) {
      console.error("Erro ao carregar dados:", err)
    } finally {
      setLoading(false)
    }
  }

  function toggleLinha(id: number) {
    setLinhasExpandidas(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-black text-zinc-500 items-center justify-center text-xs tracking-widest uppercase font-bold">
        Carregando carteira de clientes...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-white font-sans antialiased selection:bg-white selection:text-black">
      <Sidebar />

      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        {/* CABEÇALHO */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-widest uppercase">Clientes</h1>
            <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1.5 font-semibold">
              Gerenciamento da carteira de clientes e consulta de extratos de ficha
            </p>
          </div>

          <NovoClienteModal onSuccess={carregarDados} />
        </div>

        {/* TABELA */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/10 backdrop-blur-md shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[10px] font-bold tracking-widest uppercase text-zinc-500">
                  <th className="w-12 px-4 py-4 text-center"></th>
                  <th className="px-6 py-4 text-left">Nome</th>
                  <th className="px-6 py-4 text-left hidden sm:table-cell">Telefone</th>
                  <th className="px-6 py-4 text-left">Ficha Status</th>
                  <th className="px-6 py-4 text-right">Saldo Ficha</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800/40 text-xs">
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 tracking-wider font-bold uppercase">
                      Nenhum cliente cadastrado ainda.
                    </td>
                  </tr>
                ) : (
                  clientes.map((cliente) => {
                    const isExpandido = !!linhasExpandidas[cliente.id]
                    return (
                      <Fragment key={cliente.id}>
                        {/* Linha Principal */}
                        <tr className="hover:bg-zinc-900/30 transition-colors">
                          <td className="px-4 py-4 text-center">
                            {cliente.permite_fiado && (
                              <button
                                onClick={() => toggleLinha(cliente.id)}
                                className="text-zinc-500 hover:text-zinc-300 transition-all duration-200 p-1 mx-auto block text-[10px]"
                                style={{ transform: isExpandido ? 'rotate(180deg)' : 'rotate(0deg)' }}
                              >
                                ▼
                              </button>
                            )}
                          </td>

                          <td className="px-6 py-4 font-bold text-zinc-200 tracking-wide">
                            {cliente.nome}
                          </td>

                          <td className="px-6 py-4 text-zinc-500 font-semibold font-mono hidden sm:table-cell">
                            {cliente.telefone || '—'}
                          </td>

                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black tracking-wider uppercase border ${
                              cliente.permite_fiado
                                ? 'bg-zinc-950 text-zinc-300 border-zinc-800'
                                : 'bg-zinc-950 text-zinc-600 border-zinc-900'
                            }`}>
                              {cliente.permite_fiado ? '✓ Autorizado' : '✕ Bloqueado'}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right font-bold font-mono">
                            {cliente.permite_fiado ? (
                              <span className={cliente.saldo > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                {cliente.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        </tr>

                        {/* Extrato Detalhado */}
                        {cliente.permite_fiado && isExpandido && (
                          <tr className="bg-zinc-950/40 border-b border-zinc-800/40">
                            <td colSpan={5} className="px-6 md:px-10 py-5">
                              <div className="rounded-xl border border-zinc-800/60 bg-black/40 p-5 shadow-inner">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4 border-b border-zinc-800/40 pb-2">
                                  Histórico Detalhado da Ficha
                                </h4>

                                {cliente.movimentacoes.length === 0 ? (
                                  <p className="text-xs text-zinc-600 font-medium py-1">
                                    Nenhuma movimentação registrada nesta ficha.
                                  </p>
                                ) : (
                                  <div className="space-y-3 max-h-52 overflow-y-auto pr-2">
                                    {cliente.movimentacoes.map((mov: any) => {
                                      // Crédito = valor negativo (acerto/pagamento), Débito = valor positivo (consumo)
                                      const isDebito = Number(mov.valor) > 0
                                      return (
                                        <div key={mov.id} className="flex justify-between items-start border-b border-zinc-900 pb-3 last:border-0 last:pb-0 gap-4">
                                          <div className="space-y-1 flex-1 min-w-0">
                                            <p className="font-bold text-zinc-300 tracking-wide truncate">{mov.descricao}</p>
                                            <p className="text-[10px] text-zinc-500 font-semibold font-mono">
                                              {new Date(mov.created_at).toLocaleString('pt-BR')}
                                              <span className="text-zinc-600 mx-2">•</span>
                                              <span className={`uppercase tracking-wider text-[9px] font-sans ${isDebito ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {isDebito ? 'DÉBITO' : 'CRÉDITO / ACERTO'}
                                              </span>
                                            </p>
                                          </div>
                                          <span className={`font-bold font-mono flex-shrink-0 ${isDebito ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {isDebito ? '+' : ''}
                                            {Number(mov.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
