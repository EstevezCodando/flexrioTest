import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Check } from 'lucide-react';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/common/Button';

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [selectedModel, setSelectedModel] = useState('BYD Dolphin GS');

  const models = [
    { name: 'BYD Dolphin GS', battery: '44,9 kWh', plug: 'CCS2 (DC 80 kW)' },
    { name: 'GWM Ora 03 Skin', battery: '48,0 kWh', plug: 'CCS2 (DC 64 kW)' },
    { name: 'Volvo EX30 Core', battery: '51,0 kWh', plug: 'CCS2 (DC 134 kW)' },
    { name: 'Renault Kwid E-Tech', battery: '26,8 kWh', plug: 'CCS2 (DC 30 kW)' },
  ];

  return (
    <div className="rf-onboarding">
      <div className="rf-onboarding-box">
        <Brand light />
        <div className="rf-card" style={{ marginTop: 24 }}>
          <h1 className="rf-title" style={{ fontSize: 26 }}>Qual é o seu carro elétrico?</h1>
          <p className="rf-subtitle">Personalizamos as recomendações de recarga para o conector e autonomia do seu modelo.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '20px 0' }}>
            {models.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => setSelectedModel(m.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: selectedModel === m.name ? 'rgba(74, 227, 165, 0.1)' : '#11171d',
                  border: `1px solid ${selectedModel === m.name ? '#4ae3a5' : '#222e39'}`,
                  color: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Bateria {m.battery} · Conector {m.plug}</div>
                </div>
                {selectedModel === m.name && <Check size={18} color="#4ae3a5" />}
              </button>
            ))}
          </div>

          <Button className="full" onClick={() => setLocation('/app')}>
            Continuar para o Rio Flex <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
