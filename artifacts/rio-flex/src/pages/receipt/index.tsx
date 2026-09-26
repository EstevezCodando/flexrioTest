import { useLocation } from 'wouter';
import { Check, Wallet } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';

export default function ReceiptPage() {
  const [, setLocation] = useLocation();

  return (
    <AppShell>
      <div className="rf-receipt-card">
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(74, 227, 165, 0.15)',
            border: '1px solid #4ae3a5',
            margin: '0 auto 16px',
          }}
        >
          <Check size={28} color="#4ae3a5" />
        </div>

        <span className="rf-eyebrow">Etapa 4 • Recarga Concluída</span>
        <h1 className="rf-title" style={{ fontSize: 26, margin: '6px 0 6px' }}>Veículo Pronto!</h1>
        <p className="rf-subtitle">Você recarregou com energia sustentável e aliviou o consumo de pico da cidade.</p>

        {/* Caixa de Celebração do Crédito Rio Flex */}
        <div className="rf-credit-celebration">
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#c084fc', fontWeight: 700 }}>
            Recompensa de Flexibilidade
          </span>
          <div className="rf-credit-celebration-amount">+ R$ 4,00</div>
          <p>
            Creditados automaticamente na sua <b>Carteira Rio Flex</b> para abater em futuras recargas ou na fatura!
          </p>
        </div>

        {/* Resumo da Sessão */}
        <div className="rf-session-grid" style={{ margin: '20px 0' }}>
          <div className="rf-session-stat-box">
            <span>Bateria</span>
            <strong>32% → 80%</strong>
          </div>
          <div className="rf-session-stat-box">
            <span>Energia Total</span>
            <strong>21,7 kWh</strong>
          </div>
          <div className="rf-session-stat-box">
            <span>Duração</span>
            <strong>27 min</strong>
          </div>
          <div className="rf-session-stat-box">
            <span>Total Pago</span>
            <strong style={{ color: '#38bdf8' }}>R$ 24,92</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button className="secondary full" onClick={() => setLocation('/app')}>
            Voltar ao Início
          </Button>
          <Button className="primary full" onClick={() => setLocation('/app/wallet')}>
            <Wallet size={15} />
            Ver Minha Carteira
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
