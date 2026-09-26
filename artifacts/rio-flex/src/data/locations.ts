export type PresetDestination = {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
};

export type PopularLocation = {
  name: string;
  match: string[];
  lat: number;
  lng: number;
};

export const PRESET_DESTINATIONS: PresetDestination[] = [
  { id: 'coppe', name: 'COPPE / UFRJ (Fundão)', label: 'UFRJ (Fundão)', lat: -22.8606, lng: -43.2307 },
  { id: 'botafogo', name: 'Botafogo (Praia & Metrô)', label: 'Casa (Botafogo)', lat: -22.9452, lng: -43.1818 },
  { id: 'centro', name: 'Centro (Carioca / Cinelândia)', label: 'Trabalho (Centro)', lat: -22.9035, lng: -43.1764 },
  { id: 'barra', name: 'Barra da Tijuca (Jardim Oceânico)', label: 'Barra da Tijuca', lat: -23.0004, lng: -43.3248 },
  { id: 'copacabana', name: 'Copacabana (Posto 4)', label: 'Copacabana', lat: -22.9645, lng: -43.1738 },
];

export const POPULAR_LOCATIONS: PopularLocation[] = [
  { name: 'COPPE / UFRJ — Ilha do Fundão', match: ['coppe', 'ufrj', 'fundao', 'fundão'], lat: -22.8606, lng: -43.2307 },
  { name: 'Botafogo, Rio de Janeiro', match: ['botafogo', 'praia de botafogo'], lat: -22.9452, lng: -43.1818 },
  { name: 'Centro, Rio de Janeiro', match: ['centro', 'carioca', 'cinelandia', 'cinelândia', 'rio branco'], lat: -22.9035, lng: -43.1764 },
  { name: 'Copacabana, Rio de Janeiro', match: ['copacabana', 'atlantica', 'atlântica'], lat: -22.9645, lng: -43.1738 },
  { name: 'Ipanema, Rio de Janeiro', match: ['ipanema', 'posto 9'], lat: -22.9845, lng: -43.2045 },
  { name: 'Barra da Tijuca, Rio de Janeiro', match: ['barra', 'barra da tijuca', 'jardim oceanico'], lat: -23.0004, lng: -43.3248 },
  { name: 'Tijuca, Rio de Janeiro', match: ['tijuca', 'saens pena'], lat: -22.9248, lng: -43.2328 },
  { name: 'Flamengo / Glória, Rio de Janeiro', match: ['flamengo', 'gloria', 'glória'], lat: -22.9312, lng: -43.1775 },
];
