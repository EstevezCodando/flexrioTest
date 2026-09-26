import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/common/Button';
import { ErrorBox } from '@/components/common/ui';
import { useAuth } from '@/context/AuthContext';

/** Login do gestor (operação da rede de recarga). Contas de gestor não se cadastram sozinhas. */
export default function ManagerLoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await login(String(f.get('email')), String(f.get('password')), 'manager');
      setLocation('/gestor');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rf-auth manager">
      <div className="rf-auth-side">
        <Brand light />
        <div>
          <h1>Controle inteligente da <em>flexibilidade</em> da rede.</h1>
          <p>Acompanhe preços do mercado de energia, demanda, geração e clima, publique sinais de preço para os consumidores e consulte a FlexIA sobre regulação e protocolos.</p>
        </div>
        <div className="rf-eyebrow">Portal do gestor • acesso restrito</div>
      </div>
      <div className="rf-auth-form">
        <div className="rf-auth-box">
          <Link href="/" className="rf-eyebrow"><ArrowLeft size={13} /> voltar ao início</Link>
          <h2>Entrar como gestor</h2>
          <p>Área exclusiva da operação. Contas de gestor são provisionadas pela administração.</p>

          <div className="rf-portal-switch" role="tablist" aria-label="Escolha o portal">
            <Link href="/login">Sou motorista</Link>
            <Link href="/gestor/login" className="active">Sou gestor</Link>
          </div>

          <form onSubmit={onSubmit}>
            <div>
              <label className="rf-label" htmlFor="m-email">E-mail corporativo</label>
              <input id="m-email" name="email" className="rf-input" required type="email" autoComplete="username" maxLength={120} />
            </div>
            <div>
              <label className="rf-label" htmlFor="m-password">Senha</label>
              <input id="m-password" name="password" className="rf-input" required type="password" autoComplete="current-password" maxLength={200} />
            </div>
            <ErrorBox error={error} />
            <Button type="submit" className="purple full" disabled={busy} style={{ marginTop: 6 }}>
              <ShieldCheck size={15} /> {busy ? 'Verificando...' : 'Acessar painel de gestão'}
            </Button>
          </form>
          <div className="rf-demo-hint">
            Tentativas são limitadas e a conta é bloqueada por 15 min após 5 erros. A conta de gestor de demonstração está no README.
          </div>
        </div>
      </div>
    </div>
  );
}
