import { Link } from 'wouter';
import { ArrowRight, MapPin, Smartphone, Sparkles } from 'lucide-react';
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
            <button
              type="button"
              onClick={promptInstall}
              style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Smartphone size={14} color="#4ae3a5" /> Instalar App
            </button>
          )}
          <Link href="/login">Entrar</Link>
        </div>
        <Button href="/login" className="small">Acessar Rio Flex</Button>
      </nav>
      <section className="rf-landing-hero">
        <div>
          <div className="rf-badge"><Sparkles size={13} /> flexibilidade energética sob medida</div>
          <h1 className="rf-hero-title">Carregue melhor.<br /><em>Pague menos.</em><br />Ganhe créditos.</h1>
          <p className="rf-hero-copy">
            O Rio Flex direciona você aos eletropostos ideais e recompensa seu carro por aliviar o consumo da cidade. Sem complexidade técnica: apenas rota otimizada e economia no bolso.
          </p>
          <div className="rf-hero-actions">
            <Button href="/login">Encontrar Eletroposto Agora <ArrowRight size={16} /></Button>
            <Button href="/login" className="secondary">Entrar com Google</Button>
          </div>
        </div>
        <div className="rf-hero-visual">
          <div className="rf-hero-recommend">
            <span className="rf-badge">Melhor opção agora</span>
            <h3>COPPE / UFRJ Solar</h3>
            <p><MapPin size={12} /> 2,1 km · 8 min</p>
            <div className="line"><span>Tarifa</span><b>R$ 0,98/kWh</b></div>
            <div className="line"><span>Crédito Rio Flex</span><b style={{ color: '#4ae3a5' }}>+ R$ 4,50</b></div>
          </div>
        </div>
      </section>
    </div>
  );
}
