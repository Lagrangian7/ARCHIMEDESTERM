import type { Monaco } from '@monaco-editor/react';

export function getTerminalThemeColors(): {
  bg: string;
  text: string;
  highlight: string;
  subtle: string;
} {
  const computedStyle = getComputedStyle(document.documentElement);
  return {
    bg: computedStyle.getPropertyValue('--terminal-bg').trim() || '#0D1117',
    text: computedStyle.getPropertyValue('--terminal-text').trim() || '#00FF41',
    highlight: computedStyle.getPropertyValue('--terminal-highlight').trim() || '#00FF41',
    subtle: computedStyle.getPropertyValue('--terminal-subtle').trim() || '#1a2332',
  };
}

function hslToHex(hslString: string): string {
  if (hslString.startsWith('#')) return hslString.replace('#', '');

  // Support both integer and decimal HSL values, with comma or space separators
  const hslMatch = hslString.match(/hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*\)/);
  if (!hslMatch) return '00FF41';

  const h = parseFloat(hslMatch[1]);
  const s = parseFloat(hslMatch[2]) / 100;
  const l = parseFloat(hslMatch[3]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return toHex(r) + toHex(g) + toHex(b);
}

function getHexColor(color: string): string {
  if (color.startsWith('#')) return color.replace('#', '');
  return hslToHex(color);
}

function ensureHex(color: string, fallback: string): string {
  if (color.startsWith('#')) return color;
  const hex = hslToHex(color);
  return hex !== '00FF41' || color.includes('120') ? `#${hex}` : fallback;
}

export function defineAndApplyMonacoTheme(monaco: Monaco, themeName: string = 'archimedes-dynamic'): void {
  const colors = getTerminalThemeColors();

  const bgHex = ensureHex(colors.bg, '#0D1117');
  const textHex = ensureHex(colors.text, '#00FF41');
  const highlightHex = ensureHex(colors.highlight, '#00FF41');
  const subtleHex = ensureHex(colors.subtle, '#1a2332');

  monaco.editor.defineTheme(themeName, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: getHexColor(highlightHex) },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'type', foreground: '4EC9B0' },
    ],
    colors: {
      'editor.background': bgHex,
      'editor.foreground': textHex,
      'editor.lineHighlightBackground': subtleHex,
      'editorCursor.foreground': highlightHex,
      'editor.selectionBackground': highlightHex + '33',
      'editorLineNumber.foreground': highlightHex + '66',
      'editorLineNumber.activeForeground': highlightHex,
    }
  });

  monaco.editor.setTheme(themeName);
}

export function createThemeChangeListener(
  monaco: Monaco | null,
  themeName: string = 'archimedes-dynamic'
): () => void {
  if (!monaco) return () => {};

  const handleThemeChange = () => {
    setTimeout(() => {
      defineAndApplyMonacoTheme(monaco, themeName);
    }, 50);
  };

  window.addEventListener('terminal-theme-change', handleThemeChange);

  return () => {
    window.removeEventListener('terminal-theme-change', handleThemeChange);
  };
}
