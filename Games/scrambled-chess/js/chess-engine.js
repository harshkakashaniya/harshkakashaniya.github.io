// Chess engine: board state, legal move generation, rules enforcement.
// Board indexing: board[r][c] where r=0 is rank 1 (White's home rank), r=7 is rank 8
// (Black's home rank); c=0 is file 'a', c=7 is file 'h'. This matches algebraic
// notation directly: rcToSquare(0,0) === 'a1'.
// Pieces are 2-char strings: color 'w'|'b' + type 'P'|'N'|'B'|'R'|'Q'|'K'. Empty = null.
//
// Plain classic script (no import/export) — see docs/game/backend-contract.md.
// Loaded via a plain <script> tag, not type="module", so the game works when
// index.html is opened directly via file:// (ES modules are blocked there by
// browser CORS rules). Everything this file needs to expose is assigned to
// globalThis at the bottom instead of using `export`.

const FILES = 'abcdefgh';
const PIECE_VALUES = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const QUEEN_DIRS = BISHOP_DIRS.concat(ROOK_DIRS);
const KNIGHT_OFFSETS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

function squareToRC(sq) {
  const c = FILES.indexOf(sq[0]);
  const r = parseInt(sq.slice(1), 10) - 1;
  return { r, c };
}

function rcToSquare(r, c) {
  return FILES[c] + (r + 1);
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function opponent(color) {
  return color === 'w' ? 'b' : 'w';
}

function buildClassicBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let c = 0; c < 8; c++) {
    board[0][c] = 'w' + backRank[c];
    board[1][c] = 'wP';
    board[6][c] = 'bP';
    board[7][c] = 'b' + backRank[c];
  }
  return board;
}

function shuffledBackRankWithKingBetweenRooks() {
  const pieces = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  // Rejection sampling: cheap for 8 items, and keeps castling well-defined
  // (destination squares g/c-file only make sense if the king starts between
  // the two rooks) — see docs/game/requirements.md decision log.
  for (let attempt = 0; attempt < 1000; attempt++) {
    const arr = pieces.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const kingIdx = arr.indexOf('K');
    const rookIdxs = [];
    arr.forEach((p, i) => { if (p === 'R') rookIdxs.push(i); });
    if (rookIdxs[0] < kingIdx && kingIdx < rookIdxs[1]) return arr;
  }
  throw new Error('failed to generate a valid scrambled back rank');
}

function buildScrambledBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const whiteBackRank = shuffledBackRankWithKingBetweenRooks();
  const blackBackRank = shuffledBackRankWithKingBetweenRooks();
  for (let c = 0; c < 8; c++) {
    board[0][c] = 'w' + whiteBackRank[c];
    board[1][c] = 'wP';
    board[6][c] = 'bP';
    board[7][c] = 'b' + blackBackRank[c];
  }
  return board;
}

function initCastlingRights(board) {
  const rights = {};
  for (const color of ['w', 'b']) {
    const homeRow = color === 'w' ? 0 : 7;
    let kingFile = null;
    const rookFiles = [];
    for (let c = 0; c < 8; c++) {
      const piece = board[homeRow][c];
      if (piece === color + 'K') kingFile = c;
      if (piece === color + 'R') rookFiles.push(c);
    }
    rights[color] = {
      homeRow,
      kingFile,
      queensideRookFile: rookFiles[0],
      kingsideRookFile: rookFiles[1],
      kingMoved: false,
      queensideRookMoved: false,
      kingsideRookMoved: false,
    };
  }
  return rights;
}

function pieceColor(piece) {
  return piece ? piece[0] : null;
}
function pieceType(piece) {
  return piece ? piece[1] : null;
}

// Generates pseudo-legal moves for the piece at (r,c): legal by movement rules,
// but not yet filtered for leaving the mover's own king in check.
function generatePseudoMoves(board, r, c, state) {
  const piece = board[r][c];
  if (!piece) return [];
  const color = pieceColor(piece);
  const type = pieceType(piece);
  const moves = [];

  const addSlide = (dirs) => {
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc }, flags: {} });
        } else {
          if (pieceColor(target) !== color) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc }, flags: { capture: true } });
          }
          break;
        }
        nr += dr; nc += dc;
      }
    }
  };

  if (type === 'N') {
    for (const [dr, dc] of KNIGHT_OFFSETS) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target || pieceColor(target) !== color) {
        moves.push({ from: { r, c }, to: { r: nr, c: nc }, flags: { capture: !!target } });
      }
    }
  } else if (type === 'B') {
    addSlide(BISHOP_DIRS);
  } else if (type === 'R') {
    addSlide(ROOK_DIRS);
  } else if (type === 'Q') {
    addSlide(QUEEN_DIRS);
  } else if (type === 'K') {
    for (const [dr, dc] of QUEEN_DIRS) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target || pieceColor(target) !== color) {
        moves.push({ from: { r, c }, to: { r: nr, c: nc }, flags: { capture: !!target } });
      }
    }
    // Castling is appended separately in getLegalMoves (needs check-safety along the path).
  } else if (type === 'P') {
    const dir = color === 'w' ? 1 : -1;
    const startRow = color === 'w' ? 1 : 6;
    const promoRow = color === 'w' ? 7 : 0;

    const oneR = r + dir;
    if (inBounds(oneR, c) && !board[oneR][c]) {
      moves.push({ from: { r, c }, to: { r: oneR, c }, flags: { promotion: oneR === promoRow } });
      const twoR = r + 2 * dir;
      if (r === startRow && !board[twoR][c]) {
        moves.push({ from: { r, c }, to: { r: twoR, c }, flags: { doublePawn: true } });
      }
    }
    for (const dc of [-1, 1]) {
      const nc = c + dc;
      if (!inBounds(oneR, nc)) continue;
      const target = board[oneR][nc];
      if (target && pieceColor(target) !== color) {
        moves.push({ from: { r, c }, to: { r: oneR, c: nc }, flags: { capture: true, promotion: oneR === promoRow } });
      } else if (!target && state.enPassant && state.enPassant.r === oneR && state.enPassant.c === nc) {
        moves.push({ from: { r, c }, to: { r: oneR, c: nc }, flags: { enPassant: true, capture: true } });
      }
    }
  }

  return moves;
}

// Is (r,c) attacked by `byColor`? Used for check detection and for verifying
// a king doesn't castle through/into check. Independent of whose turn it is.
function isSquareAttacked(board, r, c, byColor) {
  // Pawn attacks
  const pawnDir = byColor === 'w' ? -1 : 1; // a white pawn attacking (r,c) sits one row below it, etc.
  for (const dc of [-1, 1]) {
    const pr = r + pawnDir, pc = c + dc;
    if (inBounds(pr, pc) && board[pr][pc] === byColor + 'P') return true;
  }
  // Knight attacks
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc] === byColor + 'N') return true;
  }
  // Sliding attacks (bishop/rook/queen)
  for (const [dr, dc] of BISHOP_DIRS) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const target = board[nr][nc];
      if (target) {
        if (pieceColor(target) === byColor && (pieceType(target) === 'B' || pieceType(target) === 'Q')) return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }
  for (const [dr, dc] of ROOK_DIRS) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const target = board[nr][nc];
      if (target) {
        if (pieceColor(target) === byColor && (pieceType(target) === 'R' || pieceType(target) === 'Q')) return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }
  // King attacks
  for (const [dr, dc] of QUEEN_DIRS) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc] === byColor + 'K') return true;
  }
  return false;
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === color + 'K') return { r, c };
    }
  }
  return null;
}

class ChessGame {
  constructor(mode = 'classic', opponentType = 'twoPlayer') {
    this.newGame(mode, opponentType);
  }

  newGame(mode = 'classic', opponentType = 'twoPlayer') {
    this.mode = mode;
    this.opponentType = opponentType;
    this.board = mode === 'scrambled' ? buildScrambledBoard() : buildClassicBoard();
    this.turn = 'w';
    this.castling = initCastlingRights(this.board);
    this.enPassant = null; // { r, c } of the square a pawn could capture onto, or null
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;
    this.status = 'active'; // 'active' | 'checkmate' | 'stalemate' | 'draw'
    this.winner = null; // 'w' | 'b' | null
    this.drawReason = null; // 'fifty-move' | 'threefold-repetition' | 'insufficient-material' | 'stalemate' | null
    this.moveLog = [];
    this.positionCounts = new Map();
    this._recordPosition();
    this._refreshStatus();
  }

  clone() {
    const g = Object.create(ChessGame.prototype);
    g.mode = this.mode;
    g.opponentType = this.opponentType;
    g.board = cloneBoard(this.board);
    g.turn = this.turn;
    g.castling = JSON.parse(JSON.stringify(this.castling));
    g.enPassant = this.enPassant ? { ...this.enPassant } : null;
    g.halfmoveClock = this.halfmoveClock;
    g.fullmoveNumber = this.fullmoveNumber;
    g.status = this.status;
    g.winner = this.winner;
    g.drawReason = this.drawReason;
    g.moveLog = this.moveLog.slice();
    g.positionCounts = new Map(this.positionCounts);
    return g;
  }

  isInCheck(color = this.turn) {
    const king = findKing(this.board, color);
    if (!king) return false;
    return isSquareAttacked(this.board, king.r, king.c, opponent(color));
  }

  // All fully-legal moves for the piece on `square` (algebraic, e.g. 'e2'),
  // or [] if empty/not that color's turn/game over.
  getLegalMoves(square) {
    if (this.status !== 'active') return [];
    const { r, c } = squareToRC(square);
    const piece = this.board[r][c];
    if (!piece || pieceColor(piece) !== this.turn) return [];

    const pseudo = generatePseudoMoves(this.board, r, c, this);
    const legal = [];
    for (const mv of pseudo) {
      if (this._wouldLeaveKingInCheck(mv)) continue;
      legal.push(this._toPublicMove(mv));
    }
    if (pieceType(piece) === 'K') {
      legal.push(...this._castlingMoves(this.turn).map((mv) => this._toPublicMove(mv)));
    }
    return legal;
  }

  // All fully-legal moves for the side to move, flattened, each tagged with
  // its origin square. Used by the AI search and by status checks. Only ever
  // returns moves for `this.turn` — getLegalMoves() enforces turn order, so
  // there is no "get moves for the other color" mode. Promotions default to
  // Queen here (see docs/game/backend-contract.md).
  getAllLegalMoves() {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && pieceColor(piece) === this.turn) {
          const from = rcToSquare(r, c);
          for (const mv of this.getLegalMoves(from)) {
            moves.push({ ...mv, from });
          }
        }
      }
    }
    return moves;
  }

  _castlingMoves(color) {
    if (this.isInCheck(color)) return [];
    const rights = this.castling[color];
    const results = [];
    const opp = opponent(color);
    const row = rights.homeRow;

    const tryCastle = (side) => {
      const moved = side === 'K' ? rights.kingsideRookMoved : rights.queensideRookMoved;
      if (rights.kingMoved || moved) return;
      const rookFile = side === 'K' ? rights.kingsideRookFile : rights.queensideRookFile;
      if (rookFile === undefined || this.board[row][rookFile] !== color + 'R') return;
      const kingDest = side === 'K' ? 6 : 2;
      const rookDest = side === 'K' ? 5 : 3;

      const emptyRequired = new Set();
      const lo1 = Math.min(rights.kingFile, kingDest), hi1 = Math.max(rights.kingFile, kingDest);
      for (let f = lo1; f <= hi1; f++) emptyRequired.add(f);
      const lo2 = Math.min(rookFile, rookDest), hi2 = Math.max(rookFile, rookDest);
      for (let f = lo2; f <= hi2; f++) emptyRequired.add(f);
      emptyRequired.delete(rights.kingFile);
      emptyRequired.delete(rookFile);

      for (const f of emptyRequired) {
        if (this.board[row][f]) return; // blocked
      }

      const passLo = Math.min(rights.kingFile, kingDest), passHi = Math.max(rights.kingFile, kingDest);
      const tempBoard = cloneBoard(this.board);
      tempBoard[row][rights.kingFile] = null;
      for (let f = passLo; f <= passHi; f++) {
        tempBoard[row][rights.kingFile] = null;
        tempBoard[row][f] = color + 'K';
        if (isSquareAttacked(tempBoard, row, f, opp)) { tempBoard[row][f] = null; return; }
        tempBoard[row][f] = null;
      }

      results.push({
        from: { r: row, c: rights.kingFile },
        to: { r: row, c: kingDest },
        flags: { castle: side, rookFrom: { r: row, c: rookFile }, rookTo: { r: row, c: rookDest } },
      });
    };

    tryCastle('K');
    tryCastle('Q');
    return results;
  }

  _wouldLeaveKingInCheck(mv) {
    const clone = this.clone();
    clone._applyMoveRaw(mv);
    return clone.isInCheck(pieceColor(this.board[mv.from.r][mv.from.c]));
  }

  _toPublicMove(mv) {
    const out = { to: rcToSquare(mv.to.r, mv.to.c) };
    if (mv.flags.promotion) out.promotion = ['Q', 'R', 'B', 'N'];
    if (mv.flags.castle) out.isCastle = mv.flags.castle;
    if (mv.flags.enPassant) out.isEnPassant = true;
    return out;
  }

  // Mutates board/state for `mv` without touching turn/status/history bookkeeping.
  // Shared by legality-checking (on a clone) and the real makeMove.
  _applyMoveRaw(mv, promotionChoice) {
    const { board } = this;
    const piece = board[mv.from.r][mv.from.c];
    const color = pieceColor(piece);

    board[mv.from.r][mv.from.c] = null;

    if (mv.flags.enPassant) {
      board[mv.from.r][mv.to.c] = null; // captured pawn sits beside the mover, not on the destination square
    }

    let finalPiece = piece;
    if (mv.flags.promotion) {
      finalPiece = color + (promotionChoice || 'Q');
    }
    board[mv.to.r][mv.to.c] = finalPiece;

    if (mv.flags.castle) {
      board[mv.flags.rookFrom.r][mv.flags.rookFrom.c] = null;
      board[mv.flags.rookTo.r][mv.flags.rookTo.c] = color + 'R';
    }

    // Castling-rights bookkeeping
    const rights = this.castling[color];
    if (pieceType(piece) === 'K') rights.kingMoved = true;
    if (mv.from.c === rights.queensideRookFile && mv.from.r === rights.homeRow) rights.queensideRookMoved = true;
    if (mv.from.c === rights.kingsideRookFile && mv.from.r === rights.homeRow) rights.kingsideRookMoved = true;
    const oppRights = this.castling[opponent(color)];
    if (mv.to.r === oppRights.homeRow) {
      if (mv.to.c === oppRights.queensideRookFile) oppRights.queensideRookMoved = true;
      if (mv.to.c === oppRights.kingsideRookFile) oppRights.kingsideRookMoved = true;
    }

    // En passant target for the *next* move only arises from a double pawn push.
    this.enPassant = mv.flags.doublePawn ? { r: (mv.from.r + mv.to.r) / 2, c: mv.from.c } : null;

    const wasPawnOrCapture = pieceType(piece) === 'P' || mv.flags.capture;
    this.halfmoveClock = wasPawnOrCapture ? 0 : this.halfmoveClock + 1;
  }

  // Public entry point: validates `to` (and `promotion` if needed) against the
  // legal moves for `from`, applies it, and refreshes status. Returns
  // { ok:true, state } or { ok:false, error }.
  makeMove(from, to, promotion) {
    if (this.status !== 'active') return { ok: false, error: `game is over (${this.status})` };
    const legal = this.getLegalMoves(from);
    const match = legal.find((m) => m.to === to);
    if (!match) return { ok: false, error: `illegal move: ${from} -> ${to}` };
    if (match.promotion && !match.promotion.includes(promotion)) {
      promotion = 'Q'; // default, per docs/game/backend-contract.md
    }

    // Reconstruct the full raw move (with doublePawn/capture/etc. flags intact)
    // rather than re-deriving flags from the simplified public `match` — that
    // used to silently drop doublePawn and capture, breaking en passant and
    // the 50-move clock. See docs/game/backend-contract.md limitations.
    const { r, c } = squareToRC(from);
    let mv;
    if (match.isCastle) {
      mv = this._castlingMoves(this.turn).find((m) => m.flags.castle === match.isCastle);
    } else {
      const pseudo = generatePseudoMoves(this.board, r, c, this);
      mv = pseudo.find((m) => rcToSquare(m.to.r, m.to.c) === to && !!m.flags.enPassant === !!match.isEnPassant);
    }
    if (!mv) return { ok: false, error: `internal error: could not reconstruct move ${from} -> ${to}` };

    const movingColor = this.turn;
    this._applyMoveRaw(mv, promotion);
    this.moveLog.push({ from, to, color: movingColor, promotion: mv.flags.promotion ? promotion : null, isCastle: mv.flags.castle, isEnPassant: mv.flags.enPassant });
    if (movingColor === 'b') this.fullmoveNumber += 1;
    this.turn = opponent(movingColor);
    this._recordPosition();
    this._refreshStatus();
    return { ok: true, state: this.getState() };
  }

  _positionKey() {
    // Simplified repetition key: includes en passant square even when it isn't
    // actually capturable, which can under-rare-circumstances treat two positions
    // as distinct when strict FIDE rules would call them the same. Documented
    // simplification — see docs/game/backend-contract.md limitations.
    const boardKey = this.board.map((row) => row.map((p) => p || '.').join('')).join('/');
    const c = this.castling;
    const castleKey = ['w', 'b'].map((color) => {
      const r = c[color];
      return `${r.kingMoved ? 0 : 1}${r.kingsideRookMoved ? 0 : 1}${r.queensideRookMoved ? 0 : 1}`;
    }).join('');
    const epKey = this.enPassant ? rcToSquare(this.enPassant.r, this.enPassant.c) : '-';
    return `${boardKey}|${this.turn}|${castleKey}|${epKey}`;
  }

  _recordPosition() {
    const key = this._positionKey();
    this.positionCounts.set(key, (this.positionCounts.get(key) || 0) + 1);
  }

  _hasInsufficientMaterial() {
    const pieces = { w: [], b: [] };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && pieceType(p) !== 'K') pieces[pieceColor(p)].push({ type: pieceType(p), r, c });
      }
    }
    const isBareOrSingleMinor = (arr) => arr.length === 0 || (arr.length === 1 && (arr[0].type === 'N' || arr[0].type === 'B'));
    if (isBareOrSingleMinor(pieces.w) && isBareOrSingleMinor(pieces.b)) {
      if (pieces.w.length === 0 && pieces.b.length === 0) return true;
      if (pieces.w.length + pieces.b.length === 1) return true;
      if (pieces.w.length === 1 && pieces.b.length === 1 && pieces.w[0].type === 'B' && pieces.b[0].type === 'B') {
        const sqColor = (p) => (p.r + p.c) % 2;
        return sqColor(pieces.w[0]) === sqColor(pieces.b[0]);
      }
      if (pieces.w.length === 0 || pieces.b.length === 0) return true;
    }
    return false;
  }

  _refreshStatus() {
    const moves = this.getAllLegalMoves();
    const inCheck = this.isInCheck(this.turn);

    if (moves.length === 0) {
      if (inCheck) {
        this.status = 'checkmate';
        this.winner = opponent(this.turn);
        this.drawReason = null;
      } else {
        this.status = 'stalemate';
        this.winner = null;
        this.drawReason = 'stalemate';
      }
      return;
    }
    if (this.halfmoveClock >= 100) {
      this.status = 'draw'; this.winner = null; this.drawReason = 'fifty-move'; return;
    }
    if ((this.positionCounts.get(this._positionKey()) || 0) >= 3) {
      this.status = 'draw'; this.winner = null; this.drawReason = 'threefold-repetition'; return;
    }
    if (this._hasInsufficientMaterial()) {
      this.status = 'draw'; this.winner = null; this.drawReason = 'insufficient-material'; return;
    }
    this.status = 'active';
    this.winner = null;
    this.drawReason = null;
  }

  getState() {
    return {
      board: cloneBoard(this.board),
      turn: this.turn,
      status: this.status,
      winner: this.winner,
      drawReason: this.drawReason,
      inCheck: this.status === 'active' ? this.isInCheck(this.turn) : false,
      halfmoveClock: this.halfmoveClock,
      fullmoveNumber: this.fullmoveNumber,
      lastMove: this.moveLog.length ? this.moveLog[this.moveLog.length - 1] : null,
      mode: this.mode,
      opponentType: this.opponentType,
      castlingRights: {
        w: { kingside: !this.castling.w.kingMoved && !this.castling.w.kingsideRookMoved, queenside: !this.castling.w.kingMoved && !this.castling.w.queensideRookMoved },
        b: { kingside: !this.castling.b.kingMoved && !this.castling.b.kingsideRookMoved, queenside: !this.castling.b.kingMoved && !this.castling.b.queensideRookMoved },
      },
    };
  }
}

globalThis.FILES = FILES;
globalThis.PIECE_VALUES = PIECE_VALUES;
globalThis.squareToRC = squareToRC;
globalThis.rcToSquare = rcToSquare;
globalThis.ChessGame = ChessGame;
