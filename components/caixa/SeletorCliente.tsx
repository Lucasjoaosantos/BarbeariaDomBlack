'use client'

import { useState } from 'react'
import { User, Search, ChevronDown, X } from 'lucide-react'
import { ModalBuscaCliente } from './ModalBuscaCliente'

interface Cliente {
  id: number
  nome: string
  telefone?: string | null
  permite_fiado: boolean
  ativo: boolean
}

interface SeletorClienteProps {
  clienteSelecionado: Cliente | null
  onSelecionar: (cliente: Cliente | null) => void
}

export function SeletorCliente({ clienteSelecionado, onSelecionar }: SeletorClienteProps) {
  const [modalAberto, setModalAberto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setModalAberto(true)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-left hover:border-zinc-500 transition-colors group"
      >
        {/* Ícone/Avatar */}
        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
          {clienteSelecionado ? (
            <span className="text-xs font-bold text-zinc-300 uppercase">
              {clienteSelecionado.nome.charAt(0)}
            </span>
          ) : (
            <User size={13} className="text-zinc-500" />
          )}
        </div>

        {/* Nome */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {clienteSelecionado?.nome ?? 'Cliente Final (Avulso)'}
          </p>
          {clienteSelecionado?.telefone && (
            <p className="text-[11px] text-zinc-500 truncate">{clienteSelecionado.telefone}</p>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {clienteSelecionado && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelecionar(null)
              }}
              className="p-1 rounded-md hover:bg-zinc-600 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={12} />
            </span>
          )}
          <Search size={13} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          <ChevronDown size={13} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
        </div>
      </button>

      <ModalBuscaCliente
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onSelecionar={onSelecionar}
        clienteSelecionado={clienteSelecionado}
      />
    </>
  )
}
