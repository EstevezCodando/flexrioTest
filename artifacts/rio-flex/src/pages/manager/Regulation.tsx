import { useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { ManagerShell } from '@/components/layout/ManagerShell';
import { Loading } from '@/components/common/ui';
import { useKnowledge } from './hooks';

const CATEGORY: Record<string, string> = {
  regulacao: 'Regulação',
  mercado: 'Mercado de energia',
  protocolo: 'Protocolo',
  norma_tecnica: 'Norma técnica',
  dados: 'Dados',
};

export default function RegulationPage() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, isLoading } = useKnowledge(query);

  return (
    <ManagerShell>
      <div className="rf-page">
        <div>
          <span className="rf-eyebrow">Base de conhecimento da FlexIA</span>
          <h1 className="rf-title">Regulação & protocolos</h1>
          <p className="rf-subtitle">Resumos para apoio à decisão sobre ANEEL, CCEE, ONS, legislação, protocolos de recarga e normas técnicas. Sempre confirme o texto oficial vigente.</p>
        </div>
        <form className="rf-card rf-row" style={{ padding: 12 }} onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
          <input className="rf-input" style={{ flex: 1 }} placeholder="ex.: tarifa branca, OCPP, mercado livre, PLD" value={q} onChange={(e) => setQ(e.target.value)} maxLength={120} />
          <button type="submit" className="rf-btn purple small"><Search size={13} /> Buscar</button>
          {query && <button type="button" className="rf-btn secondary small" onClick={() => { setQ(''); setQuery(''); }}>Limpar</button>}
        </form>
        {isLoading && <Loading />}
        <div className="rf-grid rf-grid-2">
          {data?.map((k) => (
            <div key={k.id} className="rf-card rf-stack">
              <div className="rf-between">
                <span className="rf-badge purple">{CATEGORY[k.category] ?? k.category}</span>
                <span className="rf-tiny">{k.authority}</span>
              </div>
              <h3 style={{ margin: 0 }}>{k.title}</h3>
              <p className="rf-small" style={{ margin: 0 }}>{k.summary}</p>
              <p className="rf-small" style={{ margin: 0 }}><b className="rf-strong">No Rio Flex:</b> {k.relevance}</p>
              <a href={k.reference} target="_blank" rel="noopener noreferrer" className="rf-tiny" style={{ color: '#b98cff' }}>
                <ExternalLink size={11} /> {k.reference}
              </a>
            </div>
          ))}
        </div>
        {data?.length === 0 && <p className="rf-small">Nada encontrado. Tente outros termos ou pergunte à FlexIA.</p>}
      </div>
    </ManagerShell>
  );
}
