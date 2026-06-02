/* eslint-disable no-console */
'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { NovaEntradaEstoqueModal } from '@/components/NovaEntradaEstoqueModal'
import { NovaSaidaEstoqueModal } from '@/components/NovaSaidaEstoqueModal'
import { PackageOpen, History } from 'lucide-react'


interface ProdutoSaldo {
  id: number
  nome: string
  estoque: number
}

interface Movimentacao {
  id: number
  tipo: string
  quantidade: number
  preco_compra?: number
  created_at: string
  produtos?: {
    nome: string
  }
}

export default function EstoquePage() {
  const { usuario, negado } = useGuard('estoque')
if (negado) return null
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [produtosSaldos, setProdutosSaldos] = useState<ProdutoSaldo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregarDadosEstoque()
  }, [])

  async function carregarDadosEstoque() {
    setLoading(true)
    try {
      // 1. Busca histórico de movimentações
      const { data: dataMovs, error: errorMovs } = await supabase
        .from('movimentacoes_estoque')
        .select(`
          *,
          produtos (
            nome
          )
        `)
        .order('id', { ascending: false })

      if (errorMovs) throw errorMovs

      // 2. Busca a posição/saldo atual direto da tabela de produtos
      const { data: dataProds, error: errorProds } = await supabase
        .from('produtos')
        .select('id, nome, estoque')
        .order('nome', { ascending: true })

      if (errorProds) throw errorProds

      setMovimentacoes(dataMovs || [])
      setProdutosSaldos(dataProds || [])
    } catch (error) {
      console.log('Erro ao carregar dados do estoque:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatarTipo(tipo: string) {
    const mapeamento: { [key: string]: string } = {
      entrada: 'Entrada',
      uso_interno: 'Uso Interno',
      perda: 'Perda',
      quebra: 'Quebra',
      consumo: 'Consumo',
    }
    return mapeamento[tipo] || tipo
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-black text-zinc-500 items-center justify-center text-xs tracking-widest uppercase font-bold">
        Carregando dados do estoque...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-white font-sans antialiased selection:bg-white selection:text-black">
      <Sidebar />

      <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
        {/* CABEÇALHO */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-widest uppercase">Estoque</h1>
            <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1.5 font-semibold">
              Controle de movimentações e saldos unificados de prateleira
            </p>
          </div>

          <div className="flex items-center gap-3">
            <NovaEntradaEstoqueModal onSuccess={carregarDadosEstoque} />
            <NovaSaidaEstoqueModal onSuccess={carregarDadosEstoque} />

          </div>
        </div>

        {/* LAYOUT EM GRID DUPLO PADRONIZADO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* PAINEL ESQUERDO: POSIÇÃO ATUAL / SALDOS (1 Coluna) */}
          <div className="lg:col-span-1 bg-zinc-900/10 backdrop-blur-md rounded-2xl border border-zinc-800/80 overflow-hidden shadow-xl">
            <div className="bg-zinc-950/40 px-5 py-4 border-b border-zinc-800/80 flex items-center gap-2">
              <PackageOpen size={15} className="text-zinc-500" />
              <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Saldo em Prateleira</h2>
            </div>
            
            <div className="max-h-[600px] overflow-y-auto divide-y divide-zinc-800/40">
              {produtosSaldos.length === 0 ? (
                <p className="p-6 text-center text-zinc-500 text-xs font-bold tracking-wider uppercase">Nenhum produto cadastrado.</p>
              ) : (
                produtosSaldos.map((prod) => (
                  <div key={prod.id} className="px-5 py-3.5 flex items-center justify-between text-xs hover:bg-zinc-900/20 transition-colors">
                    <span className="font-bold text-zinc-200 tracking-wide">{prod.nome}</span>
                    <span className={`font-bold px-2.5 py-1 rounded-lg text-xs font-mono border ${
                      (prod.estoque || 0) <= 2 
                        ? 'bg-zinc-950 text-rose-400 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]' 
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                    }`}>
                      {prod.estoque || 0} <span className="text-[9px] font-semibold text-zinc-500 tracking-wider uppercase ml-0.5">un.</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* PAINEL DIREITO: HISTÓRICO DE ALTERAÇÕES (2 Colunas) */}
          <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/10 backdrop-blur-md shadow-xl">
            <div className="bg-zinc-950/40 px-5 py-4 border-b border-zinc-800/80 flex items-center gap-2">
              <History size={15} className="text-zinc-500" />
              <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Histórico de Alterações</h2>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-zinc-800/60 bg-zinc-950/60 sticky top-0 backdrop-blur-md text-[10px] font-bold tracking-widest uppercase text-zinc-500">
                  <tr>
                    <th className="px-6 py-4 text-left">Produto</th>
                    <th className="px-6 py-4 text-left">Tipo</th>
                    <th className="px-6 py-4 text-left">Quantidade</th>
                    <th className="px-6 py-4 text-left">Preço Compra</th>
                    <th className="px-6 py-4 text-left">Data</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-800/40 text-xs">
                  {movimentacoes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 tracking-wider font-bold uppercase">
                        Nenhuma movimentação registrada ainda.
                      </td>
                    </tr>
                  ) : (
                    movimentacoes.map((mov) => (
                      <tr key={mov.id} className="hover:bg-zinc-900/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-zinc-200 tracking-wide">{mov.produtos?.nome}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-black tracking-wider uppercase border ${
                            mov.tipo === 'entrada' 
                              ? 'bg-zinc-950 text-emerald-400 border-zinc-800' 
                              : 'bg-zinc-950 text-zinc-400 border-zinc-800/50'
                          }`}>
                            {formatarTipo(mov.tipo)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-300 font-bold font-mono">{mov.quantidade} un.</td>
                        <td className="px-6 py-4 text-zinc-300 font-bold font-mono">
                          {mov.tipo === 'entrada' && mov.preco_compra
                            ? mov.preco_compra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-zinc-500 font-semibold tracking-wide font-mono">
                          {new Date(mov.created_at).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
