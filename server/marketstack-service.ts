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
  private readonly useFallback = !process.env.MARKETSTACK_API_KEY || process.env.MARKETSTACK_API_KEY === 'demo';

  public static getInstance(): MarketstackService {
    if (!MarketstackService.instance) {
      MarketstackService.instance = new MarketstackService();
    }
    return MarketstackService.instance;
  }

  constructor() {
    if (this.useFallback) {
      console.warn('⚠️  Using demo stock data - set MARKETSTACK_API_KEY for live data');
    }
  }

  /**
   * Generate demo stock data for fallback
   */
  private generateDemoData(symbol: string): MarketstackEODData {
    const basePrice = this.getSymbolBasePrice(symbol);
    const randomChange = (Math.random() - 0.5) * 0.1; // +/- 5% max change
    const close = basePrice * (1 + randomChange);
    const open = basePrice * (1 + (Math.random() - 0.5) * 0.05);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    const volume = Math.floor(Math.random() * 50000000) + 1000000;
    
    return {
      date: new Date().toISOString().split('T')[0],
      symbol: symbol.toUpperCase(),
      exchange: 'NASDAQ',
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume
    };
  }

  private getSymbolBasePrice(symbol: string): number {
    const prices: Record<string, number> = {
      'AAPL': 175.50, 'MSFT': 415.30, 'GOOGL': 140.25, 'AMZN': 145.80,
      'TSLA': 245.60, 'META': 485.20, 'NVDA': 875.40, 'NFLX': 485.90,
      'AMD': 165.75, 'INTC': 28.45, 'IBM': 195.30, 'ORCL': 115.85,
      'CRM': 285.40, 'ADBE': 575.20, 'NOW': 785.60, 'PYPL': 75.30
    };
    return prices[symbol.toUpperCase()] || 100 + Math.random() * 200;
  }

  private generateDemoTickerInfo(symbol: string): MarketstackTickerInfo {
    const companies: Record<string, string> = {
      'AAPL': 'Apple Inc.',
      'MSFT': 'Microsoft Corporation',
      'GOOGL': 'Alphabet Inc.',
      'AMZN': 'Amazon.com Inc.',
      'TSLA': 'Tesla Inc.',
      'META': 'Meta Platforms Inc.',
      'NVDA': 'NVIDIA Corporation',
      'NFLX': 'Netflix Inc.'
    };

    return {
      name: companies[symbol.toUpperCase()] || `${symbol.toUpperCase()} Corporation`,
      symbol: symbol.toUpperCase(),
      has_intraday: true,
      has_eod: true,
      country: 'US',
      stock_exchange: {
        name: 'NASDAQ Global Select',
        acronym: 'NASDAQ',
        mic: 'XNAS',
        country: 'United States',
        country_code: 'US',
        city: 'New York',
        website: 'https://www.nasdaq.com'
      }
    };
  }

  private searchDemoTickers(query: string, limit: number): MarketstackTickerInfo[] {
    const demoStocks = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corporation' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'META', name: 'Meta Platforms Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation' },
      { symbol: 'NFLX', name: 'Netflix Inc.' }
    ];

    const results = demoStocks.filter(stock => 
      stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
      stock.name.toLowerCase().includes(query.toLowerCase())
    );

    return results.slice(0, limit).map(stock => this.generateDemoTickerInfo(stock.symbol));
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
    // Use demo data if API key is not available or invalid
    if (this.useFallback) {
      const demoData = params.symbols.map(symbol => this.generateDemoData(symbol));
      return {
        pagination: {
          limit: params.limit || 100,
          offset: 0,
          count: demoData.length,
          total: demoData.length
        },
        data: demoData
      };
    }
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
      console.warn('🔄 Falling back to demo data due to API error');
      // Fall back to demo data on API errors
      const demoData = params.symbols.map(symbol => this.generateDemoData(symbol));
      return {
        pagination: {
          limit: params.limit || 100,
          offset: 0,
          count: demoData.length,
          total: demoData.length
        },
        data: demoData
      };
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
    if (this.useFallback) {
      return this.generateDemoTickerInfo(symbol);
    }

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
      console.warn('🔄 Falling back to demo ticker info');
      return this.generateDemoTickerInfo(symbol);
    }
  }

  /**
   * Search for tickers by name or symbol
   */
  async searchTickers(query: string, limit: number = 10): Promise<MarketstackTickerInfo[]> {
    if (this.useFallback) {
      return this.searchDemoTickers(query, limit);
    }

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
      console.warn('🔄 Falling back to demo search results');
      return this.searchDemoTickers(query, limit);
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