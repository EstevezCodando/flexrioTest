import { Check, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { carOptions } from '@/data/vehicles';
import type { Vehicle } from '@/types/vehicle';

type VehicleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentVehicle: Vehicle;
  onSelect: (v: Vehicle) => void;
};

export function VehicleModal({ isOpen, onClose, currentVehicle, onSelect }: VehicleModalProps) {
  if (!isOpen) return null;

  return (
    <div className="rf-modal-overlay" onClick={onClose}>
      <div className="rf-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="rf-modal-header">
          <div>
            <span className="rf-badge blue" style={{ fontSize: 10, padding: '2px 8px', marginBottom: 6 }}>
              Garagem Digital
            </span>
            <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>Escolha o seu modelo</h3>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          {carOptions.map((c) => {
            const isSelected = currentVehicle.model === c.model;
            return (
              <button
                key={c.model}
                type="button"
                onClick={() => {
                  onSelect({
                    ...currentVehicle,
                    manufacturer: c.mfg,
                    model: c.model,
                    batteryCapacityKwh: c.battery,
                    maxDcPowerKw: c.dc,
                    estimatedRangeKm: c.range,
                  });
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: isSelected ? 'rgba(74, 227, 165, 0.12)' : '#151d24',
                  border: `1px solid ${isSelected ? '#4ae3a5' : '#273440'}`,
                  color: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.mfg} {c.model}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Bateria: {c.battery} kWh · Carga rápida até {c.dc} kW · Autonomia ~{c.range} km
                  </div>
                </div>
                {isSelected && <Check size={18} color="#4ae3a5" />}
              </button>
            );
          })}
        </div>

        <Button className="secondary full" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
