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

  // Infowars live stream URLs with fallbacks
  const INFOWARS_STREAMS = [
    'https://radio.orange.com/radios/alex_jones_infowarscom/stream',
    'https://streams.radiomast.io/alex-jones-infowars',
    'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3' // Fallback test
  ];
  
  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);
  const streamUrl = INFOWARS_STREAMS[currentStreamIndex];
  const stationName = currentStreamIndex < 2 ? 'Infowars Live' : 'Test Audio Stream';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      console.log('Audio started playing');
      setIsPlaying(true);
      setIsLoading(false);
      setConnectionStatus('Playing');
      onStatusChange?.('🎵 Audio is playing');
    };

    const handlePause = () => {
      console.log('Audio paused');
      setIsPlaying(false);
      setConnectionStatus('Paused');
      onStatusChange?.('Audio paused');
    };

    const handleError = (error: Event) => {
      console.error('Audio error:', error);
      setIsLoading(false);
      setIsPlaying(false);
      
      // Try next stream if current one fails
      if (currentStreamIndex < INFOWARS_STREAMS.length - 1) {
        const nextIndex = currentStreamIndex + 1;
        setCurrentStreamIndex(nextIndex);
        setConnectionStatus(`Switching to backup stream ${nextIndex + 1}...`);
        onStatusChange?.(`Stream failed, trying backup ${nextIndex + 1}...`);
        
        // Auto-retry with next stream after a short delay
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.load(); // Reload with new source
            audioRef.current.play().catch(console.error);
          }
        }, 1000);
      } else {
        setConnectionStatus('All streams failed');
        onStatusChange?.('All Infowars streams unavailable');
      }
    };

    const handleLoadStart = () => {
      console.log('Audio loading started');
      setIsLoading(true);
      setConnectionStatus('Loading...');
    };

    const handleCanPlay = () => {
      console.log('Audio can play');
      setIsLoading(false);
      setConnectionStatus('Ready');
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [onStatusChange]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) {
      console.error('Audio element not found');
      return;
    }

    console.log('Toggle play/pause clicked, current state:', isPlaying);

    if (isPlaying) {
      audio.pause();
    } else {
      setIsLoading(true);
      setConnectionStatus('Starting...');
      audio.play().catch(error => {
        console.error('Play failed:', error);
        setIsLoading(false);
        setConnectionStatus('Play Failed');
        onStatusChange?.('Failed to play audio: ' + error.message);
      });
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
<h2 className="text-xl font-bold text-terminal-highlight">Infowars Live Stream</h2>
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
        />

        <div className="space-y-4">
          {/* Station Info */}
          <div className="text-center p-3 bg-terminal-bg/50 rounded border border-terminal-subtle">
            <div className="text-terminal-highlight font-semibold">{stationName}</div>
<div className="text-terminal-text text-sm">{currentStreamIndex < 2 ? 'Alex Jones Show' : 'Test Audio'}</div>
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
                {index < 2 ? `Stream ${index + 1}` : 'Test'}
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