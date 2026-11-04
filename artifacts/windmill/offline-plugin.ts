import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/** Production-only, explicit asset manifest: never crawl or runtime-cache URLs. */
export function offlinePlugin(): Plugin {
  return {
    name: 'windmill-offline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const root = import.meta.dirname;
      const publicFiles = ['favicon.svg', 'brand/ye-logo.svg',
        ...readdirSync(path.join(root, 'public/fonts')).filter(f => f.endsWith('.ttf')).map(f => `fonts/${f}`)];
      const files = Object.keys(bundle).filter(f => f === 'index.html' || /^assets\/.*\.(js|css|svg|woff2?|ttf)$/.test(f));
      const hash = createHash('sha256');
      for (const f of files.sort()) {
        const asset = bundle[f];
        hash.update(f).update(asset.type === 'chunk' ? asset.code : asset.source);
      }
      for (const f of publicFiles) hash.update(f).update(readFileSync(path.join(root, 'public', f)));
      const template = readFileSync(path.join(root, 'offline-worker.js'), 'utf8');
      hash.update(template);
      const version = hash.digest('hex').slice(0, 20);
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') throw new Error('Missing offline lesson shell');
      html.source = String(html.source).replace('<head>', `<head><meta name="windmill-shell-version" content="${version}">`);
      this.emitFile({
        type: 'asset', fileName: 'sw.js',
        source: template.replace('__VERSION__', version)
          .replace('__ASSETS__', JSON.stringify([...files, ...publicFiles].map(f => `/windmill/${f}`))),
      });
    },
  };
}
