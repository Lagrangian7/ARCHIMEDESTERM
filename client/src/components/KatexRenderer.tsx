import 'katex/dist/katex.min.css';
import katex from 'katex';
import { useEffect, useRef } from 'react';

interface KatexRendererProps {
  content: string;
  displayMode?: boolean;
}

export const KatexRenderer = ({ content, displayMode = false }: KatexRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(content, containerRef.current, {
          displayMode,
          throwOnError: false,
          strict: false,
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
        containerRef.current.textContent = content;
      }
    }
  }, [content, displayMode]);

  return <div ref={containerRef} className="katex-output" />;
};
