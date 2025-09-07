export interface WeatherData {
  location: string;
  temperature: number;
  description: string;
  feels_like: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  wind_direction: number;
  visibility: number;
  icon: string;
  country: string;
  sunrise: number;
  sunset: number;
}

export class WeatherService {
  private static instance: WeatherService;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';

  private constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY!;
    if (!this.apiKey) {
      throw new Error('OPENWEATHER_API_KEY environment variable is required');
    }
  }

  public static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  async getCurrentWeather(location?: string): Promise<WeatherData> {
    try {
      let url: string;
      if (location) {
        url = `${this.baseUrl}/weather?q=${encodeURIComponent(location)}&appid=${this.apiKey}&units=metric`;
      } else {
        // Default to a generic location if none provided
        url = `${this.baseUrl}/weather?q=London&appid=${this.apiKey}&units=metric`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Location "${location || 'default'}" not found. Please check the spelling or try a different location.`);
        }
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        location: `${data.name}, ${data.sys.country}`,
        temperature: Math.round(data.main.temp),
        description: data.weather[0].description,
        feels_like: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        wind_speed: data.wind?.speed || 0,
        wind_direction: data.wind?.deg || 0,
        visibility: data.visibility ? Math.round(data.visibility / 1000) : 0,
        icon: data.weather[0].icon,
        country: data.sys.country,
        sunrise: data.sys.sunrise,
        sunset: data.sys.sunset,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch weather data. Please try again.');
    }
  }

  async getWeatherByCoordinates(lat: number, lon: number): Promise<WeatherData> {
    try {
      const response = await fetch(
        `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        location: `${data.name}, ${data.sys.country}`,
        temperature: Math.round(data.main.temp),
        description: data.weather[0].description,
        feels_like: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        wind_speed: data.wind?.speed || 0,
        wind_direction: data.wind?.deg || 0,
        visibility: data.visibility ? Math.round(data.visibility / 1000) : 0,
        icon: data.weather[0].icon,
        country: data.sys.country,
        sunrise: data.sys.sunrise,
        sunset: data.sys.sunset,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch weather data by coordinates. Please try again.');
    }
  }

  formatCurrentWeather(weather: WeatherData): string {
    const windDirection = this.getWindDirection(weather.wind_direction);
    const sunrise = new Date(weather.sunrise * 1000).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const sunset = new Date(weather.sunset * 1000).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return `🌍 Current Weather for ${weather.location}

🌡️  Temperature: ${weather.temperature}°C (feels like ${weather.feels_like}°C)
☁️  Conditions: ${weather.description.charAt(0).toUpperCase() + weather.description.slice(1)}
💧 Humidity: ${weather.humidity}%
🌬️  Wind: ${weather.wind_speed} m/s ${windDirection}
📊 Pressure: ${weather.pressure} hPa
👁️  Visibility: ${weather.visibility} km
🌅 Sunrise: ${sunrise}
🌇 Sunset: ${sunset}`;
  }

  private getWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
  }
}

export const weatherService = WeatherService.getInstance();