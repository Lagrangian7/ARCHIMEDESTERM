import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

// Lazy session store initialization to avoid blocking startup
let sessionMiddleware: any = null;

export function getSession() {
  if (sessionMiddleware) {
    return sessionMiddleware;
  }

  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  try {
    // Check if DATABASE_URL is available
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️  DATABASE_URL not set - using memory store for sessions');
      throw new Error('DATABASE_URL not configured');
    }

    const PostgresStore = connectPg(session);
    
    const store = new PostgresStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      tableName: 'sessions',
      createTableIfMissing: true,
      ttl: sessionTtl / 1000,
      pruneSessionInterval: 60 * 60,
    });
    
    store.on('error', (err) => {
      console.error('Session store error:', err);
    });
    
    sessionMiddleware = session({
      store,
      secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: false,
        maxAge: sessionTtl,
        sameSite: 'lax',
        path: '/',
      },
      name: 'archimedes.sid',
    });
    
    console.log('✅ PostgreSQL session store initialized');
    return sessionMiddleware;
  } catch (error) {
    console.error('Failed to initialize PostgreSQL session store:', error);
    console.log('📝 Using memory store (sessions will not persist across restarts)');
    // Fallback to memory store if database connection fails
    sessionMiddleware = session({
      secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
      resave: true,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: false,
        maxAge: sessionTtl,
        sameSite: 'lax',
        path: '/',
      },
    });
    return sessionMiddleware;
  }
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  // Check for REPLIT_DOMAINS but don't throw - allow server to start
  if (!process.env.REPLIT_DOMAINS) {
    console.warn('Warning: REPLIT_DOMAINS environment variable not set. Authentication will not work.');
    console.warn('Please set REPLIT_DOMAINS in your deployment secrets.');
    // Return early to allow server to start without auth
    return;
  }

  let config: any = null;

  try {
    app.set("trust proxy", true);
    app.use(getSession());
    app.use(passport.initialize());
    app.use(passport.session());

    config = await getOidcConfig();

    const verify: VerifyFunction = async (
      tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
      verified: passport.AuthenticateCallback
    ) => {
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(tokens.claims());
      verified(null, user);
    };

    // Register authentication strategies for all Replit domains
    const domains = process.env.REPLIT_DOMAINS.split(",");
    
    for (const domain of domains) {
      const strategy = new Strategy(
        {
          name: `replitauth:${domain}`,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
    }
  } catch (error) {
    console.error('Failed to setup authentication:', error);
    console.warn('Server will continue without authentication');
    // Don't throw - allow server to start
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Use the domain the user is actually on to keep them on their custom domain
    const domains = process.env.REPLIT_DOMAINS?.split(",") || [];
    const currentHost = req.hostname;
    
    // Find matching domain from registered domains, or use the current hostname
    const domain = domains.find(d => d === currentHost) || domains[0] || currentHost;
    
    // Store the original domain in session so callback can redirect back to it
    (req.session as any).loginDomain = currentHost;
    
    passport.authenticate(`replitauth:${domain}`, {
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Use the domain the user started login from (stored in session)
    const domains = process.env.REPLIT_DOMAINS?.split(",") || [];
    const loginDomain = (req.session as any).loginDomain || req.hostname;
    
    // Find matching domain from registered domains
    const domain = domains.find(d => d === loginDomain) || domains[0] || req.hostname;
    
    passport.authenticate(`replitauth:${domain}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", async (req, res) => {
    try {
      const logoutConfig = config || await getOidcConfig();
      req.logout(() => {
        res.redirect(
          client.buildEndSessionUrl(logoutConfig, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.redirect('/');
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  // Refresh token proactively if it will expire in the next 30 minutes
  const shouldRefresh = user.expires_at - now < 1800;
  
  // Token is still valid and doesn't need refresh yet
  if (now <= user.expires_at && !shouldRefresh) {
    return next();
  }

  // Token needs refresh - check if we have a refresh token
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    // No refresh token but access token might still be valid
    if (now <= user.expires_at) {
      console.warn('No refresh token available, but access token still valid');
      return next();
    }
    console.warn('No refresh token available and access token expired');
    return res.status(401).json({ message: "Unauthorized", shouldReauth: true });
  }

  // Attempt token refresh with retry logic
  let retryCount = 0;
  const maxRetries = 3; // Increased from 2 to 3
  
  while (retryCount <= maxRetries) {
    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
      
      // Mark session as modified and save to ensure persistence
      req.session.touch();
      
      return new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            // Don't reject - the token was refreshed successfully, just session save failed
            // Continue anyway to prevent unnecessary logouts
            console.warn('Session save failed but continuing with refreshed token');
            resolve(next());
          } else {
            console.log('✅ Token refreshed successfully');
            resolve(next());
          }
        });
      });
    } catch (error: any) {
      retryCount++;
      
      // Categorize error types
      const isNetworkError = error.code === 'ECONNREFUSED' || 
                             error.code === 'ETIMEDOUT' || 
                             error.code === 'ENOTFOUND' ||
                             error.message?.includes('fetch failed');
      
      const isInvalidGrant = error.message?.includes('invalid_grant') ||
                             error.cause?.error === 'invalid_grant';
      
      // Log detailed error information
      if (error.code === 'OAUTH_RESPONSE_BODY_ERROR') {
        console.error(`❌ OAuth token refresh failed (attempt ${retryCount}/${maxRetries + 1}):`, {
          code: error.code,
          message: error.message,
          cause: error.cause
        });
      } else {
        console.error(`❌ Token refresh error (attempt ${retryCount}/${maxRetries + 1}):`, error.message);
      }
      
      // For invalid_grant errors (refresh token expired/revoked), logout immediately
      if (isInvalidGrant) {
        console.error('🔒 Refresh token invalid/expired, forcing logout');
        req.logout(() => {
          res.status(401).json({ 
            message: "Session expired. Please log in again.",
            shouldReauth: true 
          });
        });
        return;
      }
      
      // For network errors, be more lenient - allow more retries
      if (isNetworkError && retryCount <= maxRetries) {
        console.warn(`⚠️ Network error during token refresh, will retry (${retryCount}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1))); // Exponential backoff
        continue;
      }
      
      // If max retries exceeded for non-network errors
      if (retryCount > maxRetries) {
        // For network errors, don't force logout - the token might still be valid
        if (isNetworkError && now <= user.expires_at) {
          console.warn('⚠️ Token refresh failed due to network, but access token still valid - continuing');
          return next();
        }
        
        console.error('🔒 Max token refresh retries exceeded, forcing logout');
        req.logout(() => {
          res.status(401).json({ 
            message: "Session expired. Please log in again.",
            shouldReauth: true 
          });
        });
        return;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
    }
  }
};