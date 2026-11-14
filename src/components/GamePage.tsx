import './GamePage.css';
import { useEffect, useMemo, useState } from 'react';
import { claimableDraw, chooseCpuMove, gameStatus, initialPosition, legalMoves, makeMove, moveText, pieceColor, PIECES, squareName, type Move, type Position } from '../lib/chess';

type Mode = 'cpu' | 'local';
type Theme = 'starry' | 'sakura' | 'sea';
type Clock = { white: number; black: number };

const START_SECONDS: Record<string, number> = { '1 min': 60, '3 min': 180, '10 min': 600, '30 min': 1800 };
const formatClock = (seconds: number) => Math.floor(Math.max(0, seconds) / 60) + ':' + String(Math.max(0, seconds) % 60).padStart(2, '0');

export default function GamePage({ onBack, onOnline }: { onBack: () => void; onOnline: () => void }) {
  const [mode, setMode] = useState<Mode>('cpu');
  const [timeControl, setTimeControl] = useState('10 min');
  const [history, setHistory] = useState<Position[]>([initialPosition()]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<Move[] | null>(null);
  const [clock, setClock] = useState<Clock>({ white: 600, black: 600 });
  const [clockStarted, setClockStarted] = useState(false);
  const [finishedText, setFinishedText] = useState('');
  const [claimedDraw, setClaimedDraw] = useState('');
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState<Theme>(() => {
    try { const saved = localStorage.getItem('chessgay:theme'); return saved === 'sakura' || saved === 'sea' ? saved : 'starry'; }
    catch { return 'starry'; }
  });
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('chessgay:theme', theme); } catch { /* storage can be unavailable */ }
  }, [theme]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('chessgay:board-style') || 'null') as { light?: string; dark?: string } | null;
      if (saved?.light && saved?.dark) {
        document.documentElement.style.setProperty('--board-light', saved.light);
        document.documentElement.style.setProperty('--board-dark', saved.dark);
      }
    } catch { /* ignore invalid local board preferences */ }
  }, []);

  const position = history[history.length - 1];
  const status = useMemo(() => gameStatus(history), [history]);
  const ended = status.done || finishedText !== '' || claimedDraw !== '';
  const legal = useMemo(() => legalMoves(position), [position]);
  const destinations = selected === null ? [] : legal.filter(move => move.from === selected).map(move => move.to);


  function restart(nextMode = mode, nextTime = timeControl) {
    setMode(nextMode);
    setTimeControl(nextTime);
    setHistory([initialPosition()]);
    setMoves([]);
    setSelected(null);
    setPromotion(null);
    setClock({ white: START_SECONDS[nextTime], black: START_SECONDS[nextTime] });
    setClockStarted(false);
    setFinishedText('');
    setClaimedDraw('');
    setMessage('');
    setFlipped(false);
  }

  function commit(move: Move) {
    if (ended) return;
    try {
      const next = makeMove(position, move);
      setHistory(current => [...current, next]);
      setMoves(current => [...current, move]);
      setSelected(null);
      setPromotion(null);
      setMessage('');
      setClockStarted(true);
    } catch {
      setMessage('That move is not legal.');
    }
  }

  function clickSquare(square: number) {
    if (ended || promotion || (mode === 'cpu' && position.turn === -1)) return;
    const ownPiece = pieceColor(position.board[square]) === position.turn;
    if (selected !== null) {
      const candidates = legal.filter(move => move.from === selected && move.to === square);
      if (candidates.length > 1) { setPromotion(candidates); return; }
      if (candidates.length === 1) { commit(candidates[0]); return; }
      if (ownPiece) { setSelected(square); setMessage(''); return; }
      setSelected(null);
      setMessage('Choose one of the highlighted legal squares.');
      return;
    }
    if (ownPiece) { setSelected(square); setMessage(''); }
  }

  useEffect(() => {
    if (mode !== 'cpu' || position.turn !== -1 || ended || moves.length === 0) return;
    const timer = window.setTimeout(() => {
      const move = chooseCpuMove(position);
      if (!move) return;
      try {
        const next = makeMove(position, move);
        setHistory(current => [...current, next]);
        setMoves(current => [...current, move]);
        setSelected(null);
      } catch {
        setMessage('The CPU could not complete its move. Restart the game.');
      }
    }, 520);
    return () => window.clearTimeout(timer);
  }, [mode, position, ended, moves.length]);

  useEffect(() => {
    if (!clockStarted || ended) return;
    const timer = window.setInterval(() => {
      const side = position.turn === 1 ? 'white' : 'black';
      setClock(current => {
        const next = Math.max(0, current[side] - 1);
        if (next === 0) setFinishedText((side === 'white' ? 'Black' : 'White') + ' wins on time.');
        return { ...current, [side]: next };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [clockStarted, ended, position.turn]);

  const displayStatus = claimedDraw ? 'Draw claimed — ' + claimedDraw + '.' : finishedText || status.text;
  const drawClaim = claimableDraw(history);

  function undo() {
    if (moves.length === 0) return;
    const count = mode === 'cpu' && position.turn === 1 && moves.length >= 2 ? 2 : 1;
    setHistory(current => current.slice(0, -count));
    setMoves(current => current.slice(0, -count));
    setSelected(null);
    setPromotion(null);
    setFinishedText('');
    setClaimedDraw('');
    setMessage('Last move undone. Clocks are not rewound.');
  }

  function resign() {
    if (ended) return;
    setFinishedText((position.turn === 1 ? 'Black' : 'White') + ' wins by resignation.');
    setMessage((position.turn === 1 ? 'White' : 'Black') + ' resigned.');
  }

  return (
    <section className="app-page live-game-page">
      <div className="game-page-toolbar">
        <div className="game-toolbar-actions"><button className="back-link" onClick={onBack}>← BACK TO THE GAME ROOM</button><button className="online-lobby-link" onClick={onOnline}>ONLINE LOBBIES ↗</button></div>
        <div className="theme-switcher" aria-label="Choose visual theme">
          <span>THEME</span>
          {(['starry', 'sakura', 'sea'] as Theme[]).map(option => <button key={option} className={theme === option ? 'theme-chip active' : 'theme-chip'} onClick={() => setTheme(option)}>{option === 'starry' ? '✦ Starry' : option === 'sakura' ? '✿ Sakura' : '≈ Deep sea'}</button>)}
        </div>
      </div>
      <div className="game-page-heading">
        <div><div className="eyebrow"><span className="eyebrow-line" /> THE BOARD IS YOURS</div><h1>Play <em>chess.</em></h1><p>Real legal moves. Real checkmate. No pretend opponents.</p></div>
        <div className="game-live-tag"><span /> LOCAL GAME · PLAYABLE NOW</div>
      </div>

      <div className="game-layout">
        <div className="game-board-column">
          <div className="game-player-strip">
            <span className="game-avatar black-avatar">♚</span>
            <div className="game-player-name"><strong>{mode === 'cpu' ? 'The House CPU' : 'Black'}</strong><small>{mode === 'cpu' ? 'BASIC CPU · CAPTURES & CHECKS' : 'PLAYER TWO'}</small></div>
            <strong className={position.turn === -1 && clockStarted ? 'game-clock active' : 'game-clock'}>{formatClock(clock.black)}</strong>
          </div>
          <div className="playable-board" role="grid" aria-label="Playable chess board">
            {Array.from({ length: 64 }, (_, index) => {
              const row = Math.floor(index / 8);
              const file = index % 8;
              const boardRow = flipped ? 7 - row : row;
              const boardFile = flipped ? 7 - file : file;
              const square = boardRow * 16 + boardFile;
              const piece = position.board[square];
              const legalTarget = destinations.includes(square);
              const last = moves[moves.length - 1];
              const isLast = Boolean(last && (last.from === square || last.to === square));
              const isSelected = selected === square;
              return <button
                type="button"
                role="gridcell"
                key={square}
                className={['playable-square', (row + file) % 2 === 0 ? 'light-square' : 'dark-square', isSelected ? 'selected-square' : '', isLast ? 'last-square' : '', legalTarget ? 'legal-square' : ''].filter(Boolean).join(' ')}
                onClick={() => clickSquare(square)}
                aria-label={squareName(square) + (piece !== '.' ? ' ' + piece : '')}
                disabled={ended || Boolean(promotion) || (mode === 'cpu' && position.turn === -1)}
              >
                {(file === 0) && <span className="rank-coordinate">{8 - boardRow}</span>}
                {(row === 7) && <span className="file-coordinate">{'abcdefgh'[boardFile]}</span>}
                {piece !== '.' && <span className={'game-piece ' + (pieceColor(piece) === 1 ? 'white-game-piece' : 'black-game-piece')}>{PIECES[piece]}</span>}
                {legalTarget && <span className={piece === '.' ? 'legal-dot' : 'legal-capture'} />}
              </button>;
            })}
          </div>
          <div className="game-player-strip bottom-player-strip">
            <span className="game-avatar white-avatar">♔</span>
            <div className="game-player-name"><strong> {mode === 'cpu' ? 'You · White' : 'White'}</strong><small>{position.turn === 1 ? 'YOUR TURN' : mode === 'cpu' ? 'CPU THINKING' : 'PLAYER ONE'}</small></div>
            <strong className={position.turn === 1 && clockStarted ? 'game-clock active' : 'game-clock'}>{formatClock(clock.white)}</strong>
          </div>
          {promotion && <div className="promotion-picker"><strong>Choose promotion</strong>{promotion.map(option => <button key={option.promotion} onClick={() => commit(option)}>{PIECES[position.turn === 1 ? (option.promotion || 'q').toUpperCase() : option.promotion || 'q']}</button>)}</div>}
        </div>

        <aside className="game-control-panel">
          <div className="game-status-card"><span className="dashboard-kicker">LIVE POSITION</span><strong>{displayStatus}</strong><small>{moves.length} half-moves played · {mode === 'cpu' ? 'You are White' : 'Pass the device after each move'}</small></div>
          <div className="game-settings-card">
            <span className="dashboard-kicker">GAME TYPE</span>
            <div className="game-toggle-row"><button className={mode === 'cpu' ? 'selected' : ''} onClick={() => restart('cpu')}>VS CPU</button><button className={mode === 'local' ? 'selected' : ''} onClick={() => restart('local')}>PASS & PLAY</button></div>
            <label htmlFor="game-time">TIME CONTROL</label>
            <select id="game-time" value={timeControl} onChange={event => restart(mode, event.target.value)}>{Object.keys(START_SECONDS).map(time => <option key={time}>{time}</option>)}</select>
            <div className="game-action-grid">
              <button onClick={() => restart()}>↻ RESTART</button>
              <button onClick={undo} disabled={moves.length === 0}>↶ UNDO</button>
              <button onClick={() => setFlipped(value => !value)}>⇅ FLIP BOARD</button>
              <button onClick={resign} disabled={ended}>⚑ RESIGN</button>
            </div>
            <button className="game-primary-button" onClick={() => restart()}>NEW GAME</button>
          </div>
          <div className="move-history-card">
            <div className="move-history-heading"><span className="dashboard-kicker">MOVE HISTORY</span><span>{moves.length}</span></div>
            {moves.length === 0 ? <p className="empty-moves">The first move is yours.</p> : <ol>{moves.map((move, index) => <li key={index}><span>{Math.floor(index / 2) + 1}{index % 2 === 0 ? '.' : '...'}</span><strong>{moveText(move)}</strong></li>)}</ol>}
            {drawClaim && !ended && <button className="draw-claim-button" onClick={() => { setClaimedDraw(drawClaim); setMessage('Draw claimed by ' + drawClaim + '.'); }}>CLAIM DRAW · {drawClaim.toUpperCase()}</button>}
          </div>
          {message && <p className="game-message" role="status">{message}</p>}
        </aside>
      </div>
      <p className="game-disclaimer">This is a local playable chess game. Online matchmaking, private lobbies, four-player chess and a stronger Stockfish opponent are separate upcoming implementations.</p>
    </section>
  );
}
