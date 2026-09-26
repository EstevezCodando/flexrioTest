import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, XCircle } from 'lucide-react';
import { ManagerShell } from '@/components/layout/ManagerShell';
import { Button } from '@/components/common/Button';
import { ErrorBox, LevelBadge, Loading } from '@/components/common/ui';
import { useMeta } from '@/hooks/queries';
import { api } from '@/lib/api';
import { dateTimeOf, LEVEL_HINT } from '@/lib/format';
import type { SignalDto, SignalLevel } from '@/types/api';
import { useSignals } from './hooks';

/** Converte "AAAA-MM-DDTHH:mm" (input local do RJ) para ISO com fuso -03:00. */
const toIso = (local: string) => `${local}:00-03:00`;

function localInput(offsetHours: number): string {
  const d = new Date(Date.now() + offsetHours * 3600_000 - 3 * 3600_000);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function ManagerSignalsPage() {
  const qc = useQueryClient();
  const { data: meta } = useMeta();
  const [showPast, setShowPast] = useState(false);
  const { data: signals, isLoading } = useSignals(showPast);
  const [level, setLevel] = useState<SignalLevel>('verde');
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<string | null>(null);

  const invalidate = () => ['mgr-signals', 'mgr-overview', 'price-now', 'price-forecast', 'region-prices'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const create = useMutation({
    mutationFn: (body: object) => api.post<{ signal: SignalDto; notifiedConsumers: number }>('/manager/signals', body),
    onSuccess: (r) => {
      setResult(`Sinal publicado. ${r.notifiedConsumers} consumidor(es) notificado(s).`);
      invalidate();
    },
    onError: setError,
  });
  const cancel = useMutation({ mutationFn: (id: string) => api.del(`/manager/signals/${id}`), onSuccess: invalidate });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const f = new FormData(e.currentTarget);
    create.mutate({
      regionId: f.get('regionId'),
      level,
      startsAt: toIso(String(f.get('startsAt'))),
      endsAt: toIso(String(f.get('endsAt'))),
      title: f.get('title'),
      message: f.get('message'),
      notifyConsumers: f.get('notify') === 'on',
    });
  }

  return (
    <ManagerShell>
      <div className="rf-page">
        <div>
          <span className="rf-eyebrow">Repasse de sinais ao consumidor</span>
          <h1 className="rf-title">Sinais de preço</h1>
          <p className="rf-subtitle">
            Um sinal sobrepõe o nível automático numa região e janela: ajusta o preço dinâmico (multiplicador sobre a margem do serviço), concede créditos por kWh nas janelas verdes e notifica os consumidores da região.
          </p>
        </div>

        <div className="rf-grid rf-grid-2">
          <form className="rf-card rf-stack" onSubmit={onSubmit}>
            <h3>Novo sinal</h3>
            <div className="rf-field">
              <label className="rf-label" htmlFor="s-region">Região</label>
              <select id="s-region" name="regionId" className="rf-select" defaultValue="capital">
                {meta?.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="rf-field">
              <span className="rf-label">Nível</span>
              <div className="rf-row">
                {(['verde', 'amarelo', 'vermelho'] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setLevel(l)} className={`rf-level ${l}`} style={{ cursor: 'pointer', opacity: level === l ? 1 : 0.45 }}>
                    <span className="dot" />{l}
                  </button>
                ))}
              </div>
              <span className="rf-tiny">{LEVEL_HINT[level]}</span>
            </div>
            <div className="rf-grid rf-grid-2" style={{ gap: 10 }}>
              <div className="rf-field">
                <label className="rf-label" htmlFor="s-start">Início (horário do RJ)</label>
                <input id="s-start" name="startsAt" type="datetime-local" className="rf-input" defaultValue={localInput(1)} required />
              </div>
              <div className="rf-field">
                <label className="rf-label" htmlFor="s-end">Fim</label>
                <input id="s-end" name="endsAt" type="datetime-local" className="rf-input" defaultValue={localInput(3)} required />
              </div>
            </div>
            <div className="rf-field">
              <label className="rf-label" htmlFor="s-title">Título</label>
              <input id="s-title" name="title" className="rf-input" required minLength={3} maxLength={80} defaultValue="Janela verde: excedente solar" />
            </div>
            <div className="rf-field">
              <label className="rf-label" htmlFor="s-msg">Mensagem ao consumidor</label>
              <textarea id="s-msg" name="message" className="rf-input" required minLength={10} maxLength={280}
                defaultValue="Energia mais barata nas próximas horas: recarregue agora com preço reduzido e ganhe créditos extras por kWh." />
            </div>
            <label className="rf-row rf-small"><input type="checkbox" name="notify" defaultChecked /> Notificar consumidores da região</label>
            <ErrorBox error={error} />
            {result && <div className="rf-success">{result}</div>}
            <Button type="submit" className="purple" disabled={create.isPending}><Megaphone size={14} /> Publicar sinal</Button>
          </form>

          <div className="rf-card rf-stack">
            <div className="rf-between">
              <h3 style={{ margin: 0 }}>Sinais</h3>
              <label className="rf-row rf-tiny"><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> incluir encerrados</label>
            </div>
            {isLoading && <Loading />}
            {signals?.length === 0 && <p className="rf-small">Nenhum sinal. A precificação segue o modo automático.</p>}
            {signals?.map((s) => (
              <div key={s.id} className="rf-connector-row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="rf-row"><LevelBadge level={s.level} label={s.level} /><b className="rf-strong" style={{ fontSize: 13 }}>{s.title}</b></div>
                  <div className="rf-tiny" style={{ marginTop: 4 }}>{s.regionId} · {dateTimeOf(s.startsAt)} → {dateTimeOf(s.endsAt)} · <b>{s.status}</b> · ×{s.multiplier} · +R$ {s.creditBonusKwh.toFixed(2)}/kWh</div>
                  <div className="rf-small" style={{ marginTop: 4 }}>{s.message}</div>
                </div>
                {s.status !== 'encerrado' && (
                  <button type="button" className="rf-btn secondary small" title="Cancelar sinal" onClick={() => cancel.mutate(s.id)}><XCircle size={13} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ManagerShell>
  );
}
