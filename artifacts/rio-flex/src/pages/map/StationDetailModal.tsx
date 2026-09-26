import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { AlertTriangle, ExternalLink, Navigation, PlugZap, X } from 'lucide-react';
import { ErrorBox, LevelBadge, Loading } from '@/components/common/ui';
import { useAuth } from '@/context/AuthContext';
import { useStation } from '@/hooks/queries';
import { api } from '@/lib/api';
import { CHARGE_LABEL, LEVEL_COLOR, money, POST_LABEL } from '@/lib/format';

const STATUS_LABEL = { disponivel: 'Disponível', ocupado: 'Ocupado', indisponivel: 'Indisponível' } as const;
const STATION_STATUS = { operacional: 'Operacional', manutencao: 'Em manutenção', inativa: 'Inativa', em_obra: 'Em obra / futura' } as const;

type Props = { stationId: number | null; onClose: () => void; origin?: { lat: number; lng: number } | null };

export function StationDetailModal({ stationId, onClose, origin }: Props) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: s, isLoading, error } = useStation(stationId, origin);
  const [startError, setStartError] = useState<unknown>(null);

  const start = useMutation({
    mutationFn: (connectorId: number) => api.post('/me/charging', { stationId, connectorId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charging-active'] });
      setLocation('/app/session');
    },
    onError: setStartError,
  });

  if (stationId === null) return null;
  const vehicleConnector = user?.vehicle?.connector ?? 'CCS2';

  return (
    <div className="rf-modal-overlay" onClick={onClose}>
      <div className="rf-modal-box" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="rf-modal-header">
          <div>
            {s && (
              <div className="rf-row" style={{ marginBottom: 6 }}>
                {s.network && <span className="rf-badge blue">{s.network}</span>}
                <span className={`rf-badge ${s.status === 'operacional' ? '' : 'gray'}`}>{STATION_STATUS[s.status]}</span>
                {!s.isPublic && <span className="rf-badge yellow">acesso restrito</span>}
              </div>
            )}
            <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>{s?.name ?? 'Carregando...'}</h3>
            {s && <p className="rf-small" style={{ margin: '3px 0 0' }}>{s.address} · {s.regionName}{s.distanceKm !== null ? ` · ${s.distanceKm.toFixed(1).replace('.', ',')} km` : ''}</p>}
          </div>
          <button type="button" className="rf-modal-close" onClick={onClose} title="Fechar"><X size={18} /></button>
        </div>

        {isLoading && <Loading />}
        <ErrorBox error={error} />

        {s && (
          <div className="rf-stack">
            {/* Custo de energia e sinal */}
            <div className="rf-connector-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
              <div className="rf-between" style={{ width: '100%' }}>
                <span className="rf-eyebrow">Energia agora</span>
                <LevelBadge level={s.energyNow.signal.level} />
              </div>
              <div className="rf-small">
                Custo da energia <b className="rf-strong">{money(s.energyNow.breakdown.custoEnergiaKwh)}/kWh</b> · PLD {money(s.energyNow.pldMwh)}/MWh ·
                posto {POST_LABEL[s.energyNow.tariffPost]} · melhor oferta: {s.energyNow.supplier}
              </div>
              <div className="rf-tiny">
                energia {money(s.energyNow.breakdown.energiaKwh)} + fio {money(s.energyNow.breakdown.fioKwh)} + encargos {money(s.energyNow.breakdown.encargosKwh)} + tributos {money(s.energyNow.breakdown.tributosKwh)}
              </div>
            </div>

            {/* Tipos de recarga disponíveis */}
            <div>
              <div className="rf-eyebrow" style={{ marginBottom: 8 }}>Tipos de carregamento e preço Rio Flex</div>
              <div className="rf-charge-grid">
                {s.chargeTypes.map((t) => (
                  <div key={t} className="rf-charge-card">
                    <div className="rf-strong">{CHARGE_LABEL[t]}</div>
                    <div className="price">{money(s.prices[t] ?? 0)}<span className="rf-small">/kWh</span></div>
                  </div>
                ))}
              </div>
              {s.publishedPriceKwh !== null && (
                <div className="rf-tiny" style={{ marginTop: 6 }}>
                  Preço publicado na base pública: {money(s.publishedPriceKwh)}/kWh{s.activationFee ? ` + ativação ${money(s.activationFee)}` : ''}
                  {s.priceConflict && ' · ⚠ divergência entre descrição e preço na fonte'}
                </div>
              )}
            </div>

            {/* Previsão curta */}
            <div>
              <div className="rf-eyebrow" style={{ marginBottom: 6 }}>Próximas horas</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 46 }}>
                {s.forecast.slice(0, 24).map((f) => {
                  const p = f.prices[s.chargeTypes[s.chargeTypes.length - 1]] ?? 0;
                  return (
                    <div key={f.localTime} title={`${f.localHour}h · ${money(p)}`} style={{ flex: 1, height: `${Math.min(100, (p / 4) * 100)}%`, background: LEVEL_COLOR[f.level], borderRadius: 3, opacity: 0.85 }} />
                  );
                })}
              </div>
              <div className="rf-between rf-tiny"><span>{s.forecast[0]?.localHour}h</span><span>+24h</span></div>
            </div>

            {/* Conectores */}
            <div className="rf-stack">
              <div className="rf-eyebrow">Conectores ({s.connectors.available}/{s.connectors.total} livres)</div>
              {s.connectorsDetail.length === 0 && <div className="rf-small">A fonte não detalha conectores deste local.</div>}
              {s.connectorsDetail.map((c) => {
                const compatible = c.current === 'AC' || c.type.toUpperCase().includes(vehicleConnector.toUpperCase().replace('CCS2', 'CCS'));
                return (
                  <div key={c.id} className="rf-connector-row">
                    <div>
                      <div className="rf-strong" style={{ fontSize: 13 }}>
                        <span className={`rf-status-dot ${c.status}`} style={{ marginRight: 8 }} />
                        {c.type} · {c.current} · {c.powerKw} kW{!c.powerKnown && ' (estimado)'}
                      </div>
                      <div className="rf-tiny">{c.chargeTypeLabel} · {STATUS_LABEL[c.status]} · {money(c.priceKwh)}/kWh{!compatible && ' · incompatível com seu veículo'}</div>
                    </div>
                    {user?.role === 'consumer' && c.status === 'disponivel' && compatible && (
                      <button type="button" className="rf-btn small" disabled={start.isPending} onClick={() => start.mutate(c.id)}>
                        <PlugZap size={13} /> Iniciar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <ErrorBox error={startError} />

            {s.quality.length > 0 && (
              <div className="rf-tiny" style={{ display: 'flex', gap: 6 }}>
                <AlertTriangle size={12} color="#f7c65c" style={{ flexShrink: 0 }} />
                Qualidade do cadastro: {s.quality.map((q) => q.note ?? q.code).join(' · ')}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noopener noreferrer" className="rf-btn secondary full">
                <Navigation size={14} /> Navegar até lá
              </a>
              {s.sourceUrl && (
                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="rf-btn secondary">
                  <ExternalLink size={14} /> Fonte
                </a>
              )}
            </div>
            <div className="rf-tiny">Base: {s.snapshotId} · disponibilidade simulada.</div>
          </div>
        )}
      </div>
    </div>
  );
}
