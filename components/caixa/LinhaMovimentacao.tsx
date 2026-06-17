'use client'

import { useState } from 'react'
import { RotateCcw, TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react'
import { ModalEstorno } from './ModalEstorno'

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
  cliente_nome?: string | null
}

interface LinhaMovimentacaoProps {
  movimentacao: Movimentacao
  onEstornado: () => void
}

const ICONES_TIPO: Record<string, React.ReactNode> = {
  entrada: <TrendingUp size={13} className="text-green-400" />,
  saida: <TrendingDown size={13} className="text-red-400" />,
  sangria: <Minus size={13} className="text-orange-400" />,
  suprimento: <Plus size={13} className="text-blue-400" />,
  estorno: <RotateCcw size={13} className="text-amber-400" />,
}

const CORES_VALOR: Record<string, string> = {
  entrada: 'text-green-400',
  saida: 'text-red-400',
  sangria: 'text-orange-400',
  suprimento: 'text-blue-400',
  estorno: 'text-amber-400',
}

const PREFIXO_VALOR: Record<string, string> = {
  entrada: '+',
  saida: '-',
  sangria: '-',
  suprimento: '+',
  estorno: '-',
}

export function LinhaMovimentacao({ movimentacao, onEstornado }: LinhaMovimentacaoProps) {
  const [modalEstornoAberto, setModalEstornoAberto] = useState(false)

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(movimentacao.valor))

  const hora = new Date(movimentacao.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const podeEstornar =
    movimentacao.tipo === 'entrada' &&
    !movimentacao.estornada &&
    !movimentacao.motivo?.startsWith('[ESTORNO]')

  return (
    <>
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
          movimentacao.estornada
            ? 'opacity-40 bg-zinc-800/20'
            : 'bg-zinc-800/40 hover:bg-zinc-800/60'
        }`}
      >
        {/* Ícone do tipo */}
        <div className="w-7 h-7 rounded-full bg-zinc-700/60 flex items-center justify-center flex-shrink-0">
          {ICONES_TIPO[movimentacao.tipo] ?? <TrendingUp size={13} className="text-zinc-400" />}
        </div>

        {/* Descrição */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-medium leading-snug truncate ${
              movimentacao.estornada ? 'line-through text-zinc-500' : 'text-zinc-300'
            }`}
          >
            {movimentacao.motivo ?? '—'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-zinc-600">{hora}</span>
            {movimentacao.forma_pagamento && (
              <span className="text-[10px] text-zinc-600 uppercase">
                · {movimentacao.forma_pagamento}
              </span>
            )}
            {movimentacao.estornada && (
              <span className="text-[10px] text-amber-500/80 font-medium">· ESTORNADO</span>
            )}
          </div>
        </div>

        {/* Valor */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-sm font-bold tabular-nums ${
              movimentacao.estornada ? 'text-zinc-600' : (CORES_VALOR[movimentacao.tipo] ?? 'text-white')
            }`}
          >
            {PREFIXO_VALOR[movimentacao.tipo] ?? ''}
            {valorFormatado}
          </span>

          {/* Botão de Estorno */}
          {podeEstornar && (
            <button
              onClick={() => setModalEstornoAberto(true)}
              title="Estornar lançamento"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      <ModalEstorno
        movimentacao={modalEstornoAberto ? movimentacao : null}
        onFechar={() => setModalEstornoAberto(false)}
        onEstornado={onEstornado}
      />
    </>
  )
}
