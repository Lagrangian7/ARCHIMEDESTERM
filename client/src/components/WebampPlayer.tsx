import { useEffect, useRef } from 'react';
import Webamp from 'webamp';

interface WebampPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WebampPlayer({ isOpen, onClose }: WebampPlayerProps) {
  const webampRef = useRef<Webamp | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    // ESC key handler
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscKey);

    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // Check if Webamp is already initialized or initializing
    if (webampRef.current || initializingRef.current) return;
    
    initializingRef.current = true;

    const initWebamp = async () => {
      try {
        const webamp = new Webamp({
          initialTracks: [
            {
              metaData: {
                artist: "ARCHIMEDES v7",
                title: "Lagrangian 25"
              },
              url: "/lagrangian-25.mp3",
              duration: 240
            }
          ],
          
          // Custom default skin
          initialSkin: {
            url: "/default-skin.wsz"
          },
          
          // Initial window layout (without milkdrop for now)
          windowLayout: {
            main: { position: { top: 20, left: 20 } },
            equalizer: { position: { top: 20, left: 295 } },
            playlist: { 
              position: { top: 252, left: 20 },
              size: { extraHeight: 4, extraWidth: 0 } 
            }
          },
          
          // Available skins
          availableSkins: [
            {
              url: "/default-skin.wsz",
              name: "Default Skin"
            },
            {
              url: "/skin-orange.wsz",
              name: "Orange"
            },
            {
              url: "/skin-blue.wsz",
              name: "Blue"
            },
            {
              url: "/skin-green.wsz",
              name: "Dark Green Evo"
            },
            {
              url: "/skin-tintin.wsz",
              name: "Tintin"
            },
            {
              url: "/skin-mario.wsz",
              name: "Super Mario Kart"
            },
            {
              url: "/skin-soundcheck.wsz",
              name: "Soundcheck"
            },
            {
              url: "https://cdn.webampskins.org/skins/base-2.91.wsz",
              name: "Classic Winamp"
            }
          ]
        });

        // Handle close event
        webamp.onClose(() => {
          onClose();
        });

        // Render Webamp - null check already done above
        const container = containerRef.current;
        if (container) {
          await webamp.renderWhenReady(container);
          webampRef.current = webamp;
          console.log('Webamp initialized successfully');
        }
      } catch (error) {
        console.error('Failed to initialize Webamp:', error);
        initializingRef.current = false;
      }
    };

    initWebamp();

    // Cleanup function
    return () => {
      if (webampRef.current) {
        webampRef.current.dispose();
        webampRef.current = null;
        initializingRef.current = false;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80"
      style={{ 
        zIndex: 9999
      }}
      data-testid="webamp-overlay"
    >
      <div 
        ref={containerRef}
        id="webamp-container"
        style={{ 
          position: 'relative',
          width: '100%',
          height: '100%'
        }}
        data-testid="webamp-container"
      />
      
      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 px-4 py-2 rounded border border-[var(--terminal-text)] text-[var(--terminal-text)] hover:bg-[var(--terminal-text)] hover:text-[var(--terminal-bg)] transition-colors"
        style={{ zIndex: 10001 }}
        data-testid="button-close-webamp"
      >
        ESC
      </button>
      
      {/* Instructions */}
      <div 
        className="fixed bottom-4 left-4 text-[var(--terminal-subtle)] text-sm font-mono"
        style={{ zIndex: 10001 }}
        data-testid="text-webamp-instructions"
      >
        <div>Press ESC or close Webamp to return to terminal</div>
        <div>Visualizer Hotkeys: SPACE=Next preset, H=Hard cut, R=Toggle cycle</div>
      </div>
    </div>
  );
}
