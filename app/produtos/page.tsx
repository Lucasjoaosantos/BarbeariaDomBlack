/* eslint-disable no-console */
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { NovoProdutoModal } from '@/components/NovoProdutoModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2 } from 'lucide-react'

interface ItemTabela {
  id: number
  nome: string
  categoria?: string
  preco_venda?: number // Da tabela de produtos
  preco?: number       // Da tabela de serviços
  estoque?: number     // Só produtos tem
  tipo: 'produto' | 'servico'
}

export default function ProdutosPage() {
  const [itens, setItens] = useState<ItemTabela[]>([])
  const [loading, setLoading] = useState(true)

  // Estados para o Modal de Edição
  const [modalEditar, setModalEditar] = useState(false)
  const [itemEmEdicao, setItemEmEdicao] = useState<ItemTabela | null>(null)
  const [nomeEdit, setNomeEdit] = useState('')
  const [precoEdit, setPrecoEdit] = useState('')
  const [isSalvando, setIsSalvando] = useState(false)

  useEffect(() => {
    buscarTodosOsItens()
  }, [])

  async function buscarTodosOsItens() {
    setLoading(true)
    try {
      // 1. Busca os produtos no banco
      const { data: produtosData, error: produtosErro } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true)

      if (produtosErro) throw produtosErro

      // 2. Busca os serviços no banco
      const { data: servicosData, error: servicosErro } = await supabase
        .from('servicos')
        .select('*')

      if (servicosErro) throw servicosErro

      // 3. Formata e junta as duas listas em uma só
      const produtosFormatados = (produtosData || []).map((p) => ({
        ...p,
        tipo: 'produto' as const
      }))

      const servicosFormatados = (servicosData || []).map((s) => ({
        ...s,
        tipo: 'servico' as const,
        categoria: 'Serviços',
        estoque: undefined
      }))

      const listaCompleta = [...produtosFormatados, ...servicosFormatados].sort((a, b) =>
        a.nome.localeCompare(b.nome)
      )

      setItens(listaCompleta)
    } catch (error) {
      console.error('Erro ao buscar itens:', error)
      alert('Erro ao carregar a lista de produtos e serviços.')
    } finally {
      setLoading(false)
    }
  }

  // Prepara e abre o modal de edição com os dados atuais
  function abrirEdicao(item: ItemTabela) {
    setItemEmEdicao(item)
    setNomeEdit(item.nome)
    const precoAtual = item.tipo === 'produto' ? item.preco_venda : item.preco
    setPrecoEdit(Number(precoAtual || 0).toString())
    setModalEditar(true)
  }

  // Envia a atualização para a tabela correta no Supabase
  async function handleSalvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    if (!itemEmEdicao) return

    setIsSalvando(true)
    const tabelaTarget = itemEmEdicao.tipo === 'produto' ? 'produtos' : 'servicos'
    const dadosAtualizados = itemEmEdicao.tipo === 'produto'
      ? { nome: nomeEdit, preco_venda: Number(precoEdit) }
      : { nome: nomeEdit, preco: Number(precoEdit) }

    try {
      const { error } = await supabase
        .from(tabelaTarget)
        .update(dadosAtualizados)
        .eq('id', itemEmEdicao.id)

      if (error) throw error

      alert(`${itemEmEdicao.tipo === 'produto' ? 'Produto' : 'Serviço'} atualizado com sucesso!`)
      setModalEditar(false)
      setItemEmEdicao(null)
      buscarTodosOsItens()
    } catch (err: any) {
      console.error('Erro ao salvar alteração:', err)
      alert(`Erro ao salvar: ${err.message}`)
    } finally {
      setIsSalvando(false)
    }
  }

  // Deleta o item respeitando a trava de segurança histórica
  async function handleExcluirItem(item: ItemTabela) {
    const confirmar = window.confirm(`Tem certeza que deseja remover o item "${item.nome}"?`)
    if (!confirmar) return

    try {
      // 🛑 TRAVA DE SEGURANÇA: Só checa movimentação se for um produto
      if (item.tipo === 'produto') {
        const { count, error: errCheck } = await supabase
          .from('movimentacoes_estoque')
          .select('*', { count: 'exact', head: true })
          .eq('produto_id', item.id)

        if (errCheck) throw errCheck

        if (count && count > 0) {
          alert(`⚠️ Não é possível excluir este produto! Ele possui ${count} movimentações registradas no histórico de estoque.`);
          return
        }
      }

      // Caso passe na validação de produto ou seja um serviço, executa a remoção
      const tabelaTarget = item.tipo === 'produto' ? 'produtos' : 'servicos'
      const { error: errDelete } = await supabase
        .from(tabelaTarget)
        .delete()
        .eq('id', item.id)

      if (errDelete) throw errDelete

      alert('Item removido com sucesso!')
      buscarTodosOsItens()
    } catch (err: any) {
      console.error('Erro ao tentar excluir item:', err)
      alert(`Erro ao excluir: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-black text-zinc-500 items-center justify-center text-xs tracking-widest uppercase font-bold">
        Carregando lista completa...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-white font-sans antialiased selection:bg-white selection:text-black">
      <Sidebar />

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        {/* CABEÇALHO DA PÁGINA */}
        <div className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-widest uppercase">Produtos e Serviços</h1>
            <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1.5 font-semibold">
              Gerencie os itens e procedimentos da barbearia
            </p>
          </div>

          <NovoProdutoModal onSuccess={buscarTodosOsItens} />
        </div>

        {/* TABELA DE ITENS UNIFICADA */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/10 backdrop-blur-md shadow-xl">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[10px] font-bold tracking-widest uppercase text-zinc-500">
                <th className="px-6 py-4 text-left">Item</th>
                <th className="px-6 py-4 text-left">Tipo</th>
                <th className="px-6 py-4 text-left">Categoria</th>
                <th className="px-6 py-4 text-left">Preço</th>
                <th className="px-6 py-4 text-left">Estoque</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-800/40">
              {itens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-zinc-500 tracking-wider font-bold uppercase">
                    Nenhum item ou serviço cadastrado ainda.
                  </td>
                </tr>
              ) : (
                itens.map((item) => {
                  const precoExibir = item.tipo === 'produto' ? item.preco_venda : item.preco

                  return (
                    <tr key={`${item.tipo}-${item.id}`} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-zinc-200 tracking-wide">
                        {item.nome}
                      </td>
                      
                      <td className="px-6 py-4 text-xs">
                        <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black tracking-wider uppercase border ${
                          item.tipo === 'produto' 
                            ? 'bg-zinc-950 text-zinc-300 border-zinc-800' 
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800/50'
                        }`}>
                          {item.tipo === 'produto' ? '🥤 Produto' : '✂️ Serviço'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs font-semibold text-zinc-500 tracking-wide">
                        {item.categoria || 'Geral'}
                      </td>

                      <td className="px-6 py-4 text-xs font-bold text-zinc-200 font-mono">
                        {Number(precoExibir || 0).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>

                      <td className="px-6 py-4 text-xs font-bold text-zinc-400 font-mono">
                        {item.tipo === 'produto' ? `${item.estoque} un` : '—'}
                      </td>

                      <td className="px-6 py-4 text-xs">
                        <div className="flex items-center justify-center gap-4">
                          <button
                            onClick={() => abrirEdicao(item)}
                            className="text-zinc-600 hover:text-zinc-300 p-1 rounded-md transition-colors"
                            title="Editar item"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleExcluirItem(item)}
                            className="text-zinc-600 hover:text-zinc-400 p-1 rounded-md transition-colors"
                            title="Excluir item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAL DE EDIÇÃO DE ITENS */}
      <Dialog open={modalEditar} onOpenChange={setModalEditar}>
        <DialogContent className="border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md text-white rounded-2xl max-w-sm p-6 shadow-2xl">
          <DialogHeader className="border-b border-zinc-800/60 pb-4">
            <DialogTitle className="text-sm font-black tracking-widest uppercase text-zinc-100">
              Editar {itemEmEdicao?.tipo === 'produto' ? 'Produto' : 'Serviço'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSalvarEdicao} className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="nomeEdit" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Nome do Item</Label>
              <Input
                id="nomeEdit"
                type="text"
                value={nomeEdit}
                onChange={(e) => setNomeEdit(e.target.value)}
                required
                className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700 text-zinc-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="precoEdit" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Preço de Venda (R$)</Label>
              <Input
                id="precoEdit"
                type="number"
                step="0.01"
                value={precoEdit}
                onChange={(e) => setPrecoEdit(e.target.value)}
                required
                className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700 text-zinc-200 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSalvando}
              className="w-full bg-white text-black hover:bg-zinc-200 h-11 rounded-xl text-xs font-bold tracking-widest uppercase transition-all mt-2 active:scale-[0.99] disabled:opacity-40"
            >
              {isSalvando ? 'Salvando Alterações...' : 'Salvar Alterações'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}