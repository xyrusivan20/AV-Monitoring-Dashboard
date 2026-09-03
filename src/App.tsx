import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

/* ============================================================================
   AV NEXUS — Broadcast & Digital Media Section (DOST-STII)
   Master Control Room for coverage, DMC monitoring, and AV systems.
   ========================================================================== */

interface Coverage {
  id: string;
  details: string;
  personnel: string;
  gdrive: string;
  socialMediaLink: string;
  status: string;
  date: string;
  dateObj: Date | null;
}

type StatusKey = 'pending' | 'upcoming' | 'checked' | 'transferred' | 'archived';

interface SystemApp {
  id: string;
  name: string;
  role: string;
  url: string;
  tag: string;
  accent: string;
  glyph: string;
  embeddable: boolean;
  points: string[];
}

/* ---------------------------------------------------------------- CONFIG -- */

const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxsDu-1jDqDyowhT6DX0NNYBP8pFy5e3oyn3QVsEPBK3soo4njMBbGhtnttvm-YCeIBwA/exec';

/**
 * BAGONG production backend — HIWALAY na spreadsheet, hiwalay na script.
 * Ilagay dito ang /exec URL mula sa ProductionLog.gs deployment.
 * Hangga't placeholder ito, setup card lang ang ipapakita ng Production Board.
 */
const PROD_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxeTNINrKnTjQfdJ9RPVyYGUYgAGIlT2aOVuGxxPwocEXyR6sfiFR_amTV7LOydBRcEQ/exec';
const PROD_CONFIGURED = PROD_SCRIPT_URL.startsWith('https://script.google.com/');

/**
 * Google Sign-In. Ilagay ang parehong Client ID na nasa AVNexus.gs.
 * Habang blangko ito, tumatakbo ang dashboard sa attribution mode —
 * naitatala kung sino ang gumawa, pero walang pinipigilan.
 *
 * Kunin ito sa console.cloud.google.com → APIs & Services → Credentials
 * → OAuth client ID → Web application, at idagdag ang URL ng dashboard
 * sa "Authorized JavaScript origins".
 */
const GOOGLE_CLIENT_ID = '889974466807-eqlg343alp3vr8vtt8c9le3mql1kt3u7.apps.googleusercontent.com';
const AUTH_ENABLED = GOOGLE_CLIENT_ID.length > 0;

/**
 * Ang session na binibigay ng backend pagkatapos ng isang matagumpay na
 * Google sign-in. Ito ang ginagamit sa bawat pagsulat — hindi na ang
 * Google ID token, na isang oras lang ang buhay at hindi kayang i-refresh
 * nang tahimik ng browser.
 */
interface StoredSession {
  token: string;
  email: string;
  name: string;
  role: string;
  expiresAt: number;
}

const SESSION_KEY = 'avnexus.session';

function loadSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (!s?.token || !s.expiresAt || s.expiresAt < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

function saveSession(s: StoredSession | null) {
  try {
    if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode — the session lasts for this tab only */
  }
}

interface SignedInUser {
  email: string;
  name: string;
  picture: string;
  idToken: string;
  expiresAt: number;
}

/** Binabasa ang payload ng JWT para sa pangalan at larawan lamang. */
function readIdToken(jwt: string): { email: string; name: string; picture: string; exp: number } | null {
  try {
    const part = jwt.split('.')[1];
    const json = decodeURIComponent(
      atob(part.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const p = JSON.parse(json);
    return {
      email: String(p.email || ''),
      name: String(p.name || p.email || ''),
      picture: String(p.picture || ''),
      exp: Number(p.exp || 0),
    };
  } catch {
    return null;
  }
}

const PRE_ARCHIVAL_LINK =
  'https://docs.google.com/spreadsheets/d/1Q2H3AelKocMLImvjkXpy9j1z89qWYYok0-BPj68QPCE/edit?gid=0#gid=0';
const DMC_MONITORING_LINK =
  'https://docs.google.com/spreadsheets/d/1DmfloCwW90g5Rru4-l1N5DSbqyLGbga6OkklX_w1Skc/edit?gid=32561347#gid=32561347';

const CAL_EMBED =
  'https://calendar.google.com/calendar/embed?src=av%40stii.dost.gov.ph&ctz=Asia%2FSingapore';

const CYAN = '#00aeef';

const SYSTEMS: SystemApp[] = [
  {
    id: 'gatepass',
    name: 'Equipment Gate Pass',
    role: 'Releasing & inventory control',
    url: 'https://bdms-gpass.vercel.app',
    tag: 'OPERATIONS',
    accent: CYAN,
    glyph: 'GP',
    embeddable: true,
    points: ['QR labels per asset', 'Lifespan tracking', 'AV / DOSTv separation'],
  },
  {
    id: 'portfolio',
    name: 'AV Team Services',
    role: 'Public capability page',
    url: 'https://bdms-av-portfolio.vercel.app',
    tag: 'PUBLIC FACING',
    accent: '#ef4444',
    glyph: 'AV',
    embeddable: true,
    points: ['Service catalogue', 'Camera & lens kit', 'Showreel embeds'],
  },
  {
    id: 'tasking',
    name: 'Tasking System',
    role: 'Field assignment log',
    url: 'https://www.appsheet.com/start/013e44a8-f18a-49f5-98b6-b28f027dd3b7?platform=desktop#appName=DMCUploadingMonitoringBackend-264496452&vss=H4sIAAAAAAAAA6XOsQrCMBQF0F-RO-cLsok4iNhF6WIcYvMKwTYpJtWWkH_3VS3O6pgbzn034Wbpvo-6ukAe0-e1pRESSeEwdqQgFVbexatvFIRCodtXuCwXBQ19UMjIJzH7SAEyfcflf9cFrCEXbW3pOnVNkjvejr8nxcFskAXaPupzQ8_BbHLmrPZVH8iUPOWHCWHj1kOnndl5w5W1bgLlB_LM-uFlAQAA&view=AV%20Nexus',
    tag: 'APPSHEET',
    accent: '#f59e0b',
    glyph: 'TS',
    embeddable: false,
    points: ['Assignment queue', 'Mobile field capture', 'Feeds this dashboard'],
  },
];

const TEAM = [
  { name: 'Xyrus', image: '/AVNXT-2.jpg' },
  { name: 'Marx', image: '/AVNXT-3.jpg' },
  { name: 'Reiner', image: '/AVNXT-4.jpg' },
  { name: 'Pat', image: '/AVNXT.jpg' },
];

const OFFICIAL: Record<string, { fullName: string; designation: string }> = {
  Xyrus: { fullName: 'Xyrus Ivan B. De Gracia', designation: 'Audio Visual Aides Technician IV' },
  Marx: { fullName: 'Marx Lenin G. Halili', designation: 'Science Research Specialist II' },
  Reiner: { fullName: 'Reiner M. Zagada', designation: 'Audio Visual Aides Technician III' },
  Pat: { fullName: 'Patrick James Lee C. Alfonso', designation: 'Photographer II' },
  Lotus: { fullName: 'Ma. Lotuslei P. Dimagiba', designation: 'Supervising SRS' },
};

const STATUS_META: Record<
  StatusKey,
  { label: string; icon: string; chip: string; hex: string }
> = {
  pending: {
    label: 'PENDING',
    icon: '',
    chip: 'bg-zinc-800/80 text-zinc-300 border-zinc-700',
    hex: '#a1a1aa',
  },
  upcoming: {
    label: 'UPCOMING',
    icon: '',
    chip: 'bg-red-500/10 text-red-400 border-red-500/30',
    hex: '#ef4444',
  },
  checked: {
    label: 'CHECKED',
    icon: '',
    chip: 'bg-[#00aeef]/10 text-[#00aeef] border-[#00aeef]/30',
    hex: '#0e7fae',
  },
  transferred: {
    label: 'DMC TRANSFERRED',
    icon: '',
    chip: 'bg-[#00aeef]/10 text-[#00aeef] border-[#00aeef]/30',
    hex: '#00aeef',
  },
  archived: {
    label: 'ARCHIVED',
    icon: '',
    chip: 'bg-zinc-900/80 text-zinc-400 border-zinc-800',
    hex: '#52525b',
  },
};

const STATUS_ORDER: StatusKey[] = ['upcoming', 'pending', 'checked', 'transferred', 'archived'];

/* ---------------------------------------------------- PRODUCTION STREAM -- */

type StageKey = 'assigned' | 'shooting' | 'editing' | 'review' | 'approved' | 'published';

interface Output {
  id: string;
  event: string;
  title: string;
  type: string;
  runtime: string;
  seconds: number;
  personnel: string;
  role: string;
  requestedBy: string;
  stage: StageKey;
  stageRaw: string;
  platform: string;
  link: string;
  revisions: number;
  remarks: string;
  assigned: Date | null;
  target: Date | null;
  delivered: Date | null;
}

const STAGE_ORDER: StageKey[] = ['assigned', 'shooting', 'editing', 'review', 'approved', 'published'];

const STAGE_META: Record<StageKey, { label: string; short: string; hex: string; chip: string }> = {
  assigned: {
    label: 'Assigned',
    short: 'QUEUE',
    hex: '#71717a',
    chip: 'bg-zinc-800/80 text-zinc-300 border-zinc-700',
  },
  shooting: {
    label: 'Shooting',
    short: 'FIELD',
    hex: '#ef4444',
    chip: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
  editing: {
    label: 'Editing',
    short: 'POST',
    hex: '#f59e0b',
    chip: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  review: {
    label: 'For Review',
    short: 'REVIEW',
    hex: '#a855f7',
    chip: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  },
  approved: {
    label: 'Approved',
    short: 'CLEARED',
    hex: '#00aeef',
    chip: 'bg-[#00aeef]/10 text-[#00aeef] border-[#00aeef]/30',
  },
  published: {
    label: 'Published',
    short: 'ON AIR',
    hex: '#22c55e',
    chip: 'bg-green-500/10 text-green-400 border-green-500/30',
  },
};

const OUTPUT_TYPES = [
  'Event Recap', 'Reel / Short', 'Documentary', 'AVP', 'Livestream',
  'Motion Graphics', 'Interview / Soundbite', 'Teaser', 'Photo Set', 'Others',
];
const OUTPUT_ROLES = [
  'Shooter / Cam Op', 'Editor', 'Colorist', 'Motion Artist',
  'Audio', 'Livestream Tech', 'Director / DP', 'Script / Storyboard',
];
const OUTPUT_PLATFORMS = ['Facebook', 'YouTube', 'DOSTv', 'Event Loop', 'Internal', 'TikTok', 'Website'];

/* --------------------------------------------------------------- HELPERS -- */

function classifyStatus(raw: string): StatusKey {
  const s = (raw || '').toLowerCase();
  if (s.includes('not yet') || s.includes('not transferred')) return 'pending';
  if (s.includes('100% archived')) return 'archived';
  if (s.includes('upcoming')) return 'upcoming';
  if (
    s.includes('100%') ||
    s.includes('dmc nas') ||
    s.includes('transfer completed') ||
    s.includes('completed')
  )
    return 'transferred';
  if (s.includes('supervisor') || s.includes('check')) return 'checked';
  return 'pending';
}


/* ==========================================================================
   ISO LAYER — PM-CRPD-AV-08-04 Rev 7 + Audit Items 40 / 41 / 44
   ========================================================================== */

type ReqStatus =
  | 'pending' | 'approved' | 'ongoing' | 'completed'
  | 'rescheduled' | 'disapproved' | 'cancelled';

type Stream = 'coverage' | 'production';

/** Ang isang ServiceRequest ang ISO master record ng isang kahilingan. */
interface ServiceRequest {
  id: string;
  dateRequested: Date | null;
  client: string;
  clientType: string;
  title: string;
  stream: Stream;
  streamRaw: string;
  serviceType: string;
  eventDate: Date | null;
  venue: string;
  personnel: string;
  status: ReqStatus;
  statusRaw: string;
  reason: string;
  dateApproved: Date | null;
  targetDate: Date | null;
  dateDelivered: Date | null;
  csm: number; // 0 = not yet rated; 1–5
  link: string;
  remarks: string;
}

/** Turnaround time per PM section 6 — TOTAL TURNAROUND TIME, working days. */
const SLA_WD: Record<Stream, number> = { coverage: 3, production: 13 };

const STREAM_META: Record<Stream, { label: string; short: string; hex: string }> = {
  coverage:   { label: 'AV Coverage',    short: 'COVERAGE',   hex: '#00aeef' },
  production: { label: 'AVP Production', short: 'PRODUCTION', hex: '#a855f7' },
};

const REQ_ORDER: ReqStatus[] = [
  'pending', 'approved', 'ongoing', 'completed', 'rescheduled', 'disapproved', 'cancelled',
];

const REQ_META: Record<
  ReqStatus,
  { label: string; hex: string; chip: string; served: boolean; unmet: boolean }
> = {
  pending: {
    label: 'Pending', hex: '#a1a1aa',
    chip: 'bg-zinc-800/80 text-zinc-300 border-zinc-700', served: false, unmet: false,
  },
  approved: {
    label: 'Approved', hex: '#0e7fae',
    chip: 'bg-[#00aeef]/10 text-[#00aeef] border-[#00aeef]/30', served: false, unmet: false,
  },
  ongoing: {
    label: 'Ongoing', hex: '#f59e0b',
    chip: 'bg-amber-500/10 text-amber-400 border-amber-500/30', served: false, unmet: false,
  },
  completed: {
    label: 'Completed', hex: '#22c55e',
    chip: 'bg-green-500/10 text-green-400 border-green-500/30', served: true, unmet: false,
  },
  rescheduled: {
    label: 'Rescheduled', hex: '#eab308',
    chip: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30', served: false, unmet: true,
  },
  disapproved: {
    label: 'Disapproved', hex: '#ef4444',
    chip: 'bg-red-500/10 text-red-400 border-red-500/30', served: false, unmet: true,
  },
  cancelled: {
    label: 'Cancelled', hex: '#71717a',
    chip: 'bg-zinc-900/80 text-zinc-400 border-zinc-800', served: false, unmet: true,
  },
};

/** Item 40: obligadong may dahilan ang mga hindi na-serve. */
const NEEDS_REASON: ReqStatus[] = ['rescheduled', 'disapproved', 'cancelled'];

const SERVICE_TYPES = [
  'Photo coverage', 'Photo shoot', 'Photo shoot production',
  'Video coverage', 'Video shoot', 'Video reproduction (raw)',
  'Video editing (clean-cut)', 'Video production (short video/AVP)',
  'Full production video (script to screen)', 'Script writing',
  'Multi-camera set-up for live streaming', 'Audio technical set-up',
  'Same-Day-Edit (SDE)',
];

/** CSM: 4 pataas ang "Very Satisfactory or higher" per PM 2.2. */
const CSM_LABELS: Record<number, string> = {
  5: 'Outstanding', 4: 'Very Satisfactory', 3: 'Satisfactory', 2: 'Fair', 1: 'Poor',
};
const CSM_PASS = 4;
const KPI_CSM_TARGET = 93;      // PM 2.2 — at least 93% Very Satisfactory or higher
const KPI_EXECUTION_TARGET = 100; // PM 2.1 — 100% of approved requests delivered

/**
 * Mga araw na hindi working day — batay sa Proclamation No. 1006 (2026).
 * DAPAT KAPAREHO ito ng NON_WORKING sa AVNexus.gs. Kapag nagkaiba,
 * magkaibang TAT ang ipapakita ng dashboard at ng sheet.
 * PARA SA 2027: palitan ang buong listahan mula sa bagong proklamasyon.
 */
const NON_WORKING_DAYS = new Set<string>([
  // ---- Regular holidays ----
  '2026-01-01', // New Year's Day (Thu)
  '2026-04-02', // Maundy Thursday
  '2026-04-03', // Good Friday
  '2026-04-09', // Araw ng Kagitingan (Thu)
  '2026-05-01', // Labor Day (Fri)
  '2026-06-12', // Independence Day (Fri)
  '2026-08-31', // National Heroes Day (last Mon of August)
  '2026-11-30', // Bonifacio Day (Mon)
  '2026-12-25', // Christmas Day (Fri)
  '2026-12-30', // Rizal Day (Wed)
  // ---- Islamic regular holidays (hiwalay na proklamasyon kada taon) ----
  '2026-03-20', // Eid'l Fitr
  '2026-05-27', // Eid'l Adha
  // ---- Special (non-working) days ----
  '2026-02-17', // Chinese New Year (Tue)
  '2026-04-04', // Black Saturday
  '2026-08-21', // Ninoy Aquino Day (Fri)
  '2026-11-01', // All Saints' Day (Sun)
  '2026-11-02', // All Souls' Day (Mon)
  '2026-12-08', // Immaculate Conception (Tue)
  '2026-12-24', // Christmas Eve (Thu)
  '2026-12-31', // Last Day of the Year (Thu)
  // TANDAAN: ang Feb 25 (EDSA) ay special WORKING day sa 2026 — hindi holiday.
]);

function isWorkingDay(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  return !NON_WORKING_DAYS.has(dayKey(d));
}

/** Nagdadagdag ng n working days — ginagamit para sa SLA target date. */
function addWorkingDays(start: Date, n: number): Date {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let added = 0;
  let guard = 0;
  while (added < n && guard < 400) {
    d.setDate(d.getDate() + 1);
    guard++;
    if (isWorkingDay(d)) added++;
  }
  return d;
}

/** Bilang ng working days mula `from` (exclusive) hanggang `to` (inclusive). */
function workingDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (b.getTime() === a.getTime()) return 0;
  const back = b < a;
  const lo = back ? b : a;
  const hi = back ? a : b;
  let count = 0;
  let guard = 0;
  const cur = new Date(lo);
  while (cur < hi && guard < 2000) {
    cur.setDate(cur.getDate() + 1);
    guard++;
    if (isWorkingDay(cur)) count++;
  }
  return back ? -count : count;
}

function classifyReqStatus(raw: string): ReqStatus {
  const s = (raw || '').toLowerCase();
  if (s.includes('disapprove') || s.includes('declin') || s.includes('reject')) return 'disapproved';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('resched') || s.includes('delay') || s.includes('moved')) return 'rescheduled';
  if (s.includes('complet') || s.includes('served') || s.includes('deliver') || s.includes('done'))
    return 'completed';
  if (s.includes('ongoing') || s.includes('in progress') || s.includes('processing')) return 'ongoing';
  if (s.includes('approve')) return 'approved';
  return 'pending';
}

function classifyStream(raw: string): Stream {
  const s = (raw || '').toLowerCase();
  if (s.includes('avp') || s.includes('production') || s.includes('editing') || s.includes('script'))
    return 'production';
  return 'coverage';
}

/** Kinukuha ang numeric CSM mula sa "4 - Very Satisfactory" o bare number. */
function parseCSM(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v >= 1 && v <= 5 ? Math.round(v) : 0;
  const m = String(v).trim().match(/^([1-5])/);
  if (m) return Number(m[1]);
  const s = String(v).toLowerCase();
  if (s.includes('outstanding')) return 5;
  if (s.includes('very satisfactory')) return 4;
  if (s.includes('satisfactory')) return 3;
  if (s.includes('fair')) return 2;
  if (s.includes('poor')) return 1;
  return 0;
}

/** Simula ng TAT clock: mula pagkaaprub; kung wala, mula pagkatanggap. */
function tatStart(r: ServiceRequest): Date | null {
  return r.dateApproved || r.dateRequested;
}

/** SLA target — gamitin ang nakatakda; kung wala, kalkulahin mula sa PM. */
function effectiveTarget(r: ServiceRequest): Date | null {
  if (r.targetDate) return r.targetDate;
  const start = tatStart(r);
  return start ? addWorkingDays(start, SLA_WD[r.stream]) : null;
}

/** Aktwal na turnaround sa working days. null kung hindi pa naide-deliver. */
function actualTAT(r: ServiceRequest): number | null {
  const start = tatStart(r);
  if (!start || !r.dateDelivered) return null;
  return workingDaysBetween(start, r.dateDelivered);
}

/** Ilang working days ang natitira (+) o lumagpas (−) bago ang target. */
function daysToTarget(r: ServiceRequest): number | null {
  const target = effectiveTarget(r);
  if (!target) return null;
  const ref = r.dateDelivered || new Date();
  return workingDaysBetween(ref, target);
}

type SLAState = 'ontime' | 'overdue' | 'atrisk' | 'open' | 'na';

function slaState(r: ServiceRequest): SLAState {
  if (r.status === 'disapproved' || r.status === 'cancelled') return 'na';
  const target = effectiveTarget(r);
  if (!target) return 'na';

  if (r.dateDelivered) {
    return r.dateDelivered.getTime() <= target.getTime() ? 'ontime' : 'overdue';
  }
  const left = daysToTarget(r);
  if (left === null) return 'open';
  if (left < 0) return 'overdue';
  if (left <= 1) return 'atrisk';
  return 'open';
}

const SLA_META: Record<SLAState, { label: string; hex: string; chip: string }> = {
  ontime:   { label: 'ON TIME',  hex: '#22c55e', chip: 'bg-green-500/10 text-green-400 border-green-500/30' },
  overdue: { label: 'OVERDUE', hex: '#ef4444', chip: 'bg-red-500/10 text-red-400 border-red-500/30' },
  atrisk:   { label: 'AT RISK',  hex: '#f59e0b', chip: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  open:     { label: 'WITHIN',   hex: '#00aeef', chip: 'bg-[#00aeef]/10 text-[#00aeef] border-[#00aeef]/30' },
  na:       { label: 'N/A',      hex: '#52525b', chip: 'bg-zinc-900/80 text-zinc-500 border-zinc-800' },
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'short' });
}


/* ==========================================================================
   EVENT LAYER — the core of AV Nexus.
   One event = one request, with a list of services REQUESTED and a
   list of services ACTUALLY DELIVERED. The gap between them is the
   evidence for Audit Item 44.
   ========================================================================== */

/**
 * Approval chain per PM-CRPD-AV-08-04 Rev 7, sections 5.2 and 5.3:
 *   for-approval → Division Chief acts
 *   approved     → cleared by the Division Chief, awaiting endorsement
 *   endorsed     → released to the AV Team by the Supervising SRS
 */
type ApprovalKey =
  | 'for-approval' | 'approved' | 'endorsed'
  | 'declined' | 'cancelled' | 'rescheduled';

/** Kinakalkula, hindi ini-input. */
type Fulfilment = 'full' | 'partial' | 'none' | 'declined' | 'pending';

type PipelineKey = 'coordination' | 'documents' | 'deliverables' | 'archiving';
type PipelineState = 'not-started' | 'in-progress' | 'done' | 'na';

interface AVEvent {
  id: string;
  dateRequested: Date | null;
  title: string;
  client: string;
  clientType: string;
  eventDate: Date | null;
  endDate: Date | null;
  venue: string;
  requested: string[];
  delivered: string[];
  reason: string;
  approval: ApprovalKey;
  approvalRaw: string;
  endorsedBy: string;
  dateEndorsed: Date | null;
  approvedBy: string;
  dateApproved: Date | null;
  approvalRemarks: string;
  lead: string;
  team: string;
  pipeline: Record<PipelineKey, PipelineState>;
  targetDate: Date | null;
  dateDelivered: Date | null;
  csm: number;
  link: string;
  remarks: string;
  history: string[];
  createdBy: string;
}

/**
 * One person, several roles on the same event.
 * Hal.: si Xyrus ay Camera Operator + Coordinator + Editor sa isang coverage —
 * tatlong papel, isang row, tatlong bilang sa IPCR niya.
 */
interface Assignment {
  id: string;
  eventId: string;
  eventTitle: string;
  personnel: string;
  roles: string[];
  status: string;
  dateAssigned: Date | null;
  dateCompleted: Date | null;
  remarks: string;
}

const ROLE_CATALOG = [
  'Camera Operator',
  'Photographer',
  'Director / DP',
  'Editor',
  'Colorist',
  'Motion / Graphics Artist',
  'Audio Technician',
  'Livestream Technician',
  'Scriptwriter',
  'Coordinator',
  'Documents / Admin',
  'Archiving / DMC',
];

const ASSIGN_STATUS = ['Assigned', 'In progress', 'Completed', 'Reassigned', 'Dropped'];

/** Hinahati ang comma-separated na field ng sheet tungo sa malinis na listahan. */
function splitList(v: unknown): string[] {
  return String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

const SERVICE_CATALOG = [
  'Photo coverage',
  'Video coverage',
  'Photo shoot',
  'Video shoot',
  'AVP production',
  'Hybrid livestream',
  'Livestream (multi-cam)',
  'Audio technical set-up',
  'Same-Day-Edit (SDE)',
  'Video editing (clean-cut)',
  'Motion graphics',
  'Script writing',
  'Social media posting',
];

/** Mabibigat na serbisyo → 13 WD SLA. Iba → 3 WD. Per PM section 6. */
const HEAVY_SERVICES = [
  'AVP production', 'Video editing (clean-cut)', 'Script writing', 'Motion graphics',
];

const APPROVAL_ORDER: ApprovalKey[] = [
  'for-approval', 'approved', 'endorsed', 'declined', 'rescheduled', 'cancelled',
];

const APPROVAL_META: Record<
  ApprovalKey,
  { label: string; short: string; hex: string; chip: string; live: boolean }
> = {
  'for-approval': {
    label: 'For approval', short: 'FOR DC', hex: '#a1a1aa',
    chip: 'bg-zinc-800/80 text-zinc-300 border-zinc-700', live: true,
  },
  approved: {
    label: 'Approved', short: 'FOR SRS', hex: '#f59e0b',
    chip: 'bg-amber-500/10 text-amber-400 border-amber-500/30', live: true,
  },
  endorsed: {
    label: 'Endorsed', short: 'CLEARED', hex: '#00aeef',
    chip: 'bg-[#00aeef]/10 text-[#00aeef] border-[#00aeef]/30', live: true,
  },
  declined: {
    label: 'Declined', short: 'DECLINED', hex: '#ef4444',
    chip: 'bg-red-500/10 text-red-400 border-red-500/30', live: false,
  },
  rescheduled: {
    label: 'Rescheduled', short: 'MOVED', hex: '#eab308',
    chip: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30', live: false,
  },
  cancelled: {
    label: 'Cancelled', short: 'CANCELLED', hex: '#71717a',
    chip: 'bg-zinc-900/80 text-zinc-400 border-zinc-800', live: false,
  },
};

const FULFIL_META: Record<
  Fulfilment,
  { label: string; hex: string; chip: string }
> = {
  full: {
    label: 'FULLY SERVED', hex: '#22c55e',
    chip: 'bg-green-500/10 text-green-400 border-green-500/30',
  },
  partial: {
    label: 'LIMITED SERVICE', hex: '#f59e0b',
    chip: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  none: {
    label: 'NOT SERVED', hex: '#ef4444',
    chip: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
  declined: {
    label: 'DECLINED', hex: '#ef4444',
    chip: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
  pending: {
    label: 'AWAITING APPROVAL', hex: '#a1a1aa',
    chip: 'bg-zinc-800/80 text-zinc-400 border-zinc-700',
  },
};

const PIPELINE_STEPS: { key: PipelineKey; label: string; short: string; detail: string }[] = [
  {
    key: 'coordination', label: 'Coordination', short: 'COORD',
    detail: 'Pre-production and client coordination meeting',
  },
  {
    key: 'documents', label: 'Office documents', short: 'DOCS',
    detail: 'Gate pass, travel order, pass slip, special order',
  },
  {
    key: 'deliverables', label: 'Deliverables', short: 'DELIV',
    detail: 'Shoot, edit and delivery to the client',
  },
  {
    key: 'archiving', label: 'Archiving', short: 'DMC',
    detail: 'Transfer to DMC NAS and pre-archival record',
  },
];

const PIPELINE_META: Record<PipelineState, { label: string; hex: string }> = {
  'not-started': { label: 'Not started', hex: '#3f3f46' },
  'in-progress': { label: 'In progress', hex: '#f59e0b' },
  done: { label: 'Done', hex: '#22c55e' },
  na: { label: 'N/A', hex: '#27272a' },
};

/**
 * Ginagawang ServiceRequest ang bawat event para magamit ng mga umiiral nang
 * compliance panel (TAT monitor, KPI ring, audit scorecard) nang walang
 * dobleng lohika.
 */
function eventAsRequest(ev: AVEvent): ServiceRequest {
  let status: ReqStatus;
  if (ev.approval === 'declined') status = 'disapproved';
  else if (ev.approval === 'cancelled') status = 'cancelled';
  else if (ev.approval === 'rescheduled') status = 'rescheduled';
  else if (!isAuthorised(ev)) status = 'pending';
  else if (ev.dateDelivered) status = 'completed';
  else status = 'ongoing';

  const heavy = new Set(HEAVY_SERVICES.map((x) => x.toLowerCase()));
  const stream: Stream = ev.requested.some((x) => heavy.has(x.toLowerCase()))
    ? 'production'
    : 'coverage';

  return {
    id: ev.id,
    dateRequested: ev.dateRequested,
    client: ev.client,
    clientType: ev.clientType,
    title: ev.title,
    stream,
    streamRaw: STREAM_META[stream].label,
    serviceType: ev.requested.join(', '),
    eventDate: ev.eventDate,
    venue: ev.venue,
    personnel: ev.lead,
    status,
    statusRaw: ev.approvalRaw,
    reason: ev.reason,
    dateApproved: ev.dateApproved,
    targetDate: ev.targetDate,
    dateDelivered: ev.dateDelivered,
    csm: ev.csm,
    link: ev.link,
    remarks: ev.remarks,
  };
}

/**
 * Cleared by the Division Chief. This is the substantive authorisation, so it
 * unlocks the delivery pipeline and counts in the service metrics.
 * Records created before the SRS endorsement step existed sit at 'approved',
 * so both states must count here.
 */
function isAuthorised(ev: AVEvent): boolean {
  return ev.approval === 'approved' || ev.approval === 'endorsed';
}

/** Still needs a signature from either the Division Chief or the SRS. */
function awaitingAction(ev: AVEvent): boolean {
  return APPROVAL_META[ev.approval].live && ev.approval !== 'endorsed';
}

function classifyApproval(raw: string): ApprovalKey {
  const s = (raw || '').toLowerCase();
  if (s.includes('declin') || s.includes('disapprove') || s.includes('reject')) return 'declined';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('resched') || s.includes('moved')) return 'rescheduled';
  // "For approval" must be tested before "approved" — it contains the word.
  if (s.includes('for approval') || s.includes('for endorsement')) return 'for-approval';
  if (s.includes('endorsed')) return 'endorsed';
  if (s.includes('approved')) return 'approved';
  return 'for-approval';
}

function classifyPipeline(raw: string): PipelineState {
  const s = (raw || '').toLowerCase();
  if (s.includes('n/a') || s === 'na') return 'na';
  if (s.includes('done') || s.includes('complete')) return 'done';
  if (s.includes('progress') || s.includes('ongoing')) return 'in-progress';
  return 'not-started';
}

/** "Photo coverage, Hybrid livestream" → ['Photo coverage','Hybrid livestream'] */
function splitServices(raw: unknown): string[] {
  return String(raw ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Ang mga serbisyong hiniling pero HINDI naibigay. Ito ang ebidensiya. */
function serviceGap(ev: AVEvent): string[] {
  const got = new Set(ev.delivered.map((x) => x.toLowerCase()));
  return ev.requested.filter((x) => !got.has(x.toLowerCase()));
}

/** Naibigay pero hindi orihinal na hiniling — dagdag na serbisyo. */
function serviceExtra(ev: AVEvent): string[] {
  const asked = new Set(ev.requested.map((x) => x.toLowerCase()));
  return ev.delivered.filter((x) => !asked.has(x.toLowerCase()));
}

function fulfilment(ev: AVEvent): Fulfilment {
  if (ev.approval === 'declined' || ev.approval === 'cancelled' || ev.approval === 'rescheduled')
    return 'declined';
  if (!isAuthorised(ev)) return 'pending';
  if (ev.requested.length === 0) return 'pending';
  const gap = serviceGap(ev);
  if (gap.length === 0) return 'full';
  if (ev.delivered.length === 0) return 'none';
  return 'partial';
}

function slaForEvent(ev: AVEvent): number {
  const heavy = new Set(HEAVY_SERVICES.map((x) => x.toLowerCase()));
  return ev.requested.some((x) => heavy.has(x.toLowerCase()))
    ? SLA_WD.production
    : SLA_WD.coverage;
}

function eventTarget(ev: AVEvent): Date | null {
  if (ev.targetDate) return ev.targetDate;
  const start = ev.dateApproved || ev.dateRequested;
  return start ? addWorkingDays(start, slaForEvent(ev)) : null;
}

function eventTAT(ev: AVEvent): number | null {
  const start = ev.dateApproved || ev.dateRequested;
  if (!start || !ev.dateDelivered) return null;
  return workingDaysBetween(start, ev.dateDelivered);
}

function eventSLA(ev: AVEvent): SLAState {
  if (!APPROVAL_META[ev.approval].live) return 'na';
  const target = eventTarget(ev);
  if (!target) return 'na';
  if (ev.dateDelivered) {
    return ev.dateDelivered.getTime() <= target.getTime() ? 'ontime' : 'overdue';
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const left = workingDaysBetween(today, target);
  if (left < 0) return 'overdue';
  if (left <= 1) return 'atrisk';
  return 'open';
}

/** 0–100, batay sa apat na hakbang ng pipeline. N/A ay binibilang na tapos. */
function pipelineProgress(ev: AVEvent): number {
  const states = PIPELINE_STEPS.map((s) => ev.pipeline[s.key]);
  const score = states.reduce((a, st) => {
    if (st === 'done' || st === 'na') return a + 1;
    if (st === 'in-progress') return a + 0.5;
    return a;
  }, 0);
  return Math.round((score / PIPELINE_STEPS.length) * 100);
}

/** Ang susunod na hakbang na dapat asikasuhin. */
function nextPipelineStep(ev: AVEvent): { key: PipelineKey; label: string } | null {
  if (!isAuthorised(ev)) return null;
  for (const step of PIPELINE_STEPS) {
    const st = ev.pipeline[step.key];
    if (st === 'not-started' || st === 'in-progress') return { key: step.key, label: step.label };
  }
  return null;
}

/**
 * Aling papel ang may hawak ng bawat yugto ng pipeline.
 * Dito nakasalalay kung sinong pangalan ang lalabas sa "Susunod" —
 * dapat ang taong may hawak ng papel na 'yon, hindi basta ang lead.
 */
const STEP_ROLES: Record<PipelineKey, string[]> = {
  coordination: ['Coordinator'],
  documents: ['Documents / Admin'],
  deliverables: [
    'Editor',
    'Colorist',
    'Motion / Graphics Artist',
    'Camera Operator',
    'Photographer',
    'Director / DP',
    'Audio Technician',
    'Livestream Technician',
    'Scriptwriter',
  ],
  archiving: ['Archiving / DMC'],
};

/**
 * Sinong tao ang aktwal na may hawak ng yugtong ito, ayon sa crew roster.
 * Kapag walang nakatalaga, `null` — at 'yon ay senyas, hindi kamalian.
 */
function ownersOfStep(key: PipelineKey, crew: Assignment[]): string[] {
  const want = STEP_ROLES[key].map((r) => r.toLowerCase());
  const names = crew
    .filter((a) => a.roles.some((r) => want.includes(r.toLowerCase())))
    .map((a) => a.personnel);
  return Array.from(new Set(names));
}

function classifyStage(raw: string): StageKey {
  const s = (raw || '').toLowerCase();
  if (s.includes('publish') || s.includes('posted') || s.includes('on air')) return 'published';
  if (s.includes('approve') || s.includes('cleared')) return 'approved';
  if (s.includes('review') || s.includes('revis')) return 'review';
  if (s.includes('edit') || s.includes('ingest') || s.includes('post')) return 'editing';
  if (s.includes('shoot') || s.includes('field') || s.includes('taping')) return 'shooting';
  return 'assigned';
}

/** Tumatanggap ng "3:12", "1:04:30", "3m", "45s" o bare number (minuto). */
function parseRuntime(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Math.round(v * 60);
  const raw = String(v).trim();
  if (!raw) return 0;
  if (raw.includes(':')) {
    const parts = raw.split(':').map((x) => Number(x.trim()));
    if (parts.every((n) => !isNaN(n))) {
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }
  }
  const sec = raw.match(/^(\d+(?:\.\d+)?)\s*s(?:ec|ecs|econds)?$/i);
  if (sec) return Math.round(Number(sec[1]));
  const min = raw.match(/^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes)?$/i);
  if (min) return Math.round(Number(min[1]) * 60);
  return 0;
}

function fmtRuntime(total: number): string {
  if (!total) return '—';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.round(total % 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function deliveredOnTime(o: Output): boolean | null {
  if (!o.delivered || !o.target) return null;
  return o.delivered.getTime() <= o.target.getTime();
}

function isOverdue(o: Output): boolean {
  if (o.stage === 'approved' || o.stage === 'published') return false;
  if (!o.target) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return o.target.getTime() < today.getTime();
}

type LatestActivity =
  | { kind: 'coverage'; cov: Coverage; when: Date | null }
  | { kind: 'output'; out: Output; when: Date | null };

function pickLatest<T>(items: T[], when: (t: T) => Date | null): T | null {
  if (!items.length) return null;
  let best = items[0];
  let bestT = when(items[0])?.getTime() ?? -Infinity;
  for (const it of items) {
    const t = when(it)?.getTime() ?? -Infinity;
    if (t > bestT) {
      best = it;
      bestT = t;
    }
  }
  return best;
}

/** Pinagsasama ang DMC coverage at production output — kung alin ang mas bago. */
function latestActivityFor(
  name: string,
  coverages: Coverage[],
  outputs: Output[]
): LatestActivity | null {
  const n = name.toLowerCase();
  const cov = coverages.find((c) => (c.personnel || '').toLowerCase().includes(n)) ?? null;
  const outs = outputs.filter((o) => (o.personnel || '').toLowerCase().includes(n));
  const out = pickLatest(outs, (o) => o.delivered || o.assigned || o.target);

  if (!cov && !out) return null;
  const ct = cov?.dateObj?.getTime() ?? -Infinity;
  const ow = out ? out.delivered || out.assigned || out.target : null;
  const ot = ow?.getTime() ?? -Infinity;

  if (out && (!cov || ot >= ct)) return { kind: 'output', out, when: ow };
  return cov ? { kind: 'coverage', cov, when: cov.dateObj } : null;
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s) return null;
  const mdy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (mdy) {
    const yr = Number(mdy[3].length === 2 ? '20' + mdy[3] : mdy[3]);
    const d = new Date(yr, Number(mdy[1]) - 1, Number(mdy[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date | null, fallback = '—'): string {
  if (!d) return fallback;
  return d.toLocaleDateString('en-PH', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function relativeDay(d: Date | null): string {
  if (!d) return '';
  const today = new Date();
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Bukas';
  if (diff === -1) return 'Kahapon';
  if (diff > 1 && diff <= 14) return `In ${diff} days`;
  if (diff < -1 && diff >= -14) return `${Math.abs(diff)} days ago`;
  return '';
}

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    const delta = target - origin;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(origin + delta * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

/* ------------------------------------------------------ SMALL COMPONENTS -- */

function StatusBadge({ status, dense = false }: { status: string; dense?: boolean }) {
  const meta = STATUS_META[classifyStatus(status)];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium tracking-wide text-zinc-400 ${
        dense ? 'text-[10px]' : 'text-[11px]'
      }`}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: meta.hex }}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}

/**
 * Buong-taas na embed ng isang AV system sa loob ng sarili nitong tab.
 * May fallback para sa mga hindi kayang i-frame (AppSheet).
 */
function SystemFrame({ app }: { app: SystemApp }) {
  const [loading, setLoading] = useState(app.embeddable);
  const [blocked, setBlocked] = useState(!app.embeddable);
  const [reloadKey, setReloadKey] = useState(0);

  // Kapag hindi tumawag ang onLoad sa loob ng ilang segundo, ang site ay
  // malamang na humaharang ng pag-embed (X-Frame-Options / CSP).
  useEffect(() => {
    if (!app.embeddable) return;
    setLoading(true);
    setBlocked(false);
    const t = setTimeout(() => {
      setLoading((wasLoading) => {
        if (wasLoading) setBlocked(true);
        return false;
      });
    }, 6000);
    return () => clearTimeout(t);
  }, [app.embeddable, app.url, reloadKey]);

  const showFallback = blocked || !app.embeddable;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-medium text-zinc-100">{app.name}</h2>
          <p className="truncate text-[11px] text-zinc-600">{app.role}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            Reload
          </button>
          <a
            href={app.url}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-[#00aeef] px-3 py-1.5 text-[12px] font-medium text-[#06121a] transition-opacity hover:opacity-90"
          >
            Open site
          </a>
        </div>
      </div>

      <div className="relative h-[78vh] min-h-[520px] overflow-hidden rounded-md border border-zinc-800/80 bg-white">
        {!showFallback && (
          <>
            <iframe
              key={reloadKey}
              src={app.url}
              title={app.name}
              className="h-full w-full border-0 bg-white"
              onLoad={() => {
                setLoading(false);
                setBlocked(false);
              }}
            />
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#101012]">
                <div
                  className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-800"
                  style={{ borderTopColor: app.accent }}
                />
                <p className="font-mono text-[11px] text-zinc-500">Loading {app.name}</p>
              </div>
            )}
          </>
        )}

        {showFallback && (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#101012] px-6 text-center">
            <h3 className="text-[15px] font-medium text-zinc-100">
              {app.name} cannot be displayed here
            </h3>
            <p className="max-w-lg text-[13px] leading-relaxed text-zinc-500">
              The site sends a header that prevents it from being embedded in another
              page. Open it in a new tab instead — or, if you own the site, allow this
              dashboard to frame it (see the note below).
            </p>
            <a
              href={app.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 rounded bg-[#00aeef] px-4 py-2 text-[13px] font-medium text-[#06121a] transition-opacity hover:opacity-90"
            >
              Open {app.name}
            </a>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="text-[12px] text-zinc-600 transition-colors hover:text-zinc-300"
            >
              Try embedding again
            </button>
          </div>
        )}
      </div>

      {showFallback && app.embeddable && (
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
          To allow embedding, add a{' '}
          <span className="font-mono text-zinc-400">vercel.json</span> to that site with a{' '}
          <span className="font-mono text-zinc-400">Content-Security-Policy</span> header
          whose <span className="font-mono text-zinc-400">frame-ancestors</span> lists this
          dashboard&rsquo;s domain, then redeploy.
        </p>
      )}
    </section>
  );
}

type Capability = 'edit' | 'approve' | 'endorse';

/**
 * Kaparehong panuntunan ng server, ginagamit lang para itago ang mga
 * button na hindi naman gagana. Ang server pa rin ang huling hukom —
 * ito ay kaginhawahan, hindi seguridad.
 */
function roleOf(user: SignedInUser | null, actor: string): string {
  if (!AUTH_ENABLED) return 'admin';
  if (!user) return 'none';
  const n = (user.name || actor || '').toLowerCase();
  if (n.includes('division chief')) return 'dc';
  if (n.includes('srs') || n.includes('supervising')) return 'srs';
  if (n.includes('xyrus')) return 'admin';
  return 'staff';
}

function can(cap: Capability, role: string, createdBy?: string, me?: string): boolean {
  if (role === 'admin') return cap === 'edit' || cap === 'approve' || cap === 'endorse';
  if (cap === 'edit') {
    if (role !== 'staff') return false;
    if (!createdBy) return true;
    return createdBy.toLowerCase() === String(me || '').toLowerCase();
  }
  if (cap === 'approve') return role === 'dc';
  if (cap === 'endorse') return role === 'srs';
  return false;
}

/**
 * Google Sign-In. Ang browser ang kumukuha ng token; ang backend ang
 * nagsusuri nito. Wala tayong pinagkakatiwalaan dito bukod sa pagpapakita.
 */
function useGoogleSignIn(onUser: (u: SignedInUser | null) => void) {
  const [ready, setReady] = useState(false);
  const cb = useRef(onUser);

  useEffect(() => {
    cb.current = onUser;
  }, [onUser]);

  useEffect(() => {
    if (!AUTH_ENABLED) return;
    const w = window as any;

    const init = () => {
      if (!w.google?.accounts?.id) return;
      w.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (res: { credential?: string }) => {
          const jwt = res?.credential;
          if (!jwt) return;
          const p = readIdToken(jwt);
          if (!p) return;
          cb.current({
            email: p.email,
            name: p.name,
            picture: p.picture,
            idToken: jwt,
            expiresAt: p.exp * 1000,
          });
        },
        auto_select: true,
        cancel_on_tap_outside: false,
      });
      setReady(true);
    };

    if (w.google?.accounts?.id) {
      init();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://accounts.google.com/gsi/client';
    tag.async = true;
    tag.defer = true;
    tag.onload = init;
    document.head.appendChild(tag);
  }, []);

  /**
   * Tahimik na paghingi ng bagong token.
   * Ang Google ID token ay tumatagal lamang ng isang oras at hindi
   * kusang nagre-refresh. Kapag hindi ito hiningi muli, mapapalitan
   * ng biglaang pag-logout — 'yon ang dating nangyayari.
   */
  const refresh = useCallback(() => {
    const w = window as any;
    if (!w.google?.accounts?.id) return;
    try {
      // Buhay pa ang Google session, kaya walang lalabas na dialog —
      // ang callback lang ang tatakbo kasama ang bagong token.
      w.google.accounts.id.prompt();
    } catch {
      /* walang magagawa; hahayaan ang normal na daloy ng pag-sign in */
    }
  }, []);

  const prompt = refresh;

  const renderButton = useCallback((el: HTMLElement | null) => {
    const w = window as any;
    if (!el || !w.google?.accounts?.id) return;
    el.innerHTML = '';
    w.google.accounts.id.renderButton(el, {
      theme: 'filled_black',
      size: 'large',
      shape: 'rectangular',
      text: 'signin_with',
      width: 260,
    });
  }, []);

  return { ready, prompt, refresh, renderButton };
}

/** Ang buong screen bago ka makapasok. */
type ProbeResult = {
  name: string;
  url: string;
  ok: boolean;
  detail: string;
  hint: string;
};

/**
 * Sapat na bahagi ng deployment ID para maihambing sa Manage deployments.
 * Ang lahat ng Apps Script ID ay nagsisimula sa "AKfycb", kaya kulang ang
 * anim na titik — magkamukha ang dalawang magkaibang deployment.
 */
function shortUrl(url: string): string {
  const m = url.match(/\/macros\/s\/([^/]+)\/(\w+)/);
  if (!m) return url.slice(0, 56);
  const id = m[1];
  const head = id.slice(0, 16);
  const tail = id.length > 20 ? '…' + id.slice(-4) : '';
  return `${head}${tail}/${m[2]}`;
}

/**
 * Sinusubukan ang isang endpoint at sinasabi kung ANO talaga ang nangyari.
 * Ang "Load failed" ay walang sinasabi; ito ay may sinasabi.
 */
async function probeEndpoint(name: string, url: string): Promise<ProbeResult> {
  if (!url.startsWith('https://script.google.com/')) {
    return {
      name,
      url,
      ok: false,
      detail: 'Not set',
      hint: 'This URL has not been filled in yet.',
    };
  }

  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch (err) {
    return {
      name,
      url,
      ok: false,
      detail: 'Cannot be reached',
      hint:
        'The browser could not load this URL at all. Either the deployment was ' +
        'deleted, or it is set to "Execute as: User accessing" — which forces a ' +
        'Google login the dashboard cannot follow. It must be "Execute as: Me" ' +
        'with access "Anyone".',
    };
  }

  if (!res.ok) {
    return {
      name,
      url,
      ok: false,
      detail: `HTTP ${res.status}`,
      hint:
        res.status === 404
          ? 'This deployment no longer exists. Copy the current URL from Deploy → Manage deployments.'
          : 'The script returned an error. Check the Apps Script execution log.',
    };
  }

  const text = await res.text();
  const looksLikeHtml = text.trimStart().startsWith('<');
  if (looksLikeHtml) {
    return {
      name,
      url,
      ok: false,
      detail: 'Returned a web page, not data',
      hint:
        'This is almost always a Google sign-in page. Set that deployment to ' +
        '"Execute as: Me" and access "Anyone", then deploy a new version.',
    };
  }

  try {
    JSON.parse(text);
  } catch {
    return {
      name,
      url,
      ok: false,
      detail: 'Response was not valid data',
      hint: 'The script ran but did not return JSON. Check the Apps Script execution log.',
    };
  }

  return { name, url, ok: true, detail: 'Working', hint: '' };
}

/** Ipinapakita ang kalagayan ng bawat endpoint nang hiwalay. */
function ConnectionPanel({
  probes,
  busy,
  onRetry,
}: {
  probes: ProbeResult[];
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-md border border-zinc-800/80 bg-[#101012] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-zinc-400">Connections</p>
        <button
          onClick={onRetry}
          disabled={busy}
          className="text-[11px] text-zinc-500 underline transition-colors hover:text-zinc-300 disabled:opacity-50"
        >
          {busy ? 'Testing…' : 'Test again'}
        </button>
      </div>

      <div className="space-y-3">
        {probes.map((pr) => (
          <div key={pr.name} className="flex gap-3">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: pr.ok ? '#22c55e' : '#ef4444' }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[12px] font-medium text-zinc-200">{pr.name}</span>
                <span
                  className="text-[11px]"
                  style={{ color: pr.ok ? '#22c55e' : '#ef4444' }}
                >
                  {pr.detail}
                </span>
              </div>
              <p className="truncate font-mono text-[10px] text-zinc-600">
                {shortUrl(pr.url)}
              </p>
              {pr.hint && (
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{pr.hint}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignInGate({
  onMount,
  ready,
  error,
  health,
  onRetry,
}: {
  onMount: (el: HTMLDivElement | null) => void;
  ready: boolean;
  error: string;
  health: { problems: string[]; registeredAccounts: string[] } | null;
  onRetry: () => void;
}) {
  const wide = !!error || (health && health.problems.length > 0);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080a] px-4 py-10">
      <div
        className={`w-full rounded-lg border border-zinc-800 bg-[#101012] p-8 ${
          wide ? 'max-w-xl' : 'max-w-sm'
        }`}
      >
        <img src="/stii.png" alt="DOST-STII" className="mb-6 h-8 w-auto" />
        <h1 className="text-[17px] font-semibold tracking-tight text-zinc-100">AV Nexus</h1>
        <p className="mt-1 text-[12px] text-zinc-500">Broadcast &amp; Digital Media Section</p>

        <p className="mt-6 text-[13px] leading-relaxed text-zinc-400">
          Sign in with your DOST-STII Google account to continue. Records can only be
          edited by the person who created them.
        </p>

        <div ref={onMount} className="mt-6 flex justify-center" />

        {!ready && (
          <p className="mt-4 text-center text-[12px] text-zinc-600">Loading sign-in…</p>
        )}

        {error && (
          <div className="mt-5 rounded border border-red-900/60 bg-red-950/25 px-4 py-3 text-[12px] leading-relaxed text-red-200">
            <p>{error}</p>
            {health && health.registeredAccounts.length > 0 && (
              <>
                <p className="mt-3 text-red-300/70">Registered accounts:</p>
                <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-red-300/60">
                  {health.registeredAccounts.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-3 text-red-300/70">
              To use a different Google account, sign out of Google in this browser or
              open the dashboard in a private window.
            </p>
          </div>
        )}

        {health && health.problems.length > 0 && (
          <div className="mt-5 rounded border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-[12px] leading-relaxed text-amber-200">
            <p className="mb-2 font-medium">
              Backend setup needs attention ({health.problems.length})
            </p>
            <ul className="space-y-2">
              {health.problems.map((prob, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-amber-500/60">{i + 1}.</span>
                  <span className="whitespace-pre-line">{prob}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={onRetry}
              className="mt-3 text-[11px] text-amber-300/70 underline transition-colors hover:text-amber-200"
            >
              Check again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHead({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {title}
        </h2>
        {hint && <p className="mt-1 text-[12px] text-zinc-600">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent,
  bar,
}: {
  label: string;
  value: number;
  sub: string;
  accent: string;
  bar: number;
}) {
  const shown = useCountUp(value);
  return (
    <div className="rounded-md border border-zinc-800/80 bg-[#101012] px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        <p className="truncate text-[11px] font-medium text-zinc-500">{label}</p>
      </div>
      <p className="mt-2 font-mono text-[28px] font-medium leading-none text-zinc-50 tabular-nums">
        {shown}
      </p>
      <p className="mt-1.5 truncate text-[11px] text-zinc-600">{sub}</p>
      <div className="mt-3 h-px w-full bg-zinc-800">
        <div
          className="h-px transition-all duration-500"
          style={{ width: `${Math.max(2, Math.min(100, bar))}%`, background: accent }}
        />
      </div>
    </div>
  );
}

function StatusDonut({ counts, total }: { counts: Record<StatusKey, number>; total: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const cleared = counts.transferred + counts.archived;
  const pct = total ? Math.round((cleared / total) * 100) : 0;
  const shown = useCountUp(pct);

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[132px] w-[132px] shrink-0">
        <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
          <circle cx="66" cy="66" r={R} fill="none" stroke="#18181b" strokeWidth="13" />
          {STATUS_ORDER.map((key) => {
            const n = counts[key];
            if (!n || !total) return null;
            const len = (n / total) * C;
            const el = (
              <circle
                key={key}
                cx="66"
                cy="66"
                r={R}
                fill="none"
                stroke={STATUS_META[key].hex}
                strokeWidth="13"
                strokeDasharray={`${Math.max(0, len - 2)} ${C}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-black text-white tabular-nums">{shown}%</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500">
            cleared
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {STATUS_ORDER.map((key) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: STATUS_META[key].hex }}
            />
            <span className="flex-1 truncate text-zinc-400">{STATUS_META[key].label}</span>
            <span className="font-mono font-bold text-zinc-200 tabular-nums">{counts[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkloadBars({
  data,
}: {
  data: { name: string; cov: number; out: number; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.name}>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              {d.name}
            </span>
            <span className="font-mono text-xs text-zinc-400 tabular-nums">
              {d.count}
              <span className="text-zinc-600"> · {d.cov}c / {d.out}v</span>
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full bg-[#00aeef] transition-all duration-1000"
              style={{ width: `${(d.cov / max) * 100}%` }}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-1000"
              style={{ width: `${(d.out / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && <p className="text-xs italic text-zinc-600">No data yet.</p>}
    </div>
  );
}

function ActivityGrid({ coverages }: { coverages: Coverage[] }) {
  const { weeks, months, maxCount } = useMemo(() => {
    const map = new Map<string, number>();
    coverages.forEach((c) => {
      if (c.dateObj) map.set(dayKey(c.dateObj), (map.get(dayKey(c.dateObj)) || 0) + 1);
    });
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - 7 * 25);
    start.setDate(start.getDate() - start.getDay());

    const cols: { date: Date; count: number }[][] = [];
    const labels: { index: number; label: string }[] = [];
    const cursor = new Date(start);
    let lastMonth = -1;
    while (cursor <= end) {
      const col: { date: Date; count: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(cursor);
        col.push({ date: d, count: map.get(dayKey(d)) || 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
      if (col[0].date.getMonth() !== lastMonth) {
        lastMonth = col[0].date.getMonth();
        labels.push({
          index: cols.length,
          label: col[0].date.toLocaleDateString('en-PH', { month: 'short' }),
        });
      }
      cols.push(col);
    }
    return { weeks: cols, months: labels, maxCount: Math.max(1, ...Array.from(map.values())) };
  }, [coverages]);

  const CELL = 13;
  const GAP = 3;
  const width = weeks.length * (CELL + GAP);

  const shade = (n: number) => {
    if (!n) return '#111113';
    const t = Math.min(1, n / maxCount);
    return `rgba(0,174,239,${0.22 + t * 0.78})`;
  };

  return (
    <div className="overflow-x-auto pb-1 custom-scrollbar">
      <svg width={width} height={7 * (CELL + GAP) + 18} className="block">
        {months.map((m) => (
          <text
            key={`${m.index}-${m.label}`}
            x={m.index * (CELL + GAP)}
            y={10}
            fill="#52525b"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
            letterSpacing="1"
          >
            {m.label.toUpperCase()}
          </text>
        ))}
        {weeks.map((col, x) =>
          col.map((cell, y) => (
            <rect
              key={`${x}-${y}`}
              x={x * (CELL + GAP)}
              y={18 + y * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={3}
              fill={shade(cell.count)}
              stroke={cell.count ? 'rgba(0,174,239,0.35)' : '#18181b'}
              strokeWidth="0.6"
            >
              <title>{`${fmtDate(cell.date)} — ${cell.count} coverage${
                cell.count === 1 ? '' : 's'
              }`}</title>
            </rect>
          ))
        )}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------- PRODUCTION BOARD -- */

function StageBadge({ stage }: { stage: StageKey }) {
  const m = STAGE_META[stage];
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-zinc-400">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.hex }} aria-hidden />
      {m.label}
    </span>
  );
}

function OutputCard({
  o,
  onAdvance,
  busy,
}: {
  o: Output;
  onAdvance: (o: Output) => void;
  busy: boolean;
}) {
  const overdue = isOverdue(o);
  const atEnd = o.stage === 'published';
  return (
    <div
      className="group rounded-md border border-zinc-800/80 bg-[#0c0c0e] p-3 transition-colors hover:border-zinc-700"
      style={overdue ? { borderColor: 'rgba(239,68,68,0.45)' } : undefined}
    >
      <p className="mb-1.5 line-clamp-2 text-xs font-semibold leading-snug text-zinc-100">
        {o.title || 'Untitled output'}
      </p>
      {o.event && <p className="mb-2 truncate text-[10px] text-zinc-600">{o.event}</p>}

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300">
          {o.personnel || '—'}
        </span>
        {o.type && <span className="text-[9px] text-zinc-500">{o.type}</span>}
        {o.seconds > 0 && (
          <span className="font-mono text-[9px] text-zinc-500">{fmtRuntime(o.seconds)}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-900 pt-2">
        <span
          className={`font-mono text-[9px] ${overdue ? 'font-bold text-red-400' : 'text-zinc-600'}`}
        >
          {o.target ? `${overdue ? 'OVERDUE ' : 'due '}${fmtDate(o.target)}` : o.id}
        </span>
        <div className="flex items-center gap-1.5">
          {o.revisions > 0 && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-400">
              R{o.revisions}
            </span>
          )}
          {o.link && (
            <a
              href={o.link}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-[#00aeef] hover:text-white"
              title="Open output"
            >
              ↗
            </a>
          )}
          {!atEnd && (
            <button
              onClick={() => onAdvance(o)}
              disabled={busy}
              title={`Move to ${STAGE_META[STAGE_ORDER[STAGE_ORDER.indexOf(o.stage) + 1]].label}`}
              className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500 opacity-0 transition-all hover:border-[#00aeef]/50 hover:text-[#00aeef] group-hover:opacity-100 disabled:opacity-40"
            >
              {busy ? '…' : '→'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductionBoard({
  outputs,
  onAdvance,
  busyId,
}: {
  outputs: Output[];
  onAdvance: (o: Output) => void;
  busyId: string | null;
}) {
  return (
    <div className="custom-scrollbar overflow-x-auto pb-2">
      <div className="flex min-w-[900px] gap-3">
        {STAGE_ORDER.map((stage) => {
          const lane = outputs.filter((o) => o.stage === stage);
          const meta = STAGE_META[stage];
          return (
            <div key={stage} className="flex-1 rounded-md border border-zinc-800/80 bg-[#101012] p-3">
              <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.hex }} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
                    {meta.label}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-zinc-600">{lane.length}</span>
              </div>
              <div className="space-y-2">
                {lane.map((o) => (
                  <OutputCard key={o.id} o={o} onAdvance={onAdvance} busy={busyId === o.id} />
                ))}
                {lane.length === 0 && (
                  <p className="py-6 text-center text-[10px] italic text-zinc-700">empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductionScoreboard({ outputs, people }: { outputs: Output[]; people: string[] }) {
  const rows = people.map((name) => {
    const mine = outputs.filter((o) => (o.personnel || '').toLowerCase().includes(name.toLowerCase()));
    const done = mine.filter((o) => o.stage === 'approved' || o.stage === 'published');
    const rated = mine.map(deliveredOnTime).filter((v) => v !== null) as boolean[];
    const onTime = rated.length ? Math.round((rated.filter(Boolean).length / rated.length) * 100) : null;
    const revs = mine.length
      ? (mine.reduce((a, o) => a + (o.revisions || 0), 0) / mine.length).toFixed(1)
      : '0.0';
    return {
      name,
      total: mine.length,
      done: done.length,
      wip: mine.length - done.length,
      seconds: mine.reduce((a, o) => a + o.seconds, 0),
      onTime,
      revs,
    };
  });

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-800 text-[9px] uppercase tracking-[0.1em] text-zinc-600">
            <th className="pb-2 pr-3 font-bold">Personnel</th>
            <th className="pb-2 pr-3 text-right font-bold">Outputs</th>
            <th className="pb-2 pr-3 text-right font-bold">Delivered</th>
            <th className="pb-2 pr-3 text-right font-bold">In progress</th>
            <th className="pb-2 pr-3 text-right font-bold">Runtime</th>
            <th className="pb-2 pr-3 text-right font-bold">On time</th>
            <th className="pb-2 text-right font-bold">Avg rev</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-zinc-900 last:border-0">
              <td className="py-2.5 pr-3 font-bold uppercase tracking-wider text-zinc-200">{r.name}</td>
              <td className="py-2.5 pr-3 text-right font-mono text-white tabular-nums">{r.total}</td>
              <td className="py-2.5 pr-3 text-right font-mono text-green-400 tabular-nums">{r.done}</td>
              <td className="py-2.5 pr-3 text-right font-mono text-amber-400 tabular-nums">{r.wip}</td>
              <td className="py-2.5 pr-3 text-right font-mono text-zinc-400 tabular-nums">
                {fmtRuntime(r.seconds)}
              </td>
              <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                {r.onTime === null ? (
                  <span className="text-zinc-700">—</span>
                ) : (
                  <span className={r.onTime >= 90 ? 'text-green-400' : r.onTime >= 70 ? 'text-amber-400' : 'text-red-400'}>
                    {r.onTime}%
                  </span>
                )}
              </td>
              <td className="py-2.5 text-right font-mono text-zinc-400 tabular-nums">{r.revs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuickLogModal({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (payload: Record<string, string | number>) => void;
  submitting: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    title: '',
    event: '',
    type: OUTPUT_TYPES[0],
    runtime: '',
    personnel: 'Marx',
    role: OUTPUT_ROLES[1],
    requestedBy: '',
    dateAssigned: today,
    target: '',
    stage: STAGE_META.assigned.label,
    platform: OUTPUT_PLATFORMS[0],
    link: '',
    remarks: '',
  });
  const set = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const field =
    'w-full rounded-md border border-zinc-800/80 bg-[#0c0c0e] px-3 py-2 text-sm text-white placeholder:text-zinc-700 focus:border-[#00aeef] focus:outline-none';
  const lab = 'mb-1.5 block text-[11px] font-medium text-zinc-500';

  return (
    <div className="no-print fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto px-4 py-[8vh]">
      <div className="fixed inset-0 bg-black/85 animate-fadein" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-lg border border-zinc-800 bg-[#101012] animate-riseup">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h3 className="text-base font-bold uppercase tracking-wide text-white">Log a video output</h3>
            <p className="text-[11px] text-zinc-500">
              For work that does not pass through DMC — shoot, edit, reel, livestream.
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={lab}>Output title</label>
            <input
              className={field}
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="NSTW 2026 Day 1 Recap"
              autoFocus
            />
          </div>
          <div className="md:col-span-2">
            <label className={lab}>Event / source coverage</label>
            <input
              className={field}
              value={f.event}
              onChange={(e) => set('event', e.target.value)}
              placeholder="NSTW 2026 — Day 1"
            />
          </div>
          <div>
            <label className={lab}>Output type</label>
            <select className={field} value={f.type} onChange={(e) => set('type', e.target.value)}>
              {OUTPUT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lab}>Runtime (mm:ss)</label>
            <input
              className={field}
              value={f.runtime}
              onChange={(e) => set('runtime', e.target.value)}
              placeholder="3:12"
            />
          </div>
          <div>
            <label className={lab}>Personnel</label>
            <select
              className={field}
              value={f.personnel}
              onChange={(e) => set('personnel', e.target.value)}
            >
              {['Marx', 'Reiner', 'Xyrus', 'Pat', 'Team'].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lab}>Role</label>
            <select className={field} value={f.role} onChange={(e) => set('role', e.target.value)}>
              {OUTPUT_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lab}>Date assigned</label>
            <input
              type="date"
              className={field}
              value={f.dateAssigned}
              onChange={(e) => set('dateAssigned', e.target.value)}
            />
          </div>
          <div>
            <label className={lab}>Target date</label>
            <input
              type="date"
              className={field}
              value={f.target}
              onChange={(e) => set('target', e.target.value)}
            />
          </div>
          <div>
            <label className={lab}>Stage</label>
            <select className={field} value={f.stage} onChange={(e) => set('stage', e.target.value)}>
              {STAGE_ORDER.map((k) => (
                <option key={k}>{STAGE_META[k].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lab}>Platform</label>
            <select
              className={field}
              value={f.platform}
              onChange={(e) => set('platform', e.target.value)}
            >
              {OUTPUT_PLATFORMS.map((pl) => (
                <option key={pl}>{pl}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lab}>Requested by</label>
            <input
              className={field}
              value={f.requestedBy}
              onChange={(e) => set('requestedBy', e.target.value)}
              placeholder="CRPD / PCAARRD / etc."
            />
          </div>
          <div>
            <label className={lab}>Output link</label>
            <input
              className={field}
              value={f.link}
              onChange={(e) => set('link', e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="md:col-span-2">
            <label className={lab}>Remarks</label>
            <input
              className={field}
              value={f.remarks}
              onChange={(e) => set('remarks', e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-6 py-4">
          <p className="text-[10px] text-zinc-600">Saved directly to the Production Log.</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded border border-zinc-800 px-4 py-2 text-[13px] text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              disabled={!f.title.trim() || submitting}
              onClick={() => onSubmit(f)}
              className="rounded bg-[#00aeef] px-4 py-2 text-[13px] font-medium text-[#06121a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Saving…' : 'Save output'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================================================== ISO COMPONENTS ====== */

function ReqBadge({ status, dense = false }: { status: ReqStatus; dense?: boolean }) {
  const m = REQ_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium tracking-wide text-zinc-400 ${
        dense ? 'text-[10px]' : 'text-[11px]'
      }`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.hex }} aria-hidden />
      {m.label}
    </span>
  );
}

function SLABadge({ state }: { state: SLAState }) {
  const m = SLA_META[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wide"
      style={{ color: state === 'overdue' ? m.hex : undefined }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.hex }} aria-hidden />
      <span className={state === 'overdue' ? '' : 'text-zinc-400'}>{m.label}</span>
    </span>
  );
}

/** KPI ring — target vs actual, para sa PM 2.1 at 2.2. */
function KPIRing({
  value,
  target,
  label,
  sub,
  size = 128,
}: {
  value: number | null;
  target: number;
  label: string;
  sub: string;
  size?: number;
}) {
  const shown = useCountUp(value ?? 0);
  const r = size / 2 - 10;
  const C = 2 * Math.PI * r;
  const pass = value !== null && value >= target;
  const hex = value === null ? '#3f3f46' : pass ? '#22c55e' : '#ef4444';
  const pct = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#18181b" strokeWidth="11" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={hex}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * C} ${C}`}
            className="transition-all duration-1000"
          />
          {/* target marker */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#71717a"
            strokeWidth="11"
            strokeDasharray={`1.5 ${C}`}
            strokeDashoffset={-((target / 100) * C)}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-black text-white tabular-nums">
            {value === null ? '—' : `${shown}%`}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-600">
            target {target}%
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold uppercase tracking-wide text-white">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{sub}</p>
        <p
          className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: hex }}
        >
          {value === null ? 'No data yet' : pass ? 'On target' : 'Below target'}
        </p>
      </div>
    </div>
  );
}

/**
 * ITEM 44 — Demand vs Capacity.
 * Inihahambing ang aktwal na demand (lahat ng natanggap) sa capacity
 * (na-serve), at hayagang ipinapakita ang gap bilang basehan ng augmentation.
 */
function DemandCapacityPanel({ requests }: { requests: ServiceRequest[] }) {
  const { months, maxV, totals } = useMemo(() => {
    const map = new Map<string, { demand: number; served: number; unmet: number }>();
    requests.forEach((r) => {
      const d = r.dateRequested || r.eventDate;
      if (!d) return;
      const k = monthKey(d);
      const cur = map.get(k) || { demand: 0, served: 0, unmet: 0 };
      cur.demand += 1;
      if (REQ_META[r.status].served) cur.served += 1;
      if (REQ_META[r.status].unmet) cur.unmet += 1;
      map.set(k, cur);
    });

    const keys = Array.from(map.keys()).sort().slice(-8);
    const rows = keys.map((k) => ({ key: k, ...map.get(k)! }));
    const t = requests.reduce(
      (a, r) => {
        a.demand += 1;
        if (REQ_META[r.status].served) a.served += 1;
        if (REQ_META[r.status].unmet) a.unmet += 1;
        if (r.status === 'pending' || r.status === 'approved' || r.status === 'ongoing')
          a.inflight += 1;
        return a;
      },
      { demand: 0, served: 0, unmet: 0, inflight: 0 }
    );
    return { months: rows, maxV: Math.max(1, ...rows.map((x) => x.demand)), totals: t };
  }, [requests]);

  const W = 760;
  const H = 190;
  const PAD = 28;
  const slot = months.length ? (W - PAD * 2) / months.length : 0;
  const barW = Math.min(26, slot * 0.34);

  const capacityPct = totals.demand ? Math.round((totals.served / totals.demand) * 100) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: 'Service demand', v: totals.demand, c: '#00aeef', s: 'Total requests received' },
          { k: 'Services rendered', v: totals.served, c: '#22c55e', s: 'Completed / delivered' },
          { k: 'In progress', v: totals.inflight, c: '#f59e0b', s: 'Pending, approved, ongoing' },
          { k: 'Unmet requests', v: totals.unmet, c: '#ef4444', s: 'Declined, cancelled, moved' },
        ].map((x) => (
          <div
            key={x.k}
            className="rounded-md border border-zinc-800/80 bg-[#0c0c0e] p-4"
            style={{ borderLeftColor: x.c, borderLeftWidth: 3 }}
          >
            <p className="font-mono text-3xl font-black text-white tabular-nums">{x.v}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              {x.k}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">{x.s}</p>
          </div>
        ))}
      </div>

      {months.length > 0 ? (
        <div className="overflow-x-auto custom-scrollbar">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-[190px] w-full min-w-[560px]">
            {[0, 0.5, 1].map((f) => (
              <line
                key={f}
                x1={PAD}
                x2={W - PAD}
                y1={H - 34 - f * (H - 60)}
                y2={H - 34 - f * (H - 60)}
                stroke="#18181b"
                strokeWidth="1"
              />
            ))}
            {months.map((m, i) => {
              const x = PAD + i * slot + slot / 2;
              const dh = (m.demand / maxV) * (H - 60);
              const sh = (m.served / maxV) * (H - 60);
              const gap = m.demand - m.served;
              return (
                <g key={m.key}>
                  <rect
                    x={x - barW - 2}
                    y={H - 34 - dh}
                    width={barW}
                    height={dh}
                    rx={3}
                    fill="#00aeef"
                    opacity={0.35}
                  >
                    <title>{`${monthLabel(m.key)} — demand ${m.demand}`}</title>
                  </rect>
                  <rect
                    x={x + 2}
                    y={H - 34 - sh}
                    width={barW}
                    height={sh}
                    rx={3}
                    fill="#22c55e"
                  >
                    <title>{`${monthLabel(m.key)} — served ${m.served}`}</title>
                  </rect>
                  {gap > 0 && (
                    <text
                      x={x}
                      y={H - 40 - dh}
                      fill="#ef4444"
                      fontSize="10"
                      fontFamily="ui-monospace, monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      −{gap}
                    </text>
                  )}
                  <text
                    x={x}
                    y={H - 16}
                    fill="#52525b"
                    fontSize="10"
                    fontFamily="ui-monospace, monospace"
                    textAnchor="middle"
                  >
                    {monthLabel(m.key).toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <p className="py-8 text-center text-xs italic text-zinc-600">
          No dated requests yet. Log a request to build this chart.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-5 border-t border-zinc-900 pt-3">
        <span className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span className="h-2 w-4 rounded-sm bg-[#00aeef]/40" /> Demand (received)
        </span>
        <span className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span className="h-2 w-4 rounded-sm bg-green-500" /> Capacity (rendered)
        </span>
        <span className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span className="font-mono font-bold text-red-400">−n</span> Unserved gap
        </span>
        {capacityPct !== null && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
            Service fulfilment {capacityPct}%
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ITEM 41 — Turnaround time monitor.
 * Aktwal na processing time laban sa SLA ng Procedures Manual.
 */
function SLAMonitor({ requests }: { requests: ServiceRequest[] }) {
  const stats = useMemo(() => {
    const byStream = (['coverage', 'production'] as Stream[]).map((st) => {
      const mine = requests.filter((r) => r.stream === st);
      const tats = mine.map(actualTAT).filter((v): v is number => v !== null);
      const rated = mine.map(slaState).filter((s) => s === 'ontime' || s === 'overdue');
      return {
        stream: st,
        total: mine.length,
        avg: tats.length ? tats.reduce((a, b) => a + b, 0) / tats.length : null,
        worst: tats.length ? Math.max(...tats) : null,
        onTimePct: rated.length
          ? Math.round((rated.filter((s) => s === 'ontime').length / rated.length) * 100)
          : null,
        sla: SLA_WD[st],
      };
    });

    const live = requests.filter((r) => !r.dateDelivered);
    return {
      byStream,
      overdue: requests.filter((r) => slaState(r) === 'overdue'),
      atRisk: live.filter((r) => slaState(r) === 'atrisk'),
    };
  }, [requests]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {stats.byStream.map((x) => {
          const ratio = x.avg !== null ? Math.min(160, (x.avg / x.sla) * 100) : 0;
          const over = x.avg !== null && x.avg > x.sla;
          return (
            <div key={x.stream} className="rounded-md border border-zinc-800/80 bg-[#0c0c0e] p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: STREAM_META[x.stream].hex }}
                >
                  {STREAM_META[x.stream].label}
                </span>
                <span className="font-mono text-[10px] text-zinc-600">
                  SLA {x.sla} WD · n={x.total}
                </span>
              </div>

              <div className="flex items-end gap-3">
                <p className="font-mono text-4xl font-black leading-none text-white tabular-nums">
                  {x.avg === null ? '—' : x.avg.toFixed(1)}
                </p>
                <p className="pb-1 text-xs text-zinc-500">avg working days</p>
              </div>

              {/* SLA bar: 100% = SLA limit */}
              <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(100, ratio)}%`,
                    background: over ? '#ef4444' : '#22c55e',
                  }}
                />
                <div className="absolute inset-y-0 right-0 w-px bg-zinc-600" />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className={over ? 'font-bold text-red-400' : 'text-zinc-500'}>
                  {x.avg === null
                    ? 'Nothing delivered yet'
                    : over
                    ? `${(x.avg - x.sla).toFixed(1)} WD over standard`
                    : `${(x.sla - x.avg).toFixed(1)} WD within standard`}
                </span>
                <span className="font-mono text-zinc-500">
                  {x.onTimePct === null ? '—' : `${x.onTimePct}% on time`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {(stats.overdue.length > 0 || stats.atRisk.length > 0) && (
        <div className="rounded-md border border-zinc-800/80 bg-[#0c0c0e] p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            Needs attention · {stats.overdue.length} overdue · {stats.atRisk.length} at risk
          </p>
          <div className="space-y-2">
            {[...stats.overdue, ...stats.atRisk].slice(0, 6).map((r) => {
              const left = daysToTarget(r);
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-900 bg-[#101012] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-zinc-200">{r.title}</p>
                    <p className="font-mono text-[10px] text-zinc-600">
                      {r.id} · {r.personnel || 'Unassigned'} ·{' '}
                      {STREAM_META[r.stream].short}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-[10px] text-zinc-500">
                      {left === null ? '—' : left < 0 ? `${Math.abs(left)} WD over` : `${left} WD left`}
                    </span>
                    <SLABadge state={slaState(r)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ITEM 40 — Unmet / non-served requests, kasama ang dahilan.
 * Ito ang ebidensiyang hinahanap ng auditor: kompletong visibility sa
 * outcome AT sa hustipikasyon ng bawat request.
 */
function UnmetRequestsLog({ requests }: { requests: ServiceRequest[] }) {
  const unmet = useMemo(
    () =>
      requests
        .filter((r) => REQ_META[r.status].unmet)
        .sort((a, b) => (b.dateRequested?.getTime() ?? 0) - (a.dateRequested?.getTime() ?? 0)),
    [requests]
  );

  const missingReason = unmet.filter((r) => !r.reason.trim()).length;

  if (unmet.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
        <p className="text-sm text-zinc-300">No unserved requests for this period.</p>
        <p className="mt-1 text-xs text-zinc-600">
          All requests received were served or are still in progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {missingReason > 0 && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-2.5 text-xs text-red-300">
          {missingReason} unserved request(s) have no recorded reason. Audit Item 40 requires
          this — fill it in before the audit.
        </div>
      )}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-[9px] uppercase tracking-[0.1em] text-zinc-600">
              <th className="pb-2 pr-3 font-bold">Request</th>
              <th className="pb-2 pr-3 font-bold">Client</th>
              <th className="pb-2 pr-3 font-bold">Date</th>
              <th className="pb-2 pr-3 font-bold">Outcome</th>
              <th className="pb-2 font-bold">Reason for non-service</th>
            </tr>
          </thead>
          <tbody>
            {unmet.slice(0, 12).map((r) => (
              <tr key={r.id} className="border-b border-zinc-900 align-top last:border-0">
                <td className="py-3 pr-3">
                  <p className="font-semibold text-zinc-200">{r.title}</p>
                  <p className="font-mono text-[10px] text-zinc-600">{r.id}</p>
                </td>
                <td className="py-3 pr-3 text-zinc-400">{r.client || '—'}</td>
                <td className="py-3 pr-3 font-mono text-[10px] text-zinc-500">
                  {fmtDate(r.dateRequested)}
                </td>
                <td className="py-3 pr-3">
                  <ReqBadge status={r.status} dense />
                </td>
                <td className="py-3">
                  {r.reason.trim() ? (
                    <span className="text-zinc-300">{r.reason}</span>
                  ) : (
                    <span className="font-bold text-red-400">No reason on record</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * ISO audit scorecard — direktang mapping ng bawat audit finding sa live data.
 * Ito ang unang titingnan ng auditor: sagot na may ebidensiya.
 */
function ComplianceScorecard({
  requests,
  kpi,
  events = [],
}: {
  requests: ServiceRequest[];
  kpi: { execution: number | null; csm: number | null; rated: number };
  events?: AVEvent[];
}) {
  const rows = useMemo(() => {
    const unmet = requests.filter((r) => REQ_META[r.status].unmet);
    const withReason = unmet.filter((r) => r.reason.trim()).length;
    const tracked = requests.length;
    const withTat = requests.filter((r) => actualTAT(r) !== null).length;
    const served = requests.filter((r) => REQ_META[r.status].served).length;

    return [
      {
        item: 'Item 40',
        title: 'Request monitoring & reason for non-service',
        ask: 'Record declined, delayed and rescheduled requests together with the reason.',
        met: tracked > 0 && unmet.length === withReason,
        evidence:
          tracked === 0
            ? 'No requests on record yet.'
            : `${tracked} requests tracked across 7 statuses. ${withReason} of ${unmet.length} unserved requests have a recorded reason.`,
      },
      {
        item: 'Item 41',
        title: 'Turnaround time & workload monitoring',
        ask: 'Measure actual processing time against the standard, and the workload of each staff member.',
        met: withTat > 0,
        evidence:
          withTat === 0
            ? 'No delivered requests yet to measure.'
            : `${withTat} completed request ang may aktwal na TAT laban sa SLA (AV Coverage 3 WD, AVP Production 13 WD).`,
      },
      {
        item: 'Item 44',
        title: 'Demand vs capacity for augmentation',
        ask: 'Compare actual demand against services rendered to surface unmet requests.',
        met: tracked > 0,
        evidence: (() => {
          if (tracked === 0) return 'No demand data yet.';
          const decided = events.filter(
            (ev) => isAuthorised(ev) || !APPROVAL_META[ev.approval].live
          );
          const asked = decided.reduce((a, ev) => a + ev.requested.length, 0);
          const missed = decided.reduce((a, ev) => a + serviceGap(ev).length, 0);
          const base = `Demand ${tracked} · rendered ${served} · unmet ${unmet.length}.`;
          return asked > 0
            ? `${base} At service level: ${asked} requested, ${missed} not delivered — the basis for personnel augmentation.`
            : `${base} The monthly comparison is in the Demand vs Capacity panel.`;
        })(),
      },
      {
        item: 'PM 2.1',
        title: '100% of approved requests executed',
        ask: 'All approved requests are executed and delivered.',
        met: kpi.execution !== null && kpi.execution >= KPI_EXECUTION_TARGET,
        evidence:
          kpi.execution === null
            ? 'No approved requests yet.'
            : `${kpi.execution}% ng approved requests ay completed.`,
      },
      {
        item: 'PM 2.2',
        title: '93% rated Very Satisfactory or higher',
        ask: 'Client satisfaction rating for served requests.',
        met: kpi.csm !== null && kpi.csm >= KPI_CSM_TARGET,
        evidence:
          kpi.csm === null
            ? 'No CSM ratings recorded yet.'
            : `${kpi.csm}% ng ${kpi.rated} rated request ay Very Satisfactory pataas.`,
      },
    ];
  }, [requests, kpi, events]);

  const metCount = rows.filter((r) => r.met).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-zinc-800/80 bg-[#0c0c0e] px-5 py-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-white">
            Audit readiness
          </p>
          <p className="text-[11px] text-zinc-500">
            PM-CRPD-AV-08-04 Rev 7 · Effectivity 08 July 2025
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl font-black text-white tabular-nums">
            {metCount}
            <span className="text-lg text-zinc-600">/{rows.length}</span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">criteria met</p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.item}
            className="flex gap-4 rounded-md border border-zinc-800/80 bg-[#101012] p-4"
            style={{
              borderLeftColor: r.met ? '#22c55e' : '#f59e0b',
              borderLeftWidth: 3,
            }}
          >
            <div className="w-20 shrink-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                {r.item}
              </p>
              <p
                className="mt-1 text-[10px] font-bold uppercase"
                style={{ color: r.met ? '#22c55e' : '#f59e0b' }}
              >
                {r.met ? 'Met' : 'Partial'}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-zinc-100">{r.title}</p>
              <p className="mt-0.5 text-[11px] italic text-zinc-600">{r.ask}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{r.evidence}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ang Request Register mismo — mabilis na scan, filter at status update. */
function RequestTable({
  requests,
  onEdit,
}: {
  requests: ServiceRequest[];
  onEdit: (r: ServiceRequest) => void;
}) {
  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
        <p className="text-sm text-zinc-300">No matching requests.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-md border border-zinc-800/80 bg-[#101012]">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-800 bg-black/40 text-[9px] uppercase tracking-[0.1em] text-zinc-600">
            <th className="p-3 font-bold">Request</th>
            <th className="p-3 font-bold">Client</th>
            <th className="p-3 font-bold">Stream</th>
            <th className="p-3 font-bold">Personnel</th>
            <th className="p-3 font-bold">Received</th>
            <th className="p-3 font-bold">Target</th>
            <th className="p-3 font-bold">TAT</th>
            <th className="p-3 font-bold">Status</th>
            <th className="p-3 font-bold">SLA</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const tat = actualTAT(r);
            const st = slaState(r);
            return (
              <tr
                key={r.id}
                className="border-b border-zinc-900 transition-colors last:border-0 hover:bg-black/40"
              >
                <td className="p-3">
                  <p className="max-w-[260px] truncate font-semibold text-zinc-100">{r.title}</p>
                  <p className="font-mono text-[10px] text-zinc-600">
                    {r.id}
                    {r.serviceType ? ` · ${r.serviceType}` : ''}
                  </p>
                </td>
                <td className="p-3 text-zinc-400">
                  {r.client || '—'}
                  {r.clientType && (
                    <span className="block text-[10px] text-zinc-600">{r.clientType}</span>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className="font-mono text-[10px] font-bold"
                    style={{ color: STREAM_META[r.stream].hex }}
                  >
                    {STREAM_META[r.stream].short}
                  </span>
                </td>
                <td className="p-3 font-mono text-[10px] uppercase text-zinc-300">
                  {r.personnel || '—'}
                </td>
                <td className="p-3 font-mono text-[10px] text-zinc-500">
                  {fmtDate(r.dateRequested)}
                </td>
                <td className="p-3 font-mono text-[10px] text-zinc-500">
                  {fmtDate(effectiveTarget(r))}
                </td>
                <td className="p-3 font-mono text-[10px] tabular-nums">
                  {tat === null ? (
                    <span className="text-zinc-700">—</span>
                  ) : (
                    <span style={{ color: tat > SLA_WD[r.stream] ? '#ef4444' : '#22c55e' }}>
                      {tat} WD
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <ReqBadge status={r.status} dense />
                  {REQ_META[r.status].unmet && !r.reason.trim() && (
                    <span className="mt-1 block text-[9px] font-bold text-red-400">
                      no reason
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <SLABadge state={st} />
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => onEdit(r)}
                    className="rounded border border-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-500 transition-colors hover:border-[#00aeef]/50 hover:text-[#00aeef]"
                  >
                    Update
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Log / update ng ServiceRequest.
 * Item 40: kapag Rescheduled, Disapproved o Cancelled ang status, hindi
 * pwedeng mag-save nang no reason — hindi lang paalala, naka-block talaga.
 */
function RequestModal({
  existing,
  onClose,
  onSubmit,
  submitting,
}: {
  existing: ServiceRequest | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>, id: string | null) => void;
  submitting: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

  const [f, setF] = useState({
    title: existing?.title ?? '',
    client: existing?.client ?? '',
    clientType: existing?.clientType || 'Internal',
    stream: existing ? STREAM_META[existing.stream].label : STREAM_META.coverage.label,
    serviceType: existing?.serviceType || SERVICE_TYPES[3],
    personnel: existing?.personnel || 'Marx',
    venue: existing?.venue ?? '',
    dateRequested: existing ? iso(existing.dateRequested) : today,
    eventDate: existing ? iso(existing.eventDate) : '',
    status: existing ? REQ_META[existing.status].label : 'Pending',
    reason: existing?.reason ?? '',
    dateApproved: existing ? iso(existing.dateApproved) : '',
    targetDate: existing ? iso(existing.targetDate) : '',
    dateDelivered: existing ? iso(existing.dateDelivered) : '',
    csm: existing?.csm ? String(existing.csm) : '',
    link: existing?.link ?? '',
    remarks: existing?.remarks ?? '',
  });

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statusKey = classifyReqStatus(f.status);
  const streamKey = classifyStream(f.stream);
  const needsReason = NEEDS_REASON.includes(statusKey);
  const reasonMissing = needsReason && !f.reason.trim();

  // Live preview ng SLA target habang nagbabago ang stream / petsa
  const previewTarget = useMemo(() => {
    if (f.targetDate) return f.targetDate;
    const base = f.dateApproved || f.dateRequested;
    if (!base) return '';
    const d = parseDate(base);
    return d ? dayKey(addWorkingDays(d, SLA_WD[streamKey])) : '';
  }, [f.targetDate, f.dateApproved, f.dateRequested, streamKey]);

  const canSave = !!f.title.trim() && !reasonMissing && !submitting;

  const field =
    'w-full rounded-md border border-zinc-800/80 bg-[#0c0c0e] px-3 py-2 text-sm text-white placeholder:text-zinc-700 focus:border-[#00aeef] focus:outline-none';
  const lab = 'mb-1.5 block text-[11px] font-medium text-zinc-500';

  return (
    <div className="no-print fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto px-4 py-[6vh]">
      <div className="fixed inset-0 bg-black/85 animate-fadein" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-lg border border-zinc-800 bg-[#101012] animate-riseup">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h3 className="text-base font-bold uppercase tracking-wide text-white">
              {existing ? `Update request · ${existing.id}` : 'Log a service request'}
            </h3>
            <p className="text-[11px] text-zinc-500">
              Request Register — PM-CRPD-AV-08-04 Rev 7 · Form FR-CRPD-AV No. 001
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={lab}>Request title *</label>
            <input
              className={field}
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="NSTW 2026 Day 1 video coverage"
              autoFocus
            />
          </div>

          <div>
            <label className={lab}>Client / requesting party</label>
            <input
              className={field}
              value={f.client}
              onChange={(e) => set('client', e.target.value)}
              placeholder="CRPD / PCAARRD / etc."
            />
          </div>
          <div>
            <label className={lab}>Client type</label>
            <select
              className={field}
              value={f.clientType}
              onChange={(e) => set('clientType', e.target.value)}
            >
              <option>Internal</option>
              <option>External</option>
            </select>
          </div>

          <div>
            <label className={lab}>Service stream</label>
            <select className={field} value={f.stream} onChange={(e) => set('stream', e.target.value)}>
              <option>{STREAM_META.coverage.label}</option>
              <option>{STREAM_META.production.label}</option>
            </select>
            <p className="mt-1 font-mono text-[10px] text-zinc-600">
              SLA {SLA_WD[streamKey]} working days
            </p>
          </div>
          <div>
            <label className={lab}>Service type</label>
            <select
              className={field}
              value={f.serviceType}
              onChange={(e) => set('serviceType', e.target.value)}
            >
              {SERVICE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={lab}>Assigned personnel</label>
            <select
              className={field}
              value={f.personnel}
              onChange={(e) => set('personnel', e.target.value)}
            >
              {['Marx', 'Reiner', 'Xyrus', 'Pat', 'Team'].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lab}>Venue</label>
            <input
              className={field}
              value={f.venue}
              onChange={(e) => set('venue', e.target.value)}
              placeholder="DOST-STII / off-site"
            />
          </div>

          <div>
            <label className={lab}>Date requested</label>
            <input
              type="date"
              className={field}
              value={f.dateRequested}
              onChange={(e) => set('dateRequested', e.target.value)}
            />
          </div>
          <div>
            <label className={lab}>Event date</label>
            <input
              type="date"
              className={field}
              value={f.eventDate}
              onChange={(e) => set('eventDate', e.target.value)}
            />
          </div>

          {/* ---------------- status block ---------------- */}
          <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-black/30 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className={lab}>Status</label>
                <select
                  className={field}
                  value={f.status}
                  onChange={(e) => set('status', e.target.value)}
                >
                  {REQ_ORDER.map((k) => (
                    <option key={k}>{REQ_META[k].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lab}>Date approved</label>
                <input
                  type="date"
                  className={field}
                  value={f.dateApproved}
                  onChange={(e) => set('dateApproved', e.target.value)}
                />
              </div>
              <div>
                <label className={lab}>Date delivered</label>
                <input
                  type="date"
                  className={field}
                  value={f.dateDelivered}
                  onChange={(e) => set('dateDelivered', e.target.value)}
                />
              </div>
            </div>

            {needsReason && (
              <div className="mt-4 animate-fadein">
                <label className={lab}>
                  <span className="text-red-400">
                    Reason for non-service / delay * — required for {REQ_META[statusKey].label}
                  </span>
                </label>
                <textarea
                  className={`${field} min-h-[76px] resize-y ${
                    reasonMissing ? 'border-red-500/60' : ''
                  }`}
                  value={f.reason}
                  onChange={(e) => set('reason', e.target.value)}
                  placeholder="For example: Schedule conflict — all AV personnel deployed to another event."
                />
                <p className="mt-1 text-[10px] text-zinc-600">
                  Audit Item 40 requires a recorded reason for every unserved request.
                </p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={lab}>Target date (SLA)</label>
                <input
                  type="date"
                  className={field}
                  value={f.targetDate}
                  onChange={(e) => set('targetDate', e.target.value)}
                />
                {!f.targetDate && previewTarget && (
                  <p className="mt-1 font-mono text-[10px] text-[#00aeef]">
                    Auto: {previewTarget} ({SLA_WD[streamKey]} WD)
                  </p>
                )}
              </div>
              <div>
                <label className={lab}>CSM rating</label>
                <select className={field} value={f.csm} onChange={(e) => set('csm', e.target.value)}>
                  <option value="">Wala pa</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={String(n)}>
                      {n} — {CSM_LABELS[n]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className={lab}>Output link</label>
            <input
              className={field}
              value={f.link}
              onChange={(e) => set('link', e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className={lab}>Remarks</label>
            <input
              className={field}
              value={f.remarks}
              onChange={(e) => set('remarks', e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-6 py-4">
          <p className="text-[10px] text-zinc-600">
            {reasonMissing
              ? 'A reason is required before saving.'
              : 'Saved directly to the Request Register.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded border border-zinc-800 px-4 py-2 text-[13px] text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              disabled={!canSave}
              onClick={() => onSubmit(f, existing?.id ?? null)}
              className="rounded bg-[#00aeef] px-4 py-2 text-[13px] font-medium text-[#06121a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Saving…' : existing ? 'Save changes' : 'Log request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================= EVENT COMPONENTS ====== */

function ApprovalChip({ k, dense = false }: { k: ApprovalKey; dense?: boolean }) {
  const m = APPROVAL_META[k];
  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold tracking-wider ${
        dense ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
      } ${m.chip}`}
    >
      {m.short}
    </span>
  );
}

function FulfilChip({ f, dense = false }: { f: Fulfilment; dense?: boolean }) {
  const m = FULFIL_META[f];
  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold tracking-wider ${
        dense ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
      } ${m.chip}`}
    >
      {m.label}
    </span>
  );
}

/**
 * Ang service ledger — ito ang gitna ng buong ideya.
 * Berde = hiniling at naibigay. Pula = hiniling pero hindi naibigay.
 * Cyan = naibigay kahit hindi hiniling.
 */
function ServiceLedger({ ev, compact = false }: { ev: AVEvent; compact?: boolean }) {
  const gap = serviceGap(ev);
  const extra = serviceExtra(ev);
  const gapSet = new Set(gap.map((x) => x.toLowerCase()));

  // Hindi pa naaaprubahan — wala pang dapat ihambing, kaya neutral ang lahat.
  const pending = fulfilment(ev) === 'pending';

  if (pending) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {ev.requested.map((svc) => (
          <span
            key={svc}
            title="Requested — awaiting approval"
            className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
          >
            {svc}
          </span>
        ))}
        {ev.requested.length === 0 && (
          <span className="text-[10px] italic text-zinc-600">No services listed</span>
        )}
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <div className="flex flex-wrap gap-1.5">
        {ev.requested.map((svc) => {
          const missing = gapSet.has(svc.toLowerCase());
          return (
            <span
              key={svc}
              title={missing ? 'Requested but not delivered' : 'Requested and delivered'}
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium ${
                missing
                  ? 'border-red-500/40 bg-red-500/10 text-red-300 line-through decoration-red-500/60'
                  : 'border-green-500/30 bg-green-500/10 text-green-300'
              }`}
            >
              {missing ? '✕' : '✓'} {svc}
            </span>
          );
        })}
        {extra.map((svc) => (
          <span
            key={svc}
            title="Delivered though not originally requested"
            className="inline-flex items-center gap-1 rounded border border-[#00aeef]/40 bg-[#00aeef]/10 px-2 py-0.5 text-[10px] font-medium text-[#00aeef]"
          >
            + {svc}
          </span>
        ))}
        {ev.requested.length === 0 && (
          <span className="text-[10px] italic text-zinc-600">No services listed</span>
        )}
      </div>

      {gap.length > 0 && (
        <p className="text-[11px] leading-relaxed">
          <span className="font-bold text-red-400">
            {gap.length} service{gap.length === 1 ? '' : 's'} not delivered:
          </span>{' '}
          {ev.reason ? (
            <span className="text-zinc-400">{ev.reason}</span>
          ) : (
            <span className="font-medium text-red-400">No reason on record</span>
          )}
        </p>
      )}
    </div>
  );
}

/** Apat na hakbang matapos ang approval: coordination → docs → deliverables → archiving. */
function PipelineTrack({
  ev,
  onStep,
  compact = false,
  readOnly = false,
}: {
  ev: AVEvent;
  onStep?: (key: PipelineKey, next: PipelineState) => void;
  compact?: boolean;
  readOnly?: boolean;
}) {
  // Naka-lock hangga't walang aprubasyon, o kapag hindi ikaw ang may-ari.
  const locked = !isAuthorised(ev) || readOnly;
  const cycle: PipelineState[] = ['not-started', 'in-progress', 'done', 'na'];

  return (
    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {PIPELINE_STEPS.map((step, i) => {
        const st = ev.pipeline[step.key];
        const meta = PIPELINE_META[st];
        const clickable = !!onStep && !locked;
        return (
          <React.Fragment key={step.key}>
            {i > 0 && <span className="h-px w-2 shrink-0 bg-zinc-800" />}
            <button
              disabled={!clickable}
              onClick={() => {
                if (!onStep) return;
                const next = cycle[(cycle.indexOf(st) + 1) % cycle.length];
                onStep(step.key, next);
              }}
              title={`${step.label} — ${meta.label}${locked ? ' (awaiting approval)' : ''}\n${step.detail}`}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors ${
                clickable ? 'cursor-pointer hover:border-zinc-600' : 'cursor-default'
              } ${locked ? 'opacity-40' : ''}`}
              style={{ borderColor: st === 'not-started' ? '#27272a' : `${meta.hex}55` }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: meta.hex }}
              />
              <span
                className="text-[9px] font-bold tracking-wider"
                style={{ color: st === 'not-started' ? '#52525b' : meta.hex }}
              >
                {step.short}
              </span>
            </button>
          </React.Fragment>
        );
      })}
      {!compact && (
        <span className="ml-2 font-mono text-[10px] text-zinc-600">
          {pipelineProgress(ev)}%
        </span>
      )}
    </div>
  );
}

function EventCard({
  ev,
  crew,
  canEdit,
  onOpen,
  onStep,
}: {
  ev: AVEvent;
  crew: Assignment[];
  canEdit: boolean;
  onOpen: () => void;
  onStep: (key: PipelineKey, next: PipelineState) => void;
}) {
  const f = fulfilment(ev);
  const sla = eventSLA(ev);
  const next = nextPipelineStep(ev);
  const nextOwners = next ? ownersOfStep(next.key, crew) : [];
  const accent = FULFIL_META[f].hex;

  return (
    <div
      className="group relative overflow-hidden rounded-md border border-zinc-800/80 bg-[#101012] transition-all duration-300 hover:border-zinc-700"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
    >
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <button
            onClick={onOpen}
            title={canEdit ? 'Open this event' : 'View only — created by someone else'}
            className="min-w-0 flex-1 text-left"
          >
            <h3 className="truncate text-base font-bold leading-snug text-zinc-100 transition-colors group-hover:text-white">
              {ev.title || 'Untitled event'}
            </h3>
            <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-600">
              {ev.id} · {ev.client || 'no client'}
            {ev.createdBy && (
              <span className={canEdit ? 'text-zinc-600' : 'text-amber-600/80'}>
                {' '}· {canEdit ? 'yours' : ev.createdBy}
              </span>
            )}
              {ev.venue ? ` · ${ev.venue}` : ''}
            </p>
          </button>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <ApprovalChip k={ev.approval} dense />
            <FulfilChip f={f} dense />
          </div>
        </div>

        <div className="mb-3">
          <ServiceLedger ev={ev} compact />
        </div>

        {crew.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-900 pt-3">
            {crew.map((a) => (
              <span key={a.id} className="text-[11px] text-zinc-500">
                <span className="font-medium text-zinc-300">{a.personnel}</span>
                {a.roles.length > 0 && (
                  <span className="text-zinc-600"> — {a.roles.join(', ')}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-900 pt-3">
          <PipelineTrack ev={ev} onStep={onStep} compact readOnly={!canEdit} />
          <div className="flex items-center gap-2">
            {sla !== 'na' && <SLABadge state={sla} />}
            <span className="font-mono text-[10px] text-zinc-600">
              {ev.eventDate ? fmtDate(ev.eventDate) : fmtDate(ev.dateRequested)}
            </span>
          </div>
        </div>

        {next && (
          <p className="mt-2 text-[11px] text-zinc-500">
            Next: <span className="font-medium text-[#00aeef]">{next.label}</span>
            {nextOwners.length > 0 ? (
              <span className="text-zinc-500"> · {nextOwners.join(', ')}</span>
            ) : (
              <span className="text-amber-400"> · no one assigned to this role</span>
            )}
          </p>
        )}
        {awaitingAction(ev) && (
          <p className="mt-2 text-[10px] text-amber-400/80">
            Awaiting {ev.approval === 'for-approval' ? 'Division Chief' : 'Supervising SRS'}
          </p>
        )}
      </div>
    </div>
  );
}

/** Buod sa itaas ng Events tab — approved / declined / limited. */
function EventSummary({ events }: { events: AVEvent[] }) {
  const t = useMemo(() => {
    const base = { total: events.length, approved: 0, declined: 0, waiting: 0, full: 0, partial: 0, none: 0, gapCount: 0, noReason: 0 };
    events.forEach((ev) => {
      if (isAuthorised(ev)) base.approved += 1;
      if (!APPROVAL_META[ev.approval].live) base.declined += 1;
      if (awaitingAction(ev)) base.waiting += 1;
      const f = fulfilment(ev);
      if (f === 'full') base.full += 1;
      if (f === 'partial') base.partial += 1;
      if (f === 'none') base.none += 1;
      const gap = serviceGap(ev);
      const decided = ev.approval === 'approved' || !APPROVAL_META[ev.approval].live;
      if (gap.length && decided) {
        if (ev.approval === 'approved') base.gapCount += gap.length;
        if (!ev.reason.trim()) base.noReason += 1;
      }
    });
    return base;
  }, [events]);

  const tiles = [
    { k: 'Total events', v: t.total, c: '#00aeef', s: 'Requests on record' },
    { k: 'Approved', v: t.approved, c: '#22c55e', s: `${t.full} fully served` },
    { k: 'Limited service', v: t.partial, c: '#f59e0b', s: `${t.gapCount} service${t.gapCount === 1 ? '' : 's'} short` },
    { k: 'Declined', v: t.declined, c: '#ef4444', s: 'Not served' },
    { k: 'Awaiting action', v: t.waiting, c: '#a1a1aa', s: 'With the approver' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((x) => (
          <div
            key={x.k}
            className="rounded-md border border-zinc-800/80 bg-[#101012] p-4"
            style={{ borderTopColor: x.c, borderTopWidth: 2 }}
          >
            <p className="font-mono text-3xl font-black text-white tabular-nums">{x.v}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              {x.k}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">{x.s}</p>
          </div>
        ))}
      </div>
      {t.noReason > 0 && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-2.5 text-xs text-red-300">
          {t.noReason} event(s) have undelivered services with no recorded reason. Audit
          Item 40 requires this — open the event and add the reason.
        </div>
      )}
    </div>
  );
}

/**
 * Buong detalye at pag-edit ng isang event.
 * Dalawang hanay ng checkbox: HINILING at NAIBIGAY. Awtomatikong lumalabas
 * ang agwat, at hindi makaka-save nang no reason kapag may kulang.
 */
function EventModal({
  existing,
  onClose,
  onSubmit,
  onNotify,
  submitting,
  roster,
  role,
  canEdit,
}: {
  existing: AVEvent | null;
  onClose: () => void;
  onSubmit: (
    payload: Record<string, string>,
    id: string | null,
    crew: { personnel: string; roles: string[]; status: string }[]
  ) => void;
  onNotify: (id: string) => void;
  submitting: boolean;
  roster: Assignment[];
  role: string;
  canEdit: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

  const [f, setF] = useState({
    title: existing?.title ?? '',
    client: existing?.client ?? '',
    clientType: existing?.clientType || 'Internal',
    venue: existing?.venue ?? '',
    dateRequested: existing ? iso(existing.dateRequested) : today,
    eventDate: existing ? iso(existing.eventDate) : '',
    endDate: existing ? iso(existing.endDate) : '',
    approvalStatus: existing ? APPROVAL_META[existing.approval].label : 'For endorsement',
    reason: existing?.reason ?? '',
    lead: existing?.lead || 'Xyrus',
    team: existing?.team ?? '',
    targetDate: existing ? iso(existing.targetDate) : '',
    dateDelivered: existing ? iso(existing.dateDelivered) : '',
    csm: existing?.csm ? String(existing.csm) : '',
    link: existing?.link ?? '',
    remarks: existing?.remarks ?? '',
  });

  const [requested, setRequested] = useState<string[]>(existing?.requested ?? []);
  const [delivered, setDelivered] = useState<string[]>(existing?.delivered ?? []);
  const [pipeline, setPipeline] = useState<Record<PipelineKey, PipelineState>>(
    existing?.pipeline ?? {
      coordination: 'not-started',
      documents: 'not-started',
      deliverables: 'not-started',
      archiving: 'not-started',
    }
  );

  /** Roster: isang row bawat tao, maraming papel kada tao. */
  const [crew, setCrew] = useState<{ personnel: string; roles: string[]; status: string }[]>(
    roster && roster.length
      ? roster.map((a) => ({ personnel: a.personnel, roles: a.roles, status: a.status }))
      : [{ personnel: 'Xyrus', roles: [], status: 'Assigned' }]
  );

  const setCrewAt = (
    i: number,
    patch: Partial<{ personnel: string; roles: string[]; status: string }>
  ) => setCrew((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const toggleRole = (i: number, role: string) =>
    setCrewAt(i, {
      roles: crew[i].roles.includes(role)
        ? crew[i].roles.filter((r) => r !== role)
        : [...crew[i].roles, role],
    });

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (list: string[], setList: (v: string[]) => void, svc: string) =>
    setList(list.includes(svc) ? list.filter((x) => x !== svc) : [...list, svc]);

  const approvalKey = classifyApproval(f.approvalStatus);
  const gap = requested.filter((x) => !delivered.includes(x));
  const extra = delivered.filter((x) => !requested.includes(x));

  const notApproved = !APPROVAL_META[approvalKey].live;
  const hasGap = approvalKey === 'approved' && gap.length > 0 && delivered.length >= 0;
  const reasonRequired = notApproved || (hasGap && requested.length > 0);
  const reasonMissing = reasonRequired && !f.reason.trim();

  const heavy = new Set(HEAVY_SERVICES.map((x) => x.toLowerCase()));
  const sla = requested.some((x) => heavy.has(x.toLowerCase()))
    ? SLA_WD.production
    : SLA_WD.coverage;

  const previewTarget = useMemo(() => {
    if (f.targetDate) return f.targetDate;
    const base = f.dateRequested;
    if (!base) return '';
    const d = parseDate(base);
    return d ? dayKey(addWorkingDays(d, sla)) : '';
  }, [f.targetDate, f.dateRequested, sla]);

  // Ang mga approver ay maaaring mag-aprub, pero hindi mag-edit ng nilalaman.
  const isApprover = role === 'dc' || role === 'srs';
  const approvalOnly = isApprover && !!existing;
  const readOnly = !!existing && !canEdit && !isApprover;

  const canSave =
    !!f.title.trim() && !reasonMissing && !submitting && (canEdit || approvalOnly);

  const field =
    `w-full rounded-md border border-zinc-800/80 bg-[#0c0c0e] px-3 py-2 text-sm text-white placeholder:text-zinc-700 focus:border-[#00aeef] focus:outline-none${
      readOnly || approvalOnly ? ' pointer-events-none opacity-50' : ''
    }`;
  const lab = 'mb-1.5 block text-[11px] font-medium text-zinc-500';

  const submit = () =>
    onSubmit(
      {
        ...f,
        lead: crew.find((c) => c.roles.length)?.personnel || f.lead,
        team: crew.map((c) => c.personnel).filter(Boolean).join(', '),
        requestedServices: requested.join(', '),
        deliveredServices: delivered.join(', '),
        coordination: PIPELINE_META[pipeline.coordination].label,
        documents: PIPELINE_META[pipeline.documents].label,
        deliverables: PIPELINE_META[pipeline.deliverables].label,
        archiving: PIPELINE_META[pipeline.archiving].label,
      },
      existing?.id ?? null,
      crew.filter((c) => c.personnel && c.roles.length)
    );

  return (
    <div className="no-print fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto px-4 py-[5vh]">
      <div className="fixed inset-0 bg-black/85 animate-fadein" onClick={onClose} />
      <div className="relative w-full max-w-4xl rounded-lg border border-zinc-800 bg-[#101012] animate-riseup">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold uppercase tracking-wide text-white">
              {existing ? existing.title || existing.id : 'New event request'}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {existing ? `${existing.id} · ` : ''}Request Form FR-CRPD-AV No. 001 ·
              PM-CRPD-AV-08-04 Rev 7
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={lab}>Event title *</label>
              <input
                className={field}
                value={f.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="NAST Scientific Meeting"
                autoFocus
              />
            </div>

            <div>
              <label className={lab}>Client / requesting party</label>
              <input
                className={field}
                value={f.client}
                onChange={(e) => set('client', e.target.value)}
                placeholder="NAST / PAGASA / CRPD"
              />
            </div>
            <div>
              <label className={lab}>Client type</label>
              <select
                className={field}
                value={f.clientType}
                onChange={(e) => set('clientType', e.target.value)}
              >
                <option>Internal</option>
                <option>External</option>
              </select>
            </div>

            <div>
              <label className={lab}>Event date</label>
              <input
                type="date"
                className={field}
                value={f.eventDate}
                onChange={(e) => set('eventDate', e.target.value)}
              />
            </div>
            <div>
              <label className={lab}>End date (if multi-day)</label>
              <input
                type="date"
                className={field}
                value={f.endDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </div>

            <div>
              <label className={lab}>Venue</label>
              <input
                className={field}
                value={f.venue}
                onChange={(e) => set('venue', e.target.value)}
                placeholder="PICC / DOST-STII"
              />
            </div>
            <div>
              <label className={lab}>Date requested</label>
              <input
                type="date"
                className={field}
                value={f.dateRequested}
                onChange={(e) => set('dateRequested', e.target.value)}
              />
            </div>

            {/* ----------- ang service ledger ----------- */}
            <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-black/30 p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
                  Serbisyo — hiniling laban sa naibigay
                </p>
                <span className="font-mono text-[10px] text-zinc-600">SLA {sla} WD</span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className={lab}>Requested by the client</p>
                  <div className="space-y-1">
                    {SERVICE_CATALOG.map((svc) => (
                      <label
                        key={svc}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900/60"
                      >
                        <input
                          type="checkbox"
                          className="accent-[#00aeef]"
                          checked={requested.includes(svc)}
                          onChange={() => toggle(requested, setRequested, svc)}
                        />
                        {svc}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className={lab}>Aktwal na naibigay</p>
                  <div className="space-y-1">
                    {SERVICE_CATALOG.map((svc) => {
                      const asked = requested.includes(svc);
                      const got = delivered.includes(svc);
                      const missing = asked && !got;
                      return (
                        <label
                          key={svc}
                          className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-zinc-900/60 ${
                            missing ? 'text-red-400' : got ? 'text-green-400' : 'text-zinc-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-green-500"
                            checked={got}
                            onChange={() => toggle(delivered, setDelivered, svc)}
                          />
                          {svc}
                          {missing && <span className="ml-auto text-[9px] font-bold">KULANG</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {(gap.length > 0 || extra.length > 0) && (
                <div className="mt-3 space-y-1 border-t border-zinc-900 pt-3 text-[11px]">
                  {gap.length > 0 && (
                    <p className="text-red-400">
                      <b>{gap.length} not delivered:</b> {gap.join(', ')}
                    </p>
                  )}
                  {extra.length > 0 && (
                    <p className="text-[#00aeef]">
                      <b>Dagdag na naibigay:</b> {extra.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ----------- approval ----------- */}
            <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-black/30 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={lab}>Approval status</label>
                  <select
                    className={field}
                    value={f.approvalStatus}
                    onChange={(e) => set('approvalStatus', e.target.value)}
                  >
                    {APPROVAL_ORDER.map((k) => (
                      <option key={k}>{APPROVAL_META[k].label}</option>
                    ))}
                  </select>
                  {existing && APPROVAL_META[approvalKey].live && approvalKey !== 'approved' && (
                    <button
                      onClick={() => onNotify(existing.id)}
                      className="mt-2 w-full rounded-lg border border-[#00aeef]/40 px-3 py-1.5 text-[10px] font-bold text-[#00aeef] transition-colors hover:bg-[#00aeef]/10"
                    >
                      Send approval email
                    </button>
                  )}
                </div>
              </div>

              {/* ------------------------- CREW & ROLES ------------------- */}
              <div className="mt-5 border-t border-zinc-800/80 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-zinc-400">Crew &amp; roles</p>
                    <p className="text-[11px] text-zinc-600">
                      One person may hold several roles. Each role is counted separately in the IPCR.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setCrew((prev) => [...prev, { personnel: 'Marx', roles: [], status: 'Assigned' }])
                    }
                    className="rounded border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                  >
                    Add person
                  </button>
                </div>

                <div className="space-y-2">
                  {crew.map((c, i) => (
                    <div key={i} className="rounded border border-zinc-800/80 bg-[#0c0c0e] p-3">
                      <div className="mb-2.5 flex items-center gap-2">
                        <select
                          value={c.personnel}
                          onChange={(e) => setCrewAt(i, { personnel: e.target.value })}
                          className="rounded border border-zinc-800 bg-[#101012] px-2 py-1 text-[12px] font-medium text-zinc-200 focus:border-[#00aeef] focus:outline-none"
                        >
                          {['Xyrus', 'Marx', 'Reiner', 'Pat', 'Team'].map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                        <select
                          value={c.status}
                          onChange={(e) => setCrewAt(i, { status: e.target.value })}
                          className="rounded border border-zinc-800 bg-[#101012] px-2 py-1 text-[12px] text-zinc-400 focus:border-[#00aeef] focus:outline-none"
                        >
                          {ASSIGN_STATUS.map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                        <span className="ml-auto font-mono text-[11px] text-zinc-600">
                          {c.roles.length} role{c.roles.length === 1 ? '' : 's'}
                        </span>
                        {crew.length > 1 && (
                          <button
                            onClick={() => setCrew((prev) => prev.filter((_, j) => j !== i))}
                            className="text-[12px] text-zinc-600 transition-colors hover:text-red-400"
                            aria-label="Remove person"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {ROLE_CATALOG.map((role) => {
                          const on = c.roles.includes(role);
                          return (
                            <button
                              key={role}
                              onClick={() => toggleRole(i, role)}
                              className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                                on
                                  ? 'border-[#00aeef]/40 bg-[#00aeef]/10 text-[#00aeef]'
                                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                              }`}
                            >
                              {role}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {existing && (
                <p className="mt-3 font-mono text-[10px] text-zinc-600">
                  {existing.endorsedBy
                    ? `Endorsed by ${existing.endorsedBy}${
                        existing.dateEndorsed ? ` · ${fmtDate(existing.dateEndorsed)}` : ''
                      }`
                    : 'Not yet endorsed'}
                  {' — '}
                  {existing.approvedBy
                    ? `Approved by ${existing.approvedBy}${
                        existing.dateApproved ? ` · ${fmtDate(existing.dateApproved)}` : ''
                      }`
                    : 'not yet approved'}
                </p>
              )}

              {existing && existing.history.length > 0 && (
                <div className="mt-4 border-t border-zinc-800/80 pt-3">
                  <p className="mb-2 text-[11px] font-medium text-zinc-400">Change history</p>
                  <div className="max-h-32 space-y-1 overflow-y-auto custom-scrollbar">
                    {existing.history
                      .slice()
                      .reverse()
                      .map((line, i) => (
                        <p key={i} className="font-mono text-[10px] leading-relaxed text-zinc-600">
                          {line}
                        </p>
                      ))}
                  </div>
                </div>
              )}

              {reasonRequired && (
                <div className="mt-4 animate-fadein">
                  <label className={lab}>
                    <span className="text-red-400">
                      Reason * —{' '}
                      {notApproved
                        ? `required when ${APPROVAL_META[approvalKey].label}`
                        : 'required when services were not delivered'}
                    </span>
                  </label>
                  <textarea
                    className={`${field} min-h-[76px] resize-y ${
                      reasonMissing ? 'border-red-500/60' : ''
                    }`}
                    value={f.reason}
                    onChange={(e) => set('reason', e.target.value)}
                    placeholder="For example: Hybrid livestream not provided — no available personnel, team deployed to another DOST event."
                  />
                  <p className="mt-1 text-[10px] text-zinc-600">
                    Audit Item 40 at 44: ito ang ebidensiya para sa personnel augmentation.
                  </p>
                </div>
              )}
            </div>

            {/* ----------- pipeline ----------- */}
            <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-black/30 p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
                Execution pipeline
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {PIPELINE_STEPS.map((step) => (
                  <div key={step.key}>
                    <label className={lab}>{step.label}</label>
                    <select
                      className={field}
                      value={PIPELINE_META[pipeline[step.key]].label}
                      onChange={(e) =>
                        setPipeline((p) => ({
                          ...p,
                          [step.key]: classifyPipeline(e.target.value),
                        }))
                      }
                    >
                      {(['not-started', 'in-progress', 'done', 'na'] as PipelineState[]).map((st) => (
                        <option key={st}>{PIPELINE_META[st].label}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[9px] leading-tight text-zinc-600">{step.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className={lab}>Target date (SLA)</label>
              <input
                type="date"
                className={field}
                value={f.targetDate}
                onChange={(e) => set('targetDate', e.target.value)}
              />
              {!f.targetDate && previewTarget && (
                <p className="mt-1 font-mono text-[10px] text-[#00aeef]">
                  Auto: {previewTarget} ({sla} WD)
                </p>
              )}
            </div>
            <div>
              <label className={lab}>Date delivered</label>
              <input
                type="date"
                className={field}
                value={f.dateDelivered}
                onChange={(e) => set('dateDelivered', e.target.value)}
              />
            </div>

            <div>
              <label className={lab}>CSM rating</label>
              <select className={field} value={f.csm} onChange={(e) => set('csm', e.target.value)}>
                <option value="">Wala pa</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} — {CSM_LABELS[n]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lab}>Output link</label>
              <input
                className={field}
                value={f.link}
                onChange={(e) => set('link', e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className="md:col-span-2">
              <label className={lab}>Remarks</label>
              <input
                className={field}
                value={f.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-6 py-4">
          <p className="text-[10px] text-zinc-600">
            {readOnly
              ? `View only — this event belongs to ${existing?.createdBy || 'someone else'}.`
              : approvalOnly
              ? 'You may approve or decline. Editing the record is done by its owner.'
              : reasonMissing
              ? 'A reason is required before saving.'
              : 'Saved directly to the Events sheet.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded border border-zinc-800 px-4 py-2 text-[13px] text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              disabled={!canSave}
              onClick={submit}
              className="rounded bg-[#00aeef] px-4 py-2 text-[13px] font-medium text-[#06121a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting
                ? 'Saving…'
                : approvalOnly
                ? 'Record decision'
                : existing
                ? 'Save changes'
                : 'Create event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ITEM 44, service-level — ang pinakamalakas na ebidensiya para sa augmentation.
 * Hindi bilang ng request, kundi bilang ng SERBISYONG hiniling pero hindi
 * naibigay, kasama ang dahilan.
 */
function ServiceGapPanel({ events }: { events: AVEvent[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, { asked: number; given: number; missed: number }>();
    events.forEach((ev) => {
      // Naghihintay pa ng approval — wala pang masasabing naibigay o hindi
      if (APPROVAL_META[ev.approval].live && ev.approval !== 'approved') return;
      if (!APPROVAL_META[ev.approval].live) {
        // Declined: bilangin pa rin ang hiniling — demand pa rin 'yon
        ev.requested.forEach((svc) => {
          const cur = map.get(svc) || { asked: 0, given: 0, missed: 0 };
          cur.asked += 1;
          cur.missed += 1;
          map.set(svc, cur);
        });
        return;
      }
      const got = new Set(ev.delivered.map((x) => x.toLowerCase()));
      ev.requested.forEach((svc) => {
        const cur = map.get(svc) || { asked: 0, given: 0, missed: 0 };
        cur.asked += 1;
        if (got.has(svc.toLowerCase())) cur.given += 1;
        else cur.missed += 1;
        map.set(svc, cur);
      });
    });
    return Array.from(map.entries())
      .map(([svc, v]) => ({ svc, ...v, rate: v.asked ? v.given / v.asked : 0 }))
      .sort((a, b) => b.missed - a.missed || b.asked - a.asked);
  }, [events]);

  const totals = rows.reduce(
    (a, r) => ({ asked: a.asked + r.asked, missed: a.missed + r.missed }),
    { asked: 0, missed: 0 }
  );

  const reasons = useMemo(() => {
    const list: { ev: AVEvent; gap: string[] }[] = [];
    events.forEach((ev) => {
      const gap = serviceGap(ev);
      if (gap.length && ev.reason.trim()) list.push({ ev, gap });
    });
    return list.slice(0, 5);
  }, [events]);

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-xs italic text-zinc-600">
        No services recorded yet. Create an event to build the gap analysis.
      </p>
    );
  }

  const max = Math.max(1, ...rows.map((r) => r.asked));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { k: 'Services requested', v: totals.asked, c: '#00aeef' },
          { k: 'Services delivered', v: totals.asked - totals.missed, c: '#22c55e' },
          { k: 'Services not delivered', v: totals.missed, c: '#ef4444' },
        ].map((x) => (
          <div
            key={x.k}
            className="rounded-md border border-zinc-800/80 bg-[#0c0c0e] p-4"
            style={{ borderLeftColor: x.c, borderLeftWidth: 3 }}
          >
            <p className="font-mono text-3xl font-black text-white tabular-nums">{x.v}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              {x.k}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.svc}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-semibold text-zinc-300">{r.svc}</span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">
                {r.given}/{r.asked} delivered
                {r.missed > 0 && (
                  <span className="ml-2 font-bold text-red-400">−{r.missed}</span>
                )}
              </span>
            </div>
            <div
              className="flex h-2 overflow-hidden rounded-full bg-zinc-900"
              style={{ width: `${Math.max(12, (r.asked / max) * 100)}%` }}
            >
              <div
                className="h-full bg-green-500 transition-all duration-1000"
                style={{ width: `${r.asked ? (r.given / r.asked) * 100 : 0}%` }}
              />
              <div
                className="h-full bg-red-500 transition-all duration-1000"
                style={{ width: `${r.asked ? (r.missed / r.asked) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {reasons.length > 0 && (
        <div className="rounded-md border border-zinc-800/80 bg-[#0c0c0e] p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            Recorded reasons for non-delivery
          </p>
          <div className="space-y-2.5">
            {reasons.map(({ ev, gap }) => (
              <div key={ev.id} className="border-l-2 border-red-500/50 pl-3">
                <p className="text-xs font-semibold text-zinc-200">{ev.title}</p>
                <p className="mt-0.5 text-[10px] text-red-400">
                  Not delivered: {gap.join(', ')}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">{ev.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- KIOSK ---- */

function KioskMode({
  coverages,
  outputs,
  requests,
  kpi,
  stats,
  workload,
  upNext,
  onClose,
}: {
  coverages: Coverage[];
  outputs: Output[];
  requests: ServiceRequest[];
  kpi: { execution: number | null; csm: number | null; rated: number };
  stats: { counts: Record<StatusKey, number>; total: number; thisMonth: number };
  workload: { name: string; count: number; cov: number; out: number }[];
  upNext: Coverage[];
  onClose: () => void;
}) {
  const SLIDE_MS = 12000;
  const SLIDES = 6;
  const [slide, setSlide] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES), SLIDE_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setSlide((s) => (s + 1) % SLIDES);
      if (e.key === 'ArrowLeft') setSlide((s) => (s + SLIDES - 1) % SLIDES);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [onClose]);

  const cleared = stats.counts.transferred + stats.counts.archived;
  const wip = outputs.filter((o) => o.stage !== 'approved' && o.stage !== 'published').slice(0, 6);
  const titles = [
    'AV TEAM STATUS',
    'OPERATIONS PULSE',
    'PRODUCTION BOARD',
    'SERVICE PERFORMANCE',
    'UP NEXT',
    'AV CALENDAR',
  ];

  const svc = useMemo(() => {
    const served = requests.filter((r) => REQ_META[r.status].served).length;
    const unmet = requests.filter((r) => REQ_META[r.status].unmet).length;
    const overdue = requests.filter((r) => slaState(r) === 'overdue').length;
    return { demand: requests.length, served, unmet, overdue };
  }, [requests]);

  const ticker = useMemo(() => {
    const bits: string[] = [];
    coverages.slice(0, 6).forEach((c) => bits.push(`${fmtDate(c.dateObj, c.date)} — ${c.details}`));
    outputs.slice(0, 4).forEach((o) => bits.push(`${o.title} [${STAGE_META[o.stage].label.toUpperCase()}]`));
    requests
      .slice(0, 4)
      .forEach((r) => bits.push(`${r.title} [${REQ_META[r.status].label.toUpperCase()}]`));
    return bits.length ? bits.join('    •    ') : 'AV NEXUS · DOST-STII · Broadcast & Digital Media Section';
  }, [coverages, outputs, requests]);

  return (
    <div className="no-print fixed inset-0 z-[120] flex flex-col bg-black text-zinc-200">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-zinc-900 px-6 py-4 md:px-10 md:py-6">
        <div className="flex items-center gap-4">
          <span className="h-2 w-2 rounded-full bg-[#00aeef]" />
          <span className="font-display text-2xl font-black uppercase tracking-tight text-white">
            AV <span className="text-[#00aeef]">Nexus</span>
          </span>
          <span className="ml-2 hidden font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-600 md:block">
            {titles[slide]}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="font-mono text-2xl font-black text-white tabular-nums md:text-3xl">
              {now.toLocaleTimeString('en-PH', { hour12: false })}
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              {now.toLocaleDateString('en-PH', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-800 px-3 py-2 text-xs font-bold text-zinc-500 transition-colors hover:text-white"
          >
            ✕ Exit
          </button>
        </div>
      </div>

      {/* slide body */}
      <div key={slide} className="animate-fadein flex-1 overflow-hidden px-6 py-6 md:px-10 md:py-8">
        {slide === 0 && (
          <div className="grid h-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {TEAM.map((m) => {
              const act = latestActivityFor(m.name, coverages, outputs);
              const w = workload.find((x) => x.name === m.name);
              return (
                <div
                  key={m.name}
                  className="flex flex-col rounded-lg border border-zinc-800/80 bg-[#101012] p-8"
                >
                  <div className="mb-6 flex items-center gap-5">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[#00aeef]/50">
                      <img src={m.image} alt={m.name} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="text-3xl font-black uppercase tracking-wider text-white">
                        {m.name}
                      </p>
                      <p className="font-mono text-xs text-zinc-500">
                        {w?.cov ?? 0} cov · {w?.out ?? 0} vid
                      </p>
                    </div>
                  </div>
                  {act ? (
                    <>
                      <p className="mb-4 line-clamp-3 flex-1 text-lg leading-snug text-zinc-300">
                        {act.kind === 'coverage' ? act.cov.details : act.out.title}
                      </p>
                      <div className="flex items-center justify-between">
                        {act.kind === 'coverage' ? (
                          <StatusBadge status={act.cov.status} />
                        ) : (
                          <StageBadge stage={act.out.stage} />
                        )}
                        <span className="font-mono text-xs text-zinc-500">{fmtDate(act.when)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="flex-1 text-sm italic text-zinc-600">Standby</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {slide === 1 && (
          <div className="flex h-full flex-col justify-center gap-12">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {[
                { label: 'Total coverages', v: stats.total, accent: '#00aeef' },
                { label: 'DMC cleared', v: cleared, accent: '#22c55e' },
                { label: 'This month', v: stats.thisMonth, accent: '#ef4444' },
              ].map((x) => (
                <div
                  key={x.label}
                  className="rounded-lg border border-zinc-800/80 bg-[#101012] p-10 text-center"
                >
                  <p className="font-mono text-7xl font-black text-white tabular-nums md:text-8xl">
                    {x.v}
                  </p>
                  <p
                    className="mt-3 text-sm font-bold uppercase tracking-[0.14em]"
                    style={{ color: x.accent }}
                  >
                    {x.label}
                  </p>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-3 flex h-5 w-full overflow-hidden rounded-full bg-zinc-900">
                {STATUS_ORDER.map((k) =>
                  stats.counts[k] > 0 && stats.total > 0 ? (
                    <div
                      key={k}
                      style={{
                        width: `${(stats.counts[k] / stats.total) * 100}%`,
                        background: STATUS_META[k].hex,
                      }}
                    />
                  ) : null
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-6">
                {STATUS_ORDER.map((k) => (
                  <span key={k} className="flex items-center gap-2 text-sm text-zinc-400">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: STATUS_META[k].hex }}
                    />
                    {STATUS_META[k].label} ·{' '}
                    <span className="font-mono text-white">{stats.counts[k]}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {slide === 2 && (
          <div className="flex h-full flex-col gap-8">
            <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
              {STAGE_ORDER.map((k) => (
                <div
                  key={k}
                  className="rounded-md border border-zinc-800/80 bg-[#101012] p-5 text-center"
                >
                  <p className="font-mono text-4xl font-black text-white tabular-nums md:text-5xl">
                    {outputs.filter((o) => o.stage === k).length}
                  </p>
                  <p
                    className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: STAGE_META[k].hex }}
                  >
                    {STAGE_META[k].label}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex-1 space-y-3 overflow-hidden">
              {wip.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-6 rounded-md border border-zinc-800/80 bg-[#101012] px-6 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xl font-bold text-zinc-100">{o.title}</p>
                    <p className="font-mono text-xs text-zinc-500">
                      {o.personnel} · {o.role || o.type}
                      {o.target ? ` · due ${fmtDate(o.target)}` : ''}
                    </p>
                  </div>
                  <StageBadge stage={o.stage} />
                </div>
              ))}
              {wip.length === 0 && (
                <p className="pt-16 text-center text-lg italic text-zinc-600">
                  No outputs in progress.
                </p>
              )}
            </div>
          </div>
        )}

        {slide === 3 && (
          <div className="flex h-full flex-col justify-center gap-10">
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {[
                { k: 'Service demand', v: svc.demand, c: '#00aeef' },
                { k: 'Services rendered', v: svc.served, c: '#22c55e' },
                { k: 'Unmet requests', v: svc.unmet, c: '#ef4444' },
                { k: 'Past due', v: svc.overdue, c: '#f59e0b' },
              ].map((x) => (
                <div
                  key={x.k}
                  className="rounded-lg border border-zinc-800/80 bg-[#101012] p-8 text-center"
                >
                  <p className="font-mono text-6xl font-black text-white tabular-nums md:text-7xl">
                    {x.v}
                  </p>
                  <p
                    className="mt-3 text-xs font-bold uppercase tracking-[0.14em]"
                    style={{ color: x.c }}
                  >
                    {x.k}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {[
                {
                  label: 'Requests executed',
                  v: kpi.execution,
                  t: KPI_EXECUTION_TARGET,
                  sub: 'PM 2.1 — 100% of approved requests delivered',
                },
                {
                  label: 'CSM very satisfactory+',
                  v: kpi.csm,
                  t: KPI_CSM_TARGET,
                  sub: `PM 2.2 — at least 93% (${kpi.rated} rated)`,
                },
              ].map((x) => {
                const pass = x.v !== null && x.v >= x.t;
                const hex = x.v === null ? '#3f3f46' : pass ? '#22c55e' : '#ef4444';
                return (
                  <div
                    key={x.label}
                    className="rounded-lg border border-zinc-800/80 bg-[#101012] p-8"
                  >
                    <div className="mb-4 flex items-baseline justify-between">
                      <span className="text-sm font-bold uppercase tracking-[0.1em] text-zinc-300">
                        {x.label}
                      </span>
                      <span className="font-mono text-4xl font-black tabular-nums" style={{ color: hex }}>
                        {x.v === null ? '—' : `${x.v}%`}
                      </span>
                    </div>
                    <div className="relative h-3 overflow-hidden rounded-full bg-zinc-900">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, x.v ?? 0)}%`, background: hex }}
                      />
                      <div
                        className="absolute inset-y-0 w-0.5 bg-zinc-500"
                        style={{ left: `${x.t}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">{x.sub}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {slide === 4 && (
          <div className="flex h-full flex-col justify-center gap-6">
            {upNext.map((c, i) => (
              <div
                key={i}
                className="flex flex-col items-start gap-3 rounded-2xl border-l-4 border-red-500 bg-[#101012] px-8 py-6 md:flex-row md:items-center md:gap-8"
              >
                <div className="w-44 shrink-0">
                  <p className="font-mono text-2xl font-black text-white">{fmtDate(c.dateObj)}</p>
                  <p className="text-xs uppercase tracking-[0.1em] text-red-400">
                    {relativeDay(c.dateObj) || 'Scheduled'}
                  </p>
                </div>
                <p className="flex-1 text-xl font-bold leading-snug text-zinc-200 md:text-2xl">
                  {c.details}
                </p>
                <span className="rounded bg-zinc-800 px-3 py-1 font-mono text-sm font-bold uppercase tracking-wider text-zinc-300">
                  {c.personnel}
                </span>
              </div>
            ))}
            {upNext.length === 0 && (
              <p className="text-center text-2xl italic text-zinc-600">
                Nothing scheduled.
              </p>
            )}
          </div>
        )}

        {slide === 5 && (
          <div className="h-full overflow-hidden rounded-2xl border border-zinc-800 bg-[#0b0b0d]">
            <iframe
              src={`${CAL_EMBED}&mode=AGENDA&showTitle=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0`}
              title="AV Calendar — kiosk"
              className="kiosk-cal h-full w-full border-0"
            />
          </div>
        )}
      </div>

      {/* broadcast ticker */}
      <div className="flex items-center gap-4 overflow-hidden border-t border-zinc-900 bg-[#050506] px-6 py-2.5 md:px-10">
        <span className="shrink-0 rounded bg-red-600 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-white">
          Latest
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="kiosk-ticker flex w-max whitespace-nowrap font-mono text-xs text-zinc-400">
            <span className="pr-24">{ticker}</span>
            <span className="pr-24">{ticker}</span>
          </div>
        </div>
      </div>

      {/* bottom: progress + dots */}
      <div className="border-t border-zinc-900 px-6 py-4 md:px-10 md:py-5">
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-zinc-900">
          <div
            key={slide}
            className="h-full bg-[#00aeef]"
            style={{ animation: `kioskbar ${SLIDE_MS}ms linear forwards` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-700">
            DOST-STII · Broadcast &amp; Digital Media Section
          </p>
          <div className="flex gap-2">
            {titles.map((t, i) => (
              <button
                key={t}
                onClick={() => setSlide(i)}
                aria-label={t}
                className={`h-2 rounded-full transition-all ${
                  i === slide ? 'w-8 bg-[#00aeef]' : 'w-2 bg-zinc-800 hover:bg-zinc-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- SYSTEM WINDOW -- */

function AppWindow({
  app,
  onClose,
}: {
  app: SystemApp;
  onClose: () => void;
}) {
  const [maximized, setMaximized] = useState(false);
  const [loading, setLoading] = useState(app.embeddable);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="no-print fixed inset-0 z-[90] flex items-center justify-center p-0 md:p-6">
      <div className="absolute inset-0 bg-black/85 animate-fadein" onClick={onClose} />
      <div
        className={`relative flex flex-col overflow-hidden border border-zinc-800 bg-[#0a0a0c] animate-riseup ${
          maximized ? 'h-full w-full rounded-none' : 'h-full w-full md:h-[88vh] md:max-w-[1400px] md:rounded-2xl'
        }`}
        style={{ boxShadow: `0 0 0 1px ${app.accent}22, 0 40px 120px -20px rgba(0,0,0,0.9)` }}
      >
        {/* title bar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 bg-[#101012] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              aria-label="Close window"
              className="h-3 w-3 rounded-full bg-red-500 transition-transform hover:scale-125"
            />
            <span className="h-3 w-3 rounded-full bg-zinc-700" />
            <button
              onClick={() => setMaximized((m) => !m)}
              aria-label="Toggle maximise"
              className="h-3 w-3 rounded-full bg-zinc-600 transition-transform hover:scale-125"
            />
          </div>
          <div className="mx-2 flex min-w-0 flex-1 items-center gap-2 rounded-md border border-zinc-800 bg-black/60 px-3 py-1.5">
            <span className="text-xs" style={{ color: app.accent }} aria-hidden>
              {app.glyph}
            </span>
            <span className="truncate font-mono text-[11px] text-zinc-400">{app.url}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => {
                setLoading(app.embeddable);
                setReloadKey((k) => k + 1);
              }}
              className="rounded-md border border-zinc-800 px-2.5 py-1.5 text-[11px] font-bold text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
            >
              Reload
            </button>
            <a
              href={app.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-2.5 py-1.5 text-[11px] font-bold text-black transition-opacity hover:opacity-85"
              style={{ background: app.accent }}
            >
              Open in new tab
            </a>
          </div>
        </div>

        {/* body */}
        <div className="relative flex-1 bg-white">
          {app.embeddable ? (
            <>
              <iframe
                key={reloadKey}
                src={app.url}
                title={app.name}
                className="h-full w-full border-0 bg-white"
                onLoad={() => setLoading(false)}
              />
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#101012]">
                  <div
                    className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800"
                    style={{ borderTopColor: app.accent }}
                  />
                  <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                    Connecting to {app.name}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#101012] px-6 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl border text-2xl"
                style={{ borderColor: `${app.accent}55`, color: app.accent }}
              >
                {app.glyph}
              </div>
              <h3 className="text-lg font-bold text-white">{app.name} runs in its own tab</h3>
              <p className="max-w-md text-sm leading-relaxed text-zinc-400">
                AppSheet blocks embedding, so it cannot be framed here. Open it in a new tab instead.
              </p>
              <a
                href={app.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 rounded-lg px-5 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-85"
                style={{ background: app.accent }}
              >
                Open Tasking System ↗
              </a>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-zinc-800 bg-[#101012] px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
            {app.tag} · {app.role}
          </span>
          <span className="font-mono text-[10px] text-zinc-600">ESC to close</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- COMMAND PALETTE -- */

interface Cmd {
  id: string;
  label: string;
  hint: string;
  group: string;
  run: () => void;
}

function CommandPalette({ commands, onClose }: { commands: Cmd[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands.slice(0, 40);
    return commands
      .filter((c) => (c.label + ' ' + c.hint + ' ' + c.group).toLowerCase().includes(needle))
      .slice(0, 40);
  }, [q, commands]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = results[active];
      if (cmd) {
        cmd.run();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div className="no-print fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/80 animate-fadein" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-800 bg-[#101012] animate-riseup"
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
          <span className="text-sm text-[#00aeef]">⌘</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search systems, people, records and actions…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
          />
          <kbd className="rounded border border-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2 custom-scrollbar">
          {results.map((c, i) => {
            const showGroup = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <React.Fragment key={c.id}>
                {showGroup && (
                  <p className="px-5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                    {c.group}
                  </p>
                )}
                <button
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    c.run();
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between gap-4 px-5 py-2.5 text-left transition-colors ${
                    i === active ? 'bg-[#00aeef]/10' : 'hover:bg-zinc-900/60'
                  }`}
                >
                  <span
                    className={`truncate text-sm ${
                      i === active ? 'font-semibold text-white' : 'text-zinc-300'
                    }`}
                  >
                    {c.label}
                  </span>
                  <span className="shrink-0 truncate font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                    {c.hint}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
          {results.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-zinc-600">
              No matches. Try an event title or a person's name.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- PERSONNEL PANEL -- */

function PersonnelDrawer({
  name,
  image,
  records,
  onClose,
  onGenerateIPCR,
}: {
  name: string;
  image: string;
  records: Coverage[];
  onClose: () => void;
  onGenerateIPCR: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const counts = useMemo(() => {
    const base: Record<StatusKey, number> = {
      pending: 0,
      upcoming: 0,
      checked: 0,
      transferred: 0,
      archived: 0,
    };
    records.forEach((r) => (base[classifyStatus(r.status)] += 1));
    return base;
  }, [records]);

  return (
    <div className="no-print fixed inset-0 z-[85] flex justify-end">
      <div className="absolute inset-0 bg-black/70 animate-fadein" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-[#101012] animate-slidein">
        <div className="flex items-center gap-4 border-b border-zinc-800 p-6">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[#00aeef]/60">
            <img src={image} alt={name} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-black uppercase tracking-wider text-white">
              {OFFICIAL[name]?.fullName || name}
            </h3>
            <p className="truncate text-xs text-zinc-500">{OFFICIAL[name]?.designation}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-px border-b border-zinc-800 bg-zinc-800">
          {[
            { k: 'Total', v: records.length },
            { k: 'Cleared', v: counts.transferred + counts.archived },
            { k: 'Pending', v: counts.pending },
          ].map((s) => (
            <div key={s.k} className="bg-[#101012] p-4 text-center">
              <p className="font-mono text-2xl font-black text-white tabular-nums">{s.v}</p>
              <p className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">{s.k}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600">
            Deployment history
          </p>
          <div className="space-y-3">
            {records.map((r, i) => (
              <div key={i} className="rounded-md border border-zinc-800/80 bg-[#0c0c0e] p-3">
                <p className="mb-2 text-sm leading-snug text-zinc-200">{r.details}</p>
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={r.status} dense />
                  <span className="font-mono text-[10px] text-zinc-600">{fmtDate(r.dateObj)}</span>
                </div>
              </div>
            ))}
            {records.length === 0 && (
              <p className="text-sm italic text-zinc-600">No deployments on record.</p>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-800 p-4">
          <button
            onClick={onGenerateIPCR}
            className="w-full rounded-lg bg-red-600 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500"
          >
            Build IPCR report for {name}
          </button>
        </div>
      </aside>
    </div>
  );
}

type ViewKey =
  | 'portfolio' | 'events' | 'gatepass' | 'pulse'
  | 'requests' | 'production' | 'compliance' | 'reports';

const VIEWS: { key: ViewKey; label: string; hint: string }[] = [
  { key: 'portfolio',  label: 'Services',   hint: 'Public-facing AV services page' },
  { key: 'events',     label: 'Events',     hint: 'Approval, services and delivery pipeline' },
  { key: 'gatepass',   label: 'Gate Pass',  hint: 'Equipment releasing and inventory' },
  { key: 'production', label: 'Production', hint: 'Video output board' },
  { key: 'pulse',      label: 'Archive',    hint: 'DMC archive, team and source sheets' },
  { key: 'compliance', label: 'Compliance', hint: 'Audit Items 40, 41 and 44' },
  { key: 'reports',    label: 'Reports',    hint: 'IPCR and MOV generator' },
  { key: 'requests',   label: 'Register',   hint: 'Legacy request register' },
];

/* ============================================================== MAIN APP == */

export default function App() {
  const [coverages, setCoverages] = useState<Coverage[]>([]);
  const [lastUpdated, setLastUpdated] = useState('');
  const [conn, setConn] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [errMsg, setErrMsg] = useState('');
  const [booted, setBooted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedIPCRPersonnel, setSelectedIPCRPersonnel] = useState('Xyrus');
  const [ipcrYear, setIpcrYear] = useState<string>('ALL');
  const [ipcrIncludeLinks, setIpcrIncludeLinks] = useState(false);

  const [query, setQuery] = useState('');
  const [filterPerson, setFilterPerson] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | StatusKey>('ALL');
  const [visibleCount, setVisibleCount] = useState(8);

  const [events, setEvents] = useState<AVEvent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [evModal, setEvModal] = useState<{ open: boolean; editing: AVEvent | null }>({
    open: false,
    editing: null,
  });
  const [evQuery, setEvQuery] = useState('');
  const [evApproval, setEvApproval] = useState<'ALL' | ApprovalKey>('ALL');
  const [evFulfil, setEvFulfil] = useState<'ALL' | Fulfilment>('ALL');

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [reqModal, setReqModal] = useState<{ open: boolean; editing: ServiceRequest | null }>({
    open: false,
    editing: null,
  });
  const [reqQuery, setReqQuery] = useState('');
  const [reqStatusFilter, setReqStatusFilter] = useState<'ALL' | ReqStatus>('ALL');
  const [reqStreamFilter, setReqStreamFilter] = useState<'ALL' | Stream>('ALL');
  const [view, setView] = useState<ViewKey>('events');

  /**
   * Sino ang nagpapatakbo ng dashboard ngayon.
   * Ito ay ATTRIBUTION, hindi authentication — nagtatala ito kung sino ang
   * gumawa ng bawat pagbabago, pero walang pumipigil sa isang tao na pumili
   * ng ibang pangalan. Para sa tunay na account, kailangan ng Google sign-in.
   */
  const [actor, setActor] = useState<string>(() => {
    if (AUTH_ENABLED) return '';
    try {
      return window.localStorage.getItem('avnexus.actor') || '';
    } catch {
      return '';
    }
  });

  const chooseActor = useCallback((name: string) => {
    setActor(name);
    try {
      window.localStorage.setItem('avnexus.actor', name);
    } catch {
      /* private mode — attribution lasts for this session only */
    }
  }, []);

  const [user, setUser] = useState<SignedInUser | null>(null);

  /**
   * Ang session ang totoong sumusuporta sa pananatiling naka-sign in.
   * Labindalawang oras ito, naka-imbak sa browser, at hindi kailangang
   * kausapin ang Google kada pagsulat.
   */
  const [session, setSession] = useState<StoredSession | null>(() => loadSession());
  const sessionRef = useRef<StoredSession | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const userRef = useRef<SignedInUser | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const endSession = useCallback(() => {
    setSession(null);
    saveSession(null);
  }, []);
  const [authError, setAuthError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [health, setHealth] = useState<{
    ok: boolean;
    problems: string[];
    registeredAccounts: string[];
    signIn: string;
    tokenVerification: string;
    tabs: Record<string, boolean>;
    clientId?: string;
  } | null>(null);
  const [healthChecked, setHealthChecked] = useState(false);
  /**
   * Ang toast ay nawawala sa loob ng ilang segundo. Ang mga error na
   * kailangan pang basahin at ayusin ay dapat manatili sa screen.
   */
  const [lastError, setLastError] = useState<{ what: string; detail: string } | null>(null);
  const [probes, setProbes] = useState<ProbeResult[]>([]);
  const [probing, setProbing] = useState(false);

  /** Sinusubukan ang dalawang endpoint nang hiwalay, para tumpak ang sisi. */
  const runProbes = useCallback(async () => {
    setProbing(true);
    try {
      const out = await Promise.all([
        probeEndpoint('DMC coverage sheet', SCRIPT_URL),
        probeEndpoint('AV Nexus backend', PROD_SCRIPT_URL),
      ]);
      setProbes(out);
    } finally {
      setProbing(false);
    }
  }, []);

  /**
   * Tinatanong ang backend kung ano talaga ang kalagayan nito.
   * Ito ang pumapalit sa panghuhula kapag may "Load failed".
   */
  const checkHealth = useCallback(async () => {
    if (!PROD_CONFIGURED) return;
    try {
      const res = await fetch(`${PROD_SCRIPT_URL}?action=health`, { cache: 'no-store' });
      const out = await res.json();

      // Ang pinakakaraniwang sanhi ng "not issued for AV Nexus": magkaiba
      // ang client ID sa dalawang file. Nahuhuli ito bago pa mag-sign in.
      const backendId = String(out?.clientId || '').trim();
      const frontId = GOOGLE_CLIENT_ID.trim();
      if (AUTH_ENABLED && backendId && backendId !== frontId) {
        out.problems = [
          'The Client ID in App.tsx does not match the one in AVNexus.gs, so no ' +
            'sign-in can ever succeed.\n' +
            `App.tsx:    ${frontId}\n` +
            `AVNexus.gs: ${backendId}\n` +
            'Make them identical, then redeploy both.',
          ...(out.problems || []),
        ];
        out.ok = false;
      }
      if (AUTH_ENABLED && !backendId && out?.signIn === 'attribution-only') {
        out.problems = [
          'The dashboard requires sign-in but AVNexus.gs has no GOOGLE_CLIENT_ID, ' +
            'so the script cannot verify anyone. Put the same Client ID in both files.',
          ...(out.problems || []),
        ];
        out.ok = false;
      }

      setHealth(out);
    } catch {
      // Kapag pati ito ay hindi maabot, ang URL o ang deployment ang mali.
      setHealth({
        ok: false,
        problems: [
          'The dashboard cannot reach the Apps Script backend at all. Two usual causes: ' +
            'PROD_SCRIPT_URL points at the wrong deployment, or that deployment is set to ' +
            '"Execute as: User accessing" — which forces a Google login and blocks the ' +
            'dashboard. The reading deployment must be "Execute as: Me" and "Anyone".',
        ],
        registeredAccounts: [],
        signIn: 'unknown',
        tokenVerification: 'unknown',
        tabs: {},
      });
    } finally {
      setHealthChecked(true);
    }
  }, []);
  const gateRef = useRef<HTMLDivElement | null>(null);

  const { ready: gsiReady, renderButton } = useGoogleSignIn((u) => {
    setUser(u);
    setAuthError('');
    if (u) setActor(u.name);
  });

  /**
   * Isang beses lang: ipinapalit ang Google ID token sa isang session na
   * tumatagal ng labindalawang oras. Pagkatapos nito, hindi na kailangang
   * kausapin ang Google.
   */
  useEffect(() => {
    if (!AUTH_ENABLED || !user || session) return;
    let cancelled = false;
    (async () => {
      try {
        const out = await authedPost({ action: 'signIn' });
        if (!cancelled && out?.role) setServerRole(String(out.role));
      } catch (err) {
        if (!cancelled) {
          setAuthError(
            err instanceof Error ? err.message : 'Could not complete sign-in.'
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, session]);

  /**
   * Wala nang refresh timer. Ang google.accounts.id.prompt() ay para sa
   * unang pag-sign in lamang — may cooldown ito at madalas walang ginagawa,
   * kaya hindi ito maaasahan para kumuha ng bagong token. Ang session na
   * galing sa backend ang humahawak ng pananatili, at labindalawang oras
   * ang buhay nito.
   */
  useEffect(() => {
    if (!AUTH_ENABLED || !session) return;
    // Kapag natapos ang labindalawang oras, isang beses lang mag-si-sign in.
    const msLeft = session.expiresAt - Date.now();
    if (msLeft <= 0) {
      endSession();
      return;
    }
    const t = setTimeout(() => endSession(), msLeft);
    return () => clearTimeout(t);
  }, [session, endSession]);

  useEffect(() => {
    if (AUTH_ENABLED && !user && gsiReady) renderButton(gateRef.current);
  }, [gsiReady, user, renderButton]);

  useEffect(() => {
    checkHealth();
    runProbes();
  }, [checkHealth, runProbes]);

  const signOut = useCallback(() => {
    const w = window as any;
    try {
      w.google?.accounts?.id?.disableAutoSelect();
    } catch {
      /* ignore */
    }
    setUser(null);
    setActor('');
    endSession();
  }, [endSession]);

  /** Ang lahat ng pagsulat ay dumadaan dito para masama ang token. */
  /**
   * Ang papel ay galing sa SERVER, hindi sa paghula base sa pangalan.
   * Kung hindi pa dumarating, huhulaan muna para may maipakita, pero
   * ang server pa rin ang huling hukom sa bawat pagsulat.
   */
  const [serverRole, setServerRole] = useState<string>('');
  const myRole = serverRole || session?.role || roleOf(user, actor);
  const myName = user?.name || session?.name || actor;

  useEffect(() => {
    if (!AUTH_ENABLED || !user) {
      setServerRole('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const out = await authedPost({ action: 'whoami' });
        if (!cancelled && out && out.role) setServerRole(String(out.role));
      } catch {
        /* hahayaan ang hulang papel; ang server pa rin ang magpapatupad */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const authedPost = useCallback(
    async (body: Record<string, unknown>) => {
      const send = async () => {
        const res = await fetch(PROD_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            ...body,
            actor,
            // Ang session ang pangunahing patunay. Ang Google token ay
            // ginagamit lang sa unang pagkakataon o kapag expired na.
            session: sessionRef.current?.token || '',
            idToken: userRef.current?.idToken || '',
          }),
        });
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          // HTML ang isinagot — halos palaging sign-in page ito.
          throw new Error(
            'The backend returned a web page instead of data. The deployment must be ' +
              '"Execute as: Me" with access "Anyone".'
          );
        }
      };

      const out = await send();

      // Bagong session mula sa server — itago para sa susunod na labindalawang oras.
      if (out && out.ok && out.session) {
        const next: StoredSession = {
          token: String(out.session),
          email: String(out.email || ''),
          name: String(out.name || ''),
          role: String(out.role || ''),
          expiresAt: Date.now() + (Number(out.expiresIn) || 43200) * 1000,
        };
        setSession(next);
        saveSession(next);
      }

      if (out && out.ok === false) {
        if (out.serverError) {
          // Kasalanan ng pagkaka-set up, hindi ng gumagamit — panatilihin
          // siyang naka-sign in at ipakita kung ano ang dapat ayusin.
          setSetupError(out.error || 'The server could not process this request.');
        } else if (out.needsSignIn) {
          setAuthError(out.error || 'Please sign in again.');
          setUser(null);
          endSession();
        }
        throw new Error(out.error || 'The server rejected this change.');
      }
      return out;
    },
    [actor, endSession]
  );

  const [outputs, setOutputs] = useState<Output[]>([]);
  const [prodReady, setProdReady] = useState<'unknown' | 'ok' | 'missing'>('unknown');
  const [stale, setStale] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [kioskOn, setKioskOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [prodPerson, setProdPerson] = useState('ALL');

  const [openApp, setOpenApp] = useState<SystemApp | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerPerson, setDrawerPerson] = useState<{ name: string; image: string } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: string }[]>([]);

  const seenIds = useRef<Set<string>>(new Set());
  const loadedOnce = useRef(false);
  const bootedRef = useRef(false);
  const ipcrRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const recordsRef = useRef<HTMLDivElement>(null);

  const toast = useCallback((text: string, tone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  /* ------------------------------------------------------------- FETCH -- */
  const fetchTasks = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      try {
        const res = await fetch(SCRIPT_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const formatted: Coverage[] = (Array.isArray(data) ? data : [])
          .filter((row: any) => row['Coverage Details'] || row['Coverage ID'])
          .map((row: any) => {
            const rawDate = row['Date Uploaded'];
            const d = parseDate(rawDate);
            return {
              id: String(row['Coverage ID'] ?? ''),
              details: String(row['Coverage Details'] ?? ''),
              personnel: String(row['Assigned Personnel'] || 'Unassigned'),
              gdrive: String(row['GDrive Link'] || ''),
              socialMediaLink: String(row['Social Media Link'] || ''),
              status: String(row['DMC Status'] || 'Upcoming'),
              date: d ? dayKey(d) : String(rawDate || ''),
              dateObj: d,
            };
          })
          .reverse();

        if (bootedRef.current) {
          const fresh = formatted.filter((c) => c.id && !seenIds.current.has(c.id));
          if (fresh.length === 1) toast(`Bagong record: ${fresh[0].details.slice(0, 60)}`, 'new');
          else if (fresh.length > 1) toast(`${fresh.length} bagong records ang pumasok`, 'new');
        }
        formatted.forEach((c) => c.id && seenIds.current.add(c.id));

        setCoverages(formatted);
        setConn('live');
        setErrMsg('');
        setLastUpdated(
          new Date().toLocaleTimeString('en-PH', {
            hour12: true,
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
          })
        );
        if (manual) toast('Records refreshed', 'ok');
      } catch (error: any) {
        setConn('error');
        setErrMsg(error?.message || 'Could not reach the Apps Script endpoint.');
        if (manual) toast('Refresh failed — check the Apps Script URL', 'err');
      } finally {
        bootedRef.current = true;
        setBooted(true);
        setRefreshing(false);
      }
    },
    [toast]
  );

  const fetchProduction = useCallback(async () => {
    try {
      if (!PROD_CONFIGURED) {
        setProdReady('missing');
        return;
      }
      const res = await fetch(`${PROD_SCRIPT_URL}?sheet=all`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();

      // Bagong backend → { requests, production }. Lumang backend → array lang.
      const data = Array.isArray(raw) ? raw : raw?.production;
      const reqRows = Array.isArray(raw?.requests) ? raw.requests : [];

      const evRows = Array.isArray(raw?.events) ? raw.events : [];
      const asgRows = Array.isArray(raw?.assignments) ? raw.assignments : [];

      setAssignments(
        asgRows
          .filter((r: any) => r['Personnel'] || r['Assignment ID'])
          .map((r: any) => ({
            id: String(r['Assignment ID'] || Math.random()),
            eventId: String(r['Event ID'] || ''),
            eventTitle: String(r['Event Title'] || ''),
            personnel: String(r['Personnel'] || ''),
            roles: splitList(r['Roles']),
            status: String(r['Status'] || 'Assigned'),
            dateAssigned: parseDate(r['Date Assigned']),
            dateCompleted: parseDate(r['Date Completed']),
            remarks: String(r['Remarks'] || ''),
          }) as Assignment)
      );

      setEvents(
        evRows
          .filter((r: any) => r['Event Title'] || r['Event ID'])
          .map((r: any) => {
            const approvalRaw = String(r['Approval Status'] || 'For Endorsement');
            return {
              id: String(r['Event ID'] || r['Event Title'] || Math.random()),
              dateRequested: parseDate(r['Date Requested']),
              title: String(r['Event Title'] || ''),
              client: String(r['Client'] || ''),
              clientType: String(r['Client Type'] || ''),
              eventDate: parseDate(r['Event Date']),
              endDate: parseDate(r['End Date']),
              venue: String(r['Venue'] || ''),
              requested: splitServices(r['Requested Services']),
              delivered: splitServices(r['Delivered Services']),
              reason: String(r['Reason for Gap'] || ''),
              approval: classifyApproval(approvalRaw),
              approvalRaw,
              endorsedBy: String(r['Endorsed By'] || ''),
              dateEndorsed: parseDate(r['Date Endorsed']),
              approvedBy: String(r['Approved By'] || ''),
              dateApproved: parseDate(r['Date Approved']),
              approvalRemarks: String(r['Approval Remarks'] || ''),
              lead: String(r['Lead Personnel'] || ''),
              team: String(r['Team'] || ''),
              pipeline: {
                coordination: classifyPipeline(String(r['Coordination'] || '')),
                documents: classifyPipeline(String(r['Documents'] || '')),
                deliverables: classifyPipeline(String(r['Deliverables'] || '')),
                archiving: classifyPipeline(String(r['Archiving'] || '')),
              },
              targetDate: parseDate(r['Target Date']),
              dateDelivered: parseDate(r['Date Delivered']),
              csm: parseCSM(r['CSM Rating']),
              link: String(r['Output Link'] || ''),
              remarks: String(r['Remarks'] || ''),
              createdBy: String(r['Created By'] || ''),
              history: String(r['Action Log'] || '')
                .split('\n')
                .map((x: string) => x.trim())
                .filter(Boolean),
            } as AVEvent;
          })
          .reverse()
      );

      setRequests(
        reqRows
          .filter((r: any) => r['Request Title'] || r['Request ID'])
          .map((r: any) => {
            const statusRaw = String(r['Status'] || 'Pending');
            const streamRaw = String(r['Service Stream'] || 'AV Coverage');
            return {
              id: String(r['Request ID'] || r['Request Title'] || Math.random()),
              dateRequested: parseDate(r['Date Requested']),
              client: String(r['Client'] || ''),
              clientType: String(r['Client Type'] || ''),
              title: String(r['Request Title'] || ''),
              stream: classifyStream(streamRaw),
              streamRaw,
              serviceType: String(r['Service Type'] || ''),
              eventDate: parseDate(r['Event Date']),
              venue: String(r['Venue'] || ''),
              personnel: String(r['Assigned Personnel'] || ''),
              status: classifyReqStatus(statusRaw),
              statusRaw,
              reason: String(r['Reason for Non-Service'] || ''),
              dateApproved: parseDate(r['Date Approved']),
              targetDate: parseDate(r['Target Date']),
              dateDelivered: parseDate(r['Date Delivered']),
              csm: parseCSM(r['CSM Rating']),
              link: String(r['Output Link'] || ''),
              remarks: String(r['Remarks'] || ''),
            } as ServiceRequest;
          })
          .reverse()
      );

      if (!Array.isArray(data)) throw new Error('unexpected shape');

      // Luma pang Apps Script? Coverage rows ang babalik — walang Output ID.
      if (data.length > 0 && !('Output ID' in data[0]) && !('Output Title' in data[0])) {
        setProdReady('missing');
        return;
      }

      const mapped: Output[] = data
        .filter((r: any) => r['Output Title'] || r['Output ID'])
        .map((r: any) => {
          const runtime = String(r['Runtime'] ?? '');
          const stageRaw = String(r['Stage'] || 'Assigned');
          return {
            id: String(r['Output ID'] || r['Output Title'] || Math.random()),
            event: String(r['Event / Coverage'] || ''),
            title: String(r['Output Title'] || ''),
            type: String(r['Output Type'] || ''),
            runtime,
            seconds: parseRuntime(runtime),
            personnel: String(r['Personnel'] || 'Unassigned'),
            role: String(r['Role'] || ''),
            requestedBy: String(r['Requested By'] || ''),
            stage: classifyStage(stageRaw),
            stageRaw,
            platform: String(r['Platform'] || ''),
            link: String(r['Output Link'] || ''),
            revisions: Number(r['Revisions'] || 0) || 0,
            remarks: String(r['Remarks'] || ''),
            assigned: parseDate(r['Date Assigned']),
            target: parseDate(r['Target Date']),
            delivered: parseDate(r['Date Delivered']),
          };
        })
        .reverse();

      setOutputs(mapped);
      setProdReady('ok');
      loadedOnce.current = true;
      setStale(false);
    } catch {
      // Kapag may nakuha na tayong data dati, huwag burahin ang screen dahil
      // lang sa isang sablay na poll — ipakita ang huling nakuha at markahang
      // stale. 'Missing' lang kapag talagang hindi pa nakakakuha kahit minsan.
      if (loadedOnce.current) setStale(true);
      else setProdReady('missing');
    }
  }, []);

  const submitOutput = useCallback(
    async (payload: Record<string, string | number>) => {
      if (!PROD_CONFIGURED) {
        toast('Set PROD_SCRIPT_URL in App.tsx before logging entries.', 'err');
        return;
      }
      setSubmitting(true);
      try {
        await authedPost({ action: 'addOutput', payload });
        toast('Output saved to the Production Log', 'ok');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save.';
        toast(msg, 'err');
        setLastError({ what: 'Log video output', detail: msg });
      } finally {
        setSubmitting(false);
        setLogOpen(false);
        setTimeout(() => fetchProduction(), 1400);
      }
    },
    [fetchProduction, toast]
  );

  const submitEvent = useCallback(
    async (
      form: Record<string, string>,
      id: string | null,
      roster?: { personnel: string; roles: string[]; status: string }[]
    ) => {
      if (!PROD_CONFIGURED) {
        toast('Set PROD_SCRIPT_URL in App.tsx first.', 'err');
        return;
      }
      setSubmitting(true);
      const payload = {
        title: form.title,
        client: form.client,
        clientType: form.clientType,
        venue: form.venue,
        dateRequested: form.dateRequested,
        eventDate: form.eventDate,
        endDate: form.endDate,
        requestedServices: form.requestedServices,
        deliveredServices: form.deliveredServices,
        reason: form.reason,
        approvalStatus: APPROVAL_META[classifyApproval(form.approvalStatus)].label
          .replace('For endorsement', 'For Endorsement'),
        leadPersonnel: form.lead,
        team: form.team,
        coordination: form.coordination,
        documents: form.documents,
        deliverables: form.deliverables,
        archiving: form.archiving,
        targetDate: form.targetDate,
        dateDelivered: form.dateDelivered,
        csm: form.csm,
        link: form.link,
        remarks: form.remarks,
      };
      const body = id
        ? { action: 'updateEvent', id, patch: { ...payload, actor } }
        : { action: 'addEvent', payload: { ...payload, actor } };

      try {
        const out = await authedPost(body);

        // The roster is a separate write — it needs the Event ID first.
        const eventId = id || (out && out.id ? String(out.id) : null);
        if (eventId && roster) {
          await authedPost({
            action: 'setAssignments',
            eventId,
            rows: roster.filter((r) => r.personnel && r.roles.length),
          });
        }
        // Huwag sabihing naipadala ang email kung hindi naman.
        if (id) {
          toast('Event updated', 'ok');
        } else if (out?.emailed) {
          toast(`Event created — approval email sent to ${out.emailTo || 'the Division Chief'}`, 'ok');
        } else {
          toast('Event created', 'ok');
          if (out?.emailError) {
            setLastError({
              what: 'Approval email',
              detail:
                `The event was saved, but the approval email was not sent. ${out.emailError}`,
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save.';
        toast(msg, 'err');
        setLastError({ what: id ? 'Update event' : 'Create event', detail: msg });
      } finally {
        setSubmitting(false);
        setEvModal({ open: false, editing: null });
        setTimeout(() => fetchProduction(), 1400);
      }
    },
    [fetchProduction, toast, actor]
  );

  const notifyApprover = useCallback(
    async (id: string) => {
      if (!PROD_CONFIGURED) {
        toast('Set PROD_SCRIPT_URL in App.tsx first.', 'err');
        return;
      }
      try {
        const out = await authedPost({ action: 'notify', id });
        toast(out?.to ? `Approval email sent to ${out.to}` : 'Approval email sent', 'ok');
      } catch (err) {
        // Ang server ay nagsasabi ng eksaktong dahilan. Huwag itong itapon.
        const msg = err instanceof Error ? err.message : 'Could not send the email.';
        toast(msg, 'err');
        setLastError({ what: 'Send approval email', detail: msg });
      }
    },
    [toast]
  );

  const stepEvent = useCallback(
    async (ev: AVEvent, key: PipelineKey, next: PipelineState) => {
      if (!PROD_CONFIGURED) {
        toast('Set PROD_SCRIPT_URL in App.tsx first.', 'err');
        return;
      }
      setEvents((prev) =>
        prev.map((x) =>
          x.id === ev.id ? { ...x, pipeline: { ...x.pipeline, [key]: next } } : x
        )
      );
      const fieldMap: Record<PipelineKey, string> = {
        coordination: 'coordination',
        documents: 'documents',
        deliverables: 'deliverables',
        archiving: 'archiving',
      };
      try {
        await authedPost({
            action: 'updateEvent',
            id: ev.id,
            patch: { [fieldMap[key]]: PIPELINE_META[next].label },
          });
      } catch (err) {
        // Ang optimistic na pagbabago ay bumalik sa dating anyo kapag
        // tinanggihan — dapat makita ng tao kung bakit.
        toast(err instanceof Error ? err.message : 'Could not update.', 'err');
      }
      setTimeout(() => fetchProduction(), 1600);
    },
    [fetchProduction, toast]
  );

  const submitRequest = useCallback(
    async (form: Record<string, string>, id: string | null) => {
      if (!PROD_CONFIGURED) {
        toast('Set PROD_SCRIPT_URL in App.tsx first.', 'err');
        return;
      }
      setSubmitting(true);
      const body = id
        ? {
            action: 'updateRequest',
            id,
            patch: {
              status: form.status,
              reason: form.reason,
              dateApproved: form.dateApproved,
              targetDate: form.targetDate,
              dateDelivered: form.dateDelivered,
              csm: form.csm,
              personnel: form.personnel,
              remarks: form.remarks,
            },
          }
        : { action: 'addRequest', payload: form };

      try {
        await authedPost(body);
        toast(id ? 'Request updated' : 'Request logged', 'ok');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not save.', 'err');
      } finally {
        setSubmitting(false);
        setReqModal({ open: false, editing: null });
        setTimeout(() => fetchProduction(), 1400);
      }
    },
    [fetchProduction, toast, actor]
  );

  const advanceStage = useCallback(
    async (o: Output) => {
      const i = STAGE_ORDER.indexOf(o.stage);
      const next = STAGE_ORDER[Math.min(STAGE_ORDER.length - 1, i + 1)];
      if (next === o.stage) return;
      if (!PROD_CONFIGURED) {
        toast('Set PROD_SCRIPT_URL in App.tsx first.', 'err');
        return;
      }
      setBusyId(o.id);
      setOutputs((prev) =>
        prev.map((x) => (x.id === o.id ? { ...x, stage: next, stageRaw: STAGE_META[next].label } : x))
      );
      try {
        await authedPost({ action: 'updateStage', id: o.id, stage: STAGE_META[next].label });
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not update.', 'err');
      }
      setTimeout(() => {
        fetchProduction();
        setBusyId(null);
      }, 1400);
    },
    [fetchProduction, toast]
  );

  useEffect(() => {
    fetchTasks();
    fetchProduction();
    const interval = setInterval(() => {
      fetchTasks();
      fetchProduction();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------- DERIVED DATA -- */
  const stats = useMemo(() => {
    const base: Record<StatusKey, number> = {
      pending: 0,
      upcoming: 0,
      checked: 0,
      transferred: 0,
      archived: 0,
    };
    coverages.forEach((c) => (base[classifyStatus(c.status)] += 1));
    const now = new Date();
    const thisMonth = coverages.filter(
      (c) =>
        c.dateObj &&
        c.dateObj.getMonth() === now.getMonth() &&
        c.dateObj.getFullYear() === now.getFullYear()
    ).length;
    return { counts: base, total: coverages.length, thisMonth };
  }, [coverages]);

  const workload = useMemo(
    () =>
      TEAM.map((m) => {
        const n = m.name.toLowerCase();
        const cov = coverages.filter((c) =>
          (c.personnel || '').toLowerCase().includes(n)
        ).length;
        const out = outputs.filter((o) =>
          (o.personnel || '').toLowerCase().includes(n)
        ).length;
        return { name: m.name, cov, out, count: cov + out };
      }).sort((a, b) => b.count - a.count),
    [coverages, outputs]
  );

  /**
   * Bilang kada papel — ang totoong workload picture na hinihingi ng Item 41.
   * Kung si Xyrus ay cam op AT editor AT coordinator sa isang event, tatlo
   * 'yon, hindi isa.
   */
  const roleLoad = useMemo(() => {
    return TEAM.map((m) => {
      const mine = assignments.filter(
        (a) => a.personnel.toLowerCase() === m.name.toLowerCase()
      );
      const byRole = new Map<string, number>();
      mine.forEach((a) =>
        a.roles.forEach((r) => byRole.set(r, (byRole.get(r) || 0) + 1))
      );
      return {
        name: m.name,
        events: mine.length,
        roleCount: mine.reduce((acc, a) => acc + a.roles.length, 0),
        top: Array.from(byRole.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4),
      };
    }).sort((a, b) => b.roleCount - a.roleCount);
  }, [assignments]);

  const prodSummary = useMemo(() => {
    const live = outputs.filter((o) => o.stage !== 'published' && o.stage !== 'approved');
    const done = outputs.filter((o) => o.stage === 'published' || o.stage === 'approved');
    const rated = outputs.map(deliveredOnTime).filter((v) => v !== null) as boolean[];
    return {
      total: outputs.length,
      live: live.length,
      done: done.length,
      overdue: outputs.filter(isOverdue).length,
      seconds: outputs.reduce((a, o) => a + o.seconds, 0),
      onTime: rated.length ? Math.round((rated.filter(Boolean).length / rated.length) * 100) : null,
    };
  }, [outputs]);

  const boardOutputs = useMemo(
    () =>
      prodPerson === 'ALL'
        ? outputs
        : outputs.filter((o) => (o.personnel || '').toLowerCase().includes(prodPerson.toLowerCase())),
    [outputs, prodPerson]
  );

  const filteredEvents = useMemo(() => {
    const q = evQuery.trim().toLowerCase();
    return events.filter((ev) => {
      if (evApproval !== 'ALL' && ev.approval !== evApproval) return false;
      if (evFulfil !== 'ALL' && fulfilment(ev) !== evFulfil) return false;
      if (
        q &&
        !`${ev.title} ${ev.client} ${ev.lead} ${ev.venue} ${ev.id} ${ev.requested.join(' ')}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [events, evQuery, evApproval, evFulfil]);

  const approvalQueue = useMemo(
    () => events.filter(awaitingAction),
    [events]
  );

  /** Events + legacy register, pinagsama para sa compliance panels. */
  const isoRequests = useMemo(
    () => [...events.map(eventAsRequest), ...requests],
    [events, requests]
  );

  /** PM 2.1 at 2.2 — ang dalawang opisyal na KPI ng AV Services. */
  const kpi = useMemo(() => {
    const approvedOrBeyond = isoRequests.filter(
      (r) => r.status === 'approved' || r.status === 'ongoing' || r.status === 'completed'
    );
    const delivered = approvedOrBeyond.filter((r) => r.status === 'completed');
    const rated = isoRequests.filter((r) => r.csm > 0);
    const passing = rated.filter((r) => r.csm >= CSM_PASS);

    return {
      execution: approvedOrBeyond.length
        ? Math.round((delivered.length / approvedOrBeyond.length) * 100)
        : null,
      approvedTotal: approvedOrBeyond.length,
      deliveredTotal: delivered.length,
      csm: rated.length ? Math.round((passing.length / rated.length) * 100) : null,
      rated: rated.length,
    };
  }, [isoRequests]);

  const filteredRequests = useMemo(() => {
    const q = reqQuery.trim().toLowerCase();
    return requests.filter((r) => {
      if (reqStatusFilter !== 'ALL' && r.status !== reqStatusFilter) return false;
      if (reqStreamFilter !== 'ALL' && r.stream !== reqStreamFilter) return false;
      if (q && !`${r.title} ${r.client} ${r.personnel} ${r.serviceType} ${r.id}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [requests, reqQuery, reqStatusFilter, reqStreamFilter]);

  const reqCounts = useMemo(() => {
    const base = {} as Record<ReqStatus, number>;
    REQ_ORDER.forEach((k) => (base[k] = 0));
    requests.forEach((r) => (base[r.status] += 1));
    return base;
  }, [requests]);

  const years = useMemo(() => {
    const set = new Set<string>();
    coverages.forEach((c) => c.dateObj && set.add(String(c.dateObj.getFullYear())));
    return Array.from(set).sort().reverse();
  }, [coverages]);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coverages.filter((c) => {
      if (filterPerson !== 'ALL' && !(c.personnel || '').toLowerCase().includes(filterPerson.toLowerCase()))
        return false;
      if (filterStatus !== 'ALL' && classifyStatus(c.status) !== filterStatus) return false;
      if (q && !`${c.details} ${c.personnel} ${c.status}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [coverages, query, filterPerson, filterStatus]);

  useEffect(() => setVisibleCount(8), [query, filterPerson, filterStatus]);

  const upNext = useMemo(() => {
    // Status-based: lahat ng naka-UPCOMING sa DMC sheet, pinakaluma muna —
    // kasama ang mga tapos nang i-shoot pero hindi pa na-a-archive.
    return coverages
      .filter((c) => classifyStatus(c.status) === 'upcoming')
      .sort((a, b) => {
        const at = a.dateObj?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bt = b.dateObj?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return at - bt;
      })
      .slice(0, 4);
  }, [coverages]);

  const ipcrRecords = useMemo(() => {
    let base: Coverage[];
    if (selectedIPCRPersonnel === 'Lotus') {
      base = coverages.filter((c) => {
        const k = classifyStatus(c.status);
        return k === 'checked' || k === 'transferred' || k === 'archived';
      });
    } else {
      base = coverages.filter((c) =>
        (c.personnel || '').toLowerCase().includes(selectedIPCRPersonnel.toLowerCase())
      );
    }
    if (ipcrYear !== 'ALL')
      base = base.filter((c) => c.dateObj && String(c.dateObj.getFullYear()) === ipcrYear);
    return [...base].sort((a, b) => {
      const at = a.dateObj ? a.dateObj.getTime() : 0;
      const bt = b.dateObj ? b.dateObj.getTime() : 0;
      return at - bt;
    });
  }, [coverages, selectedIPCRPersonnel, ipcrYear]);

  const ipcrOutputs = useMemo(() => {
    let base: Output[];
    if (selectedIPCRPersonnel === 'Lotus') {
      base = outputs.filter((o) => o.stage === 'approved' || o.stage === 'published');
    } else {
      base = outputs.filter((o) =>
        (o.personnel || '').toLowerCase().includes(selectedIPCRPersonnel.toLowerCase())
      );
    }
    if (ipcrYear !== 'ALL') {
      base = base.filter((o) => {
        const d = o.delivered || o.target || o.assigned;
        return d && String(d.getFullYear()) === ipcrYear;
      });
    }
    return [...base].sort((a, b) => {
      const at = (a.delivered || a.target || a.assigned)?.getTime() ?? 0;
      const bt = (b.delivered || b.target || b.assigned)?.getTime() ?? 0;
      return at - bt;
    });
  }, [outputs, selectedIPCRPersonnel, ipcrYear]);

  const ipcrQQT = useMemo(() => {
    const rated = ipcrOutputs.map(deliveredOnTime).filter((v) => v !== null) as boolean[];
    const revs = ipcrOutputs.length
      ? ipcrOutputs.reduce((a, o) => a + (o.revisions || 0), 0) / ipcrOutputs.length
      : 0;
    return {
      quantity: ipcrRecords.length + ipcrOutputs.length,
      runtime: ipcrOutputs.reduce((a, o) => a + o.seconds, 0),
      onTime: rated.length ? Math.round((rated.filter(Boolean).length / rated.length) * 100) : null,
      avgRev: revs.toFixed(1),
      cleanPass: ipcrOutputs.filter((o) => (o.revisions || 0) <= 1).length,
    };
  }, [ipcrOutputs, ipcrRecords]);

  const ipcrRequests = useMemo(() => {
    let base: ServiceRequest[];
    if (selectedIPCRPersonnel === 'Lotus') {
      base = requests.filter((r) => r.status === 'completed');
    } else {
      base = requests.filter((r) =>
        (r.personnel || '').toLowerCase().includes(selectedIPCRPersonnel.toLowerCase())
      );
    }
    if (ipcrYear !== 'ALL') {
      base = base.filter((r) => {
        const d = r.dateDelivered || r.dateRequested || r.eventDate;
        return d && String(d.getFullYear()) === ipcrYear;
      });
    }
    return [...base].sort((a, b) => {
      const at = (a.dateDelivered || a.dateRequested)?.getTime() ?? 0;
      const bt = (b.dateDelivered || b.dateRequested)?.getTime() ?? 0;
      return at - bt;
    });
  }, [requests, selectedIPCRPersonnel, ipcrYear]);

  /** Ang mga papel na hinawakan ng piniling tao — Part D ng IPCR. */
  const ipcrRoles = useMemo(() => {
    if (selectedIPCRPersonnel === 'Lotus') return [];
    const mine = assignments.filter(
      (a) => a.personnel.toLowerCase() === selectedIPCRPersonnel.toLowerCase()
    );
    const filtered =
      ipcrYear === 'ALL'
        ? mine
        : mine.filter((a) => {
            const d = a.dateCompleted || a.dateAssigned;
            return d && String(d.getFullYear()) === ipcrYear;
          });
    return [...filtered].sort((a, b) => {
      const at = (a.dateCompleted || a.dateAssigned)?.getTime() ?? 0;
      const bt = (b.dateCompleted || b.dateAssigned)?.getTime() ?? 0;
      return at - bt;
    });
  }, [assignments, selectedIPCRPersonnel, ipcrYear]);

  const ipcrRoleTally = useMemo(() => {
    const m = new Map<string, number>();
    ipcrRoles.forEach((a) => a.roles.forEach((r) => m.set(r, (m.get(r) || 0) + 1)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [ipcrRoles]);

  const ipcrSLA = useMemo(() => {
    const tats = ipcrRequests.map(actualTAT).filter((v): v is number => v !== null);
    const rated = ipcrRequests.map(slaState).filter((x) => x === 'ontime' || x === 'overdue');
    const csmRated = ipcrRequests.filter((r) => r.csm > 0);
    return {
      avgTAT: tats.length ? tats.reduce((a, b) => a + b, 0) / tats.length : null,
      onTime: rated.length
        ? Math.round((rated.filter((x) => x === 'ontime').length / rated.length) * 100)
        : null,
      csm: csmRated.length
        ? Math.round(
            (csmRated.filter((r) => r.csm >= CSM_PASS).length / csmRated.length) * 100
          )
        : null,
      csmCount: csmRated.length,
    };
  }, [ipcrRequests]);

  const controlNo = useMemo(() => {
    const initials = (OFFICIAL[selectedIPCRPersonnel]?.fullName || selectedIPCRPersonnel)
      .split(' ')
      .map((w) => w[0])
      .join('')
      .replace(/[^A-Z]/g, '')
      .slice(0, 3);
    const y = ipcrYear === 'ALL' ? new Date().getFullYear() : ipcrYear;
    const n = ipcrRecords.length + ipcrOutputs.length + ipcrRequests.length;
    return `BDMS-AV-${y}-${initials}-${String(n).padStart(3, '0')}`;
  }, [selectedIPCRPersonnel, ipcrYear, ipcrRecords.length, ipcrOutputs.length, ipcrRequests.length]);

  /* ------------------------------------------------------------ ACTIONS -- */
  const scrollTo = (ref: { current: HTMLElement | null }) =>
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const exportCSV = useCallback(() => {
    const rows: any[][] = [];
    ipcrRecords.forEach((c, i) =>
      rows.push([
        i + 1,
        'Field coverage / DMC',
        fmtDate(c.dateObj, c.date),
        c.personnel,
        '',
        c.status,
        c.details,
        '',
        '',
        c.gdrive || c.socialMediaLink,
      ])
    );
    ipcrOutputs.forEach((o, i) =>
      rows.push([
        ipcrRecords.length + i + 1,
        'Video production output',
        fmtDate(o.delivered || o.target || o.assigned),
        o.personnel,
        o.role,
        STAGE_META[o.stage].label,
        o.title,
        o.type,
        o.runtime,
        o.link,
      ])
    );
    const header = [
      '#', 'Stream', 'Date', 'Personnel', 'Role', 'Status / Stage',
      'Particulars', 'Type', 'Runtime', 'Reference link',
    ];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${controlNo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV exported', 'ok');
  }, [ipcrRecords, ipcrOutputs, controlNo, toast]);

  const printSheet = useCallback(() => {
    setOpenApp(null);
    setDrawerPerson(null);
    setPaletteOpen(false);
    setReqModal({ open: false, editing: null });
    setEvModal({ open: false, editing: null });
    setLogOpen(false);
    setView('reports');
    setTimeout(() => window.print(), 160);
  }, []);

  const commands = useMemo<Cmd[]>(() => {
    const list: Cmd[] = [];
    SYSTEMS.forEach((s) =>
      list.push({
        id: `sys-${s.id}`,
        label: `Open ${s.name}`,
        hint: s.tag,
        group: 'Systems',
        run: () => {
          if (s.id === 'portfolio') setView('portfolio');
          else if (s.id === 'gatepass') setView('gatepass');
          else window.open(s.url, '_blank');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      })
    );
    list.push(
      {
        id: 'sheet-pre',
        label: 'Open Pre-Archival sheet',
        hint: 'Google Sheets',
        group: 'Systems',
        run: () => window.open(PRE_ARCHIVAL_LINK, '_blank'),
      },
      {
        id: 'sheet-dmc',
        label: 'Open DMC Monitoring sheet',
        hint: 'Google Sheets',
        group: 'Systems',
        run: () => window.open(DMC_MONITORING_LINK, '_blank'),
      }
    );
    Object.keys(OFFICIAL).forEach((n) =>
      list.push({
        id: `ipcr-${n}`,
        label: `Build IPCR report — ${OFFICIAL[n].fullName}`,
        hint: 'IPCR',
        group: 'Reports',
        run: () => {
          setSelectedIPCRPersonnel(n);
          setView('reports');
          // Ang section ay nasa Reports view lang, kaya hintayin muna itong
          // ma-render bago mag-scroll — kung hindi, null pa ang ref.
          setTimeout(() => scrollTo(ipcrRef), 60);
        },
      })
    );
    list.push(
      { id: 'print', label: 'Print / save IPCR as PDF', hint: 'Print', group: 'Reports', run: printSheet },
      { id: 'csv', label: 'Export current IPCR to CSV', hint: 'Download', group: 'Reports', run: exportCSV },
      {
        id: 'refresh',
        label: 'Refresh records now',
        hint: 'Sync',
        group: 'Actions',
        run: () => {
          fetchTasks(true);
          fetchProduction();
        },
      },
      {
        id: 'log-output',
        label: 'Log a video output',
        hint: 'Production',
        group: 'Actions',
        run: () => setLogOpen(true),
      },
      {
        id: 'go-board',
        label: 'Jump to Production Board',
        hint: 'Navigate',
        group: 'Actions',
        run: () => scrollTo(boardRef),
      },
      {
        id: 'kiosk',
        label: 'Start kiosk mode (office monitor)',
        hint: 'Display',
        group: 'Actions',
        run: () => setKioskOn(true),
      },
      {
        id: 'log-request',
        label: 'Log a service request',
        hint: 'Register',
        group: 'Actions',
        run: () => {
          setView('requests');
          setReqModal({ open: true, editing: null });
        },
      },
      {
        id: 'new-event',
        label: 'Create a new event request',
        hint: 'Events',
        group: 'Actions',
        run: () => {
          setView('events');
          setEvModal({ open: true, editing: null });
        },
      }
    );
    events.slice(0, 40).forEach((ev) =>
      list.push({
        id: `ev-${ev.id}`,
        label: ev.title || 'Untitled event',
        hint: `${APPROVAL_META[ev.approval].short} · ${FULFIL_META[fulfilment(ev)].label}`,
        group: 'Events',
        run: () => {
          setView('events');
          setEvModal({ open: true, editing: ev });
        },
      })
    );
    VIEWS.forEach((v) =>
      list.push({
        id: `view-${v.key}`,
        label: `Go to ${v.label}`,
        hint: v.hint,
        group: 'Navigate',
        run: () => {
          setView(v.key);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      })
    );
    requests.slice(0, 40).forEach((r) =>
      list.push({
        id: `req-${r.id}`,
        label: r.title || 'Untitled request',
        hint: `${REQ_META[r.status].label} · ${r.client || 'no client'}`,
        group: 'Requests',
        run: () => {
          setView('requests');
          setReqModal({ open: true, editing: r });
        },
      })
    );
    outputs.slice(0, 40).forEach((o, i) =>
      list.push({
        id: `out-${i}`,
        label: o.title || 'Untitled output',
        hint: `${STAGE_META[o.stage].short} · ${o.personnel}`,
        group: 'Production',
        run: () => {
          setProdPerson(o.personnel.split(',')[0].trim() || 'ALL');
          scrollTo(boardRef);
        },
      })
    );
    STATUS_ORDER.forEach((k) =>
      list.push({
        id: `filt-${k}`,
        label: `Filter records — ${STATUS_META[k].label}`,
        hint: 'Filter',
        group: 'Actions',
        run: () => {
          setFilterStatus(k);
          scrollTo(recordsRef);
        },
      })
    );
    coverages.slice(0, 60).forEach((c, i) =>
      list.push({
        id: `cov-${i}`,
        label: c.details || 'Untitled coverage',
        hint: fmtDate(c.dateObj, c.date),
        group: 'Coverages',
        run: () => {
          setQuery(c.details.slice(0, 40));
          scrollTo(recordsRef);
        },
      })
    );
    return list;
  }, [coverages, outputs, requests, events, exportCSV, fetchTasks, fetchProduction, printSheet]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const connMeta = stale
    ? {
        dot: 'bg-amber-500',
        label: `Cannot reach the server — showing the last data received (${lastUpdated})`,
        short: 'Cached',
      }
    : {
        connecting: { dot: 'bg-amber-500', label: 'Connecting', short: 'Sync' },
        live: { dot: 'bg-emerald-500', label: `Live · ${lastUpdated}`, short: 'Live' },
        error: { dot: 'bg-zinc-600', label: 'Offline', short: 'Offline' },
      }[conn];

  /* --------------------------------------------------------------- VIEW -- */

  // Walang makikita hangga't hindi naka-sign in, kapag naka-on ang auth.
  // Sapat na ang buhay na session — hindi na kailangang muling mag-sign in
  // hangga't hindi ito nag-e-expire.
  if (AUTH_ENABLED && !user && !session) {
    return (
      <SignInGate
        onMount={(el) => {
          gateRef.current = el;
          if (gsiReady) renderButton(el);
        }}
        ready={gsiReady}
        error={authError}
        health={health}
        onRetry={checkHealth}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-[#08080a] font-sans text-[13px] text-zinc-300 antialiased selection:bg-[#00aeef]/25">
      <div className="relative z-10 px-4 pb-28 pt-5 md:px-8">
        {/* ================================================ DASHBOARD ==== */}
        <div className="no-print space-y-6">
          {/* ---------------------------------------------- APP BAR -- */}
          <header className="mx-auto max-w-[1400px]">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-zinc-800/80 pb-4">
              <img src="/stii.png" alt="DOST-STII" className="h-8 w-auto shrink-0" />

              <div className="flex min-w-0 items-baseline gap-3">
                <h1 className="text-[15px] font-semibold tracking-tight text-zinc-100">
                  AV Nexus
                </h1>
                <span className="hidden truncate text-[12px] text-zinc-600 sm:block">
                  Broadcast &amp; Digital Media Section
                </span>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPaletteOpen(true)}
                  className="flex items-center gap-2 rounded border border-zinc-800 bg-[#101012] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                >
                  Search
                  <kbd className="rounded border border-zinc-800 px-1 font-mono text-[10px] text-zinc-600">
                    ⌘K
                  </kbd>
                </button>

                <a
                  href={PRE_ARCHIVAL_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                >
                  Pre-Archival
                </a>
                <a
                  href={DMC_MONITORING_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                >
                  DMC Sheet
                </a>

                {AUTH_ENABLED && (user || session) ? (
                  <div className="flex items-center gap-2 rounded border border-zinc-800 bg-[#101012] py-1 pl-1 pr-2.5">
                    {user?.picture ? (
                      <img
                        src={user.picture}
                        alt=""
                        className="h-6 w-6 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[11px] text-zinc-300">
                        {(myName || '?').slice(0, 1)}
                      </span>
                    )}
                    <span className="max-w-[130px] truncate text-[12px] text-zinc-300">
                      {myName}
                    </span>
                    <button
                      onClick={signOut}
                      title="Sign out"
                      className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <select
                    value={actor}
                    onChange={(e) => chooseActor(e.target.value)}
                    title="Changes are recorded under this name. Not a security control."
                    className={`rounded border bg-[#101012] px-2.5 py-1.5 text-[12px] focus:border-[#00aeef] focus:outline-none ${
                      actor
                        ? 'border-zinc-800 text-zinc-300'
                        : 'border-amber-600/50 text-amber-400'
                    }`}
                  >
                    <option value="">Working as…</option>
                    {Object.keys(OFFICIAL).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => {
                    fetchTasks(true);
                    fetchProduction();
                  }}
                  title={connMeta.label}
                  className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[12px] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${connMeta.dot}`} />
                  <span className="font-mono">{refreshing ? 'Syncing' : connMeta.short}</span>
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1400px] space-y-9">
            {/* --------------------------------------------- NAV ------- */}
            <nav className="-mt-6 flex gap-0.5 overflow-x-auto border-b border-zinc-800/80 pb-px custom-scrollbar">
              {VIEWS.map((v) => {
                const active = view === v.key;
                const badge =
                  v.key === 'events'
                    ? events.length
                    : v.key === 'requests'
                    ? requests.length
                    : v.key === 'production'
                    ? outputs.length
                    : 0;
                const external = v.key === 'portfolio' || v.key === 'gatepass';
                const alert = v.key === 'events' ? approvalQueue.length : 0;
                return (
                  <button
                    key={v.key}
                    onClick={() => setView(v.key)}
                    title={v.hint}
                    className={`group relative shrink-0 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                      active ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {v.label}
                    {badge > 0 && (
                      <span className="ml-1.5 font-mono text-[11px] text-zinc-600">{badge}</span>
                    )}
                    {external && (
                      <span className="ml-1 text-[10px] text-zinc-700" aria-hidden>
                        ·
                      </span>
                    )}
                    {alert > 0 && (
                      <span className="absolute right-1 top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    )}
                    {active && (
                      <span className="absolute inset-x-0 -bottom-px h-px bg-[#00aeef]" />
                    )}
                  </button>
                );
              })}
            </nav>

            {healthChecked && health && health.problems.length > 0 && (
              <div className="rounded-md border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-[12px] leading-relaxed text-amber-200">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-medium">
                    Backend setup needs attention ({health.problems.length})
                  </p>
                  <button
                    onClick={checkHealth}
                    className="shrink-0 text-[11px] text-amber-300/70 underline transition-colors hover:text-amber-200"
                  >
                    Check again
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {health.problems.map((prob, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 text-amber-500/60">{i + 1}.</span>
                      <span className="whitespace-pre-line">{prob}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {lastError && (
              <div className="rounded-md border border-red-900/60 bg-red-950/25 px-4 py-3 text-[12px] leading-relaxed text-red-200">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <p className="font-medium">{lastError.what} failed</p>
                  <button
                    onClick={() => setLastError(null)}
                    className="shrink-0 text-[11px] text-red-300/60 underline transition-colors hover:text-red-200"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="font-mono text-[11px] leading-relaxed text-red-200/90">
                  {lastError.detail}
                </p>
              </div>
            )}

            {setupError && (
              <div className="rounded-md border border-red-900/60 bg-red-950/25 px-4 py-3 text-[12px] leading-relaxed text-red-200">
                <p className="mb-1 font-medium">Setup incomplete</p>
                <p>{setupError}</p>
                <p className="mt-2 text-red-300/70">
                  In Apps Script: Run → <span className="font-mono">authorize()</span>, accept
                  the permission prompt, then Deploy → Manage deployments → New version.
                </p>
                <button
                  onClick={() => setSetupError('')}
                  className="mt-2 text-[11px] text-red-300/60 underline transition-colors hover:text-red-200"
                >
                  Dismiss
                </button>
              </div>
            )}

            {!AUTH_ENABLED && (
              <div className="rounded-md border border-amber-900/60 bg-amber-950/20 px-4 py-2.5 text-[12px] text-amber-300">
                <span className="font-medium">Attribution mode.</span> Changes are recorded
                under the selected name, but nothing is enforced — anyone with this link can
                edit any record. Set{' '}
                <span className="font-mono">GOOGLE_CLIENT_ID</span> in App.tsx and AVNexus.gs
                to require sign-in.
              </div>
            )}

            {(conn === 'error' || probes.some((pr) => !pr.ok)) && (
              <div className="space-y-3">
                {conn === 'error' && (
                  <p className="rounded-md border border-red-900/60 bg-red-950/25 px-4 py-2.5 text-[12px] text-red-200">
                    Could not load records — {errMsg}. Showing the last data received.
                  </p>
                )}
                <ConnectionPanel probes={probes} busy={probing} onRetry={runProbes} />
              </div>
            )}

            {view === 'pulse' && (
            <>
            {/* --------------------------------- ARCHIVING TOOLS ------- */}
            <section>
              <SectionHead
                title="Archiving tools"
                hint="The DMC archive, its source sheets, and the AppSheet tasking app."
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  {
                    name: 'Tasking System',
                    role: 'AppSheet — DMC transfer and archiving log',
                    url: SYSTEMS.find((x) => x.id === 'tasking')?.url || '',
                    accent: '#f59e0b',
                  },
                  {
                    name: 'DMC Monitoring',
                    role: 'Master archive of transferred coverage',
                    url: DMC_MONITORING_LINK,
                    accent: CYAN,
                  },
                  {
                    name: 'Pre-Archival',
                    role: 'Staging list before DMC transfer',
                    url: PRE_ARCHIVAL_LINK,
                    accent: '#71717a',
                  },
                ].map((tool) => (
                  <a
                    key={tool.name}
                    href={tool.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between gap-4 rounded-md border border-zinc-800/80 bg-[#101012] px-4 py-3.5 transition-colors hover:border-zinc-700"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: tool.accent }}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-zinc-100">{tool.name}</p>
                        <p className="truncate text-[11px] text-zinc-600">{tool.role}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[12px] text-zinc-600 transition-colors group-hover:text-[#00aeef]">
                      Open
                    </span>
                  </a>
                ))}
              </div>
            </section>

            {/* -------------------------------------- OPERATIONS PULSE -- */}
            <section>
              <SectionHead title="OPERATIONS PULSE" hint="Full-year figures from the DMC sheet." />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile
                  label="Total coverages"
                  value={stats.total}
                  sub="Operations on record"
                  accent={CYAN}
                  bar={100}
                />
                <StatTile
                  label="DMC cleared"
                  value={stats.counts.transferred + stats.counts.archived}
                  sub="Transferred + archived"
                  accent="#22c55e"
                  bar={stats.total ? ((stats.counts.transferred + stats.counts.archived) / stats.total) * 100 : 0}
                />
                <StatTile
                  label="Pending transfer"
                  value={stats.counts.pending}
                  sub="Awaiting upload"
                  accent="#f59e0b"
                  bar={stats.total ? (stats.counts.pending / stats.total) * 100 : 0}
                />
                <StatTile
                  label="This month"
                  value={stats.thisMonth}
                  sub={new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
                  accent="#ef4444"
                  bar={stats.total ? (stats.thisMonth / Math.max(1, stats.total)) * 100 : 0}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-md border border-zinc-800/80 bg-[#101012] p-5">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    DMC status mix
                  </p>
                  <StatusDonut counts={stats.counts} total={stats.total} />
                </div>
                <div className="rounded-md border border-zinc-800/80 bg-[#101012] p-5">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Deployment load
                  </p>
                  <WorkloadBars data={workload} />
                  <div className="mt-4 flex gap-4 border-t border-zinc-900 pt-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <span className="h-1.5 w-3 rounded-full bg-[#00aeef]" />
                      Field coverage (DMC)
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <span className="h-1.5 w-3 rounded-full bg-amber-400" />
                      Video output
                    </span>
                  </div>
                </div>
                <div className="rounded-md border border-zinc-800/80 bg-[#101012] p-5">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Up next
                  </p>
                  <div className="space-y-3">
                    {upNext.map((c, i) => (
                      <div key={i} className="border-l-2 border-red-500/60 pl-3">
                        <p className="line-clamp-2 text-xs leading-snug text-zinc-300">{c.details}</p>
                        <p className="mt-1 font-mono text-[10px] text-zinc-600">
                          {fmtDate(c.dateObj)} {relativeDay(c.dateObj) && `· ${relativeDay(c.dateObj)}`}
                        </p>
                      </div>
                    ))}
                    {upNext.length === 0 && (
                      <p className="text-xs italic text-zinc-600">
                        Nothing scheduled.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-md border border-zinc-800/80 bg-[#101012] p-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                  Coverage density · last 26 weeks
                </p>
                <ActivityGrid coverages={coverages} />
              </div>
            </section>

            {/* --------------------------------------- AV TEAM STATUS --- */}
            <section>
              <SectionHead title="AV TEAM STATUS" hint="Select a card to view the full deployment history." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {TEAM.map((member) => {
                  const act = latestActivityFor(member.name, coverages, outputs);
                  const w = workload.find((x) => x.name === member.name);
                  return (
                    <button
                      key={member.name}
                      onClick={() => setDrawerPerson(member)}
                      className="group relative cursor-pointer overflow-hidden rounded-md border border-zinc-800/80 bg-[#101012] p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-[#00aeef]/50 hover:bg-[#101012]"
                    >
                      <div className="mb-4 flex items-center gap-4">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-zinc-800 transition-colors duration-300 group-hover:border-[#00aeef]">
                          <img
                            src={member.image}
                            alt={member.name}
                            className="h-full w-full transform object-cover transition-transform duration-500 group-hover:scale-125"
                          />
                        </div>
                        <div className="flex flex-1 items-center justify-between">
                          <div>
                            <h3 className="text-xl font-black uppercase tracking-wider text-white">
                              {member.name}
                            </h3>
                            <p className="font-mono text-[10px] text-zinc-600">
                              {w?.cov ?? 0} cov · {w?.out ?? 0} vid
                            </p>
                          </div>
                          {act ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#00aeef]" />
                          ) : (
                            <span className="h-3 w-3 rounded-full bg-zinc-800" />
                          )}
                        </div>
                      </div>
                      {act ? (
                        <div className="relative z-10">
                          <p
                            className="mb-3 line-clamp-2 text-sm leading-relaxed text-zinc-300"
                            title={act.kind === 'coverage' ? act.cov.details : act.out.title}
                          >
                            {act.kind === 'coverage' ? act.cov.details : act.out.title}
                          </p>
                          <div className="flex items-center justify-between">
                            {act.kind === 'coverage' ? (
                              <StatusBadge status={act.cov.status} />
                            ) : (
                              <StageBadge stage={act.out.stage} />
                            )}
                            <span className="font-mono text-[10px] text-zinc-500">
                              {fmtDate(act.when)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-6 text-xs italic text-zinc-600">Standby — no active deployment.</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            </>
            )}

            {view === 'production' && (
            <>
            {/* ------------------------------------ PRODUCTION BOARD ---- */}
            <section ref={boardRef}>
              <SectionHead
                title="PRODUCTION BOARD"
                hint="Video outputs that do not pass through DMC — shoot, edit and post-production."
                right={
                  <div className="flex items-center gap-2">
                    <div className="hidden items-center gap-1 md:flex">
                      {['ALL', 'Marx', 'Reiner', 'Xyrus', 'Pat'].map((n) => (
                        <button
                          key={n}
                          onClick={() => setProdPerson(n)}
                          className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            prodPerson === n
                              ? 'border-[#00aeef]/40 bg-[#00aeef]/10 text-[#00aeef]'
                              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {n === 'ALL' ? 'Lahat' : n}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setLogOpen(true)}
                      className="rounded bg-[#00aeef] px-3 py-1.5 text-[12px] font-medium text-[#06121a] transition-opacity hover:opacity-90"
                    >
                      + Log output
                    </button>
                  </div>
                }
              />

              {prodReady === 'missing' ? (
                <div className="rounded-md border border-dashed border-zinc-800 bg-[#101012] p-8 text-center">
                  <p className="mb-2 text-sm font-bold text-white">Production Log is not set up yet</p>
                  <p className="mx-auto max-w-lg text-xs leading-relaxed text-zinc-500">
                    In the AV Production Log spreadsheet, open Extensions → Apps Script, paste{' '}
                    <span className="font-mono text-zinc-300">AVNexus.gs</span>, run{' '}
                    <span className="font-mono text-[#00aeef]">authorize()</span> then{' '}
                    <span className="font-mono text-[#00aeef]">quickSetup()</span>, redeploy the web
                    app, and put the /exec URL in{' '}
                    <span className="font-mono text-[#00aeef]">PROD_SCRIPT_URL</span>. The DMC and
                    AppSheet spreadsheet is not touched.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <StatTile
                      label="Video outputs"
                      value={prodSummary.total}
                      sub="Deliverables on record"
                      accent={CYAN}
                      bar={100}
                    />
                    <StatTile
                      label="In progress"
                      value={prodSummary.live}
                      sub="Still in progress"
                      accent="#f59e0b"
                      bar={prodSummary.total ? (prodSummary.live / prodSummary.total) * 100 : 0}
                    />
                    <StatTile
                      label="Delivered"
                      value={prodSummary.done}
                      sub={`Total runtime ${fmtRuntime(prodSummary.seconds)}`}
                      accent="#22c55e"
                      bar={prodSummary.total ? (prodSummary.done / prodSummary.total) * 100 : 0}
                    />
                    <StatTile
                      label="Overdue"
                      value={prodSummary.overdue}
                      sub={
                        prodSummary.onTime === null
                          ? 'No target dates set'
                          : `${prodSummary.onTime}% on-time delivery`
                      }
                      accent="#ef4444"
                      bar={prodSummary.total ? (prodSummary.overdue / prodSummary.total) * 100 : 0}
                    />
                  </div>

                  {outputs.length === 0 ? (
                    <div className="rounded-md border border-dashed border-zinc-800 bg-[#101012] p-10 text-center">
                      <p className="mb-1 text-sm text-zinc-300">No outputs logged yet.</p>
                      <p className="mb-4 text-xs text-zinc-600">
                        Simulan sina Marx at Reiner — kahit shoot day lang, bilang 'yon.
                      </p>
                      <button
                        onClick={() => setLogOpen(true)}
                        className="rounded-lg bg-[#00aeef] px-5 py-2 text-sm font-bold text-black hover:opacity-85"
                      >
                        Log the first output
                      </button>
                    </div>
                  ) : (
                    <>
                      <ProductionBoard
                        outputs={boardOutputs}
                        onAdvance={advanceStage}
                        busyId={busyId}
                      />
                      <div className="mt-4 rounded-md border border-zinc-800/80 bg-[#101012] p-5">
                        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                          Output scoreboard · quantity, timeliness, revisions
                        </p>
                        <ProductionScoreboard
                          outputs={outputs}
                          people={TEAM.map((t) => t.name)}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </section>

            </>
            )}

            {view === 'pulse' && (
            <>
            {/* -------------------------------- RECORDS + CALENDAR ------ */}
            <div ref={recordsRef} className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <section className="lg:col-span-2">
                <SectionHead
                  title="COVERAGE RECORDS"
                  hint={`${filteredRecords.length} of ${coverages.length} records match.`}
                />

                <div className="mb-4 space-y-3 rounded-md border border-zinc-800/80 bg-[#101012] p-4">
                  <div className="flex items-center gap-2 rounded-md border border-zinc-800/80 bg-[#0c0c0e] px-3 py-2">
                    <span className="text-zinc-600">⌕</span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search coverage, personnel or status…"
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                    />
                    {query && (
                      <button onClick={() => setQuery('')} className="text-xs text-zinc-500 hover:text-white">
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['ALL', ...TEAM.map((t) => t.name)].map((p) => (
                      <button
                        key={p}
                        onClick={() => setFilterPerson(p)}
                        className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          filterPerson === p
                            ? 'border-[#00aeef]/40 bg-[#00aeef]/10 text-[#00aeef]'
                            : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {p === 'ALL' ? 'All personnel' : p}
                      </button>
                    ))}
                    <span className="mx-1 w-px bg-zinc-800" />
                    {(['ALL', ...STATUS_ORDER] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(s as 'ALL' | StatusKey)}
                        className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          filterStatus === s
                            ? 'border-red-500/50 bg-red-500/10 text-red-400'
                            : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {s === 'ALL' ? 'All status' : STATUS_META[s as StatusKey].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {!booted &&
                    [0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-28 animate-pulse rounded-lg border border-zinc-800 bg-[#101012]"
                      />
                    ))}

                  {booted &&
                    filteredRecords.slice(0, visibleCount).map((cov, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col justify-between gap-4 rounded-md border border-zinc-800/80 bg-[#101012] p-5 transition-colors hover:border-zinc-700 hover:bg-[#101012] md:flex-row"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="mb-2 text-base font-bold leading-snug text-zinc-100">
                            {cov.details || 'Untitled coverage'}
                          </h3>
                          <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-400">
                            <span className="rounded bg-zinc-800 px-2 py-0.5 font-bold uppercase tracking-wider text-zinc-200">
                              {cov.personnel}
                            </span>
                            <span className="text-zinc-600">•</span>
                            <span>{fmtDate(cov.dateObj, cov.date)}</span>
                            {relativeDay(cov.dateObj) && (
                              <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-zinc-500">{relativeDay(cov.dateObj)}</span>
                              </>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-4">
                            {cov.gdrive && (
                              <a
                                href={cov.gdrive}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-xs font-medium text-[#00aeef] transition-colors hover:text-white"
                              >
                                Drive
                              </a>
                            )}
                            {cov.socialMediaLink && (
                              <a
                                href={cov.socialMediaLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-xs font-medium text-[#00aeef] transition-colors hover:text-white"
                              >
                                Social
                              </a>
                            )}
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(
                                  `[${fmtDate(cov.dateObj, cov.date)}] ${cov.details} — ${cov.personnel} — ${cov.status}`
                                );
                                toast('Copied to clipboard', 'ok');
                              }}
                              className="text-xs text-zinc-600 transition-colors hover:text-zinc-300"
                            >
                              ⧉ Copy line
                            </button>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-start justify-center gap-3 md:items-end">
                          <StatusBadge status={cov.status} />
                        </div>
                      </div>
                    ))}

                  {booted && filteredRecords.length === 0 && (
                    <div className="rounded-lg border border-dashed border-zinc-800 p-10 text-center">
                      <p className="text-sm text-zinc-400">No matching records.</p>
                      <button
                        onClick={() => {
                          setQuery('');
                          setFilterPerson('ALL');
                          setFilterStatus('ALL');
                        }}
                        className="mt-3 text-xs font-bold text-[#00aeef] hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}

                  {filteredRecords.length > visibleCount && (
                    <button
                      onClick={() => setVisibleCount((v) => v + 12)}
                      className="w-full rounded-lg border border-zinc-800 py-3 text-xs font-bold uppercase tracking-[0.1em] text-zinc-400 transition-colors hover:border-[#00aeef]/40 hover:text-[#00aeef]"
                    >
                      Show 12 more · {filteredRecords.length - visibleCount} remaining
                    </button>
                  )}
                </div>
              </section>

              <section className="space-y-8 lg:col-span-1">
                <div>
                  <SectionHead title="AV CALENDAR" />
                  <div className="group relative h-[450px] overflow-hidden rounded-md border border-zinc-800/80 bg-[#101012]">
                    <iframe
                      src={CAL_EMBED}
                      style={{ border: 0 }}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      className="absolute inset-0 opacity-80 transition-opacity hover:opacity-100"
                      title="AV Calendar"
                    />
                  </div>
                </div>

                <div>
                  <SectionHead title="SHORTCUTS" />
                  <div className="space-y-2 rounded-md border border-zinc-800/80 bg-[#101012] p-4">
                    {[
                      ['⌘K / Ctrl K', 'Jump to anything'],
                      ['/', 'Open search'],
                      ['ESC', 'Close the current panel'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3">
                        <kbd className="rounded border border-zinc-800 bg-black/60 px-2 py-1 font-mono text-[10px] text-zinc-400">
                          {k}
                        </kbd>
                        <span className="text-xs text-zinc-500">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            </>
            )}

            {/* ========================================= EVENTS ======== */}
            {view === 'events' && (
              <>
                <section>
                  <SectionHead
                    title="EVENT MONITORING"
                    hint="For every event: what was requested, what was approved, and what was actually delivered."
                    right={
                      <button
                        onClick={() => setEvModal({ open: true, editing: null })}
                        className="rounded bg-[#00aeef] px-3 py-1.5 text-[12px] font-medium text-[#06121a] transition-opacity hover:opacity-90"
                      >
                        + New event
                      </button>
                    }
                  />

                  {prodReady === 'missing' ? (
                    <div className="rounded-md border border-dashed border-zinc-800 bg-[#101012] p-8 text-center">
                      <p className="mb-2 text-sm font-bold text-white">
                        Events sheet is not connected
                      </p>
                      <p className="mx-auto max-w-lg text-xs leading-relaxed text-zinc-500">
                        In the AV Production Log spreadsheet, open Extensions → Apps Script,
                        paste <span className="font-mono text-zinc-300">AVNexus.gs</span>, fill in
                        EMAIL_SRS and EMAIL_DC, run{' '}
                        <span className="font-mono text-[#00aeef]">authorize()</span> then{' '}
                        <span className="font-mono text-[#00aeef]">quickSetup()</span>, then
                        Deploy → Manage deployments → New version.
                      </p>
                    </div>
                  ) : (
                    <>
                      <EventSummary events={events} />

                      {approvalQueue.length > 0 && (
                        <div className="mt-4 rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-400">
                              Awaiting action · {approvalQueue.length}
                            </p>
                            <span className="font-mono text-[10px] text-zinc-500">
                              Division Chief → Supervising SRS
                            </span>
                          </div>
                          <div className="space-y-2">
                            {approvalQueue.slice(0, 5).map((ev) => (
                              <div
                                key={ev.id}
                                className="flex items-center justify-between gap-3 rounded-md border border-zinc-800/80 bg-[#0c0c0e] px-3 py-2"
                              >
                                <button
                                  onClick={() => setEvModal({ open: true, editing: ev })}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <p className="truncate text-xs font-semibold text-zinc-100">
                                    {ev.title}
                                  </p>
                                  <p className="truncate font-mono text-[10px] text-zinc-600">
                                    {ev.client || '—'} ·{' '}
                                    {ev.requested.length} services requested
                                  </p>
                                </button>
                                <div className="flex shrink-0 items-center gap-2">
                                  <ApprovalChip k={ev.approval} dense />
                                  <button
                                    onClick={() => notifyApprover(ev.id)}
                                    title="Resend approval email"
                                    className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:border-[#00aeef]/50 hover:text-[#00aeef]"
                                  >
                                    
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mb-4 mt-4 space-y-3 rounded-md border border-zinc-800/80 bg-[#101012] p-4">
                        <div className="flex items-center gap-2 rounded-md border border-zinc-800/80 bg-[#0c0c0e] px-3 py-2">
                          <span className="text-zinc-600">⌕</span>
                          <input
                            value={evQuery}
                            onChange={(e) => setEvQuery(e.target.value)}
                            placeholder="Search events, clients, personnel, venue or service…"
                            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                          />
                          {evQuery && (
                            <button
                              onClick={() => setEvQuery('')}
                              className="text-xs text-zinc-500 hover:text-white"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(['ALL', ...APPROVAL_ORDER] as const).map((k) => (
                            <button
                              key={k}
                              onClick={() => setEvApproval(k as 'ALL' | ApprovalKey)}
                              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                evApproval === k
                                  ? 'border-[#00aeef]/40 bg-[#00aeef]/10 text-[#00aeef]'
                                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {k === 'ALL' ? 'All approval' : APPROVAL_META[k as ApprovalKey].label}
                            </button>
                          ))}
                          <span className="mx-1 w-px bg-zinc-800" />
                          {(['ALL', 'full', 'partial', 'none', 'declined'] as const).map((k) => (
                            <button
                              key={k}
                              onClick={() => setEvFulfil(k as 'ALL' | Fulfilment)}
                              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                evFulfil === k
                                  ? 'border-red-500/50 bg-red-500/10 text-red-400'
                                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {k === 'ALL' ? 'All service' : FULFIL_META[k as Fulfilment].label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {filteredEvents.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
                          <p className="mb-1 text-sm text-zinc-300">No matching events.</p>
                          <p className="mb-4 text-xs text-zinc-600">
                            Dito nagsisimula ang lahat — gumawa ng event para masimulan ang
                            approval at tasking.
                          </p>
                          <button
                            onClick={() => setEvModal({ open: true, editing: null })}
                            className="rounded-lg bg-[#00aeef] px-5 py-2 text-sm font-bold text-black hover:opacity-85"
                          >
                            Create the first event
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                          {filteredEvents.map((ev) => (
                            <EventCard
                              key={ev.id}
                              ev={ev}
                              crew={assignments.filter((a) => a.eventId === ev.id)}
                              canEdit={can('edit', myRole, ev.createdBy, myName)}
                              onOpen={() => setEvModal({ open: true, editing: ev })}
                              onStep={(k, next) => stepEvent(ev, k, next)}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}

            {/* ==================================== AV SERVICES ======= */}
            {view === 'portfolio' && (
              <SystemFrame app={SYSTEMS.find((x) => x.id === 'portfolio')!} />
            )}

            {/* ====================================== GATE PASS ======= */}
            {view === 'gatepass' && (
              <SystemFrame app={SYSTEMS.find((x) => x.id === 'gatepass')!} />
            )}

            {/* ================================== REQUEST REGISTER ==== */}
            {view === 'requests' && (
              <>
                <section>
                  <SectionHead
                    title="REQUEST REGISTER"
                    hint="ISO master record — every request received, with its outcome and reason."
                    right={
                      <button
                        onClick={() => setReqModal({ open: true, editing: null })}
                        className="rounded bg-[#00aeef] px-3 py-1.5 text-[12px] font-medium text-[#06121a] transition-opacity hover:opacity-90"
                      >
                        + Log request
                      </button>
                    }
                  />

                  {prodReady === 'missing' ? (
                    <div className="rounded-md border border-dashed border-zinc-800 bg-[#101012] p-8 text-center">
                      <p className="mb-2 text-sm font-bold text-white">
                        Request Register is not set up
                      </p>
                      <p className="mx-auto max-w-lg text-xs leading-relaxed text-zinc-500">
                        In the AV Production Log spreadsheet, open Extensions → Apps Script,
                        paste <span className="font-mono text-zinc-300">AVNexus.gs</span>, fill in
                        EMAIL_SRS and EMAIL_DC, run{' '}
                        <span className="font-mono text-[#00aeef]">authorize()</span> then{' '}
                        <span className="font-mono text-[#00aeef]">quickSetup()</span>, then
                        Deploy → Manage deployments → New version.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 space-y-3 rounded-md border border-zinc-800/80 bg-[#101012] p-4">
                        <div className="flex items-center gap-2 rounded-md border border-zinc-800/80 bg-[#0c0c0e] px-3 py-2">
                          <span className="text-zinc-600">⌕</span>
                          <input
                            value={reqQuery}
                            onChange={(e) => setReqQuery(e.target.value)}
                            placeholder="Search requests, clients, personnel or service type…"
                            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                          />
                          {reqQuery && (
                            <button
                              onClick={() => setReqQuery('')}
                              className="text-xs text-zinc-500 hover:text-white"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(['ALL', ...REQ_ORDER] as const).map((k) => (
                            <button
                              key={k}
                              onClick={() => setReqStatusFilter(k as 'ALL' | ReqStatus)}
                              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                reqStatusFilter === k
                                  ? 'border-[#00aeef]/40 bg-[#00aeef]/10 text-[#00aeef]'
                                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {k === 'ALL'
                                ? 'All status'
                                : `${REQ_META[k as ReqStatus].label} ${reqCounts[k as ReqStatus] || 0}`}
                            </button>
                          ))}
                          <span className="mx-1 w-px bg-zinc-800" />
                          {(['ALL', 'coverage', 'production'] as const).map((k) => (
                            <button
                              key={k}
                              onClick={() => setReqStreamFilter(k as 'ALL' | Stream)}
                              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                reqStreamFilter === k
                                  ? 'border-red-500/50 bg-red-500/10 text-red-400'
                                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {k === 'ALL' ? 'All streams' : STREAM_META[k as Stream].short}
                            </button>
                          ))}
                        </div>
                      </div>

                      <RequestTable
                        requests={filteredRequests}
                        onEdit={(r) => setReqModal({ open: true, editing: r })}
                      />
                    </>
                  )}
                </section>

                <section>
                  <SectionHead
                    title="UNMET REQUESTS LOG"
                    hint="Audit Item 40 — outcome and justification for every unserved request."
                  />
                  <div className="rounded-md border border-zinc-800/80 bg-[#101012] p-5">
                    <UnmetRequestsLog requests={requests} />
                  </div>
                </section>
              </>
            )}

            {/* ====================================== COMPLIANCE ====== */}
            {view === 'compliance' && prodReady === 'missing' && events.length === 0 && (
              <section>
                <SectionHead
                  title="COMPLIANCE"
                  hint="Audit Items 40, 41 and 44 — awaiting a connection to the register."
                />
                <div className="rounded-md border border-dashed border-zinc-800 bg-[#101012] p-8 text-center">
                  <p className="mb-2 text-sm font-bold text-white">
                    Register is not connected
                  </p>
                  <p className="mx-auto max-w-lg text-xs leading-relaxed text-zinc-500">
                    No compliance data can be shown until requests are recorded. Paste{' '}
                    <span className="font-mono text-zinc-300">AVNexus.gs</span>, run{' '}
                    <span className="font-mono text-[#00aeef]">authorize()</span> then{' '}
                    <span className="font-mono text-[#00aeef]">quickSetup()</span>, redeploy, and set{' '}
                    <span className="font-mono text-[#00aeef]">PROD_SCRIPT_URL</span>.
                  </p>
                </div>
              </section>
            )}

            {view === 'compliance' && (prodReady !== 'missing' || events.length > 0) && (
              <>
                <section>
                  <SectionHead
                    title="SERVICE PERFORMANCE KPI"
                    hint="PM-CRPD-AV-08-04 Rev 7, section 2 — Expected Outputs."
                  />
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-md border border-zinc-800/80 bg-[#101012] p-6">
                      <KPIRing
                        value={kpi.execution}
                        target={KPI_EXECUTION_TARGET}
                        label="Requests executed"
                        sub={`${kpi.deliveredTotal} of ${kpi.approvedTotal} approved requests delivered to the client.`}
                      />
                    </div>
                    <div className="rounded-md border border-zinc-800/80 bg-[#101012] p-6">
                      <KPIRing
                        value={kpi.csm}
                        target={KPI_CSM_TARGET}
                        label="CSM very satisfactory+"
                        sub={`${kpi.rated} request ang may CSM rating. Target: 93% na Very Satisfactory pataas.`}
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <SectionHead
                    title="SERVICE GAP ANALYSIS"
                    hint="Audit Item 44 — every service requested against what was actually delivered."
                  />
                  <div className="rounded-md border border-zinc-800/80 bg-[#101012] p-5">
                    <ServiceGapPanel events={events} />
                  </div>
                </section>

                {requests.length > 0 && (
                  <section>
                    <SectionHead
                      title="DEMAND VS CAPACITY"
                      hint="Monthly demand against services rendered."
                    />
                    <div className="rounded-md border border-zinc-800/80 bg-[#101012] p-5">
                      <DemandCapacityPanel requests={requests} />
                    </div>
                  </section>
                )}

                <section>
                  <SectionHead
                    title="WORKLOAD BY ROLE"
                    hint="Audit Item 41 — true workload: every role counted separately."
                  />
                  <div className="overflow-x-auto rounded-md border border-zinc-800/80 bg-[#101012] custom-scrollbar">
                    <table className="w-full min-w-[640px] text-left">
                      <thead>
                        <tr className="border-b border-zinc-800/80 text-[11px] text-zinc-600">
                          <th className="px-4 py-2.5 font-medium">Personnel</th>
                          <th className="px-4 py-2.5 text-right font-medium">Events</th>
                          <th className="px-4 py-2.5 text-right font-medium">Roles filled</th>
                          <th className="px-4 py-2.5 text-right font-medium">Avg per event</th>
                          <th className="px-4 py-2.5 font-medium">Most frequent roles</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roleLoad.map((r) => (
                          <tr key={r.name} className="border-b border-zinc-900 last:border-0">
                            <td className="px-4 py-3 text-[13px] font-medium text-zinc-200">
                              {r.name}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[13px] text-zinc-300 tabular-nums">
                              {r.events}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[13px] text-zinc-50 tabular-nums">
                              {r.roleCount}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[13px] text-zinc-500 tabular-nums">
                              {r.events ? (r.roleCount / r.events).toFixed(1) : '—'}
                            </td>
                            <td className="px-4 py-3 text-[12px] text-zinc-500">
                              {r.top.length
                                ? r.top.map(([role, n]) => `${role} (${n})`).join(', ')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {roleLoad.every((r) => r.roleCount === 0) && (
                      <p className="px-4 py-6 text-center text-[12px] text-zinc-600">
                        No crew assignments recorded yet. Add them inside an event.
                      </p>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-600">
                    An average above 1.0 means one person is holding several roles at once — direct evidence of a personnel shortfall.
                  </p>
                </section>

                <section>
                  <SectionHead
                    title="TURNAROUND TIME MONITOR"
                    hint="Audit Item 41 — actual processing time against the standard, in working days."
                  />
                  <div className="rounded-md border border-zinc-800/80 bg-[#101012] p-5">
                    <SLAMonitor requests={isoRequests} />
                  </div>
                </section>

                <section>
                  <SectionHead
                    title="AUDIT READINESS"
                    hint="Each finding shown with live evidence from the register."
                  />
                  <ComplianceScorecard requests={isoRequests} kpi={kpi} events={events} />
                </section>
              </>
            )}

            {view === 'reports' && (
            <>
            {/* ------------------------------------ IPCR GENERATOR ------ */}
            <section ref={ipcrRef} className="border-t border-zinc-800 pt-10">
              <div className="rounded-md border border-zinc-800/80 bg-[#101012] p-6">
                <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <h2 className="text-lg font-bold uppercase tracking-wide text-white">
                      IPCR / MOV Report Generator
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Select a name and year, then print or export for the IPCR/SPMS attachment.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedIPCRPersonnel}
                      onChange={(e) => setSelectedIPCRPersonnel(e.target.value)}
                      className="rounded border border-zinc-800 bg-[#0c0c0e] px-3 py-1.5 text-[13px] text-zinc-200 focus:border-[#00aeef] focus:outline-none"
                    >
                      <option value="Xyrus">Xyrus (AVAT IV)</option>
                      <option value="Marx">Marx (SRS II)</option>
                      <option value="Reiner">Reiner (AVAT III)</option>
                      <option value="Pat">Pat (Photographer II)</option>
                      <option value="Lotus">Ma'am Lotus (Supervisor Tally)</option>
                    </select>
                    <select
                      value={ipcrYear}
                      onChange={(e) => setIpcrYear(e.target.value)}
                      className="rounded border border-zinc-800 bg-[#0c0c0e] px-3 py-1.5 text-[13px] text-zinc-200 focus:border-[#00aeef] focus:outline-none"
                    >
                      <option value="ALL">All years</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={exportCSV}
                      className="rounded border border-zinc-800 px-3 py-2 text-[13px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={printSheet}
                      className="flex items-center gap-2 rounded border border-zinc-800 px-4 py-2 text-[13px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                    >
                      Print / Save as PDF
                    </button>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={ipcrIncludeLinks}
                      onChange={(e) => setIpcrIncludeLinks(e.target.checked)}
                      className="accent-[#00aeef]"
                    />
                    Include Drive and social links in the printout
                  </label>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
                    Control no. {controlNo}
                  </span>
                </div>

                <div className="custom-scrollbar max-h-[420px] overflow-y-auto rounded-lg border border-zinc-800 bg-black p-5 font-mono text-sm">
                  <p className="mb-3 border-b border-zinc-800 pb-2 font-bold text-red-500">
                    PREVIEW — ito ang lalabas sa printed sheet
                  </p>
                  <div className="space-y-1 text-zinc-300">
                    <p className="text-base font-bold uppercase text-white">
                      {OFFICIAL[selectedIPCRPersonnel]?.fullName || selectedIPCRPersonnel} — TOTAL:{' '}
                      {ipcrRecords.length}{' '}
                      {selectedIPCRPersonnel === 'Lotus' ? 'VERIFIED / CHECKED' : 'COVERAGES CATERED'}
                    </p>
                    <p className="text-zinc-700">
                      --------------------------------------------------
                    </p>
                    {ipcrRecords.map((cov, idx) => (
                      <p key={idx} className="whitespace-pre-wrap leading-relaxed">
                        <span className="font-bold text-red-500">{idx + 1}.</span> [
                        {fmtDate(cov.dateObj, cov.date)}] — {cov.details}{' '}
                        <span className="text-zinc-600">[{cov.status.toUpperCase()}]</span>
                      </p>
                    ))}
                    {ipcrRecords.length === 0 && (
                      <p className="italic text-zinc-600">No field coverage for the selected period.</p>
                    )}

                    {ipcrRoles.length > 0 && (
                      <>
                        <p className="mt-4 text-base font-bold uppercase text-white">
                          PART D — ROLES PERFORMED: {ipcrRoles.reduce((a, x) => a + x.roles.length, 0)}
                        </p>
                        <p className="text-zinc-700">
                          --------------------------------------------------
                        </p>
                        {ipcrRoles.map((a, idx) => (
                          <p key={a.id} className="whitespace-pre-wrap leading-relaxed">
                            <span className="font-bold text-[#00aeef]">{idx + 1}.</span> [
                            {fmtDate(a.dateCompleted || a.dateAssigned)}] — {a.eventTitle || a.eventId}{' '}
                            <span className="text-zinc-600">[{a.roles.join(', ') || '—'}]</span>
                          </p>
                        ))}
                      </>
                    )}

                    {ipcrRequests.length > 0 && (
                      <>
                        <p className="mt-4 text-base font-bold uppercase text-white">
                          PART C — SERVICE REQUESTS HANDLED: {ipcrRequests.length}
                        </p>
                        <p className="text-zinc-700">
                          --------------------------------------------------
                        </p>
                        {ipcrRequests.map((r, idx) => {
                          const tat = actualTAT(r);
                          return (
                            <p key={r.id} className="whitespace-pre-wrap leading-relaxed">
                              <span className="font-bold text-green-500">{idx + 1}.</span> [
                              {fmtDate(r.dateDelivered || r.dateRequested)}] — {r.title}{' '}
                              <span className="text-zinc-600">
                                [{STREAM_META[r.stream].short} ·{' '}
                                {REQ_META[r.status].label.toUpperCase()}
                                {tat !== null ? ` · ${tat} WD` : ''}
                                {r.csm ? ` · CSM ${r.csm}` : ''}]
                              </span>
                            </p>
                          );
                        })}
                      </>
                    )}

                    {ipcrOutputs.length > 0 && (
                      <>
                        <p className="mt-4 text-base font-bold uppercase text-white">
                          PART B — VIDEO PRODUCTION OUTPUTS: {ipcrOutputs.length}
                        </p>
                        <p className="text-zinc-700">
                          --------------------------------------------------
                        </p>
                        {ipcrOutputs.map((o, idx) => (
                          <p key={o.id} className="whitespace-pre-wrap leading-relaxed">
                            <span className="font-bold text-[#00aeef]">{idx + 1}.</span> [
                            {fmtDate(o.delivered || o.target || o.assigned)}] — {o.title}{' '}
                            <span className="text-zinc-600">
                              [{o.type}{o.seconds ? ` · ${fmtRuntime(o.seconds)}` : ''} · {o.role} ·{' '}
                              {STAGE_META[o.stage].label.toUpperCase()}]
                            </span>
                          </p>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            </>
            )}

            <footer className="pb-8 pt-4 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-700">
                DOST-STII · CRPD · Broadcast &amp; Digital Media Section
              </p>
            </footer>
          </main>
        </div>

        {/* ============================================= PRINT SHEET ==== */}
        <div className="print-only hidden bg-white p-8 font-serif text-base text-black">
          <div className="mb-6 border-b-2 border-black pb-4 text-center">
            <p className="text-xs uppercase tracking-[0.1em]">Republic of the Philippines</p>
            <p className="text-sm font-bold uppercase">Department of Science and Technology</p>
            <p className="text-xs uppercase">Science and Technology Information Institute</p>
            <h1 className="mt-3 text-2xl font-bold uppercase tracking-wide">
              {selectedIPCRPersonnel === 'Lotus'
                ? 'Supervisory Verification Report'
                : 'AV Production Services Coverage Report'}
            </h1>
            <p className="mt-1 text-sm uppercase tracking-[0.1em]">
              AV Coverage and DMC Verification
            </p>
            <p className="mt-1 text-xs italic">Official reference document for IPCR / SPMS</p>
          </div>

          <div className="mb-6 flex justify-between text-sm">
            <div>
              <p className="text-lg font-bold uppercase">
                Name: <span className="underline">{OFFICIAL[selectedIPCRPersonnel]?.fullName || selectedIPCRPersonnel}</span>
              </p>
              <p className="font-bold uppercase">
                Position: {OFFICIAL[selectedIPCRPersonnel]?.designation}
              </p>
              <p className="mt-3 text-lg font-bold uppercase">
                {selectedIPCRPersonnel === 'Lotus'
                  ? 'Total verified / checked:'
                  : 'Total catered operations:'}{' '}
                <span className="underline">
                  {ipcrRecords.length + ipcrOutputs.length + ipcrRequests.length} record
                  {ipcrRecords.length + ipcrOutputs.length + ipcrRequests.length === 1 ? '' : 's'}
                </span>
              </p>
              <p className="text-xs">
                {ipcrRecords.length} field coverage · {ipcrOutputs.length} production output
                {ipcrOutputs.length === 1 ? '' : 's'} · {ipcrRequests.length} service request
                {ipcrRequests.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="text-right text-xs">
              <p>
                <span className="font-bold">Control No.:</span> {controlNo}
              </p>
              <p>
                <span className="font-bold">Period covered:</span>{' '}
                {ipcrYear === 'ALL' ? 'All available records' : `CY ${ipcrYear}`}
              </p>
              <p>
                <span className="font-bold">Generated:</span>{' '}
                {new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            </div>
          </div>

          <p className="mb-1 text-sm font-bold uppercase">
            Part A — Field coverage &amp; DMC transfer
          </p>
          <table className="w-full border-collapse border border-black text-left">
            <thead>
              <tr className="border-b border-black bg-gray-100 text-sm font-bold">
                <th className="w-10 border border-black p-2 text-center">#</th>
                <th className="w-28 border border-black p-2">Date</th>
                <th className="w-36 border border-black p-2">Status</th>
                <th className="border border-black p-2">Coverage particulars &amp; details</th>
                {ipcrIncludeLinks && <th className="w-44 border border-black p-2">Reference link</th>}
              </tr>
            </thead>
            <tbody>
              {ipcrRecords.map((cov, idx) => (
                <tr key={idx} className="avoid-break text-sm">
                  <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                  <td className="border border-black p-2 font-mono text-xs">
                    {fmtDate(cov.dateObj, cov.date)}
                  </td>
                  <td className="border border-black p-2 font-mono text-[10px] uppercase">
                    {cov.status}
                  </td>
                  <td className="border border-black p-2 leading-relaxed">{cov.details}</td>
                  {ipcrIncludeLinks && (
                    <td className="break-all border border-black p-2 text-[9px]">
                      {cov.gdrive || cov.socialMediaLink || '—'}
                    </td>
                  )}
                </tr>
              ))}
              {ipcrRecords.length === 0 && (
                <tr>
                  <td
                    colSpan={ipcrIncludeLinks ? 5 : 4}
                    className="border border-black p-4 text-center italic text-gray-500"
                  >
                    No official coverage records found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {ipcrOutputs.length > 0 && (
            <>
              <p className="mb-1 mt-8 text-sm font-bold uppercase">
                Part B — Video production outputs (non-DMC)
              </p>
              <table className="w-full border-collapse border border-black text-left">
                <thead>
                  <tr className="border-b border-black bg-gray-100 text-sm font-bold">
                    <th className="w-10 border border-black p-2 text-center">#</th>
                    <th className="w-28 border border-black p-2">Date</th>
                    <th className="w-32 border border-black p-2">Type</th>
                    <th className="border border-black p-2">Output title &amp; particulars</th>
                    <th className="w-20 border border-black p-2">Runtime</th>
                    <th className="w-32 border border-black p-2">Role</th>
                    <th className="w-24 border border-black p-2">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {ipcrOutputs.map((o, idx) => (
                    <tr key={o.id} className="avoid-break text-sm">
                      <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                      <td className="border border-black p-2 font-mono text-xs">
                        {fmtDate(o.delivered || o.target || o.assigned)}
                      </td>
                      <td className="border border-black p-2 text-xs">{o.type || '—'}</td>
                      <td className="border border-black p-2 leading-relaxed">
                        {o.title}
                        {o.event && (
                          <span className="block text-[10px] italic text-gray-600">{o.event}</span>
                        )}
                      </td>
                      <td className="border border-black p-2 text-center font-mono text-xs">
                        {o.seconds ? fmtRuntime(o.seconds) : '—'}
                      </td>
                      <td className="border border-black p-2 text-xs">{o.role || '—'}</td>
                      <td className="border border-black p-2 text-[10px] uppercase">
                        {STAGE_META[o.stage].label}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="avoid-break mt-6 border border-black p-3 text-sm">
                <p className="mb-2 font-bold uppercase">Performance summary</p>
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="font-bold">Quantity</p>
                    <p>
                      {ipcrQQT.quantity} total accomplishments
                      {ipcrQQT.runtime > 0 && ` · ${fmtRuntime(ipcrQQT.runtime)} of finished material`}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold">Quality</p>
                    <p>
                      {ipcrQQT.cleanPass} of {ipcrOutputs.length} approved with at most one revision
                      (avg. {ipcrQQT.avgRev} revisions)
                    </p>
                  </div>
                  <div>
                    <p className="font-bold">Timeliness</p>
                    <p>
                      {ipcrQQT.onTime === null
                        ? 'No target dates recorded'
                        : `${ipcrQQT.onTime}% delivered on or before target date`}
                    </p>
                    {ipcrSLA.onTime !== null && (
                      <p>
                        Requests: {ipcrSLA.onTime}% within SLA
                        {ipcrSLA.avgTAT !== null && `, avg ${ipcrSLA.avgTAT.toFixed(1)} WD`}
                      </p>
                    )}
                    {ipcrSLA.csm !== null && (
                      <p>
                        CSM: {ipcrSLA.csm}% very satisfactory or higher ({ipcrSLA.csmCount} rated)
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="font-bold">Source</p>
                    <p>AV Nexus — DMC Monitoring, Production Log &amp; Request Register</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {ipcrRequests.length > 0 && (
            <>
              <p className="mb-1 mt-8 text-sm font-bold uppercase">
                Part C — Service requests handled (Request Register)
              </p>
              <table className="w-full border-collapse border border-black text-left">
                <thead>
                  <tr className="border-b border-black bg-gray-100 text-sm font-bold">
                    <th className="w-10 border border-black p-2 text-center">#</th>
                    <th className="w-28 border border-black p-2">Date</th>
                    <th className="w-28 border border-black p-2">Client</th>
                    <th className="border border-black p-2">Request &amp; service type</th>
                    <th className="w-24 border border-black p-2">Status</th>
                    <th className="w-20 border border-black p-2">TAT</th>
                    <th className="w-16 border border-black p-2">CSM</th>
                  </tr>
                </thead>
                <tbody>
                  {ipcrRequests.map((r, idx) => {
                    const tat = actualTAT(r);
                    return (
                      <tr key={r.id} className="avoid-break text-sm">
                        <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                        <td className="border border-black p-2 font-mono text-xs">
                          {fmtDate(r.dateDelivered || r.dateRequested)}
                        </td>
                        <td className="border border-black p-2 text-xs">{r.client || '—'}</td>
                        <td className="border border-black p-2 leading-relaxed">
                          {r.title}
                          <span className="block text-[10px] italic text-gray-600">
                            {STREAM_META[r.stream].label}
                            {r.serviceType ? ` · ${r.serviceType}` : ''}
                          </span>
                          {REQ_META[r.status].unmet && r.reason && (
                            <span className="block text-[10px] text-gray-700">
                              Reason: {r.reason}
                            </span>
                          )}
                        </td>
                        <td className="border border-black p-2 text-[10px] uppercase">
                          {REQ_META[r.status].label}
                        </td>
                        <td className="border border-black p-2 text-center font-mono text-xs">
                          {tat === null ? '—' : `${tat}/${SLA_WD[r.stream]}`}
                        </td>
                        <td className="border border-black p-2 text-center font-mono text-xs">
                          {r.csm || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-1 text-[10px] italic text-gray-600">
                TAT shown as actual/standard in working days. Standard turnaround per
                PM-CRPD-AV-08-04 Rev 7: AV Coverage 3 WDs, AVP Production 13 WDs.
              </p>
            </>
          )}

          {ipcrRoles.length > 0 && (
            <>
              <p className="mb-1 mt-8 text-sm font-bold uppercase">
                Part D — Roles performed per event
              </p>
              <table className="w-full border-collapse border border-black text-left">
                <thead>
                  <tr className="border-b border-black bg-gray-100 text-sm font-bold">
                    <th className="w-10 border border-black p-2 text-center">#</th>
                    <th className="w-28 border border-black p-2">Date</th>
                    <th className="border border-black p-2">Event</th>
                    <th className="border border-black p-2">Roles performed</th>
                    <th className="w-16 border border-black p-2 text-center">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {ipcrRoles.map((a, idx) => (
                    <tr key={a.id} className="avoid-break text-sm">
                      <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                      <td className="border border-black p-2 font-mono text-xs">
                        {fmtDate(a.dateCompleted || a.dateAssigned)}
                      </td>
                      <td className="border border-black p-2 leading-relaxed">
                        {a.eventTitle || a.eventId}
                      </td>
                      <td className="border border-black p-2 leading-relaxed">
                        {a.roles.join(', ') || '—'}
                      </td>
                      <td className="border border-black p-2 text-center font-mono">
                        {a.roles.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="avoid-break mt-4 border border-black p-3 text-sm">
                <p className="mb-1 font-bold uppercase">Role tally</p>
                <p className="leading-relaxed">
                  {ipcrRoleTally.map(([role, n]) => `${role}: ${n}`).join(' · ')}
                </p>
                <p className="mt-2 text-xs">
                  Total roles performed:{' '}
                  <b>{ipcrRoles.reduce((acc, a) => acc + a.roles.length, 0)}</b> across{' '}
                  <b>{ipcrRoles.length}</b> event
                  {ipcrRoles.length === 1 ? '' : 's'}.
                </p>
              </div>
            </>
          )}

          <div className="avoid-break mt-12 flex justify-between text-sm">
            <div>
              <p>Prepared / submitted by:</p>
              <div className="mt-10 w-64 border-b border-black text-center font-bold uppercase">
                {OFFICIAL[selectedIPCRPersonnel]?.fullName || selectedIPCRPersonnel}
              </div>
              <p className="mt-1 text-xs text-gray-600">
                {OFFICIAL[selectedIPCRPersonnel]?.designation}
              </p>
            </div>
            {selectedIPCRPersonnel !== 'Lotus' && (
              <div>
                <p>Verified by:</p>
                <div className="mt-10 w-64 border-b border-black text-center font-bold uppercase">
                  {OFFICIAL['Lotus'].fullName}
                </div>
                <p className="mt-1 text-xs text-gray-600">{OFFICIAL['Lotus'].designation}</p>
              </div>
            )}
          </div>

          <p className="mt-10 border-t border-gray-400 pt-2 text-center text-[9px] text-gray-500">
            System-generated via AV Nexus · Broadcast &amp; Digital Media Section · Source: DMC
            Monitoring Sheet
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------- DOCK ---- */}
      <div className="no-print fixed bottom-5 left-1/2 z-[70] -translate-x-1/2">
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-[#101012] p-1">
          <button
            onClick={() => setPaletteOpen(true)}
            title="Quick jump"
            className="flex h-9 items-center rounded px-3 text-[11px] font-semibold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            Search
          </button>
          <button
            onClick={() => setLogOpen(true)}
            title="Log a video output"
            className="flex h-9 items-center justify-center rounded px-3 text-[11px] font-semibold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            Output
          </button>
          <button
            onClick={() => {
              setView('events');
              setEvModal({ open: true, editing: null });
            }}
            title="New event request"
            className="relative flex h-9 items-center rounded px-3 text-[11px] font-semibold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            New event
            {approvalQueue.length > 0 && (
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
          </button>
          <button
            onClick={() => setKioskOn(true)}
            title="Kiosk mode — for the office monitor"
            className="flex h-9 items-center justify-center rounded px-3 text-[11px] font-semibold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            Kiosk
          </button>
          <button
            onClick={printSheet}
            title="Print IPCR"
            className="flex h-9 items-center justify-center rounded px-3 text-[11px] font-semibold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            Print
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------- TOASTS ---- */}
      <div className="no-print fixed right-5 top-5 z-[100] flex w-72 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-slidein rounded-lg border px-4 py-3 text-xs ${
              t.tone === 'err'
                ? 'border-red-900 bg-red-950/80 text-red-200'
                : t.tone === 'new'
                ? 'border-[#00aeef]/40 bg-[#00aeef]/10 text-[#7fdcff]'
                : 'border-zinc-800 bg-[#101012] text-zinc-300'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      {openApp && <AppWindow app={openApp} onClose={() => setOpenApp(null)} />}
      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      {kioskOn && (
        <KioskMode
          coverages={coverages}
          outputs={outputs}
          requests={requests}
          kpi={kpi}
          stats={stats}
          workload={workload}
          upNext={upNext}
          onClose={() => setKioskOn(false)}
        />
      )}
      {evModal.open && (
        <EventModal
          existing={evModal.editing}
          onClose={() => setEvModal({ open: false, editing: null })}
          onSubmit={submitEvent}
          onNotify={notifyApprover}
          submitting={submitting}
          roster={
            evModal.editing
              ? assignments.filter((a) => a.eventId === evModal.editing!.id)
              : []
          }
          role={myRole}
          canEdit={
            !evModal.editing || can('edit', myRole, evModal.editing.createdBy, myName)
          }
        />
      )}
      {reqModal.open && (
        <RequestModal
          existing={reqModal.editing}
          onClose={() => setReqModal({ open: false, editing: null })}
          onSubmit={submitRequest}
          submitting={submitting}
        />
      )}
      {logOpen && (
        <QuickLogModal
          onClose={() => setLogOpen(false)}
          onSubmit={submitOutput}
          submitting={submitting}
        />
      )}
      {drawerPerson && (
        <PersonnelDrawer
          name={drawerPerson.name}
          image={drawerPerson.image}
          records={coverages.filter((c) =>
            (c.personnel || '').toLowerCase().includes(drawerPerson.name.toLowerCase())
          )}
          onClose={() => setDrawerPerson(null)}
          onGenerateIPCR={() => {
            setSelectedIPCRPersonnel(drawerPerson.name);
            setDrawerPerson(null);
            setView('reports');
            setTimeout(() => scrollTo(ipcrRef), 80);
          }}
        />
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* System stack — walang web font na hihintayin, mabilis at neutral. */
        html { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Inter, Roboto, sans-serif; }
        .font-display { font-family: inherit; letter-spacing: -0.01em; }
        .font-mono, code, kbd { font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #232326; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #33333a; }
        @keyframes fadein { from { opacity: 0 } to { opacity: 1 } }
        @keyframes riseup { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes slidein { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }
        @keyframes kioskbar { from { width: 0 } to { width: 100% } }
        @keyframes kioskticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .kiosk-ticker { animation: kioskticker 45s linear infinite; }
        .kiosk-cal { filter: invert(0.92) hue-rotate(180deg); }
        .animate-fadein { animation: fadein .2s ease-out }
        .animate-riseup { animation: riseup .18s cubic-bezier(.16,1,.3,1) }
        .animate-slidein { animation: slidein .28s cubic-bezier(.16,1,.3,1) }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
        }
        :focus-visible { outline: 1px solid ${CYAN}; outline-offset: 2px; }
        ::selection { background: rgba(0,174,239,0.25); }

        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          html, body { background: white !important; color: black !important; font-family: 'Times New Roman', Times, serif !important; }
          thead { display: table-header-group; }
          tr, .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          @page { size: A4; margin: 18mm 14mm; }
        }
      `,
        }}
      />
    </div>
  );
}
