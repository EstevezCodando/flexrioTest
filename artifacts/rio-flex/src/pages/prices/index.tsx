import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBox, LevelBadge, Loading } from '@/components/common/ui';
import { useMeta, usePriceForecast, usePriceNow, useRegionPrices, useUserRegion } from '@/hooks/queries';
import { CHARGE_LABEL, LEVEL_COLOR, money, POST_LABEL, PRODUCT_LABEL } from '@/lib/format';
import type { ChargeType } from '@/types/api';

const BREAKDOWN_COLORS = { energia: '#4ae3a5', fio: '#55a7ff', encargos: '#f7c65c', tributos: '#b98cff' };

/**
 * Tela de preços do consumidor: custo da energia (com composição), preço por tipo de
 * recarga, curva de 24 h com o sinal verde/amarelo/vermelho e a melhor oferta regional.
 */
export default function PricesPage() {
  const userRegion = useUserRegion();
  const [region, setRegion] = useState(userRegion);
  const [chargeType, setChargeType] = useState<ChargeType>('dc_rapida');
  const { data: meta } = useMeta();
  const { data: now, error, isLoading } = usePriceNow(region);
  const { data: forecast } = usePriceForecast(region, 24);
  const { data: regionPrices } = useRegionPrices();

  const b = now?.best;
  const total = b ? b.energyKwh + b.wireKwh + b.chargesKwh + b.taxesKwh : 1;

  return (
    <AppShell>
      <div className="rf-page">
        <div className="rf-page-head">
          <div>
            <span className="rf-eyebrow">Transparência de preço</span>
            <h1 className="rf-title">Preços da energia e da recarga</h1>
            <p className="rf-subtitle">Quanto custa a energia agora, como o preço é formado e qual o melhor horário para carregar.</p>
          </div>
          <select className="rf-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Região">
            {meta?.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <ErrorBox error={error} />
        {isLoading && <Loading />}

        {now && b && (
          <>
            <div className={`rf-signal-hero ${now.signal.level}`}>
              <div>
                <span className="rf-eyebrow">Agora · {now.localTime.slice(11, 16)} · posto {POST_LABEL[now.tariffPost]}</span>
                <div className="rf-row" style={{ margin: '6px 0' }}>
                  <LevelBadge level={now.signal.level} />
                  {now.signal.source === 'gestor' && <span className="rf-badge purple">sinal do operador</span>}
                </div>
                <div className="rf-small">
                  {now.signal.title ?? (now.signal.level === 'verde'
                    ? `Preço reduzido em ${Math.round((1 - now.signal.multiplier) * 100)}% e +${money(now.signal.creditBonusKwh)} de crédito por kWh.`
                    : now.signal.level === 'vermelho'
                      ? `Preço ${Math.round((now.signal.multiplier - 1) * 100)}% maior para aliviar a rede. Se puder, espere a próxima janela.`
                      : 'Preço padrão.')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="rf-tiny">Custo da energia (melhor oferta)</div>
                <div style={{ font: '700 28px var(--app-font-mono)', color: '#f8fafc' }}>{money(b.totalKwh)}<span className="rf-small">/kWh</span></div>
                <div className="rf-tiny">PLD {money(now.pldMwh)}/MWh · submercado {now.region.submarket}</div>
              </div>
            </div>

            {/* PREÇO POR TIPO DE RECARGA */}
            <div className="rf-card">
              <h3>Preço por tipo de carregamento</h3>
              <p className="rf-small">Preço final ao consumidor = custo da energia + serviço do eletroposto (varia com a potência), ajustado pelo sinal da rede.</p>
              <div className="rf-charge-grid" style={{ marginTop: 12 }}>
                {now.chargeTypes.map((ct) => (
                  <button
                    key={ct.id}
                    type="button"
                    className={`rf-charge-card ${chargeType === ct.id ? 'active' : ''}`}
                    onClick={() => setChargeType(ct.id)}
                    style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer' }}
                  >
                    <div className="rf-strong">{ct.label}</div>
                    <div className="price">{money(ct.priceKwh)}<span className="rf-small">/kWh</span></div>
                    <div className="rf-tiny">{ct.description}</div>
                    <div className="rf-tiny" style={{ marginTop: 6 }}>~{money(ct.priceKwh * 20)} para 20 kWh (≈ 130 km)</div>
                  </button>
                ))}
              </div>
            </div>

            {/* CURVA 24H */}
            <div className="rf-card">
              <div className="rf-between">
                <h3 style={{ margin: 0 }}>Próximas 24 horas — {CHARGE_LABEL[chargeType]}</h3>
                <div className="rf-legend">
                  <span><i style={{ background: LEVEL_COLOR.verde }} />verde</span>
                  <span><i style={{ background: LEVEL_COLOR.amarelo }} />amarelo</span>
                  <span><i style={{ background: LEVEL_COLOR.vermelho }} />vermelho</span>
                </div>
              </div>
              <div style={{ height: 240, marginTop: 12 }}>
                {forecast && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecast.map((p) => ({ hora: `${p.localHour}h`, preco: p.consumerPrices[chargeType], level: p.level, pld: p.pldMwh }))}>
                      <CartesianGrid stroke="#1e2831" vertical={false} />
                      <XAxis dataKey="hora" tick={{ fill: '#738291', fontSize: 11 }} interval={1} />
                      <YAxis tick={{ fill: '#738291', fontSize: 11 }} tickFormatter={(v: number) => `R$${v.toFixed(2)}`} width={62} />
                      <Tooltip
                        contentStyle={{ background: '#11161b', border: '1px solid #27313a', borderRadius: 10, fontSize: 12 }}
                        formatter={(v: number, _n, item) => [`${money(v)}/kWh · PLD ${money(item.payload.pld)}/MWh`, item.payload.level]}
                      />
                      <Bar dataKey="preco" radius={[4, 4, 0, 0]}>
                        {forecast.map((p) => <Cell key={p.localTime} fill={LEVEL_COLOR[p.level]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="rf-row" style={{ marginTop: 10 }}>
                <span className="rf-small">Melhores janelas (DC):</span>
                {now.bestWindows.map((w) => (
                  <span key={w.startsAt} className={`rf-level ${w.level}`}>{w.startHour}h–{w.endHour}h · {money(w.avgPriceKwh)}</span>
                ))}
              </div>
            </div>

            <div className="rf-grid rf-grid-2">
              {/* COMPOSIÇÃO */}
              <div className="rf-card">
                <h3>Como o custo da energia é formado</h3>
                <div className="rf-breakdown-bar">
                  <span style={{ width: `${(b.energyKwh / total) * 100}%`, background: BREAKDOWN_COLORS.energia }} />
                  <span style={{ width: `${(b.wireKwh / total) * 100}%`, background: BREAKDOWN_COLORS.fio }} />
                  <span style={{ width: `${(b.chargesKwh / total) * 100}%`, background: BREAKDOWN_COLORS.encargos }} />
                  <span style={{ width: `${(b.taxesKwh / total) * 100}%`, background: BREAKDOWN_COLORS.tributos }} />
                </div>
                <table className="rf-table plain">
                  <tbody>
                    <tr><td><i style={{ display: 'inline-block', width: 9, height: 9, background: BREAKDOWN_COLORS.energia, borderRadius: 3 }} /> Energia (PLD + spread da comercializadora)</td><td className="rf-mono">{money(b.energyKwh)}</td></tr>
                    <tr><td><i style={{ display: 'inline-block', width: 9, height: 9, background: BREAKDOWN_COLORS.fio, borderRadius: 3 }} /> Uso da rede — fio/TUSD ({POST_LABEL[now.tariffPost]})</td><td className="rf-mono">{money(b.wireKwh)}</td></tr>
                    <tr><td><i style={{ display: 'inline-block', width: 9, height: 9, background: BREAKDOWN_COLORS.encargos, borderRadius: 3 }} /> Encargos setoriais</td><td className="rf-mono">{money(b.chargesKwh)}</td></tr>
                    <tr><td><i style={{ display: 'inline-block', width: 9, height: 9, background: BREAKDOWN_COLORS.tributos, borderRadius: 3 }} /> Tributos (ICMS, PIS/COFINS)</td><td className="rf-mono">{money(b.taxesKwh)}</td></tr>
                    <tr><td className="rf-strong">Custo da energia por kWh</td><td className="rf-mono rf-strong">{money(b.totalKwh)}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* MERCADO LIVRE */}
              <div className="rf-card">
                <h3>Melhor oferta do mercado livre na região</h3>
                <p className="rf-small">O Rio Flex compara as comercializadoras que atendem {now.region.name} a cada hora e usa a mais barata.</p>
                <table className="rf-table plain">
                  <thead><tr><th>Comercializadora</th><th>Produto</th><th>R$/kWh</th></tr></thead>
                  <tbody>
                    {now.offers.map((o, i) => (
                      <tr key={o.supplierId}>
                        <td>{i === 0 && '★ '}{o.supplierName}</td>
                        <td>{PRODUCT_LABEL[o.product] ?? o.product}</td>
                        <td className="rf-mono" style={{ color: i === 0 ? '#4ae3a5' : undefined }}>{money(o.totalKwh)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* COMPARATIVO REGIONAL */}
            {regionPrices && (
              <div className="rf-card">
                <h3>Comparativo entre regiões agora</h3>
                <div className="rf-table-wrap">
                  <table className="rf-table plain">
                    <thead><tr><th>Região</th><th>Sinal</th><th>Energia</th><th>AC lenta</th><th>DC rápida</th><th>Melhor oferta</th></tr></thead>
                    <tbody>
                      {regionPrices.map((r) => (
                        <tr key={r.regionId} className="clickable" onClick={() => setRegion(r.regionId)} style={r.regionId === region ? { outline: '1px solid #33404b' } : undefined}>
                          <td>{r.regionName}</td>
                          <td><LevelBadge level={r.level} label={r.level} /></td>
                          <td className="rf-mono">{money(r.energyCostKwh)}</td>
                          <td className="rf-mono">{money(r.consumerPrices.ac_lenta)}</td>
                          <td className="rf-mono">{money(r.consumerPrices.dc_rapida)}</td>
                          <td className="rf-small">{r.supplier}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rf-small" style={{ display: 'flex', gap: 8 }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} /> {now.disclaimer}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
