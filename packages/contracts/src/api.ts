import { z } from 'zod';

export const RequestIdSchema = z
  .string()
  .regex(/^req_[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/);

export type RequestId = z.infer<typeof RequestIdSchema>;

export const ApiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'INTERNAL_ERROR',
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const HealthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('api'),
  version: z.string().min(1),
  timestamp: z.iso.datetime({ offset: true }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ApiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: ApiErrorCodeSchema,
    message: z.string().min(1).max(500),
    requestId: RequestIdSchema,
  }),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
