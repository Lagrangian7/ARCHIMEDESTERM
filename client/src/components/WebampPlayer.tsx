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
                artist: "SOMA_FM",
                title: "ice6.somafm.com/live-128-mp3"
              },
              url: "https://ice6.somafm.com/live-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "ARCHIMEDES",
                title: "System Audio 20250206 1420"
              },
              url: "/System Audio 20250206 1420_1760324363519.mp3",
              duration: 180
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
              url: "/skin-bloodamp.wsz",
              name: "Bloodamp"
            },
            {
              url: "/skin-bugsbunny.wsz",
              name: "Bugs Bunny"
            },
            {
              url: "/skin-dexteramp.wsz",
              name: "Dexter Amp"
            },
            {
              url: "/skin-donkeykong.wsz",
              name: "Donkey Kong"
            },
            {
              url: "/skin-doritos.wsz",
              name: "Doritos Nacho Amp"
            },
            {
              url: "/skin-dosamp.wsz",
              name: "DOS-Amp"
            },
            {
              url: "/skin-garfield.wsz",
              name: "Garfield"
            },
            {
              url: "/skin-hpcalc.wsz",
              name: "HP Calculator"
            },
            {
              url: "/skin-marshallamp.wsz",
              name: "Marshall Amp"
            },
            {
              url: "/skin-mcdonalds.wsz",
              name: "McDonalds"
            },
            {
              url: "/skin-nicekitty.wsz",
              name: "Nice Kitty"
            },
            {
              url: "/skin-psxkin.wsz",
              name: "PSXkin"
            },
            {
              url: "/skin-quake2.wsz",
              name: "Quake 2"
            },
            {
              url: "/skin-darkgreenevo2.wsz",
              name: "Dark Green Evo C"
            },
            {
              url: "/skin-bestskinever.wsz",
              name: "Best Winamp Skin Ever"
            },
            {
              url: "/skin-vegeta.wsz",
              name: "Vegeta"
            },
            {
              url: "/skin-swell.wsz",
              name: "Swell"
            },
            {
              url: "/skin-renandstimpy.wsz",
              name: "Ren and Stimpy"
            },
            {
              url: "/skin-solarglobes.wsz",
              name: "Solar Globes"
            },
            {
              url: "/skin-jetsetwilly.wsz",
              name: "Jet Set Willy"
            },
            {
              url: "/skin-commodore64.wsz",
              name: "Commodore 64"
            },
            {
              url: "/skin-denonavr.wsz",
              name: "Denon AVR-1601"
            },
            {
              url: "/skin-nampgreen.wsz",
              name: "N-Amp Insomniac Green"
            },
            {
              url: "/skin-goldplated.wsz",
              name: "Gold Plated"
            },
            {
              url: "/skin-tubeamp.wsz",
              name: "The Tube Amp"
            },
            {
              url: "/skin-lumkawaii.wsz",
              name: "Lum KAWAII"
            },
            {
              url: "/skin-swinginglum.wsz",
              name: "Swinging Lum"
            },
            {
              url: "/skin-japanese.wsz",
              name: "Japanese"
            },
            {
              url: "/skin-nokia.wsz",
              name: "Nokia 702"
            },
            {
              url: "/skin-panasonic06.wsz",
              name: "Panasonic 06"
            },
            {
              url: "/skin-panasonic.wsz",
              name: "Panasonic"
            },
            {
              url: "/skin-musicforever.wsz",
              name: "Music Forever"
            },
            {
              url: "/skin-o10f1.wsz",
              name: "O10f1"
            },
            {
              url: "/skin-newsnetamp.wsz",
              name: "Newsnet Amp"
            },
            {
              url: "/skin-blackandwhite.wsz",
              name: "Black and White"
            },
            {
              url: "/skin-terminalamp.wsz",
              name: "The Terminal Amp"
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
