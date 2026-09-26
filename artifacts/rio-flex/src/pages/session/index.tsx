import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Check, MapPin, Zap } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';
import { ErrorBox, LevelBadge, Loading } from '@/components/common/ui';
import { StopConfirmModal } from '@/pages/session/StopConfirmModal';
import { useActiveSession, useWallet } from '@/hooks/queries';
import { api } from '@/lib/api';
import { kwh, money } from '@/lib/format';
import type { ChargingSession } from '@/types/api';

export default function SessionPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { data: session, isLoading } = useActiveSession(true);
  const { data: wallet } = useWallet();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const flex = useMutation({
    mutationFn: (id: string) => api.post<ChargingSession>(`/me/charging/${id}/flex`),
    onSuccess: (s) => qc.setQueryData(['charging-active'], s),
    onError: setError,
  });
  const stop = useMutation({
    mutationFn: ({ id, useCredits }: { id: string; useCredits: boolean }) =>
      api.post<{ session: ChargingSession; amountDue: number; creditsUsed: number }>(`/me/charging/${id}/stop`, { useCredits }),
    onSuccess: (r) => {
      sessionStorage.setItem(`rf-receipt-${r.session.id}`, JSON.stringify({ amountDue: r.amountDue, creditsUsed: r.creditsUsed }));
      ['charging-active', 'charging-history', 'wallet', 'notifications', 'markers'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setLocation(`/app/receipt/${r.session.id}`);
    },
    onError: setError,
  });

  if (isLoading) return <AppShell><Loading /></AppShell>;

  if (!session) {
    return (
      <AppShell>
        <div className="rf-card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
          <Zap size={28} color="#4ae3a5" />
          <h2 style={{ margin: '10px 0 6px' }}>Nenhuma recarga em andamento</h2>
          <p className="rf-small">Escolha um posto no mapa, confira o preço e o tipo de carregamento e toque em <b>Iniciar</b> no conector livre.</p>
          <Button href="/app/map" style={{ marginTop: 10 }}><MapPin size={14} /> Abrir mapa</Button>
        </div>
      </AppShell>
    );
  }

  const s = session;
  return (
    <AppShell>
      <div className="rf-clean-session-container">
        <div className="rf-between">
          <div>
            <span className="rf-eyebrow">Sessão ativa</span>
            <h1 className="rf-title" style={{ fontSize: 22, margin: '2px 0 0' }}>{s.station.name}</h1>
            <p className="rf-subtitle">{s.connector?.type} · {s.connector?.chargeTypeLabel} · preço travado em {money(s.priceKwh)}/kWh</p>
          </div>
          <LevelBadge level={s.signalLevel} />
        </div>

        <div className="rf-meter-card">
          <div className="rf-battery-circle" style={{ background: `conic-gradient(#4ae3a5 0% ${s.soc}%, #1e2935 ${s.soc}% 100%)` }}>
            <div className="rf-battery-circle-inner">
              <span className="rf-battery-soc">{Math.round(s.soc)}%</span>
              <span className="rf-battery-meta">meta: {s.targetSoc}%</span>
            </div>
          </div>

          <div style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
            <div className="rf-progress" style={{ height: 6 }}>
              <span style={{ width: `${((s.soc - s.startSoc) / Math.max(1, s.targetSoc - s.startSoc)) * 100}%` }} />
            </div>
            <div className="rf-between rf-tiny" style={{ marginTop: 6 }}>
              <span>Início: {Math.round(s.startSoc)}%</span>
              <span>{s.readyToFinish ? 'Meta atingida!' : `Faltam ~${s.remainingMin} min`}</span>
            </div>
          </div>

          {s.flexOffer && (
            <div className="rf-smart-event-box" style={{ width: '100%', marginTop: 18 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <Zap size={20} color="#4ae3a5" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div className="rf-strong" style={{ fontSize: 13 }}>Sinal da rede: oportunidade de flexibilidade</div>
                  <p className="rf-small" style={{ margin: '4px 0 10px', lineHeight: 1.4 }}>
                    {s.flexOffer.reason} Reduzindo de {s.powerKw} kW para {s.flexOffer.reducedPowerKw} kW você ganha <b>+{money(s.flexOffer.bonus)} em créditos</b>. A meta de {s.targetSoc}% é mantida; a recarga só demora um pouco mais.
                  </p>
                  <div className="rf-row">
                    <button type="button" className="rf-btn small" disabled={flex.isPending} onClick={() => flex.mutate(s.id)}>Aceitar (+{money(s.flexOffer.bonus)})</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {s.flexAccepted && (
            <div className="rf-success" style={{ width: '100%', marginTop: 18, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Check size={16} /> Modulação ativa: potência em {s.powerKw} kW. Créditos garantidos ao concluir.
            </div>
          )}

          <div className="rf-session-grid" style={{ width: '100%', marginTop: 18 }}>
            <div className="rf-session-stat-box"><span>Energia</span><strong>{kwh(s.energyKwh)}</strong></div>
            <div className="rf-session-stat-box"><span>Potência</span><strong>{s.powerKw} kW</strong></div>
            <div className="rf-session-stat-box"><span>Tempo (simulado)</span><strong>{s.elapsedMin} min</strong></div>
            <div className="rf-session-stat-box"><span>Custo até agora</span><strong style={{ color: '#4ae3a5' }}>{money(s.cost)}</strong></div>
          </div>

          <ErrorBox error={error} />
          <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 16 }}>
            <Button className={s.readyToFinish ? 'full' : 'danger full'} onClick={() => setConfirmOpen(true)}>
              {s.readyToFinish ? 'Concluir e ver recibo' : 'Encerrar recarga'}
            </Button>
          </div>
          <div className="rf-tiny" style={{ marginTop: 8 }}>A simulação é acelerada para demonstração (ver CHARGING_SIM_SPEED).</div>
        </div>
      </div>

      <StopConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={(useCredits) => stop.mutate({ id: s.id, useCredits })}
        currentSoc={Math.round(s.soc)}
        remainingMinutes={s.remainingMin}
        targetSoc={s.targetSoc}
        readyToFinish={s.readyToFinish}
        estimatedCost={s.cost}
        walletBalance={wallet?.balance ?? 0}
        busy={stop.isPending}
      />
    </AppShell>
  );
}
