import { Smartphone, X } from 'lucide-react';
import { usePwa } from '@/context/PwaContext';
import { Button } from '@/components/common/Button';

export function PwaInstallModal() {
  const { isInstallModalOpen, setIsInstallModalOpen } = usePwa();

  if (!isInstallModalOpen) return null;

  return (
    <div className="rf-modal-overlay" onClick={() => setIsInstallModalOpen(false)}>
      <div className="rf-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="rf-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={20} color="#4ae3a5" />
            <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>
              Como instalar o Rio Flex no Celular
            </h3>
          </div>
          <button
            type="button"
            className="rf-modal-close"
            onClick={() => setIsInstallModalOpen(false)}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 16px' }}>
          Siga os passos rápidos abaixo para adicionar o Rio Flex à tela de início do seu celular:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="rf-pwa-step-num">1</span>
            <div style={{ fontSize: 13, color: '#f8fafc' }}>
              <b>No Safari (iPhone):</b> Toque no botão de <b>Compartilhar</b> (ícone do quadrado com a seta para cima na barra inferior).
              <br /><span style={{ color: '#94a3b8', fontSize: 11 }}>No Chrome (Android): toque nos três pontos no canto superior direito.</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="rf-pwa-step-num">2</span>
            <div style={{ fontSize: 13, color: '#f8fafc' }}>
              Role para baixo e selecione <b>"Adicionar à Tela de Início"</b> ou <b>"Instalar aplicativo"</b>.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="rf-pwa-step-num">3</span>
            <div style={{ fontSize: 13, color: '#f8fafc' }}>
              Confirme tocando em <b>"Adicionar"</b>. O ícone oficial do Rio Flex aparecerá junto aos seus outros aplicativos com navegação em tela cheia!
            </div>
          </div>
        </div>

        <Button className="full" onClick={() => setIsInstallModalOpen(false)}>
          Entendido
        </Button>
      </div>
    </div>
  );
}
