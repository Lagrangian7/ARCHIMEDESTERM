interface GutendxBook {
  id: number;
  title: string;
  authors: Array<{
    name: string;
    birth_year?: number;
    death_year?: number;
  }>;
  languages: string[];
  download_count: number;
  formats: { [key: string]: string };
  subjects: string[];
  bookshelves: string[];
  copyright?: boolean;
}

interface GutendxResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutendxBook[];
}

export class GutendxService {
  private static instance: GutendxService;
  private readonly baseUrl = 'https://gutendx.com';

  public static getInstance(): GutendxService {
    if (!GutendxService.instance) {
      GutendxService.instance = new GutendxService();
    }
    return GutendxService.instance;
  }

  /**
   * Search books by title, author, or general query
   */
  async searchBooks(params: {
    search?: string;
    languages?: string[];
    author_year_start?: number;
    author_year_end?: number;
    copyright?: boolean;
    topic?: string;
    sort?: 'popular' | 'ascending' | 'descending';
    page?: number;
  }): Promise<GutendxResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.search) queryParams.append('search', params.search);
    if (params.languages?.length) queryParams.append('languages', params.languages.join(','));
    if (params.author_year_start) queryParams.append('author_year_start', params.author_year_start.toString());
    if (params.author_year_end) queryParams.append('author_year_end', params.author_year_end.toString());
    if (params.copyright !== undefined) queryParams.append('copyright', params.copyright.toString());
    if (params.topic) queryParams.append('topic', params.topic);
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.page && params.page > 1) queryParams.append('page', params.page.toString());

    const url = `${this.baseUrl}/books?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Gutendx API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Gutendx search error:', error);
      throw new Error(`Failed to search books: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific book by ID
   */
  async getBook(id: number): Promise<GutendxBook> {
    const url = `${this.baseUrl}/books/${id}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Book with ID ${id} not found`);
        }
        throw new Error(`Gutendx API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Gutendx get book error:', error);
      throw new Error(`Failed to get book: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get popular books (most downloaded)
   */
  async getPopularBooks(limit: number = 20): Promise<GutendxResponse> {
    return this.searchBooks({ sort: 'popular', page: 1 });
  }

  /**
   * Get books by specific authors
   */
  async getBooksByAuthor(authorName: string): Promise<GutendxResponse> {
    return this.searchBooks({ search: authorName });
  }

  /**
   * Get books in specific languages
   */
  async getBooksByLanguage(languages: string[]): Promise<GutendxResponse> {
    return this.searchBooks({ languages });
  }

  /**
   * Get books by topic/subject
   */
  async getBooksByTopic(topic: string): Promise<GutendxResponse> {
    return this.searchBooks({ topic });
  }

  /**
   * Format book information for terminal display
   */
  formatBookForTerminal(book: GutendxBook): string {
    const authors = book.authors.map(a => {
      let name = a.name;
      if (a.birth_year || a.death_year) {
        const birth = a.birth_year || '?';
        const death = a.death_year || '?';
        name += ` (${birth}-${death})`;
      }
      return name;
    }).join(', ');

    const languages = book.languages.map(lang => lang.toUpperCase()).join(', ');
    
    // Get available formats
    const formats = Object.keys(book.formats)
      .filter(format => ['text/plain', 'application/epub+zip', 'text/html', 'application/pdf'].includes(format))
      .map(format => {
        switch (format) {
          case 'text/plain': return 'TXT';
          case 'application/epub+zip': return 'EPUB';
          case 'text/html': return 'HTML';
          case 'application/pdf': return 'PDF';
          default: return format;
        }
      });

    const subjects = book.subjects?.slice(0, 3).join(', ') || 'None';
    
    return `ID: ${book.id}
Title: ${book.title}
Author(s): ${authors || 'Unknown'}
Language(s): ${languages}
Downloads: ${book.download_count.toLocaleString()}
Formats: ${formats.join(', ') || 'None'}
Subjects: ${subjects}
Copyright: ${book.copyright ? 'Yes' : 'Public Domain'}

Download Links:
${Object.entries(book.formats)
  .filter(([format]) => ['text/plain', 'application/epub+zip', 'text/html'].includes(format))
  .map(([format, url]) => {
    const label = format === 'text/plain' ? 'Plain Text' : 
                  format === 'application/epub+zip' ? 'EPUB' : 
                  format === 'text/html' ? 'HTML' : format;
    return `  ${label}: ${url}`;
  }).join('\n') || '  No download links available'}`;
  }

  /**
   * Format search results for terminal display
   */
  formatSearchResults(response: GutendxResponse, query?: string): string {
    if (response.results.length === 0) {
      return query ? `No books found matching "${query}".` : 'No books found.';
    }

    const header = query 
      ? `Found ${response.count} books matching "${query}" (showing first ${response.results.length}):`
      : `Found ${response.count} books (showing first ${response.results.length}):`;

    const books = response.results.map((book, index) => {
      const authors = book.authors.map(a => a.name).join(', ') || 'Unknown';
      const langs = book.languages.map(l => l.toUpperCase()).join(',');
      
      return `${index + 1}. [${book.id}] ${book.title}
   Author(s): ${authors}
   Downloads: ${book.download_count.toLocaleString()} | Lang: ${langs}`;
    }).join('\n\n');

    const footer = response.count > response.results.length 
      ? `\nShowing ${response.results.length} of ${response.count} results. Use 'book-info <id>' for details.`
      : `\nUse 'book-info <id>' for details and download links.`;

    return `${header}\n\n${books}${footer}`;
  }
}

export const gutendxService = GutendxService.getInstance();