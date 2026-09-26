import { Link } from 'wouter';

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="rf-logo" style={light ? { color: '#f4f7f9' } : undefined}>
      <span className="rf-logo-mark">RF</span>
      <span>rio flex</span>
    </Link>
  );
}
