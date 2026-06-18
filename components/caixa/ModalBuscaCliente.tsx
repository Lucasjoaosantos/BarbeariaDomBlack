'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, X, User, Phone } from 'lucide-react'

interface Cliente {
  id: number
  nome: string
  telefone?: string | null
  permite_fiado: boolean
  ativo: boolean
}

interface ModalBuscaClienteProps {
  aberto: boolean
  onFechar: () => void
  onSelecionar: (cliente: Cliente | null) => void
  clienteSelecionado: Cliente | null
}

export function ModalBuscaCliente({
  aberto,
  onFechar,
  onSelecionar,
  clienteSelecionado,
}: ModalBuscaClienteProps) {
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
      let query = supabase
        .from('clientes')
        .select('id, nome, telefone, permite_fiado, ativo')
        .eq('ativo', true)
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

  function handleSelecionar(cliente: Cliente | null) {
    onSelecionar(cliente)
    onFechar()
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-bold tracking-wider uppercase text-white">
            Selecionar Cliente
          </h2>
          <button onClick={onFechar} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
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
              placeholder="Digite o nome do cliente..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="max-h-72 overflow-y-auto px-4 pb-4">

          {/* Opção Avulso */}
          <button
            onClick={() => handleSelecionar(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left transition-colors ${
              clienteSelecionado === null
                ? 'bg-white/10 border border-white/20'
                : 'hover:bg-zinc-800'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Cliente Final (Avulso)</p>
              <p className="text-[11px] text-zinc-500">Venda sem identificação</p>
            </div>
            {clienteSelecionado === null && (
              <div className="ml-auto w-2 h-2 rounded-full bg-green-400" />
            )}
          </button>

          <div className="border-t border-zinc-800 my-2" />

          {carregando ? (
            <div className="text-center py-6 text-zinc-500 text-sm">Carregando...</div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-sm">
              {busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}
            </div>
          ) : (
            clientes.map((cliente) => (
              <button
                key={cliente.id}
                onClick={() => handleSelecionar(cliente)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left transition-colors ${
                  clienteSelecionado?.id === cliente.id
                    ? 'bg-white/10 border border-white/20'
                    : 'hover:bg-zinc-800'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-zinc-700/80 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-zinc-300 uppercase">
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
                  {cliente.permite_fiado && (
                    <p className="text-[10px] text-amber-500 font-semibold">• Possui Ficha</p>
                  )}
                </div>
                {clienteSelecionado?.id === cliente.id && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
