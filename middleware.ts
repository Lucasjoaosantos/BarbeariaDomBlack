import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROTAS_PROTEGIDAS = [
  '/relatorios',
  '/caixa',
  '/produtos',
  '/estoque',
  '/clientes',
]

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

  // Salva no sessionStorage para o SessaoContext ler
  sessionStorage.setItem('usuario_logado', encontrado.usuario)

  // Grava o cookie para o middleware liberar as rotas protegidas
  document.cookie = 'domblack_session=autenticado; path=/; SameSite=Lax'

  router.push(encontrado.rotaInicial)
}

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
