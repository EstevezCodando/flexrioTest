import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Bell, Car, ChevronRight, Clock, MapPin, Navigation, Sparkles, Zap } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';
import { PwaInstallModal } from '@/components/pwa/PwaInstallModal';
import { ErrorBox, LevelBadge, Loading } from '@/components/common/ui';
import { useAuth } from '@/context/AuthContext';
import { useActiveSession, useMeta, usePriceNow, useStations, useUserRegion, useWallet } from '@/hooks/queries';
import { CHARGE_LABEL, LEVEL_HINT, money, POST_LABEL } from '@/lib/format';
import type { ChargeType } from '@/types/api';

/** Tenta a geolocalização do navegador; cai para o centro da região do usuário. */
function useOrigin(fallback?: { lat: number; lng: number }) {
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => undefined,
      { timeout: 6000, maximumAge: 300_000 },
    );
  }, []);
  return origin ?? fallback ?? null;
}

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const region = useUserRegion();
  const { data: meta } = useMeta();
  const regionMeta = meta?.regions.find((r) => r.id === region);
  const origin = useOrigin(regionMeta ? { lat: regionMeta.lat, lng: regionMeta.lng } : undefined);
  const { data: price, error: priceError } = usePriceNow(region);
  const { data: wallet } = useWallet();
  const { data: active } = useActiveSession();
  const vehicle = user?.vehicle;
  const preferred: ChargeType = vehicle && vehicle.maxDcKw >= 100 ? 'dc_ultrarrapida' : vehicle && vehicle.maxDcKw > 0 ? 'dc_rapida' : 'ac_lenta';

  const { data: recs, isLoading } = useStations(
    { lat: origin?.lat, lng: origin?.lng, radiusKm: 30, operational: true, available: true, public: true, sort: 'recomendado', limit: 3 },
    !!origin,
  );
  const best = recs?.items[0];

  return (
    <AppShell>
      <div className="rf-home-container">
        <PwaInstallBanner />

        <div className="rf-between">
          <h1 className="rf-title" style={{ fontSize: 24, margin: 0 }}>Olá, {user?.name.split(' ')[0]}</h1>
          {price && <LevelBadge level={price.signal.level} />}
        </div>

        {active && (
          <Link href="/app/session" className="rf-success" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={15} /> Recarga em andamento em <b>{active.station.name}</b> — {Math.round(active.soc)}%. Toque para acompanhar.
          </Link>
        )}

        {vehicle ? (
          <div className="rf-between rf-card" style={{ padding: '10px 14px' }}>
            <span className="rf-small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Car size={16} color="#38bdf8" />
              <b className="rf-strong">{vehicle.manufacturer} {vehicle.model}</b> · <b style={{ color: '#4ae3a5' }}>{vehicle.soc}%</b> · ~{vehicle.rangeKm} km
            </span>
            <Link href="/app/profile" className="rf-small" style={{ color: '#38bdf8' }}>Gerenciar <ChevronRight size={12} /></Link>
          </div>
        ) : (
          <Link href="/onboarding" className="rf-error">Cadastre seu veículo para recomendações compatíveis.</Link>
        )}

        {/* SINAL DE PREÇO AGORA — o repasse do mercado ao consumidor */}
        <ErrorBox error={priceError} />
        {price && (
          <div className={`rf-signal-hero ${price.signal.level}`}>
            <div style={{ maxWidth: 560 }}>
              <span className="rf-eyebrow">Energia agora · {price.region.name}</span>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#f8fafc', margin: '4px 0' }}>
                {price.signal.source === 'gestor' && price.signal.title ? price.signal.title : LEVEL_HINT[price.signal.level]}
              </div>
              <div className="rf-small">
                {CHARGE_LABEL[preferred]} por <b className="rf-strong">{money(price.consumerPrices[preferred])}/kWh</b> · custo da energia {money(price.best.totalKwh)}/kWh · posto {POST_LABEL[price.tariffPost]}
              </div>
              {price.bestWindows[0] && (
                <div className="rf-small" style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Clock size={13} /> Melhor janela nas próximas 24 h: <b className="rf-strong">{price.bestWindows[0].startHour}h–{price.bestWindows[0].endHour}h</b> (~{money(price.bestWindows[0].avgPriceKwh)}/kWh DC)
                </div>
              )}
            </div>
            <div className="rf-stack" style={{ minWidth: 170 }}>
              <Button href="/app/prices" className="secondary small"><Sparkles size={13} /> Ver preços e janelas</Button>
              <Button href="/app/alerts" className="secondary small"><Bell size={13} /> Criar alerta de preço</Button>
            </div>
          </div>
        )}

        {/* MELHOR OPÇÃO AGORA */}
        <div className="rf-card" style={{ border: '1px solid rgba(74, 227, 165, 0.38)' }}>
          <div className="rf-between" style={{ marginBottom: 10 }}>
            <span className="rf-badge">MELHOR OPÇÃO AGORA</span>
            {best && <span className="rf-tiny">score {best.score}/100</span>}
          </div>
          {isLoading && <Loading text="Buscando postos perto de você..." />}
          {best ? (
            <div className="rf-between" style={{ alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 20, margin: 0, color: '#f8fafc' }}>{best.name}</h2>
                <p className="rf-small" style={{ margin: '4px 0 0' }}>{best.address}</p>
                <div className="rf-row rf-small" style={{ marginTop: 10 }}>
                  {best.distanceKm !== null && <span><MapPin size={12} /> <b>{best.distanceKm.toFixed(1).replace('.', ',')} km</b></span>}
                  <span style={{ color: '#4ae3a5' }}>{best.connectors.available} de {best.connectors.total} livres</span>
                  <span>{best.chargeTypes.map((t) => CHARGE_LABEL[t]).join(' · ')}</span>
                  <span className="rf-strong">a partir de {money(best.cheapest.priceKwh)}/kWh</span>
                </div>
              </div>
              <Button onClick={() => setLocation(`/app/map?station=${best.id}`)}><Navigation size={15} /> Ver posto</Button>
            </div>
          ) : !isLoading && <p className="rf-small">Nenhum posto disponível no raio de 30 km. <Link href="/app/map" style={{ color: '#38bdf8' }}>Abrir mapa</Link></p>}
          {recs && recs.items.length > 1 && (
            <div className="rf-stack" style={{ marginTop: 14 }}>
              {recs.items.slice(1).map((s) => (
                <Link key={s.id} href={`/app/map?station=${s.id}`} className="rf-connector-row">
                  <span className="rf-small"><b className="rf-strong">{s.name}</b> · {s.distanceKm?.toFixed(1).replace('.', ',')} km</span>
                  <span className="rf-small">{money(s.cheapest.priceKwh)}/kWh</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* SEU MÊS */}
        {wallet && (
          <div className="rf-kpis">
            <div className="rf-kpi"><span>Créditos</span><strong style={{ color: '#c084fc' }}>{money(wallet.balance)}</strong><small>{wallet.credits} créditos para abater</small></div>
            <div className="rf-kpi"><span>Energia flexível</span><strong style={{ color: '#4ae3a5' }}>{wallet.stats.flexibleEnergyKwh.toFixed(1).replace('.', ',')} kWh</strong><small>em janelas verdes ou modulação</small></div>
            <div className="rf-kpi"><span>Recargas</span><strong style={{ color: '#38bdf8' }}>{wallet.stats.sessions}</strong><small>{wallet.stats.flexEventsAccepted} com modulação aceita</small></div>
          </div>
        )}
      </div>
      <PwaInstallModal />
    </AppShell>
  );
}
