/**
 * @file Graceful shutdown handler.
 * Listens for OS signals (SIGTERM, SIGINT) and uncaught errors, cleanly closes
 * the HTTP server, destroys rate-limiters, and exits.
 */

import type { Server } from "node:http";
import { logger } from "./logger.ts";
import { destroyRateLimiters } from "./rate-limit.ts";
import { closeDatabase } from "./db.ts";

/** Options for customising the graceful-shutdown behaviour. */
interface ShutdownOptions {
  timeout: number;
  onShutdownStart?: () => void;
  onShutdownComplete?: () => void;
  onShutdownError?: (error: Error) => void;
}

const DEFAULT_SHUTDOWN_OPTIONS: ShutdownOptions = {
  timeout: 10000, // 10 seconds
};

class GracefulShutdown {
  private server: Server | null = null;
  private isShuttingDown = false;
  private options: ShutdownOptions;

  constructor(options: ShutdownOptions = DEFAULT_SHUTDOWN_OPTIONS) {
    this.options = { ...DEFAULT_SHUTDOWN_OPTIONS, ...options };
  }

  register(server: Server) {
    this.server = server;

    // Handle SIGTERM (most common in production)
    process.on("SIGTERM", () => this.shutdown("SIGTERM"));

    // Handle SIGINT (Ctrl+C)
    process.on("SIGINT", () => this.shutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error: Error) => {
      logger.error("Uncaught exception", error);
      this.shutdown("uncaughtException", error);
    });

    // Handle unhandled rejections
    process.on("unhandledRejection", (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      logger.error("Unhandled rejection", error);
      this.shutdown("unhandledRejection", error);
    });
  }

  private async shutdown(signal: string, error?: Error) {
    if (this.isShuttingDown) {
      logger.warn("Shutdown already in progress, ignoring signal", { signal });
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    if (this.options.onShutdownStart) {
      try {
        this.options.onShutdownStart();
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        logger.error("Error in onShutdownStart callback", error);
      }
    }

    // Stop accepting new connections
    if (this.server) {
      logger.info("Closing HTTP server...");
      this.server.close((err) => {
        if (err) {
          logger.error("Error closing HTTP server", err);
          if (this.options.onShutdownError) {
            this.options.onShutdownError(err);
          }
        } else {
          logger.info("HTTP server closed successfully");
        }
      });
    }

    // Cleanup rate limiters
    try {
      destroyRateLimiters();
      logger.info("Rate limiters destroyed");
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      logger.error("Error destroying rate limiters", error);
    }

    // Close database connections
    try {
      await closeDatabase();
      logger.info("Database connections closed");
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      logger.error("Error closing database connections", error);
    }

    // Wait for in-flight requests to complete
    const shutdownTimeout = setTimeout(() => {
      logger.warn(`Shutdown timeout (${this.options.timeout}ms) reached, forcing exit`);
      process.exit(1);
    }, this.options.timeout);

    // Give time for cleanup
    setTimeout(() => {
      clearTimeout(shutdownTimeout);
      logger.info("Graceful shutdown completed");
      
      if (this.options.onShutdownComplete) {
        try {
          this.options.onShutdownComplete();
        } catch (e) {
          const error = e instanceof Error ? e : new Error(String(e));
          logger.error("Error in onShutdownComplete callback", error);
        }
      }

      process.exit(error ? 1 : 0);
    }, 1000); // Small delay to allow final logs
  }
}

// Create singleton instance
const gracefulShutdown = new GracefulShutdown();

/** Create a new `GracefulShutdown` instance, register it with the HTTP server, and wire up signal handlers. */
export const registerGracefulShutdown = (server: Server, options?: ShutdownOptions) => {
  const instance = new GracefulShutdown(options);
  instance.register(server);
  return instance;
};

export default gracefulShutdown;
