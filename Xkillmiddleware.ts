import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usando o seu modelo padrão de inicialização
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()

  // 1. Buscamos o token direto dos cookies que o Supabase já grava por padrão
  const token = request.cookies.get('sb-access-token')?.value

  // 2. Se o usuário está na página de login (/)
  if (url.pathname === '/') {
    if (token) {
      // Se já tem token guardado, pula o login e vai pro caixa
      url.pathname = '/caixa'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // 3. Se ele está tentando acessar qualquer outra página protegida e NÃO tem token
  if (!token) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Suas rotas protegidas centralizadas aqui
export const config = {
  matcher: [
    '/',
    '/caixa',
    '/produtos',
    '/estoque',
    '/clientes',
    '/relatorios',
  ],
}