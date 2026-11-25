import { Chess, type Square } from 'chess.js';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Chessboard,
  defaultArrowOptions,
  defaultPieces,
  type PieceDropHandlerArgs,
  type SquareHandlerArgs,
} from 'react-chessboard';
import { isLight, viewPos, woodStyle } from './wood';

export type Orientation = 'white' | 'black';

interface Props {
  id: string;
  fen: string;
  orientation: Orientation;
  /** Your color; only these pieces can be picked up. */
  playerColor: 'w' | 'b';
  /** False while the bot thinks or after the game ends. */
  interactive: boolean;
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  showDots: boolean;
  showCoordinates: boolean;
  /** 'inside' = 9px labels in the edge squares (phone); 'gutter' = brass labels in the frame. */
  coordinates: 'inside' | 'gutter';
  size: number;
  onMove: (uci: string) => boolean;
  ariaLabel: string;
  /** Review: the played move in red and the engine's best in green (only green when they match). */
  review?: { played: { from: string; to: string } | null; best: { from: string; to: string } | null };
}

type Tint = 'last' | 'played' | 'best' | null;

const FILES = 'abcdefgh';
const PROMOTION_PIECES = ['q', 'r', 'b', 'n'] as const;
const PIECE_NAME = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' } as const;

export function Board(props: Props) {
  const { fen, orientation, playerColor, interactive, lastMove, checkSquare, showDots, size, onMove } = props;
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);

  // A new position (your move, the bot's reply, a takeback) clears any selection.
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [fen, interactive]);

  const chess = useMemo(() => new Chess(fen), [fen]);

  const targets = useMemo(() => {
    const map = new Map<string, { capture: boolean }>();
    if (!selected) return map;
    for (const m of chess.moves({ square: selected, verbose: true })) {
      map.set(m.to, { capture: !!m.captured });
    }
    return map;
  }, [chess, selected]);

  const ownPiece = useCallback(
    (sq: string) => {
      const p = chess.get(sq as Square);
      return !!p && p.color === playerColor;
    },
    [chess, playerColor],
  );

  const attempt = useCallback(
    (from: Square, to: Square): boolean => {
      setSelected(null);
      const promo = chess.moves({ square: from, verbose: true }).some((m) => m.to === to && m.promotion);
      if (promo) {
        setPromotion({ from, to });
        return false;
      }
      return onMove(from + to);
    },
    [chess, onMove],
  );

  const onSquareClick = useCallback(
    ({ square }: SquareHandlerArgs) => {
      if (!interactive || promotion) return;
      const sq = square as Square;
      if (selected && targets.has(sq)) {
        attempt(selected, sq);
      } else if (ownPiece(sq) && sq !== selected) {
        setSelected(sq);
      } else {
        setSelected(null);
      }
    },
    [interactive, promotion, selected, targets, ownPiece, attempt],
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!interactive || !targetSquare || sourceSquare === targetSquare) return false;
      return attempt(sourceSquare as Square, targetSquare as Square);
    },
    [interactive, attempt],
  );

  const inside = props.showCoordinates && props.coordinates === 'inside';

  const squareRenderer = useCallback(
    ({ square, children }: SquareHandlerArgs & { children?: ReactNode }) => {
      const t = targets.get(square);
      const on = (m: { from: string; to: string } | null | undefined) => !!m && (square === m.from || square === m.to);
      const review = props.review;
      let tint: Tint = null;
      if (review) {
        const same = review.played && review.best && review.played.from === review.best.from && review.played.to === review.best.to;
        if (on(review.best)) tint = 'best';
        else if (!same && on(review.played)) tint = 'played';
      } else if (square === selected || on(lastMove)) {
        tint = 'last';
      }
      const pos = viewPos(square, orientation);
      const labelColor = isLight(square) ? '#8E5A33' : '#E2BE8A';
      return (
        <div className="sq" style={woodStyle(square)}>
          {tint && <div className={`sq-fill sq-${tint}`} />}
          {square === checkSquare && <div className="sq-fill sq-check" />}
          {showDots && t && <div className={t.capture ? 'sq-ring' : 'sq-dot'} />}
          {inside && pos.col === 0 && (
            <span className="sq-coord sq-rank" style={{ color: labelColor }}>
              {square[1]}
            </span>
          )}
          {inside && pos.row === 7 && (
            <span className="sq-coord sq-file" style={{ color: labelColor }}>
              {square[0]}
            </span>
          )}
          <div className="sq-piece">{children}</div>
        </div>
      );
    },
    [targets, selected, lastMove, checkSquare, showDots, orientation, inside, props.review],
  );

  const board = (
    <div className="board-squares" style={{ width: size, height: size }}>
      <Chessboard
        options={{
          id: props.id,
          position: fen,
          boardOrientation: orientation,
          showNotation: false,
          animationDurationInMs: 200,
          allowDrawingArrows: false,
          arrows: props.review?.best
            ? [{ startSquare: props.review.best.from, endSquare: props.review.best.to, color: '#62A05A' }]
            : [],
          arrowOptions: { ...defaultArrowOptions, opacity: 0.8 },
          allowDragOffBoard: false,
          allowAutoScroll: false,
          dragActivationDistance: 4,
          boardStyle: { width: size, height: size },
          lightSquareStyle: { backgroundColor: '#E2BE8A' },
          darkSquareStyle: { backgroundColor: '#8E5A33' },
          dropSquareStyle: {},
          draggingPieceGhostStyle: { opacity: 0.35 },
          canDragPiece: ({ piece }) => interactive && !promotion && piece.pieceType[0] === playerColor,
          onPieceDrag: ({ square }) => {
            if (square) setSelected(square as Square);
          },
          onPieceDragCancel: () => setSelected(null),
          onPieceDrop,
          onSquareClick,
          squareRenderer,
        }}
      />
      {promotion && (
        <PromotionPicker
          to={promotion.to}
          orientation={orientation}
          color={playerColor}
          onPick={(p) => {
            const { from, to } = promotion;
            setPromotion(null);
            onMove(from + to + p);
          }}
          onCancel={() => setPromotion(null)}
        />
      )}
    </div>
  );

  const ranks = orientation === 'white' ? '87654321' : '12345678';
  const files = orientation === 'white' ? FILES : [...FILES].reverse().join('');

  return (
    <div
      className={`board-frame ${props.coordinates === 'gutter' ? 'board-frame-gutter' : 'board-frame-phone'}`}
      role="group"
      aria-label={props.ariaLabel}
    >
      {props.coordinates === 'gutter' ? (
        <>
          <div className="gutter-ranks" aria-hidden="true">
            {props.showCoordinates && [...ranks].map((r) => <span key={r}>{r}</span>)}
          </div>
          {board}
          <div />
          <div className="gutter-files" aria-hidden="true">
            {props.showCoordinates && [...files].map((f) => <span key={f}>{f}</span>)}
          </div>
        </>
      ) : (
        board
      )}
    </div>
  );
}

function PromotionPicker({
  to,
  orientation,
  color,
  onPick,
  onCancel,
}: {
  to: Square;
  orientation: Orientation;
  color: 'w' | 'b';
  onPick: (p: string) => void;
  onCancel: () => void;
}) {
  const { col, row } = viewPos(to, orientation);
  const downward = row === 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="promo-layer" onClick={onCancel}>
      <div
        className="promo"
        role="dialog"
        aria-label="Promote to"
        style={{
          left: `${col * 12.5}%`,
          top: downward ? 0 : 'auto',
          bottom: downward ? 'auto' : 0,
          flexDirection: downward ? 'column' : 'column-reverse',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {PROMOTION_PIECES.map((p, i) => {
          const render = defaultPieces[`${color}${p.toUpperCase()}`];
          return (
            <button
              key={p}
              type="button"
              className="promo-btn"
              aria-label={`Promote to ${PIECE_NAME[p]}`}
              autoFocus={i === 0}
              onClick={() => onPick(p)}
            >
              {render?.()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
