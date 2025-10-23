import axios from 'axios';

const WOLFRAM_API_BASE = 'https://api.wolframalpha.com/v2/query';
const APP_ID = process.env.WOLFRAM_ALPHA_APP_ID;

export interface WolframResult {
  success: boolean;
  error?: string;
  pods?: Array<{
    title: string;
    plaintext: string;
    subpods: Array<{
      plaintext: string;
      title?: string;
      img?: {
        src: string;
        alt: string;
        title: string;
        width: number;
        height: number;
      };
      mathml?: string;
      latex?: string;
    }>;
  }>;
}

export interface WolframOptions {
  latlong?: string;  // e.g., "40.7128,-74.0060"
  units?: 'metric' | 'nonmetric';
  assumption?: string;
  location?: string;  // IP address
}

export async function queryWolfram(input: string, options?: WolframOptions): Promise<WolframResult> {
  if (!APP_ID) {
    return {
      success: false,
      error: 'Wolfram Alpha API key not configured'
    };
  }

  try {
    const params: any = {
      appid: APP_ID,
      input: input,
      format: 'plaintext,image,mathml,latex',
      output: 'json'
    };

    // Add optional parameters if provided
    if (options?.latlong) {
      params.latlong = options.latlong;
    }
    if (options?.units) {
      params.units = options.units;
    }
    if (options?.assumption) {
      params.assumption = options.assumption;
    }
    if (options?.location) {
      params.location = options.location;
    }

    const response = await axios.get(WOLFRAM_API_BASE, {
      params,
      timeout: 10000
    });

    const data = response.data;

    if (!data.queryresult || data.queryresult.error === 'true') {
      return {
        success: false,
        error: data.queryresult?.error || 'Query failed'
      };
    }

    if (data.queryresult.success === 'false') {
      return {
        success: false,
        error: 'No results found'
      };
    }

    const pods = data.queryresult.pods?.map((pod: any) => ({
      title: pod.title,
      plaintext: pod.subpods?.[0]?.plaintext || '',
      subpods: pod.subpods?.map((subpod: any) => {
        const result: any = {
          plaintext: subpod.plaintext || '',
          title: subpod.title
        };
        
        // Add image if available
        if (subpod.img) {
          result.img = {
            src: subpod.img.src,
            alt: subpod.img.alt || subpod.title || pod.title,
            title: subpod.img.title || subpod.title || pod.title,
            width: parseInt(subpod.img.width) || 0,
            height: parseInt(subpod.img.height) || 0
          };
        }
        
        // Add MathML if available
        if (subpod.mathml) {
          result.mathml = subpod.mathml;
        }
        
        // Add LaTeX if available (some APIs provide this)
        if (subpod.latex) {
          result.latex = subpod.latex;
        }
        
        return result;
      }) || []
    })) || [];

    return {
      success: true,
      pods
    };

  } catch (error: any) {
    console.error('Wolfram Alpha API error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to query Wolfram Alpha'
    };
  }
}
