import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Car, ChevronRight, HelpCircle, MapPin, Navigation, Sparkles, Sun, Wallet, Zap,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';
import { PwaInstallModal } from '@/components/pwa/PwaInstallModal';
import { EnergyModal } from '@/pages/home/EnergyModal';
import { stations } from '@/data/stations';
import { initialVehicle } from '@/data/vehicles';
import { money } from '@/lib/format';

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [isEnergyModalOpen, setIsEnergyModalOpen] = useState(false);
  const [vehicle] = useState(initialVehicle);

  const featuredStation = stations[0]; // COPPE Solar

  return (
    <AppShell>
      <div className="rf-home-container">
        {/* BANNER DE INSTALAÇÃO PWA PARA USUÁRIOS DE CELULAR */}
        <PwaInstallBanner />

        {/* Topo do Usuário: Saudação e Status do Carro */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <h1 className="rf-title" style={{ fontSize: 24, margin: 0 }}>Olá, Marcos</h1>
            <span className="rf-badge green" style={{ fontSize: 11, padding: '3px 9px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ae3a5', display: 'inline-block', marginRight: 6 }} />
              Rede Estável
            </span>
          </div>

          {/* Barra de Status do Carro com link de gerenciamento */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#11171d',
              border: '1px solid #202b36',
              borderRadius: 12,
              padding: '9px 14px',
              fontSize: 13,
              color: '#cbd5e1',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Car size={16} color="#38bdf8" />
              <span>
                Seu carro: <b style={{ color: '#f8fafc' }}>{vehicle.manufacturer} {vehicle.model}</b> · <b style={{ color: '#4ae3a5' }}>{vehicle.currentSoc}%</b> de bateria · ~{vehicle.estimatedRangeKm} km de autonomia
              </span>
            </div>
            <Link
              href="/app/profile"
              style={{ fontSize: 12, color: '#38bdf8', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              Gerenciar <ChevronRight size={13} />
            </Link>
          </div>
        </div>

        {/* 1. HERO ELEMENT: MELHOR OPÇÃO AGORA */}
        <div
          className="rf-card"
          style={{
            background: 'linear-gradient(135deg, rgba(74, 227, 165, 0.09) 0%, rgba(56, 189, 248, 0.05) 100%)',
            border: '1px solid rgba(74, 227, 165, 0.38)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: '#4ae3a5',
                background: 'rgba(74, 227, 165, 0.15)',
                padding: '4px 9px',
                borderRadius: 20,
                border: '1px solid rgba(74, 227, 165, 0.3)',
              }}
            >
              MELHOR OPÇÃO AGORA
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
                color: '#c084fc',
                background: 'rgba(192, 132, 252, 0.12)',
                padding: '3px 10px',
                borderRadius: 20,
                border: '1px solid rgba(192, 132, 252, 0.25)',
              }}
            >
              <Sparkles size={12} /> + R$ 4,50 em créditos
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                {featuredStation.name}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                {featuredStation.address}
              </p>

              <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, color: '#cbd5e1', flexWrap: 'wrap' }}>
                <span><b>{featuredStation.distanceKm} km</b> · ~{featuredStation.etaMinutes} min</span>
                <span>•</span>
                <span style={{ color: '#4ae3a5', fontWeight: 600 }}>{featuredStation.availableConnectors} carregadores livres</span>
                <span>•</span>
                <span>{money(featuredStation.pricePerKwh)}/kWh</span>
                <span>•</span>
                <span style={{ color: '#f7c65c' }}>100% Solar COPPE</span>
              </div>
            </div>

            {/* Ações: Ir para o posto (SEM iniciar recarga à distância) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
              <Button
                className="primary"
                onClick={() => setLocation(`/app/map?station=${featuredStation.id}`)}
              >
                <Navigation size={15} />
                Ir para o posto
              </Button>
              <Link
                href="/app/map"
                style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                Ver outras opções <ChevronRight size={13} />
              </Link>
            </div>
          </div>
        </div>

        {/* 2. CARD: ENERGIA AGORA */}
        <div
          className="rf-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            padding: 16,
            background: '#10171f',
            border: '1px solid #233241',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(74, 227, 165, 0.12)',
                border: '1px solid rgba(74, 227, 165, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4ae3a5',
                flexShrink: 0,
              }}
            >
              <Sun size={22} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="rf-eyebrow" style={{ margin: 0, color: '#4ae3a5' }}>ENERGIA AGORA</span>
                <span className="rf-badge green" style={{ fontSize: 10, padding: '1px 6px' }}>Oferta Alta</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
                Bom momento para carregar até as 16h
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Próximo pico: <b>18h às 21h</b> · Evite recargas para poupar custos e a rede.
              </div>
            </div>
          </div>

          <button
            type="button"
            className="rf-btn secondary small"
            onClick={() => setIsEnergyModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <HelpCircle size={14} />
            Entender por quê
          </button>
        </div>

        {/* 3. CARD: SEU MÊS */}
        <div className="rf-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <span className="rf-eyebrow" style={{ margin: 0 }}>SEU MÊS</span>
              <h3 style={{ margin: '2px 0 0', fontSize: 16, color: '#f8fafc' }}>Resumo de Flexibilidade</h3>
            </div>
            <Link
              href="/app/wallet"
              style={{ fontSize: 12, color: '#38bdf8', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Ver desempenho <ChevronRight size={13} />
            </Link>
          </div>

          <div className="rf-compact-impact-grid">
            <div className="rf-compact-impact-card">
              <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Economia Acumulada
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#4ae3a5', margin: '4px 0 2px' }}>
                R$ 142,50
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>vs. tarifas de ponta</div>
            </div>

            <div className="rf-compact-impact-card">
              <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Saldo em Carteira
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#c084fc', margin: '4px 0 2px' }}>
                224 créditos
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>≈ R$ 22,40 para abater</div>
            </div>

            <div className="rf-compact-impact-card">
              <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cargas Inteligentes
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', margin: '4px 0 2px' }}>
                6 sessões
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>100% fora do pico crítico</div>
            </div>
          </div>
        </div>

        {/* 4. ATALHOS RÁPIDOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Link href="/app/map" className="rf-home-action-card">
            <div className="action-icon"><MapPin size={18} /></div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>Mapa dos Postos</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Encontre carregadores com vagas livres no trajeto</div>
          </Link>

          <Link href="/app/session" className="rf-home-action-card">
            <div className="action-icon"><Zap size={18} /></div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>Sessão de Recarga</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Acompanhar status ativo e telemetria de carga</div>
          </Link>

          <Link href="/app/wallet" className="rf-home-action-card">
            <div className="action-icon"><Wallet size={18} /></div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>Minha Carteira</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Créditos acumulados e histórico de impacto</div>
          </Link>
        </div>
      </div>

      {/* Modais da Home */}
      <EnergyModal
        isOpen={isEnergyModalOpen}
        onClose={() => setIsEnergyModalOpen(false)}
      />

      <PwaInstallModal />
    </AppShell>
  );
}
