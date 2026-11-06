/**
 * Accomplishments — ang buwanang AV report, binibilang kapareho ng Excel
 * (BASIS_FOR_NEXUS.xlsx): isang tsek bawat report line (a–m) bawat event.
 *
 * Purong helpers lamang. Hindi ito nag-i-import mula sa App.tsx; ang App ang
 * nagpapasa ng plain rows, kaya walang nagbabago sa umiiral na lohika.
 */

export const REPORT_LINES: { key: string; label: string }[] = [
  { key: 'a', label: 'Photo coverage' },
  { key: 'b', label: 'Photo shoot (raw photos)' },
  { key: 'c', label: 'Photo shoot production' },
  { key: 'd', label: 'Video coverage' },
  { key: 'e', label: 'Video shoot' },
  { key: 'f', label: 'Video reproduction (raw)' },
  { key: 'g', label: 'Video editing (clean-cut)' },
  { key: 'h', label: 'Video production (AVP)' },
  { key: 'i', label: 'Video full production' },
  { key: 'j', label: 'Scriptwriting' },
  { key: 'k', label: 'Technical setup (CCTV)' },
  { key: 'l', label: 'Technical assistance (audio/video)' },
  { key: 'm', label: 'Same-day edit (SDE)' },
];

/** Workbook `Summary`, columns C (2026 targets) and D (2025 accomplishments). */
export const TARGETS_2026 = [16, 17, 17, 24, 17, 17, 16, 17, 17, 16, 17, 17];
export const ACTUAL_2025 = [25, 16, 25, 15, 20, 15, 23, 22, 21, 37, 15, 20];

/** Para sa bagong event na walang "Report lines" tag: mula sa naibigay na PM services. */
const DEFAULT_LINES: Record<string, string[]> = {
  'photo coverage': ['a'],
  'photo shoot': ['b'],
  'video coverage': ['d'],
  'video shoot': ['e'],
  'video production': ['h'],
  'full video production': ['i'],
  // 29 sa 30 livestream na event noong 2026 ay may tsek sa k at l.
  'livestreaming with multi-camera setup': ['k', 'l'],
  sde: ['m'],
};

export interface AccRow {
  title?: string;
  client?: string;
  end?: Date | null;
  date: Date | null;
  remarks: string;
  delivered: boolean;
  /** deliveredServicesOf(ev) */
  services: string[];
  /** ApprovalKey */
  approval: string;
}

export function parseReportLines(remarks: string): string[] | null {
  const m = /Report lines\s+([a-m](?:\s*,\s*[a-m])*)/i.exec(String(remarks || ''));
  if (!m) return null;
  return Array.from(new Set(m[1].toLowerCase().split(/\s*,\s*/)));
}

export function reportLinesOf(row: AccRow): string[] {
  const tagged = parseReportLines(row.remarks);
  if (tagged) return tagged;
  const out: string[] = [];
  row.services.forEach((s) => (DEFAULT_LINES[s.trim().toLowerCase()] || []).forEach((l) => out.includes(l) || out.push(l)));
  return out;
}

export interface MonthlyReport {
  year: number;
  lines: Record<string, number[]>;
  delivered: number[];
  requests: number[];
  served: number[];
  declined: number[];
  excluded: number[];
}

export function monthlyReport(rows: AccRow[], year: number): MonthlyReport {
  const z = () => Array(12).fill(0) as number[];
  const lines: Record<string, number[]> = {};
  REPORT_LINES.forEach((l) => (lines[l.key] = z()));
  const out: MonthlyReport = { year, lines, delivered: z(), requests: z(), served: z(), declined: z(), excluded: z() };
  rows.forEach((r) => {
    if (!r.date || r.date.getFullYear() !== year) return;
    const m = r.date.getMonth();
    out.requests[m] += 1;
    if (r.approval === 'declined') out.declined[m] += 1;
    if (r.approval === 'cancelled' || r.approval === 'rescheduled') out.excluded[m] += 1;
    if (!r.delivered) return;
    out.served[m] += 1;
    reportLinesOf(r).forEach((k) => {
      if (lines[k]) {
        lines[k][m] += 1;
        out.delivered[m] += 1;
      }
    });
  });
  return out;
}

export const sum = (xs: number[], upto = xs.length) => xs.slice(0, upto).reduce((a, b) => a + b, 0);
