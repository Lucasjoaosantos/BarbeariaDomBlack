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
import { Minus } from 'lucide-react'

interface NovaSaidaEstoqueModalProps {
  onSuccess: () => void
}

export function NovaSaidaEstoqueModal({ onSuccess }: NovaSaidaEstoqueModalProps) {
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [produtos, setProdutos] = useState<any[]>([])

  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [observacao, setObservacao] = useState('')

  useEffect(() => {
    buscarProdutos()
  }, [])

  async function buscarProdutos() {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('nome')

    if (data) setProdutos(data)
  }

  async function handleSalvar() {
    if (!produtoId || !quantidade || !motivo) {
      alert('Preencha os campos obrigatórios.')
      return
    }

    const produto = produtos.find((p) => p.id === Number(produtoId))
    if (!produto) return

    if (Number(quantidade) > Number(produto.estoque)) {
      alert(`Estoque insuficiente. Saldo atual: ${produto.estoque} unidades.`)
      return
    }

    setIsSaving(true)

    try {
      const novoEstoque = Number(produto.estoque) - Number(quantidade)

      const { error } = await supabase
        .from('movimentacoes_estoque')
        .insert({
          produto_id: produto.id,
          tipo: motivo,
          quantidade: Number(quantidade),
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
      setMotivo('')
      setObservacao('')

      alert('Baixa efetuada com sucesso!')
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
        <button className="bg-zinc-950 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 h-11 px-5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 active:scale-[0.98]">
          <Minus size={14} strokeWidth={3} />
          Baixa de Insumo
        </button>
      </DialogTrigger>

      <DialogContent className="border-zinc-800/80 bg-zinc-950 text-white rounded-2xl max-w-sm p-6 shadow-2xl">
        <DialogHeader className="border-b border-zinc-800/60 pb-4">
          <DialogTitle className="text-sm font-black tracking-widest uppercase text-zinc-100">
            Baixa de Insumo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Produto *</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger className="bg-black border-zinc-800 h-11 text-xs rounded-xl text-white opacity-100 font-medium w-full px-3 flex justify-between items-center focus:ring-1 focus:ring-zinc-700">
                <SelectValue placeholder="Selecione o item" className="text-white" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border border-zinc-800 rounded-xl p-1 shadow-xl">
                {produtos.map((produto) => (
                  <SelectItem
                    key={produto.id.toString()}
                    value={produto.id.toString()}
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
            <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Motivo da Saída *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger className="bg-black border-zinc-800 h-11 text-xs rounded-xl text-white opacity-100 font-medium w-full px-3 flex justify-between items-center focus:ring-1 focus:ring-zinc-700">
                <SelectValue placeholder="Selecione a razão" className="text-white" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border border-zinc-800 rounded-xl p-1 shadow-xl">
                <SelectItem value="uso_interno" className="text-xs font-bold text-zinc-200 py-2.5 px-3 rounded-lg focus:bg-zinc-800 focus:text-white hover:bg-zinc-800 hover:text-white data-[highlighted]:bg-zinc-800 data-[highlighted]:text-white cursor-pointer">
                  Uso Interno
                </SelectItem>
                <SelectItem value="perda" className="text-xs font-bold text-zinc-200 py-2.5 px-3 rounded-lg focus:bg-zinc-800 focus:text-white hover:bg-zinc-800 hover:text-white data-[highlighted]:bg-zinc-800 data-[highlighted]:text-white cursor-pointer">
                  Perda de Insumo
                </SelectItem>
                <SelectItem value="quebra" className="text-xs font-bold text-zinc-200 py-2.5 px-3 rounded-lg focus:bg-zinc-800 focus:text-white hover:bg-zinc-800 hover:text-white data-[highlighted]:bg-zinc-800 data-[highlighted]:text-white cursor-pointer">
                  Quebra / Danificado
                </SelectItem>
                <SelectItem value="consumo" className="text-xs font-bold text-zinc-200 py-2.5 px-3 rounded-lg focus:bg-zinc-800 focus:text-white hover:bg-zinc-800 hover:text-white data-[highlighted]:bg-zinc-800 data-[highlighted]:text-white cursor-pointer">
                  Consumo do Cliente
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Observações adicionais</Label>
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
            {isSaving ? 'Abatendo do Estoque...' : 'Confirmar Saída'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}