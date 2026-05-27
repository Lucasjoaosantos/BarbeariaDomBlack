/* eslint-disable no-console */
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

interface NovoProdutoModalProps {
  onSuccess: () => void
}

export function NovoProdutoModal({ onSuccess }: NovoProdutoModalProps) {
  const [open, setOpen] = useState(false)
  const [isEnviando, setIsEnviando] = useState(false)

  // Estados do Formulário
  const [cadastroTipo, setCadastroTipo] = useState<'produto' | 'servico'>('produto')
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('')
  const [preco, setPreco] = useState('')
  const [estoque, setEstoque] = useState('0')

  function handleTipoChange(tipo: 'produto' | 'servico') {
    setCadastroTipo(tipo)
    if (tipo === 'servico') {
      setEstoque('0') 
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !preco) {
      alert('Por favor, preencha os campos obrigatórios.')
      return
    }

    setIsEnviando(true)

    try {
      if (cadastroTipo === 'produto') {
        const { error } = await supabase
          .from('produtos')
          .insert({
            nome: nome.trim(),
            categoria: categoria.trim() || 'Geral',
            preco_venda: Number(preco) || 0,
            estoque: Number(estoque) || 0,
            tipo: 'produto',
            ativo: true
          })

        if (error) throw error
        alert('Produto cadastrado com sucesso!')
      } else {
        const { error } = await supabase
          .from('servicos')
          .insert({
            nome: nome.trim(),
            preco: Number(preco) || 0
          })

        if (error) throw error
        alert('Serviço cadastrado com sucesso!')
      }

      setNome('')
      setCategoria('')
      setPreco('')
      setEstoque('0')
      setCadastroTipo('produto')
      
      onSuccess() 
      setOpen(false) 
    } catch (err: any) {
      console.error('Erro ao salvar no banco:', err)
      alert(`Erro ao salvar no banco de dados: ${err.message || err}`)
    } finally {
      setIsEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-white text-black hover:bg-zinc-200 h-11 px-5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 active:scale-[0.98]">
          <Plus size={14} strokeWidth={3} />
          Cadastrar Item
        </button>
      </DialogTrigger>

      <DialogContent className="border-zinc-800/80 bg-zinc-950 text-white rounded-2xl max-w-sm p-6 shadow-2xl">
        <DialogHeader className="border-b border-zinc-800/60 pb-4">
          <DialogTitle className="text-sm font-black tracking-widest uppercase text-zinc-100">
            Novo Cadastro
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-[10px] tracking-wider uppercase font-semibold mt-1">
            Insira os dados do Produto ou Serviço
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-5">
          {/* SELETOR TIPO DE CADASTRO */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
              O que você vai cadastrar?
            </Label>
            <select
              value={cadastroTipo}
              onChange={(e) => handleTipoChange(e.target.value as 'produto' | 'servico')}
              className="w-full bg-black border border-zinc-800 h-11 px-3 rounded-xl text-xs text-zinc-200 font-medium focus:outline-none focus:ring-1 focus:ring-zinc-700 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2371717a%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_auto] bg-[right_16px_center] bg-no-repeat"
            >
              <option value="produto" className="bg-zinc-950 text-zinc-200 py-2">🥤 Produto (Possui estoque físico)</option>
              <option value="servico" className="bg-zinc-950 text-zinc-200 py-2">✂️ Serviço (Mão de obra / Sem estoque)</option>
            </select>
          </div>

          {/* NOME */}
          <div className="space-y-1.5">
            <Label htmlFor="nome" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
              Nome do Item *
            </Label>
            <Input
              id="nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Pomada Efeito Matte / Corte Degradê"
              className="bg-black border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700 text-zinc-200 placeholder:text-zinc-800 font-medium tracking-wide"
              required
            />
          </div>

          {/* CATEGORIA (Desabilitado visualmente se for Serviço) */}
          <div className={`space-y-1.5 transition-all ${cadastroTipo === 'servico' ? 'opacity-30' : ''}`}>
            <Label htmlFor="categoria" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
              Categoria {cadastroTipo === 'produto' && '*'}
            </Label>
            <Input
              id="categoria"
              type="text"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder={cadastroTipo === 'servico' ? 'Não aplicável para serviços' : 'Ex: Cosméticos, Bebidas'}
              disabled={cadastroTipo === 'servico'}
              className="bg-black border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700 text-zinc-200 placeholder:text-zinc-800 font-medium tracking-wide disabled:cursor-not-allowed disabled:bg-zinc-900/50"
            />
          </div>

          {/* DOIS CAMPOS NA MESMA LINHA (PREÇO E ESTOQUE) */}
          <div className="grid grid-cols-2 gap-4">
            {/* PREÇO */}
            <div className="space-y-1.5">
              <Label htmlFor="preco" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                Preço de Venda *
              </Label>
              <Input
                id="preco"
                type="number"
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="0,00"
                className="bg-black border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700 text-zinc-200 font-mono font-bold placeholder:text-zinc-800"
                required
              />
            </div>

            {/* ESTOQUE */}
            <div className={`space-y-1.5 transition-all ${cadastroTipo === 'servico' ? 'opacity-30' : ''}`}>
              <Label htmlFor="estoque" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                Qtd Estoque
              </Label>
              <Input
                id="estoque"
                type="number"
                value={estoque}
                onChange={(e) => setEstoque(e.target.value)}
                disabled={cadastroTipo === 'servico'}
                className="bg-black border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700 text-zinc-200 font-mono font-bold disabled:cursor-not-allowed disabled:bg-zinc-900/50"
                required={cadastroTipo === 'produto'}
              />
            </div>
          </div>

          {/* BOTÃO SALVAR */}
          <button
            type="submit"
            disabled={isEnviando}
            className="w-full bg-white text-black hover:bg-zinc-200 h-11 rounded-xl text-xs font-bold tracking-widest uppercase transition-all mt-4 active:scale-[0.99] disabled:opacity-40"
          >
            {isEnviando ? 'Gravando Dados...' : 'Confirmar Cadastro'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}