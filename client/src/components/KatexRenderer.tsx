import 'katex/dist/katex.min.css';
import katex from 'katex';
import { useEffect, useRef } from 'react';

interface KatexRendererProps {
  children: string;
  displayMode?: boolean;
}

export const KatexRenderer = ({ children, displayMode = false }: KatexRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        // Find math content within $ or $$ delimiters
        const mathContent = children.match(/\$\$(.*?)\$\$|\$(.*?)\$/)?.[1] || 
                           children.match(/\$\$(.*?)\$\$|\$(.*?)\$/)?.[2] || 
                           children;

        katex.render(mathContent, containerRef.current, {
          displayMode,
          throwOnError: false,
          strict: false,
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
        containerRef.current.textContent = children;
      }
    }
  }, [children, displayMode]);

  return <div ref={containerRef} className="katex-output inline-block" />;
};
