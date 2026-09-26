import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Check } from 'lucide-react';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/common/Button';
import { ErrorBox } from '@/components/common/ui';
import { useAuth } from '@/context/AuthContext';
import { carOptions, toVehicle } from '@/data/vehicles';
import { api } from '@/lib/api';
import type { User } from '@/types/api';

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { setUser } = useAuth();
  const [selected, setSelected] = useState(carOptions[0].model);
  const [soc, setSoc] = useState(50);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const car = carOptions.find((c) => c.model === selected)!;
    setBusy(true);
    try {
      const r = await api.patch<{ user: User }>('/auth/me', { vehicle: toVehicle(car, soc) });
      setUser(r.user);
      setLocation('/app');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rf-onboarding">
      <div className="rf-onboarding-box">
        <Brand light />
        <div className="rf-card" style={{ marginTop: 24 }}>
          <h1 className="rf-title" style={{ fontSize: 26 }}>Qual é o seu carro elétrico?</h1>
          <p className="rf-subtitle">Usamos o conector, a potência máxima e a bateria para mostrar só os carregadores compatíveis e estimar custo e tempo.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '20px 0' }}>
            {carOptions.map((m) => (
              <button
                key={m.model}
                type="button"
                onClick={() => setSelected(m.model)}
                className={`rf-charge-card ${selected === m.model ? 'active' : ''}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#f8fafc', cursor: 'pointer', textAlign: 'left' }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{m.mfg} {m.model}</div>
                  <div className="rf-small">Bateria {m.battery} kWh · CCS2 até {m.dc} kW · AC até {m.ac} kW · ~{m.range} km</div>
                </div>
                {selected === m.model && <Check size={18} color="#4ae3a5" />}
              </button>
            ))}
          </div>

          <label className="rf-label" htmlFor="soc">Carga atual da bateria: <b>{soc}%</b></label>
          <input id="soc" type="range" min={5} max={95} value={soc} onChange={(e) => setSoc(Number(e.target.value))} style={{ width: '100%', marginBottom: 16 }} />

          <ErrorBox error={error} />
          <Button className="full" onClick={save} disabled={busy}>
            Continuar para o Rio Flex <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
