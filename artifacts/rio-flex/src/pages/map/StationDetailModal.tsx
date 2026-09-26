import { Navigation, PlugZap, X } from 'lucide-react';
import type { ChargingStation } from '@/types/station';
import { Button } from '@/components/common/Button';
import { money } from '@/lib/format';

type StationDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  station: ChargingStation;
  onConnect: () => void;
};

export function StationDetailModal({ isOpen, onClose, station, onConnect }: StationDetailModalProps) {
  if (!isOpen) return null;

  return (
    <div className="rf-modal-overlay" onClick={onClose}>
      <div className="rf-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="rf-modal-header">
          <div>
            <span className="rf-badge blue" style={{ fontSize: 10, padding: '2px 8px', marginBottom: 6 }}>
              {station.operator}
            </span>
            <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>{station.name}</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>{station.address}</p>
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

        <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 16 }}>
          {station.specs.description}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#0e141a', padding: 10, borderRadius: 10, border: '1px solid #1f2b36' }}>
            <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Potência Máxima</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>{station.specs.maxPowerKw} kW DC</div>
          </div>
          <div style={{ background: '#0e141a', padding: 10, borderRadius: 10, border: '1px solid #1f2b36' }}>
            <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Tarifa Atual</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#4ae3a5' }}>{money(station.pricePerKwh)}/kWh</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
            Comodidades no Local
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {station.specs.amenities.map((item) => (
              <span key={item} className="rf-badge" style={{ fontSize: 11, background: '#141c24' }}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rf-btn secondary full"
          >
            <Navigation size={14} />
            Navegar até lá
          </a>

          <Button
            className="primary full"
            onClick={onConnect}
          >
            <PlugZap size={14} />
            Já estou no local / Conectar
          </Button>
        </div>
      </div>
    </div>
  );
}
