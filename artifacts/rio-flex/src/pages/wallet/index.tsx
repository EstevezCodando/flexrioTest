import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { LevelBadge, Loading } from '@/components/common/ui';
import { useChargingHistory, useWallet } from '@/hooks/queries';
import { dateTimeOf, kwh, money } from '@/lib/format';

export default function WalletPage() {
  const [tab, setTab] = useState<'activity' | 'ledger'>('activity');
  const [co2Open, setCo2Open] = useState(false);
  const { data: wallet, isLoading } = useWallet();
  const { data: history } = useChargingHistory();

  return (
    <AppShell>
      <div className="rf-wallet-container">
        <div>
          <span className="rf-eyebrow">Saldo & impacto</span>
          <h1 className="rf-title" style={{ fontSize: 24, margin: '2px 0 0' }}>Minha Carteira Rio Flex</h1>
          <p className="rf-subtitle">Créditos que você ganha ao carregar nas janelas verdes ou aceitar modular a potência nos picos.</p>
        </div>

        {isLoading && <Loading />}
        {wallet && (
          <>
            <div className="rf-wallet-balance-card">
              <div className="rf-between">
                <span className="rf-tiny" style={{ textTransform: 'uppercase', fontWeight: 700 }}>Seus créditos</span>
                <span className="rf-badge purple">1 crédito = R$ 0,01</span>
              </div>
              <div className="rf-wallet-balance-num">
                {wallet.credits} créditos <span style={{ fontSize: 20, color: '#94a3b8', fontWeight: 500 }}>(≈ {money(wallet.balance)})</span>
              </div>
              <p className="rf-small" style={{ margin: 0 }}>Use-os para abater o valor ao encerrar uma recarga.</p>
            </div>

            <div className="rf-kpis">
              <div className="rf-kpi"><span>Energia flexível</span><strong style={{ color: '#4ae3a5' }}>{kwh(wallet.stats.flexibleEnergyKwh)}</strong><small>de {kwh(wallet.stats.energyKwh)} no total</small></div>
              <div className="rf-kpi">
                <span className="rf-between">CO₂ evitado <button type="button" onClick={() => setCo2Open(!co2Open)} style={{ background: 'none', border: 0, color: '#38bdf8', cursor: 'pointer' }} title="Como calculamos"><HelpCircle size={12} /></button></span>
                <strong style={{ color: '#38bdf8' }}>{wallet.stats.co2AvoidedKg.toFixed(1).replace('.', ',')} kg</strong><small>estimativa ilustrativa</small>
              </div>
              <div className="rf-kpi"><span>Recargas</span><strong style={{ color: '#c084fc' }}>{wallet.stats.sessions}</strong><small>{money(wallet.stats.totalSpent)} gastos</small></div>
            </div>
            {co2Open && (
              <div className="rf-small rf-card" style={{ padding: 12 }}>
                Estimativa ilustrativa: 0,4 kg de CO₂ por kWh deslocado para janelas verdes, representando geração térmica marginal evitada. Um cálculo real usaria o fator de emissão horário do SIN.
              </div>
            )}

            <div className="rf-card">
              <div className="rf-between" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Extrato & histórico</h3>
                <div className="rf-segmented-toggle">
                  <button type="button" className={`rf-segmented-btn ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>Recargas ({history?.length ?? 0})</button>
                  <button type="button" className={`rf-segmented-btn ${tab === 'ledger' ? 'active' : ''}`} onClick={() => setTab('ledger')}>Movimentações</button>
                </div>
              </div>

              {tab === 'activity' && history?.map((h) => (
                <div className="rf-wallet-history-item" key={h.id}>
                  <div>
                    <div className="rf-strong" style={{ fontSize: 13 }}>{h.station.name}</div>
                    <div className="rf-tiny" style={{ marginTop: 2 }}>{dateTimeOf(h.startedAt)} · {kwh(h.energyKwh)} · {money(h.priceKwh)}/kWh · total {money(h.cost)}</div>
                    <div style={{ marginTop: 4 }}><LevelBadge level={h.signalLevel} label={h.signalLevel} /> {h.flexAccepted && <span className="rf-badge purple">modulação aceita</span>}</div>
                  </div>
                  {h.credits > 0 && <span className="rf-badge">+ {money(h.credits)}</span>}
                </div>
              ))}

              {tab === 'ledger' && wallet.ledger.map((l) => (
                <div className="rf-wallet-history-item" key={l.id}>
                  <div>
                    <div className="rf-strong" style={{ fontSize: 13 }}>{l.description}</div>
                    <div className="rf-tiny" style={{ marginTop: 2 }}>{dateTimeOf(l.createdAt)}</div>
                  </div>
                  <span className={`rf-badge ${l.type === 'credit' ? '' : 'red'}`}>{l.type === 'credit' ? '+' : '−'} {money(Math.abs(l.amount))}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
