/**
 * Guard against global CSS element-selector leaks (Task: prevent regressions).
 *
 * History: bare element rules in globals.css (nav, footer, section, details,
 * summary) leaked into internal screens (/admin) and caused real incidents —
 * e.g. a fixed bottom nav inheriting `top:0` and covering the whole screen.
 * They were scoped to classes (.site-nav, .site-footer, .sec, .faq details).
 *
 * This test parses globals.css and fails if any rule selector can match
 * elements globally (unscoped by any class/id) outside the whitelist below.
 * Scoped rules like `.faq details` or `.top a` are fine — a compound in the
 * chain carries a class, so they cannot leak into unrelated screens.
 *
 * Whitelist = intentionally global typography only.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import postcss, { type AtRule } from 'postcss';
import parser, { type Node, type Selector, type Pseudo } from 'postcss-selector-parser';

/** Elements allowed as unscoped global rules (brand-wide typography only). */
const WHITELIST = new Set(['html', 'body', 'h1', 'h2', 'h3', 'h4']);

const CSS_PATH = path.resolve(__dirname, '../app/globals.css');

interface Violation {
  selector: string;
  line: number;
}

/**
 * Extract every style-rule selector via the PostCSS AST (handles strings,
 * escapes, data URLs, and nested conditional at-rules correctly). Rules
 * inside any @keyframes variant are skipped — their "selectors" are
 * keyframe steps (`to`, `0%`), not element selectors.
 */
function collectSelectors(css: string): { selector: string; line: number }[] {
  const out: { selector: string; line: number }[] = [];
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule' && /keyframes$/i.test((p as AtRule).name)) return;
    }
    out.push({ selector: rule.selector, line: rule.source?.start?.line ?? 0 });
  });
  return out;
}

/**
 * Structural selector analysis (postcss-selector-parser AST).
 *
 * A rule is a leak when any comma-alternative is UNSCOPED — no compound in
 * its combinator chain is genuinely constrained by a class/id — and it can
 * match elements outside the typography whitelist.
 *
 * Scoping semantics:
 * - class / id in a compound → scopes that alternative.
 * - `:is()` / `:where()` scope ONLY if EVERY inner alternative is scoped
 *   (one bare-tag branch makes the group match that tag globally).
 * - `:not()` NEVER scopes — `:not(.x)` matches almost everything.
 * - `:has()` NEVER scopes its subject — `nav:has(.x)` styles <nav> anywhere;
 *   classes inside only constrain descendants.
 * - attribute selectors and plain pseudos (`:hover`, `::after`) don't scope.
 * - `html`/`body` ancestors don't scope either — every page has them.
 */
const SCOPING_GROUP_PSEUDOS = new Set([':is', ':where', ':matches', ':-webkit-any', ':-moz-any']);

/** Split a parsed Selector into compounds (nodes between combinators). */
function compoundsOf(sel: Selector): Node[][] {
  const groups: Node[][] = [];
  let cur: Node[] = [];
  for (const n of sel.nodes) {
    if (n.type === 'combinator') {
      if (cur.length) groups.push(cur);
      cur = [];
    } else {
      cur.push(n);
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

function isSelectorScoped(sel: Selector): boolean {
  return compoundsOf(sel).some(isCompoundScoped);
}

function isCompoundScoped(comp: Node[]): boolean {
  for (const n of comp) {
    if (n.type === 'class' || n.type === 'id') return true;
    if (n.type === 'pseudo' && SCOPING_GROUP_PSEUDOS.has(n.value.toLowerCase())) {
      const inner = (n as Pseudo).nodes;
      if (inner.length > 0 && inner.every(isSelectorScoped)) return true;
    }
  }
  return false;
}

/**
 * For an UNSCOPED compound: which element(s) can it match?
 * Returns a non-whitelisted tag name, '*' for universal / pseudo-only
 * compounds (`:hover` ≡ `*:hover`), or null if it only matches whitelisted
 * typography elements (or :root).
 */
function compoundViolation(comp: Node[]): string | null {
  let harmless = false; // matches only whitelisted elements
  let universal = false;
  for (const n of comp) {
    if (n.type === 'tag') {
      const t = n.value.toLowerCase();
      if (WHITELIST.has(t)) harmless = true;
      else return t;
    } else if (n.type === 'universal') {
      universal = true;
    } else if (n.type === 'pseudo') {
      const v = n.value.toLowerCase();
      if (v === ':root') harmless = true; // :root ≡ html
      else if (SCOPING_GROUP_PSEUDOS.has(v)) {
        for (const alt of (n as Pseudo).nodes) {
          if (isSelectorScoped(alt)) continue;
          const viol = selectorViolation(alt);
          if (viol) return viol;
        }
      }
      // :not()/:has()/plain pseudos: don't change the subject's identity.
    }
  }
  if (universal) return '*';
  return harmless ? null : '*';
}

/** Violation for one unscoped alternative: prefer a concrete tag over '*'. */
function selectorViolation(sel: Selector): string | null {
  let sawUniversal = false;
  for (const comp of compoundsOf(sel)) {
    const v = compoundViolation(comp);
    if (v && v !== '*') return v;
    if (v === '*') sawUniversal = true;
  }
  return sawUniversal ? '*' : null;
}

function bareElementViolation(selector: string): string | null {
  const root = parser().astSync(selector, { lossless: false });
  for (const alt of root.nodes) {
    if (isSelectorScoped(alt)) continue;
    const viol = selectorViolation(alt);
    if (viol) return viol;
  }
  return null;
}

describe('globals.css bare element selector guard', () => {
  const selectors = collectSelectors(readFileSync(CSS_PATH, 'utf8'));

  it('finds a realistic number of rules (parser sanity check)', () => {
    expect(selectors.length).toBeGreaterThan(50);
  });

  it('contains no unscoped bare element rules outside the typography whitelist', () => {
    const violations: Violation[] = [];
    for (const { selector, line } of selectors) {
      const tag = bareElementViolation(selector);
      if (tag) violations.push({ selector, line });
    }
    const msg = violations
      .map((v) => `  line ${v.line}: "${v.selector}"`)
      .join('\n');
    expect(
      violations,
      `globals.css contains unscoped bare element selectors that will leak into ` +
        `internal screens (/admin, portals):\n${msg}\n` +
        `Scope them to a class (e.g. .site-nav, .site-footer, .sec, .faq details). ` +
        `Only global typography is allowed: ${[...WHITELIST].join(', ')}.`,
    ).toEqual([]);
  });

  // Self-test: the detector actually catches the incident patterns.
  it('would catch the historical leak patterns (detector self-test)', () => {
    expect(bareElementViolation('nav')).toBe('nav');
    expect(bareElementViolation('footer')).toBe('footer');
    expect(bareElementViolation('section')).toBe('section');
    expect(bareElementViolation('details[open] summary::after')).toBe('details');
    expect(bareElementViolation('summary::-webkit-details-marker')).toBe('summary');
    expect(bareElementViolation('a:hover')).toBe('a');
    expect(bareElementViolation('body nav')).toBe('nav');
    expect(bareElementViolation('html footer')).toBe('footer');
    expect(bareElementViolation(':is(nav)')).toBe('nav');
    expect(bareElementViolation(':where(section)')).toBe('section');
    // Unqualified :not() is universal — flagged regardless of its argument.
    expect(bareElementViolation(':not(nav)')).toBe('*');
    expect(bareElementViolation(':not(*)')).toBe('*');
    expect(bareElementViolation(':not(.x) aside')).toBe('aside');
    expect(bareElementViolation(':not(nav, .x)')).toBe('*');
    expect(bareElementViolation('div:not(nav)')).toBe('div');
    // :not() qualified by a real class elsewhere is properly scoped.
    expect(bareElementViolation('.faq :not(.open)')).toBeNull();
    expect(bareElementViolation('.btn:not(:hover)')).toBeNull();
    // :has() constrains descendants, it does not scope the subject.
    expect(bareElementViolation('nav:has(.widget)')).toBe('nav');
    expect(bareElementViolation('*:has(.widget)')).toBe('*');
    expect(bareElementViolation('.card:has(img)')).toBeNull();
    // Mixed :is()/:where() alternatives: one unscoped :has() branch keeps the
    // subject globally matchable even if a sibling branch has a class.
    expect(bareElementViolation('nav:is(:has(.widget), .safe)')).toBe('nav');
    expect(bareElementViolation(':is(:has(.widget), .safe)')).toBe('*');
    expect(bareElementViolation(':where(:has(.widget), .safe)')).toBe('*');
    expect(bareElementViolation('footer:where(:not(.x), .safe)')).toBe('footer');
    expect(bareElementViolation(':is(nav, .safe)')).toBe('nav');
    // ...but a group where EVERY alternative is class-scoped does scope.
    expect(bareElementViolation('nav:is(.public, .safe)')).toBeNull();
    expect(bareElementViolation(':is(.a nav, .b)')).toBeNull();
    // Parser recurses into conditional at-rules — rules can't hide there.
    const nested = collectSelectors(
      '@media (min-width:600px){nav{color:red}}\n' +
        '@container sidebar (min-width:200px){footer{top:0}}\n' +
        '@supports (display:grid){@container (min-width:1px){section{gap:0}}}\n' +
        '@keyframes spin{to{transform:rotate(1turn)}}',
    );
    expect(nested.map((r) => r.selector).sort()).toEqual(['footer', 'nav', 'section']);
    expect(nested.every((r) => bareElementViolation(r.selector))).toBe(true);
    // Braces/semicolons inside quoted values or url() can't hide later rules.
    const tricky = collectSelectors(
      '.safe{content:"{";}\nnav{color:red}\n' +
        ".bg{background:url('data:image/svg+xml;utf8,<svg>{}</svg>')}\nfooter{top:0}\n" +
        '/* comment with { brace */ details{margin:0}',
    );
    expect(tricky.map((r) => r.selector)).toEqual(['.safe', 'nav', '.bg', 'footer', 'details']);
    expect(
      tricky.filter((r) => bareElementViolation(r.selector)).map((r) => r.selector),
    ).toEqual(['nav', 'footer', 'details']);
    expect(bareElementViolation('*')).toBe('*');
    expect(bareElementViolation('h2, footer')).toBe('footer');
    // ...and does NOT flag scoped or whitelisted rules.
    expect(bareElementViolation('.faq details')).toBeNull();
    expect(bareElementViolation('.top a')).toBeNull();
    expect(bareElementViolation("[dir='rtl'] .sand-stripe")).toBeNull();
    expect(bareElementViolation('h1,\nh2,\nh3,\nh4')).toBeNull();
    expect(bareElementViolation('body')).toBeNull();
    expect(bareElementViolation(':root')).toBeNull();
    expect(bareElementViolation('.hero h1 .u::after')).toBeNull();
  });
});
