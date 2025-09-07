import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Play, Pause, Radio } from 'lucide-react';

interface RadioStreamerProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: string) => void;
}

export function RadioStreamer({ isOpen, onClose, onStatusChange }: RadioStreamerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const audioRef = useRef<HTMLAudioElement>(null);

  const streamUrl = '/api/radio/stream';
  const stationName = 'KLUX 89.5HD - Good Company';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => {
      setIsLoading(true);
      setConnectionStatus('Connecting...');
      onStatusChange?.('Connecting to KLUX Radio...');
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      setConnectionStatus('Connected');
      onStatusChange?.('KLUX Radio connected successfully');
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setConnectionStatus('Streaming');
      onStatusChange?.('🎵 Now streaming KLUX Radio');
    };

    const handlePause = () => {
      setIsPlaying(false);
      setConnectionStatus('Paused');
      onStatusChange?.('Radio stream paused');
    };

    const handleError = (error: Event) => {
      setIsLoading(false);
      setIsPlaying(false);
      setConnectionStatus('Connection Failed');
      console.error('Radio stream error:', error);
      
      // More specific error handling
      const audioError = (error.target as HTMLAudioElement)?.error;
      let errorMessage = 'Failed to connect to KLUX Radio stream';
      
      if (audioError) {
        switch (audioError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Stream loading was aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error loading stream';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Stream format not supported';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Stream source not accessible (may be CORS/HTTPS issue)';
            break;
          default:
            errorMessage = 'Unknown streaming error occurred';
        }
      }
      
      onStatusChange?.(errorMessage);
    };

    const handleWaiting = () => {
      setConnectionStatus('Buffering...');
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
    };
  }, [onStatusChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
        setConnectionStatus('Playback Error');
        onStatusChange?.('Error: Unable to play radio stream');
      });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-terminal-bg border-2 border-terminal-highlight rounded-lg p-6 w-full max-w-md relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Radio className="w-6 h-6 text-terminal-highlight" />
            <h2 className="text-xl font-bold text-terminal-highlight">KLUX Radio Stream</h2>
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
          preload="none"
          crossOrigin="anonymous"
        />

        <div className="space-y-4">
          {/* Station Info */}
          <div className="text-center p-3 bg-terminal-bg/50 rounded border border-terminal-subtle">
            <div className="text-terminal-highlight font-semibold">{stationName}</div>
            <div className="text-terminal-text text-sm">Easy Listening • Corpus Christi, TX</div>
            <div className="text-terminal-subtle text-xs mt-1">Status: {connectionStatus}</div>
            {connectionStatus === 'Connection Failed' && (
              <div className="text-orange-400 text-xs mt-2">
                Stream may be temporarily unavailable
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4">
            <Button
              onClick={togglePlayPause}
              disabled={isLoading}
              className="bg-terminal-highlight hover:bg-terminal-highlight/80 text-terminal-bg px-6"
            >
              {isLoading ? (
                <div className="animate-spin w-4 h-4 border-2 border-terminal-bg border-t-transparent rounded-full" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span className="ml-2">
                {isLoading ? 'Connecting...' : isPlaying ? 'Pause' : 'Play'}
              </span>
            </Button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-3">
            <Button
              onClick={toggleMute}
              variant="ghost"
              size="sm"
              className="text-terminal-text hover:text-terminal-highlight p-2"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full h-2 bg-terminal-subtle rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, var(--terminal-highlight) 0%, var(--terminal-highlight) ${volume * 100}%, var(--terminal-subtle) ${volume * 100}%, var(--terminal-subtle) 100%)`
                }}
              />
            </div>
            <span className="text-terminal-text text-sm w-8">
              {Math.round((isMuted ? 0 : volume) * 100)}
            </span>
          </div>

          {/* Terminal Commands Info */}
          <div className="text-xs text-terminal-subtle bg-terminal-bg/30 p-3 rounded border border-terminal-subtle/50">
            <div className="font-semibold mb-1">Terminal Commands:</div>
            <div>• <code>radio play</code> - Start streaming</div>
            <div>• <code>radio stop</code> - Stop streaming</div>
            <div>• <code>radio volume &lt;0-100&gt;</code> - Set volume</div>
            <div>• <code>radio status</code> - Show current status</div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: var(--terminal-highlight);
          cursor: pointer;
          border: 2px solid var(--terminal-bg);
          box-shadow: 0 0 6px rgba(0, 255, 65, 0.5);
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: var(--terminal-highlight);
          cursor: pointer;
          border: 2px solid var(--terminal-bg);
          box-shadow: 0 0 6px rgba(0, 255, 65, 0.5);
        }
      `}} />
    </div>
  );
}

// Hook for controlling radio from terminal commands
export function useRadioControl() {
  const [isOpen, setIsOpen] = useState(false);
  const [lastStatus, setLastStatus] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get reference to audio element when component mounts
  useEffect(() => {
    const findAudio = () => {
      const audio = document.querySelector('audio[src*="cloudradionetwork"]') as HTMLAudioElement;
      if (audio) {
        audioRef.current = audio;
      }
    };
    
    const interval = setInterval(findAudio, 1000);
    findAudio();
    
    return () => clearInterval(interval);
  }, [isOpen]);

  const openRadio = () => setIsOpen(true);
  const closeRadio = () => setIsOpen(false);

  const play = (): Promise<string> => {
    return new Promise((resolve) => {
      const audio = audioRef.current;
      if (!audio) {
        openRadio();
        resolve('Opening radio interface...');
        return;
      }
      
      audio.play()
        .then(() => resolve('🎵 KLUX Radio stream started'))
        .catch(() => resolve('Error: Unable to start radio stream'));
    });
  };

  const stop = (): string => {
    const audio = audioRef.current;
    if (!audio) {
      return 'Radio is not currently active';
    }
    
    audio.pause();
    return '⏹️ KLUX Radio stream stopped';
  };

  const setVolume = (vol: number): string => {
    const audio = audioRef.current;
    if (!audio) {
      return 'Radio is not currently active';
    }
    
    const volume = Math.max(0, Math.min(1, vol / 100));
    audio.volume = volume;
    return `🔊 Volume set to ${Math.round(volume * 100)}%`;
  };

  const getStatus = (): string => {
    const audio = audioRef.current;
    if (!audio) {
      return 'Radio Status: Inactive\nUse "radio play" to start streaming KLUX Radio';
    }
    
    const isPlaying = !audio.paused;
    const volume = Math.round(audio.volume * 100);
    
    return `Radio Status: ${isPlaying ? 'Streaming 🎵' : 'Stopped ⏹️'}
Station: KLUX Radio Network
Stream: Cloud Radio Network
Volume: ${volume}%
Connection: ${audio.readyState >= 2 ? 'Ready' : 'Loading...'}`;
  };

  const handleStatusChange = (status: string) => {
    setLastStatus(status);
  };

  return {
    isOpen,
    openRadio,
    closeRadio,
    play,
    stop,
    setVolume,
    getStatus,
    handleStatusChange,
    RadioComponent: ({ ...props }) => (
      <RadioStreamer 
        {...props} 
        isOpen={isOpen} 
        onClose={closeRadio} 
        onStatusChange={handleStatusChange}
      />
    )
  };
}