import type { MouseEvent, ReactNode } from 'react';
import { navigate } from '../lib/router';

interface Props {
  to: string;
  active: boolean;
  className: string;
  children: ReactNode;
}

export function NavLink({ to, active, className, children }: Props) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={onClick} className={className} aria-current={active ? 'page' : undefined}>
      {children}
    </a>
  );
}
