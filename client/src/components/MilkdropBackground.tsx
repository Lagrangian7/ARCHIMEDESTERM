
import { useEffect, useRef, useState } from 'react';

interface MilkdropBackgroundProps {
  isEnabled: boolean;
  opacity?: number;
}

export function MilkdropBackground({ isEnabled, opacity = 0.3 }: MilkdropBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const webampRef = useRef<any>(null);
  const initializingRef = useRef<boolean>(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isEnabled || !containerRef.current || initializingRef.current) return;

    initializingRef.current = true;

    const initMilkdrop = async () => {
      try {
        // Dynamically import Webamp to reduce initial bundle size
        const { default: Webamp } = await import('webamp');

        const webamp = new Webamp({
          enableHotkeys: false, // Disable hotkeys to avoid conflicts with terminal

          // Enable Milkdrop visualizer only
          __butterchurnOptions: {
            importButterchurn: () => import('butterchurn'),
            getPresets: async () => {
              const presets = await import('butterchurn-presets');
              const presetPack = presets.default || presets;
              
              // Filter to use only lighter presets for better performance
              const lightPresets = [
                'Flexi - mindblob [mash-up]',
                'Geiss - Blur Melt',
                'martin - castle walls',
                'Rovastar - Fractopia',
                'Unchained - Subspiria'
              ];

              return Object.keys(presetPack)
                .filter(name => lightPresets.some(light => name.includes(light)))
                .map(name => ({
                  name,
                  butterchurnPresetObject: presetPack[name]
                }));
            },
            butterchurnOpen: true
          },

          // Minimal track for audio context (silent)
          initialTracks: [{
            metaData: {
              artist: "ARCHIMEDES",
              title: "Visualizer Background"
            },
            url: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
            duration: 1
          }],

          // Hide all windows except Milkdrop
          windowLayout: {
            main: { position: { top: -1000, left: -1000 } },
            equalizer: { position: { top: -1000, left: -1000 } },
            playlist: { position: { top: -1000, left: -1000 } },
            milkdrop: { 
              position: { top: 0, left: 0 }, 
              size: [window.innerWidth, window.innerHeight]
            }
          }
        });

        // Prevent closing
        webamp.onClose(() => {
          return false;
        });

        const container = containerRef.current;
        if (container) {
          await webamp.renderWhenReady(container);
          webampRef.current = webamp;
          
          // Start playback to activate visualizer
          webamp.play();
          
          // Hide main player windows via DOM manipulation
          setTimeout(() => {
            const playerElements = container.querySelectorAll('#main-window, #equalizer-window, #playlist-window');
            playerElements.forEach(el => {
              (el as HTMLElement).style.display = 'none';
            });
            
            // Make Milkdrop fullscreen
            const milkdropWindow = container.querySelector('#milkdrop-window');
            if (milkdropWindow) {
              (milkdropWindow as HTMLElement).style.position = 'fixed';
              (milkdropWindow as HTMLElement).style.top = '0';
              (milkdropWindow as HTMLElement).style.left = '0';
              (milkdropWindow as HTMLElement).style.width = '100vw';
              (milkdropWindow as HTMLElement).style.height = '100vh';
              (milkdropWindow as HTMLElement).style.pointerEvents = 'none';
            }

            setIsReady(true);
          }, 500);
        }
      } catch (error) {
        console.error('Failed to initialize MilkDrop background:', error);
        initializingRef.current = false;
      }
    };

    initMilkdrop();

    // Handle window resize
    const handleResize = () => {
      if (containerRef.current) {
        const milkdropWindow = containerRef.current.querySelector('#milkdrop-window');
        if (milkdropWindow) {
          (milkdropWindow as HTMLElement).style.width = '100vw';
          (milkdropWindow as HTMLElement).style.height = '100vh';
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (webampRef.current) {
        webampRef.current.dispose();
        webampRef.current = null;
        initializingRef.current = false;
      }
    };
  }, [isEnabled]);

  if (!isEnabled) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 1,
        opacity: isReady ? opacity : 0,
        transition: 'opacity 1s ease-in-out'
      }}
    />
  );
}

export default MilkdropBackground;
