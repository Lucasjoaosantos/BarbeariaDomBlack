/* eslint-disable no-console */
'use client'

import React, { useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
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
  saldo_ficha?: number
}

interface Caixa {
  id: number
  status: string
  valor_inicial: number
  valor_final?: number
  closed_at?: string
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

export default function CaixaPDVPage() {
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
  const [totalSangria, setTotalSangria] = useState(0)

  const [trocoInicial, setTrocoInicial] = useState('')
  const [resumoFechamento, setResumoFechamento] = useState<ResumoFechamento | null>(null)

  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [saldoFichaAberto, setSaldoFichaAberto] = useState<number>(0)
  const [valorAbatimentoInput, setValorAbatimentoInput] = useState('')

  const [itemSelecionado, setItemSelecionado] = useState('')
  const [profissionalResponsavel, setProfissionalResponsavel] = useState('[Geral]')
  const [quantidadeInput, setQuantidadeInput] = useState(1)
  const [valorTotalInput, setValorTotalInput] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [isProcessando, setIsProcessando] = useState(false)

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])

  useEffect(() => {
    inicializarCaixa()
  }, [])

  async function inicializarCaixa() {
    setLoading(true)
    try {
      const { data: caixas, error: errCaixa } = await supabase
        .from('controle_caixa')
        .select('*')
        .eq('status', 'aberto')
        .order('id', { ascending: false })
        .limit(1)

      if (errCaixa) throw errCaixa
      setCaixaAtivo(caixas && caixas.length > 0 ? caixas[0] : null)

      const { data: dataClientes } = await supabase
        .from('clientes')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true })
      setClientes((dataClientes as Cliente[]) || [])

      const [resProdutos, resServicos] = await Promise.all([
        supabase.from('produtos').select('*'),
        supabase.from('servicos').select('*')
      ])

      const produtosFormatados: ItemVenda[] = (resProdutos.data || []).map(p => ({
        id: p.id,
        nome: p.nome,
        preco_venda: p.preco_venda || p.preco,
        tipo: 'produto',
        estoque: p.estoque
      }))

      const servicosFormatados: ItemVenda[] = (resServicos.data || []).map(s => ({
        id: s.id,
        nome: s.nome,
        preco: s.preco,
        tipo: 'servico'
      }))

      const listaUnificada = [...produtosFormatados, ...servicosFormatados].sort((a, b) =>
        a.nome.localeCompare(b.nome)
      )
      setItensDisponiveis(listaUnificada)

    } catch (err: unknown) {
      console.error("Erro na inicialização do PDV:", err)
    } finally {
      setLoading(false)
    }
  }

  async function buscarSaldoFichaCliente(clienteId: number) {
    try {
      const { data, error } = await supabase
        .from('historico_ficha')
        .select('valor, forma_pagamento')
        .eq('cliente_id', clienteId)

      if (error) throw error

      // BUG 1: Débitos gravados com valor POSITIVO, créditos com valor NEGATIVO
      // Somando todos os valores diretamente dá o saldo devedor correto
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
      setClienteSelecionado(null)
      setSaldoFichaAberto(0)
      setValorAbatimentoInput('')
      return
    }
    const cliente = clientes.find(c => c.id === Number(idSelecionado))
    if (cliente) {
      setClienteSelecionado(cliente)
      if (cliente.permite_fiado) {
        await buscarSaldoFichaCliente(cliente.id)
      } else {
        setSaldoFichaAberto(0)
        setValorAbatimentoInput('')
      }
    }
  }

  function handleMudarItem(nomeItem: string) {
    setItemSelecionado(nomeItem)
    const item = itensDisponiveis.find(i => i.nome === nomeItem)
    if (item) {
      const precoDefinido = item.tipo === 'produto' ? item.preco_venda : item.preco
      setValorTotalInput(Number(precoDefinido || 0).toString())
      if (item.tipo === 'produto') setProfissionalResponsavel('[Geral]')
    } else {
      setValorTotalInput('')
    }
  }

  function handleAdicionarAbatimentoFichaAoCarrinho() {
    const valorParaAbater = Number(valorAbatimentoInput) || 0
    if (!clienteSelecionado || valorParaAbater <= 0) return

    // Impede duplicar item de amortização
    const jaTemAmortizacao = carrinho.some(c => c.item.tipo === 'recebimento_ficha')
    if (jaTemAmortizacao) {
      alert('Já existe um item de amortização de ficha no pedido. Remova-o antes de adicionar outro.')
      return
    }

    const itemFicha: ItemVenda = {
      id: clienteSelecionado.id,
      nome: `Pagamento/Abatimento de Ficha - ${clienteSelecionado.nome}`,
      tipo: 'recebimento_ficha',
      preco: valorParaAbater
    }

    const novoItem: ItemCarrinho = {
      item: itemFicha,
      quantidade: 1,
      profissional: '[Caixa]',
      valorUnitario: valorParaAbater,
      valorTotal: valorParaAbater
    }

    setCarrinho([...carrinho, novoItem])
  }

  function handleAdicionarAoCarrinho() {
    const itemFato = itensDisponiveis.find(i => i.nome === itemSelecionado)
    if (!itemFato) return

    if (itemFato.tipo === 'produto') {
      const estoqueAtual = itemFato.estoque ?? 0
      const jaNoCarrinho = carrinho
        .filter(c => c.item.tipo === 'produto' && c.item.id === itemFato.id)
        .reduce((acc, c) => acc + c.quantidade, 0)

      const totalSolicitado = jaNoCarrinho + quantidadeInput

      if (estoqueAtual <= 0) {
        alert(`⚠️ Produto esgotado! No estoque de "${itemFato.nome}".`)
        return
      }
      if (totalSolicitado > estoqueAtual) {
        alert(`⚠️ Estoque insuficiente! Restam apenas ${estoqueAtual} unidades.`)
        return
      }
    }

    const valorUnitario = Number(valorTotalInput)
    const totalDoItem = valorUnitario * quantidadeInput

    const novoItem: ItemCarrinho = {
      item: itemFato,
      quantidade: quantidadeInput,
      profissional: itemFato.tipo === 'produto' ? '[Geral]' : profissionalResponsavel,
      valorUnitario,
      valorTotal: totalDoItem
    }

    setCarrinho([...carrinho, novoItem])
    setItemSelecionado('')
    setValorTotalInput('')
    setQuantidadeInput(1)
    setProfissionalResponsavel('[Geral]')
  }

  function handleRemoverDoCarrinho(index: number) {
    setCarrinho(carrinho.filter((_, i) => i !== index))
  }

  const totalGeralCarrinho = carrinho.reduce(
    (acc, item) => acc + Number(item.valorTotal || 0),
    0
  )

  async function handleAbrirCaixa() {
    try {
      const { data: caixaExistente } = await supabase
        .from('controle_caixa')
        .select('*')
        .eq('status', 'aberto')
        .maybeSingle()

      if (caixaExistente) {
        alert('Já existe um caixa aberto.')
        setModalAbrir(false)
        // BUG 6: se já existe, carrega ele no estado
        setCaixaAtivo(caixaExistente)
        return
      }

      const { data, error } = await supabase
        .from('controle_caixa')
        .insert({
          valor_inicial: Number(trocoInicial) || 0,
          status: 'aberto'
        })
        .select()
        .single()

      if (error) throw error

      setCaixaAtivo(data)
      setTrocoInicial('')
      setModalAbrir(false)
      alert('Caixa aberto com sucesso!')

    } catch (err: any) {
      console.error(err)
      alert(err.message)
    }
  }

  async function prepararFechamento() {
    if (!caixaAtivo) return

    try {
      const { data: movs, error } = await supabase
        .from('movimentacoes_caixa')
        .select('*')
        .eq('caixa_id', caixaAtivo.id)

      if (error) throw error

      const movimentacoes = movs || []

      let dinheiro = 0
      let pix = 0
      let cartao = 0
      let sangria = 0

      // BUG 7 (cálculo): usa forma_pagamento dedicado, com fallback no motivo
      movimentacoes.forEach(m => {
        const valorNum = Number(m.valor) || 0
        const motivoLower = (m.motivo || '').toLowerCase()

        if (motivoLower.includes('[sangria]') || m.tipo === 'saida') {
          sangria += valorNum
          return
        }

        // Prioridade: campo forma_pagamento direto
        const forma = (m.forma_pagamento || '').toLowerCase()
        if (forma === 'dinheiro' || motivoLower.includes('dinheiro'))      dinheiro += valorNum
        else if (forma === 'pix' || motivoLower.includes('pix'))           pix      += valorNum
        else if (forma === 'cartao' || motivoLower.includes('cart'))       cartao   += valorNum
      })

      setTotalSangria(sangria)

      // Dinheiro físico em caixa = troco inicial + dinheiro recebido - sangrias
      // (Sangria sempre sai do dinheiro físico em barbearia)
      const faturamentoGeral = dinheiro + pix + cartao
      const caixaEmMaos = (caixaAtivo.valor_inicial || 0) + dinheiro - sangria

      setResumoFechamento({
        inicial: caixaAtivo.valor_inicial || 0,
        dinheiro,
        pix,
        cartao,
        sangria,
        totalAtendimentos: movimentacoes.length,
        faturamentoGeral,
        caixaEmMaos
      })

      setValorContado('')
      setModalFechar(true)

    } catch (err) {
      console.error(err)
      alert('Erro ao processar dados de fechamento.')
    }
  }

  async function handleSangria() {
    if (!caixaAtivo || caixaAtivo.status !== 'aberto') {
      alert('Caixa fechado.')
      return
    }

    const valor = Number(valorSangria)

    if (valor <= 0) {
      alert('Informe um valor válido.')
      return
    }

    try {
      const { error } = await supabase
        .from('movimentacoes_caixa')
        .insert({
          caixa_id: caixaAtivo.id,
          tipo: 'saida',
          valor,
          motivo: `[SANGRIA] ${motivoSangria || 'Retirada de caixa'}`
        })

      if (error) throw error

      alert('Sangria realizada com sucesso!')
      setValorSangria('')
      setMotivoSangria('')
      setModalSangria(false)

    } catch (err: any) {
      alert(`Erro na sangria: ${err.message}`)
    }
  }

  async function handleFinalizarVenda(e: React.FormEvent) {
    e.preventDefault()

    if (!caixaAtivo || caixaAtivo.status !== 'aberto') {
      alert('Não existe caixa aberto.')
      return
    }
    if (!caixaAtivo?.id) return
    if (carrinho.length === 0) {
      alert('Seu carrinho está vazio!')
      return
    }

    setIsProcessando(true)
    const idDoCaixaOficial = Number(caixaAtivo.id)

    try {
      const detalhesItens = carrinho.map(c => {
        let sufixo = '[SERVIÇO]'
        if (c.item.tipo === 'produto') sufixo = '[PRODUTO]'
        if (c.item.tipo === 'recebimento_ficha') sufixo = '[PAGAMENTO FICHA]'
        return `${c.quantidade}x ${c.item.nome} ${sufixo}`
      }).join(', ')

      const totalNovosConsumos = carrinho
        .filter(c => c.item.tipo !== 'recebimento_ficha')
        .reduce((acc, c) => acc + c.valorTotal, 0)

      const totalPAGODaFichaAntiga = carrinho
        .filter(c => c.item.tipo === 'recebimento_ficha')
        .reduce((acc, c) => acc + c.valorTotal, 0)

      // ── FORMA: FICHA (marcar na caderneta) ───────────────────────────────
      if (formaPagamento === 'ficha') {
        if (!clienteSelecionado) {
          alert('Selecione um cliente válido para usar a ficha.')
          setIsProcessando(false)
          return
        }

        // Lança o consumo novo como débito na ficha
        if (totalNovosConsumos > 0) {
          const { error: errFichaDebito } = await supabase
            .from('historico_ficha')
            .insert({
              cliente_id: Number(clienteSelecionado.id),
              descricao: `[Consumo Fiado] ${detalhesItens}`,
              valor: totalNovosConsumos,
              forma_pagamento: 'ficha'
            })
          if (errFichaDebito) throw errFichaDebito
        }

        // Se também havia amortização pendente no carrinho, baixa da ficha
        if (totalPAGODaFichaAntiga > 0) {
          const { error: errFichaCredito } = await supabase
            .from('historico_ficha')
            .insert({
              cliente_id: Number(clienteSelecionado.id),
              descricao: `[Abatimento interno via Ficha]`,
              valor: -totalPAGODaFichaAntiga,
              forma_pagamento: 'pago_caixa'
            })
          if (errFichaCredito) throw errFichaCredito
        }

        // Grava também em movimentacoes_caixa para o card "Consumo em Ficha" do relatório
        // Sem isso o card fica zerado pois o relatório só lê movimentacoes_caixa
        if (totalNovosConsumos > 0) {
          const { error: errCaixaFicha } = await supabase
            .from('movimentacoes_caixa')
            .insert({
              caixa_id: idDoCaixaOficial,
              tipo: 'entrada',
              valor: totalNovosConsumos,
              motivo: `[Consumo Fiado] ${clienteSelecionado.nome} — ${detalhesItens}`,
              profissional: (() => {
                const p = carrinho.find(c => c.item.tipo !== 'recebimento_ficha')
                  ?.profissional?.replace(/[\[\]]/g, '').trim() || 'Caixa'
                return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
              })(),
              forma_pagamento: 'ficha'   // ← isso alimenta o card "Consumo em Ficha" no relatório
            })
          if (errCaixaFicha) throw errCaixaFicha
        }

        // BUG 3: alert de sucesso também para o fluxo de ficha
        alert('✅ Lançamento na ficha realizado com sucesso!')

      // ── DEMAIS FORMAS (pix, dinheiro, cartão) ─────────────────────────
      } else {

        // PASSO 1: Salva no caixa APENAS os itens de serviço e produto
        // (recebimento_ficha NÃO entra no caixa — vai só para o historico_ficha)
        for (const itemCarrinho of carrinho) {
          // Pula itens de acerto de ficha — tratados separadamente abaixo
          if (itemCarrinho.item.tipo === 'recebimento_ficha') continue

          const sufixo = itemCarrinho.item.tipo === 'produto' ? '[PRODUTO]' : '[SERVIÇO]'

          // Converte profissional para Title Case: "[GABRIEL]" → "Gabriel"
          const profBruto = itemCarrinho.profissional
            .replace(/\[/g, '').replace(/\]/g, '').trim()
          const profTitleCase = profBruto.charAt(0).toUpperCase() + profBruto.slice(1).toLowerCase()

          const motivoItem = `[Venda] ${itemCarrinho.quantidade}x ${itemCarrinho.item.nome} ${sufixo} - Cliente: ${
            clienteSelecionado?.nome || 'Cliente Final'
          } - Profissional: [${profTitleCase}] - Forma: ${formaPagamento.toUpperCase()}`

          const { error: errCaixaMov } = await supabase
            .from('movimentacoes_caixa')
            .insert({
              caixa_id: idDoCaixaOficial,
              tipo: 'entrada',
              valor: itemCarrinho.valorTotal,
              motivo: motivoItem,
              profissional: profTitleCase,    // "Gabriel" / "Eduardo" / "Caixa" / "Geral"
              forma_pagamento: formaPagamento // campo dedicado para o relatório
            })

          if (errCaixaMov) throw errCaixaMov
        }

        // PASSO 2: Se havia acerto de ficha no carrinho, grava nos DOIS lugares:
        if (totalPAGODaFichaAntiga > 0 && clienteSelecionado) {

          // 2A — historico_ficha: crédito negativo que reduz a dívida do cliente
          const { error: errFichaAcerto } = await supabase
            .from('historico_ficha')
            .insert({
              cliente_id: Number(clienteSelecionado.id),
              descricao: `[Acerto via Caixa] Pago em ${formaPagamento.toUpperCase()} — R$ ${totalPAGODaFichaAntiga.toFixed(2)}`,
              valor: -totalPAGODaFichaAntiga, // NEGATIVO = crédito, reduz a dívida
              forma_pagamento: formaPagamento
            })
          if (errFichaAcerto) throw errFichaAcerto

          // 2B — movimentacoes_caixa: entrada positiva com a forma de pagamento real
          // Isso faz o valor aparecer no fechamento de caixa e no card Financeiro do relatório
          const { error: errCaixaFicha } = await supabase
            .from('movimentacoes_caixa')
            .insert({
              caixa_id: idDoCaixaOficial,
              tipo: 'entrada',
              valor: totalPAGODaFichaAntiga,
              motivo: `[Acerto via Caixa] ${clienteSelecionado.nome} — pago em ${formaPagamento.toUpperCase()}`,
              profissional: 'Caixa',
              forma_pagamento: formaPagamento
            })
          if (errCaixaFicha) throw errCaixaFicha
        }

        // Baixa estoque dos produtos vendidos
        for (const itemCarrinho of carrinho) {
          if (itemCarrinho.item.tipo === 'produto') {
            const { error: erroEstoque } = await supabase.rpc(
              'registrar_venda_segura',
              {
                p_produto_id: itemCarrinho.item.id,
                p_quantidade: itemCarrinho.quantidade
              }
            )
            if (erroEstoque) throw erroEstoque
          }
        }

        // BUG 3: alert de sucesso (estava dentro do else mas faltava no fluxo ficha)
        alert('✅ Operação finalizada com sucesso!')
      }

      // Limpa o PDV após sucesso (qualquer forma de pagamento)
      setCarrinho([])
      setClienteSelecionado(null)
      setSaldoFichaAberto(0)
      setValorAbatimentoInput('')
      setFormaPagamento('pix')
      inicializarCaixa()

    } catch (err: any) {
      console.error(err)
      alert(`Erro no lançamento: ${err.message}`)
    } finally {
      setIsProcessando(false)
    }
  }

  async function handleConfirmarFechamento() {
    if (!caixaAtivo || !resumoFechamento) return

    if (!valorContado) {
      alert('Informe o valor contado fisicamente.')
      return
    }

    try {
      const valorContadoNumero = Number(valorContado)
      const diferencaCaixa = valorContadoNumero - resumoFechamento.caixaEmMaos

      // BUG 6: atualiza o banco E só zera o estado local após confirmar sucesso
      const { error } = await supabase
        .from('controle_caixa')
        .update({
          status: 'fechado',
          valor_final: resumoFechamento.caixaEmMaos,
          valor_contado: valorContadoNumero,
          diferenca_caixa: diferencaCaixa,
          closed_at: new Date().toISOString()
        })
        .eq('id', caixaAtivo.id)

      if (error) throw error  // BUG 6: se falhar, não zera o estado

      alert('✅ Caixa encerrado com sucesso!')

      // Só zera depois que o banco confirmou
      setModalFechar(false)
      setCaixaAtivo(null)
      setResumoFechamento(null)
      setValorContado('')

    } catch (err: any) {
      console.error(err)
      alert(`Erro ao salvar encerramento: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-black text-zinc-500 items-center justify-center text-xs tracking-widest uppercase font-bold">
        Carregando dados do caixa...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-white font-sans antialiased selection:bg-white selection:text-black">
      <Sidebar />

      {/* BUG 8: layout responsivo — sidebar some em mobile, padding menor */}
<main className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full pt-20 md:pt-8">

        {/* TOPO COM STATUS DE OPERAÇÃO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 border-b border-zinc-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-widest uppercase">Frente de Caixa</h1>
            <p className={`text-xs tracking-wider uppercase mt-1.5 font-bold ${caixaAtivo ? 'text-emerald-400' : 'text-rose-400/80'}`}>
              {caixaAtivo ? `✓ Caixa ID ${caixaAtivo.id} em operação` : '⚠️ Caixa Fechado'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!caixaAtivo ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setModalAbrir(true)}
                className="bg-white text-black hover:bg-zinc-200 text-xs font-bold tracking-widest uppercase h-10 px-5 rounded-xl"
              >
                Abrir Caixa
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={() => setModalSangria(true)}
                  className="bg-red-900 hover:bg-red-800 text-white text-xs font-bold tracking-widest uppercase h-10 px-4 rounded-xl border border-red-700"
                >
                  Sangria
                </Button>
                <Button
                  size="sm"
                  onClick={prepararFechamento}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold tracking-widest uppercase h-10 px-4 rounded-xl border border-zinc-800"
                >
                  Fechar Caixa
                </Button>
              </>
            )}
          </div>
        </div>

        {/* PAINEL CENTRAL DO PDV */}
        <div className="space-y-5 bg-zinc-900/30 p-5 md:p-8 rounded-2xl border border-zinc-800/80 backdrop-blur-md shadow-xl">

          {/* SEÇÃO 1: IDENTIFICAR CLIENTE */}
          <div className="space-y-3">
            <div>
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
            </div>

            {/* Painel de Amortização da Ficha */}
            {clienteSelecionado && clienteSelecionado.permite_fiado && saldoFichaAberto > 0 && (
              <div className="p-4 bg-zinc-950 border border-amber-500/20 rounded-xl text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white uppercase tracking-wider flex items-center gap-2 text-[10px]">
                    <Receipt size={14} className="text-amber-400" />
                    Ficha em Aberto:
                    <span className="text-amber-400 font-mono">
                      {saldoFichaAberto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </p>
                  <span className="text-[9px] text-zinc-500 tracking-widest uppercase font-bold">Acerto</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Valor do acerto..."
                      value={valorAbatimentoInput}
                      onChange={(e) => setValorAbatimentoInput(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-zinc-200 h-10 text-xs rounded-xl focus-visible:ring-zinc-700"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAdicionarAbatimentoFichaAoCarrinho}
                    className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 text-[10px] h-10 px-4 rounded-xl font-bold tracking-widest uppercase transition-all"
                  >
                    Incluir
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO 2: SELEÇÃO DE NOVOS ITENS */}
          <div className="p-4 md:p-5 bg-zinc-950/40 rounded-xl border border-zinc-800/60 space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">2. Adicionar Itens ao Pedido</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="itens" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">O que foi consumido?</Label>
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

              <div className="space-y-1.5">
                <Label htmlFor="profissional" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Profissional Responsável</Label>
                <select
                  id="profissional"
                  value={profissionalResponsavel}
                  onChange={(e) => setProfissionalResponsavel(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-xs font-semibold text-zinc-300 focus:outline-none focus:border-zinc-700 transition-colors"
                  disabled={!caixaAtivo || itensDisponiveis.find(i => i.nome === itemSelecionado)?.tipo === 'produto'}
                >
                  <option value="[Caixa]">Operador do Caixa</option>
                  <option value="[Gabriel]">Barber Gabriel</option>
                  <option value="[Eduardo]">Barber Eduardo</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="qtd" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Quantidade</Label>
                <Input
                  id="qtd"
                  type="number"
                  min="1"
                  value={quantidadeInput}
                  onChange={(e) => setQuantidadeInput(Math.max(1, Number(e.target.value)))}
                  className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700"
                  disabled={!caixaAtivo || !itemSelecionado}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="totalInput" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Preço Unitário (R$)</Label>
                <Input
                  id="totalInput"
                  type="number"
                  step="0.01"
                  value={valorTotalInput}
                  onChange={(e) => setValorTotalInput(e.target.value)}
                  placeholder="0,00"
                  className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700"
                  disabled={!caixaAtivo || !itemSelecionado}
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleAdicionarAoCarrinho}
              disabled={!itemSelecionado || !caixaAtivo}
              className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 text-xs h-11 rounded-xl font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Plus size={14} /> Incluir no Pedido
            </Button>
          </div>

          {/* LISTA DO CARRINHO */}
          {carrinho.length > 0 && (
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/20">
              <div className="bg-zinc-950 px-4 py-3 text-[10px] font-bold text-zinc-500 tracking-widest uppercase border-b border-zinc-800/60">
                Itens Adicionados
              </div>
              <ul className="divide-y divide-zinc-800/40 max-h-48 overflow-y-auto">
                {carrinho.map((c, index) => (
                  <li key={index} className="px-4 md:px-5 py-3.5 flex items-center justify-between text-xs hover:bg-zinc-900/10 transition-colors">
                    <div className="space-y-0.5 flex-1 min-w-0 pr-4">
                      <p className="font-bold text-zinc-200 tracking-wide truncate">
                        {c.item.tipo !== 'recebimento_ficha' && `${c.quantidade}x `}
                        {c.item.nome}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-semibold tracking-wide uppercase">
                        {Number(c.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | {c.profissional}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-bold text-zinc-200 font-mono">
                        {c.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoverDoCarrinho(index)}
                        className="text-zinc-600 hover:text-zinc-400 transition-colors"
                      >
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

          {/* SEÇÃO 3: FINALIZAÇÃO */}
          <form onSubmit={handleFinalizarVenda} className="space-y-4 pt-4 border-t border-zinc-800/60">
            <div>
              <Label htmlFor="pagamento" className="text-zinc-400 text-[10px] font-bold tracking-wider uppercase">
                3. Escolha a forma de pagamento
              </Label>
              <select
                id="pagamento"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-xs font-semibold text-zinc-300 focus:outline-none focus:border-zinc-700 transition-colors"
                disabled={!caixaAtivo || carrinho.length === 0}
              >
                <option value="pix">Pagar via Pix</option>
                <option value="dinheiro">Pagar em Dinheiro</option>
                <option value="cartao">Pagar via Cartão</option>
                {clienteSelecionado?.permite_fiado && (
                  <option value="ficha">Marcar / Adicionar saldo restante na Ficha</option>
                )}
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-white text-black hover:bg-zinc-200 h-12 rounded-xl text-xs font-bold tracking-widest uppercase transition-all active:scale-[0.99] disabled:opacity-40"
              disabled={isProcessando || !caixaAtivo || carrinho.length === 0}
            >
              {isProcessando ? 'Processando Lançamento...' : 'Concluir e Lançar no Caixa'}
            </button>
          </form>
        </div>
      </main>

      {/* MODAL: ABERTURA DE CAIXA */}
      <Dialog open={modalAbrir} onOpenChange={setModalAbrir}>
        <DialogContent className="border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md text-white rounded-2xl max-w-sm p-6 shadow-2xl">
          <DialogHeader className="border-b border-zinc-800/60 pb-4">
            <DialogTitle className="text-sm font-black tracking-widest uppercase text-zinc-100">
              Abrir Caixa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                Troco Inicial (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={trocoInicial}
                onChange={(e) => setTrocoInicial(e.target.value)}
                placeholder="0,00"
                className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700"
              />
            </div>

            <button
              className="w-full bg-white text-black hover:bg-zinc-200 h-11 rounded-xl text-xs font-black uppercase tracking-widest"
              onClick={handleAbrirCaixa}
            >
              Confirmar Abertura
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: SANGRIA */}
      <Dialog open={modalSangria} onOpenChange={setModalSangria}>
        <DialogContent className="border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md text-white rounded-2xl max-w-sm p-6 shadow-2xl">
          <DialogHeader className="border-b border-zinc-800/60 pb-4">
            <DialogTitle className="text-sm font-black tracking-widest uppercase text-zinc-100">
              Realizar Sangria
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                Valor da Sangria (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={valorSangria}
                onChange={(e) => setValorSangria(e.target.value)}
                placeholder="0,00"
                className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                Motivo
              </Label>
              <Input
                value={motivoSangria}
                onChange={(e) => setMotivoSangria(e.target.value)}
                placeholder="Ex: Retirada fornecedor..."
                className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700"
              />
            </div>

            <button
              className="w-full bg-red-600 hover:bg-red-500 text-white h-11 rounded-xl text-xs font-bold tracking-widest uppercase transition-all"
              onClick={handleSangria}
            >
              Confirmar Sangria
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: FECHAMENTO DE CAIXA — BUG 7: layout completamente refeito */}
      <Dialog open={modalFechar} onOpenChange={setModalFechar}>
        <DialogContent className="border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md text-white rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader className="border-b border-zinc-800/60 pb-4">
            <DialogTitle className="text-sm font-black tracking-widest uppercase text-zinc-100">
              Resumo do Fechamento
            </DialogTitle>
          </DialogHeader>

          {resumoFechamento && (
            <div className="mt-4 space-y-4">

              {/* Linhas do resumo */}
              <div className="space-y-2 text-[11px] font-semibold tracking-wider uppercase">
                <div className="flex justify-between text-zinc-500">
                  <span>(+) Troco Inicial</span>
                  <span className="text-zinc-300 font-bold font-mono">
                    {resumoFechamento.inicial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <div className="flex justify-between text-zinc-500">
                  <span>Faturamento Dinheiro</span>
                  <span className="text-zinc-300 font-bold font-mono">
                    {resumoFechamento.dinheiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <div className="flex justify-between text-zinc-500">
                  <span>Faturamento Pix</span>
                  <span className="text-zinc-300 font-bold font-mono">
                    {resumoFechamento.pix.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <div className="flex justify-between text-zinc-500">
                  <span>Faturamento Cartão</span>
                  <span className="text-zinc-300 font-bold font-mono">
                    {resumoFechamento.cartao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <div className="flex justify-between text-red-400">
                  <span>(-) Total Sangrias</span>
                  <span className="font-bold font-mono">
                    {resumoFechamento.sangria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <div className="h-px bg-zinc-800 my-1" />

                <div className="flex justify-between text-zinc-200 font-bold">
                  <span>Faturamento Geral (Pix + Cartão + Dinheiro)</span>
                  <span className="font-mono">
                    {resumoFechamento.faturamentoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                {/* BUG 7: exibe aviso se dinheiro em caixa for negativo (sangria > dinheiro disponível) */}
                <div className={`flex justify-between px-3.5 py-3 rounded-xl border font-black text-[12px] ${
                  resumoFechamento.caixaEmMaos < 0
                    ? 'bg-red-950/40 border-red-800/50'
                    : 'bg-zinc-950 border-zinc-800/80'
                }`}>
                  <span className="text-white">💵 Dinheiro Físico em Caixa</span>
                  <span className={`font-mono ${resumoFechamento.caixaEmMaos < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {resumoFechamento.caixaEmMaos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                {resumoFechamento.caixaEmMaos < 0 && (
                  <p className="text-[10px] text-red-400/80 font-semibold tracking-wide px-1">
                    ⚠️ Total de sangrias superior ao dinheiro em caixa. Verifique os lançamentos.
                  </p>
                )}
              </div>

              {/* Input de conferência */}
              <div className="border-t border-zinc-800/60 pt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                    Valor contado fisicamente (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={valorContado}
                    onChange={(e) => setValorContado(e.target.value)}
                    placeholder="0,00"
                    className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700"
                  />
                </div>

                {/* Diferença calculada em tempo real */}
                {valorContado !== '' && (
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest bg-zinc-950 px-3.5 py-3 rounded-xl border border-zinc-800/60">
                    <span className="text-zinc-500">Diferença:</span>
                    <span className={`font-mono ${
                      Number(valorContado) > resumoFechamento.caixaEmMaos
                        ? 'text-emerald-400'
                        : Number(valorContado) < resumoFechamento.caixaEmMaos
                        ? 'text-red-400'
                        : 'text-zinc-200'
                    }`}>
                      {(Number(valorContado) - resumoFechamento.caixaEmMaos).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </span>
                  </div>
                )}
              </div>

              <button
                className="w-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 h-11 rounded-xl text-xs font-bold tracking-widest uppercase transition-all"
                onClick={handleConfirmarFechamento}
              >
                Encerrar Turno e Salvar
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}