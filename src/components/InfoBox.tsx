import type { ReactNode } from 'react';
export function InfoBox({ children, warning = false }: { children: ReactNode; warning?: boolean }) { return <div className={warning ? 'info warning' : 'info'} role={warning ? 'status' : undefined}>{children}</div>; }
