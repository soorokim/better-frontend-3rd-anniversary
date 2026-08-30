import type { HTMLAttributes, ReactNode } from 'react';

export function GamePanel({ title, children, className = '', ...props }: HTMLAttributes<HTMLElement> & { title?: string; children: ReactNode }) {
  return <section className={`game-panel ${className}`} {...props}>{title ? <h2 className="pixel-title text-xl text-[var(--yellow)]">{title}</h2> : null}{children}</section>;
}
