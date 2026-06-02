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

    // Pequeno delay para evitar brute-force visual
    await new Promise(r => setTimeout(r, 300))

    const encontrado = autenticar(usuario, senha)

    if (!encontrado) {
      setErro('Usuário ou senha incorretos.')
      setCarregando(false)
      return
    }

    // Salva o username na sessão — o SessaoContext lê isso
    sessionStorage.setItem('usuario_logado', encontrado.usuario)

    router.push(encontrado.rotaInicial)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-20 h-20">
            <Image
              src="/logo.png"
              alt="Dom Black"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-white font-black tracking-[0.3em] uppercase text-xl">Dom Black</h1>
            <p className="text-zinc-500 text-[10px] tracking-widest uppercase mt-1">Sistema de Gestão</p>
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
      </div>
    </div>
  )
}
