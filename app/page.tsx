'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { autenticar } from '@/lib/usuarios'

export default function LoginPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    await new Promise(r => setTimeout(r, 300))

    const encontrado = autenticar(usuario, senha)

    if (!encontrado) {
      setErro('Usuário ou senha incorretos.')
      setCarregando(false)
      return
    }

    sessionStorage.setItem('usuario_logado', encontrado.usuario)
    document.cookie = 'domblack_session=autenticado; path=/; SameSite=Lax'; Max-Age=86400'
    window.location.href = encontrado.rotaInicial
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-20 h-20">
            <Image
              src="https://i.imgur.com/LBasEik.png"
              alt="Dom Black Barbearia"
              fill
              className="w-full h-full object-contain scale-150"
              draggable={false}
              priority
            />
          </div>
            <div className="text-center">
            <h2 className="text-3xl font-black tracking-[0.30em] text-white uppercase">
              Dom Black
            </h2>
            <p className="mt-1 text-[11px] tracking-[0.35em] text-zinc-500 uppercase font-semibold">
              Barbearia Premium
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
              Usuário
            </label>
            <input
              type="text"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              autoComplete="username"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
              placeholder="seu usuário"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
              placeholder="••••••"
            />
          </div>

          {/* Feedback de erro */}
          {erro && (
            <p className="text-rose-400 text-[11px] font-semibold tracking-wide text-center">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando || !usuario || !senha}
            className="w-full bg-white text-black hover:bg-zinc-200 h-12 rounded-xl text-xs font-black tracking-widest uppercase transition-all disabled:opacity-40 mt-2"
          >
            {carregando ? 'Entrando...' : 'Acessar Painel'}
          </button>
        </form>

        <p className="text-center text-zinc-700 text-[10px] tracking-widest uppercase">
          © {new Date().getFullYear()} Barbearia Dom Black
        </p>
          <footer className="text-center text-zinc-600 text-[11px] tracking-[0.2em] uppercase">
    © 2026 JOAO LUCAS SANTOS - Todos os direitos reservados.
  </footer>
      </div>
    </div>
  )
}
