import { useEffect, useMemo, useState } from 'react';
import { useSearch } from 'wouter';
import { Crosshair, List, Map as MapIcon, Search } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { LevelBadge, Loading } from '@/components/common/ui';
import { useMeta, useStationMarkers, useStations, useUserRegion } from '@/hooks/queries';
import { CHARGE_LABEL, money } from '@/lib/format';
import type { ChargeType } from '@/types/api';
import { StationDetailModal } from './StationDetailModal';
import { StationMap } from './StationMap';

export default function MapPage() {
  const search = useSearch();
  const region = useUserRegion();
  const { data: meta } = useMeta();
  const { data: markers } = useStationMarkers();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const id = Number(new URLSearchParams(search).get('station'));
    return Number.isFinite(id) && id > 0 ? id : null;
  });
  const [user, setUser] = useState<{ lat: number; lng: number } | null>(null);
  const [center, setCenter] = useState({ lat: -22.93, lng: -43.25, zoom: 11 });

  // Filtros
  const [q, setQ] = useState('');
  const [chargeType, setChargeType] = useState<ChargeType | ''>('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [publicOnly, setPublicOnly] = useState(true);
  const [sort, setSort] = useState('recomendado');
  const [filterRegion, setFilterRegion] = useState('');

  useEffect(() => {
    const r = meta?.regions.find((x) => x.id === region);
    if (r && !selectedId) setCenter({ lat: r.lat, lng: r.lng, zoom: region === 'capital' ? 11 : 10 });
  }, [meta, region, selectedId]);

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUser(pos);
        setCenter({ ...pos, zoom: 13 });
      },
      () => undefined,
      { timeout: 8000 },
    );
  useEffect(() => {
    locate();
  }, []);

  const { data: list, isFetching } = useStations({
    q: q || undefined,
    chargeType: chargeType || undefined,
    available: availableOnly || undefined,
    public: publicOnly || undefined,
    region: filterRegion || undefined,
    lat: user?.lat,
    lng: user?.lng,
    sort: sort === 'distancia' && !user ? 'recomendado' : sort,
    limit: 40,
  });

  // O mapa mostra os marcadores filtrados pelos mesmos critérios básicos.
  const shownMarkers = useMemo(() => {
    if (!markers) return [];
    const needle = q.trim().toLowerCase();
    return markers.filter(
      (m) =>
        (!publicOnly || m.pub) &&
        (!availableOnly || m.av > 0) &&
        (!chargeType || (chargeType.startsWith('dc') ? m.dc : true)) &&
        (!needle || m.n.toLowerCase().includes(needle)),
    );
  }, [markers, q, publicOnly, availableOnly, chargeType]);

  return (
    <AppShell>
      <div className="rf-page">
        <div className="rf-page-head">
          <div>
            <span className="rf-eyebrow">{meta?.dataset.stats.stations ?? '...'} locais · base {meta?.dataset.snapshot}</span>
            <h1 className="rf-title">Eletropostos no Rio de Janeiro</h1>
          </div>
          <div className="rf-segmented-toggle">
            <button type="button" className={`rf-segmented-btn ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}><MapIcon size={13} /> Mapa</button>
            <button type="button" className={`rf-segmented-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}><List size={13} /> Lista ({list?.total ?? 0})</button>
          </div>
        </div>

        <div className="rf-card rf-row" style={{ padding: 12 }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 13, color: '#66727e' }} />
            <input className="rf-input" style={{ paddingLeft: 30 }} placeholder="Buscar por nome, bairro, rede..." value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
          </div>
          <select className="rf-select" value={chargeType} onChange={(e) => setChargeType(e.target.value as ChargeType | '')} aria-label="Tipo de recarga">
            <option value="">Todos os tipos</option>
            {meta?.chargeTypes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select className="rf-select" value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} aria-label="Região">
            <option value="">Todas as regiões</option>
            {meta?.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="rf-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
            <option value="recomendado">Recomendados</option>
            <option value="preco">Menor preço</option>
            <option value="distancia" disabled={!user}>Mais perto</option>
            <option value="potencia">Maior potência</option>
          </select>
          <button type="button" className={`rf-filter-chip ${availableOnly ? 'active' : ''}`} onClick={() => setAvailableOnly(!availableOnly)}>Livres agora</button>
          <button type="button" className={`rf-filter-chip ${publicOnly ? 'active' : ''}`} onClick={() => setPublicOnly(!publicOnly)}>Só públicos</button>
          <button type="button" className="rf-btn secondary small" onClick={locate} title="Usar minha localização"><Crosshair size={13} /> GPS</button>
        </div>

        {view === 'map' && (
          <>
            {markers && meta ? (
              <StationMap markers={shownMarkers} selectedId={selectedId} center={center} user={user} onSelect={setSelectedId} mapboxToken={meta?.map?.token ?? null} />
            ) : <Loading text="Carregando estações..." />}
            <div className="rf-map-legend">
              <span><i style={{ background: '#4ae3a5' }} />DC livre</span>
              <span><i style={{ background: '#55a7ff' }} />AC livre</span>
              <span><i style={{ background: '#f7c65c' }} />todos ocupados</span>
              <span><i style={{ background: '#66727e' }} />manutenção/inativo</span>
              <span>· {shownMarkers.length} no mapa</span>
            </div>
          </>
        )}

        {view === 'list' && (
          <div className="rf-stack">
            {isFetching && !list && <Loading />}
            {list?.items.map((s, i) => (
              <div key={s.id} className="rf-card" style={{ padding: 14, cursor: 'pointer' }} onClick={() => setSelectedId(s.id)}>
                <div className="rf-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="rf-row">
                      <span className="rf-tiny">#{i + 1}</span>
                      <b className="rf-strong">{s.name}</b>
                      {s.status !== 'operacional' && <span className="rf-badge gray">{s.status}</span>}
                    </div>
                    <div className="rf-small" style={{ marginTop: 3 }}>{s.address}</div>
                    <div className="rf-row rf-small" style={{ marginTop: 6 }}>
                      {s.distanceKm !== null && <span><b>{s.distanceKm.toFixed(1).replace('.', ',')} km</b></span>}
                      <span style={{ color: s.connectors.available ? '#4ae3a5' : '#f7c65c' }}>{s.connectors.available}/{s.connectors.total} livres</span>
                      <span>{s.chargeTypes.map((t) => CHARGE_LABEL[t]).join(' · ') || 'tipo não informado'}</span>
                      {s.maxPowerKw && <span>até {s.maxPowerKw} kW</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="rf-mono rf-strong">{money(s.cheapest.priceKwh)}<span className="rf-tiny">/kWh</span></div>
                    <LevelBadge level={s.signalLevel} label={s.signalLevel} />
                    <div className="rf-tiny" style={{ marginTop: 4 }}>score {s.score}</div>
                  </div>
                </div>
              </div>
            ))}
            {list && list.total > list.items.length && <div className="rf-tiny">Mostrando {list.items.length} de {list.total}. Refine os filtros para ver outros.</div>}
          </div>
        )}
      </div>

      <StationDetailModal stationId={selectedId} onClose={() => setSelectedId(null)} origin={user} />
    </AppShell>
  );
}
