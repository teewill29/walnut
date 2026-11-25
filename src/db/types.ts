// Types from docs/DATA_MODEL.md. Keep them in sync with that file.

export type Color = 'w' | 'b';
export type Level = 'easy' | 'medium' | 'hard' | 'chessmaster';
export type GameStatus = 'in_progress' | 'finished' | 'abandoned';
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';
export type Termination =
  | 'checkmate'
  | 'resign'
  | 'stalemate'
  | 'repetition'
  | 'fifty_move'
  | 'insufficient'
  | 'abandoned';

export type MoveTag = 'book' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export type GamePhase = 'opening' | 'middlegame' | 'endgame';

export interface PositionEval {
  cp: number | null; // White's view
  mate: number | null; // White's view (+ = White mates)
  best: string | null; // UCI
  pv: string[]; // UCI, up to PV_PLIES
}

export interface PlyResult {
  ply: number; // 0-based
  san: string;
  color: Color;
  winBefore: number; // the mover's win%
  winAfter: number;
  drop: number;
  accuracy: number;
  tag: MoveTag;
  phase: GamePhase;
  replyVerdict: 'punished' | 'missed' | null; // set on the bot's flagged moves
}

export interface Analysis {
  version: number; // ANALYSIS_VERSION used
  depth: number;
  analyzedAt: number;
  positions: PositionEval[]; // length = moves.length + 1
  plies: PlyResult[]; // length = moves.length
  accuracy: { w: number; b: number };
  counts: { inaccuracy: number; mistake: number; blunder: number }; // the player's moves only
  turningPly: number | null;
  turningKind: 'loss' | 'win' | null; // 'win' = "Where you won it"
}

export interface AnalysisProgress {
  version: number;
  positions: PositionEval[]; // done so far
}

export interface Opening {
  eco: string;
  name: string;
  family: string;
}

export interface Game {
  id: string; // uuid
  createdAt: number; // ms epoch
  endedAt: number | null;
  status: GameStatus;
  playerColor: Color;
  level: Level;
  botElo: number; // nominal Elo at the time of play (from levels.ts)
  result: GameResult;
  termination: Termination | null;
  moves: string[]; // UCI, the source of truth
  pgn: string; // generated from moves + headers on save
  takebacks: number;
  opening: Opening | null;
  analysis: Analysis | null;
  analysisProgress: AnalysisProgress | null; // non-null while analysis is partial
}

export type SettingKey =
  | 'sound'
  | 'legalDots'
  | 'coordinates'
  | 'confirmResign'
  | 'allowTakebacks'
  | 'pieceStyle'
  | 'lastLevel'
  | 'lastSide'
  | 'includeTakebackGames'
  | 'lastBackupAt'
  | 'backupBannerDismissedAt'
  | 'gamesAtLastBackup';

export interface SettingRow {
  key: SettingKey;
  value: unknown;
}
