import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { UseCreditsModal } from '@/pages/wallet/UseCreditsModal';
import { money } from '@/lib/format';
import type { WalletActivity, WalletLedgerEntry } from '@/types/wallet';

const activities: WalletActivity[] = [
  {
    id: 1,
    date: 'Hoje, 14:32',
    station: 'Marina Flex Station',
    energyKwh: 21.7,
    cost: 24.92,
    bonusText: '+ R$ 4,00',
    event: 'Janela Solar Rio Flex (100% fora do pico)',
  },
  {
    id: 2,
    date: '12 set 2026',
    station: 'COPPE / UFRJ Eletroposto Solar',
    energyKwh: 18.2,
    cost: 17.83,
    bonusText: '+ R$ 4,50',
    event: 'Excedente Fotovoltaico Local COPPE',
  },
  {
    id: 3,
    date: '04 set 2026',
    station: 'Shopping RioSul',
    energyKwh: 16.8,
    cost: 20.50,
    bonusText: '+ R$ 2,50',
    event: 'Deslocamento de Pico Vespertino',
  },
  {
    id: 4,
    date: '28 ago 2026',
    station: 'Copacabana Atlântica',
    energyKwh: 14.1,
    cost: 16.63,
    bonusText: '+ R$ 3,00',
    event: 'Bônus Solar Fluminense',
  },
];

const ledger: WalletLedgerEntry[] = [
  { id: 'm1', date: 'Hoje, 14:35', desc: 'Bônus de flexibilidade Marina Flex', amount: '+ R$ 4,00', type: 'credit' },
  { id: 'm2', date: '12 set 2026', desc: 'Bônus excedente solar COPPE/UFRJ', amount: '+ R$ 4,50', type: 'credit' },
  { id: 'm3', date: '08 set 2026', desc: 'Abatimento automático em recarga', amount: '- R$ 10,00', type: 'debit' },
  { id: 'm4', date: '04 set 2026', desc: 'Bônus evento de resposta de demanda', amount: '+ R$ 2,50', type: 'credit' },
  { id: 'm5', date: '28 ago 2026', desc: 'Bônus solar Copacabana', amount: '+ R$ 3,00', type: 'credit' },
];

export default function WalletPage() {
  const [walletTab, setWalletTab] = useState<'activity' | 'ledger'>('activity');
  const [isUseCreditsModalOpen, setIsUseCreditsModalOpen] = useState(false);
  const [isCo2TooltipOpen, setIsCo2TooltipOpen] = useState(false);

  return (
    <AppShell>
      <div className="rf-wallet-container">
        <div>
          <span className="rf-eyebrow">Etapa 4 • Saldo & Impacto</span>
          <h1 className="rf-title" style={{ fontSize: 24, margin: '2px 0 0' }}>Minha Carteira Rio Flex</h1>
          <p className="rf-subtitle">Créditos acumulados por carregar nos momentos mais inteligentes para a cidade.</p>
        </div>

        {/* Card Principal: Saldo de Créditos */}
        <div className="rf-wallet-balance-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              SEUS CRÉDITOS ACUMULADOS
            </span>
            <span className="rf-badge purple">Flexibilidade Ativa</span>
          </div>

          <div className="rf-wallet-balance-num">
            224 créditos <span style={{ fontSize: 20, color: '#94a3b8', fontWeight: 500 }}>(≈ R$ 22,40)</span>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
            Créditos gerados pela sua participação na flexibilidade da rede elétrica. Aplicáveis como desconto direto na sua próxima recarga ou na conta parceira.
          </p>

          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="rf-btn primary small"
              onClick={() => setIsUseCreditsModalOpen(true)}
            >
              Usar créditos acumulados
            </button>
          </div>
        </div>

        {/* Grade Compacta de Impacto Energético */}
        <div className="rf-compact-impact-grid">
          <div className="rf-compact-impact-card">
            <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Energia Flexibilizada
            </span>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#4ae3a5', margin: '4px 0 2px' }}>
              42,8 kWh
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>consumidos fora da ponta</div>
          </div>

          <div className="rf-compact-impact-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                CO₂ Evitado
              </span>
              <button
                type="button"
                onClick={() => setIsCo2TooltipOpen(!isCo2TooltipOpen)}
                style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0 }}
                title="Como calculamos o CO2 evitado?"
              >
                <HelpCircle size={12} />
              </button>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', margin: '4px 0 2px' }}>
              17,4 kg
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>substituição fóssil</div>
          </div>

          <div className="rf-compact-impact-card">
            <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Sessões Premiadas
            </span>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#c084fc', margin: '4px 0 2px' }}>
              6 sessões
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>100% de adesão</div>
          </div>
        </div>

        {isCo2TooltipOpen && (
          <div style={{ background: '#111822', border: '1px solid #263848', borderRadius: 10, padding: 12, fontSize: 12, color: '#cbd5e1' }}>
            <b>Fator de Emissão ONS/SIN:</b> O CO₂ evitado é calculado considerando as termelétricas a gás e carvão que deixaram de ser despachadas durante os horários em que seu veículo consumiu excedente solar.
          </div>
        )}

        {/* Histórico Transparente em 2 Abas */}
        <div className="rf-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>Extrato & Histórico</h3>

            <div className="rf-segmented-toggle">
              <button
                type="button"
                className={`rf-segmented-btn ${walletTab === 'activity' ? 'active' : ''}`}
                onClick={() => setWalletTab('activity')}
              >
                Atividade ({activities.length})
              </button>
              <button
                type="button"
                className={`rf-segmented-btn ${walletTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setWalletTab('ledger')}
              >
                Movimentações
              </button>
            </div>
          </div>

          {/* Aba 1: Atividade de Recarga */}
          {walletTab === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {activities.map((item) => (
                <div className="rf-wallet-history-item" key={item.id}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc' }}>{item.station}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {item.date} · {item.energyKwh} kWh · Total pago: {money(item.cost)}
                    </div>
                    <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 2 }}>
                      {item.event}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="rf-badge green" style={{ fontSize: 11, padding: '3px 8px' }}>
                      {item.bonusText}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Aba 2: Movimentações Financeiras de Créditos */}
          {walletTab === 'ledger' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {ledger.map((item) => (
                <div className="rf-wallet-history-item" key={item.id}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc' }}>{item.desc}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.date}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      className="rf-badge"
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        color: item.type === 'credit' ? '#4ae3a5' : '#f43f5e',
                        borderColor: item.type === 'credit' ? 'rgba(74, 227, 165, 0.3)' : 'rgba(244, 63, 94, 0.3)',
                      }}
                    >
                      {item.amount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Uso de Créditos */}
      <UseCreditsModal
        isOpen={isUseCreditsModalOpen}
        onClose={() => setIsUseCreditsModalOpen(false)}
      />
    </AppShell>
  );
}
