/* eslint-disable no-console */
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'

interface NovaEntradaEstoqueModalProps {
  onSuccess: () => void
}

export function NovaEntradaEstoqueModal({ onSuccess }: NovaEntradaEstoqueModalProps) {
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [produtos, setProdutos] = useState<any[]>([])

  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [precoCompra, setPrecoCompra] = useState('')
  const [observacao, setObservacao] = useState('')

  useEffect(() => {
    buscarProdutos()
  }, [])

  async function buscarProdutos() {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .order('nome')

    if (data) setProdutos(data)
  }

  async function handleSalvar() {
    if (!produtoId || !quantidade) {
      alert('Preencha os campos obrigatórios.')
      return
    }

    const produto = produtos.find((p) => p.id === Number(produtoId))
    if (!produto) return

    setIsSaving(true)

    try {
      const novoEstoque = Number(produto.estoque) + Number(quantidade)

      const { error } = await supabase
        .from('movimentacoes_estoque')
        .insert({
          produto_id: produto.id,
          tipo: 'entrada',
          quantidade: Number(quantidade),
          preco_compra: Number(precoCompra || 0),
          observacao,
          usuario_nome: 'admin',
        })

      if (error) throw error

      await supabase
        .from('produtos')
        .update({ estoque: novoEstoque })
        .eq('id', produto.id)

      setProdutoId('')
      setQuantidade('')
      setPrecoCompra('')
      setObservacao('')

      alert('Entrada realizada com sucesso!')
      onSuccess()
      setOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-white text-black hover:bg-zinc-200 h-11 px-5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 active:scale-[0.98]">
          <Plus size={14} strokeWidth={3} />
          Nova Entrada
        </button>
      </DialogTrigger>

      <DialogContent className="border-zinc-800/80 bg-zinc-950 text-white rounded-2xl max-w-sm p-6 shadow-2xl">
        <DialogHeader className="border-b border-zinc-800/60 pb-4">
          <DialogTitle className="text-sm font-black tracking-widest uppercase text-zinc-100">
            Entrada de Estoque
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Produto *</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger className="bg-black border-zinc-800 h-11 text-xs rounded-xl text-white opacity-100 font-medium w-full px-3 flex justify-between items-center focus:ring-1 focus:ring-zinc-700">
                <SelectValue placeholder="Selecione o insumo" className="text-white placeholder:text-zinc-600" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border border-zinc-800 rounded-xl p-1 shadow-xl max-h-60 overflow-y-auto">
                {produtos.map((produto) => (
                  <SelectItem
                    key={produto.id}
                    value={String(produto.id)}
                    className="text-xs font-bold tracking-wide text-zinc-200 py-2.5 px-3 rounded-lg focus:bg-zinc-800 focus:text-white hover:bg-zinc-800 hover:text-white data-[highlighted]:bg-zinc-800 data-[highlighted]:text-white cursor-pointer transition-colors"
                  >
                    {produto.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Quantidade *</Label>
            <Input
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="bg-black border-zinc-800 h-11 text-xs rounded-xl text-white font-mono font-bold focus-visible:ring-zinc-700"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Preço Unitário de Compra</Label>
            <Input
              value={precoCompra}
              onChange={(e) => setPrecoCompra(e.target.value)}
              placeholder="R$ 0,00"
              className="bg-black border-zinc-800 h-11 text-xs rounded-xl text-white font-mono placeholder:text-zinc-800 focus-visible:ring-zinc-700"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Observação descritiva</Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="bg-black border-zinc-800 h-11 text-xs rounded-xl text-white font-medium focus-visible:ring-zinc-700"
            />
          </div>

          <button
            onClick={handleSalvar}
            disabled={isSaving}
            className="w-full bg-white text-black hover:bg-zinc-200 h-11 rounded-xl text-xs font-bold tracking-widest uppercase transition-all mt-2 active:scale-[0.99] disabled:opacity-40"
          >
            {isSaving ? 'Processando...' : 'Confirmar Entrada'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}