'use client'

// ─── CONTEXTO DE SESSÃO ───────────────────────────────────────────────────────
// Disponibiliza o usuário logado para qualquer componente do app.
// Uso: const { usuario } = useSessao()

import React, { createContext, useContext, useEffect, useState } from 'react'
import { type Usuario, buscarUsuario } from '@/lib/usuarios'

interface SessaoContextType {
  usuario: Usuario | null
  carregando: boolean
}

const SessaoContext = createContext<SessaoContextType>({
  usuario: null,
  carregando: true,
})

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // Lê o usuário que foi salvo no login (sessionStorage para durar só a sessão)
    const salvo = sessionStorage.getItem('usuario_logado')
    if (salvo) {
      const encontrado = buscarUsuario(salvo)
      setUsuario(encontrado)
    }
    setCarregando(false)
  }, [])

  return (
    <SessaoContext.Provider value={{ usuario, carregando }}>
      {children}
    </SessaoContext.Provider>
  )
}

export function useSessao() {
  return useContext(SessaoContext)
}