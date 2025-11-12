
import { memo } from 'react';
import logoImage from '@assets/5721242-200_1756549869080.png';

export const LogoIcon = memo(() => (
  <img
    src={logoImage}
    alt="ARCHIMEDES Logo"
    width="32"
    height="32"
    className="logo-icon"
    style={{
      display: 'block',
      visibility: 'visible',
      opacity: 1,
      backgroundColor: 'var(--terminal-logo-green)',
      border: '2px solid var(--terminal-logo-orange)',
      borderRadius: '6px',
      boxShadow: '0 0 8px var(--terminal-logo-green), 0 0 16px var(--terminal-logo-green)'
    }}
  />
));
