import { Check, X } from 'lucide-react';
import type { ChargingStation } from '@/types/station';
import { Button } from '@/components/common/Button';
import { money } from '@/lib/format';

type WhyRecommendedModalProps = {
  isOpen: boolean;
  onClose: () => void;
  station: ChargingStation;
};

export function WhyRecommendedModal({ isOpen, onClose, station }: WhyRecommendedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="rf-modal-overlay" onClick={onClose}>
      <div className="rf-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="rf-modal-header">
          <div>
            <span className="rf-badge green" style={{ fontSize: 10, padding: '2px 8px', marginBottom: 6 }}>
              Critérios de Otimização Rio Flex
            </span>
            <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>
              Por que recomendamos {station.name}?
            </h3>
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
          Nosso algoritmo cruzou sua localização atual com a geração fotovoltaica da rede e a disponibilidade em tempo real dos conectores:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Check size={16} color="#4ae3a5" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#f8fafc' }}>
              <b>Mais próximo e com menor tempo de tráfego:</b> apenas {station.distanceKm} km (~{station.etaMinutes} min) do seu ponto de partida.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Check size={16} color="#4ae3a5" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#f8fafc' }}>
              <b>{station.availableConnectors} vagas livres garantidas:</b> conector CCS2 de {station.specs.maxPowerKw} kW pronto para uso imediato sem fila de espera.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Check size={16} color="#4ae3a5" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#f8fafc' }}>
              <b>Energia {station.renewableShare}% limpa:</b> alimentação direta por usina solar associada da UFRJ.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Check size={16} color="#4ae3a5" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#f8fafc' }}>
              <b>Menor tarifa da região ({money(station.pricePerKwh)}/kWh):</b> até 25% mais barato que postos de shopping na mesma rota.
            </div>
          </div>

          {station.incentive && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Check size={16} color="#c084fc" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: '#f8fafc' }}>
                <b>Maior bônus de flexibilidade:</b> ganhe + {money(station.incentive.value)} em créditos ao completar a recarga.
              </div>
            </div>
          )}
        </div>

        <Button className="full" onClick={onClose}>
          Entendido
        </Button>
      </div>
    </div>
  );
}
