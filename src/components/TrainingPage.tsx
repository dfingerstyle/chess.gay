import { useMemo, useState } from 'react';
import { gameStatus, legalMoves, makeMove, PIECES, pieceColor, squareName, squareIndex, type Position } from '../lib/chess';
import './TrainingPage.css';

const SOLUTION = 'g6g7';
const PUZZLE_KEY = 'chessgay:training:mate-in-one-001';

function startingPuzzle(): Position {
  const board = Array(128).fill('.');
  board[squareIndex('f6')] = 'K';
  board[squareIndex('g6')] = 'Q';
  board[squareIndex('h8')] = 'k';
  return { board, turn: 1, castling: 0, ep: -1, halfmove: 0, fullmove: 1 };
}

function solvedPuzzle(): Position {
  return makeMove(startingPuzzle(), { from: squareIndex('g6'), to: squareIndex('g7') });
}

function wasSolved(): boolean {
  try { return localStorage.getItem(PUZZLE_KEY) === 'solved'; }
  catch { return false; }
}

export default function TrainingPage({ onBack, onPlayChess }: { onBack: () => void; onPlayChess: () => void }) {
  const [position, setPosition] = useState<Position>(() => wasSolved() ? solvedPuzzle() : startingPuzzle());
  const [selected, setSelected] = useState<number | null>(null);
  const [solved, setSolved] = useState(wasSolved);
  const [hintLevel, setHintLevel] = useState(0);
  const [message, setMessage] = useState('');
  const legal = useMemo(() => legalMoves(position), [position]);
  const destinations = selected === null ? [] : legal.filter(move => move.from === selected).map(move => move.to);
  const status = gameStatus([startingPuzzle(), position]);

  function chooseSquare(square: number) {
    if (solved) return;
    const piece = position.board[square];
    if (selected !== null) {
      const candidate = legal.find(move => move.from === selected && move.to === square);
      if (candidate) {
        const uci = squareName(candidate.from) + squareName(candidate.to) + (candidate.promotion || '');
        if (uci === SOLUTION) {
          setPosition(makeMove(position, candidate));
          setSolved(true);
          setSelected(null);
          setMessage('Checkmate. You found the winning move.');
          try { localStorage.setItem(PUZZLE_KEY, 'solved'); } catch { /* progress remains available for this session */ }
          return;
        }
        setMessage('That move is legal, but it does not finish the puzzle. Look for checkmate.');
        setSelected(null);
        return;
      }
    }
    if (pieceColor(piece) === 1) {
      setSelected(square);
      setMessage('');
    } else {
      setSelected(null);
    }
  }

  function resetPuzzle() {
    setPosition(startingPuzzle());
    setSelected(null);
    setSolved(false);
    setHintLevel(0);
    setMessage('');
    try { localStorage.removeItem(PUZZLE_KEY); } catch { /* ignore unavailable storage */ }
  }

  return (
    <section className="app-page training-page">
      <div className="activity-toolbar">
        <button className="back-link" onClick={onBack}>← BACK TO YOUR GAME ROOM</button>
        <span className="activity-kicker">THE STUDY · PUZZLES & LEARNING</span>
      </div>
      <div className="app-page-heading">
        <div className="eyebrow"><span className="eyebrow-line" /> GET SHARPER, ONE MOVE AT A TIME</div>
        <h1>Think one move <em>ahead.</em></h1>
        <p>Train your pattern recognition with real legal positions. Start with a forcing move, then build toward deeper calculation.</p>
      </div>

      <div className="training-layout">
        <section className="training-puzzle-card">
          <div className="training-card-topline">
            <div><span className="dashboard-kicker">TACTICAL PUZZLE 001</span><h2>Mate in one</h2></div>
            <span className={solved ? 'training-state solved' : 'training-state'}>{solved ? 'SOLVED' : 'WHITE TO MOVE'}</span>
          </div>
          <p className="training-instruction">White to move. Find the one move that checkmates the black king.</p>
          <div className="training-board" role="grid" aria-label="Chess puzzle board">
            {Array.from({ length: 64 }, (_, index) => {
              const row = Math.floor(index / 8);
              const file = index % 8;
              const square = row * 16 + file;
              const piece = position.board[square];
              const target = destinations.includes(square);
              const isSelected = selected === square;
              return <button
                type="button"
                role="gridcell"
                key={square}
                className={['training-square', (row + file) % 2 === 0 ? 'training-light' : 'training-dark', isSelected ? 'is-selected' : '', target ? 'is-target' : ''].filter(Boolean).join(' ')}
                onClick={() => chooseSquare(square)}
                aria-label={squareName(square) + (piece !== '.' ? ' ' + piece : '')}
                disabled={solved}
              >
                {file === 0 && <span className="training-coordinate">{8 - row}</span>}
                {row === 7 && <span className="training-coordinate file">{'abcdefgh'[file]}</span>}
                {piece !== '.' && <span className={pieceColor(piece) === 1 ? 'training-white-piece' : 'training-black-piece'}>{PIECES[piece]}</span>}
                {target && <span className="training-dot" />}
              </button>;
            })}
          </div>
          <div className="training-board-footer"><span>♔ WHITE</span><span>♚ BLACK</span><span>NO CLOCK · TAKE YOUR TIME</span></div>
          <div className="training-feedback" role="status">
            {solved ? <><strong>✦ CHECKMATE</strong><span>{status.text} The queen is protected by the white king.</span></> : <><strong>{message || 'YOUR MOVE'}</strong><span>{message ? 'Try again. The position has not changed.' : 'Select a white piece, then choose its destination.'}</span></>}
          </div>
        </section>

        <aside className="training-side-panel">
          <div className="training-side-card">
            <span className="dashboard-kicker">THE CHALLENGE</span>
            <h3>Find the forcing move.</h3>
            <p>The black king is boxed in. Your queen can deliver checkmate, but only if you spot the right square.</p>
            <div className="training-hint">
              <span>HINT {hintLevel}/2</span>
              <p>{hintLevel === 0 ? 'Hints are available if you get stuck.' : hintLevel === 1 ? 'Look for a queen move that gives check next to the king.' : 'Move the queen from g6 to g7.'}</p>
              {!solved && hintLevel < 2 && <button onClick={() => setHintLevel(level => level + 1)}>REVEAL {hintLevel === 0 ? 'FIRST' : 'FINAL'} HINT ↗</button>}
            </div>
            <div className="training-actions">
              <button className="training-primary" onClick={onPlayChess}>PLAY A FULL GAME ↗</button>
              <button className="training-secondary" onClick={resetPuzzle}>RESET PUZZLE ↻</button>
            </div>
          </div>
          <div className="training-side-card training-principles">
            <span className="dashboard-kicker">THREE PRINCIPLES</span>
            <article><b>01</b><div><strong>Checks first</strong><p>Look for forcing moves before quiet plans.</p></div></article>
            <article><b>02</b><div><strong>Count defenders</strong><p>A protected checking square can decide the game.</p></div></article>
            <article><b>03</b><div><strong>Calculate replies</strong><p>Do not stop at the first check. Find the opponent's legal escapes.</p></div></article>
          </div>
        </aside>
      </div>
      <p className="training-honesty">This is the first curated training position. Puzzle ratings, daily rotation, courses and engine analysis will be added as their own tested systems—not simulated with placeholder results.</p>
    </section>
  );
}
