import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/common/Button';
import { ErrorBox } from '@/components/common/ui';
import { useAuth } from '@/context/AuthContext';
import { useMeta } from '@/hooks/queries';

function PortalSwitch({ active }: { active: 'consumer' | 'manager' }) {
  return (
    <div className="rf-portal-switch" role="tablist" aria-label="Escolha o portal">
      <Link href="/login" className={active === 'consumer' ? 'active' : ''}>Sou motorista</Link>
      <Link href="/gestor/login" className={active === 'manager' ? 'active' : ''}>Sou gestor</Link>
    </div>
  );
}

/** Login e cadastro do consumidor (motorista). */
export default function AuthPage({ signup = false }: { signup?: boolean }) {
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();
  const { data: meta } = useMeta();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      if (signup) {
        await register({
          name: String(f.get('name')),
          email: String(f.get('email')),
          password: String(f.get('password')),
          regionId: String(f.get('regionId') || 'capital'),
        });
        setLocation('/onboarding');
      } else {
        await login(String(f.get('email')), String(f.get('password')), 'consumer');
        setLocation('/app');
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rf-auth">
      <div className="rf-auth-side">
        <Brand light />
        <div>
          <h1>Carregue quando a energia está <em>mais barata</em>.</h1>
          <p>O Rio Flex recebe os sinais de preço do mercado de energia e mostra, com transparência, quanto custa carregar agora, em cada tipo de carregador, e quando vale esperar.</p>
        </div>
        <div className="rf-eyebrow">Portal do motorista • Rio de Janeiro</div>
      </div>
      <div className="rf-auth-form">
        <div className="rf-auth-box">
          <Link href="/" className="rf-eyebrow"><ArrowLeft size={13} /> voltar ao início</Link>
          <h2>{signup ? 'Crie sua conta' : 'Entrar como motorista'}</h2>
          <p>{signup ? 'Leva menos de 1 minuto. Depois escolhemos seu carro.' : 'Acesse preços, alertas, postos e sua carteira de créditos.'}</p>

          <PortalSwitch active="consumer" />

          <form onSubmit={onSubmit} noValidate={false}>
            {signup && (
              <div>
                <label className="rf-label" htmlFor="name">Nome</label>
                <input id="name" name="name" className="rf-input" required minLength={2} maxLength={80} autoComplete="name" />
              </div>
            )}
            <div>
              <label className="rf-label" htmlFor="email">E-mail</label>
              <input id="email" name="email" className="rf-input" required type="email" autoComplete="email" maxLength={120} />
            </div>
            <div>
              <label className="rf-label" htmlFor="password">Senha</label>
              <input
                id="password" name="password" className="rf-input" required type="password"
                minLength={signup ? 10 : 1} maxLength={200}
                autoComplete={signup ? 'new-password' : 'current-password'}
              />
              {signup && <div className="rf-tiny" style={{ marginTop: 6 }}>Mínimo de 10 caracteres, com letras e números.</div>}
            </div>
            {signup && (
              <div>
                <label className="rf-label" htmlFor="regionId">Região onde você mais carrega</label>
                <select id="regionId" name="regionId" className="rf-select" style={{ width: '100%' }} defaultValue="capital">
                  {meta?.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>) ?? <option value="capital">Rio de Janeiro (Capital)</option>}
                </select>
              </div>
            )}
            <ErrorBox error={error} />
            <Button type="submit" className="full" disabled={busy} style={{ marginTop: 6 }}>
              {busy ? 'Aguarde...' : signup ? 'Criar conta' : 'Entrar no Rio Flex'} <ArrowRight size={15} />
            </Button>
          </form>

          <div className="rf-auth-switch">
            {signup ? 'Já tem uma conta?' : 'Novo por aqui?'}{' '}
            <Link href={signup ? '/login' : '/signup'}>{signup ? 'Entrar' : 'Cadastre-se'}</Link>
          </div>
          {!signup && (
            <div className="rf-demo-hint">
              Ambiente de demonstração: a conta de motorista criada pelo seed está descrita no README (seção “Contas de demonstração”).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
