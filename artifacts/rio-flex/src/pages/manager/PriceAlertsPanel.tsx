import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { ErrorBox, Loading } from '@/components/common/ui';
import { useMeta, usePriceForecast } from '@/hooks/queries';
import { LEVEL_COLOR, money } from '@/lib/format';
import type { SignalLevel } from '@/types/api';

const axis = { fill: '#738291', fontSize: 11 };
const tooltipStyle = { background: '#11161b', border: '1px solid #27313a', borderRadius: 10, fontSize: 12 };

/**
 * Visualização dos alertas de preço do gestor: cada barra é uma hora das próximas 24h, colorida
 * pelo nível de sinal daquele instante (verde/amarelo/vermelho) — não uma lista de texto, um
 * gráfico que mostra de cara ONDE e QUANDO a rede fica cara, por região. Segue o guia de
 * elegância: uma mensagem por gráfico, cores de estado fixas, anotação direta no gráfico.
 */
export function PriceAlertsPanel() {
  const { data: meta } = useMeta();
  const [region, setRegion] = useState('capital');
  const { data: forecast, isLoading, error } = usePriceForecast(region, 24);

  const chartData = forecast?.map((p) => ({
    hora: `${p.localHour}h`,
    preco: p.consumerPrices.dc_rapida,
    level: p.level,
  }));

  const alertHours = forecast?.filter((p) => p.level !== 'verde').length ?? 0;
  const avgPrice = forecast?.length ? forecast.reduce((s, p) => s + p.consumerPrices.dc_rapida, 0) / forecast.length : null;
  const regionName = meta?.regions.find((r) => r.id === region)?.name ?? region;

  return (
    <div className="rf-card">
      <div className="rf-alert-panel-head">
        <div>
          <div className="rf-row" style={{ marginBottom: 2 }}>
            <AlertTriangle size={14} color={alertHours > 0 ? '#f7c65c' : '#4ae3a5'} />
            <h3 style={{ margin: 0 }}>Alertas de preço — {regionName}</h3>
          </div>
          <p className="rf-tiny" style={{ margin: 0 }}>
            {alertHours > 0
              ? `${alertHours} das próximas 24h em janela amarela ou vermelha nesta região.`
              : 'Nenhuma janela de alerta prevista nas próximas 24h — preço acompanha o automático.'}
          </p>
        </div>
        <div className="rf-alert-legend">
          <span><i style={{ background: LEVEL_COLOR.verde }} />Verde: energia barata</span>
          <span><i style={{ background: LEVEL_COLOR.amarelo }} />Amarelo: normal</span>
          <span><i style={{ background: LEVEL_COLOR.vermelho }} />Vermelho: rede pressionada</span>
        </div>
      </div>

      {meta && (
        <div className="rf-alert-region-pills" style={{ margin: '10px 0' }}>
          {meta.regions.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`rf-alert-region-pill ${region === r.id ? 'active' : ''}`}
              onClick={() => setRegion(r.id)}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {isLoading && <Loading />}
      <ErrorBox error={error} />

      {chartData && (
        <>
          <div style={{ height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid stroke="#1e2831" vertical={false} />
                <XAxis dataKey="hora" tick={axis} interval={2} />
                <YAxis tick={axis} width={56} tickFormatter={(v: number) => money(v)} />
                {avgPrice !== null && (
                  <ReferenceLine y={avgPrice} stroke="#66727e" strokeDasharray="4 4" label={{ value: 'média 24h', position: 'insideTopRight', fill: '#66727e', fontSize: 10 }} />
                )}
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, _n, item) => [`${money(v)}/kWh · ${(item.payload as { level: SignalLevel }).level}`, 'Preço DC rápida']}
                />
                <Bar dataKey="preco" radius={[3, 3, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={LEVEL_COLOR[d.level]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="rf-tiny" style={{ marginTop: 6 }}>
            Preço ao consumidor (recarga DC rápida) por hora, próximas 24h · cor = nível do sinal naquele instante.
          </p>
        </>
      )}
    </div>
  );
}

/** "atualizado há Xmin" — âmbar quando o dado passou de 5 minutos, para o gestor saber se confia nele. */
export function Freshness({ iso }: { iso: string }) {
  const ageMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  const stale = ageMin > 5;
  return (
    <span className={`rf-freshness ${stale ? 'stale' : ''}`}>
      <span className="dot" />
      {ageMin <= 0 ? 'atualizado agora' : `atualizado há ${ageMin} min`}
    </span>
  );
}
