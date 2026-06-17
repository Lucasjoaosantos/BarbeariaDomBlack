'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, AlertTriangle, RotateCcw, Package, Scissors } from 'lucide-react'

interface Movimentacao {
  id: number
  tipo: string
  valor: string | number
  motivo: string | null
  forma_pagamento: string | null
  profissional: string | null
  created_at: string
  estornada: boolean
  itens_json?: { nome: string; quantidade: number; tipo: 'produto' | 'servico'; produto_id?: number }[] | null
}

interface ModalEstornoProps {
  movimentacao: Movimentacao | null
  onFechar: () => void
  onEstornado: () => void
}

export function ModalEstorno({ movimentacao, onFechar, onEstornado }: ModalEstornoProps) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const supabase = createClient()

  if (!movimentacao) return null

  // Detectar se há produtos na movimentação pelo motivo
  const temProduto = movimentacao.motivo?.includes('[PRODUTO]') ?? false
  const temServico = movimentacao.motivo?.includes('[SERVIÇO]') ?? false
  const itens = movimentacao.itens_json ?? []
  const itensProduto = itens.filter((i) => i.tipo === 'produto')

  // Parsear nome do item a partir do motivo (fallback quando não há itens_json)
  function parsearItemDoMotivo(motivo: string): { nome: string; quantidade: number; tipo: 'produto' | 'servico' }[] {
    // Exemplo: "[VENDA] 1X CORTE [SERVIÇO] - CLIENTE: ..."
    // Exemplo: "[VENDA] 1X HEINEKEN [PRODUTO] - CLIENTE: ..."
    const resultado: { nome: string; quantidade: number; tipo: 'produto' | 'servico' }[] = []
    const regex = /(\d+)X ([^[\]]+)\[(PRODUTO|SERVIÇO)\]/gi
    let match
    while ((match = regex.exec(motivo)) !== null) {
      resultado.push({
        quantidade: parseInt(match[1]),
        nome: match[2].trim(),
        tipo: match[3].toUpperCase() === 'PRODUTO' ? 'produto' : 'servico',
      })
    }
    return resultado
  }

  const itensParsed = itens.length > 0 ? itens : parsearItemDoMotivo(movimentacao.motivo ?? '')
  const itensProdutoParsed = itensParsed.filter((i) => i.tipo === 'produto')

  async function confirmarEstorno() {
    setLoading(true)
    setErro(null)

    try {
      // 1. Marcar movimentação original como estornada
      const { error: erroEstorno } = await supabase
        .from('movimentacoes_caixa')
        .update({ estornada: true })
        .eq('id', movimentacao.id)

      if (erroEstorno) throw erroEstorno

      // 2. Criar movimentação de estorno (saída do valor)
      const { error: erroCriacao } = await supabase
        .from('movimentacoes_caixa')
        .insert({
          caixa_id: await getCaixaAbertoId(),
          tipo: 'estorno',
          valor: movimentacao.valor,
          motivo: `[ESTORNO] Ref. MOV#${movimentacao.id} — ${movimentacao.motivo ?? ''}`,
          profissional: movimentacao.profissional,
          forma_pagamento: movimentacao.forma_pagamento,
          proprietario: 'caixa',
          movimentacao_original_id: movimentacao.id,
        })

      if (erroCriacao) throw erroCriacao

      // 3. Se tiver produtos, devolver ao estoque
      if (itensProdutoParsed.length > 0 && itens.length > 0) {
        for (const item of itensProduto) {
          if (!item.produto_id) continue
          // Buscar estoque atual
          const { data: prod } = await supabase
            .from('produtos')
            .select('estoque')
            .eq('id', item.produto_id)
            .single()

          if (prod) {
            await supabase
              .from('produtos')
              .update({ estoque: (prod.estoque ?? 0) + item.quantidade })
              .eq('id', item.produto_id)
          }
        }
      }

      onEstornado()
      onFechar()
    } catch (e: unknown) {
      console.error(e)
      setErro('Erro ao processar estorno. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function getCaixaAbertoId(): Promise<number> {
    const { data } = await supabase
      .from('caixas')
      .select('id')
      .eq('status', 'aberto')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return data?.id ?? 0
  }

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(movimentacao.valor))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <RotateCcw size={15} className="text-amber-400" />
            <h2 className="text-sm font-bold tracking-wider uppercase text-white">
              Estornar Lançamento
            </h2>
          </div>
          <button
            onClick={onFechar}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="px-5 py-5 space-y-4">
          {/* Aviso */}
          <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              Esta ação irá estornar o lançamento e{' '}
              <strong>
                {itensProdutoParsed.length > 0 && itens.length > 0
                  ? 'devolver os produtos ao estoque'
                  : 'apenas reverter o valor no caixa'}
              </strong>
              . Não pode ser desfeita.
            </p>
          </div>

          {/* Detalhes da movimentação */}
          <div className="bg-zinc-800/60 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1">
              Detalhes do lançamento
            </p>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">Valor</span>
              <span className="text-sm font-bold text-white">{valorFormatado}</span>
            </div>
            {movimentacao.forma_pagamento && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Pagamento</span>
                <span className="text-xs text-zinc-300 uppercase">{movimentacao.forma_pagamento}</span>
              </div>
            )}
            {movimentacao.profissional && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Profissional</span>
                <span className="text-xs text-zinc-300">{movimentacao.profissional}</span>
              </div>
            )}
          </div>

          {/* Itens detectados */}
          {itensParsed.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                Itens detectados
              </p>
              {itensParsed.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-zinc-800/40 rounded-lg px-3 py-2"
                >
                  {item.tipo === 'produto' ? (
                    <Package size={12} className="text-blue-400 flex-shrink-0" />
                  ) : (
                    <Scissors size={12} className="text-purple-400 flex-shrink-0" />
                  )}
                  <span className="text-xs text-zinc-300">
                    {item.quantidade}x {item.nome}
                  </span>
                  <span
                    className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                      item.tipo === 'produto'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-purple-500/15 text-purple-400'
                    }`}
                  >
                    {item.tipo === 'produto' ? 'Volta ao estoque' : 'Sem devolução'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Erro */}
          {erro && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}
        </div>

        {/* Botões */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onFechar}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmarEstorno}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} />
            {loading ? 'Processando...' : 'Confirmar Estorno'}
          </button>
        </div>
      </div>
    </div>
  )
}
