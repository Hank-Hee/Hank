import type { ApiErrorCode } from '@wison/contracts';

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: 400 | 401 | 403 | 404 | 500,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
