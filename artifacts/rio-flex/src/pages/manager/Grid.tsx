import { useState } from 'react';
import {
  Area, AreaChart, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ManagerShell } from '@/components/layout/ManagerShell';
import { ErrorBox, Loading } from '@/components/common/ui';
import { useMeta, usePriceForecast } from '@/hooks/queries';
import { LEVEL_COLOR, money, num } from '@/lib/format';
import { useGrid } from './hooks';

const tooltipStyle = { background: '#11161b', border: '1px solid #27313a', borderRadius: 10, fontSize: 12 };
const axis = { fill: '#738291', fontSize: 11 };

export default function ManagerGridPage() {
  const { data: meta } = useMeta();
  const [region, setRegion] = useState('capital');
  const { data, isLoading, error } = useGrid(region, 24);
  const { data: prices } = usePriceForecast(region, 24);

  const gridData = data?.grid.map((g) => ({
    hora: `${g.localHour}h`,
    demanda: g.regionalDemandMw,
    capacidade: g.regionalCapacityMw,
    carga: g.loadFactorPct,
    hidraulica: g.submarket.generationGw.hidraulica,
    solar: g.submarket.generationGw.solar,
    eolica: g.submarket.generationGw.eolica,
    termica: g.submarket.generationGw.termica,
    nuclear: g.submarket.generationGw.nuclear,
  }));
  const now = data?.grid[0];
  const w = data?.weather[0];

  return (
    <ManagerShell>
      <div className="rf-page">
        <div className="rf-page-head">
          <div>
            <span className="rf-eyebrow">Mercado, rede e clima · próximas 24 h</span>
            <h1 className="rf-title">Rede, preço & clima</h1>
            <p className="rf-subtitle">Dados simulados, estruturados para integração com CCEE (PLD), ONS (carga e geração) e INMET (clima).</p>
          </div>
          <select className="rf-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Região">
            {meta?.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {isLoading && <Loading />}
        <ErrorBox error={error} />

        {now && w && data && (
          <div className="rf-kpis">
            <div className="rf-kpi"><span>Demanda regional</span><strong>{num(now.regionalDemandMw)} MW</strong><small>{now.loadFactorPct}% da capacidade</small></div>
            <div className="rf-kpi"><span>Recarga de VE agora</span><strong>{num(data.evLoad.mw, 2)} MW</strong><small>{data.evLoad.busyConnectors}/{data.evLoad.totalConnectors} conectores</small></div>
            <div className="rf-kpi"><span>Renovável SE/CO</span><strong style={{ color: '#4ae3a5' }}>{now.submarket.renewableSharePct}%</strong><small>carga {now.submarket.demandGw} GW</small></div>
            <div className="rf-kpi"><span>Clima</span><strong>{w.temperatureC} °C</strong><small>{w.condition} · chuva {w.rainProbabilityPct}%</small></div>
            <div className="rf-kpi"><span>Irradiância</span><strong>{w.irradianceWm2} W/m²</strong><small>nuvens {w.cloudCoverPct}% · vento {w.windKmh} km/h</small></div>
          </div>
        )}

        {prices && (
          <div className="rf-card">
            <h3>PLD e custo da energia (melhor oferta regional)</h3>
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <ComposedChart data={prices.map((p) => ({ hora: `${p.localHour}h`, pld: p.pldMwh, custo: p.energyCostKwh, dc: p.consumerPrices.dc_rapida, level: p.level }))}>
                  <CartesianGrid stroke="#1e2831" vertical={false} />
                  <XAxis dataKey="hora" tick={axis} />
                  <YAxis yAxisId="l" tick={axis} width={56} tickFormatter={(v: number) => `${v}`} label={{ value: 'PLD R$/MWh', angle: -90, fill: '#66727e', fontSize: 10, position: 'insideLeft' }} />
                  <YAxis yAxisId="r" orientation="right" tick={axis} width={50} tickFormatter={(v: number) => v.toFixed(2)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => (n === 'PLD' ? `${money(v)}/MWh` : `${money(v)}/kWh`)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="l" dataKey="pld" name="PLD" fill="#33404b" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="r" dataKey="custo" name="Custo energia" stroke="#55a7ff" dot={false} strokeWidth={2} />
                  <Line yAxisId="r" dataKey="dc" name="Preço DC ao consumidor" stroke="#4ae3a5" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
              {prices.map((p) => <div key={p.localTime} title={`${p.localHour}h · ${p.level}`} style={{ flex: 1, height: 6, borderRadius: 2, background: LEVEL_COLOR[p.level] }} />)}
            </div>
            <div className="rf-tiny" style={{ marginTop: 4 }}>Faixa colorida = nível do sinal hora a hora.</div>
          </div>
        )}

        {gridData && (
          <div className="rf-grid rf-grid-2">
            <div className="rf-card">
              <h3>Demanda regional vs. capacidade (MW)</h3>
              <div style={{ height: 230 }}>
                <ResponsiveContainer>
                  <ComposedChart data={gridData}>
                    <CartesianGrid stroke="#1e2831" vertical={false} />
                    <XAxis dataKey="hora" tick={axis} />
                    <YAxis tick={axis} width={50} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area dataKey="demanda" name="Demanda" stroke="#55a7ff" fill="rgba(85,167,255,.2)" />
                    <Line dataKey="capacidade" name="Capacidade" stroke="#ff6b6b" strokeDasharray="4 4" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rf-card">
              <h3>Geração por fonte — subsistema SE/CO (GW)</h3>
              <div style={{ height: 230 }}>
                <ResponsiveContainer>
                  <AreaChart data={gridData}>
                    <CartesianGrid stroke="#1e2831" vertical={false} />
                    <XAxis dataKey="hora" tick={axis} />
                    <YAxis tick={axis} width={40} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area stackId="g" dataKey="hidraulica" name="Hidráulica" stroke="#55a7ff" fill="#55a7ff" fillOpacity={0.5} />
                    <Area stackId="g" dataKey="solar" name="Solar" stroke="#f7c65c" fill="#f7c65c" fillOpacity={0.6} />
                    <Area stackId="g" dataKey="eolica" name="Eólica" stroke="#4ae3a5" fill="#4ae3a5" fillOpacity={0.5} />
                    <Area stackId="g" dataKey="nuclear" name="Nuclear" stroke="#b98cff" fill="#b98cff" fillOpacity={0.5} />
                    <Area stackId="g" dataKey="termica" name="Térmica" stroke="#ff6b6b" fill="#ff6b6b" fillOpacity={0.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {data && (
          <div className="rf-card">
            <h3>Clima hora a hora</h3>
            <div className="rf-table-wrap">
              <table className="rf-table plain">
                <thead><tr><th>Hora</th><th>Condição</th><th>Temp.</th><th>Nuvens</th><th>Irradiância</th><th>Chuva</th><th>Vento</th></tr></thead>
                <tbody>
                  {data.weather.filter((_, i) => i % 2 === 0).map((x) => (
                    <tr key={x.localTime}>
                      <td>{x.localHour}h</td><td>{x.condition}</td><td>{x.temperatureC} °C</td><td>{x.cloudCoverPct}%</td>
                      <td>{x.irradianceWm2} W/m²</td><td>{x.rainProbabilityPct}%</td><td>{x.windKmh} km/h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ManagerShell>
  );
}
