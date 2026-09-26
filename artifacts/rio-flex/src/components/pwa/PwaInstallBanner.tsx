import { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { usePwa } from '@/context/PwaContext';

export function PwaInstallBanner() {
  const { isInstalled, promptInstall } = usePwa();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;

  return (
    <div className="rf-pwa-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(74, 227, 165, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4ae3a5',
            flexShrink: 0,
          }}
        >
          <Smartphone size={18} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
            Instalar Rio Flex no celular
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            Acesse direto da tela de início com inicialização instantânea
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className="rf-btn primary small"
          onClick={promptInstall}
          style={{ padding: '5px 12px', fontSize: 11 }}
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
          title="Dispensar aviso"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
