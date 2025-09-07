import { useState, useEffect, useRef, useCallback } from 'react';

interface RadioStation {
  name: string;
  url: string;
  description: string;
}

interface RadioState {
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  currentStation: RadioStation | null;
  currentTrack: string;
  isDucked: boolean;
  error: string | null;
}

const DEFAULT_STATIONS: RadioStation[] = [
  {
    name: 'KLUX 89.5HD',
    url: 'https://player.cloudradionetwork.com/klux/',
    description: 'Christian Contemporary & Classic Hits'
  }
];

export function useRadio() {
  const [state, setState] = useState<RadioState>({
    isPlaying: false,
    volume: 50,
    isMuted: false,
    currentStation: DEFAULT_STATIONS[0],
    currentTrack: 'Loading...',
    isDucked: false,
    error: null
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const originalVolumeRef = useRef<number>(50);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = 'anonymous';
    audioRef.current.preload = 'none';
    
    const audio = audioRef.current;

    const handleLoadStart = () => {
      setState(prev => ({ ...prev, error: null, currentTrack: 'Connecting...' }));
    };

    const handleCanPlay = () => {
      setState(prev => ({ ...prev, currentTrack: 'Connected - Loading track info...' }));
    };

    const handlePlay = () => {
      setState(prev => ({ ...prev, isPlaying: true, error: null }));
    };

    const handlePause = () => {
      setState(prev => ({ ...prev, isPlaying: false }));
    };

    const handleError = (e: Event) => {
      const error = audioRef.current?.error;
      let errorMessage = 'Unable to connect to radio station';
      
      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error - check connection';
            break;
          case error.MEDIA_ERR_DECODE:
            errorMessage = 'Audio decode error';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio format not supported';
            break;
          default:
            errorMessage = 'Unknown audio error';
        }
      }
      
      setState(prev => ({ 
        ...prev, 
        isPlaying: false, 
        error: errorMessage,
        currentTrack: 'Connection failed'
      }));
    };

    const handleVolumeChange = () => {
      if (audio.muted !== state.isMuted) {
        setState(prev => ({ ...prev, isMuted: audio.muted }));
      }
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('volumechange', handleVolumeChange);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('volumechange', handleVolumeChange);
      
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  // Update audio volume when state changes
  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const targetVolume = state.isMuted ? 0 : (state.isDucked ? state.volume * 0.2 : state.volume) / 100;
      audio.volume = Math.max(0, Math.min(1, targetVolume));
    }
  }, [state.volume, state.isMuted, state.isDucked]);

  // Mock track info updates (in real implementation, this would come from station API)
  useEffect(() => {
    if (state.isPlaying && !state.error) {
      const interval = setInterval(() => {
        // Simulate getting current track info
        const mockTracks = [
          'Simon Park - What Becomes Of The Brokenhearted?',
          'Burton Cummings - Stand Tall',
          'Frank Barber - Him',
          'Engelbert Humperdinck - Somewhere In Time',
          'Fernando Ortega - Softly And Tenderly',
          'Lex De Azevedo - Half The Way'
        ];
        
        const randomTrack = mockTracks[Math.floor(Math.random() * mockTracks.length)];
        setState(prev => ({ 
          ...prev, 
          currentTrack: randomTrack
        }));
      }, 45000 + Math.random() * 60000); // Change every 45-105 seconds

      return () => clearInterval(interval);
    }
  }, [state.isPlaying, state.error]);

  const startPlaying = useCallback(async (station?: RadioStation) => {
    if (!audioRef.current) return false;

    const targetStation = station || state.currentStation;
    if (!targetStation) return false;

    try {
      setState(prev => ({ 
        ...prev, 
        currentStation: targetStation, 
        error: null,
        currentTrack: 'Connecting...'
      }));

      // For web radio streams, we need to find the actual stream URL
      // KLUX uses a web player, so we'll try to extract the stream URL
      const streamUrl = getStreamUrl(targetStation);
      
      audioRef.current.src = streamUrl;
      await audioRef.current.play();
      
      return true;
    } catch (error) {
      console.error('Radio play error:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start radio stream',
        currentTrack: 'Connection failed'
      }));
      return false;
    }
  }, [state.currentStation]);

  const stopPlaying = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setState(prev => ({ 
        ...prev, 
        isPlaying: false, 
        currentTrack: 'Stopped',
        error: null
      }));
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(100, volume));
    setState(prev => ({ ...prev, volume: clampedVolume }));
  }, []);

  const toggleMute = useCallback(() => {
    setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const duck = useCallback((shouldDuck: boolean) => {
    if (shouldDuck && !state.isDucked) {
      originalVolumeRef.current = state.volume;
    }
    setState(prev => ({ ...prev, isDucked: shouldDuck }));
  }, [state.isDucked, state.volume]);

  // Helper function to get stream URL (simplified for now)
  const getStreamUrl = (station: RadioStation): string => {
    // For KLUX, we'll try to use a direct stream URL
    // In a real implementation, you'd need to extract this from the player page
    if (station.name.includes('KLUX')) {
      // This might need to be updated with the actual stream URL
      return 'https://ice9.securenetsystems.net/KLUX';
    }
    return station.url;
  };

  return {
    ...state,
    stations: DEFAULT_STATIONS,
    startPlaying,
    stopPlaying,
    setVolume,
    toggleMute,
    duck,
    isConnected: state.isPlaying && !state.error
  };
}