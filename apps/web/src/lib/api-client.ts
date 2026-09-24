import { HealthResponseSchema, type HealthResponse } from '@wison/contracts';

export async function getApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/v1/health', {
    headers: { accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  return HealthResponseSchema.parse(await response.json());
}
