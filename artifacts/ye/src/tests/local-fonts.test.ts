import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const src = path.resolve(__dirname, '..');
describe('self-hosted publishing fonts', () => {
  it('uses local fonts in both language layouts without Google downloads', () => {
    for (const lang of ['(ar)', 'en']) {
      const layout = readFileSync(path.join(src, 'app', lang, 'layout.tsx'), 'utf8');
      expect(layout).toContain("from '../fonts'");
      expect(layout).not.toContain('next/font/google');
    }
    const loader = readFileSync(path.join(src, 'app/fonts.ts'), 'utf8');
    expect(loader).toContain("from 'next/font/local'");
    for (const [, file] of loader.matchAll(/['"]\.\.\/fonts\/([^'"]+\.ttf)['"]/g)) {
      const bytes = readFileSync(path.join(src, 'fonts', file));
      expect(bytes.subarray(0, 4).toString('hex')).toBe('00010000');
    }
  });
  it('retains checked font assets and license provenance', () => {
    const manifest = JSON.parse(readFileSync(path.join(src, 'fonts/sources.json'), 'utf8'));
    expect(manifest.filter((entry: { file: string }) => entry.file.endsWith('-OFL.txt'))).toHaveLength(6);
    for (const entry of manifest) {
      const bytes = readFileSync(path.join(src, 'fonts', entry.file));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    }
  });
});
