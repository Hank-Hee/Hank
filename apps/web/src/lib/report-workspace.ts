import type { ReportSummary } from '@wison/contracts';
import { useCallback, useEffect, useState } from 'react';

const storageKey = 'wison-report-workspace-v1';
const changeEvent = 'wison-report-workspace-change';
const maximumRecentReports = 10;

export type ReportBookmark = ReportSummary;

type ReportWorkspace = {
  schemaVersion: 1;
  favorites: ReportBookmark[];
  recent: ReportBookmark[];
};

const emptyWorkspace: ReportWorkspace = { schemaVersion: 1, favorites: [], recent: [] };

export function useReportWorkspace() {
  const [workspace, setWorkspace] = useState(readReportWorkspace);
  useEffect(() => {
    const refresh = () => setWorkspace(readReportWorkspace());
    window.addEventListener(changeEvent, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(changeEvent, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const recordRecent = useCallback((report: ReportSummary) => {
    const current = readReportWorkspace();
    writeReportWorkspace({
      ...current,
      recent: [toBookmark(report), ...current.recent.filter(({ id }) => id !== report.id)]
        .slice(0, maximumRecentReports),
    });
  }, []);

  const toggleFavorite = useCallback((report: ReportSummary) => {
    const current = readReportWorkspace();
    const exists = current.favorites.some(({ id }) => id === report.id);
    writeReportWorkspace({
      ...current,
      favorites: exists
        ? current.favorites.filter(({ id }) => id !== report.id)
        : [toBookmark(report), ...current.favorites.filter(({ id }) => id !== report.id)],
    });
  }, []);

  return {
    favorites: workspace.favorites,
    recent: workspace.recent,
    isFavorite: (reportId: string) => workspace.favorites.some(({ id }) => id === reportId),
    recordRecent,
    toggleFavorite,
  };
}

function readReportWorkspace(): ReportWorkspace {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Partial<ReportWorkspace> | null;
    if (parsed?.schemaVersion !== 1) return emptyWorkspace;
    return {
      schemaVersion: 1,
      favorites: sanitizeReports(parsed.favorites),
      recent: sanitizeReports(parsed.recent).slice(0, maximumRecentReports),
    };
  } catch {
    return emptyWorkspace;
  }
}

function sanitizeReports(value: unknown): ReportBookmark[] {
  if (!Array.isArray(value)) return [];
  return value.filter((report): report is ReportBookmark => (
    typeof report === 'object' && report !== null
    && typeof (report as ReportBookmark).id === 'string'
    && typeof (report as ReportBookmark).title === 'string'
  ));
}

function toBookmark(report: ReportSummary): ReportBookmark {
  return {
    id: report.id,
    title: report.title,
    subtitle: report.subtitle,
    summary: report.summary,
    industry: report.industry,
    region: report.region,
    informationType: report.informationType,
    sourceFamily: report.sourceFamily,
    publisher: report.publisher,
    publishedOn: report.publishedOn,
    language: report.language,
    sourceFormat: report.sourceFormat,
    attachmentAvailable: report.attachmentAvailable,
    attachmentCount: report.attachmentCount,
    coverUrl: report.coverUrl,
    keywords: report.keywords,
    relatedCompanies: report.relatedCompanies,
    detailStatus: report.detailStatus,
  };
}

function writeReportWorkspace(workspace: ReportWorkspace) {
  localStorage.setItem(storageKey, JSON.stringify(workspace));
  window.dispatchEvent(new Event(changeEvent));
}
