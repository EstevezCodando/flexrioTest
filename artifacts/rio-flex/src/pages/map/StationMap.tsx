import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { StationMarker } from '@/types/api';

type Props = {
  markers: StationMarker[];
  selectedId: number | null;
  center: { lat: number; lng: number; zoom: number };
  user?: { lat: number; lng: number } | null;
  onSelect: (id: number) => void;
};

function colorFor(m: StationMarker): string {
  if (m.st !== 'operacional') return '#66727e';
  if (m.tot > 0 && m.av === 0) return '#f7c65c';
  return m.dc ? '#4ae3a5' : '#55a7ff';
}

/** Mapa Leaflet com renderização em canvas — suporta as ~830 estações sem travar. */
export function StationMap({ markers, selectedId, center, user, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const userLayer = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { preferCanvas: true, zoomControl: true }).setView([center.lat, center.lng], center.zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    userLayer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    map.current?.setView([center.lat, center.lng], center.zoom);
  }, [center.lat, center.lng, center.zoom]);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    const renderer = L.canvas({ padding: 0.3 });
    for (const m of markers) {
      const selected = m.id === selectedId;
      L.circleMarker([m.lat, m.lng], {
        renderer,
        radius: selected ? 10 : m.dc ? 6 : 5,
        color: selected ? '#ffffff' : '#0b0e11',
        weight: selected ? 3 : 1,
        fillColor: colorFor(m),
        fillOpacity: 0.9,
      })
        .bindTooltip(`${m.n} · ${m.av}/${m.tot} livres`, { direction: 'top' })
        .on('click', () => onSelectRef.current(m.id))
        .addTo(group);
    }
  }, [markers, selectedId]);

  useEffect(() => {
    const group = userLayer.current;
    if (!group) return;
    group.clearLayers();
    if (user) {
      L.circleMarker([user.lat, user.lng], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#38bdf8', fillOpacity: 1 })
        .bindTooltip('Você está aqui')
        .addTo(group);
    }
  }, [user]);

  return <div ref={el} className="rf-leaflet" role="application" aria-label="Mapa de eletropostos do Rio de Janeiro" />;
}
