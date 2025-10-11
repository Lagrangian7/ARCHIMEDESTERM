import { useEffect, useRef } from 'react';
import Webamp from 'webamp/butterchurn';

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

    // Add webamp-active class to disable scanlines
    document.body.classList.add('webamp-active');

    // ESC key handler
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscKey);

    return () => {
      window.removeEventListener('keydown', handleEscKey);
      document.body.classList.remove('webamp-active');
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
          
          // Initial window layout with Milkdrop visualizer
          windowLayout: {
            main: { position: { top: 20, left: 20 } },
            equalizer: { position: { top: 20, left: 580 } },
            playlist: { 
              position: { top: 480, left: 20 },
              size: { extraHeight: 4, extraWidth: 0 } 
            },
            milkdrop: { position: { top: 20, left: 300 }, size: [275, 455] }
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
          
          // Auto-play the track
          webamp.play();
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
      ref={containerRef}
      id="webamp-container"
      className="fixed inset-0"
      style={{ 
        zIndex: 10000,
        pointerEvents: 'none'
      }}
      data-testid="webamp-container"
    />
  );
}
