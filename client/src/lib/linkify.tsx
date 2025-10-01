// Utility to detect URLs and convert them to clickable links

const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

export function linkifyText(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  
  // Find all URL matches
  const matches = Array.from(text.matchAll(URL_REGEX));
  
  matches.forEach((match, index) => {
    const url = match[0];
    const matchIndex = match.index!;
    
    // Add text before the URL
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }
    
    // Create the URL (add https:// if it starts with www.)
    const href = url.startsWith('www.') ? `https://${url}` : url;
    
    // Add the clickable link
    parts.push(
      <a
        key={`link-${index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-terminal-highlight underline hover:text-terminal-text transition-colors cursor-pointer"
        data-testid={`link-url-${index}`}
      >
        {url}
      </a>
    );
    
    lastIndex = matchIndex + url.length;
  });
  
  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

// Component version for easy usage
export function LinkifiedText({ children }: { children: string }) {
  const parts = linkifyText(children);
  return <>{parts}</>;
}
