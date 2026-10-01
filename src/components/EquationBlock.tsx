import { useMemo } from 'react';
import katex from 'katex';
export function EquationBlock({ formula, inline = false }: { formula: string; inline?: boolean }) {
  const html = useMemo(() => katex.renderToString(formula, { displayMode: !inline, throwOnError: false, strict: 'warn', trust: false }), [formula, inline]);
  return <div className={inline ? 'equation-inline' : 'equation'} dangerouslySetInnerHTML={{ __html: html }} />;
}
