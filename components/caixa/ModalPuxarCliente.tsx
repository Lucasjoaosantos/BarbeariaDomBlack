'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, X, Phone, Scissors, AlertTriangle } from 'lucide-react'

interface Cliente {
  id: number
  nome: string
  telefone?: string | null
  permite_fiado: boolean
  ativo: boolean
  barbeiro_id?: string | null
}

interface ModalPuxarClienteProps {
  aberto: boolean
  onFechar: () => void
  onSelecionar: (cliente: Cliente) => void
  barbeiroLogado: string // 'gabriel' ou 'eduardo'
}

export function ModalPuxarCliente({
  aberto,
  onFechar,
  onSelecionar,
  barbeiroLogado,
}: ModalPuxarClienteProps) {
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Barbeiro inverso — quem vai ser "puxado"
  const barbeiroInverso = barbeiroLogado === 'gabriel' ? 'eduardo' : 'gabriel'
  const nomeInverso = barbeiroInverso === 'gabriel' ? 'Gabriel' : 'Eduardo'
  const corInverso = barbeiroInverso === 'gabriel' ? 'text-blue-400' : 'text-orange-400'
  const bgInverso = barbeiroInverso === 'gabriel'
    ? 'bg-blue-950/40 border-blue-800/40'
    : 'bg-orange-950/40 border-orange-800/40'

  useEffect(() => {
    if (aberto) {
      setBusca('')
      carregarClientes('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [aberto])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (aberto) carregarClientes(busca)
    }, 300)
    return () => clearTimeout(timeout)
  }, [busca, aberto])

  async function carregarClientes(termo: string) {
    setCarregando(true)
    try {
      // Busca apenas clientes do OUTRO barbeiro
      let query = supabase
        .from('clientes')
        .select('id, nome, telefone, permite_fiado, ativo, barbeiro_id')
        .eq('ativo', true)
        .eq('barbeiro_id', barbeiroInverso)
        .order('nome')
        .limit(50)

      if (termo.trim()) {
        query = query.ilike('nome', `%${termo.trim()}%`)
      }

      const { data } = await query
      setClientes((data ?? []) as Cliente[])
    } finally {
      setCarregando(false)
    }
  }

  function handleSelecionar(cliente: Cliente) {
    onSelecionar(cliente)
    onFechar()
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-zinc-800 ${bgInverso}`}>
          <div>
            <h2 className="text-sm font-bold tracking-wider uppercase text-white flex items-center gap-2">
              <Scissors size={14} className={corInverso} />
              Puxar Cliente de {nomeInverso}
            </h2>
            <p className={`text-[10px] font-bold tracking-widest uppercase mt-0.5 ${corInverso}`}>
              ⚠ Atendimento cruzado — ficará registrado
            </p>
          </div>
          <button onClick={onFechar} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Aviso */}
        <div className="mx-4 mt-4 flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300 leading-relaxed">
            A venda vai para o <strong>seu caixa</strong>, mas ficará marcado no histórico que foi <strong>atendido por você</strong> — cliente de {nomeInverso}.
          </p>
        </div>

        {/* Barra de busca */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar cliente de ${nomeInverso}...`}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="max-h-64 overflow-y-auto px-4 pb-4">
          {carregando ? (
            <div className="text-center py-6 text-zinc-500 text-sm">Carregando...</div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-sm">
              {busca ? 'Nenhum cliente encontrado.' : `${nomeInverso} não tem clientes cadastrados.`}
            </div>
          ) : (
            clientes.map((cliente) => (
              <button
                key={cliente.id}
                onClick={() => handleSelecionar(cliente)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left hover:bg-zinc-800 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  barbeiroInverso === 'gabriel' ? 'bg-blue-950' : 'bg-orange-950'
                }`}>
                  <span className={`text-xs font-bold uppercase ${corInverso}`}>
                    {cliente.nome.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{cliente.nome}</p>
                  {cliente.telefone && (
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <Phone size={9} />
                      {cliente.telefone}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-black tracking-widest uppercase flex items-center gap-1 ${corInverso}`}>
                      <Scissors size={8} /> Cliente de {nomeInverso}
                    </span>
                    {cliente.permite_fiado && (
                      <span className="text-[10px] text-amber-500 font-semibold">• Possui Ficha</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}