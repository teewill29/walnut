import { Chess, type Move, type Square } from 'chess.js';
import type { Color, Game, GameResult, Termination } from '../db/types';
import { LEVELS } from '../engine/levels';

// Wiring around chess.js. No chess rules are written here (CLAUDE.md rule 2).

export function parseUci(uci: string): { from: Square; to: Square; promotion?: string } {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

export const toUci = (m: Pick<Move, 'from' | 'to' | 'promotion'>) => m.from + m.to + (m.promotion ?? '');

/** Rebuilds a game from its UCI moves. Throws if a move is illegal. */
export function replay(moves: string[]): Chess {
  const chess = new Chess();
  for (const m of moves) chess.move(parseUci(m));
  return chess;
}

/** Tries a move; returns the chess.js Move, or null if it's illegal. */
export function tryMove(chess: Chess, uci: string): Move | null {
  try {
    return chess.move(parseUci(uci));
  } catch {
    return null;
  }
}

/** The position key used for openings: the FEN without the move counters. */
export const epd = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

export interface GameEnd {
  result: GameResult;
  termination: Termination;
}

/** How the game ended on the board, or null if it goes on. Draws end automatically. */
export function detectEnd(chess: Chess): GameEnd | null {
  if (chess.isCheckmate()) return { result: chess.turn() === 'w' ? '0-1' : '1-0', termination: 'checkmate' };
  if (chess.isStalemate()) return { result: '1/2-1/2', termination: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', termination: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', termination: 'repetition' };
  if (chess.isDrawByFiftyMoves()) return { result: '1/2-1/2', termination: 'fifty_move' };
  return null;
}

export const resignResult = (player: Color): GameResult => (player === 'w' ? '0-1' : '1-0');

/** "You won by checkmate", "Draw by repetition", "You resigned" (SPEC.md §1). */
export function resultText(result: GameResult, termination: Termination | null, player: Color): string {
  if (termination === 'resign') return 'You resigned';
  if (result === '1/2-1/2') {
    switch (termination) {
      case 'stalemate':
        return 'Draw by stalemate';
      case 'repetition':
        return 'Draw by repetition';
      case 'fifty_move':
        return 'Draw by the 50-move rule';
      case 'insufficient':
        return 'Draw by insufficient material';
      default:
        return 'Draw';
    }
  }
  if (result === '*') return 'Unfinished';
  const won = (result === '1-0') === (player === 'w');
  return `You ${won ? 'won' : 'lost'}${termination === 'checkmate' ? ' by checkmate' : ''}`;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const pgnDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

/** Standard PGN with headers (SPEC.md §2 → Coach export). */
export function buildPgn(game: Game): string {
  const chess = replay(game.moves);
  const bot = `Bot ${LEVELS[game.level].label}`;
  chess.setHeader('Event', 'Walnut vs Bot');
  chess.setHeader('Site', 'Walnut');
  chess.setHeader('Date', pgnDate(game.createdAt));
  chess.setHeader('White', game.playerColor === 'w' ? 'You' : bot);
  chess.setHeader('Black', game.playerColor === 'b' ? 'You' : bot);
  chess.setHeader('Result', game.result);
  chess.setHeader('BotLevel', LEVELS[game.level].label);
  if (game.opening) {
    chess.setHeader('Opening', game.opening.name);
    chess.setHeader('ECO', game.opening.eco);
  }
  return chess.pgn();
}

const PIECE_NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/** Screen-reader text: "Bot played knight to f6". */
export function describeMove(who: 'You' | 'Bot', m: Move): string {
  if (m.isKingsideCastle()) return `${who} castled kingside`;
  if (m.isQueensideCastle()) return `${who} castled queenside`;
  const verb = m.captured ? `took on ${m.to} with` : 'played';
  const piece = PIECE_NAMES[m.piece];
  const promo = m.promotion ? `, promoting to ${PIECE_NAMES[m.promotion]}` : '';
  const check = m.san.endsWith('#') ? ', checkmate' : m.san.endsWith('+') ? ', check' : '';
  return m.captured ? `${who} ${verb} ${piece}${promo}${check}` : `${who} ${verb} ${piece} to ${m.to}${promo}${check}`;
}
