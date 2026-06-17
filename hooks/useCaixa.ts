'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ItemVenda {
  produto_id?: number
  nome: string
  quantidade: number
  preco_unitario: number
  tipo: 'produto' | 'servico'
}

export interface Cliente {
  id: number
  nome: string
  telefone: string | null
  permite_fiado: boolean
  saldo_ficha: number
}

export interface Movimentacao {
  id: number
  tipo: string
  valor: string | number
  motivo: string | null
  forma_pagamento: string | null
  profissional: string | null
  created_at: string
  estornada: boolean
  itens_json?: ItemVenda[] | null
  cliente_nome?: string | null
}

export function useCaixa(caixaId: number | null) {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const supabase = createClient()

  const carregarMovimentacoes = useCallback(async () => {
    if (!caixaId) return
    setCarregando(true)
    try {
      const { data } = await supabase
        .from('movimentacoes_caixa')
        .select('*')
        .eq('caixa_id', caixaId)
        .order('created_at', { ascending: false })
      setMovimentacoes(data ?? [])
    } finally {
      setCarregando(false)
    }
  }, [caixaId])

  useEffect(() => {
    carregarMovimentacoes()
  }, [carregarMovimentacoes])

  /**
   * Lança uma venda no caixa.
   * Agora salva itens_json e cliente_nome para permitir estorno completo.
   */
  async function lancarVenda(params: {
    itens: ItemVenda[]
    cliente: Cliente | null
    formaPagamento: string
    profissional: string
    totalDesconto?: number
  }) {
    const { itens, cliente, formaPagamento, profissional, totalDesconto = 0 } = params

    const total =
      itens.reduce((acc, i) => acc + i.preco_unitario * i.quantidade, 0) - totalDesconto

    const clienteNome = cliente?.nome ?? 'AVULSO'
    const itensMotivoStr = itens
      .map((i) => `${i.quantidade}X ${i.nome.toUpperCase()} [${i.tipo === 'produto' ? 'PRODUTO' : 'SERVIÇO'}]`)
      .join(', ')

    const motivo = `[VENDA] ${itensMotivoStr} - CLIENTE: ${clienteNome.toUpperCase()} - PROFISSIONAL: ${profissional.toUpperCase()} - FORMA: ${formaPagamento.toUpperCase()}`

    const { data, error } = await supabase
      .from('movimentacoes_caixa')
      .insert({
        caixa_id: caixaId,
        tipo: 'entrada',
        valor: total,
        motivo,
        profissional: profissional.toUpperCase(),
        forma_pagamento: formaPagamento,
        proprietario: 'caixa',
        cliente_nome: clienteNome,
        itens_json: itens,
      })
      .select()
      .single()

    if (error) throw error

    // Baixar estoque dos produtos
    for (const item of itens) {
      if (item.tipo === 'produto' && item.produto_id) {
        const { data: prod } = await supabase
          .from('produtos')
          .select('estoque')
          .eq('id', item.produto_id)
          .single()

        if (prod) {
          await supabase
            .from('produtos')
            .update({ estoque: Math.max(0, prod.estoque - item.quantidade) })
            .eq('id', item.produto_id)
        }
      }
    }

    await carregarMovimentacoes()
    return data
  }

  /**
   * Estorna uma movimentação.
   * Se tiver produtos (via itens_json), devolve ao estoque.
   */
  async function estornarMovimentacao(movimentacao: Movimentacao) {
    // 1. Marcar original como estornada
    const { error: erroUpdate } = await supabase
      .from('movimentacoes_caixa')
      .update({ estornada: true })
      .eq('id', movimentacao.id)

    if (erroUpdate) throw erroUpdate

    // 2. Criar movimentação de estorno
    const { error: erroInsert } = await supabase
      .from('movimentacoes_caixa')
      .insert({
        caixa_id: caixaId,
        tipo: 'estorno',
        valor: movimentacao.valor,
        motivo: `[ESTORNO] Ref. MOV#${movimentacao.id} — ${movimentacao.motivo ?? ''}`,
        profissional: movimentacao.profissional,
        forma_pagamento: movimentacao.forma_pagamento,
        proprietario: 'caixa',
        movimentacao_original_id: movimentacao.id,
        cliente_nome: movimentacao.cliente_nome,
      })

    if (erroInsert) throw erroInsert

    // 3. Devolver produtos ao estoque se houver itens_json
    const itensProduto = (movimentacao.itens_json ?? []).filter((i) => i.tipo === 'produto')
    for (const item of itensProduto) {
      if (!item.produto_id) continue
      const { data: prod } = await supabase
        .from('produtos')
        .select('estoque')
        .eq('id', item.produto_id)
        .single()

      if (prod) {
        await supabase
          .from('produtos')
          .update({ estoque: prod.estoque + item.quantidade })
          .eq('id', item.produto_id)
      }
    }

    await carregarMovimentacoes()
  }

  // Totais do caixa
  const totalEntradas = movimentacoes
    .filter((m) => m.tipo === 'entrada' && !m.estornada)
    .reduce((acc, m) => acc + Number(m.valor), 0)

  const totalEstornos = movimentacoes
    .filter((m) => m.tipo === 'estorno')
    .reduce((acc, m) => acc + Number(m.valor), 0)

  const totalSaidas = movimentacoes
    .filter((m) => (m.tipo === 'saida' || m.tipo === 'sangria') && !m.estornada)
    .reduce((acc, m) => acc + Number(m.valor), 0)

  const saldoAtual = totalEntradas - totalEstornos - totalSaidas

  return {
    movimentacoes,
    carregando,
    carregarMovimentacoes,
    lancarVenda,
    estornarMovimentacao,
    totais: { totalEntradas, totalEstornos, totalSaidas, saldoAtual },
  }
}
