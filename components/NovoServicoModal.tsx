'use client'

import { useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'

interface Props {
  onAddServico: (novoServico: {
    nome: string
    categoria?: string
    preco: string | number
  }) => Promise<void>
}

export function NovoServicoModal({ onAddServico }: Props) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('')
  const [preco, setPreco] = useState('')
  const [salvando, setSalvando] = useState(false)

  function handleAbrir() {
    setNome('')
    setCategoria('')
    setPreco('')
    setAberto(true)
  }

  function handleFechar() {
    if (salvando) return
    setAberto(false)
  }

  async function handleSalvar() {
    if (!nome.trim()) {
      alert('Informe o nome do serviço.')
      return
    }
    if (!preco || Number(preco) <= 0) {
      alert('Informe um preço válido.')
      return
    }

    setSalvando(true)
    try {
      await onAddServico({ nome: nome.trim(), categoria: categoria.trim() || 'Geral', preco })
      setAberto(false)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      {/* BOTÃO ABRIR */}
      <button
        onClick={handleAbrir}
        className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all active:scale-[0.99]"
      >
        <Plus size={14} />
        Novo Serviço
      </button>

      {/* OVERLAY */}
      {aberto && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={handleFechar}
        >
          {/* MODAL */}
          <div
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 className="text-sm font-black tracking-widest uppercase text-white">
                Novo Serviço
              </h2>
              <button
                onClick={handleFechar}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* CAMPOS */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                  Nome do Serviço *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Corte Degradê"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-xs font-semibold text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                  Categoria
                </label>
                <input
                  type="text"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ex: Corte, Barba, Sobrancelha..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-xs font-semibold text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                  Preço (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-xs font-semibold text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* BOTÃO SALVAR */}
            <button
              onClick={handleSalvar}
              disabled={salvando}
              className="w-full bg-white text-black hover:bg-zinc-200 h-11 rounded-xl text-xs font-bold tracking-widest uppercase transition-all active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {salvando ? (
                <><Loader2 size={14} className="animate-spin" /> Salvando...</>
              ) : (
                'Cadastrar Serviço'
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
