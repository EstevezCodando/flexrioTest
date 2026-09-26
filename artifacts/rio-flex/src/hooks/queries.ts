import { useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type {
  Alert, ChargingSession, ForecastPoint, Meta, Notification, PriceNow, RegionPrice,
  StationDetail, StationMarker, StationSummary, Wallet,
} from '@/types/api';

export const useMeta = () =>
  useQuery({ queryKey: ['meta'], queryFn: () => api.get<Meta>('/meta'), staleTime: 60 * 60_000 });

/** Região em foco: a do usuário ou a capital. */
export function useUserRegion(): string {
  const { user } = useAuth();
  return user?.regionId ?? 'capital';
}

export const usePriceNow = (region: string) =>
  useQuery({ queryKey: ['price-now', region], queryFn: () => api.get<PriceNow>(`/prices/${region}/now`), refetchInterval: 60_000 });

export const usePriceForecast = (region: string, hours = 24) =>
  useQuery({
    queryKey: ['price-forecast', region, hours],
    queryFn: () => api.get<{ points: ForecastPoint[] }>(`/prices/${region}/forecast${qs({ hours })}`).then((r) => r.points),
    refetchInterval: 5 * 60_000,
  });

export const useRegionPrices = () =>
  useQuery({ queryKey: ['region-prices'], queryFn: () => api.get<RegionPrice[]>('/prices'), refetchInterval: 60_000 });

export type StationQuery = {
  region?: string;
  q?: string;
  chargeType?: string;
  available?: boolean;
  operational?: boolean;
  public?: boolean;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort?: string;
  limit?: number;
  offset?: number;
};

export const useStations = (params: StationQuery, enabled = true) =>
  useQuery({
    queryKey: ['stations', params],
    queryFn: () => api.get<{ total: number; items: StationSummary[] }>(`/stations${qs(params)}`),
    enabled,
    placeholderData: (prev) => prev,
  });

export const useStationMarkers = () =>
  useQuery({ queryKey: ['markers'], queryFn: () => api.get<StationMarker[]>('/stations/markers'), refetchInterval: 120_000 });

export const useStation = (id: number | null, origin?: { lat: number; lng: number } | null) =>
  useQuery({
    queryKey: ['station', id, origin?.lat, origin?.lng],
    queryFn: () => api.get<StationDetail>(`/stations/${id}${qs({ lat: origin?.lat, lng: origin?.lng })}`),
    enabled: id !== null,
    refetchInterval: 30_000,
  });

export const useAlerts = () => useQuery({ queryKey: ['alerts'], queryFn: () => api.get<Alert[]>('/me/alerts') });

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ unread: number; items: Notification[] }>('/notifications'),
    refetchInterval: 30_000,
  });

export const useActiveSession = (poll = false) =>
  useQuery({
    queryKey: ['charging-active'],
    queryFn: () => api.get<{ session: ChargingSession | null }>('/me/charging/active').then((r) => r.session),
    refetchInterval: poll ? 3000 : 30_000,
  });

export const useChargingHistory = () =>
  useQuery({ queryKey: ['charging-history'], queryFn: () => api.get<ChargingSession[]>('/me/charging/history') });

export const useWallet = () => useQuery({ queryKey: ['wallet'], queryFn: () => api.get<Wallet>('/me/wallet') });
