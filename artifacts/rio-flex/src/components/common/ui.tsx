import { Fragment, type ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { LEVEL_LABEL } from '@/lib/format';
import type { Role, SignalLevel } from '@/types/api';

export function LevelBadge({ level, label }: { level: SignalLevel; label?: string }) {
  return (
    <span className={`rf-level ${level}`}>
      <span className="dot" />
      {label ?? LEVEL_LABEL[level]}
    </span>
  );
}

export function Loading({ text = 'Carregando...' }: { text?: string }) {
  return <div className="rf-loading">{text}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="rf-error">{error instanceof Error ? error.message : 'Erro inesperado'}</div>;
}

/** Protege rotas por papel; redireciona para o login do portal correspondente. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="rf-app"><Loading text="Verificando sessão..." /></div>;
  if (!user) return <Redirect to={role === 'manager' ? '/gestor/login' : '/login'} />;
  if (user.role !== role) return <Redirect to={user.role === 'manager' ? '/gestor' : '/app'} />;
  return <>{children}</>;
}

/**
 * Renderizador mínimo e SEGURO de markdown (sem innerHTML): títulos, listas, citações,
 * negrito, itálico e código inline. Suficiente para as respostas da FlexIA.
 */
export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(<ul key={`ul-${blocks.length}`}>{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>);
      list = [];
    }
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ''));
      return;
    }
    flush();
    if (!line.trim()) return;
    if (/^#{1,6}\s/.test(line)) blocks.push(<h4 key={i}>{inline(line.replace(/^#{1,6}\s/, ''))}</h4>);
    else if (line.startsWith('>')) blocks.push(<blockquote key={i}>{inline(line.replace(/^>\s?/, ''))}</blockquote>);
    else blocks.push(<p key={i}>{inline(line)}</p>);
  });
  flush();
  return <>{blocks}</>;
}

function inline(s: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
    if (p.startsWith('_') && p.endsWith('_') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}
