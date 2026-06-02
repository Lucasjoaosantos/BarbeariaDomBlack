/* eslint-disable no-console */
'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { useGuard } from '@/hooks/useGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Trash2, Plus, Receipt } from 'lucide-react'

interface Cliente {
  id: number
  nome: string
  permite_fiado: boolean
  ativo: boolean
}

interface Caixa {
  id: number
  status: string
  valor_inicial: number
  valor_final?: number
  closed_at?: string
  proprietario: string
}

interface ResumoFechamento {
  inicial: number
  dinheiro: number
  pix: number
  cartao: number
  totalAtendimentos: number
  faturamentoGeral: number
  caixaEmMaos: number
  sangria: number
}

interface ItemVenda {
  id: number
  nome: string
  preco?: number
  preco_venda?: number
  tipo: 'servico' | 'produto' | 'recebimento_ficha'
  estoque?: number
}

interface ItemCarrinho {
  item: ItemVenda
  quantidade: number
  profissional: string
  valorUnitario: number
  valorTotal: number
}

// Cache em memória para dados estáticos
let _cacheProdutosServicos: ItemVenda[] | null = null
let _cacheClientes: Cliente[] | null = null

export default function CaixaPDVPage() {

  // ── Guard: só quem tem permissão 'caixa' acessa ──────────────────────────────
  const { usuario, negado } = useGuard('caixa')
  if (negado) return null
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemVenda[]>([])
  const [caixaAtivo, setCaixaAtivo] = useState<Caixa | null>(null)
  const [loading, setLoading] = useState(true)

  const [modalAbrir, setModalAbrir] = useState(false)
  const [modalFechar, setModalFechar] = useState(false)
  const [valorContado, setValorContado] = useState('')
  const [modalSangria, setModalSangria] = useState(false)
  const [valorSangria, setValorSangria] = useState('')
  const [motivoSangria, setMotivoSangria] = useState('')
  const [trocoInicial, setTrocoInicial] = useState('')
  const [resumoFechamento, setResumoFechamento] = useState<ResumoFechamento | null>(null)

  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [saldoFichaAberto, setSaldoFichaAberto] = useState<number>(0)
  const [valorAbatimentoInput, setValorAbatimentoInput] = useState('')

  const [itemSelecionado, setItemSelecionado] = useState('')
  const [quantidadeInput, setQuantidadeInput] = useState(1)
  const [valorTotalInput, setValorTotalInput] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [isProcessando, setIsProcessando] = useState(false)
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])

  const inicializadoRef = useRef(false)

  useEffect(() => {
    // Aguarda o usuário estar disponível antes de inicializar
    if (!usuario || inicializadoRef.current) return
    inicializadoRef.current = true
    inicializarCaixa()
  }, [usuario])

  // ── O profissional é sempre o do usuário logado — sem seleção manual ──────────
  const profissionalLogado = usuario?.profissional ?? 'Caixa'
  const proprietarioCaixa = usuario?.proprietarioCaixa ?? 'caixa'

  async function inicializarCaixa(forcarEstaticos = false) {
    setLoading(true)
    try {
      // Busca apenas o caixa DESTE usuário (filtro por proprietario)
      const { data: caixas, error: errCaixa } = await supabase
        .from('controle_caixa')
        .select('id, status, valor_inicial, valor_final, closed_at, proprietario')
        .eq('status', 'aberto')
        .eq('proprietario', proprietarioCaixa)   // ← isolamento por usuário
        .order('id', { ascending: false })
        .limit(1)

      if (errCaixa) throw errCaixa
      setCaixaAtivo(caixas && caixas.length > 0 ? caixas[0] : null)

      if (!_cacheClientes || forcarEstaticos) {
        const { data: dataClientes } = await supabase
          .from('clientes')
          .select('id, nome, permite_fiado, ativo')
          .eq('ativo', true)
          .order('nome', { ascending: true })
        _cacheClientes = (dataClientes as Cliente[]) || []
      }
      setClientes(_cacheClientes)

      if (!_cacheProdutosServicos || forcarEstaticos) {
        const [resProdutos, resServicos] = await Promise.all([
          supabase.from('produtos').select('id, nome, preco_venda, estoque, ativo').eq('ativo', true),
          supabase.from('servicos').select('id, nome, preco, ativo').eq('ativo', true)
        ])

        const produtosFormatados: ItemVenda[] = (resProdutos.data || []).map(p => ({
          id: p.id,
          nome: p.nome, 
          preco_venda: p.preco_venda,
          tipo: 'produto', 
          estoque: p.estoque
        }))
        const servicosFormatados: ItemVenda[] = (resServicos.data || []).map(s => ({
          id: s.id, nome: s.nome, preco: s.preco, tipo: 'servico'
        }))
        _cacheProdutosServicos = [...produtosFormatados, ...servicosFormatados]
          .sort((a, b) => a.nome.localeCompare(b.nome))
      }
      setItensDisponiveis(_cacheProdutosServicos)

    } catch (err) {
      console.error("Erro na inicialização do PDV:", err)
    } finally {
      setLoading(false)
    }
  }

  function recarregarAposFinalizar(temProduto: boolean) {
    if (temProduto) {
      _cacheProdutosServicos = null
      inicializarCaixa(false)
    } else {
      supabase
        .from('controle_caixa')
        .select('id, status, valor_inicial, valor_final, closed_at, proprietario')
        .eq('status', 'aberto')
        .eq('proprietario', proprietarioCaixa)
        .order('id', { ascending: false })
        .limit(1)
        .then(({ data }) => setCaixaAtivo(data && data.length > 0 ? data[0] : null))
    }
  }

  async function buscarSaldoFichaCliente(clienteId: number) {
    try {
      const { data, error } = await supabase
        .from('historico_ficha')
        .select('valor, forma_pagamento')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error

      const saldo = (data || []).reduce((acc, m) => acc + Number(m.valor), 0)
      const saldoFinal = Math.max(0, saldo)
      setSaldoFichaAberto(saldoFinal)
      setValorAbatimentoInput(saldoFinal > 0 ? saldoFinal.toFixed(2) : '')
    } catch (err) {
      console.error('Erro ao consultar saldo da ficha:', err)
      setSaldoFichaAberto(0)
      setValorAbatimentoInput('')
    }
  }

  async function handleMudarCliente(idSelecionado: string) {
    if (!idSelecionado) {
      setClienteSelecionado(null); setSaldoFichaAberto(0); setValorAbatimentoInput(''); return
    }
    const cliente = clientes.find(c => c.id === Number(idSelecionado))
    if (cliente) {
      setClienteSelecionado(cliente)
      if (cliente.permite_fiado) await buscarSaldoFichaCliente(cliente.id)
      else { setSaldoFichaAberto(0); setValorAbatimentoInput('') }
    }
  }

  function handleMudarItem(nomeItem: string) {
    setItemSelecionado(nomeItem)
    const item = itensDisponiveis.find(i => i.nome === nomeItem)
    if (item) {
      const preco = item.tipo === 'produto' ? item.preco_venda : item.preco
      setValorTotalInput(Number(preco || 0).toString())
    } else {
      setValorTotalInput('')
    }
  }

  function handleAdicionarAbatimentoFichaAoCarrinho() {
    const valorParaAbater = Number(valorAbatimentoInput) || 0
    if (!clienteSelecionado || valorParaAbater <= 0) return
    if (carrinho.some(c => c.item.tipo === 'recebimento_ficha')) {
      alert('Já existe um item de amortização de ficha no pedido.')
      return
    }
    const itemFicha: ItemVenda = {
      id: clienteSelecionado.id,
      nome: `Pagamento/Abatimento de Ficha - ${clienteSelecionado.nome}`,
      tipo: 'recebimento_ficha',
      preco: valorParaAbater
    }
    setCarrinho([...carrinho, {
      item: itemFicha, quantidade: 1,
      profissional: profissionalLogado,
      valorUnitario: valorParaAbater, valorTotal: valorParaAbater
    }])
  }

  function handleAdicionarAoCarrinho() {
    const itemFato = itensDisponiveis.find(i => i.nome === itemSelecionado)
    if (!itemFato) return

    if (itemFato.tipo === 'produto') {
      const estoqueAtual = itemFato.estoque ?? 0
      const jaNoCarrinho = carrinho
        .filter(c => c.item.tipo === 'produto' && c.item.id === itemFato.id)
        .reduce((acc, c) => acc + c.quantidade, 0)
      if (estoqueAtual <= 0) { alert(`⚠️ Produto "${itemFato.nome}" esgotado!`); return }
      if (jaNoCarrinho + quantidadeInput > estoqueAtual) {
        alert(`⚠️ Estoque insuficiente! Restam ${estoqueAtual} unidades.`); return
      }
    }

    const valorUnitario = Number(valorTotalInput)
    setCarrinho([...carrinho, {
      item: itemFato,
      quantidade: quantidadeInput,
      profissional: profissionalLogado,  // ← sempre o profissional do login
      valorUnitario,
      valorTotal: valorUnitario * quantidadeInput
    }])
    setItemSelecionado(''); setValorTotalInput(''); setQuantidadeInput(1)
  }

  const totalGeralCarrinho = carrinho.reduce((acc, i) => acc + Number(i.valorTotal || 0), 0)

  async function handleAbrirCaixa() {
    try {
      const { data: caixaExistente } = await supabase
        .from('controle_caixa')
        .select('id, status, valor_inicial, valor_final, closed_at, proprietario')
        .eq('status', 'aberto')
        .eq('proprietario', proprietarioCaixa)
        .maybeSingle()

      if (caixaExistente) {
        alert('Você já tem um caixa aberto.')
        setCaixaAtivo(caixaExistente)
        setModalAbrir(false)
        return
      }

      const { data, error } = await supabase
        .from('controle_caixa')
        .insert({ valor_inicial: Number(trocoInicial) || 0, status: 'aberto', proprietario: proprietarioCaixa })
        .select().single()

      if (error) throw error
      setCaixaAtivo(data); setTrocoInicial(''); setModalAbrir(false)
      alert('Caixa aberto com sucesso!')
    } catch (err: any) { console.error(err); alert(err.message) }
  }

  async function prepararFechamento() {
    if (!caixaAtivo) return
    try {
      const { data: movs, error } = await supabase
        .from('movimentacoes_caixa')
        .select('tipo, valor, motivo, forma_pagamento')
        .eq('caixa_id', caixaAtivo.id)

      if (error) throw error
      const movimentacoes = movs || []
      let dinheiro = 0, pix = 0, cartao = 0, sangria = 0

      movimentacoes.forEach(m => {
        const valorNum = Number(m.valor) || 0
        const motivoLower = (m.motivo || '').toLowerCase()
        if (motivoLower.includes('[sangria]') || m.tipo === 'saida') { sangria += valorNum; return }
        const forma = (m.forma_pagamento || '').toLowerCase()
        if (forma === 'dinheiro' || motivoLower.includes('dinheiro'))   dinheiro += valorNum
        else if (forma === 'pix' || motivoLower.includes('pix'))        pix      += valorNum
        else if (forma === 'cartao' || motivoLower.includes('cart'))    cartao   += valorNum
      })

      const faturamentoGeral = dinheiro + pix + cartao
      const caixaEmMaos = (caixaAtivo.valor_inicial || 0) + dinheiro - sangria
      setResumoFechamento({
        inicial: caixaAtivo.valor_inicial || 0, dinheiro, pix, cartao, sangria,
        totalAtendimentos: movimentacoes.length, faturamentoGeral, caixaEmMaos
      })
      setValorContado(''); setModalFechar(true)
    } catch (err) { console.error(err); alert('Erro ao processar dados de fechamento.') }
  }

  async function handleSangria() {
    if (!caixaAtivo || caixaAtivo.status !== 'aberto') { alert('Caixa fechado.'); return }
    const valor = Number(valorSangria)
    if (valor <= 0) { alert('Informe um valor válido.'); return }
    try {
      const { error } = await supabase.from('movimentacoes_caixa').insert({
        caixa_id: caixaAtivo.id, tipo: 'saida', valor,
        motivo: `[SANGRIA] ${motivoSangria || 'Retirada de caixa'}`,
        proprietario: proprietarioCaixa
      })
      if (error) throw error
      alert('Sangria realizada!'); setValorSangria(''); setMotivoSangria(''); setModalSangria(false)
    } catch (err: any) { alert(`Erro na sangria: ${err.message}`) }
  }

  async function handleFinalizarVenda(e: React.FormEvent) {
    e.preventDefault()
    if (!caixaAtivo || caixaAtivo.status !== 'aberto') { alert('Não existe caixa aberto.'); return }
    if (carrinho.length === 0) { alert('Seu carrinho está vazio!'); return }

    setIsProcessando(true)
    const idDoCaixaOficial = Number(caixaAtivo.id)
    const temProduto = carrinho.some(c => c.item.tipo === 'produto')

    try {
      const detalhesItens = carrinho.map(c => {
        const sufixo = c.item.tipo === 'produto' ? '[PRODUTO]' : c.item.tipo === 'recebimento_ficha' ? '[PAGAMENTO FICHA]' : '[SERVIÇO]'
        return `${c.quantidade}x ${c.item.nome} ${sufixo}`
      }).join(', ')

      const totalNovosConsumos = carrinho
        .filter(c => c.item.tipo !== 'recebimento_ficha')
        .reduce((acc, c) => acc + c.valorTotal, 0)

      const totalPAGODaFichaAntiga = carrinho
        .filter(c => c.item.tipo === 'recebimento_ficha')
        .reduce((acc, c) => acc + c.valorTotal, 0)

      if (formaPagamento === 'ficha') {
        if (!clienteSelecionado) { alert('Selecione um cliente para usar a ficha.'); setIsProcessando(false); return }

        if (totalNovosConsumos > 0) {
          const { error } = await supabase.from('historico_ficha').insert({
            cliente_id: Number(clienteSelecionado.id),
            descricao: `[Consumo Fiado] ${detalhesItens}`,
            valor: totalNovosConsumos, forma_pagamento: 'ficha'
          })
          if (error) throw error
        }
        if (totalPAGODaFichaAntiga > 0) {
          const { error } = await supabase.from('historico_ficha').insert({
            cliente_id: Number(clienteSelecionado.id),
            descricao: `[Abatimento interno via Ficha]`,
            valor: -totalPAGODaFichaAntiga, forma_pagamento: 'pago_caixa'
          })
          if (error) throw error
        }
        if (totalNovosConsumos > 0) {
          const { error } = await supabase.from('movimentacoes_caixa').insert({
            caixa_id: idDoCaixaOficial, tipo: 'entrada', valor: totalNovosConsumos,
            motivo: `[Consumo Fiado] ${clienteSelecionado.nome} — ${detalhesItens}`,
            profissional: profissionalLogado, forma_pagamento: 'ficha',
            proprietario: proprietarioCaixa
          })
          if (error) throw error
        }
        alert('✅ Lançamento na ficha realizado!')

      } else {
        for (const itemCarrinho of carrinho) {
          if (itemCarrinho.item.tipo === 'recebimento_ficha') continue
          const sufixo = itemCarrinho.item.tipo === 'produto' ? '[PRODUTO]' : '[SERVIÇO]'
          const { error } = await supabase.from('movimentacoes_caixa').insert({
            caixa_id: idDoCaixaOficial, tipo: 'entrada', valor: itemCarrinho.valorTotal,
            motivo: `[Venda] ${itemCarrinho.quantidade}x ${itemCarrinho.item.nome} ${sufixo} - Cliente: ${clienteSelecionado?.nome || 'Avulso'} - Profissional: ${profissionalLogado} - Forma: ${formaPagamento.toUpperCase()}`,
            profissional: profissionalLogado,
            forma_pagamento: formaPagamento,
            proprietario: proprietarioCaixa
          })
          if (error) throw error
        }

        if (totalPAGODaFichaAntiga > 0 && clienteSelecionado) {
          const { error: e1 } = await supabase.from('historico_ficha').insert({
            cliente_id: Number(clienteSelecionado.id),
            descricao: `[Acerto via Caixa] Pago em ${formaPagamento.toUpperCase()} — R$ ${totalPAGODaFichaAntiga.toFixed(2)}`,
            valor: -totalPAGODaFichaAntiga, forma_pagamento: formaPagamento
          })
          if (e1) throw e1

          const { error: e2 } = await supabase.from('movimentacoes_caixa').insert({
            caixa_id: idDoCaixaOficial, tipo: 'entrada', valor: totalPAGODaFichaAntiga,
            motivo: `[Acerto via Caixa] ${clienteSelecionado.nome} — pago em ${formaPagamento.toUpperCase()}`,
            profissional: profissionalLogado, forma_pagamento: formaPagamento,
            proprietario: proprietarioCaixa
          })
          if (e2) throw e2
        }

        for (const itemCarrinho of carrinho) {
          if (itemCarrinho.item.tipo === 'produto') {
            const { error } = await supabase.rpc('registrar_venda_segura', {
              p_produto_id: itemCarrinho.item.id, p_quantidade: itemCarrinho.quantidade
            })
            if (error) throw error
          }
        }
        alert('✅ Operação finalizada com sucesso!')
      }

      setCarrinho([]); setClienteSelecionado(null); setSaldoFichaAberto(0)
      setValorAbatimentoInput(''); setFormaPagamento('pix')
      recarregarAposFinalizar(temProduto)

    } catch (err: any) {
      console.error(err); alert(`Erro no lançamento: ${err.message}`)
    } finally {
      setIsProcessando(false)
    }
  }

  async function handleConfirmarFechamento() {
    if (!caixaAtivo || !resumoFechamento || !valorContado) {
      alert('Informe o valor contado.'); return
    }
    try {
      const valorContadoNumero = Number(valorContado)
      const { error } = await supabase.from('controle_caixa').update({
        status: 'fechado', valor_final: resumoFechamento.caixaEmMaos,
        valor_contado: valorContadoNumero,
        diferenca_caixa: valorContadoNumero - resumoFechamento.caixaEmMaos,
        closed_at: new Date().toISOString(), fechado_por: profissionalLogado
      }).eq('id', caixaAtivo.id)

      if (error) throw error
      alert('✅ Caixa encerrado!')
      setModalFechar(false); setCaixaAtivo(null); setResumoFechamento(null); setValorContado('')
    } catch (err: any) { console.error(err); alert(`Erro ao salvar: ${err.message}`) }
  }

  // Guard: não renderiza nada enquanto redireciona
  if (negado) return null

  if (loading) {
    return (
      <div className="flex min-h-screen bg-black text-zinc-500 items-center justify-center text-xs tracking-widest uppercase font-bold">
        Carregando caixa de {profissionalLogado}...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-white font-sans antialiased selection:bg-white selection:text-black">
      <Sidebar />

      <main className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full pt-20 md:pt-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 border-b border-zinc-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-widest uppercase">Frente de Caixa</h1>
            {/* Mostra de quem é o caixa */}
            <p className="text-zinc-600 text-[10px] tracking-widest uppercase mt-0.5 font-bold">
              Operador: <span className="text-zinc-400">{profissionalLogado}</span>
            </p>
            <p className={`text-xs tracking-wider uppercase mt-1 font-bold ${caixaAtivo ? 'text-emerald-400' : 'text-rose-400/80'}`}>
              {caixaAtivo ? `✓ Caixa ID ${caixaAtivo.id} em operação` : '⚠️ Caixa Fechado'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!caixaAtivo ? (
              <Button type="button" size="sm" onClick={() => setModalAbrir(true)}
                className="bg-white text-black hover:bg-zinc-200 text-xs font-bold tracking-widest uppercase h-10 px-5 rounded-xl">
                Abrir Caixa
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={() => setModalSangria(true)}
                  className="bg-red-900 hover:bg-red-800 text-white text-xs font-bold tracking-widest uppercase h-10 px-4 rounded-xl border border-red-700">
                  Sangria
                </Button>
                <Button size="sm" onClick={prepararFechamento}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold tracking-widest uppercase h-10 px-4 rounded-xl border border-zinc-800">
                  Fechar Caixa
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-5 bg-zinc-900/30 p-5 md:p-8 rounded-2xl border border-zinc-800/80 backdrop-blur-md shadow-xl">

          {/* SEÇÃO 1: CLIENTE */}
          <div className="space-y-3">
            <Label htmlFor="cliente" className="text-zinc-500 text-[10px] font-bold tracking-wider uppercase">
              1. Identificar Cliente
            </Label>
            <select
              id="cliente"
              value={clienteSelecionado ? clienteSelecionado.id : ''}
              onChange={(e) => handleMudarCliente(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-xs font-semibold text-zinc-300 focus:outline-none focus:border-zinc-700 transition-colors"
              disabled={!caixaAtivo}
            >
              <option value="">Cliente Final (Avulso)</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c.permite_fiado ? '• (Possui Ficha)' : ''}
                </option>
              ))}
            </select>

            {clienteSelecionado?.permite_fiado && saldoFichaAberto > 0 && (
              <div className="p-4 bg-zinc-950 border border-amber-500/20 rounded-xl text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white uppercase tracking-wider flex items-center gap-2 text-[10px]">
                    <Receipt size={14} className="text-amber-400" />
                    Ficha em Aberto:
                    <span className="text-amber-400 font-mono">
                      {saldoFichaAberto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.01" placeholder="Valor do acerto..."
                    value={valorAbatimentoInput} onChange={(e) => setValorAbatimentoInput(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-zinc-200 h-10 text-xs rounded-xl" />
                  <Button type="button" size="sm" onClick={handleAdicionarAbatimentoFichaAoCarrinho}
                    className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 text-[10px] h-10 px-4 rounded-xl font-bold tracking-widest uppercase">
                    Incluir
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO 2: ITENS */}
          <div className="p-4 md:p-5 bg-zinc-950/40 rounded-xl border border-zinc-800/60 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">2. Adicionar Itens ao Pedido</h2>
              {/* Profissional fixo — sem select, apenas exibe */}
              <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-600">
                Profissional: <span className="text-zinc-400">{profissionalLogado}</span>
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="itens" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                O que foi consumido?
              </Label>
              <select
                id="itens"
                value={itemSelecionado}
                onChange={(e) => handleMudarItem(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-xs font-semibold text-zinc-300 focus:outline-none focus:border-zinc-700 transition-colors"
                disabled={!caixaAtivo}
              >
                <option value="">-- Selecione o item --</option>
                {itensDisponiveis.map((item, idx) => {
                  const textoEstoque = item.tipo === 'produto' ? ` | Est: ${item.estoque ?? 0}` : ''
                  return (
                    <option key={`${item.tipo}-${item.id}-${idx}`} value={item.nome}>
                      {item.nome} ({item.tipo === 'servico' ? '✂️ Serv.' : '🥤 Prod.'}{textoEstoque})
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="qtd" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Quantidade</Label>
                <Input id="qtd" type="number" min="1" value={quantidadeInput}
                  onChange={(e) => setQuantidadeInput(Math.max(1, Number(e.target.value)))}
                  className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl"
                  disabled={!caixaAtivo || !itemSelecionado} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalInput" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Preço Unitário (R$)</Label>
                <Input id="totalInput" type="number" step="0.01" value={valorTotalInput}
                  onChange={(e) => setValorTotalInput(e.target.value)} placeholder="0,00"
                  className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl"
                  disabled={!caixaAtivo || !itemSelecionado} />
              </div>
            </div>

            <Button type="button" onClick={handleAdicionarAoCarrinho}
              disabled={!itemSelecionado || !caixaAtivo}
              className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 text-xs h-11 rounded-xl font-bold tracking-widest uppercase flex items-center justify-center gap-2 disabled:opacity-40">
              <Plus size={14} /> Incluir no Pedido
            </Button>
          </div>

          {/* CARRINHO */}
          {carrinho.length > 0 && (
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/20">
              <div className="bg-zinc-950 px-4 py-3 text-[10px] font-bold text-zinc-500 tracking-widest uppercase border-b border-zinc-800/60">
                Itens Adicionados
              </div>
              <ul className="divide-y divide-zinc-800/40 max-h-48 overflow-y-auto">
                {carrinho.map((c, index) => (
                  <li key={index} className="px-4 py-3.5 flex items-center justify-between text-xs hover:bg-zinc-900/10">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-bold text-zinc-200 truncate">
                        {c.item.tipo !== 'recebimento_ficha' && `${c.quantidade}x `}{c.item.nome}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-semibold uppercase">
                        {Number(c.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | {c.profissional}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-bold text-zinc-200 font-mono">
                        {c.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <button type="button" onClick={() => setCarrinho(carrinho.filter((_, i) => i !== index))}
                        className="text-zinc-600 hover:text-zinc-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="bg-zinc-950/80 px-5 py-4 flex justify-between items-center text-xs font-black border-t border-zinc-800/60 tracking-widest uppercase">
                <span className="text-zinc-500">Total Líquido:</span>
                <span className="text-white text-sm font-mono">
                  {totalGeralCarrinho.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          )}

          {/* SEÇÃO 3: PAGAMENTO */}
          <form onSubmit={handleFinalizarVenda} className="space-y-4 pt-4 border-t border-zinc-800/60">
            <div>
              <Label htmlFor="pagamento" className="text-zinc-400 text-[10px] font-bold tracking-wider uppercase">
                3. Escolha a forma de pagamento
              </Label>
              <select id="pagamento" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-xs font-semibold text-zinc-300 focus:outline-none focus:border-zinc-700"
                disabled={!caixaAtivo || carrinho.length === 0}>
                <option value="pix">Pagar via Pix</option>
                <option value="dinheiro">Pagar em Dinheiro</option>
                <option value="cartao">Pagar via Cartão</option>
                {clienteSelecionado?.permite_fiado && (
                  <option value="ficha">Marcar na Ficha</option>
                )}
              </select>
            </div>
            <button type="submit"
              className="w-full bg-white text-black hover:bg-zinc-200 h-12 rounded-xl text-xs font-bold tracking-widest uppercase transition-all active:scale-[0.99] disabled:opacity-40"
              disabled={isProcessando || !caixaAtivo || carrinho.length === 0}>
              {isProcessando ? 'Processando...' : 'Concluir e Lançar no Caixa'}
            </button>
          </form>
        </div>
      </main>

      {/* MODAL ABRIR CAIXA */}
      <Dialog open={modalAbrir} onOpenChange={setModalAbrir}>
        <DialogContent className="border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md text-white rounded-2xl max-w-sm p-6 shadow-2xl">
          <DialogHeader className="border-b border-zinc-800/60 pb-4">
            <DialogTitle className="text-sm font-black tracking-widest uppercase">
              Abrir Caixa — {profissionalLogado}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Troco Inicial (R$)</Label>
              <Input type="number" step="0.01" value={trocoInicial}
                onChange={(e) => setTrocoInicial(e.target.value)} placeholder="0,00"
                className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl" />
            </div>
            <button className="w-full bg-white text-black hover:bg-zinc-200 h-11 rounded-xl text-xs font-black uppercase tracking-widest"
              onClick={handleAbrirCaixa}>
              Confirmar Abertura
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL SANGRIA */}
      <Dialog open={modalSangria} onOpenChange={setModalSangria}>
        <DialogContent className="border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md text-white rounded-2xl max-w-sm p-6 shadow-2xl">
          <DialogHeader className="border-b border-zinc-800/60 pb-4">
            <DialogTitle className="text-sm font-black tracking-widest uppercase">Realizar Sangria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Valor (R$)</Label>
              <Input type="number" step="0.01" value={valorSangria}
                onChange={(e) => setValorSangria(e.target.value)} placeholder="0,00"
                className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Motivo</Label>
              <Input value={motivoSangria} onChange={(e) => setMotivoSangria(e.target.value)}
                placeholder="Ex: Retirada fornecedor..."
                className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl" />
            </div>
            <button className="w-full bg-red-600 hover:bg-red-500 text-white h-11 rounded-xl text-xs font-bold tracking-widest uppercase"
              onClick={handleSangria}>
              Confirmar Sangria
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL FECHAMENTO */}
      <Dialog open={modalFechar} onOpenChange={setModalFechar}>
        <DialogContent className="border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md text-white rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader className="border-b border-zinc-800/60 pb-4">
            <DialogTitle className="text-sm font-black tracking-widest uppercase">
              Fechamento — {profissionalLogado}
            </DialogTitle>
          </DialogHeader>
          {resumoFechamento && (
            <div className="mt-4 space-y-4">
              <div className="space-y-2 text-[11px] font-semibold tracking-wider uppercase">
                {[
                  ['(+) Troco Inicial', resumoFechamento.inicial, 'zinc'],
                  ['Faturamento Dinheiro', resumoFechamento.dinheiro, 'zinc'],
                  ['Faturamento Pix', resumoFechamento.pix, 'zinc'],
                  ['Faturamento Cartão', resumoFechamento.cartao, 'zinc'],
                ].map(([label, valor]) => (
                  <div key={label as string} className="flex justify-between text-zinc-500">
                    <span>{label as string}</span>
                    <span className="text-zinc-300 font-bold font-mono">
                      {(valor as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-red-400">
                  <span>(-) Total Sangrias</span>
                  <span className="font-bold font-mono">
                    {resumoFechamento.sangria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="h-px bg-zinc-800 my-1" />
                <div className="flex justify-between text-zinc-200 font-bold">
                  <span>Faturamento Geral</span>
                  <span className="font-mono">
                    {resumoFechamento.faturamentoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className={`flex justify-between px-3.5 py-3 rounded-xl border font-black text-[12px] ${
                  resumoFechamento.caixaEmMaos < 0 ? 'bg-red-950/40 border-red-800/50' : 'bg-zinc-950 border-zinc-800/80'
                }`}>
                  <span className="text-white">💵 Dinheiro Físico em Caixa</span>
                  <span className={`font-mono ${resumoFechamento.caixaEmMaos < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {resumoFechamento.caixaEmMaos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              <div className="border-t border-zinc-800/60 pt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                    Valor contado fisicamente (R$)
                  </Label>
                  <Input type="number" step="0.01" value={valorContado}
                    onChange={(e) => setValorContado(e.target.value)} placeholder="0,00"
                    className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl" />
                </div>
                {valorContado !== '' && (
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest bg-zinc-950 px-3.5 py-3 rounded-xl border border-zinc-800/60">
                    <span className="text-zinc-500">Diferença:</span>
                    <span className={`font-mono ${
                      Number(valorContado) > resumoFechamento.caixaEmMaos ? 'text-emerald-400'
                      : Number(valorContado) < resumoFechamento.caixaEmMaos ? 'text-red-400' : 'text-zinc-200'
                    }`}>
                      {(Number(valorContado) - resumoFechamento.caixaEmMaos).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                )}
              </div>

              <button className="w-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 h-11 rounded-xl text-xs font-bold tracking-widest uppercase"
                onClick={handleConfirmarFechamento}>
                Encerrar Turno e Salvar
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
