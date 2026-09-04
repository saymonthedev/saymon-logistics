'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, useLogout } from '@/lib/auth-context';
import { cn, ROLE_LABEL } from '@/lib/utils';
import type { Role } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'Pedidos' },
  { href: '/picking-waves', label: 'Ondas de separação' },
  { href: '/inventory', label: 'Estoque' },
  { href: '/carriers', label: 'Transportadoras' },
  { href: '/alerts', label: 'Alertas' },
  { href: '/users', label: 'Usuários', roles: ['ADMIN'] },
  { href: '/audit', label: 'Auditoria', roles: ['ADMIN'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const logout = useLogout();

  const items = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-5">
        <Image src="/logo-mark.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Saymon Logistics</p>
          <p className="text-xs text-slate-500">Operações</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm font-medium transition',
                active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-slate-200 p-4">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
          <button
            onClick={() => logout()}
            className="mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      )}
    </aside>
  );
}
