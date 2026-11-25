import { Chess } from 'chess.js';
import { isFlagged } from '../analysis/classify';
import { parseUci } from '../chess/game';
import type { Game, PlyResult, Termination } from '../db/types';
import { LEVELS } from '../engine/levels';
import { colorWord, formatEval, isoDate, moveNumber, movetext, sanLine, sideToMoveAt, uciToSan } from './format';

// The Coach export (docs/EXPORT.md §1). coach/PROJECT_INSTRUCTIONS.md is written against these
// exact labels: change them there too if they change here.

const TERMINATION_WORDS: Record<Termination, string> = {
  checkmate: 'checkmate',
  resign: 'resignation',
  stalemate: 'stalemate',
  repetition: 'repetition',
  fifty_move: '50-move rule',
  insufficient: 'insufficient material',
  abandoned: 'abandoned',
};

const PHASE_WORDS = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' } as const;

export function buildCoachExport(game: Game): string {
  const a = game.analysis;
  if (!a) throw new Error('The game has no analysis yet');

  const chess = new Chess();
  const fens = [chess.fen()];
  for (const m of game.moves) {
    chess.move(parseUci(m));
    fens.push(chess.fen());
  }
  const me = game.playerColor;
  const level = LEVELS[game.level].label;
  const evalAt = (i: number) => formatEval(a.positions[i], sideToMoveAt(i));
  const swing = (p: PlyResult) => `${evalAt(p.ply)} -> ${evalAt(p.ply + 1)}`;
  const who = (p: PlyResult) => `Move ${moveNumber(p.ply)} (${colorWord(p.color)})`;
  const tagWord = (p: PlyResult) => p.tag.toUpperCase();
  const bestSan = (i: number) => uciToSan(fens[i], a.positions[i].best) ?? '?';

  const lastMove = game.moves.length ? moveNumber(game.moves.length - 1) : 0;
  const term = game.termination ? `${TERMINATION_WORDS[game.termination]}, ` : '';
  const sans = a.plies.map((p) => p.san);

  const lines: string[] = [
    'WALNUT GAME EXPORT v1',
    `GAME: ${isoDate(game.createdAt)} | Me (${colorWord(me)}) vs Bot ${level} (~${game.botElo}) | Result: ${game.result} (${term}move ${lastMove})`,
    `OPENING: ${game.opening ? `${game.opening.eco} ${game.opening.name}` : 'Unknown'}`,
    `MY ACCURACY: ${a.accuracy[me]}% | Blunders ${a.counts.blunder} | Mistakes ${a.counts.mistake} | Inaccuracies ${a.counts.inaccuracy}`,
    `TAKEBACKS: ${game.takebacks}`,
    `PGN: ${movetext(sans)} ${game.result}`,
    '',
  ];

  const mine = a.plies.filter((p) => p.color === me && isFlagged(p.tag));
  const bots = a.plies.filter((p) => p.color !== me && isFlagged(p.tag));

  const replyText = (p: PlyResult, withBest: boolean) => {
    const reply = a.plies[p.ply + 1];
    if (!reply || !p.replyVerdict) return 'My reply: none (game over)';
    const verdict = p.replyVerdict.toUpperCase();
    if (!withBest) return `My reply: ${verdict}`;
    return p.replyVerdict === 'missed'
      ? `My reply: ${reply.san} (MISSED, best was ${bestSan(reply.ply)})`
      : `My reply: ${reply.san} (PUNISHED)`;
  };

  const tp = a.turningPly !== null ? a.plies[a.turningPly] : null;
  if (tp && a.turningKind === 'loss') {
    lines.push(`TURNING POINT: ${who(tp)} ${tp.san} | ${tagWord(tp)} | ${swing(tp)}`);
  } else if (tp && a.turningKind === 'win') {
    lines.push(`WHERE I WON IT: ${who(tp)} ${tp.san} | ${tagWord(tp)} | ${swing(tp)} | ${replyText(tp, false)}`);
  } else {
    lines.push('TURNING POINT: None');
  }
  lines.push('');

  if (mine.length === 0) {
    lines.push('MY FLAGGED MOVES: None');
  } else {
    lines.push('MY FLAGGED MOVES:');
    for (const p of mine) {
      const pos = a.positions[p.ply];
      lines.push(`${who(p)} | Played: ${p.san} | ${tagWord(p)} | Eval: ${swing(p)} | Phase: ${PHASE_WORDS[p.phase]}`);
      lines.push(`  FEN: ${fens[p.ply]}`);
      lines.push(`  Best: ${bestSan(p.ply)} | Line: ${sanLine(fens[p.ply], p.ply, pos.pv) || bestSan(p.ply)}`);
    }
  }
  lines.push('');

  if (bots.length === 0) {
    lines.push('BOT MISTAKES: None');
  } else {
    lines.push('BOT MISTAKES:');
    for (const p of bots) {
      lines.push(`${who(p)} | Played: ${p.san} | ${tagWord(p)} | Eval: ${swing(p)} | ${replyText(p, true)}`);
    }
  }
  lines.push('');

  const won = (game.result === '1-0') === (me === 'w');
  const outcome = game.result === '1/2-1/2' ? 'Drew' : won ? 'Won' : 'Lost';
  const biggest = tp ? ` Biggest swing at move ${moveNumber(tp.ply)} (${tp.phase}).` : ' No big swings.';
  lines.push(`SUMMARY: ${outcome} as ${colorWord(me)} vs ${level}.${biggest}`);

  return lines.join('\n');
}

export function pgnFilename(game: Game): string {
  return `walnut-${isoDate(game.createdAt)}-${game.level}.pgn`;
}
