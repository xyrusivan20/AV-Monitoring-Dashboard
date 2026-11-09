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
  id?: string;
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
  /** v7.3.3: tapos ang Script approval ng isang Video / Full Video Production. */
  scriptDone?: boolean;
}

const LINE_ORDER = REPORT_LINES.map((l) => l.key);
const byOrder = (xs: string[]) => xs.slice().sort((a, b) => LINE_ORDER.indexOf(a) - LINE_ORDER.indexOf(b));

export function parseReportLines(remarks: string): string[] | null {
  const m = /Report lines\s+([a-m](?:\s*,\s*[a-m])*)/i.exec(String(remarks || ''));
  if (!m) return null;
  return Array.from(new Set(m[1].toLowerCase().split(/\s*,\s*/)));
}

/**
 * Ang mga linya mula sa mismong serbisyo. v7.3.3: ang Scriptwriting (j) ay
 * binibilang kapag may naaprubahang script ang isang Video / Full Video
 * Production — dati, hindi kailanman nabibilang ang j sa bagong event.
 */
export function defaultLinesFor(services: string[], scriptDone = false): string[] {
  const out: string[] = [];
  services.forEach((s) => (DEFAULT_LINES[s.trim().toLowerCase()] || []).forEach((l) => out.includes(l) || out.push(l)));
  if (scriptDone && services.some((s) => /production/i.test(s)) && !out.includes('j')) out.push('j');
  return byOrder(out);
}

export function reportLinesOf(row: AccRow): string[] {
  const tagged = parseReportLines(row.remarks);
  if (tagged) return tagged;
  return defaultLinesFor(row.services, row.scriptDone);
}

/** Saan galing ang bilang ng event: tsek sa "Report lines", o ang mismong serbisyo. */
export function lineSource(row: AccRow): 'tag' | 'services' {
  return parseReportLines(row.remarks) ? 'tag' : 'services';
}

/**
 * Para sa may "Report lines" na tsek: ano ang hindi tugma sa naihatid na
 * serbisyo? `missing` = may serbisyo pero walang tsek (hindi nabibilang);
 * `unbacked` = may tsek pero walang serbisyong sumusuporta (hal. j sa coverage).
 * Ang c, f at g ay mas pino kaysa sa katalogo, kaya hindi sila sinisita.
 */
export function lineMismatch(row: AccRow): { missing: string[]; unbacked: string[] } {
  const tagged = parseReportLines(row.remarks);
  if (!tagged) return { missing: [], unbacked: [] };
  const has = (re: RegExp) => row.services.some((s) => re.test(s));
  const PROD_LINES = ['b', 'c', 'e', 'f', 'g', 'h', 'i'];
  const prod = has(/production|shoot/i);
  const missing: string[] = [];
  const unbacked: string[] = [];
  // Coverage at SDE: tig-iisang linya, kaya mahigpit.
  ([['a', /^photo coverage$/i], ['d', /^video coverage$/i], ['m', /^sde$/i]] as [string, RegExp][]).forEach(([l, re]) => {
    if (has(re) && !tagged.includes(l)) missing.push(l);
    if (!has(re) && tagged.includes(l)) unbacked.push(l);
  });
  // Livestream: ang k at l ay puwedeng isa lang — basta may isa.
  if (has(/livestream/i) && !tagged.includes('k') && !tagged.includes('l')) missing.push('k', 'l');
  // Production: ang tsek ay mas pino kaysa sa katalogo (b/c, e/f/g/h/i) — basta may isa.
  if (prod && !tagged.some((l) => PROD_LINES.includes(l))) {
    defaultLinesFor(row.services).filter((l) => PROD_LINES.includes(l)).forEach((l) => missing.push(l));
  }
  if (!prod) tagged.filter((l) => PROD_LINES.includes(l) || l === 'j').forEach((l) => unbacked.push(l));
  return { missing: byOrder(missing), unbacked: byOrder(unbacked) };
}

/** Isinusulat muli ang "Report lines …" sa remarks (o tinatanggal kapag wala nang laman). */
export function withReportLines(remarks: string, lines: string[] | null): string {
  const base = String(remarks || '')
    .replace(/Report lines\s+[a-m](?:\s*,\s*[a-m])*/gi, '')
    .split(/\s*·\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' · ');
  if (!lines || !lines.length) return base;
  return `${base ? `${base} · ` : ''}Report lines ${byOrder(lines).join(', ')}`;
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
