import { useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api';
import type { GridPoint, KnowledgeEntry, ManagerOverview, SignalDto, WeatherPoint } from '@/types/api';

export const useOverview = () =>
  useQuery({ queryKey: ['mgr-overview'], queryFn: () => api.get<ManagerOverview>('/manager/overview'), refetchInterval: 60_000 });

export const useGrid = (region: string, hours = 24) =>
  useQuery({
    queryKey: ['mgr-grid', region, hours],
    queryFn: () =>
      api.get<{ grid: GridPoint[]; weather: WeatherPoint[]; evLoad: { mw: number; busyConnectors: number; totalConnectors: number } }>(
        `/manager/grid/${region}${qs({ hours })}`,
      ),
    refetchInterval: 5 * 60_000,
  });

export const useSignals = (past = false) =>
  useQuery({ queryKey: ['mgr-signals', past], queryFn: () => api.get<SignalDto[]>(`/manager/signals${qs({ past: past || undefined })}`) });

export const useKnowledge = (q: string) =>
  useQuery({ queryKey: ['mgr-knowledge', q], queryFn: () => api.get<KnowledgeEntry[]>(`/manager/knowledge${qs({ q: q || undefined })}`) });
