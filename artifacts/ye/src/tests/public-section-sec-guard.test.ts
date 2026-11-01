/**
 * Guard: public-site <section> elements must carry the `sec` class.
 *
 * History: public section styling (100px padding, position:relative, etc.)
 * used to live on the bare `section` element selector in globals.css. That
 * leaked into internal screens, so it was scoped to the `.sec` class (see
 * globals-css-guard.test.ts and .agents/memory/ye-global-css-leaks.md).
 * Consequence: any NEW public-page <section> added without
 * `className="sec ..."` silently renders without the standard section
 * chrome and looks visually broken.
 *
 * This test scans the public-site React sources and fails when a JSX
 * `<section>` opening tag lacks a static className containing the `sec`
 * token. Dynamic classNames (template literals / expressions) are also
 * flagged unless the literal `sec` token is visible in the source — better
 * a false positive (add the token or an exception below) than a silently
 * unstyled section.
 *
 * Exceptions (documented):
 * - Internal, non-public surfaces are NOT scanned: admin dashboard, family
 *   portal, account area, kids learning platform (`/learn`) and all `/svc`
 *   API routes. These screens intentionally do not use public-site chrome.
 * - Per-file opt-outs go into FILE_EXCEPTIONS with a justification.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC = path.resolve(__dirname, '..');

/** Directories scanned for public-site components (relative to src/). */
const PUBLIC_ROOTS = ['app', 'components'];

/**
 * Path prefixes (relative to src/, posix separators) excluded from the scan:
 * internal screens that don't use the public design system.
 */
const EXCLUDED_PREFIXES = [
  'app/admin', // admin dashboard (internal)
  'app/portal', // family portal (logged-in area)
  'app/account', // account management (logged-in area)
  'app/learn', // kids learning platform (own design system)
  'app/svc', // API route handlers — no JSX pages
  'app/en/portal',
  'app/en/account',
  'components/admin', // admin dashboard components (internal)
  'components/portal', // family portal components (logged-in area)
  'components/account', // account area components (logged-in area)
];

/**
 * Individual file opt-outs. Add an entry ONLY with a comment explaining why
 * the file's <section> legitimately must not carry the `sec` class.
 */
const FILE_EXCEPTIONS = new Set<string>([
  // Hero uses <section className="hero"> without the .sec token because it is a
  // full-bleed landing hero with its own padding and layered background system.
  // Adding .sec would impose the standard 100px section padding on top of the
  // hero's own layout and break its appearance. The <section> element is still
  // semantically correct; the opt-out is purely cosmetic.
  'components/home/Hero.tsx',
  // The V3 homepage has its own .fa3-scoped design system (fa3.css):
  // section-wrap, hero, programs, fidea, play-section and contact-section
  // define their own responsive spacing/layout. Legacy .sec padding and
  // descendant heading styles would override the approved V3 design.
  // Keep these opt-outs file-specific so other public pages remain guarded.
  'components/home3/FunHome.tsx',
  'components/home3/Programs.tsx',
  'components/home3/IdeaMachine.tsx',
]);

function isExcluded(rel: string): boolean {
  return (
    FILE_EXCEPTIONS.has(rel) ||
    EXCLUDED_PREFIXES.some((p) => rel === p || rel.startsWith(p + '/'))
  );
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(tsx|jsx)$/.test(name)) yield full;
  }
}

function publicFiles(): string[] {
  const out: string[] = [];
  for (const root of PUBLIC_ROOTS) {
    for (const f of walk(path.join(SRC, root))) {
      const rel = path.relative(SRC, f).split(path.sep).join('/');
      if (!isExcluded(rel)) out.push(rel);
    }
  }
  return out.sort();
}

interface Violation {
  file: string;
  line: number;
  tag: string;
}

/**
 * AST-based scan (TypeScript compiler API): find every JSX `<section>`
 * opening/self-closing element and verify its `className` attribute
 * contains the whole-word `sec` token.
 *
 * `sec` detection:
 * - string literal className: split on whitespace, look for the token.
 * - expression className (template literal, cn(...), ternary, etc.): accept
 *   if ANY string/template literal anywhere inside the expression contains
 *   the whole-word `sec` token. This is deliberately lenient for dynamic
 *   code paths but still flags a section with no visible `sec` at all.
 */
const SEC_WORD = /(^|\s)sec(\s|$)/;

function textHasSecToken(text: string): boolean {
  return SEC_WORD.test(text);
}

function nodeHasSecLiteral(node: ts.Node): boolean {
  if (
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
    textHasSecToken(node.text)
  ) {
    return true;
  }
  if (ts.isTemplateExpression(node)) {
    if (textHasSecToken(node.head.text)) return true;
    if (node.templateSpans.some((s) => textHasSecToken(s.literal.text))) return true;
  }
  return ts.forEachChild(node, nodeHasSecLiteral) ?? false;
}

function classNameHasSec(attrs: ts.JsxAttributes): boolean {
  for (const attr of attrs.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    if (attr.name.getText() !== 'className') continue;
    const init = attr.initializer;
    if (!init) return false;
    if (ts.isStringLiteral(init)) return textHasSecToken(init.text);
    if (ts.isJsxExpression(init) && init.expression) {
      return nodeHasSecLiteral(init.expression);
    }
    return false;
  }
  return false; // no className at all
}

function findViolations(rel: string, source: string): Violation[] {
  const out: Violation[] = [];
  const sf = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node: ts.Node) => {
    let tagName: ts.JsxTagNameExpression | undefined;
    let attrs: ts.JsxAttributes | undefined;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      tagName = node.tagName;
      attrs = node.attributes;
    }
    if (tagName && attrs && tagName.getText(sf) === 'section' && !classNameHasSec(attrs)) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      out.push({
        file: rel,
        line: line + 1,
        tag: node.getText(sf).replace(/\s+/g, ' ').slice(0, 120),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe('public-site <section> must use the sec class', () => {
  const files = publicFiles();

  it('scans a realistic number of public source files (sanity check)', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('every public <section> carries the sec class token', () => {
    const violations: Violation[] = [];
    for (const rel of files) {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      violations.push(...findViolations(rel, src));
    }
    const msg = violations
      .map((v) => `  ${v.file}:${v.line} → ${v.tag}`)
      .join('\n');
    expect(
      violations,
      `Public-site <section> elements without the "sec" class render without ` +
        `the standard section padding/positioning and look broken:\n${msg}\n` +
        `Fix: add className="sec ..." (see globals.css). If a section must ` +
        `legitimately opt out, add the file to FILE_EXCEPTIONS in this test ` +
        `with a justification comment.`,
    ).toEqual([]);
  });

  // Self-test: internal surfaces are excluded, public ones are not.
  it('exclusion boundary self-test', () => {
    for (const p of [
      'app/admin/page.tsx',
      'app/portal/page.tsx',
      'app/account/page.tsx',
      'app/learn/[childId]/page.tsx',
      'app/svc/admin/login/route.ts',
      'app/en/portal/page.tsx',
      'app/en/account/page.tsx',
      'components/admin/AdminDashboard.tsx',
      'components/portal/Portal.tsx',
      'components/account/Account.tsx',
    ]) {
      expect(isExcluded(p), `${p} should be excluded`).toBe(true);
    }
    for (const p of [
      'app/page.tsx',
      'app/watanona/WatanonaPage.tsx',
      'app/en/page.tsx',
      'app/programs/[slug]/ProgramDetail.tsx',
      'components/home/FAQ.tsx',
      'components/SiteFooter.tsx',
      'components/blog/Post.tsx',
    ]) {
      expect(isExcluded(p), `${p} should be scanned`).toBe(false);
    }
    // The scanned file list actually reflects the boundary.
    expect(files.some((f) => f.startsWith('components/home/'))).toBe(true);
    expect(files.some((f) => f.startsWith('components/admin/'))).toBe(false);
    expect(files.some((f) => f.startsWith('app/admin'))).toBe(false);
  });

  // Self-test: the detector catches the failure mode and accepts valid usage.
  it('detector self-test', () => {
    const wrap = (jsx: string) => `const X = () => (${jsx});`;
    const bad = (jsx: string) => findViolations('x.tsx', wrap(jsx));
    expect(bad('<section className="hero" />')).toHaveLength(1);
    expect(bad('<section />')).toHaveLength(1);
    expect(bad('<section id="a"\n  data-x="1" />')).toHaveLength(1);
    // "sec" must be a whole token — "secret" doesn't count.
    expect(bad('<section className="secret hero" />')).toHaveLength(1);
    expect(bad('<section className={styles.x} />')).toHaveLength(1);
    // Nested-brace props (style objects) cannot hide a missing sec class.
    expect(bad('<section style={{ textAlign: "center" }} />')).toHaveLength(1);
    expect(bad('<section className="hero" style={{ a: { b: 1 } }} />')).toHaveLength(1);
    expect(bad('<section className={cn({ hero: true })} />')).toHaveLength(1);
    // Nested sections are each checked.
    expect(bad('<section className="sec"><section className="x" /></section>')).toHaveLength(1);
    // Valid usages pass.
    expect(bad('<section className="sec" />')).toHaveLength(0);
    expect(bad('<section className="sec hero" id="h" />')).toHaveLength(0);
    expect(bad("<section className='hero sec' />")).toHaveLength(0);
    expect(bad('<section className={`sec hero ${x}`} />')).toHaveLength(0);
    expect(bad('<section className={`${x} sec`} />')).toHaveLength(0);
    expect(bad('<section className={cn("sec", { hero: true })} />')).toHaveLength(0);
    expect(bad('<section className={active ? "sec on" : "sec off"} />')).toHaveLength(0);
    expect(bad('<section className="sec" style={{ textAlign: "center" }} />')).toHaveLength(0);
    expect(
      bad('<section\n  className="sec scrolly-sec"\n  ref={rootRef}\n>x</section>'),
    ).toHaveLength(0);
    // Non-section tags are ignored.
    expect(bad('<div className="x"><span /></div>')).toHaveLength(0);
  });
});
