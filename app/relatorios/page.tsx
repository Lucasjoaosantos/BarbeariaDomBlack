/* eslint-disable no-console */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { DollarSign, User, Shield, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts'
import { useGuard } from '@/hooks/useGuard'

type TabId = 'financeiro' | 'barbeiros' | 'grafico' | 'lancamentos'

interface Movimentacao {
  id: number
  created_at: string
  tipo: string
  valor: number
  motivo: string
  profissional?: string
  forma_pagamento?: string
  proprietario?: string
}

function detectarFormaPagamento(mov: Movimentacao): string {
  if (mov.forma_pagamento) return mov.forma_pagamento.toLowerCase()
  const mot = (mov.motivo || '').toLowerCase()
  if (mot.includes('pix')) return 'pix'
  if (mot.includes('dinheiro')) return 'dinheiro'
  if (mot.includes('cartao') || mot.includes('cartão')) return 'cartao'
  if (mot.includes('ficha')) return 'ficha'
  return 'outro'
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'financeiro',  label: 'Financeiro'  },
  { id: 'barbeiros',   label: 'Barbeiros'   },
  { id: 'grafico',     label: 'Gráfico'     },
  { id: 'lancamentos', label: 'Lançamentos' },
]

export default function CaixaRelatoriosPage() {
  const { usuario, negado } = useGuard('relatorios')

  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'hoje' | '7dias' | 'mes' | 'ano'>('mes')
  const [abasAbertas,  setAbasAbertas]  = useState<Set<TabId>>(new Set())
  const [abasVisiveis, setAbasVisiveis] = useState<Set<TabId>>(new Set())
  const [faturamentoGabriel,     setFaturamentoGabriel]     = useState(0)
  const [faturamentoEduardo,     setFaturamentoEduardo]     = useState(0)
  const [faturamentoGeral,       setFaturamentoGeral]       = useState(0)
  const [faturamentoTotalGlobal, setFaturamentoTotalGlobal] = useState(0)
  const [totalEntradas,          setTotalEntradas]          = useState(0)
  const [totalSaidas,            setTotalSaidas]            = useState(0)
  const [lucroLiquido,           setLucroLiquido]           = useState(0)
  const [totalPix,               setTotalPix]               = useState(0)
  const [totalDinheiro,          setTotalDinheiro]          = useState(0)
  const [totalCartao,            setTotalCartao]            = useState(0)
  const [totalFicha,             setTotalFicha]             = useState(0)
  const [movimentacoes,          setMovimentacoes]          = useState<Movimentacao[]>([])
  const [dadosGrafico,           setDadosGrafico]           = useState<{ data: string; valor: number }[]>([])

  const verTudo = usuario?.permissoes.verTudo ?? false
  const profissionalAtual = usuario?.profissional ?? ''
  const proprietarioCaixa = usuario?.proprietarioCaixa ?? 'caixa'

  const carregarRelatorios = useCallback(async () => {
    setLoading(true)
    try {
      const agora = new Date()
      let dataInicio = new Date()

      if (periodo === 'hoje') {
        dataInicio.setHours(0, 0, 0, 0)
      } else if (periodo === '7dias') {
        dataInicio.setDate(agora.getDate() - 7)
      } else if (periodo === 'mes') {
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
      } else if (periodo === 'ano') {
        dataInicio = new Date(agora.getFullYear(), 0, 1)
      }

      let query = supabase
        .from('movimentacoes_caixa')
        .select('id, created_at, tipo, valor, motivo, profissional, forma_pagamento, proprietario')
        .gte('created_at', dataInicio.toISOString())
        .order('created_at', { ascending: false })

      if (!verTudo) {
        query = query.eq('proprietario', proprietarioCaixa)
      }

      const { data: movs, error: errMovs } = await query
      if (errMovs) throw errMovs

      // Ficha pendente: soma dos débitos ainda não acertados no historico_ficha
      const { data: fichaRows, error: errFicha } = await supabase
        .from('historico_ficha')
        .select('valor')
        .gte('created_at', dataInicio.toISOString())

      if (errFicha) throw errFicha

      const saldoLiquidoFicha = (fichaRows || []).reduce(
        (acc, row) => acc + Number(row.valor), 0
      )

      const listaMovs = (movs as Movimentacao[]) || []

      let totalGabriel = 0
      let totalEduardo = 0
      let totalGeral   = 0
      let totalGlobal  = 0
      let entradas     = 0
      let saidas       = 0
      let pix          = 0
      let dinheiro     = 0
      let cartao       = 0

      const listaFiltrada: Movimentacao[] = []

      for (const m of listaMovs) {
        const valor  = Number(m.valor) || 0
        const prop   = (m.proprietario || 'caixa').toLowerCase()
        const motivo = (m.motivo || '').toLowerCase()

        if (m.tipo === 'entrada') {
          const isConsumoFiado = motivo.includes('[consumo fiado]')
          const isAcerto       = motivo.includes('[acerto via caixa]')

          // ── REGRA DE FATURAMENTO ─────────────────────────────────────────
          // [CONSUMO FIADO]    → NÃO soma: dinheiro ainda não entrou, está pendente
          // [ACERTO VIA CAIXA] → SOMA: é aqui que o dinheiro entrou de verdade
          // Demais lançamentos → SOMA normalmente (venda à vista)
          if (!isConsumoFiado) {
            entradas    += valor
            totalGlobal += valor

            if (prop === 'gabriel')      totalGabriel += valor
            else if (prop === 'eduardo') totalEduardo += valor
            else                         totalGeral   += valor

            // Formas de pagamento: só conta quando o dinheiro realmente entrou
            const forma = detectarFormaPagamento(m)
            if (forma === 'pix')           pix      += valor
            else if (forma === 'dinheiro') dinheiro += valor
            else if (forma === 'cartao')   cartao   += valor
          }

          listaFiltrada.push(m)

        } else {
          // Saída (sangria)
          saidas += valor
          listaFiltrada.push(m)
        }
      }

      // Gráfico: só lançamentos que realmente entraram (sem consumo fiado)
      const porDia: Record<string, number> = {}
      for (const mov of listaMovs) {
        if (mov.tipo !== 'entrada') continue
        if ((mov.motivo || '').toLowerCase().includes('[consumo fiado]')) continue
        const d = new Date(mov.created_at).toLocaleDateString('pt-BR')
        porDia[d] = (porDia[d] || 0) + Number(mov.valor || 0)
      }

      setDadosGrafico(Object.entries(porDia).map(([data, valor]) => ({ data, valor })))
      setFaturamentoGabriel(totalGabriel)
      setFaturamentoEduardo(totalEduardo)
      setFaturamentoGeral(totalGeral)
      setFaturamentoTotalGlobal(totalGlobal)
      setMovimentacoes(listaFiltrada)
      setTotalEntradas(entradas)
      setTotalSaidas(saidas)
      setLucroLiquido(entradas - saidas)
      setTotalPix(pix)
      setTotalDinheiro(dinheiro)
      setTotalCartao(cartao)
      setTotalFicha(Math.max(0, saldoLiquidoFicha))
    } catch (err: unknown) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [periodo, usuario])

  useEffect(() => {
    setAbasAbertas(new Set(abasVisiveis))
    carregarRelatorios()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, usuario])

  function toggleAba(id: TabId) {
    setAbasVisiveis((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        setAbasAbertas((ab) => new Set(ab).add(id))
      }
      return next
    })
  }

  if (negado) return null

  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="flex min-h-screen bg-black text-white font-sans antialiased selection:bg-white selection:text-black">
      <Sidebar />

      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">

        {/* PERFIL ATIVO */}
        <div className="bg-zinc-900/10 backdrop-blur-md border border-zinc-800/80 p-3.5 rounded-2xl flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-zinc-500 shadow-xl">
          <Shield className="w-3.5 h-3.5 text-zinc-400" />
          <span>
            Visualizando como: <strong className="text-zinc-200">{profissionalAtual}</strong>
            {!verTudo && (
              <span className="ml-2 text-zinc-600">· apenas seus lançamentos</span>
            )}
          </span>
        </div>

        {/* CABEÇALHO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-widest uppercase">Relatórios</h1>
            <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1.5 font-semibold">
              {verTudo
                ? 'Produção e faturamento de todos os profissionais'
                : `Produção e faturamento de ${profissionalAtual}`
              }
            </p>
          </div>

          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800/80 text-[10px] font-bold tracking-wider uppercase">
            {(['hoje', '7dias', 'mes', 'ano'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-2 rounded-lg font-bold transition-all ${
                  periodo === p ? 'bg-white text-black' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {p === 'hoje'  && 'Hoje'}
                {p === '7dias' && '7 dias'}
                {p === 'mes'   && 'Mês'}
                {p === 'ano'   && 'Ano'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-zinc-500 text-[10px] tracking-widest uppercase font-bold animate-pulse">
            Processando dados...
          </div>
        ) : (
          <div className="space-y-3">
            {TABS.map((tab) => {
              const aberta    = abasVisiveis.has(tab.id)
              const jaMontada = abasAbertas.has(tab.id)

              return (
                <div
                  key={tab.id}
                  className="rounded-2xl border border-zinc-800/80 bg-zinc-900/10 backdrop-blur-md shadow-xl overflow-hidden"
                >
                  <button
                    onClick={() => toggleAba(tab.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-800/20 transition-colors"
                  >
                    <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">
                      {tab.label}
                    </span>
                    {aberta
                      ? <ChevronUp   className="w-4 h-4 text-zinc-500" />
                      : <ChevronDown className="w-4 h-4 text-zinc-500" />
                    }
                  </button>

                  <div className={jaMontada ? (aberta ? 'block' : 'hidden') : 'hidden'}>

                    {/* ── FINANCEIRO ── */}
                    {tab.id === 'financeiro' && (
                      <div className="p-4 md:p-5 pt-0 space-y-4">
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                          <div className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 md:p-5">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Entradas</span>
                              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <div className="text-xl md:text-2xl font-black text-emerald-400 font-mono tracking-tight">{brl(totalEntradas)}</div>
                            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mt-1.5">Total efetivamente recebido</p>
                          </div>

                          <div className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 md:p-5">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Saídas</span>
                              <DollarSign className="w-3.5 h-3.5 text-red-400" />
                            </div>
                            <div className="text-xl md:text-2xl font-black text-red-400 font-mono tracking-tight">{brl(totalSaidas)}</div>
                            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mt-1.5">Sangrias e retiradas</p>
                          </div>

                          <div className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 md:p-5">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Lucro Líquido</span>
                              <DollarSign className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className={`text-xl md:text-2xl font-black font-mono tracking-tight ${lucroLiquido >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {brl(lucroLiquido)}
                            </div>
                            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mt-1.5">Entradas - saídas</p>
                          </div>

                          <div className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 md:p-5">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">PIX Recebido</span>
                              <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="text-xl md:text-2xl font-black text-cyan-400 font-mono tracking-tight">{brl(totalPix)}</div>
                            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mt-1.5">Pagamentos via pix</p>
                          </div>
                        </div>

                        {verTudo && (
                          <div className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Faturamento Bruto Total</h3>
                              <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold mt-1">
                                Soma de todos os barbeiros + vendas do balcão no período
                              </p>
                            </div>
                            <div className="text-2xl md:text-3xl font-black text-emerald-400 font-mono tracking-tighter">
                              {brl(faturamentoTotalGlobal)}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                          {[
                            { label: 'Dinheiro',         valor: totalDinheiro, cor: 'text-yellow-400', desc: 'Recebido em espécie'           },
                            { label: 'Cartão',           valor: totalCartao,   cor: 'text-purple-400', desc: 'Débito e crédito'              },
                            { label: 'Pendente em Ficha', valor: totalFicha,   cor: 'text-orange-400', desc: 'Consumido — ainda não recebido' },
                          ].map(({ label, valor, cor, desc }) => (
                            <div key={label} className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 md:p-5">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
                                <DollarSign className={`w-3.5 h-3.5 ${cor}`} />
                              </div>
                              <div className={`text-xl md:text-2xl font-black font-mono tracking-tight ${cor}`}>{brl(valor)}</div>
                              <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mt-1.5">{desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── BARBEIROS ── */}
                    {tab.id === 'barbeiros' && (
                      <div className="p-4 md:p-5 pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">

                          {(verTudo || proprietarioCaixa === 'gabriel') && (
                            <div className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 md:p-5">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Barber Gabriel</span>
                                <User className="w-3.5 h-3.5 text-zinc-400" />
                              </div>
                              <div className="text-xl md:text-2xl font-bold text-zinc-100 font-mono tracking-tight">{brl(faturamentoGabriel)}</div>
                              <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mt-1.5">Efetivamente recebido no período</p>
                            </div>
                          )}

                          {(verTudo || proprietarioCaixa === 'eduardo') && (
                            <div className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 md:p-5">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Barber Eduardo</span>
                                <User className="w-3.5 h-3.5 text-zinc-400" />
                              </div>
                              <div className="text-xl md:text-2xl font-bold text-zinc-100 font-mono tracking-tight">{brl(faturamentoEduardo)}</div>
                              <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mt-1.5">Efetivamente recebido no período</p>
                            </div>
                          )}

                          {verTudo && (
                            <div className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 md:p-5">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Faturamento Balcão</span>
                                <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                              </div>
                              <div className="text-xl md:text-2xl font-bold text-zinc-100 font-mono tracking-tight">{brl(faturamentoGeral)}</div>
                              <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mt-1.5">Produtos e taxas gerais</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── GRÁFICO ── */}
                    {tab.id === 'grafico' && (
                      <div className="p-4 md:p-5 pt-0">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-300">Evolução do Faturamento</h2>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">Valores efetivamente recebidos por dia</p>
                          </div>
                          <TrendingUp className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="h-64 md:h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dadosGrafico}>
                              <XAxis dataKey="data" stroke="#71717a" fontSize={10} />
                              <Tooltip formatter={(value) => brl(Number(value))} />
                              <Area type="monotone" dataKey="valor" stroke="#10b981" fill="#10b98122" strokeWidth={3} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* ── LANÇAMENTOS ── */}
                    {tab.id === 'lancamentos' && (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-800/60 bg-zinc-950/60 text-[10px] font-bold tracking-widest uppercase text-zinc-500">
                              <th className="px-4 md:px-6 py-4 text-left w-[120px]">Data</th>
                              <th className="px-4 md:px-6 py-4 text-left">Descrição</th>
                              <th className="px-4 md:px-6 py-4 text-left hidden md:table-cell">Profissional</th>
                              <th className="px-4 md:px-6 py-4 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/40 text-xs">
                            {movimentacoes.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 tracking-wider font-bold uppercase">
                                  Nenhum registro encontrado no período.
                                </td>
                              </tr>
                            ) : (
                              movimentacoes.map((mov) => {
                                const isPendente = (mov.motivo || '').toLowerCase().includes('[consumo fiado]')
                                return (
                                  <tr key={mov.id} className="hover:bg-zinc-900/30 transition-colors">
                                    <td className="px-4 md:px-6 py-4 text-zinc-500 font-semibold tracking-wide font-mono">
                                      {new Date(mov.created_at).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 font-bold tracking-wide">
                                      <span className={isPendente ? 'text-orange-400' : 'text-zinc-400'}>
                                        {mov.motivo}
                                      </span>
                                      {isPendente && (
                                        <span className="ml-2 text-[9px] bg-orange-400/10 text-orange-400 border border-orange-400/20 px-1.5 py-0.5 rounded-full uppercase tracking-widest font-black">
                                          pendente
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-zinc-500 font-semibold hidden md:table-cell">
                                      {mov.profissional || '—'}
                                    </td>
                                    <td className={`px-4 md:px-6 py-4 text-right font-bold font-mono ${
                                      mov.tipo !== 'entrada' ? 'text-rose-400'
                                      : isPendente ? 'text-orange-400'
                                      : 'text-zinc-200'
                                    }`}>
                                      {mov.tipo === 'entrada' ? '' : '- '}
                                      {Number(mov.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
