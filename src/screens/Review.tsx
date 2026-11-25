import { Chess } from 'chess.js';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isFlagged } from '../analysis/classify';
import { Board } from '../components/board/Board';
import { ProgressBar } from '../components/ProgressBar';
import { EvalBar } from '../components/review/EvalBar';
import { EvalGraph } from '../components/review/EvalGraph';
import { buildPgn, parseUci } from '../chess/game';
import { db } from '../db/schema';
import type { Analysis, Game, MoveTag, PlyResult } from '../db/types';
import { ANALYSIS_VERSION } from '../engine/analysisConfig';
import { analysisQueue, useAnalysisStatus } from '../engine/analysisQueue';
import { LEVELS } from '../engine/levels';
import { buildCoachExport, pgnFilename } from '../export/coachExport';
import { colorWord, displayEval, MARKS, moveLabel, moveNumber, sanLine, sideToMoveAt, TAG_WORDS, uciToSan } from '../export/format';
import { usePath } from '../lib/router';
import { canShare, copyText, downloadText, shareText } from '../lib/share';
import { DESKTOP_QUERY, TABLET_UP_QUERY, useMediaQuery } from '../lib/useMediaQuery';

// Post-game review (SPEC.md §2, Review.dc.html).

export function ReviewScreen() {
  const path = usePath();
  const id = path.startsWith('/review/') ? decodeURIComponent(path.slice('/review/'.length)) : null;
  const game = useLiveQuery(
    async () => {
      if (id) return (await db.games.get(id)) ?? null;
      const last = await db.games
        .where('[status+createdAt]')
        .between(['finished', Dexie.minKey], ['finished', Dexie.maxKey])
        .last();
      return last ?? null;
    },
    [id],
    'loading' as const,
  );

  if (game === 'loading') return <div className="screen-inner" aria-busy="true" />;
  if (!game) {
    return (
      <div className="screen-inner">
        <h1 className="page-title">Game review</h1>
        <p className="page-sub">No finished games yet.</p>
        <section className="card empty-card">
          <p className="muted">Finish a game and its review shows up here.</p>
        </section>
      </div>
    );
  }
  if (game.status !== 'finished') {
    return (
      <div className="screen-inner">
        <h1 className="page-title">Game review</h1>
        <p className="page-sub">{subline(game)}</p>
        <section className="card empty-card">
          <p className="muted">Unfinished games have no review.</p>
        </section>
      </div>
    );
  }
  const a = game.analysis;
  if (!a || a.version < ANALYSIS_VERSION || game.analysisProgress) return <Analyzing game={game} />;
  return <ReviewBody key={game.id} game={game} analysis={a} />;
}

/** "You (White) vs Bot · Medium · Nov 24, 2026 · Lost by checkmate on move 31" */
function subline(game: Game): string {
  const date = new Date(game.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const moves = game.moves.length ? moveNumber(game.moves.length - 1) : 0;
  const won = (game.result === '1-0') === (game.playerColor === 'w');
  let outcome: string;
  if (game.result === '*') outcome = 'Unfinished';
  else if (game.termination === 'resign') outcome = 'Resigned';
  else if (game.result === '1/2-1/2') {
    const how: Record<string, string> = {
      stalemate: 'stalemate',
      repetition: 'repetition',
      fifty_move: 'the 50-move rule',
      insufficient: 'insufficient material',
    };
    outcome = `Draw by ${how[game.termination ?? ''] ?? 'agreement'}`;
  } else outcome = `${won ? 'Won' : 'Lost'}${game.termination === 'checkmate' ? ' by checkmate' : ''}`;
  return `You (${colorWord(game.playerColor)}) vs Bot · ${LEVELS[game.level].label} · ${date} · ${outcome} on move ${moves}`;
}

function Analyzing({ game }: { game: Game }) {
  const status = useAnalysisStatus();
  useEffect(() => {
    analysisQueue.enqueue(game.id, true);
  }, [game.id]);
  const total = game.moves.length + 1;
  const done = status?.gameId === game.id ? status.done : (game.analysisProgress?.positions.length ?? 0);
  return (
    <div className="screen-inner">
      <h1 className="page-title">Game review</h1>
      <p className="page-sub">{subline(game)}</p>
      <section className="card">
        <h2 className="card-title">Analyzing your game…</h2>
        <ProgressBar done={done} total={total} />
        <p className="muted">You can keep using the app. The review appears here when it's done.</p>
      </section>
    </div>
  );
}

const fromTo = (uci: string | null | undefined) => (uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null);

function ReviewBody({ game, analysis: a }: { game: Game; analysis: Analysis }) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const tabletUp = useMediaQuery(TABLET_UP_QUERY);
  const n = game.moves.length;
  const [k, setK] = useState(a.turningPly ?? n);

  const fens = useMemo(() => {
    const chess = new Chess();
    const out = [chess.fen()];
    for (const m of game.moves) {
      chess.move(parseUci(m));
      out.push(chess.fen());
    }
    return out;
  }, [game.moves]);

  const go = useCallback((next: number) => setK(Math.max(0, Math.min(n, next))), [n]);

  // Arrow keys on desktop (SPEC.md §2). Not while a dialog is open or a field has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, summary')) return;
      if (e.key === 'ArrowLeft') go(k - 1);
      else if (e.key === 'ArrowRight') go(k + 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(n);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [k, n, go]);

  const ply: PlyResult | null = k < n ? a.plies[k] : null;
  const evalIndex = k < n ? k + 1 : n;
  const orientation = game.playerColor === 'w' ? 'white' : 'black';
  const bestUci = ply ? a.positions[k].best : null;
  const bestSan = ply ? uciToSan(fens[k], bestUci) : null;
  const playedIsBest = !!ply && bestUci === game.moves[k];

  const label = ply ? `${moveLabel(ply.ply, ply.san)}${MARKS[ply.tag] ?? ''}` : 'End of game';

  const stepper = (
    <div className="stepper" role="group" aria-label="Step through the game">
      <StepButton label="First move" onClick={() => go(0)} disabled={k === 0} icon={<path d="M17 18l-6-6 6-6M7 6v12" />} />
      <StepButton label="Previous move" onClick={() => go(k - 1)} disabled={k === 0} icon={<path d="M15 18l-6-6 6-6" />} />
      <span className="stepper-label" aria-live="polite">
        {label}
      </span>
      <StepButton label="Next move" onClick={() => go(k + 1)} disabled={k === n} icon={<path d="M9 18l6-6-6-6" />} />
      <StepButton label="Last move" onClick={() => go(n)} disabled={k === n} icon={<path d="M7 18l6-6-6-6M17 6v12" />} />
    </div>
  );

  const legend = ply && (
    <div className="legend">
      {!playedIsBest && (
        <span className="legend-chip chip-blunder">
          <span className="legend-swatch swatch-played" />
          Played {ply.san}
        </span>
      )}
      {bestSan && (
        <span className="legend-chip chip-good">
          <span className="legend-swatch swatch-best" />
          Best {bestSan}
          {playedIsBest ? ' (played)' : ''}
        </span>
      )}
    </div>
  );

  const boardBlock = (
    <ReviewBoard
      fen={fens[k]}
      orientation={orientation}
      review={ply ? { played: fromTo(game.moves[k]), best: fromTo(bestUci) } : null}
      lastMove={!ply && n ? fromTo(game.moves[n - 1]) : null}
      evalBar={{ ev: a.positions[evalIndex], sideToMove: sideToMoveAt(evalIndex) }}
      desktop={desktop}
      framed={tabletUp}
      onSwipe={(dir) => go(k + dir)}
      ariaLabel={ply ? `Position before ${moveLabel(ply.ply, ply.san)}` : 'Final position'}
    />
  );

  const cards: Record<string, ReactNode> = {
    summary: <SummaryRow key="summary" game={game} a={a} />,
    graph: (
      <section key="graph" className="card" aria-labelledby="graph-title">
        <div className="card-head">
          <h2 id="graph-title" className="card-title">
            Evaluation
          </h2>
          <span className="muted small">Light area = White ahead</span>
        </div>
        <EvalGraph
          positions={a.positions}
          turningPly={a.turningPly}
          turningKind={a.turningKind}
          current={evalIndex}
          onPick={(j) => go(Math.max(0, j - 1))}
        />
      </section>
    ),
    turning: <TurningCard key="turning" game={game} a={a} fens={fens} onJump={go} />,
    flagged: <FlaggedCard key="flagged" game={game} a={a} fens={fens} current={k} onJump={go} />,
    export: <ExportCard key="export" game={game} />,
  };

  if (desktop) {
    return (
      <>
        <div className="review-head">
          <h1 className="page-title">Game review</h1>
          <p className="page-sub-tight">{subline(game)}</p>
        </div>
        <div className="review-desktop">
          <section className="review-board-col" aria-label="Board">
            {boardBlock}
            <div className="review-under-board">
              {legend ?? <span />}
              {stepper}
            </div>
          </section>
          <aside className="review-side">{['summary', 'graph', 'turning', 'flagged', 'export'].map((c) => cards[c])}</aside>
        </div>
      </>
    );
  }

  return (
    <div className="review-phone">
      <div className="review-phone-head">
        <h1 className="page-title">Game review</h1>
        <p className="page-sub-tight">{subline(game)}</p>
      </div>
      {boardBlock}
      {legend}
      {['turning', 'flagged', 'summary', 'graph', 'export'].map((c) => cards[c])}
      {/* Last in the scroll area + sticky: always pinned above the tab bar (SPEC.md / DESIGN.md). */}
      <div className="stepper-pin">{stepper}</div>
    </div>
  );
}

function StepButton({ label, onClick, disabled, icon }: { label: string; onClick: () => void; disabled: boolean; icon: ReactNode }) {
  return (
    <button type="button" className="step-btn" aria-label={label} onClick={onClick} disabled={disabled}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon}
      </svg>
    </button>
  );
}

const GUTTER_X = 18 + 14 + 8 + 26;

function ReviewBoard(props: {
  fen: string;
  orientation: 'white' | 'black';
  review: { played: { from: string; to: string } | null; best: { from: string; to: string } | null } | null;
  lastMove: { from: string; to: string } | null;
  evalBar: { ev: Analysis['positions'][number]; sideToMove: 'w' | 'b' };
  desktop: boolean;
  framed: boolean;
  onSwipe: (dir: 1 | -1) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Desktop: 528px board with the vertical bar beside it. Phone/tablet: full width, bar above.
  const size = props.desktop
    ? Math.floor(Math.max(0, Math.min(528, w - 34 - GUTTER_X)))
    : Math.floor(Math.max(0, Math.min(600, w - (props.framed ? GUTTER_X : 10))));

  const touch = useRef<{ x: number; y: number } | null>(null);

  const board = size > 120 && (
    <div
      className="review-board-touch"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) props.onSwipe(dx < 0 ? 1 : -1);
      }}
    >
      <Board
        id="review-board"
        fen={props.fen}
        orientation={props.orientation}
        playerColor={props.orientation === 'white' ? 'w' : 'b'}
        interactive={false}
        lastMove={props.lastMove}
        checkSquare={null}
        showDots={false}
        showCoordinates
        coordinates={props.desktop || props.framed ? 'gutter' : 'inside'}
        size={size}
        onMove={() => false}
        ariaLabel={props.ariaLabel}
        review={props.review ?? undefined}
      />
    </div>
  );

  if (props.desktop) {
    return (
      <div className="review-board-row" ref={ref}>
        <EvalBar {...props.evalBar} orientation={props.orientation} direction="vertical" />
        {board}
      </div>
    );
  }
  return (
    <div className="review-board-stack" ref={ref}>
      <EvalBar {...props.evalBar} orientation={props.orientation} direction="horizontal" />
      <div className="review-board-center">{board}</div>
    </div>
  );
}

function SummaryRow({ game, a }: { game: Game; a: Analysis }) {
  const items: [string, string, string?][] = [
    ['Result', game.result.replace('-', '–').replace('1/2–1/2', '½–½')],
    ['Accuracy', `${a.accuracy[game.playerColor]}%`],
    ['Blunders', String(a.counts.blunder), 'blunder-text'],
    ['Mistakes', String(a.counts.mistake), 'mistake-text'],
    ['Inaccuracies', String(a.counts.inaccuracy), 'inaccuracy-text'],
  ];
  return (
    <section className="card summary-row" aria-label="Summary">
      {items.map(([label, value, cls]) => (
        <div key={label} className="stat">
          <div className="stat-label">{label}</div>
          <div className={`stat-value ${cls ?? ''}`}>{value}</div>
        </div>
      ))}
    </section>
  );
}

const CHIP_CLASS: Partial<Record<MoveTag, string>> = {
  blunder: 'chip-blunder',
  mistake: 'chip-mistake',
  inaccuracy: 'chip-inaccuracy',
  best: 'chip-good',
  good: 'chip-good',
};

function swingText(a: Analysis, p: PlyResult) {
  return `${displayEval(a.positions[p.ply], sideToMoveAt(p.ply))} → ${displayEval(a.positions[p.ply + 1], sideToMoveAt(p.ply + 1))}`;
}

function TurningCard({ game, a, fens, onJump }: { game: Game; a: Analysis; fens: string[]; onJump: (k: number) => void }) {
  const footer = <p className="muted small">Want the why? Copy this game below and paste it into your Coach project.</p>;
  if (a.turningPly === null) {
    return (
      <section className="card turning turning-clean">
        <span className="eyebrow">Turning point</span>
        <p>Clean game. No moves of yours lost 10% or more.</p>
        {footer}
      </section>
    );
  }
  const p = a.plies[a.turningPly];
  const win = a.turningKind === 'win';
  const best = uciToSan(fens[p.ply], a.positions[p.ply].best);
  const line = sanLine(fens[p.ply], p.ply, a.positions[p.ply].pv);
  const reply = a.plies[p.ply + 1];
  return (
    <section className={`card turning ${win ? 'turning-win' : ''}`} aria-labelledby="turning-title">
      <div className="card-head">
        <span className="eyebrow">{win ? 'Where you won it' : 'Turning point'}</span>
        <span className="turning-swing">{swingText(a, p)}</span>
      </div>
      <h3 id="turning-title" className="turning-move">
        <button type="button" className="link-reset" onClick={() => onJump(p.ply)}>
          {moveLabel(p.ply, p.san)}
          {MARKS[p.tag] ?? ''}
        </button>{' '}
        <span className={`turning-tag ${p.tag}-text`}>
          {win ? `Bot's ${TAG_WORDS[p.tag].toLowerCase()}` : TAG_WORDS[p.tag]}
        </span>
      </h3>
      <div className="kv">
        <span className="kv-k">Engine best</span>
        <span className="kv-v good-text strong">{best ?? '?'}</span>
        <span className="kv-k">Best line</span>
        <span className="kv-v tabular">{line || best}</span>
        {win && (
          <>
            <span className="kv-k">Your reply</span>
            <span className="kv-v">
              {reply ? `${reply.san} · ` : ''}
              <span className={p.replyVerdict === 'punished' ? 'good-text strong' : 'mistake-text strong'}>
                {p.replyVerdict === 'punished' ? 'Punished' : 'Missed'}
              </span>
            </span>
          </>
        )}
      </div>
      {footer}
      {/* keep the player's color in mind: evals are White's view */}
      <span className="visually-hidden">Evaluations are from White's point of view. You played {colorWord(game.playerColor)}.</span>
    </section>
  );
}

function FlaggedCard({
  game,
  a,
  fens,
  current,
  onJump,
}: {
  game: Game;
  a: Analysis;
  fens: string[];
  current: number;
  onJump: (k: number) => void;
}) {
  const mine = a.plies.filter((p) => p.color === game.playerColor && isFlagged(p.tag));
  const bots = a.plies.filter((p) => p.color !== game.playerColor && isFlagged(p.tag));
  const row = (p: PlyResult, extra?: ReactNode) => (
    <li key={p.ply}>
      <button
        type="button"
        className={`flag-row ${p.ply === a.turningPly ? 'is-turning' : ''} ${p.ply === current ? 'is-current' : ''}`}
        onClick={() => onJump(p.ply)}
        aria-current={p.ply === current ? 'true' : undefined}
      >
        <span className="flag-move">
          {moveLabel(p.ply, p.san)}
          {MARKS[p.tag] ?? ''}
        </span>
        <span className={`chip ${CHIP_CLASS[p.tag] ?? ''}`}>{TAG_WORDS[p.tag]}</span>
        <span className="flag-swing">{swingText(a, p)}</span>
        {extra ?? <span className="flag-best">Best {uciToSan(fens[p.ply], a.positions[p.ply].best) ?? '?'}</span>}
      </button>
    </li>
  );
  return (
    <section className="card" aria-labelledby="flagged-title">
      <h2 id="flagged-title" className="card-title">
        Flagged moves
      </h2>
      {mine.length === 0 ? (
        <p className="muted">None of your moves lost 10% or more.</p>
      ) : (
        <ol className="flag-list">{mine.map((p) => row(p))}</ol>
      )}
      <details className="bot-mistakes">
        <summary>
          Bot's mistakes <span className="muted">({bots.length})</span>
        </summary>
        {bots.length === 0 ? (
          <p className="muted small">The bot didn't make any flagged moves.</p>
        ) : (
          <ol className="flag-list">
            {bots.map((p) =>
              row(
                p,
                p.replyVerdict ? (
                  <span className={`chip ${p.replyVerdict === 'punished' ? 'chip-good' : 'chip-mistake'}`}>
                    {p.replyVerdict === 'punished' ? 'Punished' : 'Missed'}
                  </span>
                ) : (
                  <span className="flag-best">Game over</span>
                ),
              ),
            )}
          </ol>
        )}
      </details>
    </section>
  );
}

function ExportCard({ game }: { game: Game }) {
  const text = useMemo(() => buildCoachExport(game), [game]);
  const pgn = useMemo(() => game.pgn || buildPgn(game), [game]);
  const [copied, setCopied] = useState<'coach' | 'pgn' | null>(null);
  const phone = !useMediaQuery(DESKTOP_QUERY);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (what: 'coach' | 'pgn') => {
    if (await copyText(what === 'coach' ? text : pgn)) setCopied(what);
  };

  return (
    <section className="card" aria-labelledby="export-title">
      <div className="card-head">
        <h2 id="export-title" className="card-title">
          Coach export
        </h2>
        <span className="muted small">Paste into your Claude Coach project</span>
      </div>
      <div className="export-actions">
        <button type="button" className="btn btn-primary" onClick={() => copy('coach')}>
          {copied === 'coach' ? 'Copied to clipboard' : 'Copy for Coach'}
        </button>
        {phone && canShare() && (
          <button type="button" className="btn btn-secondary btn-tall" onClick={() => shareText(text, 'Walnut game export')}>
            Share…
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-tall" onClick={() => copy('pgn')}>
          {copied === 'pgn' ? 'PGN copied' : 'Copy PGN'}
        </button>
        <button type="button" className="btn btn-secondary btn-tall" onClick={() => downloadText(pgnFilename(game), pgn, 'application/x-chess-pgn')}>
          Download .pgn
        </button>
      </div>
      <pre className="export-preview" tabIndex={0} aria-label="Export preview">
        {text}
      </pre>
    </section>
  );
}
