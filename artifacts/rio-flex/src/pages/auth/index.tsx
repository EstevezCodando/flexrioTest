import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/common/Button';

export default function AuthPage({ signup = false }: { signup?: boolean }) {
  const [, setLocation] = useLocation();

  return (
    <div className="rf-auth">
      <div className="rf-auth-side">
        <Brand light />
        <div>
          <h1>Uma decisão melhor começa <em>antes</em> da tomada.</h1>
          <p>O Rio Flex encontra o posto certo para o seu trajeto e converte a estabilização da rede em créditos reais.</p>
        </div>
        <div className="rf-eyebrow">Mobilidade Elétrica Inteligente • Rio de Janeiro</div>
      </div>
      <div className="rf-auth-form">
        <div className="rf-auth-box">
          <Link href="/" className="rf-eyebrow"><ArrowLeft size={13} /> voltar ao início</Link>
          <h2>{signup ? 'Cadastre seu veículo' : 'Bem-vindo de volta'}</h2>
          <p>{signup ? 'Leva menos de 1 minuto para começar.' : 'Acesse seus postos recomendados e sua carteira de créditos.'}</p>

          <Button className="secondary full" onClick={() => setLocation('/app')}>
            <span style={{ fontWeight: 600 }}>Continuar com Google</span>
          </Button>

          <div style={{ textAlign: 'center', margin: '14px 0', color: '#64748b', fontSize: 12 }}>ou com e-mail</div>

          <form onSubmit={(e) => { e.preventDefault(); setLocation('/app'); }}>
            <div>
              <label className="rf-label" htmlFor="email">E-mail</label>
              <input id="email" className="rf-input" required placeholder="marcos@email.com" type="email" defaultValue="marcos@email.com" />
            </div>
            <div>
              <label className="rf-label" htmlFor="password">Senha</label>
              <input id="password" className="rf-input" required minLength={4} placeholder="••••••••" type="password" defaultValue="123456" />
            </div>
            <Button type="submit" className="full" style={{ marginTop: 10 }}>
              {signup ? 'Criar conta e ir ao mapa' : 'Entrar no Rio Flex'} <ArrowRight size={15} />
            </Button>
          </form>

          <div className="rf-auth-switch" style={{ marginTop: 16 }}>
            {signup ? 'Já tem uma conta?' : 'Novo por aqui?'} <Link href={signup ? '/login' : '/signup'}>{signup ? 'Entrar' : 'Cadastre-se'}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
