import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROTAS_PROTEGIDAS = [
  '/relatorios',
  '/caixa',
  '/produtos',
  '/estoque',
  '/clientes',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isRotaProtegida = ROTAS_PROTEGIDAS.some(
    (rota) => pathname === rota || pathname.startsWith(rota + '/')
  )

  if (!isRotaProtegida) return NextResponse.next()

  const logado = request.cookies.get('domblack_session')?.value === 'autenticado'

  if (!logado) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',],
}
