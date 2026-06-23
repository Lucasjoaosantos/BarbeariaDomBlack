/* eslint-disable no-console */
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/context/SessaoContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Check } from 'lucide-react'

interface NovoClienteModalProps {
  onSuccess: () => void
}

export function NovoClienteModal({ onSuccess }: NovoClienteModalProps) {
  const { usuario } = useSessao()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [permiteFiado, setPermiteFiado] = useState(false)

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    
    if (!nome.trim() || !telefone.trim()) {
      alert('Nome e Telefone/WhatsApp são obrigatórios!')
      return
    }

    const apenasNumeros = telefone.replace(/\D/g, '')

    if (apenasNumeros.length !== 11) {
      alert(`O telefone digitado tem ${apenasNumeros.length} dígitos. Ele precisa ter exatamente 11 dígitos (DDD + Número).`)
      return
    }

    setIsSaving(true)

    try {
      const { data: clientesEncontrados, error: erroBusca } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('telefone', apenasNumeros)

      if (erroBusca) {
        console.error(erroBusca)
        alert(`Erro na busca: ${erroBusca.message}`)
        setIsSaving(false)
        return
      }

      if (clientesEncontrados && clientesEncontrados.length > 0) {
        alert(`Esse número já está cadastrado para: ${clientesEncontrados[0].nome}`)
        setTelefone('') 
        setIsSaving(false)
        return
      }

      // Barbeiros cadastram clientes com seu próprio ID. Caixa/admin não atribuem dono.
      const barbeiro_id = usuario?.perfil === 'barbeiro' ? usuario.proprietarioCaixa : null

      const { error: erroInsert } = await supabase
        .from('clientes')
        .insert({
          nome: nome.trim(),
          telefone: apenasNumeros,
          permite_fiado: permiteFiado,
          ativo: true,
          barbeiro_id
        })

      if (erroInsert) {
        console.error(erroInsert)
        alert(`Erro ao salvar: ${erroInsert.message}`)
        setIsSaving(false)
        return
      }

      setNome('')
      setTelefone('')
      setPermiteFiado(false)
      alert('Cliente cadastrado com sucesso!')
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
          Novo Cliente
        </button>
      </DialogTrigger>

      <DialogContent className="border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md text-white rounded-2xl max-w-sm p-6 shadow-2xl">
        <DialogHeader className="border-b border-zinc-800/60 pb-4">
          <DialogTitle className="text-sm font-black tracking-widest uppercase text-zinc-100">
            Cadastrar Novo Cliente
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-[10px] tracking-wider uppercase font-semibold mt-1">
            Insira os dados cadastrais
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-5 mt-5">
          {/* CAMPO NOME */}
          <div className="space-y-1.5">
            <Label htmlFor="nome" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
              Nome Completo *
            </Label>
            <Input
              id="nome"
              type="text"
              placeholder="Ex: João Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700 text-zinc-200 placeholder:text-zinc-700 font-medium tracking-wide"
            />
          </div>

          {/* CAMPO TELEFONE */}
          <div className="space-y-1.5">
            <Label htmlFor="telefone" className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
              Telefone / WhatsApp *
            </Label>
            <Input
              id="telefone"
              type="text"
              placeholder="Ex: 11999999999"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
              className="bg-zinc-950 border-zinc-800 h-11 text-xs rounded-xl focus-visible:ring-zinc-700 text-zinc-200 font-mono placeholder:text-zinc-700 font-bold"
            />
          </div>

          {/* CHECKBOX CUSTOMIZADO PREMIUM */}
          <div 
            onClick={() => setPermiteFiado(!permiteFiado)}
            className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-950/50 p-4 cursor-pointer select-none hover:border-zinc-800 transition-colors"
          >
            <div className="space-y-0.5">
              <Label className="text-[10px] font-bold tracking-wider uppercase text-zinc-300 cursor-pointer">
                Autorizar Ficha (Fiado)
              </Label>
              <p className="text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">
                Permite acumular contas pendentes
              </p>
            </div>
            
            {/* Caixa de seleção customizada */}
            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
              permiteFiado 
                ? 'bg-white border-white text-black' 
                : 'bg-zinc-900 border-zinc-800 text-transparent'
            }`}>
              <Check size={12} strokeWidth={4} />
            </div>
          </div>

          {/* BOTÃO SALVAR */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-white text-black hover:bg-zinc-200 h-11 rounded-xl text-xs font-bold tracking-widest uppercase transition-all mt-2 active:scale-[0.99] disabled:opacity-40"
          >
            {isSaving ? 'Salvando Registro...' : 'Salvar Cliente'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
