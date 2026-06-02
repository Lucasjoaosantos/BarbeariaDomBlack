// ─── ARQUIVO CENTRAL DE USUÁRIOS ─────────────────────────────────────────────
// Toda a lógica de autenticação, perfis e permissões parte daqui.
// Para adicionar um novo usuário: basta adicionar um entry neste array.

export type Perfil = 'admin' | 'caixa' | 'barbeiro'

export interface Usuario {
  usuario: string
  senha: string
  perfil: Perfil
  // Nome do profissional exibido no PDV e gravado nos lançamentos
  profissional: string
  // Identificador único do "dono" do caixa (gravado no banco)
  // admin e caixa usam 'caixa' — eles enxergam tudo
  proprietarioCaixa: string
  // Rota padrão após login
  rotaInicial: string
  // Quais seções do sistema esse usuário pode acessar
  permissoes: {
    caixa: boolean       // PDV / Frente de Caixa
    produtos: boolean    // Gestão de Produtos
    estoque: boolean     // Controle de Estoque
    clientes: boolean    // Gestão de Clientes
    relatorios: boolean  // Relatórios
    // Se true, vê relatórios/movimentações de TODOS. Se false, só os seus.
    verTudo: boolean
  }
}

export const USUARIOS: Usuario[] = [
  {
    usuario: 'admin',
    senha: '123',
    perfil: 'admin',
    profissional: 'Admin',
    proprietarioCaixa: 'caixa',
    rotaInicial: '/relatorios',
    permissoes: {
      caixa: true,
      produtos: true,
      estoque: true,
      clientes: true,
      relatorios: true,
      verTudo: true,
    },
  },
  {
    usuario: 'caixa',
    senha: '123',
    perfil: 'caixa',
    profissional: 'Caixa',
    proprietarioCaixa: 'caixa',
    rotaInicial: '/caixa',
    permissoes: {
      caixa: true,
      produtos: true,
      estoque: true,
      clientes: true,
      relatorios: true,
      verTudo: true,
    },
  },
  {
    usuario: 'gabriel',
    senha: '123',
    perfil: 'barbeiro',
    profissional: 'Gabriel',
    proprietarioCaixa: 'gabriel',
    rotaInicial: '/caixa',
    permissoes: {
      caixa: true,
      produtos: true,
      estoque: true,
      clientes: false,
      relatorios: true,
      verTudo: false,  // vê apenas os próprios lançamentos
    },
  },
  {
    usuario: 'eduardo',
    senha: '123',
    perfil: 'barbeiro',
    profissional: 'Eduardo',
    proprietarioCaixa: 'eduardo',
    rotaInicial: '/caixa',
    permissoes: {
      caixa: true,
      produtos: false,
      estoque: false,
      clientes: false,
      relatorios: true,
      verTudo: false,  // vê apenas os próprios lançamentos
    },
  },
]

export function autenticar(usuario: string, senha: string): Usuario | null {
  return (
    USUARIOS.find(
      u => u.usuario === usuario.toLowerCase().trim() && u.senha === senha
    ) ?? null
  )
}

export function buscarUsuario(usuario: string): Usuario | null {
  return USUARIOS.find(u => u.usuario === usuario) ?? null
}