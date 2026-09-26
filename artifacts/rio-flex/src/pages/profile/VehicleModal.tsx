import { Check, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { carOptions, toVehicle } from '@/data/vehicles';
import type { Vehicle } from '@/types/api';

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
          <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>Escolha o seu modelo</h3>
          <button type="button" className="rf-modal-close" onClick={onClose} title="Fechar"><X size={18} /></button>
        </div>
        <div className="rf-stack" style={{ marginBottom: 18 }}>
          {carOptions.map((c) => {
            const selected = currentVehicle.model === c.model;
            return (
              <button
                key={c.model}
                type="button"
                className={`rf-charge-card ${selected ? 'active' : ''}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#f8fafc', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => {
                  onSelect(toVehicle(c, currentVehicle.soc, currentVehicle.targetSoc));
                  onClose();
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.mfg} {c.model}</div>
                  <div className="rf-small">Bateria {c.battery} kWh · DC até {c.dc} kW · AC até {c.ac} kW · ~{c.range} km</div>
                </div>
                {selected && <Check size={18} color="#4ae3a5" />}
              </button>
            );
          })}
        </div>
        <Button className="secondary full" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
}
