import 'katex/dist/katex.min.css';
import katex from 'katex';

interface KatexRendererProps {
  children: string;
  displayMode?: boolean;
}

export const KatexRenderer = ({ children, displayMode = false }: KatexRendererProps) => {
  // Split content into text and math segments, preserving order
  const segments: Array<{ type: 'text' | 'math'; content: string; display: boolean }> = [];
  
  // Match both display math ($$..$$) and inline math ($...$)
  const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = mathRegex.exec(children)) !== null) {
    // Add text before this math segment
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: children.slice(lastIndex, match.index),
        display: false
      });
    }
    
    // Add math segment
    const mathStr = match[1];
    const isDisplay = mathStr.startsWith('$$');
    const mathContent = isDisplay 
      ? mathStr.slice(2, -2) 
      : mathStr.slice(1, -1);
    
    segments.push({
      type: 'math',
      content: mathContent,
      display: isDisplay
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last math segment
  if (lastIndex < children.length) {
    segments.push({
      type: 'text',
      content: children.slice(lastIndex),
      display: false
    });
  }
  
  // If no math found, just return the text
  if (segments.length === 0) {
    return <span>{children}</span>;
  }
  
  return (
    <span className="katex-container">
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.content}</span>;
        }
        
        // Render math with KaTeX
        try {
          const html = katex.renderToString(segment.content, {
            displayMode: segment.display || displayMode,
            throwOnError: false,
            strict: false,
          });
          return (
            <span 
              key={index} 
              className={segment.display ? 'block my-2' : 'inline'}
              dangerouslySetInnerHTML={{ __html: html }} 
            />
          );
        } catch (error) {
          console.error('KaTeX rendering error:', error);
          return <span key={index}>{segment.content}</span>;
        }
      })}
    </span>
  );
};
