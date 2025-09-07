/**
 * Radio Garden API Service
 * Unofficial API for accessing Radio Garden's global radio stations
 * Based on: https://github.com/jonasrmichel/radio-garden-openapi
 */

export interface RadioStation {
  id: string;
  title: string;
  place: string;
  country: string;
  streamUrl?: string;
  website?: string;
  genres?: string[];
}

export interface RadioPlace {
  id: string;
  title: string;
  country: string;
  size: number; // Number of stations
  geo: [number, number]; // [latitude, longitude]
}

export interface RadioChannel {
  id: string;
  title: string;
  subtitle?: string;
  website?: string;
  place: {
    id: string;
    title: string;
    country: string;
  };
  stream?: string;
  streamUrl?: string;
}

export class RadioGardenService {
  private readonly baseUrl = 'https://radio.garden/api';
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
  
  // Fallback stations when Radio Garden API is blocked
  private readonly fallbackStations: RadioStation[] = [
    {
      id: 'jazz24',
      title: 'Jazz24',
      place: 'Seattle',
      country: 'USA',
      streamUrl: 'https://live.wostreaming.net/direct/ppm-jazz24aac256-ibc1'
    },
    {
      id: 'smooth-jazz',
      title: 'Smooth Jazz CD 101.9',
      place: 'New York',
      country: 'USA', 
      streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CD1019_SC'
    },
    {
      id: 'bbc-radio1',
      title: 'BBC Radio 1',
      place: 'London',
      country: 'UK',
      streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one'
    },
    {
      id: 'france-inter',
      title: 'France Inter',
      place: 'Paris',
      country: 'France',
      streamUrl: 'https://direct.franceinter.fr/live/franceinter-midfi.mp3'
    },
    {
      id: 'classical',
      title: 'Classical KUSC',
      place: 'Los Angeles',
      country: 'USA',
      streamUrl: 'https://kusc-ice.streamguys1.com/kusc-128k'
    },
    {
      id: 'chill',
      title: 'ChillHop Radio',
      place: 'Netherlands',
      country: 'Netherlands',
      streamUrl: 'https://streams.fluxfm.de/chillhop/mp3-320'
    }
  ];

  /**
   * Search for radio stations by query (fallback implementation)
   */
  async search(query: string, limit: number = 10): Promise<RadioStation[]> {
    // Use fallback stations and filter by query
    const filtered = this.fallbackStations.filter(station => 
      station.title.toLowerCase().includes(query.toLowerCase()) ||
      station.place.toLowerCase().includes(query.toLowerCase()) ||
      station.country.toLowerCase().includes(query.toLowerCase())
    );
    
    return filtered.slice(0, limit);
  }

  /**
   * Get popular radio stations (fallback implementation)
   */
  async getPopularStations(limit: number = 20): Promise<RadioStation[]> {
    return this.fallbackStations.slice(0, limit);
  }

  /**
   * Get all places with radio stations
   */
  async getPlaces(): Promise<RadioPlace[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ara/content/places`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get places: ${response.status}`);
      }

      const data = await response.json();
      
      return data.data.list.map((place: any) => ({
        id: place.id,
        title: place.title,
        country: place.country,
        size: place.size,
        geo: place.geo,
      }));
    } catch (error) {
      console.error('Error getting places:', error);
      return [];
    }
  }

  /**
   * Get radio stations for a specific place
   */
  async getPlaceStations(placeId: string): Promise<RadioStation[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ara/content/place/${placeId}`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get place stations: ${response.status}`);
      }

      const data = await response.json();
      const stations: RadioStation[] = [];

      if (data.data?.content) {
        for (const content of data.data.content) {
          if (content.type === 'channel') {
            stations.push({
              id: content.page.url.split('/').pop(),
              title: content.page.title,
              place: data.data.title,
              country: data.data.country,
            });
          }
        }
      }

      return stations;
    } catch (error) {
      console.error('Error getting place stations:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a radio channel including stream URL
   */
  async getChannelDetails(channelId: string): Promise<RadioChannel | null> {
    const station = this.fallbackStations.find(s => s.id === channelId);
    if (!station) return null;
    
    return {
      id: station.id,
      title: station.title,
      subtitle: `${station.place}, ${station.country}`,
      website: '',
      place: {
        id: station.place.toLowerCase(),
        title: station.place,
        country: station.country,
      },
      stream: station.streamUrl,
      streamUrl: station.streamUrl,
    };
  }

  /**
   * Get countries with radio stations (fallback implementation)
   */
  async getCountries(): Promise<Array<{country: string; count: number}>> {
    const countryMap = new Map<string, number>();
    
    this.fallbackStations.forEach(station => {
      const current = countryMap.get(station.country) || 0;
      countryMap.set(station.country, current + 1);
    });

    return Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get random station (fallback implementation)
   */
  async getRandomStation(): Promise<RadioChannel | null> {
    if (this.fallbackStations.length === 0) return null;
    
    const randomStation = this.fallbackStations[Math.floor(Math.random() * this.fallbackStations.length)];
    return await this.getChannelDetails(randomStation.id);
  }
}

export const radioGardenService = new RadioGardenService();