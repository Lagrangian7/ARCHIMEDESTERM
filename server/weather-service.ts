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

export interface ForecastData {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  description: string;
  icon: string;
  humidity: number;
  wind_speed: number;
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

  async getCurrentWeather(location: string): Promise<WeatherData> {
    try {
      const response = await fetch(
        `${this.baseUrl}/weather?q=${encodeURIComponent(location)}&appid=${this.apiKey}&units=metric`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Location "${location}" not found. Please check the spelling or try a different location.`);
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

  async getForecast(location: string, days: number = 5): Promise<ForecastData[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/forecast?q=${encodeURIComponent(location)}&appid=${this.apiKey}&units=metric&cnt=${days * 8}` // 8 forecasts per day (3-hour intervals)
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Location "${location}" not found. Please check the spelling or try a different location.`);
        }
        throw new Error(`Forecast API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Group forecasts by day
      const dailyForecasts: { [key: string]: any[] } = {};
      
      data.list.forEach((item: any) => {
        const date = new Date(item.dt * 1000).toDateString();
        if (!dailyForecasts[date]) {
          dailyForecasts[date] = [];
        }
        dailyForecasts[date].push(item);
      });

      // Convert to forecast data
      const forecasts: ForecastData[] = Object.entries(dailyForecasts)
        .slice(0, days)
        .map(([date, items]) => {
          const temps = items.map(item => item.main.temp);
          const descriptions = items.map(item => item.weather[0].description);
          const icons = items.map(item => item.weather[0].icon);
          const humidities = items.map(item => item.main.humidity);
          const windSpeeds = items.map(item => item.wind?.speed || 0);

          return {
            date: new Date(date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'short', 
              day: 'numeric' 
            }),
            temperature: {
              min: Math.round(Math.min(...temps)),
              max: Math.round(Math.max(...temps)),
            },
            description: descriptions[Math.floor(descriptions.length / 2)], // Middle description
            icon: icons[Math.floor(icons.length / 2)], // Middle icon
            humidity: Math.round(humidities.reduce((a, b) => a + b) / humidities.length),
            wind_speed: Math.round(windSpeeds.reduce((a, b) => a + b) / windSpeeds.length),
          };
        });

      return forecasts;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch weather forecast. Please try again.');
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

  formatForecast(forecasts: ForecastData[], location: string): string {
    let output = `📅 ${forecasts.length}-Day Forecast for ${location}\n\n`;
    
    forecasts.forEach((forecast, index) => {
      const emoji = this.getWeatherEmoji(forecast.icon);
      output += `${emoji} ${forecast.date}
   ${forecast.temperature.min}°C - ${forecast.temperature.max}°C
   ${forecast.description.charAt(0).toUpperCase() + forecast.description.slice(1)}
   Humidity: ${forecast.humidity}% | Wind: ${forecast.wind_speed} m/s\n\n`;
    });

    return output.trim();
  }

  private getWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
  }

  private getWeatherEmoji(icon: string): string {
    const emojiMap: { [key: string]: string } = {
      '01d': '☀️', '01n': '🌙',
      '02d': '⛅', '02n': '☁️',
      '03d': '☁️', '03n': '☁️',
      '04d': '☁️', '04n': '☁️',
      '09d': '🌧️', '09n': '🌧️',
      '10d': '🌦️', '10n': '🌧️',
      '11d': '⛈️', '11n': '⛈️',
      '13d': '🌨️', '13n': '🌨️',
      '50d': '🌫️', '50n': '🌫️',
    };
    return emojiMap[icon] || '🌤️';
  }
}

export const weatherService = WeatherService.getInstance();