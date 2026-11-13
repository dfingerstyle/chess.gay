export type Color = 1 | -1;
export type Move = { from: number; to: number; promotion?: 'q' | 'r' | 'b' | 'n'; flag?: 'ep' | 'castle' };
export type Position = {
  board: string[];
  turn: Color;
  castling: number;
  ep: number;
  halfmove: number;
  fullmove: number;
};
export type GameStatus = {
  done: boolean;
  text: string;
  winner: Color | null;
  drawClaim: 'threefold repetition' | '50-move rule' | null;
};

const KNIGHT = [-33, -31, -18, -14, 14, 18, 31, 33];
const BISHOP = [-17, -15, 15, 17];
const ROOK = [-16, -1, 1, 16];
const KING = [-17, -16, -15, -1, 1, 15, 16, 17];
const VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const ROOK_RIGHT: Record<number, number> = { 119: 1, 112: 2, 7: 4, 0: 8 };

export const PIECES: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎', '.': '',
};

const onBoard = (square: number) => square >= 0 && square < 128 && (square & 0x88) === 0;
export const pieceColor = (piece: string): Color | 0 => !piece || piece === '.' ? 0 : piece === piece.toUpperCase() ? 1 : -1;
export const squareName = (square: number) => 'abcdefgh'[square & 7] + String(8 - (square >> 4));
export const squareIndex = (name: string) => (8 - Number(name[1])) * 16 + 'abcdefgh'.indexOf(name[0]);

export function initialPosition(): Position {
  const board = Array(128).fill('.');
  const back = 'rnbqkbnr';
  for (let file = 0; file < 8; file++) {
    board[file] = back[file];
    board[16 + file] = 'p';
    board[96 + file] = 'P';
    board[112 + file] = back[file].toUpperCase();
  }
  return { board, turn: 1, castling: 15, ep: -1, halfmove: 0, fullmove: 1 };
}

export function isAttacked(position: Position, target: number, by: Color): boolean {
  const { board } = position;
  for (let from = 0; from < 128; from++) {
    if (!onBoard(from) || pieceColor(board[from]) !== by) continue;
    const kind = board[from].toLowerCase();
    if (kind === 'p') {
      if (target === from - 16 * by - 1 || target === from - 16 * by + 1) return true;
      continue;
    }
    const directions = kind === 'n' ? KNIGHT : kind === 'b' ? BISHOP : kind === 'r' ? ROOK : kind === 'q' ? [...BISHOP, ...ROOK] : KING;
    for (const direction of directions) {
      for (let to = from + direction; onBoard(to); to += direction) {
        if (to === target) return true;
        if (board[to] !== '.' || kind === 'n' || kind === 'k') break;
      }
    }
  }
  return false;
}

export function isInCheck(position: Position, color: Color = position.turn): boolean {
  const king = position.board.findIndex((piece, index) => onBoard(index) && piece === (color === 1 ? 'K' : 'k'));
  return king < 0 || isAttacked(position, king, color === 1 ? -1 : 1);
}

function applyUnchecked(position: Position, move: Move): Position {
  const board = position.board.slice();
  const moving = board[move.from];
  const captured = board[move.to];
  let castling = position.castling;
  board[move.from] = '.';
  board[move.to] = move.promotion ? (position.turn === 1 ? move.promotion.toUpperCase() : move.promotion) : moving;
  if (move.flag === 'ep') board[move.to + 16 * position.turn] = '.';
  if (move.flag === 'castle') {
    const rookFrom = move.to > move.from ? move.from + 3 : move.from - 4;
    const rookTo = move.to > move.from ? move.from + 1 : move.from - 1;
    board[rookTo] = board[rookFrom];
    board[rookFrom] = '.';
  }
  if (moving === 'K') castling &= ~3;
  if (moving === 'k') castling &= ~12;
  if (moving.toLowerCase() === 'r') castling &= ~(ROOK_RIGHT[move.from] || 0);
  if (captured.toLowerCase() === 'r') castling &= ~(ROOK_RIGHT[move.to] || 0);
  const isPawn = moving.toLowerCase() === 'p';
  const isCapture = captured !== '.' || move.flag === 'ep';
  return {
    board,
    turn: position.turn === 1 ? -1 : 1,
    castling,
    ep: isPawn && Math.abs(move.to - move.from) === 32 ? (move.to + move.from) / 2 : -1,
    halfmove: isPawn || isCapture ? 0 : position.halfmove + 1,
    fullmove: position.fullmove + (position.turn === -1 ? 1 : 0),
  };
}

function pseudoMoves(position: Position): Move[] {
  const moves: Move[] = [];
  const { board, turn } = position;
  const add = (from: number, to: number, flag?: Move['flag']) => {
    if (board[to].toLowerCase() === 'k') return;
    if (board[from].toLowerCase() === 'p' && ((to >> 4) === 0 || (to >> 4) === 7)) {
      for (const promotion of ['q', 'r', 'b', 'n'] as const) moves.push({ from, to, promotion, flag });
    } else moves.push({ from, to, flag });
  };

  for (let from = 0; from < 128; from++) {
    if (!onBoard(from) || pieceColor(board[from]) !== turn) continue;
    const kind = board[from].toLowerCase();
    if (kind === 'p') {
      const one = from - 16 * turn;
      if (onBoard(one) && board[one] === '.') {
        add(from, one);
        const two = one - 16 * turn;
        const startRank = turn === 1 ? 6 : 1;
        if ((from >> 4) === startRank && board[two] === '.') add(from, two);
      }
      for (const fileStep of [-1, 1]) {
        const to = one + fileStep;
        if (!onBoard(to)) continue;
        if (pieceColor(board[to]) === -turn) add(from, to);
        else if (to === position.ep && board[to] === '.' && board[to + 16 * turn] === (turn === 1 ? 'p' : 'P')) add(from, to, 'ep');
      }
      continue;
    }

    const directions = kind === 'n' ? KNIGHT : kind === 'b' ? BISHOP : kind === 'r' ? ROOK : kind === 'q' ? [...BISHOP, ...ROOK] : KING;
    for (const direction of directions) {
      for (let to = from + direction; onBoard(to); to += direction) {
        if (pieceColor(board[to]) === turn) break;
        add(from, to);
        if (board[to] !== '.' || kind === 'n' || kind === 'k') break;
      }
    }

    const home = turn === 1 ? 116 : 4;
    const rook = turn === 1 ? 'R' : 'r';
    const rights = turn === 1 ? [1, 2] : [4, 8];
    if (kind === 'k' && from === home && !isInCheck(position)) {
      if ((position.castling & rights[0]) && board[from + 3] === rook && board[from + 1] === '.' && board[from + 2] === '.' &&
        !isAttacked(position, from + 1, -turn as Color) && !isAttacked(position, from + 2, -turn as Color)) add(from, from + 2, 'castle');
      if ((position.castling & rights[1]) && board[from - 4] === rook && board[from - 1] === '.' && board[from - 2] === '.' && board[from - 3] === '.' &&
        !isAttacked(position, from - 1, -turn as Color) && !isAttacked(position, from - 2, -turn as Color)) add(from, from - 2, 'castle');
    }
  }
  return moves;
}

export function legalMoves(position: Position): Move[] {
  return pseudoMoves(position).filter(move => !isInCheck(applyUnchecked(position, move), position.turn));
}

export function makeMove(position: Position, move: Move): Position {
  const legal = legalMoves(position).find(candidate =>
    candidate.from === move.from && candidate.to === move.to && candidate.promotion === move.promotion,
  );
  if (!legal) throw new Error('Illegal move.');
  return applyUnchecked(position, legal);
}

export function moveUci(move: Move): string {
  return squareName(move.from) + squareName(move.to) + (move.promotion || '');
}

export function moveText(move: Move): string {
  return squareName(move.from) + ' → ' + squareName(move.to) + (move.promotion ? '=' + move.promotion.toUpperCase() : '');
}

function repetitionKey(position: Position): string {
  const epCanBeUsed = position.ep >= 0 && legalMoves(position).some(move => move.flag === 'ep');
  return position.board.filter((_, index) => onBoard(index)).join('') + ':' + position.turn + ':' + position.castling + ':' + (epCanBeUsed ? position.ep : -1);
}

function insufficientMaterial(position: Position): boolean {
  const pieces: Array<{ kind: string; color: number }> = [];
  for (let square = 0; square < 128; square++) {
    if (!onBoard(square)) continue;
    const piece = position.board[square];
    if (piece !== '.' && piece.toLowerCase() !== 'k') pieces.push({ kind: piece.toLowerCase(), color: ((square >> 4) + (square & 7)) % 2 });
  }
  if (pieces.length === 0) return true;
  if (pieces.length === 1 && ['b', 'n'].includes(pieces[0].kind)) return true;
  return pieces.every(piece => piece.kind === 'b') && new Set(pieces.map(piece => piece.color)).size === 1;
}

export function gameStatus(history: Position[]): GameStatus {
  const position = history[history.length - 1];
  const moves = legalMoves(position);
  const check = isInCheck(position);
  const key = repetitionKey(position);
  const repeats = history.filter(item => repetitionKey(item) === key).length;
  if (moves.length === 0) {
    if (check) return { done: true, text: 'Checkmate — ' + (position.turn === 1 ? 'Black' : 'White') + ' wins.', winner: position.turn === 1 ? -1 : 1, drawClaim: null };
    return { done: true, text: 'Draw — stalemate.', winner: null, drawClaim: null };
  }
  if (insufficientMaterial(position)) return { done: true, text: 'Draw — insufficient material.', winner: null, drawClaim: null };
  if (position.halfmove >= 150) return { done: true, text: 'Draw — 75-move rule.', winner: null, drawClaim: null };
  if (repeats >= 5) return { done: true, text: 'Draw — fivefold repetition.', winner: null, drawClaim: null };
  return {
    done: false,
    text: (position.turn === 1 ? 'White' : 'Black') + ' to move' + (check ? ' · Check' : ''),
    winner: null,
    drawClaim: repeats >= 3 ? 'threefold repetition' : position.halfmove >= 100 ? '50-move rule' : null,
  };
}

export function chooseCpuMove(position: Position): Move | null {
  const moves = legalMoves(position);
  if (!moves.length) return null;
  const scored = moves.map(move => {
    const next = applyUnchecked(position, move);
    let score = 0;
    const captured = position.board[move.to] !== '.' ? position.board[move.to] : move.flag === 'ep' ? 'p' : '.';
    if (captured !== '.') score += VALUES[captured.toLowerCase()] * 0.9;
    if (move.promotion) score += VALUES[move.promotion] - 100;
    if (isInCheck(next)) score += 45;
    score += Math.random() * 18;
    return { move, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].move;
}

export function claimableDraw(history: Position[]): string | null {
  return gameStatus(history).drawClaim;
}
