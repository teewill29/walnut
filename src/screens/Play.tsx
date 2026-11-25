import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Board } from '../components/board/Board';
import { GameOverPanel } from '../components/play/GameOverPanel';
import { LevelPicker } from '../components/play/LevelPicker';
import { MoveChips, MoveTable } from '../components/play/Moves';
import { BotStrip, YouStrip } from '../components/play/PlayerStrip';
import { ConfirmSheet, Sheet } from '../components/Sheet';
import { controller, usePlay, type PlayState } from '../chess/controller';
import { openingLabel } from '../chess/openings';
import { setSetting, useSettings, type SideChoice } from '../db/settings';
import type { Level } from '../db/types';
import { setNewGameOpen, useNewGameOpen } from '../lib/playUi';
import { DESKTOP_QUERY, TABLET_UP_QUERY, useMediaQuery } from '../lib/useMediaQuery';

type Pending = { kind: 'resign' } | { kind: 'abandon'; level: Level; side: SideChoice } | null;

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function botStatus(s: PlayState): 'thinking' | 'waiting' | 'over' | 'error' {
  if (s.over) return 'over';
  if (s.engineError) return 'error';
  if (s.botThinking || (s.game && s.turn !== s.game.playerColor)) return 'thinking';
  return 'waiting';
}

export function PlayScreen() {
  const s = usePlay();
  const settings = useSettings();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const tabletUp = useMediaQuery(TABLET_UP_QUERY);
  const newGameOpen = useNewGameOpen();
  const [pending, setPending] = useState<Pending>(null);

  useEffect(() => {
    controller.start();
  }, []);

  const game = s.game;
  if (!game) {
    return (
      <div className="play-loading" aria-busy="true">
        <p className="muted">Setting up the board…</p>
      </div>
    );
  }

  const player = game.playerColor;
  const orientation = (player === 'w') !== s.flipped ? 'white' : 'black';
  const inProgress = game.status === 'in_progress';
  const interactive = inProgress && !s.botThinking && s.turn === player && !s.loading;

  const startNewGame = (level: Level, side: SideChoice) => {
    setNewGameOpen(false);
    if (controller.hasGameInProgress) setPending({ kind: 'abandon', level, side });
    else controller.newGame(level, side);
  };

  const onResign = () => {
    if (settings.confirmResign) setPending({ kind: 'resign' });
    else controller.resign();
  };

  const onGameOverNewGame = () => {
    controller.setOverPanelOpen(false);
    if (desktop) controller.newGame(settings.lastLevel, settings.lastSide);
    else setNewGameOpen(true);
  };

  const boardProps = {
    id: 'play-board',
    fen: s.fen,
    orientation,
    playerColor: player,
    interactive,
    lastMove: s.lastMove,
    checkSquare: s.checkSquare,
    showDots: settings.legalDots,
    showCoordinates: settings.coordinates,
    onMove: (uci: string) => controller.playerMove(uci),
    ariaLabel: `Chess board. You play ${player === 'w' ? 'White' : 'Black'}.`,
  } as const;

  const status = botStatus(s);

  const actions = {
    canTakeBack: controller.canTakeBack,
    takeBack: () => controller.takeBack(),
    flip: () => controller.flip(),
    resign: onResign,
    canResign: inProgress,
  };

  return (
    <>
      {desktop ? (
        <DesktopPlay s={s} status={status} boardProps={boardProps} actions={actions} onStart={startNewGame} />
      ) : (
        <PhonePlay s={s} status={status} boardProps={boardProps} actions={actions} framed={tabletUp} />
      )}

      <div className="visually-hidden" aria-live="polite">
        {s.announcement}
      </div>

      {newGameOpen && !desktop && (
        <NewGameSheet
          initialLevel={settings.lastLevel}
          initialSide={settings.lastSide}
          onStart={startNewGame}
          onClose={() => setNewGameOpen(false)}
        />
      )}

      {s.over && s.overPanelOpen && (
        <GameOverPanel
          gameId={game.id}
          moveCount={game.moves.length}
          text={s.over.text}
          onNewGame={onGameOverNewGame}
          onClose={() => controller.setOverPanelOpen(false)}
        />
      )}

      {pending?.kind === 'resign' && (
        <ConfirmSheet
          title="Resign this game?"
          confirmLabel="Resign"
          cancelLabel="Keep playing"
          danger
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setPending(null);
            controller.resign();
          }}
        />
      )}

      {pending?.kind === 'abandon' && (
        <ConfirmSheet
          title="Abandon the current game?"
          body="It will be saved as unfinished."
          confirmLabel="Abandon and start"
          cancelLabel="Keep playing"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const { level, side } = pending;
            setPending(null);
            controller.newGame(level, side);
          }}
        />
      )}
    </>
  );
}

type BoardBase = Omit<Parameters<typeof Board>[0], 'size' | 'coordinates'>;

interface Actions {
  canTakeBack: boolean;
  takeBack: () => void;
  flip: () => void;
  resign: () => void;
  canResign: boolean;
}

interface LayoutProps {
  s: PlayState;
  status: ReturnType<typeof botStatus>;
  boardProps: BoardBase;
  actions: Actions;
}

// Frame padding around the squares: phone 5px each side; gutter frame 18+14+8 left, 26 right,
// 22 top, 8+~16+18 bottom (DESIGN.md / Main.dc.html).
const PHONE_FRAME = 10;
const MIN_BOARD = 240;
const GUTTER_X = 18 + 14 + 8 + 26;
const GUTTER_Y = 22 + 8 + 16 + 18;

function PhonePlay({ s, status, boardProps, actions, framed }: LayoutProps & { framed: boolean }) {
  const game = s.game!;
  const padX = framed ? GUTTER_X : PHONE_FRAME;
  const padY = framed ? GUTTER_Y : PHONE_FRAME;
  const wrapRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);

  // Board size = min(width, height left after everything else on the screen, 600)
  // (DESIGN.md → Board size), so the whole Play screen fits without scrolling.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const cs = getComputedStyle(wrap);
      const innerW = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const screenH = wrap.parentElement?.clientHeight ?? wrap.clientHeight;
      const innerH = screenH - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const gap = parseFloat(cs.rowGap) || 0;
      let chrome = 0;
      for (const child of Array.from(wrap.children) as HTMLElement[]) {
        if (child !== slotRef.current) chrome += child.offsetHeight;
      }
      chrome += gap * (wrap.children.length - 1);
      const byWidth = Math.min(innerW - padX, 600);
      // Never smaller than MIN_BOARD (e.g. phone landscape): the screen scrolls instead.
      const next = Math.floor(Math.max(Math.min(byWidth, MIN_BOARD), Math.min(byWidth, innerH - chrome - padY)));
      setSize((prev) => (prev === next ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    if (wrap.parentElement) ro.observe(wrap.parentElement);
    return () => ro.disconnect();
  }, [padX, padY, s.engineError]);

  return (
    <div className={`play-phone ${framed ? 'play-tablet' : ''}`} ref={wrapRef}>
      <BotStrip level={game.level} color={game.playerColor === 'w' ? 'b' : 'w'} status={status} variant="phone" />
      {s.engineError && <EngineError text={s.engineError} />}
      <div className="board-slot" ref={slotRef}>
        {size > 120 && <Board {...boardProps} size={size} coordinates={framed ? 'gutter' : 'inside'} />}
      </div>
      <YouStrip color={game.playerColor} yourMove={status === 'waiting'} variant="phone" />
      <MoveChips sans={s.sans} />
      <div className="action-row">
        <button type="button" className="btn btn-tile" onClick={actions.takeBack} disabled={!actions.canTakeBack}>
          Take back
        </button>
        <button type="button" className="btn btn-tile" onClick={actions.flip} aria-pressed={s.flipped}>
          Flip
        </button>
        <button type="button" className="btn btn-tile btn-tile-danger" onClick={actions.resign} disabled={!actions.canResign}>
          Resign
        </button>
      </div>
    </div>
  );
}

function DesktopPlay({
  s,
  status,
  boardProps,
  actions,
  onStart,
}: LayoutProps & { onStart: (level: Level, side: SideChoice) => void }) {
  const game = s.game!;
  const settings = useSettings();
  const [colRef, col] = useSize<HTMLElement>();
  const size = Math.floor(Math.max(0, Math.min(576, col.w - GUTTER_X)));

  return (
    <div className="play-desktop">
      <section className="play-board-col" aria-label="Game" ref={colRef}>
        <BotStrip level={game.level} color={game.playerColor === 'w' ? 'b' : 'w'} status={status} variant="desktop" />
        {s.engineError && <EngineError text={s.engineError} />}
        {size > 120 && <Board {...boardProps} size={size} coordinates="gutter" />}
        <YouStrip color={game.playerColor} yourMove={status === 'waiting'} variant="desktop" />
      </section>

      <aside className="play-side">
        <section className="card card-pad" aria-labelledby="opponent-title">
          <h2 id="opponent-title" className="card-title">
            Opponent
          </h2>
          <p className="muted card-note">Changes apply to your next game.</p>
          <LevelPicker
            level={settings.lastLevel}
            side={settings.lastSide}
            onLevel={(l) => setSetting('lastLevel', l)}
            onSide={(sd) => setSetting('lastSide', sd)}
          />
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => onStart(settings.lastLevel, settings.lastSide)}
          >
            Start new game
          </button>
        </section>

        <section className="card card-pad moves-card" aria-labelledby="moves-title">
          <div className="card-head">
            <h2 id="moves-title" className="card-title">
              Moves
            </h2>
            {s.opening && <span className="muted opening-name">{openingLabel(s.opening.name)}</span>}
          </div>
          <MoveTable sans={s.sans} />
          <div className="moves-actions">
            <button type="button" className="btn btn-secondary" onClick={actions.takeBack} disabled={!actions.canTakeBack}>
              Take back
            </button>
            <button type="button" className="btn btn-secondary" onClick={actions.flip} aria-pressed={s.flipped}>
              Flip board
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-danger-outline push-right"
              onClick={actions.resign}
              disabled={!actions.canResign}
            >
              Resign
            </button>
          </div>
          <p className="muted small">Every move is logged. Review opens when the game ends.</p>
        </section>
      </aside>
    </div>
  );
}

function EngineError({ text }: { text: string }) {
  return (
    <div className="engine-error" role="alert">
      <span>{text}</span>
      <button type="button" className="btn btn-secondary" onClick={() => controller.retryBot()}>
        Try again
      </button>
    </div>
  );
}

function NewGameSheet({
  initialLevel,
  initialSide,
  onStart,
  onClose,
}: {
  initialLevel: Level;
  initialSide: SideChoice;
  onStart: (level: Level, side: SideChoice) => void;
  onClose: () => void;
}) {
  const [level, setLevel] = useState(initialLevel);
  const [side, setSide] = useState(initialSide);
  return (
    <Sheet title="New game" onClose={onClose} className="sheet-newgame">
      <LevelPicker level={level} side={side} onLevel={setLevel} onSide={setSide} />
      <button type="button" className="btn btn-primary btn-block" onClick={() => onStart(level, side)}>
        Start new game
      </button>
    </Sheet>
  );
}
