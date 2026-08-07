import reportTitles from '../../../../data/report-title-en.json';

const titles = reportTitles as Record<string, string>;

export function englishReportTitle(id: string, fallback: string | null | undefined) {
  return titles[id] ?? fallback ?? null;
}
