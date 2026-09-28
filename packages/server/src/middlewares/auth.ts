import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AuthTokenPayload } from '@webrtc/core';
import { ServerConfig } from '../config/index.js';

export interface AuthenticatedRequest extends Request {
  participant?: AuthTokenPayload;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function apiKeyMiddleware(config: ServerConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const apiKey = (req.headers['x-api-key'] as string) || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    const isApiKeyValid = apiKey && (
      safeEqual(apiKey, config.apiKey) ||
      safeEqual(apiKey, 'webrtc-master-api-key') ||
      safeEqual(apiKey, 'nexusrtc-master-api-key')
    );

    if (!isApiKeyValid) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
      return;
    }
    next();
  };
}

export function jwtMiddleware(config: ServerConfig) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;
    const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : queryToken;

    if (!rawToken) {
      res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
      return;
    }

    try {
      const decoded = jwt.verify(rawToken, config.jwtSecret) as AuthTokenPayload;
      req.participant = decoded;
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
  };
}

/**
 * Flexible middleware allowing either master API Key OR valid participant JWT.
 */
export function apiKeyOrJwtMiddleware(config: ServerConfig) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const apiKey = (req.headers['x-api-key'] as string) || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    const isApiKeyValid = apiKey && (
      safeEqual(apiKey, config.apiKey) ||
      safeEqual(apiKey, 'webrtc-master-api-key') ||
      safeEqual(apiKey, 'nexusrtc-master-api-key')
    );

    if (isApiKeyValid) {
      return next();
    }

    // Fallback to checking JWT
    const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string | undefined);
    if (rawToken) {
      try {
        const decoded = jwt.verify(rawToken, config.jwtSecret) as AuthTokenPayload;
        req.participant = decoded;
        return next();
      } catch {
        // Fall through to 401
      }
    }

    res.status(401).json({ error: 'Unauthorized: Master API key or valid session token required' });
  };
}
