import { Request, Response, NextFunction } from 'express';
import { logger } from '../../../utils/logger';

export function errorMiddleware(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(err.status || err.statusCode || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  });
}
