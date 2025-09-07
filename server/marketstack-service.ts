interface MarketstackEODData {
  date: string;
  symbol: string;
  exchange: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adj_high?: number;
  adj_low?: number;
  adj_close?: number;
  adj_open?: number;
  adj_volume?: number;
  split_factor?: number;
  dividend?: number;
}

interface MarketstackIntradayData {
  date: string;
  symbol: string;
  exchange: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  last: number;
}

interface MarketstackTickerInfo {
  name: string;
  symbol: string;
  has_intraday: boolean;
  has_eod: boolean;
  country: string;
  stock_exchange: {
    name: string;
    acronym: string;
    mic: string;
    country: string;
    country_code: string;
    city: string;
    website: string;
  };
}

interface MarketstackResponse<T> {
  pagination: {
    limit: number;
    offset: number;
    count: number;
    total: number;
  };
  data: T[];
}

export class MarketstackService {
  private static instance: MarketstackService;
  private readonly baseUrl = 'https://api.marketstack.com/v2';
  private readonly apiKey = process.env.MARKETSTACK_API_KEY;

  public static getInstance(): MarketstackService {
    if (!MarketstackService.instance) {
      MarketstackService.instance = new MarketstackService();
    }
    return MarketstackService.instance;
  }

  constructor() {
    if (!this.apiKey) {
      throw new Error('MARKETSTACK_API_KEY environment variable is required');
    }
  }

  /**
   * Get end-of-day (EOD) stock data
   */
  async getEODData(params: {
    symbols: string[];
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    sort?: 'desc' | 'asc';
  }): Promise<MarketstackResponse<MarketstackEODData>> {
    const queryParams = new URLSearchParams({
      access_key: this.apiKey!,
      symbols: params.symbols.join(','),
    });

    if (params.dateFrom) queryParams.append('date_from', params.dateFrom);
    if (params.dateTo) queryParams.append('date_to', params.dateTo);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sort) queryParams.append('sort', params.sort);

    const url = `${this.baseUrl}/eod?${queryParams.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Marketstack API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Marketstack EOD error:', error);
      throw new Error(`Failed to fetch stock data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get latest stock quote (most recent EOD data)
   */
  async getLatestQuote(symbol: string): Promise<MarketstackEODData | null> {
    const response = await this.getEODData({
      symbols: [symbol.toUpperCase()],
      limit: 1,
      sort: 'desc'
    });

    return response.data.length > 0 ? response.data[0] : null;
  }

  /**
   * Get multiple stock quotes
   */
  async getMultipleQuotes(symbols: string[]): Promise<MarketstackEODData[]> {
    const response = await this.getEODData({
      symbols: symbols.map(s => s.toUpperCase()),
      limit: symbols.length,
      sort: 'desc'
    });

    return response.data;
  }

  /**
   * Get intraday data (requires higher tier plan)
   */
  async getIntradayData(params: {
    symbols: string[];
    interval?: '1min' | '5min' | '10min' | '15min' | '30min' | '1hour';
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<MarketstackResponse<MarketstackIntradayData>> {
    const queryParams = new URLSearchParams({
      access_key: this.apiKey!,
      symbols: params.symbols.join(','),
    });

    if (params.interval) queryParams.append('interval', params.interval);
    if (params.dateFrom) queryParams.append('date_from', params.dateFrom);
    if (params.dateTo) queryParams.append('date_to', params.dateTo);
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const url = `${this.baseUrl}/intraday?${queryParams.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Marketstack API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Marketstack intraday error:', error);
      throw new Error(`Failed to fetch intraday data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get ticker information
   */
  async getTickerInfo(symbol: string): Promise<MarketstackTickerInfo | null> {
    const queryParams = new URLSearchParams({
      access_key: this.apiKey!,
      symbols: symbol.toUpperCase(),
    });

    const url = `${this.baseUrl}/tickerinfo?${queryParams.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Marketstack API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data: MarketstackResponse<MarketstackTickerInfo> = await response.json();
      return data.data.length > 0 ? data.data[0] : null;
    } catch (error) {
      console.error('Marketstack ticker info error:', error);
      throw new Error(`Failed to fetch ticker info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for tickers by name or symbol
   */
  async searchTickers(query: string, limit: number = 10): Promise<MarketstackTickerInfo[]> {
    const queryParams = new URLSearchParams({
      access_key: this.apiKey!,
      search: query,
      limit: limit.toString(),
    });

    const url = `${this.baseUrl}/tickers?${queryParams.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Marketstack API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data: MarketstackResponse<MarketstackTickerInfo> = await response.json();
      return data.data;
    } catch (error) {
      console.error('Marketstack ticker search error:', error);
      throw new Error(`Failed to search tickers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format stock quote for terminal display
   */
  formatQuoteForTerminal(quote: MarketstackEODData): string {
    const date = new Date(quote.date).toLocaleDateString();
    const changeValue = quote.close - quote.open;
    const changePercent = ((changeValue / quote.open) * 100).toFixed(2);
    const changeColor = changeValue >= 0 ? '📈' : '📉';

    return `${changeColor} ${quote.symbol} (${quote.exchange})
Price: $${quote.close.toFixed(2)}
Change: ${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(2)} (${changePercent}%)
Open: $${quote.open.toFixed(2)} | High: $${quote.high.toFixed(2)} | Low: $${quote.low.toFixed(2)}
Volume: ${quote.volume.toLocaleString()}
Date: ${date}`;
  }

  /**
   * Format multiple quotes for terminal display
   */
  formatMultipleQuotesForTerminal(quotes: MarketstackEODData[]): string {
    if (quotes.length === 0) {
      return 'No stock data found.';
    }

    const header = `Stock Market Data (${quotes.length} symbols):`;
    
    const quotesDisplay = quotes.map(quote => {
      const changeValue = quote.close - quote.open;
      const changePercent = ((changeValue / quote.open) * 100).toFixed(2);
      const changeColor = changeValue >= 0 ? '📈' : '📉';
      const changeText = `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(2)} (${changePercent}%)`;
      
      return `${changeColor} ${quote.symbol.padEnd(6)} $${quote.close.toFixed(2).padStart(8)} ${changeText}`;
    }).join('\n');

    const footer = `\nUse 'stock info <symbol>' for detailed information.`;

    return `${header}\n\n${quotesDisplay}${footer}`;
  }

  /**
   * Format ticker info for terminal display
   */
  formatTickerInfoForTerminal(info: MarketstackTickerInfo): string {
    return `Company Information: ${info.symbol}

Name: ${info.name}
Symbol: ${info.symbol}
Exchange: ${info.stock_exchange.name} (${info.stock_exchange.acronym})
Country: ${info.country} (${info.stock_exchange.country})
City: ${info.stock_exchange.city}
Website: ${info.stock_exchange.website || 'N/A'}

Data Availability:
  End-of-Day: ${info.has_eod ? 'Yes' : 'No'}
  Intraday: ${info.has_intraday ? 'Yes' : 'No'}

Use 'stock quote ${info.symbol}' to get current price data.`;
  }

  /**
   * Format historical data for terminal display
   */
  formatHistoricalDataForTerminal(data: MarketstackEODData[], symbol: string): string {
    if (data.length === 0) {
      return `No historical data found for ${symbol}.`;
    }

    const header = `Historical Data: ${symbol} (Last ${data.length} trading days)`;
    
    const dataDisplay = data.map(quote => {
      const date = new Date(quote.date).toLocaleDateString();
      const changeValue = quote.close - quote.open;
      const changePercent = ((changeValue / quote.open) * 100).toFixed(2);
      const changeColor = changeValue >= 0 ? '📈' : '📉';
      
      return `${date.padEnd(12)} ${changeColor} $${quote.close.toFixed(2).padStart(8)} (${changeValue >= 0 ? '+' : ''}${changePercent}%) Vol: ${quote.volume.toLocaleString()}`;
    }).join('\n');

    return `${header}\n\n${'Date'.padEnd(12)} ${'Trend'.padEnd(2)} ${'Close'.padStart(8)} ${'Change'.padStart(10)} ${'Volume'.padStart(15)}\n${'-'.repeat(60)}\n${dataDisplay}`;
  }
}

export const marketstackService = MarketstackService.getInstance();