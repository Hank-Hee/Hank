import { useQuery } from '@tanstack/react-query';
import { getApiHealth } from '../lib/api-client';
import { useI18n } from '../i18n';

export function HealthBadge() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ['api-health'],
    queryFn: ({ signal }) => getApiHealth(signal),
    staleTime: 60_000,
  });

  if (query.isPending) return <span className="health health--loading">{t('API 检查中')}</span>;
  if (query.isError) return <span className="health health--error">{t('API 异常')}</span>;
  return <span className="health health--ok">{t('API 正常')}</span>;
}
