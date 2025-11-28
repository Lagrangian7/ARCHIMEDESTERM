import { useEffect, useRef } from 'react';
import Webamp from 'webamp';
import nDimensionsTheme from '@assets/n-Dimensions (Main Theme)_1758647261911.mp3';
import fortressTrack from '@assets/fortress_1759293202674.mp3';
import modeTrack from '@assets/mode_1759293195149.mp3';
import serpentTrack from '@assets/serpent_1759431415420.mp3';

interface WebampPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
}

export default function WebampPlayer({ isOpen, onClose, onOpen }: WebampPlayerProps) {
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
        // Fetch MP3s from knowledge base
        let knowledgeBaseTracks: any[] = [];
        try {
          const docsResponse = await fetch('/api/documents', { credentials: 'include' });
          if (docsResponse.ok) {
            const documents = await docsResponse.json();

            console.log('📁 All documents fetched:', documents);

            // Filter for audio files that have object storage paths
            knowledgeBaseTracks = documents
              .filter((doc: any) => {
                const isAudio = doc.mimeType && doc.mimeType.startsWith('audio/');
                const hasObjectPath = doc.objectPath && doc.objectPath.length > 0;
                console.log(`📄 ${doc.originalName}: mimeType=${doc.mimeType}, isAudio=${isAudio}, hasObjectPath=${hasObjectPath}, objectPath=${doc.objectPath}, id=${doc.id}`);
                return isAudio && hasObjectPath;
              })
              .map((doc: any) => {
                // Use the object storage path directly - it's already a full path like /objects/bucket/file
                const audioUrl = doc.objectPath;

                console.log(`🎵 Adding track: ${doc.originalName}, URL: ${audioUrl}`);

                return {
                  metaData: {
                    artist: "Uploaded Music",
                    title: doc.originalName.replace(/\.[^/.]+$/, "") // Remove extension
                  },
                  url: audioUrl
                };
              });

            console.log(`🎵 Loaded ${knowledgeBaseTracks.length} MP3 files with object paths:`, knowledgeBaseTracks);

            if (documents.filter((doc: any) => doc.mimeType && doc.mimeType.startsWith('audio/')).length > knowledgeBaseTracks.length) {
              console.warn('⚠️ Some audio files are missing object storage paths and will not be loaded');
            }
          } else {
            console.error('❌ Failed to fetch documents:', docsResponse.status, docsResponse.statusText);
          }
        } catch (error) {
          console.error('❌ Error loading uploaded audio files:', error);
        }

        const webamp = new Webamp({
          enableHotkeys: true,

          // Milkdrop available but not opened by default
          __butterchurnOptions: {
            importButterchurn: () => import('butterchurn'),
            getPresets: async () => {
              const presets = await import('butterchurn-presets');
              const presetPack = presets.default || presets;
              return Object.keys(presetPack).map(name => ({
                name,
                butterchurnPresetObject: presetPack[name]
              }));
            },
            butterchurnOpen: false // Milkdrop available but closed on launch
          },

          initialTracks: [
            // Soma FM Stations
            {
              metaData: {
                artist: "SOMA FM",
                title: "Groove Salad - Ambient downtempo electronica"
              },
              url: "https://ice6.somafm.com/groovesalad-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Drone Zone - Atmospheric ambient space music"
              },
              url: "https://ice6.somafm.com/dronezone-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Lush - Sensuous & lush electronic"
              },
              url: "https://ice6.somafm.com/lush-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Secret Agent - Downtempo lounge & soundtrack"
              },
              url: "https://ice6.somafm.com/secretagent-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "DEF CON Radio - Music for Hacking"
              },
              url: "https://ice6.somafm.com/defcon-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Space Station Soma - Spacemusic"
              },
              url: "https://ice6.somafm.com/spacestation-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Beat Blender - Electronic beats"
              },
              url: "https://ice6.somafm.com/beatblender-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Indie Pop Rocks - Indie & alternative rock"
              },
              url: "https://ice6.somafm.com/indiepop-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Boot Liquor - Country, folk & bluegrass"
              },
              url: "https://ice6.somafm.com/bootliquor-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Illinois Street Lounge - Classic cocktail jazz"
              },
              url: "https://ice6.somafm.com/illstreet-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Suburbs of Goa - Psychedelic trance"
              },
              url: "https://ice6.somafm.com/suburbsofgoa-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Underground 80s - New wave & post-punk"
              },
              url: "https://ice6.somafm.com/u80s-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Folk Forward - Alt-folk & indie rock"
              },
              url: "https://ice6.somafm.com/folkfwd-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Seven Inch Soul - Vintage soul & funk"
              },
              url: "https://ice6.somafm.com/7soul-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Black Rock FM - From Burning Man"
              },
              url: "https://ice6.somafm.com/brfm-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Sonic Universe - Transcendent electronica"
              },
              url: "https://ice6.somafm.com/sonicuniverse-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "ThistleRadio - Celtic & world music"
              },
              url: "https://ice6.somafm.com/thistle-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Heavyweight Reggae - Roots & dub reggae"
              },
              url: "https://ice6.somafm.com/reggae-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Digitalis - Downtempo & chill electronic"
              },
              url: "https://ice6.somafm.com/digitalis-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Metal Detector - Heavy metal & hard rock"
              },
              url: "https://ice6.somafm.com/metal-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Mission Control - Celebrating NASA"
              },
              url: "https://ice6.somafm.com/missioncontrol-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Cliqhop IDM - Intelligent dance music"
              },
              url: "https://ice6.somafm.com/cliqhop-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Dub Step Beyond - Dubstep & bass music"
              },
              url: "https://ice6.somafm.com/dubstep-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Left Coast 70s - Mellow album rock"
              },
              url: "https://ice6.somafm.com/left-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Deep Space One - Deep ambient electronic"
              },
              url: "https://ice6.somafm.com/deepspaceone-128-mp3",
              duration: 240
            },
            {
              metaData: {
                artist: "SOMA FM",
                title: "Fluid - Electronica & downtempo grooves"
              },
              url: "https://ice6.somafm.com/fluid-128-mp3",
              duration: 240
            },
            // SPACEWAR Tracks
            {
              metaData: {
                artist: "SPACEWAR",
                title: "n-Dimensions (Main Theme)"
              },
              url: nDimensionsTheme
            },
            {
              metaData: {
                artist: "SPACEWAR",
                title: "Fortress"
              },
              url: fortressTrack
            },
            {
              metaData: {
                artist: "SPACEWAR",
                title: "Mode"
              },
              url: modeTrack
            },
            {
              metaData: {
                artist: "SPACEWAR",
                title: "Serpent"
              },
              url: serpentTrack
            },
            ...knowledgeBaseTracks // Add knowledge base MP3s
          ],

          // Custom default skin
          initialSkin: {
            url: "/default-skin.wsz"
          },

          // Initial window layout - all in shade mode (collapsed) at top center
          windowLayout: {
            main: { 
              position: { top: 10, left: window.innerWidth / 2 - 412 },
              shade: true // Enable shade mode (collapsed)
            },
            equalizer: { 
              position: { top: 10, left: window.innerWidth / 2 - 137 },
              shade: true, // Enable shade mode (collapsed)
              closed: false
            },
            playlist: { 
              position: { top: 10, left: window.innerWidth / 2 + 138 },
              shade: true, // Enable shade mode (collapsed)
              closed: false
            }
          },

          // Available skins
          availableSkins: [
            {
              url: "/skin-superman.wsz",
              name: "Be Strong Like Superman"
            },
            {
              url: "/skin-calvinhobbes.wsz",
              name: "Calvin And Hobbes Tribute"
            },
            {
              url: "/skin-cuteamp.wsz",
              name: "Cute Amp"
            },
            {
              url: "/skin-knight.wsz",
              name: "Knight Test"
            },
            {
              url: "/skin-neonphilanthropist.wsz",
              name: "Neon Philanthropist"
            },
            {
              url: "/skin-nge.wsz",
              name: "NGE Winamp 2015"
            },
            {
              url: "/skin-pioneer.wsz",
              name: "Pioneer Car Audio"
            },
            {
              url: "/skin-tandyamp.wsz",
              name: "Tandy Amp"
            },
            {
              url: "/skin-wbstereo.wsz",
              name: "WB Stereo"
            },
            {
              url: "/skin-yufo.wsz",
              name: "Yufo 07"
            },
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

          // Notify parent that Webamp is open and playing
          if (onOpen) {
            onOpen();
          }
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
        pointerEvents: 'none',
        animation: 'none',
        transition: 'none'
      }}
      data-testid="webamp-container"
    />
  );
}