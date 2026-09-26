import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Bell, Download, Home as HomeIcon, LogOut, MapPin, Receipt, Smartphone, UserRound, Wallet, Zap,
} from 'lucide-react';
import { Brand } from '@/components/common/Brand';
import { usePwa } from '@/context/PwaContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications, useWallet } from '@/hooks/queries';
import { initials, money } from '@/lib/format';

const navItems = [
  { href: '/app', label: 'Início', icon: HomeIcon },
  { href: '/app/map', label: 'Mapa', icon: MapPin },
  { href: '/app/prices', label: 'Preços', icon: Receipt },
  { href: '/app/session', label: 'Carregar', icon: Zap },
  { href: '/app/wallet', label: 'Carteira', icon: Wallet },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isInstallable, isInstalled, promptInstall } = usePwa();
  const { user, logout } = useAuth();
  const { data: notifications } = useNotifications();
  const { data: wallet } = useWallet();
  const unread = notifications?.unread ?? 0;

  const isActive = (href: string) => {
    if (href === '/app') return location === '/app' || location === '/app/home';
    return location.startsWith(href);
  };

  return (
    <div className="rf-app rf-shell">
      <aside className="rf-sidebar">
        <Brand light />
        <div className="rf-nav-section">Navegação Principal</div>
        <nav className="rf-nav">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`rf-nav-link ${isActive(href) ? 'active' : ''}`}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="rf-nav-section" style={{ marginTop: 28 }}>Minha Conta</div>
        <nav className="rf-nav">
          <Link href="/app/alerts" className={`rf-nav-link ${isActive('/app/alerts') ? 'active' : ''}`}>
            <Bell size={18} />
            Alertas {unread > 0 && <span className="rf-badge red" style={{ marginLeft: 'auto', padding: '2px 7px' }}>{unread}</span>}
          </Link>
          <Link href="/app/profile" className={`rf-nav-link ${isActive('/app/profile') ? 'active' : ''}`}>
            <UserRound size={18} />
            Perfil & Veículo
          </Link>
          <button
            type="button"
            className="rf-nav-link"
            style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
            onClick={async () => { await logout(); setLocation('/login'); }}
          >
            <LogOut size={18} />
            Sair
          </button>
        </nav>

        {!isInstalled && isInstallable && (
          <div style={{ marginTop: 20 }}>
            <button type="button" onClick={promptInstall} className="rf-btn secondary small full">
              <Download size={13} />
              Instalar no Celular
            </button>
          </div>
        )}

        {wallet && (
          <div className="rf-asset-note" style={{ marginTop: 'auto' }}>
            <div className="rf-eyebrow">Créditos Rio Flex</div>
            <p style={{ margin: '6px 0 10px', fontSize: 12 }}>
              Você tem <b>{wallet.credits} créditos</b> (≈ {money(wallet.balance)}) acumulados.
            </p>
            <Link href="/app/wallet" className="rf-btn secondary small full">Ver Carteira</Link>
          </div>
        )}
      </aside>

      <main className="rf-main">
        <header className="rf-topbar">
          <div className="rf-topbar-brand" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16, color: '#f8fafc' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4ae3a5', boxShadow: '0 0 10px #4ae3a5' }} />
            Rio Flex
          </div>

          <div className="rf-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isInstalled && (
              <button type="button" className="rf-btn secondary small" onClick={promptInstall} style={{ padding: '4px 10px', fontSize: 11 }}>
                <Smartphone size={13} color="#4ae3a5" />
                Instalar
              </button>
            )}
            <Link href="/app/alerts" className="rf-bell" aria-label={`Alertas (${unread} não lidos)`}>
              <Bell size={16} />
              {unread > 0 && <b>{unread > 9 ? '9+' : unread}</b>}
            </Link>
            <Link href="/app/profile" className="rf-avatar" aria-label="Abrir perfil">
              {user ? initials(user.name) : '?'}
            </Link>
          </div>
        </header>

        <div className="rf-content rf-enter">{children}</div>
      </main>

      <nav className="rf-mobile-nav">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={isActive(href) ? 'active' : ''}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
