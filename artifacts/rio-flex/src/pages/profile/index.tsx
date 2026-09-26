import { useState } from 'react';
import { useLocation } from 'wouter';
import { BatteryCharging, Car, Check, Download, LogOut, MapPin, Smartphone } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';
import { ErrorBox } from '@/components/common/ui';
import { PwaInstallModal } from '@/components/pwa/PwaInstallModal';
import { VehicleModal } from '@/pages/profile/VehicleModal';
import { useAuth } from '@/context/AuthContext';
import { usePwa } from '@/context/PwaContext';
import { useMeta } from '@/hooks/queries';
import { api } from '@/lib/api';
import { initials } from '@/lib/format';
import type { User, Vehicle } from '@/types/api';

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, setUser, logout } = useAuth();
  const { data: meta } = useMeta();
  const { isInstalled, promptInstall } = usePwa();
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  async function save(patch: { vehicle?: Vehicle; regionId?: string }) {
    setError(null);
    setSaved(false);
    try {
      const r = await api.patch<{ user: User }>('/auth/me', patch);
      setUser(r.user);
      setSaved(true);
    } catch (err) {
      setError(err);
    }
  }

  if (!user) return null;
  const v = user.vehicle;

  return (
    <AppShell>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <span className="rf-eyebrow">Configurações</span>
          <h1 className="rf-title" style={{ fontSize: 24, margin: '2px 0 0' }}>Minha conta</h1>
        </div>

        <div className="rf-card rf-row">
          <div className="rf-avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(user.name)}</div>
          <div>
            <h3 style={{ margin: 0 }}>{user.name}</h3>
            <p className="rf-small" style={{ margin: '2px 0 0' }}>{user.email}</p>
          </div>
        </div>

        <ErrorBox error={error} />
        {saved && <div className="rf-success">Preferências salvas.</div>}

        <div className="rf-card rf-stack">
          <div className="rf-row"><MapPin size={18} color="#4ae3a5" /><h3 style={{ margin: 0 }}>Região principal</h3></div>
          <p className="rf-small" style={{ margin: 0 }}>Define os preços exibidos, os sinais de preço e os comunicados do operador que você recebe.</p>
          <select className="rf-select" value={user.regionId ?? 'capital'} onChange={(e) => save({ regionId: e.target.value })}>
            {meta?.regions.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.distributor}</option>)}
          </select>
        </div>

        <div className="rf-card rf-stack">
          <div className="rf-between">
            <div className="rf-row"><Car size={18} color="#38bdf8" /><h3 style={{ margin: 0 }}>Veículo</h3></div>
            <button type="button" className="rf-btn secondary small" onClick={() => setVehicleOpen(true)}>Trocar de veículo</button>
          </div>
          {v ? (
            <div className="rf-charge-card">
              <div className="rf-strong">{v.manufacturer} {v.model}</div>
              <div className="rf-small">Bateria {v.batteryKwh} kWh · {v.connector} até {v.maxDcKw} kW DC · AC até {v.maxAcKw} kW · {v.soc}% (~{v.rangeKm} km)</div>
            </div>
          ) : <p className="rf-small">Nenhum veículo cadastrado.</p>}
        </div>

        {v && (
          <div className="rf-card rf-stack">
            <div className="rf-row"><BatteryCharging size={18} color="#4ae3a5" /><h3 style={{ margin: 0 }}>Meta de carga padrão</h3></div>
            <div className="rf-segmented-toggle" style={{ width: '100%' }}>
              {[70, 80, 90, 100].map((val) => (
                <button key={val} type="button" className={`rf-segmented-btn ${v.targetSoc === val ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => save({ vehicle: { ...v, targetSoc: val } })}>
                  {val}%{val === 80 && ' (ideal)'}
                </button>
              ))}
            </div>
            <p className="rf-tiny" style={{ margin: 0 }}>Parar em 80% preserva a bateria e deixa o carregador livre mais cedo.</p>
          </div>
        )}

        <div className="rf-card rf-stack">
          <div className="rf-between">
            <div className="rf-row"><Smartphone size={18} color="#4ae3a5" /><h3 style={{ margin: 0 }}>App no celular</h3></div>
            {isInstalled && <span className="rf-badge"><Check size={12} /> Instalado</span>}
          </div>
          {!isInstalled && <Button className="secondary" onClick={promptInstall}><Download size={14} /> Instalar aplicativo</Button>}
        </div>

        <div className="rf-card rf-stack">
          <h3 style={{ margin: 0 }}>Privacidade</h3>
          <p className="rf-small" style={{ margin: 0 }}>
            Guardamos só o necessário para recomendar recargas (região, veículo, histórico de sessões). Gestores veem apenas dados agregados por região. Sua localização GPS fica no seu navegador e é enviada somente para calcular distâncias.
          </p>
        </div>

        <Button className="danger" onClick={async () => { await logout(); setLocation('/login'); }}><LogOut size={14} /> Sair da conta</Button>
      </div>

      {v && <VehicleModal isOpen={vehicleOpen} onClose={() => setVehicleOpen(false)} currentVehicle={v} onSelect={(nv) => save({ vehicle: nv })} />}
      <PwaInstallModal />
    </AppShell>
  );
}
