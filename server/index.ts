import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Enable gzip compression for all responses
app.use(compression());

app.use(express.json({ limit: '1mb' })); // Add size limit
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use((req, res, next) => {
  // Only log in development and only for API routes
  if (app.get("env") === "development" && req.path.startsWith("/api")) {
    const start = Date.now();
    
    res.on("finish", () => {
      const duration = Date.now() - start;
      // Only log slow requests or errors
      if (duration > 100 || res.statusCode >= 400) {
        log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
      }
    });
  }

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`🚀 ARCHIMEDES Terminal serving on port ${port}`);
    log(`🌐 Access at: http://0.0.0.0:${port}`);
  }).on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      log(`❌ Port ${port} is already in use`);
      process.exit(1);
    } else {
      throw err;
    }
  });
})();
