import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';
import { ErrorBox, LevelBadge, Loading } from '@/components/common/ui';
import { useAlerts, useMeta, useNotifications, useUserRegion } from '@/hooks/queries';
import { api } from '@/lib/api';
import { dateTimeOf, money } from '@/lib/format';
import type { ChargeType } from '@/types/api';

export default function AlertsPage() {
  const qc = useQueryClient();
  const region = useUserRegion();
  const { data: meta } = useMeta();
  const { data: alerts, isLoading } = useAlerts();
  const { data: notifications } = useNotifications();
  const [formError, setFormError] = useState<unknown>(null);
  const [green, setGreen] = useState(true);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['alerts'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const create = useMutation({
    mutationFn: (body: object) => api.post('/me/alerts', body),
    onSuccess: refresh,
    onError: setFormError,
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/me/alerts/${id}`, { active }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/me/alerts/${id}`), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: refresh });
  const readOne = useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`), onSuccess: refresh });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const f = new FormData(e.currentTarget);
    const max = String(f.get('maxPrice') ?? '').replace(',', '.');
    create.mutate({
      regionId: String(f.get('regionId')),
      chargeType: String(f.get('chargeType')) as ChargeType,
      maxPriceKwh: max ? Number(max) : null,
      notifyGreenWindow: green,
    });
  }

  return (
    <AppShell>
      <div className="rf-page">
        <div className="rf-page-head">
          <div>
            <span className="rf-eyebrow">Alertas de preço</span>
            <h1 className="rf-title">Seja avisado quando valer a pena carregar</h1>
            <p className="rf-subtitle">O Rio Flex verifica o preço a cada minuto e avisa quando ele cair abaixo do seu alvo ou quando abrir uma janela verde na sua região.</p>
          </div>
        </div>

        <div className="rf-grid rf-grid-2">
          <form className="rf-card rf-stack" onSubmit={onSubmit}>
            <h3>Novo alerta</h3>
            <div className="rf-field">
              <label className="rf-label" htmlFor="a-region">Região</label>
              <select id="a-region" name="regionId" className="rf-select" defaultValue={region}>
                {meta?.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="rf-field">
              <label className="rf-label" htmlFor="a-type">Tipo de carregamento</label>
              <select id="a-type" name="chargeType" className="rf-select" defaultValue="dc_rapida">
                {meta?.chargeTypes.map((c) => <option key={c.id} value={c.id}>{c.label} — {c.description}</option>)}
              </select>
            </div>
            <div className="rf-field">
              <label className="rf-label" htmlFor="a-max">Avisar quando o preço for até (R$/kWh) — opcional</label>
              <input id="a-max" name="maxPrice" className="rf-input" inputMode="decimal" placeholder="ex.: 2,20" pattern="^\d{1,2}([.,]\d{1,2})?$" />
            </div>
            <label className="rf-between rf-small">
              Avisar em toda janela verde (energia barata + créditos extras)
              <span className="rf-switch-toggle">
                <input type="checkbox" checked={green} onChange={(e) => setGreen(e.target.checked)} />
                <span className="rf-switch-slider" />
              </span>
            </label>
            <ErrorBox error={formError} />
            <Button type="submit" disabled={create.isPending}><Bell size={14} /> Criar alerta</Button>
          </form>

          <div className="rf-card rf-stack">
            <h3>Meus alertas</h3>
            {isLoading && <Loading />}
            {alerts?.length === 0 && <p className="rf-small">Nenhum alerta ainda.</p>}
            {alerts?.map((a) => (
              <div key={a.id} className="rf-connector-row" style={{ opacity: a.active ? 1 : 0.55 }}>
                <div>
                  <div className="rf-strong" style={{ fontSize: 13 }}>{a.chargeTypeLabel} · {a.stationName ?? a.regionName}</div>
                  <div className="rf-tiny">
                    {a.maxPriceKwh ? `até ${money(a.maxPriceKwh)}/kWh` : ''}{a.maxPriceKwh && a.notifyGreenWindow ? ' · ' : ''}{a.notifyGreenWindow ? 'janelas verdes' : ''}
                    {' '}· agora {money(a.currentPriceKwh)} <LevelBadge level={a.currentLevel} label={a.currentLevel} />
                  </div>
                  {a.lastTriggeredAt && <div className="rf-tiny">último aviso {dateTimeOf(a.lastTriggeredAt)}</div>}
                </div>
                <div className="rf-row">
                  <button type="button" className="rf-btn secondary small" title={a.active ? 'Pausar' : 'Ativar'} onClick={() => toggle.mutate({ id: a.id, active: !a.active })}>
                    {a.active ? <BellOff size={13} /> : <Bell size={13} />}
                  </button>
                  <button type="button" className="rf-btn secondary small" title="Excluir" onClick={() => remove.mutate(a.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rf-card">
          <div className="rf-between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Notificações {notifications?.unread ? `(${notifications.unread} novas)` : ''}</h3>
            <button type="button" className="rf-btn secondary small" onClick={() => readAll.mutate()}><CheckCheck size={13} /> Marcar todas como lidas</button>
          </div>
          {notifications?.items.length === 0 && <p className="rf-small">Sem notificações.</p>}
          {notifications?.items.map((n) => (
            <div key={n.id} className="rf-wallet-history-item" onClick={() => !n.read && readOne.mutate(n.id)} style={{ cursor: n.read ? 'default' : 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: n.read ? '#98a6b3' : '#f8fafc' }}>
                  {!n.read && <span className="rf-status-dot disponivel" style={{ marginRight: 6 }} />}{n.title}
                </div>
                <div className="rf-small" style={{ marginTop: 2 }}>{n.body}</div>
              </div>
              <span className="rf-tiny">{dateTimeOf(n.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
