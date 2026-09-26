import { ArrowRight, Bell, Bot, Gauge, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/common/Button';
import { usePwa } from '@/context/PwaContext';

export default function LandingPage() {
  const { isInstalled, promptInstall } = usePwa();

  return (
    <div className="rf-landing">
      <nav className="rf-landing-nav">
        <Brand light />
        <div className="rf-landing-nav-links">
          {!isInstalled && (
            <button type="button" onClick={promptInstall} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Smartphone size={14} color="#4ae3a5" /> Instalar App
            </button>
          )}
          <Link href="/gestor/login">Portal do gestor</Link>
        </div>
        <Button href="/login" className="small">Entrar</Button>
      </nav>
      <section className="rf-landing-hero">
        <div>
          <div className="rf-badge"><Sparkles size={13} /> sinais de preço da energia, repassados com transparência</div>
          <h1 className="rf-hero-title">Carregue na hora certa.<br /><em>Pague menos.</em><br />Ajude a rede.</h1>
          <p className="rf-hero-copy">
            O Rio Flex é um software de controle inteligente de recarga: recebe os sinais de preço do mercado de energia, encontra a melhor oferta para a sua região e mostra quanto custa carregar agora, em cada tipo de carregador. Quem desloca a recarga para as janelas verdes ganha créditos.
          </p>
          <div className="rf-hero-actions">
            <Button href="/login">Sou motorista <ArrowRight size={16} /></Button>
            <Button href="/gestor/login" className="secondary">Sou gestor da rede</Button>
          </div>
        </div>
        <div className="rf-hero-visual">
          <div className="rf-hero-recommend">
            <span className="rf-badge">Janela verde agora</span>
            <h3>Preço por tipo de recarga</h3>
            <div className="line"><span><Gauge size={12} /> AC lenta</span><b>R$/kWh em tempo real</b></div>
            <div className="line"><span><Gauge size={12} /> DC rápida</span><b>com composição do custo</b></div>
            <div className="line"><span><Bell size={12} /> Alertas</span><b style={{ color: '#4ae3a5' }}>preço-alvo e janelas</b></div>
            <div className="line"><span><Bot size={12} /> FlexIA</span><b style={{ color: '#b98cff' }}>assistente do gestor</b></div>
            <div className="line"><span><ShieldCheck size={12} /> Confiança</span><b>preço explicado, sem surpresa</b></div>
          </div>
        </div>
      </section>
    </div>
  );
}
