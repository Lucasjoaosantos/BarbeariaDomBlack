/* eslint-disable no-console */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, User, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    await new Promise((resolve) => setTimeout(resolve, 800))

    const usuarios = [
      { usuario: 'admin',   senha: '123', rota: '/relatorios' },
      { usuario: 'gabriel', senha: '123', rota: '/relatorios' },
      { usuario: 'eduardo', senha: '123', rota: '/relatorios' },
      { usuario: 'caixa',   senha: '123', rota: '/caixa'      },
    ]

    const usuarioEncontrado = usuarios.find(
      (u) => u.usuario === usuario.toLowerCase() && u.senha === password
    )

    if (usuarioEncontrado) {
      // Grava o cookie de sessão — o middleware usa ele para liberar as rotas protegidas
      document.cookie = 'domblack_session=autenticado; path=/; max-age=86400; SameSite=Lax'
      setLoading(false)
      router.push(usuarioEncontrado.rota)
    } else {
      setLoading(false)
      setErro('Usuário ou senha incorretos!')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white font-sans antialiased selection:bg-white selection:text-black">

      <div className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-800/60 bg-zinc-900/40 p-10 shadow-2xl backdrop-blur-md">

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="h-36 w-36 overflow-hidden flex items-center justify-center">
            <img
              src="https://i.imgur.com/LBasEik.png"
              alt="Dom Black Barbearia"
              className="w-full h-full object-contain scale-150"
              draggable={false}
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

        <form className="mt-8 space-y-5" onSubmit={handleLogin}>
          {erro && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 text-center text-xs font-semibold text-red-400 tracking-wide">
              {erro}
            </div>
          )}
     {/* FOOTER */}
      <footer className="border-t border-zinc-900 py-8 text-center text-zinc-600 text-sm tracking-wide">
        © 2026 JOAO LUCAS SANTOS — Todos os direitos reservados.
      </footer>
          <div className="space-y-3">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <User className="h-4 w-4 text-zinc-600" />
              </div>
              <input
                id="usuario"
                name="usuario"
                type="text"
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950 py-3.5 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:border-zinc-400 focus:outline-none transition-colors"
                placeholder="Usuário"
              />
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <KeyRound className="h-4 w-4 text-zinc-600" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950 py-3.5 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:border-zinc-400 focus:outline-none transition-colors"
                placeholder="Senha"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-xl bg-white py-3.5 text-sm font-bold tracking-wider text-black transition-all hover:bg-zinc-200 active:scale-[0.99] focus:outline-none disabled:opacity-40 uppercase"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-black" />
            ) : (
              'Acessar Painel'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
