import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type PwaContextType = {
  isInstallable: boolean;
  isInstalled: boolean;
  isIos: boolean;
  isInstallModalOpen: boolean;
  setIsInstallModalOpen: (v: boolean) => void;
  promptInstall: () => Promise<void>;
};

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  isInstalled: false,
  isIos: false,
  isInstallModalOpen: false,
  setIsInstallModalOpen: () => {},
  promptInstall: async () => {},
});

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  useEffect(() => {
    // Detecta se já está rodando como app instalado (standalone)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    // Detecta se é dispositivo iOS (Safari não dispara beforeinstallprompt nativo)
    const ua = window.navigator.userAgent;
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // Captura evento se já disparado antes da montagem do React
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }
    (window as any).__onDeferredPrompt = (e: any) => {
      setDeferredPrompt(e);
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    const promptEvent = deferredPrompt || (window as any).deferredPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    } else if (isIos) {
      // Somente no iPhone Safari abre o guia passo a passo, pois a Apple não possui API de prompt nativo
      setIsInstallModalOpen(true);
    } else {
      // No Android e Chrome, se o evento já tiver sido consumido ou o app já estiver instalado
      console.log('[Rio Flex] App já instalado ou aguardando ação nativa do navegador.');
    }
  };

  return (
    <PwaContext.Provider
      value={{
        isInstallable: Boolean(deferredPrompt) || isIos,
        isInstalled,
        isIos,
        isInstallModalOpen,
        setIsInstallModalOpen,
        promptInstall,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  return useContext(PwaContext);
}
