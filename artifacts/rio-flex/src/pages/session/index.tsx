import { useState } from 'react';
import { useLocation } from 'wouter';
import { Check, Zap } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';
import { StopConfirmModal } from '@/pages/session/StopConfirmModal';
import { money } from '@/lib/format';

export default function SessionPage() {
  const [, setLocation] = useLocation();
  const [currentSoc, setCurrentSoc] = useState(52);
  const [targetSoc] = useState(80);
  const [energyDelivered, setEnergyDelivered] = useState(13.4);
  const [currentCost, setCurrentCost] = useState(15.41);
  const [elapsedMinutes, setElapsedMinutes] = useState(18);
  const [remainingMinutes, setRemainingMinutes] = useState(14);
  const [currentPowerKw, setCurrentPowerKw] = useState(60);

  // Evento inteligente de modulação ativa
  const [hasVppChallenge, setHasVppChallenge] = useState(true);
  const [vppAccepted, setVppAccepted] = useState(false);

  // Diálogo de confirmação para encerrar recarga
  const [isConfirmStopOpen, setIsConfirmStopOpen] = useState(false);

  const simulateStep = () => {
    setCurrentSoc((soc) => Math.min(targetSoc, soc + 5));
    setEnergyDelivered((e) => Number((e + 2.25).toFixed(1)));
    setCurrentCost((c) => Number((c + 2.58).toFixed(2)));
    setElapsedMinutes((m) => m + 3);
    setRemainingMinutes((m) => Math.max(0, m - 3));
  };

  const handleAcceptModulation = () => {
    setVppAccepted(true);
    setHasVppChallenge(false);
    setCurrentPowerKw(35);
  };

  const handleDismissModulation = () => {
    setHasVppChallenge(false);
  };

  return (
    <AppShell>
      <div className="rf-clean-session-container">
        {/* Barra Superior da Sessão */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span className="rf-eyebrow">Etapa 3 • Sessão Ativa</span>
            <h1 className="rf-title" style={{ fontSize: 22, margin: '2px 0 0' }}>Marina Flex Station</h1>
            <p className="rf-subtitle">Conector CCS2 · Carga Rápida DC</p>
          </div>
          <span className="rf-badge green" style={{ padding: '4px 10px' }}>
            <span className="rf-uber-status-dot-green" style={{ display: 'inline-block', marginRight: 6 }} />
            Carregando
          </span>
        </div>

        {/* Medidor Circular Limpo */}
        <div className="rf-meter-card">
          <div
            className="rf-battery-circle"
            style={{
              background: `conic-gradient(#4ae3a5 0% ${currentSoc}%, #1e2935 ${currentSoc}% 100%)`,
            }}
          >
            <div className="rf-battery-circle-inner">
              <span className="rf-battery-soc">{currentSoc}%</span>
              <span className="rf-battery-meta">meta: {targetSoc}%</span>
            </div>
          </div>

          <div style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
            <div className="rf-progress" style={{ height: 6 }}>
              <span style={{ width: `${currentSoc}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 11, marginTop: 6 }}>
              <span>Início: 32%</span>
              <span>Faltam ~{remainingMinutes} min</span>
            </div>
          </div>

          {/* EVENTO VPP INTELIGENTE */}
          {hasVppChallenge && (
            <div className="rf-smart-event-box" style={{ width: '100%', marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Zap size={20} color="#4ae3a5" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                    Oportunidade Rio Flex: Demanda na Cidade
                  </div>
                  <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
                    Pico iminente na rede elétrica. Se aceitar modular temporariamente de 60 kW para 35 kW por 10 min, você ganha <b>+ R$ 2,50 adicionais em créditos</b>. Sua meta de 80% será mantida.
                  </p>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="rf-btn primary small"
                      onClick={handleAcceptModulation}
                    >
                      Aceitar (+ R$ 2,50)
                    </button>
                    <button
                      type="button"
                      className="rf-btn secondary small"
                      onClick={handleDismissModulation}
                    >
                      Manter velocidade
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {vppAccepted && (
            <div
              style={{
                width: '100%',
                marginTop: 18,
                background: 'rgba(74, 227, 165, 0.12)',
                border: '1px solid #4ae3a5',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 12,
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Check size={16} color="#4ae3a5" />
              <span>
                <b>Modulação ativa:</b> Potência ajustada para 35 kW. <b>+ R$ 2,50 garantidos</b> na sua carteira ao concluir a sessão.
              </span>
            </div>
          )}

          {/* 4 Métricas em Linguagem Natural */}
          <div className="rf-session-grid" style={{ width: '100%', marginTop: 18 }}>
            <div className="rf-session-stat-box">
              <span>Energia Carregada</span>
              <strong>{energyDelivered.toFixed(1).replace('.', ',')} kWh</strong>
            </div>
            <div className="rf-session-stat-box">
              <span>Potência Agora</span>
              <strong>{currentPowerKw} kW</strong>
            </div>
            <div className="rf-session-stat-box">
              <span>Tempo de Recarga</span>
              <strong>{elapsedMinutes} min</strong>
            </div>
            <div className="rf-session-stat-box">
              <span>Custo até Agora</span>
              <strong style={{ color: '#4ae3a5' }}>{money(currentCost)}</strong>
            </div>
          </div>

          {/* Ações da Sessão */}
          <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 16 }}>
            <Button className="secondary full" onClick={simulateStep}>
              <Zap size={14} />
              Simular +5% Bateria
            </Button>
            <Button className="danger full" onClick={() => setIsConfirmStopOpen(true)}>
              Encerrar Recarga
            </Button>
          </div>
        </div>
      </div>

      {/* Diálogo de Confirmação */}
      <StopConfirmModal
        isOpen={isConfirmStopOpen}
        onClose={() => setIsConfirmStopOpen(false)}
        onConfirm={() => setLocation('/app/receipt')}
        currentSoc={currentSoc}
        remainingMinutes={remainingMinutes}
        targetSoc={targetSoc}
      />
    </AppShell>
  );
}
