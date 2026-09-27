import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthTokenPayload } from '@nexusrtc/core';
import { ServerConfig } from '../config/index.js';

export interface AuthenticatedRequest extends Request {
  participant?: AuthTokenPayload;
}

export function apiKeyMiddleware(config: ServerConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!apiKey || apiKey !== config.apiKey) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
      return;
    }
    next();
  };
}

export function jwtMiddleware(config: ServerConfig) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
      return;
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
      req.participant = decoded;
      next();
    } catch (err: unknown) {
      res.status(401).json({ error: 'Unauthorized: Invalid token signature or expired' });
    }
  };
}
