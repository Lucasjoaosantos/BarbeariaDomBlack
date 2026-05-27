'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

const links = [
  { href: '/caixa',      label: 'Caixa / PDV' },
  { href: '/produtos',   label: 'Produtos'    },
  { href: '/estoque',    label: 'Estoque'     },
  { href: '/clientes',   label: 'Clientes'    },
  { href: '/relatorios', label: 'Relatórios'  },
]

function NavLinks({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1.5">
      {links.map((link) => {
        const isActive = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            className={`px-4 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
              isActive
                ? 'bg-zinc-900 text-white border border-zinc-800/60 shadow-md'
                : 'text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-200'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 flex-shrink-0">
        <img
          src="https://i.imgur.com/LBasEik.png"
          alt="Dom Black"
          className="h-full w-full object-contain scale-125"
          draggable={false}
        />
      </div>
      <div>
        <h1 className="text-sm font-black tracking-widest text-white uppercase font-sans">Dom Black</h1>
        <p className="text-[10px] text-zinc-600 tracking-wider uppercase font-semibold">Dashboard</p>
      </div>
    </div>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Fecha o drawer ao mudar de rota
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Impede scroll do body quando drawer está aberto
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      {/* ─── SIDEBAR DESKTOP (≥ md) ─── */}
      <aside className="hidden md:flex w-64 bg-black border-r border-zinc-900 p-5 flex-col gap-8 select-none min-h-screen sticky top-0 h-screen">
        <div className="px-2 py-3 border-b border-zinc-900 pb-5">
          <Brand />
        </div>
        <NavLinks />
      </aside>

      {/* ─── TOPBAR MOBILE (< md) ─── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-black border-b border-zinc-900 select-none">
        <Brand />
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* ─── DRAWER MOBILE ─── */}
      {/* Overlay escuro */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Painel do drawer */}
      <div
        className={`md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-zinc-950 border-r border-zinc-900 p-5 flex flex-col gap-8 select-none transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-900 pb-5">
          <Brand />
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <NavLinks onClose={() => setMobileOpen(false)} />
      </div>
    </>
  )
}