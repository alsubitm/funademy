'use client';

import { useEffect, useRef, useState } from 'react';
import type { CopyKey } from './data';
import { tr, type Lang } from './shared';

type Cmd = 'up' | 'right' | 'down' | 'left';
const BLOCKED = new Set(['1,1', '2,2']);
const ARROWS: Record<Cmd, string> = { up: '↑', right: '→', down: '↓', left: '←' };
const DELTAS: Record<Cmd, [number, number]> = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };
const START = { row: 3, col: 0 };

export function CodingLab({ lang, motionPaused }: { lang: Lang; motionPaused: boolean }) {
  const t = (k: CopyKey) => tr(lang, k);
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [pos, setPos] = useState(START);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<CopyKey>('labReady');
  const generation = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const lastCelebration = useRef(0);
  const pausedRef = useRef(motionPaused);
  pausedRef.current = motionPaused;

  useEffect(() => () => { generation.current++; }, []);

  const resetBoard = () => { setPos(START); setVisited(new Set()); };

  const celebrate = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (pausedRef.current || reduce || Date.now() - lastCelebration.current < 1500 || !boardRef.current) return;
    lastCelebration.current = Date.now();
    const host = boardRef.current.closest('.fa3') ?? document.body;
    const rect = boardRef.current.getBoundingClientRect();
    for (let i = 0; i < 28; i++) {
      const piece = document.createElement('i');
      piece.className = 'confetti-piece';
      piece.setAttribute('aria-hidden', 'true');
      const angle = (Math.PI * 2 * i) / 28;
      piece.style.cssText = `--x:${rect.x + rect.width / 2}px;--y:${rect.y + rect.height / 2}px;--dx:${Math.cos(angle) * (100 + Math.random() * 130)}px;--dy:${Math.sin(angle) * (90 + Math.random() * 100)}px;--rotation:${Math.random() * 720}deg;--confetti:${['#ffd332', '#ffb6d9', '#c4f0d3', '#254de5'][i % 4]};border-radius:${i % 2 ? '50%' : '2px'}`;
      host.append(piece);
      piece.addEventListener('animationend', () => piece.remove(), { once: true });
      setTimeout(() => piece.remove(), 1500);
    }
  };

  const add = (cmd: Cmd) => {
    if (running) return;
    if (commands.length >= 12) { setStatus('labLimit'); return; }
    setCommands((c) => [...c, cmd]); resetBoard(); setStatus('labReady');
  };

  const run = async () => {
    if (running) return;
    if (!commands.length) { setStatus('labEmpty'); return; }
    const gen = ++generation.current;
    setRunning(true); resetBoard(); setStatus('labRunning');
    let p = { ...START };
    const seen = new Set<string>();
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 110 : 420;
    for (const cmd of [...commands]) {
      await new Promise((r) => setTimeout(r, delay));
      if (gen !== generation.current) return;
      const [dr, dc] = DELTAS[cmd];
      const next = { row: p.row + dr, col: p.col + dc };
      if (next.row < 0 || next.row > 3 || next.col < 0 || next.col > 3) { setStatus('labEdge'); setRunning(false); return; }
      if (BLOCKED.has(`${next.row},${next.col}`)) { setStatus('labWall'); setRunning(false); return; }
      seen.add(`${p.row},${p.col}`);
      p = next;
      setVisited(new Set(seen)); setPos(next);
      if (p.row === 0 && p.col === 3) { setStatus('labWin'); setRunning(false); celebrate(); return; }
    }
    setStatus('labTry'); setRunning(false);
  };

  const cells = [];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const key = `${row},${col}`;
    const isCur = row === pos.row && col === pos.col;
    const cls = ['grid-cell', BLOCKED.has(key) && 'blocked', row === 0 && col === 3 && 'target', visited.has(key) && 'visited', isCur && 'current'].filter(Boolean).join(' ');
    cells.push(
      <div key={key} className={cls} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {isCur ? <img src="/v3/kite-mark.webp" alt="" /> : row === 0 && col === 3 ? '✦' : BLOCKED.has(key) ? '▦' : null}
      </div>,
    );
  }

  return (
    <div className="coding-lab">
      <div className="lab-heading"><span className="lab-label">{t('labTitle')}</span><span className="lab-level">{t('labLevel')}</span></div>
      <div className="lab-board" ref={boardRef} dir="ltr" role="img" aria-label={t('gridLabel')}>{cells}</div>
      <p className="board-help">{t('boardHelp')}</p>
      <div className="command-buttons" dir="ltr">
        {(Object.keys(ARROWS) as Cmd[]).map((cmd) => (
          <button key={cmd} type="button" aria-label={t(cmd)} disabled={running} onClick={() => add(cmd)} data-testid={`button-lab-${cmd}`}>{ARROWS[cmd]}</button>
        ))}
        <button type="button" className="undo-button" aria-label={t('undo')} disabled={running} data-testid="button-lab-undo"
          onClick={() => { if (running) return; setCommands((c) => c.slice(0, -1)); resetBoard(); setStatus('labReady'); }}>⌫</button>
      </div>
      <div className="sequence" dir="ltr" aria-label="Your command sequence">
        {commands.length ? commands.map((c, i) => <span key={i} title={`${i + 1}. ${t(c)}`}>{ARROWS[c]}</span>) : t('sequenceEmpty')}
      </div>
      <div className="lab-actions">
        <button type="button" className="button button-blue" disabled={running} onClick={run} data-testid="button-lab-run"><span>{t('runCode')}</span><span aria-hidden="true">▷</span></button>
        <button type="button" className="reset-button" data-testid="button-lab-reset"
          onClick={() => { generation.current++; setRunning(false); setCommands([]); resetBoard(); setStatus('labReady'); }}>{t('reset')}</button>
      </div>
      <p className={`lab-status${status === 'labWin' ? ' success' : ''}`} role="status" aria-live="polite">{t(status)}</p>
    </div>
  );
}
