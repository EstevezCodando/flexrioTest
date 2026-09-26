import { all, get } from '../db/index.ts';
import { notFound } from '../lib/http.ts';
import { isoLocal, nowEpoch } from '../lib/util.ts';
import { activeProvider } from './market.ts';

export const PRICING_MODEL_VERSION = 'pricing-v1';

/** Metadados anexados a toda resposta calculada: permitem reproduzir/auditar o número exibido. */
export function calcProvenance(kind: 'price' | 'grid' | 'weather') {
  return {
    generatedAt: isoLocal(nowEpoch()),
    dataQuality: 'simulado' as const,
    marketProvider: activeProvider.id,
    processingVersion: PRICING_MODEL_VERSION,
    kind,
    note: 'Valores simulados; determinísticos por (região, hora) — a mesma entrada reproduz o mesmo resultado.',
  };
}

type SourceRow = {
  snapshot_id: string;
  station_id: number;
  url: string;
  retrieved_at: string;
  http_status: number | null;
  raw_extract_sha256: string | null;
  response_sha256: string | null;
  tool: string | null;
};

type SnapshotRow = {
  snapshot_id: string;
  source: string;
  source_url: string;
  tool: string;
  collected_from: string | null;
  collected_to: string | null;
  records: number;
  summary_json: string | null;
  validation_json: string | null;
  manifest_sha256: string;
  imported_at: number;
  processing_version: string;
};

export function stationProvenance(stationId: number) {
  const r = get<SourceRow>('SELECT * FROM source_records WHERE station_id = ? ORDER BY retrieved_at DESC LIMIT 1', stationId);
  if (!r) return null;
  return {
    snapshotId: r.snapshot_id,
    sourceUrl: r.url,
    retrievedAt: r.retrieved_at,
    httpStatus: r.http_status,
    responseSha256: r.response_sha256,
    rawExtractSha256: r.raw_extract_sha256,
    collectedBy: r.tool,
  };
}

/** Cadeia completa de lineage de uma estação: valor exibido → registro do banco → coleta bruta → fonte. */
export function stationLineage(stationId: number) {
  const st = get<{ id: number; name: string; snapshot_id: string; source_url: string | null; updated_at: string | null; published_price_kwh: number | null; price_label: string | null }>(
    'SELECT id, name, snapshot_id, source_url, updated_at, published_price_kwh, price_label FROM stations WHERE id = ?',
    stationId,
  );
  if (!st) throw notFound('Estação não encontrada');
  const snapshot = get<SnapshotRow>('SELECT * FROM dataset_snapshots WHERE snapshot_id = ?', st.snapshot_id);
  return {
    station: { id: st.id, name: st.name },
    chain: [
      { step: 'indicador', description: 'Valor exibido ao usuário', publishedPriceKwh: st.published_price_kwh, priceLabel: st.price_label },
      { step: 'banco (Gold do MVP)', table: 'stations / connectors', snapshotId: st.snapshot_id, processingVersion: snapshot?.processing_version ?? null },
      { step: 'coleta (RAW do MVP)', ...stationProvenance(stationId) },
      { step: 'fonte oficial', source: snapshot?.source ?? null, sourceUrl: st.source_url, recordUpdatedAtSource: st.updated_at },
    ],
    snapshot: snapshot && snapshotDto(snapshot),
  };
}

function snapshotDto(s: SnapshotRow) {
  return {
    snapshotId: s.snapshot_id,
    source: s.source,
    sourceUrl: s.source_url,
    tool: s.tool,
    collectedFrom: s.collected_from,
    collectedTo: s.collected_to,
    records: s.records,
    manifestSha256: s.manifest_sha256,
    importedAt: isoLocal(s.imported_at),
    processingVersion: s.processing_version,
    summary: s.summary_json ? JSON.parse(s.summary_json) : null,
    validation: s.validation_json ? JSON.parse(s.validation_json) : null,
  };
}

export function datasetSnapshots() {
  return all<SnapshotRow>('SELECT * FROM dataset_snapshots ORDER BY imported_at DESC').map(snapshotDto);
}
