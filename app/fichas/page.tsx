'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useGuard } from '@/hooks/useGuard'

export default function FichasPage() {
  const { usuario, negado } = useGuard('fichas')
if (negado) return null
  const [fichas, setFichas] = useState<any[]>([])
  const [openModal, setOpenModal] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null)
  
  // Campos do lançamento
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('pix') // Padrão inicial
  const [tipoLancamento, setTipoLancamento] = useState<'debito' | 'credito'>('debito')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    buscarSaldosFichas()
  }, [])

  async function buscarSaldosFichas() {
    const { data: clientes, error: errCli } = await supabase
      .from('clientes')
      .select('id, nome, telefone')
      .eq('permite_fiado', true)
      .eq('ativo', true)

    if (errCli) return console.error(errCli)

    const { data: historico, error: errHist } = await supabase
      .from('historico_ficha')
      .select('*')

    if (errHist) return console.error(errHist)

    const listaFichas = (clientes || []).map(cliente => {
      const transacoesDoCliente = (historico || []).filter(h => h.cliente_id === cliente.id)
      const saldoDevedor = transacoesDoCliente.reduce((acc, atual) => acc + Number(atual.valor), 0)

      return {
        ...cliente,
        saldo: saldoDevedor
      }
    })

    setFichas(listaFichas)
  }

  function abrirLancamento(cliente: any, tipo: 'debito' | 'credito') {
    setClienteSelecionado(cliente)
    setTipoLancamento(tipo)
    setDescricao(tipo === 'debito' ? '' : 'Pagamento de Ficha')
    setValor('')
    setFormaPagamento('pix') // Reset para o padrão
    setOpenModal(true)
  }

  async function handleSalvarLancamento() {
    if (!descricao || !valor || Number(valor) <= 0) {
      alert('Preencha a descrição e um valor válido!')
      return
    }

    setIsSaving(true)
    
    // Débito soma (+), Crédito (Pagamento) subtrai (-) do saldo devedor
    const valorFinal = tipoLancamento === 'debito' ? Number(valor) : -Number(valor)
    
    // Se for débito, a forma de movimentação é "ficha". Se for pagamento, pega a selecionada.
    const formaFinal = tipoLancamento === 'debito' ? 'ficha' : formaPagamento

    try {
      const { error } = await supabase
        .from('historico_ficha')
        .insert({
          cliente_id: clienteSelecionado.id,
          descricao,
          valor: valorFinal,
          forma_pagamento: formaFinal
        })

      if (error) {
        alert(`Erro ao lançar: ${error.message}`)
        setIsSaving(false)
        return
      }

      alert('Lançamento realizado com sucesso!')
      buscarSaldosFichas()
      setOpenModal(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Fichas (Contas Clientes)</h1>
          <p className="text-zinc-400">Controle de débitos e acertos de clientes autorizados</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <table className="w-full">
            <thead className="border-b border-zinc-800 bg-zinc-950">
              <tr>
                <th className="px-6 py-4 text-left text-sm text-zinc-400">Cliente</th>
                <th className="px-6 py-4 text-left text-sm text-zinc-400">Telefone</th>
                <th className="px-6 py-4 text-left text-sm text-zinc-400">Saldo Devedor</th>
                <th className="px-6 py-4 text-right text-sm text-zinc-400">Ações</th>
              </tr>
            </thead>

            <tbody>
              {fichas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                    Nenhum cliente com ficha ativa autorizado no sistema.
                  </td>
                </tr>
              ) : (
                fichas.map((ficha) => (
                  <tr key={ficha.id} className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-zinc-100">{ficha.nome}</td>
                    <td className="px-6 py-4 text-zinc-400">{ficha.telefone}</td>
                    <td className={`px-6 py-4 font-bold ${ficha.saldo > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {ficha.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button 
                        size="sm" 
                        className="bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/30"
                        onClick={() => abrirLancamento(ficha, 'debito')}
                      >
                        + Pendurar
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-600/30"
                        onClick={() => abrirLancamento(ficha, 'credito')}
                      >
                        $ Receber
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal de Lançamento */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="border-zinc-800 bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle>
              {tipoLancamento === 'debito' ? 'Pendurar na Ficha' : 'Receber Pagamento'}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Cliente: {clienteSelecionado?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label>Descrição / Identificação</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={tipoLancamento === 'debito' ? "Ex: Corte de cabelo" : "Ex: Acerto parcial da conta"}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0.00"
                className="mt-2"
              />
            </div>

            {/* Exibe o seletor apenas quando for recebimento de dinheiro */}
            {tipoLancamento === 'credito' && (
              <div>
                <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
                <select
                  id="formaPagamento"
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none"
                >
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                </select>
              </div>
            )}

            <Button
              className={`w-full ${tipoLancamento === 'debito' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              onClick={handleSalvarLancamento}
              disabled={isSaving}
            >
              {isSaving ? 'Processando...' : tipoLancamento === 'debito' ? 'Confirmar Débito' : 'Confirmar Pagamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
