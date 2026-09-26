import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Check, Wallet } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';
import { ErrorBox, Loading } from '@/components/common/ui';
import { api } from '@/lib/api';
import { kwh, money } from '@/lib/format';
import type { ChargingSession } from '@/types/api';

export default function ReceiptPage() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { data: s, error, isLoading } = useQuery({
    queryKey: ['charging', id],
    queryFn: () => api.get<ChargingSession>(`/me/charging/${id}`),
    enabled: !!id,
  });
  const extra = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(`rf-receipt-${id}`) ?? 'null') as { amountDue: number; creditsUsed: number } | null;
    } catch {
      return null;
    }
  })();

  return (
    <AppShell>
      <div className="rf-receipt-card">
        {isLoading && <Loading />}
        <ErrorBox error={error} />
        {s && (
          <>
            <div style={{ display: 'inline-grid', placeItems: 'center', width: 56, height: 56, borderRadius: '50%', background: 'rgba(74,227,165,.15)', border: '1px solid #4ae3a5', margin: '0 auto 16px' }}>
              <Check size={28} color="#4ae3a5" />
            </div>
            <span className="rf-eyebrow">Recarga concluída</span>
            <h1 className="rf-title" style={{ fontSize: 26, margin: '6px 0' }}>{s.station.name}</h1>
            <p className="rf-subtitle">
              {s.signalLevel === 'verde' || s.flexAccepted
                ? 'Você carregou num momento bom para a rede — obrigado por ajudar a equilibrar o sistema.'
                : 'Recarga registrada. Crie um alerta para ser avisado das janelas verdes.'}
            </p>

            {s.credits > 0 && (
              <div className="rf-credit-celebration">
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#c084fc', fontWeight: 700 }}>Recompensa de flexibilidade</span>
                <div className="rf-credit-celebration-amount">+ {money(s.credits)}</div>
                <p>Creditados na sua carteira Rio Flex{s.flexAccepted ? ' (inclui bônus por modular a potência)' : ''}.</p>
              </div>
            )}

            <div className="rf-session-grid" style={{ margin: '20px 0' }}>
              <div className="rf-session-stat-box"><span>Bateria</span><strong>→ {s.targetSoc}%</strong></div>
              <div className="rf-session-stat-box"><span>Energia</span><strong>{kwh(s.energyKwh)}</strong></div>
              <div className="rf-session-stat-box"><span>Preço</span><strong>{money(s.priceKwh)}/kWh</strong></div>
              <div className="rf-session-stat-box"><span>Total</span><strong style={{ color: '#38bdf8' }}>{money(s.cost)}</strong></div>
            </div>
            {extra && extra.creditsUsed > 0 && (
              <p className="rf-small">Créditos abatidos: <b>{money(extra.creditsUsed)}</b> · a pagar: <b className="rf-strong">{money(extra.amountDue)}</b></p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <Button className="secondary full" onClick={() => setLocation('/app')}>Voltar ao início</Button>
              <Button className="full" onClick={() => setLocation('/app/wallet')}><Wallet size={15} /> Minha carteira</Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
