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
  private readonly userAgent = 'ARCHIMEDES-Terminal/1.0';

  /**
   * Search for radio stations by query
   */
  async search(query: string, limit: number = 10): Promise<RadioStation[]> {
    try {
      const response = await fetch(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Radio Garden search failed: ${response.status}`);
      }

      const data = await response.json();
      const results: RadioStation[] = [];

      // Process hits from search results
      if (data.hits && data.hits.hits) {
        for (const hit of data.hits.hits.slice(0, limit)) {
          const source = hit._source;
          if (source.type === 'channel') {
            results.push({
              id: source.channelId,
              title: source.title,
              place: source.subtitle || source.place?.title || 'Unknown',
              country: source.country || 'Unknown',
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Radio Garden search error:', error);
      return [];
    }
  }

  /**
   * Get popular radio stations
   */
  async getPopularStations(limit: number = 20): Promise<RadioStation[]> {
    try {
      // Get places first, then get stations from popular places
      const places = await this.getPlaces();
      const popularPlaces = places
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

      const stations: RadioStation[] = [];
      
      for (const place of popularPlaces) {
        if (stations.length >= limit) break;
        
        const placeStations = await this.getPlaceStations(place.id);
        stations.push(...placeStations.slice(0, Math.ceil(limit / 10)));
      }

      return stations.slice(0, limit);
    } catch (error) {
      console.error('Error getting popular stations:', error);
      return [];
    }
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
    try {
      const response = await fetch(`${this.baseUrl}/ara/content/channel/${channelId}`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get channel details: ${response.status}`);
      }

      const data = await response.json();
      const channel = data.data;

      return {
        id: channel.id,
        title: channel.title,
        subtitle: channel.subtitle,
        website: channel.website,
        place: {
          id: channel.place?.id || '',
          title: channel.place?.title || 'Unknown',
          country: channel.country || 'Unknown',
        },
        stream: channel.stream,
        streamUrl: channel.stream ? `https://radio.garden/api/ara/content/listen/${channel.id}/channel.mp3` : undefined,
      };
    } catch (error) {
      console.error('Error getting channel details:', error);
      return null;
    }
  }

  /**
   * Get countries with radio stations
   */
  async getCountries(): Promise<Array<{country: string; count: number}>> {
    try {
      const places = await this.getPlaces();
      const countryMap = new Map<string, number>();

      places.forEach(place => {
        const current = countryMap.get(place.country) || 0;
        countryMap.set(place.country, current + place.size);
      });

      return Array.from(countryMap.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('Error getting countries:', error);
      return [];
    }
  }

  /**
   * Get random station
   */
  async getRandomStation(): Promise<RadioChannel | null> {
    try {
      const places = await this.getPlaces();
      if (places.length === 0) return null;

      // Pick random place
      const randomPlace = places[Math.floor(Math.random() * places.length)];
      const stations = await this.getPlaceStations(randomPlace.id);
      
      if (stations.length === 0) return null;

      // Pick random station from place
      const randomStation = stations[Math.floor(Math.random() * stations.length)];
      return await this.getChannelDetails(randomStation.id);
    } catch (error) {
      console.error('Error getting random station:', error);
      return null;
    }
  }
}

export const radioGardenService = new RadioGardenService();