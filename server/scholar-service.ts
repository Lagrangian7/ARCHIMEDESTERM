interface SemanticScholarPaper {
  paperId: string;
  title: string;
  year: number | null;
  citationCount: number;
  influentialCitationCount: number;
  authors: Array<{
    authorId: string;
    name: string;
  }>;
  venue: string;
  publicationDate: string | null;
  abstract: string | null;
  url: string;
  openAccessPdf: { url: string } | null;
}

interface ScholarSearchResponse {
  total: number;
  offset: number;
  next: number | null;
  data: SemanticScholarPaper[];
}

class ScholarService {
  private baseUrl = 'https://api.semanticscholar.org/graph/v1';
  private rateLimit = 100; // 100 requests per 5 minutes
  
  async searchPapers(query: string, limit: number = 10, offset: number = 0): Promise<ScholarSearchResponse> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const fields = 'paperId,title,year,citationCount,influentialCitationCount,authors,venue,publicationDate,abstract,url,openAccessPdf';
      const url = `${this.baseUrl}/paper/search?query=${encodedQuery}&offset=${offset}&limit=${limit}&fields=${fields}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a few minutes.');
        }
        throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as ScholarSearchResponse;
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to search Semantic Scholar');
    }
  }
  
  async getPaperDetails(paperId: string): Promise<SemanticScholarPaper> {
    try {
      const fields = 'paperId,title,year,citationCount,influentialCitationCount,authors,venue,publicationDate,abstract,url,openAccessPdf';
      const url = `${this.baseUrl}/paper/${paperId}?fields=${fields}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as SemanticScholarPaper;
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get paper details');
    }
  }
  
  formatSearchResultsForTerminal(results: ScholarSearchResponse, query: string): string {
    if (!results.data || results.data.length === 0) {
      return `\n┌─────────────────────────────────────────────────────────────────┐
│ SEMANTIC SCHOLAR - No Results Found                            │
└─────────────────────────────────────────────────────────────────┘

No academic papers found for: "${query}"

Try different keywords or check your search terms.`;
    }
    
    const papers = results.data;
    const totalResults = results.total;
    
    let output = `\n┌─────────────────────────────────────────────────────────────────┐
│ SEMANTIC SCHOLAR - Academic Paper Search                       │
└─────────────────────────────────────────────────────────────────┘

Query: "${query}"
Found: ${totalResults.toLocaleString()} papers (showing ${papers.length})

`;
    
    papers.forEach((paper, index) => {
      const authors = paper.authors.slice(0, 3).map(a => a.name).join(', ');
      const moreAuthors = paper.authors.length > 3 ? ` +${paper.authors.length - 3} more` : '';
      const year = paper.year || 'N/A';
      const venue = paper.venue || 'Unknown';
      const citations = paper.citationCount || 0;
      const influential = paper.influentialCitationCount || 0;
      const hasOpenAccess = paper.openAccessPdf ? '📄 [OPEN ACCESS]' : '';
      
      output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${index + 1}. ${paper.title}

   Authors: ${authors}${moreAuthors}
   Year: ${year} | Venue: ${venue}
   Citations: ${citations.toLocaleString()} (${influential} influential)
   ${hasOpenAccess}
   
   URL: ${paper.url}
   
`;
    });
    
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use 'scholar details <paperId>' to get full abstract and details.
Data provided by Semantic Scholar (FREE API)`;
    
    return output;
  }
  
  formatPaperDetailsForTerminal(paper: SemanticScholarPaper): string {
    const authors = paper.authors.map(a => a.name).join(', ');
    const year = paper.year || 'N/A';
    const venue = paper.venue || 'Unknown';
    const citations = paper.citationCount || 0;
    const influential = paper.influentialCitationCount || 0;
    const pubDate = paper.publicationDate || 'N/A';
    const abstract = paper.abstract || 'No abstract available.';
    const openAccessUrl = paper.openAccessPdf?.url || 'Not available';
    
    return `\n┌─────────────────────────────────────────────────────────────────┐
│ SEMANTIC SCHOLAR - Paper Details                               │
└─────────────────────────────────────────────────────────────────┘

TITLE: ${paper.title}

AUTHORS: ${authors}

PUBLISHED: ${year} (${pubDate})
VENUE: ${venue}

CITATIONS: ${citations.toLocaleString()} total, ${influential} influential

ABSTRACT:
${this.wrapText(abstract, 65)}

LINKS:
• Semantic Scholar: ${paper.url}
• Open Access PDF: ${openAccessUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data provided by Semantic Scholar (FREE API)`;
  }
  
  private wrapText(text: string, width: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      if ((currentLine + word).length > width) {
        if (currentLine) {
          lines.push(currentLine.trim());
        }
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });
    
    if (currentLine) {
      lines.push(currentLine.trim());
    }
    
    return lines.join('\n');
  }
}

export const scholarService = new ScholarService();
