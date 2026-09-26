import type { ReactNode } from 'react';
import { Link } from 'wouter';

type ButtonProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  style?: React.CSSProperties;
};

export function Button({
  children,
  className = '',
  onClick,
  href,
  type = 'button',
  disabled = false,
  style,
}: ButtonProps) {
  if (href) {
    return (
      <Link href={href} className={`rf-btn ${className}`} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      className={`rf-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}
