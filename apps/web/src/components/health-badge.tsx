import { useQuery } from '@tanstack/react-query';
import { getApiHealth } from '../lib/api-client';

export function HealthBadge() {
  const query = useQuery({
    queryKey: ['api-health'],
    queryFn: ({ signal }) => getApiHealth(signal),
    staleTime: 60_000,
  });

  if (query.isPending) return <span className="health health--loading">API 检查中</span>;
  if (query.isError) return <span className="health health--error">API 异常</span>;
  return <span className="health health--ok">API 正常</span>;
}
