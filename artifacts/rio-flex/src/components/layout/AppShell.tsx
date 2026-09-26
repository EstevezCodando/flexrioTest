import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Download, Home as HomeIcon, MapPin, Smartphone, UserRound, Wallet, Zap,
} from 'lucide-react';
import { Brand } from '@/components/common/Brand';
import { usePwa } from '@/context/PwaContext';

const navItems = [
  { href: '/app', label: 'Início', icon: HomeIcon },
  { href: '/app/map', label: 'Mapa', icon: MapPin },
  { href: '/app/session', label: 'Carregar', icon: Zap },
  { href: '/app/wallet', label: 'Carteira', icon: Wallet },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isInstallable, isInstalled, promptInstall } = usePwa();

  const isActive = (href: string) => {
    if (href === '/app') return location === '/app' || location === '/app/home';
    return location.startsWith(href);
  };

  return (
    <div className="rf-app rf-shell">
      {/* Sidebar Desktop */}
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
          <Link href="/app/profile" className={`rf-nav-link ${location === '/app/profile' ? 'active' : ''}`}>
            <UserRound size={18} />
            Perfil & Veículo
          </Link>
        </nav>

        {!isInstalled && isInstallable && (
          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              onClick={promptInstall}
              className="rf-btn secondary small full"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Download size={13} />
              Instalar no Celular
            </button>
          </div>
        )}

        <div className="rf-asset-note" style={{ marginTop: 'auto' }}>
          <div className="rf-eyebrow">Créditos Rio Flex</div>
          <p style={{ margin: '6px 0 10px', fontSize: 12 }}>
            Você tem <b>224 créditos</b> (≈ R$ 22,40) acumulados.
          </p>
          <Link href="/app/wallet" className="rf-btn secondary small full">
            Ver Carteira
          </Link>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="rf-main">
        <header className="rf-topbar">
          <div
            className="rf-topbar-brand"
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: '#f8fafc' }}
          >
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4ae3a5', boxShadow: '0 0 10px #4ae3a5' }} />
            Rio Flex
          </div>

          <div className="rf-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isInstalled && (
              <button
                type="button"
                className="rf-btn secondary small"
                onClick={promptInstall}
                style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                title="Instalar no celular ou computador"
              >
                <Smartphone size={13} color="#4ae3a5" />
                Instalar App
              </button>
            )}

            <Link href="/app/profile" className="rf-avatar" aria-label="Abrir perfil">
              MS
            </Link>
          </div>
        </header>

        <div className="rf-content rf-enter">{children}</div>
      </main>

      {/* Bottom Navigation Mobile */}
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
