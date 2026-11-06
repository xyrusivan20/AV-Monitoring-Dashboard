/**
 * Logic lock para sa AV Nexus.
 *
 * Kinukuha ang eksaktong source text ng bawat helper, type, constant at
 * hook sa App.tsx at ikinukumpara sa naka-commit na baseline. Kapag may
 * nagbago sa lohika habang nire-redesign ang itsura, babagsak ito.
 *
 *   node scripts/logic-lock.mjs --baseline   gumawa ng bagong baseline (sinasadyang pagbabago lamang)
 *   node scripts/logic-lock.mjs --check      ikumpara sa baseline
 *
 * Hindi kasama: ang mga React component (markup at klase ang binabago sa
 * redesign) at ang ALLOW list sa ibaba.
 */
import ts from 'typescript';
import fs from 'node:fs';
import crypto from 'node:crypto';

const FILE = 'src/App.tsx';
const BASE = 'scripts/logic-lock.baseline.json';
const ALLOW = new Set([
  'AV_CSS', 'ViewKey', 'VIEWS', 'NAV_GROUPS', 'ROLE_LABEL', 'ICON_PATHS', 'IconName',
  'DEFAULT_TEAM', 'CYAN', 'SYSTEMS',
]);

const src = fs.readFileSync(FILE, 'utf8');
const sf = ts.createSourceFile(FILE, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const isPascal = (n) => /^[A-Z][a-z0-9]/.test(n) && !/^[A-Z0-9_]+$/.test(n);

function hasJsx(node) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

const entries = {};
const add = (kind, name, node) => {
  entries[`${kind}:${name}`] = hash(node.getText(sf));
};

function collectHooks(fn) {
  const visit = (n) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      ts.isCallExpression(n.initializer)
    ) {
      const callee = n.initializer.expression.getText(sf);
      if (callee === 'useCallback' || callee === 'useMemo') add(callee, n.name.text, n);
    }
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'useEffect') {
      add('useEffect', 'effect#' + hash(n.getText(sf)), n);
    }
    ts.forEachChild(n, visit);
  };
  if (fn.body) ts.forEachChild(fn.body, visit);
}

for (const st of sf.statements) {
  if (ts.isFunctionDeclaration(st) && st.name) {
    const n = st.name.text;
    if (isPascal(n) && hasJsx(st)) {
      if (n === 'AppMain') collectHooks(st);
      continue;
    }
    if (!ALLOW.has(n)) add('function', n, st);
  } else if (ts.isVariableStatement(st)) {
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue;
      const n = d.name.text;
      if (ALLOW.has(n)) continue;
      if (isPascal(n) && d.initializer && hasJsx(d.initializer)) continue;
      add('const', n, d);
    }
  } else if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) {
    if (!ALLOW.has(st.name.text)) add('type', st.name.text, st);
  } else if (ts.isClassDeclaration(st) && st.name && !hasJsx(st)) {
    add('class', st.name.text, st);
  }
}

const mode = process.argv[2] || '--check';
if (mode === '--baseline') {
  fs.writeFileSync(BASE, JSON.stringify(entries, null, 1) + '\n');
  console.log(`logic-lock: baseline written, ${Object.keys(entries).length} entries`);
  process.exit(0);
}

const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const changed = [];
const missing = [];
for (const [k, h] of Object.entries(base)) {
  if (!(k in entries)) missing.push(k);
  else if (entries[k] !== h) changed.push(k);
}
const added = Object.keys(entries).filter((k) => !(k in base)).length;
if (changed.length || missing.length) {
  console.error('logic-lock: FAILED');
  changed.forEach((k) => console.error('  changed  ' + k));
  missing.forEach((k) => console.error('  missing  ' + k));
  process.exit(1);
}
console.log(`logic-lock: OK, ${Object.keys(base).length} locked entries unchanged, ${added} new`);
