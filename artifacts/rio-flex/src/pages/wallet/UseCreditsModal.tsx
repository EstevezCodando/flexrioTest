import { X } from 'lucide-react';
import { Button } from '@/components/common/Button';

type UseCreditsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function UseCreditsModal({ isOpen, onClose }: UseCreditsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="rf-modal-overlay" onClick={onClose}>
      <div className="rf-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="rf-modal-header">
          <div>
            <span className="rf-badge purple" style={{ fontSize: 10, padding: '2px 8px', marginBottom: 6 }}>
              Resgate de Benefícios
            </span>
            <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>Como deseja usar seus créditos?</h3>
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

        <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.4, margin: '0 0 16px' }}>
          Você possui <b>224 créditos (R$ 22,40)</b> disponíveis. Escolha a forma de resgate:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          <div style={{ background: '#141d26', border: '1px solid #4ae3a5', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 14, color: '#f8fafc' }}>Desconto Automático na Próxima Recarga</strong>
              <span className="rf-badge green" style={{ fontSize: 9, padding: '1px 6px' }}>Ativo</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
              Abate imediatamente o valor na fatura de qualquer eletroposto conectado ao Rio Flex.
            </p>
          </div>

          <div style={{ background: '#11171d', border: '1px solid #222f3c', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 14, color: '#f8fafc' }}>Crédito na Conta de Luz Residencial</strong>
              <span className="rf-badge blue" style={{ fontSize: 9, padding: '1px 6px' }}>Parceiros</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
              Abatimento na fatura mensal da distribuidora conveniada (Light / Enel RJ).
            </p>
          </div>

          <div style={{ background: '#11171d', border: '1px solid #222f3c', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 14, color: '#f8fafc' }}>Transferência Pix</strong>
              <span className="rf-badge" style={{ fontSize: 9, padding: '1px 6px' }}>Em breve</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
              Recebimento direto via chave Pix no piloto experimental COPPE.
            </p>
          </div>
        </div>

        <Button className="full" onClick={onClose}>
          Salvar Preferência
        </Button>
      </div>
    </div>
  );
}
