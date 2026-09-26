import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Crosshair, Info, List, Map as MapIcon, MapPin, Navigation, PlugZap, Search, Sparkles, X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { WhyRecommendedModal } from '@/pages/map/WhyRecommendedModal';
import { StationDetailModal } from '@/pages/map/StationDetailModal';
import { stations } from '@/data/stations';
import { POPULAR_LOCATIONS, PRESET_DESTINATIONS } from '@/data/locations';
import { getDistanceKm, resolveAddress } from '@/lib/geo';
import { money } from '@/lib/format';
import type { ChargingStation } from '@/types/station';

export default function MapPage() {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Filtros limpos (sem emojis)
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false);
  const [filterCcs2Only, setFilterCcs2Only] = useState(false);
  const [filterLowestPrice, setFilterLowestPrice] = useState(false);

  // Localização
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [originInput, setOriginInput] = useState<string>('Obtendo localização...');
  const [originType, setOriginType] = useState<'gps' | 'manual'>('manual');
  const [isOriginSearching, setIsOriginSearching] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');

  const [destination, setDestination] = useState<{ id?: string; name: string; lat: number; lng: number } | null>(null);
  const [destSearchTerm, setDestSearchTerm] = useState('');
  const [isDestSearching, setIsDestSearching] = useState(false);

  // Modais de Apoio
  const [selectedStation, setSelectedStation] = useState<ChargingStation>(stations[0]); // COPPE Solar por padrão
  const [isWhyModalOpen, setIsWhyModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Centro dinâmico do mapa
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom: number }>({
    lat: -22.8606,
    lng: -43.2307,
    zoom: 13,
  });

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      setOriginInput('Botafogo, Rio de Janeiro');
      return;
    }

    setGeoStatus('loading');
    setOriginInput('Buscando sinal GPS...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ latitude: lat, longitude: lng });
        setGeoStatus('granted');
        setOriginType('gps');
        setMapCenter({ lat, lng, zoom: 14 });
        const addr = await resolveAddress(lat, lng);
        setOriginInput(addr);
      },
      () => {
        setGeoStatus('denied');
        setOriginType('manual');
        if (!userCoords) {
          const lat = -22.9452;
          const lng = -43.1818;
          setUserCoords({ latitude: lat, longitude: lng });
          setOriginInput('Botafogo, Rio de Janeiro');
          setMapCenter({ lat, lng, zoom: 13 });
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const handleSelectDestination = (dest: { id?: string; name: string; lat: number; lng: number }) => {
    setDestination(dest);
    setIsDestSearching(false);
    setDestSearchTerm('');
    setMapCenter({ lat: dest.lat, lng: dest.lng, zoom: 14 });

    // Seleciona o posto mais próximo do destino
    const nearest = [...stations].sort((a, b) => {
      const dA = getDistanceKm(dest.lat, dest.lng, a.latitude, a.longitude);
      const dB = getDistanceKm(dest.lat, dest.lng, b.latitude, b.longitude);
      return dA - dB;
    })[0];
    if (nearest) setSelectedStation(nearest);
  };

  // Filtragem de Postos
  const filteredStations = useMemo(() => {
    let result = [...stations];
    if (filterAvailableOnly) {
      result = result.filter((s) => s.availableConnectors > 0);
    }
    if (filterCcs2Only) {
      result = result.filter((s) => s.connectors.some((c) => c.type === 'CCS2'));
    }
    if (filterLowestPrice) {
      result.sort((a, b) => a.pricePerKwh - b.pricePerKwh);
    } else {
      result.sort((a, b) => b.score - a.score);
    }
    return result;
  }, [filterAvailableOnly, filterCcs2Only, filterLowestPrice]);

  const routeInfo = useMemo(() => {
    if (!userCoords) return null;
    const targetLat = destination ? destination.lat : selectedStation.latitude;
    const targetLng = destination ? destination.lng : selectedStation.longitude;
    const dist = getDistanceKm(userCoords.latitude, userCoords.longitude, targetLat, targetLng);
    const eta = Math.max(2, Math.round(dist * 2.2 + 2));
    return {
      distKm: dist.toFixed(1).replace('.', ','),
      etaMin: eta,
    };
  }, [userCoords, destination, selectedStation]);

  return (
    <AppShell>
      <div className="rf-uber-view">
        {/* Card Superior Estilo Rota (Origem, Destino e Atalhos) */}
        <div className="rf-uber-header-card">
          <div className="rf-uber-route-box">
            <div className="rf-uber-connector-line" />

            {/* Ponto de Partida: Minha Localização */}
            <div className="rf-uber-point">
              <div className="rf-uber-dot origin" />
              <div className="rf-uber-point-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="rf-uber-point-label">Minha Localização</span>
                  {geoStatus === 'granted' && (
                    <span className="rf-badge green" style={{ fontSize: 9, padding: '1px 5px' }}>GPS Ativo</span>
                  )}
                </div>
                <input
                  type="text"
                  className="rf-uber-address-input"
                  placeholder="Localização atual..."
                  value={originInput}
                  onChange={(e) => {
                    setOriginInput(e.target.value);
                    setIsOriginSearching(true);
                  }}
                  onFocus={() => setIsOriginSearching(true)}
                />
              </div>

              {geoStatus !== 'granted' && (
                <button
                  type="button"
                  className="rf-uber-gps-btn"
                  onClick={requestLocation}
                  title="Ativar sinal GPS"
                >
                  <Crosshair size={12} className={geoStatus === 'loading' ? 'animate-spin' : ''} />
                  GPS
                </button>
              )}

              {isOriginSearching && (
                <div className="rf-uber-dropdown">
                  {POPULAR_LOCATIONS.map((loc) => (
                    <button
                      key={loc.name}
                      type="button"
                      className="rf-uber-dropdown-item"
                      onClick={() => {
                        setUserCoords({ latitude: loc.lat, longitude: loc.lng });
                        setOriginInput(loc.name);
                        setOriginType('manual');
                        setIsOriginSearching(false);
                        setMapCenter({ lat: loc.lat, lng: loc.lng, zoom: 14 });
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={13} color="#38bdf8" />
                        {loc.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ponto de Destino: Onde você vai? */}
            <div className="rf-uber-point">
              <div className="rf-uber-dot destination" />
              <div className="rf-uber-point-info">
                <span className="rf-uber-point-label">Para onde você vai?</span>
                {destination ? (
                  <div className="rf-uber-dest-selected">
                    <strong>{destination.name}</strong>
                    {routeInfo && (
                      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
                        ({routeInfo.distKm} km · ~{routeInfo.etaMin} min)
                      </span>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    className="rf-uber-address-input"
                    placeholder="Buscar endereço ou polo de recarga..."
                    value={destSearchTerm}
                    onFocus={() => setIsDestSearching(true)}
                    onChange={(e) => setDestSearchTerm(e.target.value)}
                  />
                )}
              </div>

              {destination ? (
                <button
                  type="button"
                  className="rf-uber-clear-dest"
                  onClick={() => setDestination(null)}
                  title="Remover destino"
                >
                  <X size={14} />
                </button>
              ) : (
                <Search size={14} style={{ color: '#64748b' }} />
              )}

              {isDestSearching && !destination && (
                <div className="rf-uber-dropdown">
                  {PRESET_DESTINATIONS.map((dest) => (
                    <button
                      key={dest.id}
                      type="button"
                      className="rf-uber-dropdown-item"
                      onClick={() => handleSelectDestination(dest)}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={13} color="#4ae3a5" />
                        {dest.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Atalhos Frequentes */}
          <div className="rf-uber-chips-bar">
            <span className="rf-uber-chips-label">Atalhos:</span>
            <div className="rf-uber-chips-scroll">
              {PRESET_DESTINATIONS.map((dest) => {
                const isActive = destination?.id === dest.id;
                return (
                  <button
                    key={dest.id}
                    type="button"
                    className={`rf-uber-chip ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectDestination(dest)}
                  >
                    {dest.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barra de Controles: Toggle Mapa/Lista e Filtros Limpos */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 4, borderTop: '1px solid #1c2732' }}>
            <div className="rf-segmented-toggle">
              <button
                type="button"
                className={`rf-segmented-btn ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
              >
                <MapIcon size={13} />
                Mapa
              </button>
              <button
                type="button"
                className={`rf-segmented-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List size={13} />
                Lista ({filteredStations.length})
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              <button
                type="button"
                className={`rf-filter-chip ${filterAvailableOnly ? 'active' : ''}`}
                onClick={() => setFilterAvailableOnly(!filterAvailableOnly)}
              >
                Disponíveis agora
              </button>
              <button
                type="button"
                className={`rf-filter-chip ${filterCcs2Only ? 'active' : ''}`}
                onClick={() => setFilterCcs2Only(!filterCcs2Only)}
              >
                Compatível CCS2
              </button>
              <button
                type="button"
                className={`rf-filter-chip ${filterLowestPrice ? 'active' : ''}`}
                onClick={() => setFilterLowestPrice(!filterLowestPrice)}
              >
                Menor tarifa
              </button>
            </div>
          </div>
        </div>

        {/* MODO MAPA */}
        {viewMode === 'map' && (
          <>
            <div className="rf-uber-map-wrap">
              <iframe
                key={`${mapCenter.lat.toFixed(4)}-${mapCenter.lng.toFixed(4)}-${mapCenter.zoom}`}
                src={`https://carregados.com.br/embed?lat=${mapCenter.lat}&lng=${mapCenter.lng}&z=${mapCenter.zoom}&theme=dark&mode=homepage`}
                title="Rede de Eletropostos em Tempo Real"
                className="rf-uber-map-frame"
                loading="lazy"
                allow="geolocation"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>

            {/* DOCK INFERIOR: Posto Selecionado com Navegação e Detalhes */}
            <div className="rf-station-dock">
              <div className="rf-station-dock-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 className="rf-station-dock-title">{selectedStation.name}</h3>
                    {selectedStation.id === 'coppe' && (
                      <span className="rf-badge green" style={{ fontSize: 9, padding: '2px 7px' }}>
                        Recomendado
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsWhyModalOpen(true)}
                      title="Por que recomendamos este posto?"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: 0,
                      }}
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  <div className="rf-station-dock-meta">
                    {selectedStation.address} · {routeInfo ? `${routeInfo.distKm} km (~${routeInfo.etaMin} min)` : '2,1 km (~8 min)'}
                  </div>
                </div>

                {selectedStation.incentive && (
                  <span className="rf-station-dock-bonus">
                    <Sparkles size={12} />
                    + {money(selectedStation.incentive.value)} de crédito
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
                <span>
                  <b style={{ color: '#f1f5f9' }}>{selectedStation.availableConnectors} de {selectedStation.totalConnectors} vagas livres</b> · CCS2 ({selectedStation.specs.maxPowerKw} kW)
                </span>
                <span style={{ color: '#4ae3a5', fontWeight: 700 }}>
                  {money(selectedStation.pricePerKwh)}/kWh
                </span>
              </div>

              {/* Botões do Dock */}
              <div className="rf-station-dock-actions">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStation.latitude},${selectedStation.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rf-btn secondary"
                >
                  <Navigation size={13} />
                  Navegar no Google Maps
                </a>

                <button
                  type="button"
                  className="rf-btn primary"
                  onClick={() => setIsDetailModalOpen(true)}
                >
                  <PlugZap size={13} />
                  Ver detalhes & Conectar
                </button>
              </div>
            </div>
          </>
        )}

        {/* MODO LISTA ALTERNATIVO */}
        {viewMode === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0', zIndex: 2 }}>
            {filteredStations.map((station, idx) => {
              const isSelected = selectedStation.id === station.id;
              return (
                <div
                  key={station.id}
                  className="rf-card"
                  style={{
                    background: isSelected ? '#151f2a' : '#10171f',
                    border: `1px solid ${isSelected ? '#38bdf8' : '#22303e'}`,
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>#{idx + 1}</span>
                        <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>{station.name}</h3>
                        {station.id === 'coppe' && (
                          <span className="rf-badge green" style={{ fontSize: 9, padding: '1px 6px' }}>Recomendado</span>
                        )}
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>{station.address}</p>

                      <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 12, color: '#cbd5e1', flexWrap: 'wrap' }}>
                        <span><b>{station.distanceKm} km</b> · ~{station.etaMinutes} min</span>
                        <span>•</span>
                        <span style={{ color: '#4ae3a5' }}>{station.availableConnectors} de {station.totalConnectors} livres</span>
                        <span>•</span>
                        <span><b>{money(station.pricePerKwh)}</b>/kWh</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      {station.incentive && (
                        <span className="rf-badge purple" style={{ fontSize: 10, padding: '2px 7px' }}>
                          <Sparkles size={11} /> + {money(station.incentive.value)} créditos
                        </span>
                      )}

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="rf-btn secondary small"
                          onClick={() => {
                            setSelectedStation(station);
                            setMapCenter({ lat: station.latitude, lng: station.longitude, zoom: 14 });
                            setViewMode('map');
                          }}
                        >
                          Ver no Mapa
                        </button>
                        <button
                          type="button"
                          className="rf-btn primary small"
                          onClick={() => {
                            setSelectedStation(station);
                            setIsDetailModalOpen(true);
                          }}
                        >
                          Detalhes
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modais do Mapa */}
      <WhyRecommendedModal
        isOpen={isWhyModalOpen}
        onClose={() => setIsWhyModalOpen(false)}
        station={selectedStation}
      />

      <StationDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        station={selectedStation}
        onConnect={() => {
          setIsDetailModalOpen(false);
          setLocation('/app/session');
        }}
      />
    </AppShell>
  );
}
