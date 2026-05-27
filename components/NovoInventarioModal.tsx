'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

interface Produto {
  id: number
  nome: string
  estoque: number
}

interface Props {
  onSuccess?: () => void
}

export function NovoInventarioModal({ onSuccess }: Props) {
  const [open, setOpen] = useState(false)

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtoId, setProdutoId] = useState('')
  const [novoEstoque, setNovoEstoque] = useState('')

  useEffect(() => {
    carregarProdutos()
  }, [])

  async function carregarProdutos() {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .order('nome')

    setProdutos(data || [])
  }

  async function handleSalvar() {
    if (!produtoId) {
      alert('Selecione um produto.')
      return
    }

    const estoqueNumero = Number(novoEstoque)

    if (estoqueNumero < 0) {
      alert('Estoque inválido.')
      return
    }

    try {
      // Atualiza estoque
      const { error } = await supabase
        .from('produtos')
        .update({
          estoque: estoqueNumero
        })
        .eq('id', produtoId)

      if (error) throw error

      // Histórico
      await supabase
        .from('movimentacoes_estoque')
        .insert({
          produto_id: produtoId,
          tipo: 'inventario',
          quantidade: estoqueNumero
        })

      alert('Inventário atualizado!')

      setProdutoId('')
      setNovoEstoque('')
      setOpen(false)

      onSuccess?.()

    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-yellow-600 hover:bg-yellow-500 text-white">
          Inventário
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle>
            Ajustar Inventário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">

          <select
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
            className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-sm"
          >
            <option value="">
              Selecione o produto
            </option>

            {produtos.map(prod => (
              <option
                key={prod.id}
                value={prod.id}
              >
                {prod.nome} (Atual: {prod.estoque})
              </option>
            ))}
          </select>

          <Input
            type="number"
            placeholder="Novo estoque"
            value={novoEstoque}
            onChange={(e) => setNovoEstoque(e.target.value)}
          />

          <Button
            onClick={handleSalvar}
            className="w-full"
          >
            Salvar Inventário
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  )
}