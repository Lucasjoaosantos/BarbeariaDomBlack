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
import { Trash2, Plus, Receipt, RotateCcw, AlertTriangle } from 'lucide-react'
import { SeletorCliente } from '@/components/caixa/SeletorCliente'

interface Cliente {
  id: number
  nome: string
  permite_fiado: boolean
  ativo: boolean
  telefone?: string | null
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

interface Movimentacao {
  id: number
  tipo: string
  valor: string | number
  motivo: string | null
  forma_pagamento: string | null
  profissional: string | null
  created_at: string
  estornada: boolean
}

// Cache em memória para dados estáticos
let _cacheProdutosServicos: ItemVenda[] | null = null
let _cacheClientes: Cliente[] | null = null

export default function CaixaPDVPage() {

  const { usuario, negado } = useGuard('caixa')

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

  // ── CLIENTE: agora usa objeto Cliente direto (não apenas o id) ──────────────
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [saldoFichaAberto, setSaldoFichaAberto] = useState<number>(0)
  const [valorAbatimentoInput, setValorAbatimentoInput] = useState('')

  const [itemSelecionado, setItemSelecionado] = useState('')
  const [quantidadeInput, setQuantidadeInput] = useState(1)
  const [valorTotalInput, setValorTotalInput] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [isProcessando, setIsProcessando] = useState(false)
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])

  // ── PAGAMENTO MISTO ────────────────────────────────────────────────────────
  const [valorPagoAgora, setValorPagoAgora] = useState('')         // quanto o cliente paga agora
  const [formaParteAgora, setFormaParteAgora] = useState('dinheiro') // como paga a parte agora

  // ── ESTORNO ────────────────────────────────────────────────────────────────
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [modalEstorno, setModalEstorno] = useState<Movimentacao | null>(null)
  const [processandoEstorno, setProcessandoEstorno] = useState(false)
  const [mostrarHistorico, setMostrarHistorico] = useState(false)

  const inicializadoRef = useRef(false)

  useEffect(() => {
    if (!usuario || inicializadoRef.current) return
    inicializadoRef.current = true
    inicializarCaixa()
  }, [usuario])

  // Quando o cliente muda, busca saldo da ficha se aplicável
  useEffect(() => {
    if (clienteSelecionado?.permite_fiado) {
      buscarSaldoFichaCliente(clienteSelecionado.id)
    } else {
      setSaldoFichaAberto(0)
      setValorAbatimentoInput('')
    }
  }, [clienteSelecionado])

  const profissionalLogado = usuario?.profissional ?? 'Caixa'
  const proprietarioCaixa = usuario?.proprietarioCaixa ?? 'caixa'

  async function inicializarCaixa(forcarEstaticos = false) {
    setLoading(true)
    try {
      const { data: caixas, error: errCaixa } = await supabase
        .from('controle_caixa')
        .select('id, status, valor_inicial, valor_final, closed_at, proprietario')
        .eq('status', 'aberto')
        .eq('proprietario', proprietarioCaixa)
        .order('id', { ascending: false })
        .limit(1)

      if (errCaixa) throw errCaixa
      const caixaEncontrado = caixas && caixas.length > 0 ? caixas[0] : null
      setCaixaAtivo(caixaEncontrado)

      if (caixaEncontrado) {
        carregarMovimentacoes(caixaEncontrado.id)
      }

      if (!_cacheClientes || forcarEstaticos) {
        const { data: dataClientes } = await supabase
          .from('clientes')
          .select('id, nome, permite_fiado, ativo, telefone')
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
          id: p.id, nome: p.nome, preco_venda: p.preco_venda, tipo: 'produto', estoque: p.estoque
        }))
        const servicosFormatados: ItemVenda[] = (resServicos.data || []).map(s => ({
          id: s.id, nome: s.nome, preco: s.preco, tipo: 'servico'
        }))
        _cacheProdutosServicos = [...produtosFormatados, ...servicosFormatados]
          .sort((a, b) => a.nome.localeCompare(b.nome))
      }
      setItensDisponiveis(_cacheProdutosServicos)

    } catch (err) {
      console.error('Erro na inicialização do PDV:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Carrega movimentações do caixa para o histórico / estorno ─────────────
  async function carregarMovimentacoes(caixaId: number) {
    const { data } = await supabase
      .from('movimentacoes_caixa')
      .select('id, tipo, valor, motivo, forma_pagamento, profissional, created_at, estornada')
      .eq('caixa_id', caixaId)
      .order('created_at', { ascending: false })
      .limit(50)
    setMovimentacoes(data ?? [])
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
        .then(({ data }) => {
          const c = data && data.length > 0 ? data[0] : null
          setCaixaAtivo(c)
          if (c) carregarMovimentacoes(c.id)
        })
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
      // Deixa em branco para o operador informar o valor parcial que o cliente quer pagar
      setValorAbatimentoInput('')
    } catch (err) {
      console.error('Erro ao consultar saldo da ficha:', err)
      setSaldoFichaAberto(0)
      setValorAbatimentoInput('')
    }
  }

  // ── Handler para quando SeletorCliente escolhe um cliente ─────────────────
  function handleSelecionarCliente(cliente: Cliente | null) {
    setClienteSelecionado(cliente)
    // Remove item de ficha do carrinho se trocar de cliente
    setCarrinho(prev => prev.filter(c => c.item.tipo !== 'recebimento_ficha'))
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
      profissional: profissionalLogado,
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

// DEPOIS — com tratamento de duplicata
if (error) {
  // Erro do trigger ou unique index: já existe caixa aberto
  if (
    error.message?.includes('Já existe um caixa aberto') ||
    error.code === '23505' // unique_violation
  ) {
    alert('Já existe um caixa aberto para este usuário. Feche o caixa atual antes de abrir um novo.')
    setModalAbrir(false)
    return
  }
  throw error
}
setCaixaAtivo(data)
carregarMovimentacoes(data.id)
setTrocoInicial(''); setModalAbrir(false)
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
      const movimentacoesData = movs || []
      let dinheiro = 0, pix = 0, cartao = 0, sangria = 0

      movimentacoesData.forEach(m => {
        const valorNum = Number(m.valor) || 0
        const motivoLower = (m.motivo || '').toLowerCase()
        if (motivoLower.includes('[sangria]') || m.tipo === 'saida') { sangria += valorNum; return }
        if (m.tipo === 'estorno') { return } // estornos já estão descontados
        const forma = (m.forma_pagamento || '').toLowerCase()
        if (forma === 'dinheiro' || motivoLower.includes('dinheiro'))   dinheiro += valorNum
        else if (forma === 'pix' || motivoLower.includes('pix'))        pix      += valorNum
        else if (forma === 'cartao' || motivoLower.includes('cart'))    cartao   += valorNum
      })

      const faturamentoGeral = dinheiro + pix + cartao
      const caixaEmMaos = (caixaAtivo.valor_inicial || 0) + dinheiro - sangria
      setResumoFechamento({
        inicial: caixaAtivo.valor_inicial || 0, dinheiro, pix, cartao, sangria,
        totalAtendimentos: movimentacoesData.length, faturamentoGeral, caixaEmMaos
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
      alert('Sangria realizada!')
      setValorSangria(''); setMotivoSangria(''); setModalSangria(false)
      carregarMovimentacoes(caixaAtivo.id)
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

        for (const itemCarrinho of carrinho) {
          if (itemCarrinho.item.tipo === 'produto') {
            const { error } = await supabase.rpc('registrar_venda_segura', {
              p_produto_id: itemCarrinho.item.id, p_quantidade: itemCarrinho.quantidade
            })
            if (error) throw error
          }
        }

        alert('✅ Lançamento na ficha realizado!')

      } else if (formaPagamento === 'misto') {
        // ── PAGAMENTO MISTO: parte agora (dinheiro/pix/cartao) + restante vai pra ficha ──
        if (!clienteSelecionado) { alert('Selecione um cliente para usar pagamento misto (ficha).'); setIsProcessando(false); return }

        const valorPago = Number(valorPagoAgora) || 0
        if (valorPago <= 0) { alert('Informe o valor que o cliente vai pagar agora.'); setIsProcessando(false); return }
        if (valorPago > totalNovosConsumos) { alert('O valor pago agora não pode ser maior que o total do pedido.'); setIsProcessando(false); return }

        const valorNaFicha = totalNovosConsumos - valorPago

        // 1. Registrar a parte paga agora no caixa
        const { error: eMisto1 } = await supabase.from('movimentacoes_caixa').insert({
          caixa_id: idDoCaixaOficial, tipo: 'entrada', valor: valorPago,
          motivo: `[Venda Mista] ${clienteSelecionado.nome} — ${detalhesItens} — Pago agora: R$ ${valorPago.toFixed(2)} (${formaParteAgora.toUpperCase()}) | Restante R$ ${valorNaFicha.toFixed(2)} na ficha`,
          profissional: profissionalLogado, forma_pagamento: formaParteAgora,
          proprietario: proprietarioCaixa
        })
        if (eMisto1) throw eMisto1

        // 2. Lançar o valor total na ficha como consumo (débito)
        const { error: eMisto2 } = await supabase.from('historico_ficha').insert({
          cliente_id: Number(clienteSelecionado.id),
          descricao: `[Consumo Misto] ${detalhesItens}`,
          valor: totalNovosConsumos, forma_pagamento: 'ficha'
        })
        if (eMisto2) throw eMisto2

        // 3. Lançar na ficha o abatimento da parte já paga
        if (valorPago > 0) {
          const { error: eMisto3 } = await supabase.from('historico_ficha').insert({
            cliente_id: Number(clienteSelecionado.id),
            descricao: `[Pagamento Parcial Misto] Pago R$ ${valorPago.toFixed(2)} em ${formaParteAgora.toUpperCase()}`,
            valor: -valorPago, forma_pagamento: formaParteAgora
          })
          if (eMisto3) throw eMisto3
        }

        // 4. Descontar estoque dos produtos
        for (const itemCarrinho of carrinho) {
          if (itemCarrinho.item.tipo === 'produto') {
            const { error } = await supabase.rpc('registrar_venda_segura', {
              p_produto_id: itemCarrinho.item.id, p_quantidade: itemCarrinho.quantidade
            })
            if (error) throw error
          }
        }

        const msgFicha = valorNaFicha > 0
          ? `\n\n📋 Restante de ${fmt(valorNaFicha)} registrado na ficha de ${clienteSelecionado.nome}.`
          : ''
        alert(`✅ Pagamento misto registrado!\n💵 R$ ${valorPago.toFixed(2)} recebido via ${formaParteAgora.toUpperCase()}.${msgFicha}`)

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

      setCarrinho([])
      setClienteSelecionado(null)
      setSaldoFichaAberto(0)
      setValorAbatimentoInput('')
      setFormaPagamento('pix')
      setValorPagoAgora('')
      setFormaParteAgora('dinheiro')
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
      setMovimentacoes([])
    } catch (err: any) { console.error(err); alert(`Erro ao salvar: ${err.message}`) }
  }

  // ── ESTORNO ────────────────────────────────────────────────────────────────
  async function handleConfirmarEstorno() {
    if (!modalEstorno || !caixaAtivo) return
    setProcessandoEstorno(true)
    try {
      // 1. Marcar original como estornada
      const { error: e1 } = await supabase
        .from('movimentacoes_caixa')
        .update({ estornada: true })
        .eq('id', modalEstorno.id)
      if (e1) throw e1

      // 2. Criar movimentação de estorno
      const { error: e2 } = await supabase.from('movimentacoes_caixa').insert({
        caixa_id: caixaAtivo.id,
        tipo: 'estorno',
        valor: modalEstorno.valor,
        motivo: `[ESTORNO] Ref. MOV#${modalEstorno.id} — ${modalEstorno.motivo ?? ''}`,
        profissional: modalEstorno.profissional,
        forma_pagamento: modalEstorno.forma_pagamento,
        proprietario: proprietarioCaixa,
      })
      if (e2) throw e2

      // 3. Se for PRODUTO, devolver ao estoque via RPC
      const motivo = modalEstorno.motivo ?? ''
      if (motivo.includes('[PRODUTO]')) {
        // Tenta extrair produto do motivo: "1x Nome Produto [PRODUTO]"
        const regex = /(\d+)x ([^[]+)\[PRODUTO\]/gi
        let match
        while ((match = regex.exec(motivo)) !== null) {
          const quantidade = parseInt(match[1])
          const nomeProd = match[2].trim()
          // Busca o produto pelo nome para pegar o id
          const { data: prod } = await supabase
            .from('produtos')
            .select('id, estoque')
            .ilike('nome', nomeProd)
            .maybeSingle()
          if (prod) {
            await supabase
              .from('produtos')
              .update({ estoque: prod.estoque + quantidade })
              .eq('id', prod.id)
          }
        }
      }

      alert('✅ Estorno realizado com sucesso!')
      setModalEstorno(null)
      carregarMovimentacoes(caixaAtivo.id)
    } catch (err: any) {
      console.error(err)
      alert(`Erro ao estornar: ${err.message}`)
    } finally {
      setProcessandoEstorno(false)
    }
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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

          {/* SEÇÃO 1: CLIENTE — agora com barra de pesquisa */}
          <div className="space-y-3">
            <Label className="text-zinc-500 text-[10px] font-bold tracking-wider uppercase">
              1. Identificar Cliente
            </Label>
            <SeletorCliente
              clienteSelecionado={clienteSelecionado}
              onSelecionar={handleSelecionarCliente}
            />

            {clienteSelecionado?.permite_fiado && saldoFichaAberto > 0 && (
              <div className="p-4 bg-zinc-950 border border-amber-500/20 rounded-xl text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white uppercase tracking-wider flex items-center gap-2 text-[10px]">
                    <Receipt size={14} className="text-amber-400" />
                    Ficha em Aberto:
                    <span className="text-amber-400 font-mono">
                      {fmt(saldoFichaAberto)}
                    </span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                    Valor a acertar agora (pode ser parcial)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" step="0.01" placeholder="Ex: 50,00"
                      value={valorAbatimentoInput} onChange={(e) => setValorAbatimentoInput(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-zinc-200 h-10 text-xs rounded-xl" />
                    <Button type="button" size="sm" onClick={handleAdicionarAbatimentoFichaAoCarrinho}
                      className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 text-[10px] h-10 px-4 rounded-xl font-bold tracking-widest uppercase">
                      Incluir
                    </Button>
                  </div>
                  {valorAbatimentoInput && Number(valorAbatimentoInput) > 0 && Number(valorAbatimentoInput) < saldoFichaAberto && (
                    <p className="text-[10px] text-amber-400/80 font-semibold">
                      ⚠️ Ficará pendente: {fmt(saldoFichaAberto - Number(valorAbatimentoInput))}
                    </p>
                  )}
                  {valorAbatimentoInput && Number(valorAbatimentoInput) >= saldoFichaAberto && (
                    <p className="text-[10px] text-emerald-400/80 font-semibold">
                      ✓ Ficha quitada completamente
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO 2: ITENS */}
          <div className="p-4 md:p-5 bg-zinc-950/40 rounded-xl border border-zinc-800/60 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">2. Adicionar Itens ao Pedido</h2>
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
                {clienteSelecionado?.permite_fiado && (
                  <option value="misto">💳 + 📋 Misto (parte agora + resto na ficha)</option>
                )}
              </select>
            </div>

            {/* PAINEL DO PAGAMENTO MISTO */}
            {formaPagamento === 'misto' && (
              <div className="bg-zinc-950 border border-blue-500/20 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                  Pagamento Misto
                </p>
                <p className="text-[10px] text-zinc-500">
                  Total do pedido: <span className="text-zinc-300 font-bold font-mono">{fmt(totalGeralCarrinho)}</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                      Valor pago agora (R$)
                    </Label>
                    <Input
                      type="number" step="0.01" placeholder="Ex: 20,00"
                      value={valorPagoAgora}
                      onChange={(e) => setValorPagoAgora(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 h-10 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                      Como paga a parte
                    </Label>
                    <select
                      value={formaParteAgora}
                      onChange={(e) => setFormaParteAgora(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-zinc-300 focus:outline-none h-10"
                    >
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="cartao">Cartão</option>
                    </select>
                  </div>
                </div>
                {valorPagoAgora && Number(valorPagoAgora) > 0 && (
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest bg-zinc-900 px-3 py-2.5 rounded-lg border border-zinc-800">
                    <span className="text-zinc-500">Vai pra ficha:</span>
                    <span className={`font-mono ${totalGeralCarrinho - Number(valorPagoAgora) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {fmt(Math.max(0, totalGeralCarrinho - Number(valorPagoAgora)))}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button type="submit"
              className="w-full bg-white text-black hover:bg-zinc-200 h-12 rounded-xl text-xs font-bold tracking-widest uppercase transition-all active:scale-[0.99] disabled:opacity-40"
              disabled={isProcessando || !caixaAtivo || carrinho.length === 0}>
              {isProcessando ? 'Processando...' : 'Concluir e Lançar no Caixa'}
            </button>
          </form>

          {/* SEÇÃO 4: HISTÓRICO COM BOTÃO DE ESTORNO */}
          {caixaAtivo && movimentacoes.length > 0 && (
            <div className="pt-4 border-t border-zinc-800/60">
              <button
                type="button"
                onClick={() => setMostrarHistorico(!mostrarHistorico)}
                className="w-full flex items-center justify-between text-[10px] font-bold tracking-widest uppercase text-zinc-500 hover:text-zinc-300 transition-colors mb-3"
              >
                <span>Lançamentos do Turno ({movimentacoes.length})</span>
                <span>{mostrarHistorico ? '▲ Ocultar' : '▼ Ver'}</span>
              </button>

              {mostrarHistorico && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {movimentacoes.map((mov) => {
                    const podeEstornar = mov.tipo === 'entrada' && !mov.estornada
                    const hora = new Date(mov.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <div key={mov.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                          mov.estornada ? 'opacity-40 bg-zinc-800/20' : 'bg-zinc-800/40 hover:bg-zinc-800/60'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug truncate ${mov.estornada ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
                            {mov.motivo ?? '—'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-zinc-600">{hora}</span>
                            {mov.forma_pagamento && <span className="text-[10px] text-zinc-600 uppercase">· {mov.forma_pagamento}</span>}
                            {mov.estornada && <span className="text-[10px] text-amber-500/80 font-medium">· ESTORNADO</span>}
                          </div>
                        </div>
                        <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${
                          mov.estornada ? 'text-zinc-600' :
                          mov.tipo === 'entrada' ? 'text-green-400' :
                          mov.tipo === 'estorno' ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {mov.tipo === 'entrada' ? '+' : '-'}
                          {fmt(Number(mov.valor))}
                        </span>
                        {podeEstornar && (
                          <button
                            type="button"
                            onClick={() => setModalEstorno(mov)}
                            title="Estornar lançamento"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-amber-400 hover:bg-amber-400/10 transition-colors flex-shrink-0"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
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
                  ['(+) Troco Inicial', resumoFechamento.inicial],
                  ['Faturamento Dinheiro', resumoFechamento.dinheiro],
                  ['Faturamento Pix', resumoFechamento.pix],
                  ['Faturamento Cartão', resumoFechamento.cartao],
                ].map(([label, valor]) => (
                  <div key={label as string} className="flex justify-between text-zinc-500">
                    <span>{label as string}</span>
                    <span className="text-zinc-300 font-bold font-mono">{fmt(valor as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-red-400">
                  <span>(-) Total Sangrias</span>
                  <span className="font-bold font-mono">{fmt(resumoFechamento.sangria)}</span>
                </div>
                <div className="h-px bg-zinc-800 my-1" />
                <div className="flex justify-between text-zinc-200 font-bold">
                  <span>Faturamento Geral</span>
                  <span className="font-mono">{fmt(resumoFechamento.faturamentoGeral)}</span>
                </div>
                <div className={`flex justify-between px-3.5 py-3 rounded-xl border font-black text-[12px] ${
                  resumoFechamento.caixaEmMaos < 0 ? 'bg-red-950/40 border-red-800/50' : 'bg-zinc-950 border-zinc-800/80'
                }`}>
                  <span className="text-white">💵 Dinheiro Físico em Caixa</span>
                  <span className={`font-mono ${resumoFechamento.caixaEmMaos < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {fmt(resumoFechamento.caixaEmMaos)}
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
                      {fmt(Number(valorContado) - resumoFechamento.caixaEmMaos)}
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

      {/* MODAL ESTORNO */}
      <Dialog open={!!modalEstorno} onOpenChange={(open) => { if (!open) setModalEstorno(null) }}>
        <DialogContent className="border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md text-white rounded-2xl max-w-sm p-6 shadow-2xl">
          <DialogHeader className="border-b border-zinc-800/60 pb-4">
            <DialogTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
              <RotateCcw size={14} className="text-amber-400" />
              Estornar Lançamento
            </DialogTitle>
          </DialogHeader>
          {modalEstorno && (
            <div className="mt-4 space-y-4">
              {/* Aviso */}
              <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">
                  {modalEstorno.motivo?.includes('[PRODUTO]')
                    ? 'O valor será estornado e os produtos voltarão ao estoque.'
                    : 'O valor será estornado do caixa. Nenhum estoque será alterado.'}
                </p>
              </div>

              {/* Detalhes */}
              <div className="bg-zinc-800/60 rounded-xl px-4 py-3 space-y-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Detalhes</p>
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-400">Valor</span>
                  <span className="text-sm font-bold text-white">{fmt(Number(modalEstorno.valor))}</span>
                </div>
                {modalEstorno.forma_pagamento && (
                  <div className="flex justify-between">
                    <span className="text-xs text-zinc-400">Pagamento</span>
                    <span className="text-xs text-zinc-300 uppercase">{modalEstorno.forma_pagamento}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-400">Tipo</span>
                  <span className={`text-xs font-semibold ${modalEstorno.motivo?.includes('[PRODUTO]') ? 'text-blue-400' : 'text-purple-400'}`}>
                    {modalEstorno.motivo?.includes('[PRODUTO]') ? 'Produto (devolve estoque)' : 'Serviço (só valor)'}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setModalEstorno(null)}
                  disabled={processandoEstorno}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarEstorno}
                  disabled={processandoEstorno}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} />
                  {processandoEstorno ? 'Processando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
