import axios from 'axios';

const WOLFRAM_API_BASE = 'http://api.wolframalpha.com/v2/query';
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
    }>;
  }>;
}

export async function queryWolfram(input: string): Promise<WolframResult> {
  if (!APP_ID) {
    return {
      success: false,
      error: 'Wolfram Alpha API key not configured'
    };
  }

  try {
    const response = await axios.get(WOLFRAM_API_BASE, {
      params: {
        appid: APP_ID,
        input: input,
        format: 'plaintext',
        output: 'json'
      },
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
      subpods: pod.subpods?.map((subpod: any) => ({
        plaintext: subpod.plaintext || '',
        title: subpod.title
      })) || []
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
