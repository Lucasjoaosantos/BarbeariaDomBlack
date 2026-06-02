'use client'

// ─── GUARD DE ROTA ────────────────────────────────────────────────────────────
// Use no topo de cada page.tsx para proteger o acesso.
//
// Exemplo de uso:
//   const { usuario, negado } = useGuard('estoque')
//   if (negado) return null  // já redireciona automaticamente

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSessao } from '@/context/SessaoContext'
import { type Usuario } from '@/lib/usuarios'

type Permissao = keyof Usuario['permissoes']

export function useGuard(permissaoNecessaria?: Permissao) {
  const { usuario, carregando } = useSessao()
  const router = useRouter()

  useEffect(() => {
    if (carregando) return

    // Sem sessão → volta pro login
    if (!usuario) {
      router.replace('/')
      return
    }

    // Sem a permissão específica → manda pra rota inicial do usuário
    if (permissaoNecessaria && !usuario.permissoes[permissaoNecessaria]) {
      router.replace(usuario.rotaInicial)
    }
  }, [usuario, carregando, permissaoNecessaria, router])

  const negado =
    carregando ||
    !usuario ||
    (!!permissaoNecessaria && !usuario.permissoes[permissaoNecessaria])

  return { usuario, carregando, negado }
}