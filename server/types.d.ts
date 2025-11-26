declare global {
  namespace Express {
    interface User {
      claims?: {
        sub: string;
        name?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        profile_image_url?: string;
        exp?: number;
        [key: string]: any;
      };
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
    }
  }
}

export {};
