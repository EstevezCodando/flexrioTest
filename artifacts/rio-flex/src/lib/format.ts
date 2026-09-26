export function money(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}
