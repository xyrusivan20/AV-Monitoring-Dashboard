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
  'https://script.google.com/macros/s/AKfycbyU3SyLrptMwqwfkVh8UrcocsPUCKPSEIPMJsjzTcxBwXa279xmN8dJR5XOhi_68gRmrg/exec';

const PRE_ARCHIVAL_LINK =
  'https://docs.google.com/spreadsheets/d/1Q2H3AelKocMLImvjkXpy9j1z89qWYYok0-BPj68QPCE/edit?gid=0#gid=0';
const DMC_MONITORING_LINK =
  'https://docs.google.com/spreadsheets/d/1DmfloCwW90g5Rru4-l1N5DSbqyLGbga6OkklX_w1Skc/edit?gid=32561347#gid=32561347';

const CYAN = '#00aeef';

const SYSTEMS: SystemApp[] = [
  {
    id: 'gatepass',
    name: 'Equipment Gate Pass',
    role: 'Releasing & inventory control',
    url: 'https://bdms-gpass.vercel.app',
    tag: 'OPERATIONS',
    accent: CYAN,
    glyph: '▣',
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
    glyph: '◍',
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
    glyph: '◈',
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
    icon: '⏳',
    chip: 'bg-zinc-800/80 text-zinc-300 border-zinc-700',
    hex: '#a1a1aa',
  },
  upcoming: {
    label: 'UPCOMING',
    icon: '📅',
    chip: 'bg-red-500/10 text-red-400 border-red-500/30',
    hex: '#ef4444',
  },
  checked: {
    label: 'CHECKED',
    icon: '👀',
    chip: 'bg-[#00aeef]/10 text-[#00aeef] border-[#00aeef]/30',
    hex: '#0e7fae',
  },
  transferred: {
    label: 'DMC TRANSFERRED',
    icon: '✔',
    chip: 'bg-[#00aeef]/10 text-[#00aeef] border-[#00aeef]/30 shadow-[0_0_10px_rgba(0,174,239,0.12)]',
    hex: '#00aeef',
  },
  archived: {
    label: 'ARCHIVED',
    icon: '🌟',
    chip: 'bg-zinc-900/80 text-zinc-400 border-zinc-800',
    hex: '#52525b',
  },
};

const STATUS_ORDER: StatusKey[] = ['upcoming', 'pending', 'checked', 'transferred', 'archived'];

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
      className={`inline-flex items-center gap-1 rounded-full border font-bold tracking-wide ${
        dense ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]'
      } ${meta.chip}`}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
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
      <div className="border-l-4 border-red-500 pl-3">
        <h2 className="text-sm font-bold tracking-[0.2em] text-zinc-400">{title}</h2>
        {hint && <p className="mt-0.5 text-[11px] text-zinc-600">{hint}</p>}
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
    <div className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-[#09090b]/80 p-4 backdrop-blur-sm transition-colors hover:border-zinc-700">
      <div
        className="absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-4xl font-black leading-none text-white tabular-nums">
        {shown}
      </p>
      <p className="mt-2 text-[11px] text-zinc-500">{sub}</p>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full transition-all duration-700"
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
          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
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

function WorkloadBars({ data }: { data: { name: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.name}>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              {d.name}
            </span>
            <span className="font-mono text-xs text-zinc-500 tabular-nums">{d.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00aeef]/40 to-[#00aeef] transition-all duration-1000"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && <p className="text-xs italic text-zinc-600">Walang data pa.</p>}
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
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md animate-fadein" onClick={onClose} />
      <div
        className={`relative flex flex-col overflow-hidden border border-zinc-800 bg-[#0a0a0c] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] animate-riseup ${
          maximized ? 'h-full w-full rounded-none' : 'h-full w-full md:h-[88vh] md:max-w-[1400px] md:rounded-2xl'
        }`}
        style={{ boxShadow: `0 0 0 1px ${app.accent}22, 0 40px 120px -20px rgba(0,0,0,0.9)` }}
      >
        {/* title bar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 bg-[#09090b] px-4 py-2.5">
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
              ↻ Reload
            </button>
            <a
              href={app.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-2.5 py-1.5 text-[11px] font-bold text-black transition-opacity hover:opacity-85"
              style={{ background: app.accent }}
            >
              ↗ Open full tab
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
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#09090b]">
                  <div
                    className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800"
                    style={{ borderTopColor: app.accent }}
                  />
                  <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                    Connecting to {app.name}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#09090b] px-6 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl border text-2xl"
                style={{ borderColor: `${app.accent}55`, color: app.accent }}
              >
                {app.glyph}
              </div>
              <h3 className="text-lg font-bold text-white">{app.name} runs in its own tab</h3>
              <p className="max-w-md text-sm leading-relaxed text-zinc-400">
                AppSheet blocks embedding for security, kaya hindi siya kayang i-frame dito.
                Buksan mo siya sa bagong tab — babalik ka lang dito pagkatapos.
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

        <div className="flex shrink-0 items-center justify-between border-t border-zinc-800 bg-[#09090b] px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
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
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fadein" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-[#0a0a0c] shadow-[0_30px_90px_-15px_rgba(0,0,0,0.9)] animate-riseup"
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
          <span className="text-sm text-[#00aeef]">⌘</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Maghanap ng system, tao, coverage, o aksyon…"
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
                  <p className="px-5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
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
              Walang tugma. Subukan mo ang pangalan ng coverage o ng tao.
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fadein" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-[#09090b] animate-slidein">
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
            <div key={s.k} className="bg-[#09090b] p-4 text-center">
              <p className="font-mono text-2xl font-black text-white tabular-nums">{s.v}</p>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">{s.k}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
            Deployment history
          </p>
          <div className="space-y-3">
            {records.map((r, i) => (
              <div key={i} className="rounded-lg border border-zinc-800 bg-black/40 p-3">
                <p className="mb-2 text-sm leading-snug text-zinc-200">{r.details}</p>
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={r.status} dense />
                  <span className="font-mono text-[10px] text-zinc-600">{fmtDate(r.dateObj)}</span>
                </div>
              </div>
            ))}
            {records.length === 0 && (
              <p className="text-sm italic text-zinc-600">Walang naitalang deployment.</p>
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

  const [openApp, setOpenApp] = useState<SystemApp | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerPerson, setDrawerPerson] = useState<{ name: string; image: string } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: string }[]>([]);

  const seenIds = useRef<Set<string>>(new Set());
  const bootedRef = useRef(false);
  const ipcrRef = useRef<HTMLDivElement>(null);
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
        setErrMsg(error?.message || 'Hindi maabot ang Apps Script endpoint.');
        if (manual) toast('Refresh failed — check the Apps Script URL', 'err');
      } finally {
        bootedRef.current = true;
        setBooted(true);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => fetchTasks(), 30000);
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
      TEAM.map((m) => ({
        name: m.name,
        count: coverages.filter((c) =>
          (c.personnel || '').toLowerCase().includes(m.name.toLowerCase())
        ).length,
      })).sort((a, b) => b.count - a.count),
    [coverages]
  );

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return coverages
      .filter((c) => c.dateObj && c.dateObj >= today)
      .sort((a, b) => (a.dateObj!.getTime() - b.dateObj!.getTime()))
      .slice(0, 4);
  }, [coverages]);

  const getLatestDeployment = (name: string) =>
    coverages.find((c) => (c.personnel || '').toLowerCase().includes(name.toLowerCase()));

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

  const controlNo = useMemo(() => {
    const initials = (OFFICIAL[selectedIPCRPersonnel]?.fullName || selectedIPCRPersonnel)
      .split(' ')
      .map((w) => w[0])
      .join('')
      .replace(/[^A-Z]/g, '')
      .slice(0, 3);
    const y = ipcrYear === 'ALL' ? new Date().getFullYear() : ipcrYear;
    return `BDMS-AV-${y}-${initials}-${String(ipcrRecords.length).padStart(3, '0')}`;
  }, [selectedIPCRPersonnel, ipcrYear, ipcrRecords.length]);

  /* ------------------------------------------------------------ ACTIONS -- */
  const scrollTo = (ref: { current: HTMLElement | null }) =>
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const exportCSV = useCallback(() => {
    const rows = ipcrRecords.map((c, i) => [
      i + 1,
      fmtDate(c.dateObj, c.date),
      c.personnel,
      c.status,
      c.details,
      c.gdrive,
      c.socialMediaLink,
    ]);
    const header = ['#', 'Date', 'Personnel', 'Status', 'Coverage Details', 'GDrive', 'Social Media'];
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
  }, [ipcrRecords, controlNo, toast]);

  const printSheet = useCallback(() => {
    setOpenApp(null);
    setDrawerPerson(null);
    setPaletteOpen(false);
    setTimeout(() => window.print(), 120);
  }, []);

  const commands = useMemo<Cmd[]>(() => {
    const list: Cmd[] = [];
    SYSTEMS.forEach((s) =>
      list.push({
        id: `sys-${s.id}`,
        label: `Open ${s.name}`,
        hint: s.tag,
        group: 'Systems',
        run: () => setOpenApp(s),
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
          scrollTo(ipcrRef);
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
        run: () => fetchTasks(true),
      }
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
  }, [coverages, exportCSV, fetchTasks, printSheet]);

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

  const connMeta = {
    connecting: { dot: 'bg-amber-400', label: 'CONNECTING' },
    live: { dot: 'bg-red-500', label: `LIVE · ${lastUpdated}` },
    error: { dot: 'bg-zinc-600', label: 'OFFLINE' },
  }[conn];

  /* --------------------------------------------------------------- VIEW -- */
  return (
    <div className="relative min-h-screen bg-black font-sans text-zinc-200 selection:bg-[#00aeef]/30">
      {/* ambient atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-0 no-print">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#00aeef]/[0.07] blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-[420px] w-[420px] rounded-full bg-red-600/[0.05] blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.035] grain" />
      </div>

      <div className="relative z-10 p-4 pb-32 md:p-8 md:pb-32">
        {/* ================================================ DASHBOARD ==== */}
        <div className="no-print space-y-10">
          {/* -------------------------------------------------- HEADER -- */}
          <header className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 border-b border-zinc-800 pb-6 md:flex-row md:items-end">
            <div>
              <img src="/stii.png" alt="DOST-STII" className="mb-6 h-16 w-auto drop-shadow-md" />
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                  Broadcast &amp; Digital Media Section
                </span>
              </div>
              <h1 className="mb-1 font-display text-5xl font-black uppercase tracking-tight text-white drop-shadow-sm md:text-6xl">
                AV{' '}
                <span className="text-[#00aeef] drop-shadow-[0_0_10px_rgba(0,174,239,0.45)]">
                  Nexus
                </span>
              </h1>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Master control · coverage, DMC &amp; systems
              </p>
            </div>

            <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
              <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-2 shadow-inner">
                <span className={`h-2 w-2 rounded-full ${connMeta.dot} ${conn === 'live' ? 'animate-pulse' : ''}`} />
                <span className="font-mono text-xs text-zinc-400">{connMeta.label}</span>
                <button
                  onClick={() => fetchTasks(true)}
                  className={`ml-1 text-xs text-zinc-500 transition-colors hover:text-[#00aeef] ${
                    refreshing ? 'animate-spin' : ''
                  }`}
                  aria-label="Refresh now"
                >
                  ↻
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPaletteOpen(true)}
                  className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-zinc-700"
                >
                  ⌘K Quick jump
                </button>
                <a
                  href={PRE_ARCHIVAL_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-zinc-700"
                >
                  📁 Pre-Archival
                </a>
                <a
                  href={DMC_MONITORING_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-[#00aeef]/90 px-4 py-2 text-xs font-bold text-white shadow-[0_0_15px_rgba(0,174,239,0.2)] transition-colors hover:bg-[#00aeef]"
                >
                  📊 DMC Monitoring IRAD
                </a>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl space-y-12">
            {conn === 'error' && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                Hindi nakuha ang records — {errMsg}. Naka-cache pa ang huling nakuhang data.
                Suriin ang deployment ng Apps Script (dapat naka-set sa “Anyone”).
              </div>
            )}

            {/* ---------------------------------------- SYSTEMS HUB ---- */}
            <section>
              <SectionHead
                title="SYSTEMS HUB"
                hint="Lahat ng AV-built systems, buksan mo dito nang hindi umaalis sa dashboard."
                right={
                  <span className="hidden font-mono text-[10px] uppercase tracking-widest text-zinc-600 md:block">
                    {SYSTEMS.length} apps online
                  </span>
                }
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {SYSTEMS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setOpenApp(s)}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#09090b]/80 p-5 text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-1"
                    style={{ boxShadow: 'none' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = `${s.accent}66`;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 18px 40px -18px ${s.accent}55`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = '';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ background: `linear-gradient(90deg,transparent,${s.accent},transparent)` }}
                    />
                    <div className="mb-4 flex items-start justify-between">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-lg border text-lg"
                        style={{ borderColor: `${s.accent}44`, color: s.accent, background: `${s.accent}0d` }}
                      >
                        {s.glyph}
                      </div>
                      <span
                        className="rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest"
                        style={{ borderColor: `${s.accent}33`, color: s.accent }}
                      >
                        {s.tag}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold leading-tight text-white">{s.name}</h3>
                    <p className="mt-1 text-xs text-zinc-500">{s.role}</p>
                    <ul className="mt-4 space-y-1.5">
                      {s.points.map((p) => (
                        <li key={p} className="flex items-center gap-2 text-[11px] text-zinc-400">
                          <span className="h-1 w-1 rounded-full" style={{ background: s.accent }} />
                          {p}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3">
                      <span className="font-mono text-[10px] text-zinc-600">
                        {s.url.replace('https://', '').split('/')[0]}
                      </span>
                      <span
                        className="text-[11px] font-bold transition-transform group-hover:translate-x-1"
                        style={{ color: s.accent }}
                      >
                        Open window →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* -------------------------------------- OPERATIONS PULSE -- */}
            <section>
              <SectionHead title="OPERATIONS PULSE" hint="Buong taon na datos mula sa DMC sheet." />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile
                  label="Total coverages"
                  value={stats.total}
                  sub="Naitalang operations"
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
                  sub="Kailangan pang i-upload"
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
                <div className="rounded-xl border border-zinc-800 bg-[#09090b]/80 p-5 backdrop-blur-sm">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    DMC status mix
                  </p>
                  <StatusDonut counts={stats.counts} total={stats.total} />
                </div>
                <div className="rounded-xl border border-zinc-800 bg-[#09090b]/80 p-5 backdrop-blur-sm">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    Deployment load
                  </p>
                  <WorkloadBars data={workload} />
                </div>
                <div className="rounded-xl border border-zinc-800 bg-[#09090b]/80 p-5 backdrop-blur-sm">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
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
                        Walang naka-schedule. Malinis ang board.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-zinc-800 bg-[#09090b]/80 p-5 backdrop-blur-sm">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Coverage density · last 26 weeks
                </p>
                <ActivityGrid coverages={coverages} />
              </div>
            </section>

            {/* --------------------------------------- AV TEAM STATUS --- */}
            <section>
              <SectionHead title="AV TEAM STATUS" hint="Pindutin ang card para sa buong deployment history." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {TEAM.map((member) => {
                  const latest = getLatestDeployment(member.name);
                  const total = workload.find((w) => w.name === member.name)?.count ?? 0;
                  return (
                    <button
                      key={member.name}
                      onClick={() => setDrawerPerson(member)}
                      className="group relative cursor-pointer overflow-hidden rounded-xl border border-zinc-800 bg-[#09090b]/80 p-5 text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#00aeef]/50 hover:bg-[#09090b]"
                    >
                      <div className="mb-4 flex items-center gap-4">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-zinc-800 shadow-lg transition-colors duration-300 group-hover:border-[#00aeef]">
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
                              {total} coverage{total === 1 ? '' : 's'}
                            </p>
                          </div>
                          {latest ? (
                            <span className="relative flex h-3 w-3">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                            </span>
                          ) : (
                            <span className="h-3 w-3 rounded-full bg-zinc-800" />
                          )}
                        </div>
                      </div>
                      {latest ? (
                        <div className="relative z-10">
                          <p
                            className="mb-3 line-clamp-2 text-sm leading-relaxed text-zinc-300"
                            title={latest.details}
                          >
                            {latest.details}
                          </p>
                          <div className="flex items-center justify-between">
                            <StatusBadge status={latest.status} />
                            <span className="font-mono text-[10px] text-zinc-500">
                              {fmtDate(latest.dateObj, latest.date)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-6 text-xs italic text-zinc-600">Standby / No active deployment.</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* -------------------------------- RECORDS + CALENDAR ------ */}
            <div ref={recordsRef} className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <section className="lg:col-span-2">
                <SectionHead
                  title="COVERAGE RECORDS"
                  hint={`${filteredRecords.length} sa ${coverages.length} records ang tugma.`}
                />

                <div className="mb-4 space-y-3 rounded-xl border border-zinc-800 bg-[#09090b]/80 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-black/60 px-3 py-2">
                    <span className="text-zinc-600">⌕</span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Hanapin ang coverage, tao, o status…"
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
                            ? 'border-[#00aeef]/50 bg-[#00aeef]/15 text-[#00aeef]'
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
                        className="h-28 animate-pulse rounded-lg border border-zinc-800 bg-[#09090b]/60"
                      />
                    ))}

                  {booted &&
                    filteredRecords.slice(0, visibleCount).map((cov, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col justify-between gap-4 rounded-lg border border-zinc-800 bg-[#09090b]/80 p-5 backdrop-blur-sm transition-colors hover:border-zinc-700 hover:bg-[#09090b] md:flex-row"
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
                                className="flex items-center gap-1 text-xs font-medium text-[#00aeef] drop-shadow-[0_0_2px_rgba(0,174,239,0.5)] transition-colors hover:text-white"
                              >
                                📂 GDrive
                              </a>
                            )}
                            {cov.socialMediaLink && (
                              <a
                                href={cov.socialMediaLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-xs font-medium text-[#00aeef] drop-shadow-[0_0_2px_rgba(0,174,239,0.5)] transition-colors hover:text-white"
                              >
                                🌐 Social Media
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
                      <p className="text-sm text-zinc-400">Walang tumugmang record.</p>
                      <button
                        onClick={() => {
                          setQuery('');
                          setFilterPerson('ALL');
                          setFilterStatus('ALL');
                        }}
                        className="mt-3 text-xs font-bold text-[#00aeef] hover:underline"
                      >
                        I-clear ang mga filter
                      </button>
                    </div>
                  )}

                  {filteredRecords.length > visibleCount && (
                    <button
                      onClick={() => setVisibleCount((v) => v + 12)}
                      className="w-full rounded-lg border border-zinc-800 py-3 text-xs font-bold uppercase tracking-widest text-zinc-400 transition-colors hover:border-[#00aeef]/40 hover:text-[#00aeef]"
                    >
                      Show 12 more · {filteredRecords.length - visibleCount} natitira
                    </button>
                  )}
                </div>
              </section>

              <section className="space-y-8 lg:col-span-1">
                <div>
                  <SectionHead title="AV CALENDAR" />
                  <div className="group relative h-[450px] overflow-hidden rounded-xl border border-zinc-800 bg-[#09090b]/80 backdrop-blur-sm">
                    <iframe
                      src="https://calendar.google.com/calendar/embed?src=av%40stii.dost.gov.ph&ctz=Asia%2FSingapore"
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
                  <div className="space-y-2 rounded-xl border border-zinc-800 bg-[#09090b]/80 p-4 backdrop-blur-sm">
                    {[
                      ['⌘K / Ctrl K', 'Quick jump sa kahit ano'],
                      ['/', 'Buksan ang search'],
                      ['ESC', 'Isara ang window'],
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

            {/* ------------------------------------ IPCR GENERATOR ------ */}
            <section ref={ipcrRef} className="border-t border-zinc-800 pt-10">
              <div className="rounded-xl border border-zinc-800 bg-[#09090b]/80 p-6 backdrop-blur-sm">
                <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <h2 className="text-lg font-bold uppercase tracking-wide text-white">
                      IPCR / MOV Report Generator
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Pumili ng pangalan at taon, tapos i-print o i-export para sa IPCR/SPMS attachment.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedIPCRPersonnel}
                      onChange={(e) => setSelectedIPCRPersonnel(e.target.value)}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-white focus:border-[#00aeef] focus:outline-none"
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
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-white focus:border-[#00aeef] focus:outline-none"
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
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-zinc-700"
                    >
                      ⬇ CSV
                    </button>
                    <button
                      onClick={printSheet}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_10px_rgba(220,38,38,0.3)] transition-colors hover:bg-red-500"
                    >
                      🖨 Print / Save as PDF
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
                    Isama ang GDrive / social links sa printout
                  </label>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                    Control no. {controlNo}
                  </span>
                </div>

                <div className="custom-scrollbar max-h-[420px] overflow-y-auto rounded-lg border border-zinc-800 bg-black p-5 font-mono text-sm">
                  <p className="mb-3 border-b border-zinc-800 pb-2 font-bold text-red-500">
                    📄 PREVIEW — ito ang lalabas sa printed sheet
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
                      <p className="italic text-zinc-600">Walang nakitang records sa piniling panahon.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <footer className="pb-8 pt-4 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-700">
                DOST-STII · CRPD · Broadcast &amp; Digital Media Section
              </p>
            </footer>
          </main>
        </div>

        {/* ============================================= PRINT SHEET ==== */}
        <div className="print-only hidden bg-white p-8 font-serif text-base text-black">
          <div className="mb-6 border-b-2 border-black pb-4 text-center">
            <p className="text-xs uppercase tracking-widest">Republic of the Philippines</p>
            <p className="text-sm font-bold uppercase">Department of Science and Technology</p>
            <p className="text-xs uppercase">Science and Technology Information Institute</p>
            <h1 className="mt-3 text-2xl font-bold uppercase tracking-wide">
              {selectedIPCRPersonnel === 'Lotus'
                ? 'Supervisory Verification Report'
                : 'AV Production Services Coverage Report'}
            </h1>
            <p className="mt-1 text-sm uppercase tracking-widest">
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
                <span className="underline">{ipcrRecords.length} records</span>
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
        <div className="flex items-center gap-1 rounded-2xl border border-zinc-800 bg-[#09090b]/90 p-1.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {SYSTEMS.map((s) => (
            <button
              key={s.id}
              onClick={() => setOpenApp(s)}
              title={s.name}
              className="group relative flex h-11 w-11 items-center justify-center rounded-xl text-lg transition-all hover:-translate-y-1"
              style={{ color: s.accent, background: `${s.accent}10` }}
            >
              {s.glyph}
              <span className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md border border-zinc-800 bg-black px-2 py-1 text-[10px] font-bold text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
                {s.name}
              </span>
            </button>
          ))}
          <span className="mx-1 h-8 w-px bg-zinc-800" />
          <button
            onClick={() => setPaletteOpen(true)}
            title="Quick jump"
            className="flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            ⌘K
          </button>
          <button
            onClick={printSheet}
            title="Print IPCR"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/15 text-red-400 transition-colors hover:bg-red-600/30"
          >
            🖨
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------- TOASTS ---- */}
      <div className="no-print fixed right-5 top-5 z-[100] flex w-72 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-slidein rounded-lg border px-4 py-3 text-xs shadow-lg backdrop-blur-md ${
              t.tone === 'err'
                ? 'border-red-900 bg-red-950/80 text-red-200'
                : t.tone === 'new'
                ? 'border-[#00aeef]/40 bg-[#00aeef]/10 text-[#7fdcff]'
                : 'border-zinc-800 bg-zinc-950/90 text-zinc-300'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      {openApp && <AppWindow app={openApp} onClose={() => setOpenApp(null)} />}
      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
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
            setTimeout(() => scrollTo(ipcrRef), 100);
          }}
        />
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .grain {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        @keyframes fadein { from { opacity: 0 } to { opacity: 1 } }
        @keyframes riseup { from { opacity: 0; transform: translateY(14px) scale(.985) } to { opacity: 1; transform: none } }
        @keyframes slidein { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }
        .animate-fadein { animation: fadein .2s ease-out }
        .animate-riseup { animation: riseup .28s cubic-bezier(.16,1,.3,1) }
        .animate-slidein { animation: slidein .28s cubic-bezier(.16,1,.3,1) }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
        }
        :focus-visible { outline: 2px solid ${CYAN}; outline-offset: 2px; }

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
