/* eslint-disable no-console */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { DollarSign, User, Shield, TrendingUp, ChevronDown, ChevronUp, CalendarDays, X } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts'
import { useGuard } from '@/hooks/useGuard'

type TabId = 'financeiro' | 'barbeiros' | 'grafico' | 'lancamentos'
type PeriodoPreset = 'hoje' | '7dias' | 'mes' | 'ano' | 'custom'

interface Movimentacao {
  id: number
  created_at: string
  tipo: string
  valor: number
  motivo: string
  profissional?: string
  forma_pagamento?: string
  proprietario?: string
  estornada?: boolean
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

// Formata "2026-06-25" para exibição amigável
function formatarDataExibicao(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function CaixaRelatoriosPage() {
  const { usuario, negado } = useGuard('relatorios')

  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<PeriodoPreset>('mes')
  const [abasAbertas,  setAbasAbertas]  = useState<Set<TabId>>(new Set())
  const [abasVisiveis, setAbasVisiveis] = useState<Set<TabId>>(new Set())

  // Filtro customizado
  const [mostrarFiltroCustom, setMostrarFiltroCustom] = useState(false)
  const [dataInicioCustm, setDataInicioCustm] = useState('')
  const [dataFimCustm,    setDataFimCustm]    = useState('')
  const [labelCustom,     setLabelCustom]     = useState('')

  const [faturamentoGabriel,     setFaturamentoGabriel]     = useState(0)
  const [faturamentoEduardo,     setFaturamentoEduardo]     = useState(0)
  const [faturamentoGeral,       setFaturamentoGeral]       = useState(0)
  const [faturamentoTotalGlobal, setFaturamentoTotalGlobal] = useState(0)
  const [totalEntradas,          setTotalEntradas]          = useState(0)
  const [totalSaidas,            setTotalSaidas]            = useState(0)
  const [totalEstornos,          setTotalEstornos]          = useState(0)
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
      const OFFSET_BRASILIA = -3 * 60
      const agoraUTC = new Date()
      const agoraBrasil = new Date(agoraUTC.getTime() + (OFFSET_BRASILIA - agoraUTC.getTimezoneOffset()) * 60000)

      let dataInicio: Date
      let dataFim: Date | null = null

      if (periodo === 'custom' && dataInicioCustm) {
        // Dia específico: dataInicio = dataFim (dia inteiro)
        const [y, m, d] = dataInicioCustm.split('-').map(Number)
        dataInicio = new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0)) // 00:00 Brasília

        if (dataFimCustm && dataFimCustm !== dataInicioCustm) {
          // Período: até o fim do dia selecionado (23:59:59 Brasília = próximo dia 02:59:59 UTC)
          const [y2, m2, d2] = dataFimCustm.split('-').map(Number)
          dataFim = new Date(Date.UTC(y2, m2 - 1, d2 + 1, 2, 59, 59, 999))
        } else {
          // Dia único: fim = início + 23h59m59s Brasília
          dataFim = new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59, 999))
        }
      } else if (periodo === 'hoje') {
        dataInicio = new Date(Date.UTC(
          agoraBrasil.getFullYear(), agoraBrasil.getMonth(), agoraBrasil.getDate(), 3, 0, 0, 0
        ))
      } else if (periodo === '7dias') {
        dataInicio = new Date(agoraUTC.getTime() - 7 * 24 * 60 * 60 * 1000)
      } else if (periodo === 'mes') {
        dataInicio = new Date(Date.UTC(agoraBrasil.getFullYear(), agoraBrasil.getMonth(), 1, 3, 0, 0, 0))
      } else {
        dataInicio = new Date(Date.UTC(agoraBrasil.getFullYear(), 0, 1, 3, 0, 0, 0))
      }

      let query = supabase
        .from('movimentacoes_caixa')
        .select('id, created_at, tipo, valor, motivo, profissional, forma_pagamento, proprietario, estornada')
        .gte('created_at', dataInicio.toISOString())
        .order('created_at', { ascending: false })

      if (dataFim) {
        query = query.lte('created_at', dataFim.toISOString())
      }

      if (!verTudo) {
        query = query.eq('proprietario', proprietarioCaixa)
      }

      const { data: movs, error: errMovs } = await query
      if (errMovs) throw errMovs

      let fichaQuery = supabase
        .from('historico_ficha')
        .select('valor')
        .gte('created_at', dataInicio.toISOString())

      if (dataFim) {
        fichaQuery = fichaQuery.lte('created_at', dataFim.toISOString())
      }

      const { data: fichaRows, error: errFicha } = await fichaQuery
      if (errFicha) throw errFicha

      const saldoLiquidoFicha = (fichaRows || []).reduce((acc, row) => acc + Number(row.valor), 0)
      const listaMovs = (movs as Movimentacao[]) || []

      let totalGabriel = 0, totalEduardo = 0, totalGeral = 0, totalGlobal = 0
      let entradas = 0, saidas = 0, estornos = 0, pix = 0, dinheiro = 0, cartao = 0
      const listaFiltrada: Movimentacao[] = []

      for (const m of listaMovs) {
        const valor  = Number(m.valor) || 0
        const prop   = (m.proprietario || 'caixa').toLowerCase()
        const motivo = (m.motivo || '').toLowerCase()

        if (m.tipo === 'estorno') {
          estornos += valor
          listaFiltrada.push(m)
          continue
        }
        if (m.tipo === 'entrada' && m.estornada === true) {
          listaFiltrada.push(m)
          continue
        }
        if (m.tipo === 'entrada') {
          const isConsumoFiado = motivo.includes('[consumo fiado]')
          if (!isConsumoFiado) {
            entradas    += valor
            totalGlobal += valor
            if (prop === 'gabriel')      totalGabriel += valor
            else if (prop === 'eduardo') totalEduardo += valor
            else                         totalGeral   += valor
            const forma = detectarFormaPagamento(m)
            if (forma === 'pix')           pix      += valor
            else if (forma === 'dinheiro') dinheiro += valor
            else if (forma === 'cartao')   cartao   += valor
          }
          listaFiltrada.push(m)
        } else {
          saidas += valor
          listaFiltrada.push(m)
        }
      }

      const porDia: Record<string, number> = {}
      for (const mov of listaMovs) {
        if (mov.tipo !== 'entrada') continue
        if (mov.estornada === true) continue
        if ((mov.motivo || '').toLowerCase().includes('[consumo fiado]')) continue
        const d = new Date(mov.created_at).toLocaleDateString('pt-BR')
        porDia[d] = (porDia[d] || 0) + Number(mov.valor || 0)
      }

      const entradasLiquidas = entradas - estornos

      setDadosGrafico(Object.entries(porDia).map(([data, valor]) => ({ data, valor })))
      setFaturamentoGabriel(totalGabriel)
      setFaturamentoEduardo(totalEduardo)
      setFaturamentoGeral(totalGeral)
      setFaturamentoTotalGlobal(totalGlobal - estornos)
      setMovimentacoes(listaFiltrada)
      setTotalEntradas(entradasLiquidas)
      setTotalSaidas(saidas)
      setTotalEstornos(estornos)
      setLucroLiquido(entradasLiquidas - saidas)
      setTotalPix(pix)
      setTotalDinheiro(dinheiro)
      setTotalCartao(cartao)
      setTotalFicha(Math.max(0, saldoLiquidoFicha))
    } catch (err: unknown) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [periodo, usuario, dataInicioCustm, dataFimCustm])

  useEffect(() => {
    setAbasAbertas(new Set(abasVisiveis))
    carregarRelatorios()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, usuario, dataInicioCustm, dataFimCustm])

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

  function aplicarFiltroCustom() {
    if (!dataInicioCustm) return
    if (dataFimCustm && dataFimCustm < dataInicioCustm) {
      alert('A data final não pode ser anterior à data inicial.')
      return
    }
    const mesmoDia = !dataFimCustm || dataFimCustm === dataInicioCustm
    if (mesmoDia) {
      setLabelCustom(formatarDataExibicao(dataInicioCustm))
    } else {
      setLabelCustom(`${formatarDataExibicao(dataInicioCustm)} → ${formatarDataExibicao(dataFimCustm)}`)
    }
    setPeriodo('custom')
    setMostrarFiltroCustom(false)
  }

  function limparFiltroCustom() {
    setDataInicioCustm('')
    setDataFimCustm('')
    setLabelCustom('')
    setPeriodo('mes')
    setMostrarFiltroCustom(false)
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
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-widest uppercase">Relatórios</h1>
            <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1.5 font-semibold">
              {verTudo
                ? 'Produção e faturamento de todos os profissionais'
                : `Produção e faturamento de ${profissionalAtual}`
              }
            </p>
          </div>

          {/* FILTROS DE PERÍODO */}
          <div className="flex flex-col gap-2 items-end">
            {/* Botões preset */}
            <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800/80 text-[10px] font-bold tracking-wider uppercase">
              {(['hoje', '7dias', 'mes', 'ano'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPeriodo(p); setLabelCustom(''); setMostrarFiltroCustom(false) }}
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

              {/* Botão período custom */}
              <button
                onClick={() => setMostrarFiltroCustom((v) => !v)}
                className={`px-3 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  periodo === 'custom' ? 'bg-white text-black' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <CalendarDays size={12} />
                {periodo === 'custom' && labelCustom ? labelCustom : 'Data'}
              </button>

              {/* Limpar filtro custom */}
              {periodo === 'custom' && (
                <button
                  onClick={limparFiltroCustom}
                  className="px-2 py-2 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors"
                  title="Limpar filtro de data"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Painel de seleção de data */}
            {mostrarFiltroCustom && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 shadow-2xl w-full sm:w-auto min-w-[280px] space-y-3 z-10">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Filtrar por data
                </p>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Dia / Data Inicial
                  </label>
                  <input
                    type="date"
                    value={dataInicioCustm}
                    onChange={(e) => setDataInicioCustm(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl h-10 px-3 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-zinc-600 [color-scheme:dark]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Data Final <span className="text-zinc-600 normal-case font-normal">(opcional — deixe vazio para dia único)</span>
                  </label>
                  <input
                    type="date"
                    value={dataFimCustm}
                    min={dataInicioCustm}
                    onChange={(e) => setDataFimCustm(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl h-10 px-3 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-zinc-600 [color-scheme:dark]"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={aplicarFiltroCustom}
                    disabled={!dataInicioCustm}
                    className="flex-1 bg-white text-black h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-zinc-200 disabled:opacity-30"
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={() => setMostrarFiltroCustom(false)}
                    className="flex-1 bg-zinc-900 text-zinc-400 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
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
                            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mt-1.5">Líquido (descontando estornos)</p>
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

                        {totalEstornos > 0 && (
                          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Total Estornado no Período</p>
                              <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">Já descontado das entradas acima</p>
                            </div>
                            <div className="text-lg font-black text-amber-400 font-mono">- {brl(totalEstornos)}</div>
                          </div>
                        )}

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
                            { label: 'Dinheiro',          valor: totalDinheiro, cor: 'text-yellow-400', desc: 'Recebido em espécie'           },
                            { label: 'Cartão',            valor: totalCartao,   cor: 'text-purple-400', desc: 'Débito e crédito'              },
                            { label: 'Pendente em Ficha', valor: totalFicha,    cor: 'text-orange-400', desc: 'Consumido — ainda não recebido' },
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
                                const isPendente  = (mov.motivo || '').toLowerCase().includes('[consumo fiado]')
                                const isEstornado = mov.estornada === true
                                const isEstorno   = mov.tipo === 'estorno'

                                return (
                                  <tr
                                    key={mov.id}
                                    className={`transition-colors ${isEstornado ? 'opacity-40' : 'hover:bg-zinc-900/30'}`}
                                  >
                                    <td className="px-4 md:px-6 py-4 text-zinc-500 font-semibold tracking-wide font-mono">
                                      {new Date(mov.created_at).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 font-bold tracking-wide">
                                      <span className={
                                        isEstornado ? 'line-through text-zinc-600' :
                                        isEstorno   ? 'text-amber-400' :
                                        isPendente  ? 'text-orange-400' :
                                        'text-zinc-400'
                                      }>
                                        {mov.motivo}
                                      </span>
                                      {isPendente && !isEstornado && (
                                        <span className="ml-2 text-[9px] bg-orange-400/10 text-orange-400 border border-orange-400/20 px-1.5 py-0.5 rounded-full uppercase tracking-widest font-black">
                                          pendente
                                        </span>
                                      )}
                                      {isEstornado && (
                                        <span className="ml-2 text-[9px] bg-zinc-700/40 text-zinc-500 border border-zinc-700/40 px-1.5 py-0.5 rounded-full uppercase tracking-widest font-black">
                                          estornado
                                        </span>
                                      )}
                                      {isEstorno && (
                                        <span className="ml-2 text-[9px] bg-amber-400/10 text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded-full uppercase tracking-widest font-black">
                                          estorno
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-zinc-500 font-semibold hidden md:table-cell">
                                      {mov.profissional || '—'}
                                    </td>
                                    <td className={`px-4 md:px-6 py-4 text-right font-bold font-mono ${
                                      isEstornado ? 'text-zinc-600 line-through' :
                                      isEstorno   ? 'text-amber-400' :
                                      mov.tipo !== 'entrada' ? 'text-rose-400' :
                                      isPendente  ? 'text-orange-400' :
                                      'text-zinc-200'
                                    }`}>
                                      {(mov.tipo !== 'entrada' || isEstorno) ? '- ' : ''}
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
