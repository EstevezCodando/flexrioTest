import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { hourlyForecast } from '@/data/forecast';

type EnergyModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function EnergyModal({ isOpen, onClose }: EnergyModalProps) {
  const [selectedHour, setSelectedHour] = useState<number>(14);

  if (!isOpen) return null;

  const currentHourData = hourlyForecast.find((h) => h.hour === selectedHour) || hourlyForecast[14];

  return (
    <div className="rf-modal-overlay" onClick={onClose}>
      <div className="rf-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="rf-modal-header">
          <div>
            <div className="rf-badge green" style={{ fontSize: 10, padding: '2px 8px', marginBottom: 6 }}>
              Geração Solar em Alta
            </div>
            <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>Por que agora é um bom momento?</h3>
          </div>
          <button
            type="button"
            className="rf-modal-close"
            onClick={onClose}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 16px' }}>
          A rede elétrica do Rio de Janeiro e do Sistema Interligado Nacional (SIN) está com <b>mais de 12 GW de excedente solar</b> neste momento.
          Recarregar seu veículo agora consome energia limpa e barata, evitando o desperdício de geração solar.
        </p>

        <div
          style={{
            background: '#0e141a',
            border: '1px solid #1f2b36',
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>
            Curva de Demanda das 24 Horas (Toque na barra para inspecionar)
          </div>

          <div className="rf-forecast-bars">
            {hourlyForecast.map((item) => {
              const isSelected = item.hour === selectedHour;
              const heightPct = Math.round(((item.demandGw - 60) / 24) * 100);

              let barClass = 'normal';
              if (item.status === 'solar') barClass = 'solar';
              if (item.status === 'pico') barClass = 'peak';

              return (
                <div
                  key={item.hour}
                  className={`rf-forecast-bar-wrapper ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedHour(item.hour)}
                  title={`${item.label}: Demanda ${item.demandGw} GW | Solar ${item.solarGw} GW`}
                >
                  <div
                    className={`rf-forecast-bar ${barClass} ${isSelected ? 'active' : ''}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className={`rf-forecast-bar-time ${isSelected ? 'active' : ''}`}>
                    {item.hour % 4 === 0 ? item.label : ''}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 12, padding: '8px 12px', background: '#141d26', borderRadius: 8, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              Horário: <b>{currentHourData.label}</b> · Demanda SIN: <b>{currentHourData.demandGw} GW</b>
            </span>
            <span style={{ color: currentHourData.status === 'solar' ? '#4ae3a5' : currentHourData.status === 'pico' ? '#f43f5e' : '#cbd5e1', fontWeight: 600 }}>
              {currentHourData.status === 'solar' && 'Janela Solar (+ Créditos)'}
              {currentHourData.status === 'pico' && 'Horário de Pico (Evitar)'}
              {currentHourData.status === 'normal' && 'Demanda Regular'}
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            color: '#94a3b8',
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 16,
          }}
        >
          <b>O que acontece entre 18h e 21h?</b> O consumo da cidade dispara para 80+ GW. Termelétricas a gás e carvão são acionadas, elevando a tarifa e a poluição. O Rio Flex bonifica motoristas que evitam essa faixa.
        </div>

        <Button className="full" onClick={onClose}>
          Entendido
        </Button>
      </div>
    </div>
  );
}
