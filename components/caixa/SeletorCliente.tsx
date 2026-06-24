'use client'

import { useState } from 'react'
import { User, Search, ChevronDown, X, Scissors, ArrowLeftRight } from 'lucide-react'
import { ModalBuscaCliente } from './ModalBuscaCliente'
import { ModalPuxarCliente } from './ModalPuxarCliente'
import { useSessao } from '@/context/SessaoContext'

interface Cliente {
  id: number
  nome: string
  telefone?: string | null
  permite_fiado: boolean
  ativo: boolean
  barbeiro_id?: string | null
}

interface SeletorClienteProps {
  clienteSelecionado: Cliente | null
  onSelecionar: (cliente: Cliente | null) => void
}

export function SeletorCliente({ clienteSelecionado, onSelecionar }: SeletorClienteProps) {
  const { usuario } = useSessao()
  const [modalAberto, setModalAberto] = useState(false)
  const [modalPuxarAberto, setModalPuxarAberto] = useState(false)

  const verTudo = usuario?.permissoes?.verTudo ?? false
  const perfil = usuario?.perfil ?? ''
  const barbeiroLogado = usuario?.proprietarioCaixa ?? ''

  // É barbeiro (não caixa/admin) e tem barbeiro inverso disponível?
  const podeVerBotaoPuxar = perfil === 'barbeiro'

  // Cliente puxado = pertence ao outro barbeiro
  const isPuxado = clienteSelecionado &&
    clienteSelecionado.barbeiro_id &&
    clienteSelecionado.barbeiro_id !== barbeiroLogado

  const barbeiroDoCliente = clienteSelecionado?.barbeiro_id === 'gabriel' ? 'Gabriel' : 'Eduardo'
  const corBarbeiro = clienteSelecionado?.barbeiro_id === 'gabriel' ? 'text-blue-400' : 'text-orange-400'

  return (
    <>
      <div className="space-y-2">
        {/* Linha principal: seletor + botão puxar */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="flex-1 flex items-center gap-2.5 px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-left hover:border-zinc-500 transition-colors group"
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
              {clienteSelecionado ? (
                <span className="text-xs font-bold text-zinc-300 uppercase">
                  {clienteSelecionado.nome.charAt(0)}
                </span>
              ) : (
                <User size={13} className="text-zinc-500" />
              )}
            </div>

            {/* Nome + badge */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {clienteSelecionado?.nome ?? 'Cliente Final (Avulso)'}
              </p>
              {/* Badge de atendimento cruzado — visível para todos quando puxado */}
              {isPuxado && (
                <p className={`text-[10px] font-black flex items-center gap-1 mt-0.5 ${corBarbeiro}`}>
                  <Scissors size={9} />
                  Cliente de {barbeiroDoCliente} — atendendo agora
                </p>
              )}
              {/* Barbeiro dono — só para admin/caixa quando não é puxado */}
              {!isPuxado && clienteSelecionado && verTudo && clienteSelecionado.barbeiro_id && (
                <p className={`text-[10px] font-bold flex items-center gap-1 mt-0.5 ${corBarbeiro}`}>
                  <Scissors size={9} />
                  {barbeiroDoCliente}
                </p>
              )}
              {clienteSelecionado?.telefone && !isPuxado && !verTudo && (
                <p className="text-[11px] text-zinc-500 truncate">{clienteSelecionado.telefone}</p>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {clienteSelecionado && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); onSelecionar(null) }}
                  className="p-1 rounded-md hover:bg-zinc-600 text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={12} />
                </span>
              )}
              <Search size={13} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
              <ChevronDown size={13} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            </div>
          </button>

          {/* Botão PUXAR — só aparece para barbeiros */}
          {podeVerBotaoPuxar && (
            <button
              type="button"
              onClick={() => setModalPuxarAberto(true)}
              title="Puxar cliente do outro barbeiro"
              className="flex items-center gap-1.5 px-3 py-2.5 bg-zinc-800 border border-zinc-700 hover:border-amber-500/60 hover:bg-amber-500/10 rounded-xl text-left transition-colors group"
            >
              <ArrowLeftRight size={13} className="text-zinc-500 group-hover:text-amber-400 transition-colors" />
              <span className="text-[10px] font-black tracking-widest uppercase text-zinc-500 group-hover:text-amber-400 transition-colors hidden sm:block">
                Puxar
              </span>
            </button>
          )}
        </div>

        {/* Banner de aviso quando cliente puxado está selecionado */}
        {isPuxado && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-bold tracking-wide uppercase ${
            clienteSelecionado?.barbeiro_id === 'gabriel'
              ? 'bg-blue-950/30 border-blue-800/40 text-blue-300'
              : 'bg-orange-950/30 border-orange-800/40 text-orange-300'
          }`}>
            <ArrowLeftRight size={11} />
            Atendimento cruzado — venda vai pro seu caixa, histórico registrado como seu atendimento
          </div>
        )}
      </div>

      <ModalBuscaCliente
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onSelecionar={onSelecionar}
        clienteSelecionado={clienteSelecionado}
      />

      {podeVerBotaoPuxar && (
        <ModalPuxarCliente
          aberto={modalPuxarAberto}
          onFechar={() => setModalPuxarAberto(false)}
          onSelecionar={(cliente) => onSelecionar(cliente)}
          barbeiroLogado={barbeiroLogado}
        />
      )}
    </>
  )
}
