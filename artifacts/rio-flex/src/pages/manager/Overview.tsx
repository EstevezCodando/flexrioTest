import { Link } from 'wouter';
import { Bot, Megaphone } from 'lucide-react';
import { ManagerShell } from '@/components/layout/ManagerShell';
import { Button } from '@/components/common/Button';
import { ErrorBox, LevelBadge, Loading } from '@/components/common/ui';
import { useNotifications } from '@/hooks/queries';
import { dateTimeOf, money, num } from '@/lib/format';
import { useOverview } from './hooks';

export default function ManagerOverviewPage() {
  const { data, isLoading, error } = useOverview();
  const { data: notes } = useNotifications();
  const ops = notes?.items.filter((n) => ['demand_peak', 'price_critical', 'manager_signal'].includes(n.kind)).slice(0, 5) ?? [];

  return (
    <ManagerShell>
      <div className="rf-page">
        <div className="rf-page-head">
          <div>
            <span className="rf-eyebrow">Visão geral {data && `· ${dateTimeOf(data.generatedAt)}`}</span>
            <h1 className="rf-title">Operação da rede de recarga</h1>
            <p className="rf-subtitle">Preço, demanda e uso dos carregadores por região. Dados agregados — sem informações individuais de consumidores.</p>
          </div>
          <div className="rf-row">
            <Button href="/gestor/sinais" className="secondary small"><Megaphone size={13} /> Publicar sinal</Button>
            <Button href="/gestor/flexia" className="purple small"><Bot size={13} /> Perguntar à FlexIA</Button>
          </div>
        </div>
        {isLoading && <Loading />}
        <ErrorBox error={error} />
        {data && (
          <>
            <div className="rf-kpis">
              <div className="rf-kpi"><span>Estações</span><strong>{num(data.totals.stations)}</strong><small>{data.totals.publicStations} públicas · {data.totals.dcStations} com DC</small></div>
              <div className="rf-kpi"><span>Conectores</span><strong>{num(data.totals.connectors)}</strong><small>{data.totals.maintenance} locais em manutenção</small></div>
              <div className="rf-kpi"><span>Consumidores</span><strong>{data.totals.consumers}</strong><small>{data.totals.activeAlerts} alertas ativos</small></div>
              <div className="rf-kpi"><span>Recargas (7 dias)</span><strong>{data.totals.sessions7d}</strong><small>{num(data.totals.energy7dKwh, 1)} kWh · {data.totals.activeSessions} ativas</small></div>
              <div className="rf-kpi"><span>Eventos de flexibilidade</span><strong style={{ color: '#b98cff' }}>{data.totals.flexEvents7d}</strong><small>modulações aceitas (7 dias)</small></div>
              <div className="rf-kpi"><span>Preço publicado (mediana)</span><strong>{data.totals.publishedPrices.median ? money(data.totals.publishedPrices.median) : '—'}</strong><small>{data.totals.priceConflicts} cadastros com conflito</small></div>
            </div>

            <div className="rf-card">
              <h3>Alertas operacionais {notes?.unread ? `(${notes.unread} novos)` : ''}</h3>
              {ops.length === 0 && <p className="rf-small">Sem alertas. O sistema avisa quando a carga regional passa de 85% ou quando o preço fica crítico sem sinal do operador.</p>}
              {ops.map((n) => (
                <div key={n.id} className="rf-wallet-history-item">
                  <div>
                    <div className="rf-strong" style={{ fontSize: 13 }}>{n.title}</div>
                    <div className="rf-small">{n.body}</div>
                  </div>
                  <span className="rf-tiny">{dateTimeOf(n.createdAt)}</span>
                </div>
              ))}
            </div>

            <div className="rf-card">
              <h3>Regiões agora</h3>
              <div className="rf-table-wrap">
                <table className="rf-table plain">
                  <thead>
                    <tr><th>Região</th><th>Sinal</th><th>Custo energia</th><th>DC rápida</th><th>Demanda</th><th>Carga</th><th>Recarga VE</th><th>Conectores ocupados</th></tr>
                  </thead>
                  <tbody>
                    {data.regions.map((r) => (
                      <tr key={r.regionId}>
                        <td className="rf-strong">{r.regionName}</td>
                        <td><LevelBadge level={r.level} label={`${r.level}${r.signalSource === 'gestor' ? ' ★' : ''}`} /></td>
                        <td className="rf-mono">{money(r.energyCostKwh)}</td>
                        <td className="rf-mono">{money(r.dcPriceKwh)}</td>
                        <td className="rf-mono">{num(r.demandMw)} MW</td>
                        <td style={{ color: r.loadFactorPct > 85 ? '#ff6b6b' : r.loadFactorPct > 75 ? '#f7c65c' : '#4ae3a5' }}>{r.loadFactorPct}%</td>
                        <td className="rf-mono">{num(r.evLoadMw, 2)} MW</td>
                        <td>{r.busyConnectors}/{r.totalConnectors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="rf-tiny">★ = sinal publicado por gestor. Demais níveis são calculados automaticamente a partir do custo horário (percentis do dia) e do posto tarifário.</p>
            </div>

            <div className="rf-card">
              <div className="rf-between"><h3 style={{ margin: 0 }}>Sinais ativos e agendados</h3><Link href="/gestor/sinais" className="rf-small" style={{ color: '#b98cff' }}>gerenciar</Link></div>
              {data.signals.length === 0 && <p className="rf-small">Nenhum sinal manual ativo — a precificação está no modo automático.</p>}
              {data.signals.map((s) => (
                <div key={s.id} className="rf-wallet-history-item">
                  <div>
                    <div className="rf-strong" style={{ fontSize: 13 }}>{s.title}</div>
                    <div className="rf-tiny">{s.regionId} · {dateTimeOf(s.startsAt)} → {dateTimeOf(s.endsAt)} · {s.status}</div>
                  </div>
                  <LevelBadge level={s.level} label={s.level} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ManagerShell>
  );
}
