import type { ChargeType, SignalLevel } from '@/types/api';

export function money(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export function kwh(value: number, digits = 1): string {
  return `${value.toFixed(digits).replace('.', ',')} kWh`;
}

export function num(value: number, digits = 0): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function timeOf(iso: string): string {
  return iso.slice(11, 16);
}

export function dateTimeOf(iso: string): string {
  const [date, time] = [iso.slice(0, 10), iso.slice(11, 16)];
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y} ${time}`;
}

export const LEVEL_COLOR: Record<SignalLevel, string> = {
  verde: '#4ae3a5',
  amarelo: '#f7c65c',
  vermelho: '#ff6b6b',
};

export const LEVEL_LABEL: Record<SignalLevel, string> = {
  verde: 'Janela verde',
  amarelo: 'Janela amarela',
  vermelho: 'Janela vermelha',
};

export const LEVEL_HINT: Record<SignalLevel, string> = {
  verde: 'Energia abundante e barata — ótimo momento para carregar e ganhar créditos.',
  amarelo: 'Condição normal da rede — preço padrão.',
  vermelho: 'Rede pressionada — se puder, adie a recarga ou reduza a potência.',
};

export const CHARGE_LABEL: Record<ChargeType, string> = {
  ac_lenta: 'AC lenta',
  ac_semirrapida: 'AC semirrápida',
  dc_rapida: 'DC rápida',
  dc_ultrarrapida: 'DC ultrarrápida',
};

export const POST_LABEL: Record<string, string> = {
  ponta: 'Ponta',
  intermediario: 'Intermediário',
  fora_ponta: 'Fora de ponta',
};

export const PRODUCT_LABEL: Record<string, string> = {
  convencional: 'Convencional',
  incentivada_50: 'Incentivada 50%',
  incentivada_100: 'Incentivada 100%',
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((p) => /^[A-Za-zÀ-ú]/.test(p))
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
