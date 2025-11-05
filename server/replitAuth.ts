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

  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  try {
    const PostgresStore = connectPg(session);
    
    const store = new PostgresStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      tableName: 'sessions',
      createTableIfMissing: true,
      ttl: sessionTtl / 1000, // PostgreSQL store expects TTL in seconds
      pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
    });
    
    store.on('error', (err) => {
      console.error('Session store error:', err);
      // Don't crash on session store errors
    });
    
    sessionMiddleware = session({
      store,
      secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
      resave: true, // Save session on every request to extend expiration
      saveUninitialized: false, // Don't create session until something stored
      rolling: true, // Reset expiration on every response
      cookie: {
        httpOnly: true,
        secure: false, // Set to false for Replit environment
        maxAge: sessionTtl,
        sameSite: 'lax',
        path: '/',
      },
    });
    
    return sessionMiddleware;
  } catch (error) {
    console.error('Failed to initialize session store:', error);
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
    // Always use the actual Replit domain for authentication, not localhost
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || req.hostname;
    passport.authenticate(`replitauth:${domain}`, {
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Always use the actual Replit domain for authentication, not localhost
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || req.hostname;
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
  
  if (now <= user.expires_at && !shouldRefresh) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    
    // Ensure session is saved after token refresh
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
    });
    
    return next();
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};