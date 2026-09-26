import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Activity, Bot, LayoutDashboard, LogOut, Megaphone, Scale } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { initials } from '@/lib/format';

const navItems = [
  { href: '/gestor', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/gestor/rede', label: 'Rede, preço & clima', icon: Activity },
  { href: '/gestor/sinais', label: 'Sinais de preço', icon: Megaphone },
  { href: '/gestor/flexia', label: 'FlexIA', icon: Bot },
  { href: '/gestor/regulacao', label: 'Regulação & protocolos', icon: Scale },
];

export function ManagerShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const isActive = (href: string) => (href === '/gestor' ? location === '/gestor' : location.startsWith(href));

  return (
    <div className="rf-app rf-shell">
      <aside className="rf-sidebar manager">
        <Link href="/gestor" className="rf-logo" style={{ color: '#f4f7f9' }}>
          <span className="rf-logo-mark">RF</span>
          <span>rio flex <span style={{ color: '#b98cff', fontSize: 12 }}>gestão</span></span>
        </Link>
        <div className="rf-nav-section">Operação</div>
        <nav className="rf-nav">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`rf-nav-link ${isActive(href) ? 'active' : ''}`}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }} className="rf-asset-note">
          <div className="rf-eyebrow">Sessão</div>
          <p style={{ margin: '6px 0 10px', fontSize: 12 }}>{user?.name}<br /><span className="rf-tiny">{user?.email}</span></p>
          <button type="button" className="rf-btn secondary small full" onClick={async () => { await logout(); setLocation('/gestor/login'); }}>
            <LogOut size={13} /> Sair
          </button>
        </div>
      </aside>

      <main className="rf-main">
        <header className="rf-topbar">
          <div style={{ fontWeight: 700, color: '#f8fafc' }}>Rio Flex · Gestão</div>
          <div className="rf-topbar-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="rf-avatar" style={{ background: '#b98cff' }}>{user ? initials(user.name) : '?'}</span>
          </div>
        </header>
        <div className="rf-content rf-enter">{children}</div>
      </main>

      <nav className="rf-mobile-nav">
        {navItems.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={isActive(href) ? 'active' : ''}>
            <Icon size={20} />
            <span>{label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
