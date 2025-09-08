import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Radio } from 'lucide-react';

interface RadioStreamerProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: string) => void;
}

export function RadioStreamer({ isOpen, onClose, onStatusChange }: RadioStreamerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Ready');
  const audioRef = useRef<HTMLAudioElement>(null);

  // Enhanced streaming URLs with CORS proxy support
  const INFOWARS_STREAMS = [
    '/api/radio-proxy?url=' + encodeURIComponent('https://playerservices.streamtheworld.com/api/livestream-redirect/INFOWARS.mp3'),
    'https://ice1.somafm.com/thetrip-128-mp3', // SomaFM - CORS enabled, works reliably
    'https://ice2.somafm.com/groovesalad-128-mp3', // SomaFM alternative with CORS
    'https://ice1.somafm.com/deepspaceone-128-mp3', // SomaFM Deep Space One - Deep ambient electronic
    'https://samples-files.com/samples/Audio/mp3/mp3-example-1.mp3' // Working test fallback
  ];
  
  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);
  const streamUrl = INFOWARS_STREAMS[currentStreamIndex];
  const stationName = currentStreamIndex === 0 ? 'Infowars Live Stream' : 
                     currentStreamIndex === 1 ? 'SomaFM - The Trip' :
                     currentStreamIndex === 2 ? 'SomaFM - Groove Salad' : 
                     currentStreamIndex === 3 ? 'SomaFM - Deep Space One' : 'Test Audio';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      console.log('✅ Audio started playing:', streamUrl);
      setIsPlaying(true);
      setIsLoading(false);
      setConnectionStatus('▶️ Playing');
      onStatusChange?.('🎵 Audio is playing');
    };

    const handlePause = () => {
      console.log('⏸️ Audio paused');
      setIsPlaying(false);
      setConnectionStatus('⏸️ Paused');
      onStatusChange?.('⏸️ Audio paused');
    };

    const handleError = (error: Event) => {
      console.error('❌ Audio error:', error, 'URL:', streamUrl);
      setIsLoading(false);
      setIsPlaying(false);
      
      // Try next stream if current one fails
      if (currentStreamIndex < INFOWARS_STREAMS.length - 1) {
        const nextIndex = currentStreamIndex + 1;
        console.log(`🔄 Switching to stream ${nextIndex + 1}`);
        setCurrentStreamIndex(nextIndex);
        setConnectionStatus(`🔄 Switching to stream ${nextIndex + 1}...`);
        onStatusChange?.(`Stream failed, trying stream ${nextIndex + 1}...`);
        
        // Auto-retry with next stream with enhanced error handling
        setTimeout(async () => {
          if (audioRef.current) {
            const nextUrl = INFOWARS_STREAMS[nextIndex];
            console.log(`🔄 Auto-switching to stream ${nextIndex + 1}:`, nextUrl);
            
            // Update the source and reload
            audioRef.current.src = nextUrl;
            audioRef.current.load();
            
            try {
              await audioRef.current.play();
              console.log(`✅ Stream ${nextIndex + 1} connected successfully`);
            } catch (error) {
              console.error(`❌ Stream ${nextIndex + 1} also failed:`, error);
              setConnectionStatus(`❌ Stream ${nextIndex + 1} failed`);
            }
          }
        }, 2000);
      } else {
        setConnectionStatus('❌ All streams failed');
        onStatusChange?.('❌ All test streams unavailable');
      }
    };

    const handleLoadStart = () => {
      console.log('⏳ Audio loading started:', streamUrl);
      setIsLoading(true);
      setConnectionStatus('⏳ Loading...');
    };

    const handleCanPlay = () => {
      console.log('✅ Audio can play:', streamUrl);
      setIsLoading(false);
      setConnectionStatus('✅ Ready');
    };

    const handleWaiting = () => {
      console.log('⏳ Audio waiting/buffering');
      setConnectionStatus('⏳ Buffering...');
    };

    const handleLoadedData = () => {
      console.log('✅ Audio data loaded');
      setConnectionStatus('✅ Loaded');
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('loadeddata', handleLoadedData);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [onStatusChange, currentStreamIndex, streamUrl]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) {
      console.error('❌ Audio element not found');
      return;
    }

    console.log('🎵 Toggle play/pause clicked, current state:', isPlaying, 'URL:', streamUrl);

    if (isPlaying) {
      audio.pause();
    } else {
      try {
        setIsLoading(true);
        setConnectionStatus('▶️ Starting...');
        
        // Force reload the audio element with current stream
        audio.load();
        
        // Wait for user interaction requirement (browsers block autoplay)
        if (audio.readyState === 0) {
          console.log('⏳ Loading audio stream:', streamUrl);
          
          // Enhanced promise with better timeout handling
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              console.warn('🚨 Audio load timeout - trying next stream');
              reject(new Error('Stream load timeout after 8 seconds'));
            }, 8000);
            
            const onCanPlay = () => {
              console.log('✅ Audio ready to play');
              clearTimeout(timeout);
              cleanup();
              resolve(true);
            };
            
            const onError = (e: Event) => {
              console.error('❌ Audio load error:', e);
              clearTimeout(timeout);
              cleanup();
              reject(new Error('Stream failed to load'));
            };
            
            const onLoadedMetadata = () => {
              console.log('📊 Audio metadata loaded');
              setConnectionStatus('📊 Metadata loaded');
            };
            
            const cleanup = () => {
              audio.removeEventListener('canplay', onCanPlay);
              audio.removeEventListener('error', onError);
              audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            };
            
            audio.addEventListener('canplay', onCanPlay);
            audio.addEventListener('error', onError);
            audio.addEventListener('loadedmetadata', onLoadedMetadata);
          });
        }
        
        // Attempt to play with enhanced error handling
        console.log('🎵 Attempting to play stream...');
        await audio.play();
        console.log('✅ Audio playback started successfully');
      } catch (error) {
        console.error('❌ Play failed:', error);
        setIsLoading(false);
        setConnectionStatus('❌ Play Failed');
        onStatusChange?.('Failed to play audio: ' + (error as Error).message);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-terminal-bg border-2 border-terminal-highlight rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Radio className="w-6 h-6 text-terminal-highlight" />
<h2 className="text-xl font-bold text-terminal-highlight">Infowars Live Radio</h2>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-terminal-text hover:text-terminal-highlight"
          >
            ✕
          </Button>
        </div>

        <audio
          ref={audioRef}
          src={streamUrl}
          preload="metadata"
          crossOrigin="anonymous"
          controls={false}
          playsInline
        />

        <div className="space-y-4">
          {/* Station Info */}
          <div className="text-center p-3 bg-terminal-bg/50 rounded border border-terminal-subtle">
            <div className="text-terminal-highlight font-semibold">{stationName}</div>
<div className="text-terminal-text text-sm">{
  currentStreamIndex === 0 ? '🎙️ Alex Jones Show - Live Stream' : 
  currentStreamIndex === 1 ? '🎵 Downbeat, chillout, and trip-hop' :
  currentStreamIndex === 2 ? '🎧 Downtempo, ambient, and chillout' : 
  currentStreamIndex === 3 ? '🌌 Deep ambient electronic space music' : 
  '🔧 Test Audio Stream'
}</div>
            <div className="text-terminal-subtle text-xs mt-1">Status: {connectionStatus}</div>
          </div>

          {/* Simple Play/Pause Button */}
          <div className="flex items-center justify-center">
            <Button
              onClick={togglePlayPause}
              disabled={isLoading}
              className="bg-terminal-highlight hover:bg-terminal-highlight/80 text-terminal-bg px-8 py-3"
              data-testid="radio-play-button"
            >
              {isLoading ? (
                <div className="animate-spin w-4 h-4 border-2 border-terminal-bg border-t-transparent rounded-full mr-2" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 mr-2" />
              ) : (
                <Play className="w-5 h-5 mr-2" />
              )}
              <span className="text-lg">
                {isLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
              </span>
            </Button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-3">
            <span className="text-terminal-text text-sm w-16">Volume:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-2 bg-terminal-subtle rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-terminal-text text-sm w-12">{Math.round(volume * 100)}%</span>
          </div>

          {/* Stream Options */}
          <div className="flex items-center justify-center space-x-2">
            {INFOWARS_STREAMS.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentStreamIndex(index);
                  if (audioRef.current) {
                    audioRef.current.load();
                  }
                }}
                className={`px-2 py-1 text-xs rounded ${
                  currentStreamIndex === index 
                    ? 'bg-terminal-highlight text-terminal-bg' 
                    : 'bg-terminal-subtle text-terminal-text hover:bg-terminal-highlight/50'
                }`}
              >
                index === 0 ? 'Live' : 
                index === 1 ? 'Trip' : 
                index === 2 ? 'Groove' : 
                index === 3 ? 'Space' : 'Test'
              </button>
            ))}
          </div>

          {/* Debug Info */}
          <div className="text-xs text-terminal-subtle p-2 bg-terminal-bg/30 rounded">
            <div>Current: {streamUrl}</div>
            <div>Stream {currentStreamIndex + 1} of {INFOWARS_STREAMS.length}</div>
            <div>Ready: {audioRef.current?.readyState || 'Not loaded'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}