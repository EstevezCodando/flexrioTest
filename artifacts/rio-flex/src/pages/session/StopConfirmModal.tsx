import { useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { money } from '@/lib/format';

type StopConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (useCredits: boolean) => void;
  currentSoc: number;
  remainingMinutes: number;
  targetSoc: number;
  readyToFinish: boolean;
  estimatedCost: number;
  walletBalance: number;
  busy?: boolean;
};

export function StopConfirmModal({
  isOpen, onClose, onConfirm, currentSoc, remainingMinutes, targetSoc, readyToFinish, estimatedCost, walletBalance, busy,
}: StopConfirmModalProps) {
  const [useCredits, setUseCredits] = useState(walletBalance > 0);
  if (!isOpen) return null;

  return (
    <div className="rf-modal-overlay" onClick={onClose}>
      <div className="rf-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="rf-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {readyToFinish ? <Check size={20} color="#4ae3a5" /> : <AlertTriangle size={20} color="#f43f5e" />}
            <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>{readyToFinish ? 'Concluir recarga' : 'Encerrar recarga agora?'}</h3>
          </div>
          <button type="button" className="rf-modal-close" onClick={onClose} title="Fechar"><X size={18} /></button>
        </div>

        <p className="rf-small" style={{ lineHeight: 1.5, margin: '0 0 12px' }}>
          {readyToFinish
            ? `Sua bateria atingiu a meta de ${targetSoc}%.`
            : `Sua bateria está em ${currentSoc}%. Faltam ~${remainingMinutes} min para a meta de ${targetSoc}%.`}{' '}
          Valor estimado: <b className="rf-strong">{money(estimatedCost)}</b>.
        </p>

        {walletBalance > 0 && (
          <label className="rf-between rf-small" style={{ marginBottom: 16 }}>
            Abater com créditos da carteira ({money(walletBalance)} disponíveis)
            <span className="rf-switch-toggle">
              <input type="checkbox" checked={useCredits} onChange={(e) => setUseCredits(e.target.checked)} />
              <span className="rf-switch-slider" />
            </span>
          </label>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Button className="secondary full" onClick={onClose}>Continuar carregando</Button>
          <Button className={readyToFinish ? 'full' : 'danger full'} disabled={busy} onClick={() => onConfirm(useCredits)}>
            {busy ? 'Encerrando...' : 'Confirmar e ver recibo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
