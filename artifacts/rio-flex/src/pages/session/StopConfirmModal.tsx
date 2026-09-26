import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/common/Button';

type StopConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentSoc: number;
  remainingMinutes: number;
  targetSoc: number;
};

export function StopConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  currentSoc,
  remainingMinutes,
  targetSoc,
}: StopConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="rf-modal-overlay" onClick={onClose}>
      <div className="rf-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="rf-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={20} color="#f43f5e" />
            <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>Encerrar recarga agora?</h3>
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
          Sua bateria está em <b>{currentSoc}%</b>. Faltam apenas ~{remainingMinutes} min para atingir a meta recomendada de {targetSoc}%.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button className="secondary full" onClick={onClose}>
            Continuar Carregando
          </Button>
          <Button className="danger full" onClick={onConfirm}>
            Confirmar & Ver Recibo
          </Button>
        </div>
      </div>
    </div>
  );
}
