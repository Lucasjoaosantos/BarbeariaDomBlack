'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSessao } from '@/context/SessaoContext'
import {
  ShoppingCart,
  Package,
  Archive,
  Users,
  BarChart2,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

const ITENS_MENU = [
  { href: '/caixa',      label: 'Caixa / PDV',  permissao: 'caixa',      icone: ShoppingCart },
  { href: '/produtos',   label: 'Produtos',     permissao: 'produtos',   icone: Package      },
  { href: '/estoque',    label: 'Estoque',      permissao: 'estoque',    icone: Archive      },
  { href: '/clientes',   label: 'Clientes',     permissao: 'clientes',   icone: Users        },
  { href: '/relatorios', label: 'Relatórios',   permissao: 'relatorios', icone: BarChart2    },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { usuario } = useSessao()
  const [menuAberto, setMenuAberto] = useState(false)

  function handleLogout() {
    sessionStorage.removeItem('usuario_logado')
    router.push('/')
  }

  const itensVisiveis = ITENS_MENU.filter(
    item => usuario?.permissoes[item.permissao]
  )

  return (
    <>
      {/* Botão mobile */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-zinc-900 border border-zinc-800 text-zinc-300 p-2 rounded-xl"
        onClick={() => setMenuAberto(!menuAberto)}
      >
        {menuAberto ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Overlay mobile */}
      {menuAberto && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setMenuAberto(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40
        w-52 bg-zinc-950 border-r border-zinc-900
        flex flex-col
        transition-transform duration-200
        ${menuAberto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* Logo / nome do usuário */}
        <div className="p-5 border-b border-zinc-900">
          <p className="text-white font-black tracking-widest uppercase text-sm">Dom Black</p>
          {usuario && (
            <div className="mt-2">
              <p className="text-zinc-400 text-[10px] font-bold tracking-widest uppercase">
                {usuario.profissional}
              </p>
              <span className="inline-block mt-1 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
                {usuario.perfil}
              </span>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 p-3 space-y-1">
          {itensVisiveis.map(({ href, label, icone: Icone }) => {
            const ativo = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuAberto(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all
                  ${ativo
                    ? 'bg-white text-black'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'
                  }
                `}
              >
                <Icone size={14} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-zinc-900">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 transition-all"
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </aside>
    </>
  )
}
