import { getLevel, type Goal, type LevelDef } from "./levels";

export const COLS = 8;
export const ROWS = 8;

export type Special = "none" | "stripeH" | "stripeV" | "wrapped" | "bomb";

export interface Tile {
  fruit: number;
  special: Special;
  key: number;
}

export interface Pos {
  r: number;
  c: number;
}

export interface Step {
  board: Tile[][];
  cleared: Pos[];
  combo: number;
  score: number;
  collected: number[];
}

export interface SwapResult {
  ok: boolean;
  steps: Step[];
  invalid: boolean;
}

let nextKey = 1;

function key(): number {
  nextKey += 1;
  return nextKey;
}

export function cloneBoard(board: Tile[][]): Tile[][] {
  return board.map((row) => row.map((t) => ({ ...t })));
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function pk(r: number, c: number): string {
  return `${r},${c}`;
}

function parse(k: string): Pos {
  const [r, c] = k.split(",").map(Number);
  return { r, c };
}

function emptyTile(): Tile {
  return { fruit: -1, special: "none", key: key() };
}

function randomTile(fruitCount: number): Tile {
  return { fruit: Math.floor(Math.random() * fruitCount), special: "none", key: key() };
}

function sameFruit(a: Tile, b: Tile): boolean {
  if (a.fruit < 0 || b.fruit < 0) return false;
  if (a.special === "bomb" || b.special === "bomb") return false;
  return a.fruit === b.fruit;
}

export function findMatchedCells(board: Tile[][]): Set<string> {
  const matched = new Set<string>();
  for (let r = 0; r < ROWS; r++) {
    let run = 1;
    for (let c = 1; c <= COLS; c++) {
      const cont = c < COLS && sameFruit(board[r][c], board[r][c - 1]);
      if (cont) run += 1;
      else {
        if (run >= 3) {
          for (let k = 0; k < run; k++) matched.add(pk(r, c - 1 - k));
        }
        run = 1;
      }
    }
  }
  for (let c = 0; c < COLS; c++) {
    let run = 1;
    for (let r = 1; r <= ROWS; r++) {
      const cont = r < ROWS && sameFruit(board[r][c], board[r - 1][c]);
      if (cont) run += 1;
      else {
        if (run >= 3) {
          for (let k = 0; k < run; k++) matched.add(pk(r - 1 - k, c));
        }
        run = 1;
      }
    }
  }
  return matched;
}

function longestRunAt(board: Tile[][], r: number, c: number, dr: number, dc: number): number {
  const tile = board[r][c];
  if (tile.fruit < 0 || tile.special === "bomb") return 1;
  let n = 1;
  let rr = r + dr;
  let cc = c + dc;
  while (inBounds(rr, cc) && sameFruit(board[rr][cc], tile)) {
    n += 1;
    rr += dr;
    cc += dc;
  }
  rr = r - dr;
  cc = c - dc;
  while (inBounds(rr, cc) && sameFruit(board[rr][cc], tile)) {
    n += 1;
    rr -= dr;
    cc -= dc;
  }
  return n;
}

function specialForGroup(board: Tile[][], group: Pos[], swapInto: Pos | null): { at: Pos; special: Special } | null {
  if (group.length < 4) return null;
  let hasLT = false;
  let stripeH = false;
  let stripeV = false;
  let five = false;
  for (const p of group) {
    const h = longestRunAt(board, p.r, p.c, 0, 1);
    const v = longestRunAt(board, p.r, p.c, 1, 0);
    if (h >= 5 || v >= 5) five = true;
    if (h >= 3 && v >= 3) hasLT = true;
    if (h >= 4) stripeH = true;
    if (v >= 4) stripeV = true;
  }
  let special: Special = "none";
  if (five) special = "bomb";
  else if (hasLT) special = "wrapped";
  else if (stripeH || stripeV) special = stripeH && !stripeV ? "stripeH" : stripeV && !stripeH ? "stripeV" : "stripeH";
  if (special === "none") return null;

  let at = group[Math.floor(group.length / 2)];
  if (swapInto && group.some((p) => p.r === swapInto.r && p.c === swapInto.c)) at = swapInto;
  return { at, special };
}

function connectedGroups(cells: Set<string>, board: Tile[][]): Pos[][] {
  const remaining = new Set(cells);
  const groups: Pos[][] = [];
  const dirs = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ];
  for (const start of remaining) {
    const seed = parse(start);
    const fruit = board[seed.r][seed.c].fruit;
    const q = [seed];
    remaining.delete(start);
    const group: Pos[] = [];
    while (q.length) {
      const p = q.pop()!;
      group.push(p);
      for (const [dr, dc] of dirs) {
        const nr = p.r + dr;
        const nc = p.c + dc;
        const k = pk(nr, nc);
        if (!remaining.has(k)) continue;
        if (board[nr][nc].fruit !== fruit) continue;
        remaining.delete(k);
        q.push({ r: nr, c: nc });
      }
    }
    groups.push(group);
  }
  return groups;
}

function activateSpecials(board: Tile[][], seeds: Pos[]): Set<string> {
  const clear = new Set<string>();
  const queue: { r: number; c: number; special: Special; fruit: number }[] = [];
  const queued = new Set<string>();

  const enqueue = (r: number, c: number): void => {
    if (!inBounds(r, c)) return;
    const k = pk(r, c);
    const tile = board[r][c];
    if (tile.fruit < 0 && tile.special === "none") return;
    const wasNew = !clear.has(k);
    clear.add(k);
    if (!wasNew) return;
    if (tile.special !== "none" && !queued.has(k)) {
      queued.add(k);
      queue.push({ r, c, special: tile.special, fruit: tile.fruit });
    }
  };

  for (const s of seeds) enqueue(s.r, s.c);

  while (queue.length) {
    const item = queue.shift()!;
    if (item.special === "stripeH") {
      for (let c = 0; c < COLS; c++) enqueue(item.r, c);
    } else if (item.special === "stripeV") {
      for (let r = 0; r < ROWS; r++) enqueue(r, item.c);
    } else if (item.special === "wrapped") {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) enqueue(item.r + dr, item.c + dc);
      }
    } else if (item.special === "bomb") {
      const target = item.fruit;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (board[r][c].fruit === target || (r === item.r && c === item.c)) enqueue(r, c);
        }
      }
    }
  }
  return clear;
}

function applyClears(
  board: Tile[][],
  toClear: Set<string>,
  spawn: { at: Pos; special: Special }[],
  collected: number[],
): Pos[] {
  const spawnAt = new Map(spawn.map((s) => [pk(s.at.r, s.at.c), s.special]));
  const cleared: Pos[] = [];
  for (const k of toClear) {
    const p = parse(k);
    const tile = board[p.r][p.c];
    if (tile.fruit >= 0 && tile.special !== "bomb") collected[tile.fruit] += 1;
    const special = spawnAt.get(k);
    if (special) {
      board[p.r][p.c] = {
        fruit: special === "bomb" ? 0 : tile.fruit < 0 ? 0 : tile.fruit,
        special,
        key: key(),
      };
    } else {
      board[p.r][p.c] = emptyTile();
      cleared.push(p);
    }
  }
  return cleared;
}

function gravity(board: Tile[][], fruitCount: number): void {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c].fruit >= 0 || board[r][c].special === "bomb") {
        if (write !== r) board[write][c] = board[r][c];
        write -= 1;
      }
    }
    for (let r = write; r >= 0; r--) board[r][c] = randomTile(fruitCount);
  }
}

function swapTiles(board: Tile[][], a: Pos, b: Pos): void {
  const tmp = board[a.r][a.c];
  board[a.r][a.c] = board[b.r][b.c];
  board[b.r][b.c] = tmp;
}

export function areAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

function isSpecialCombo(board: Tile[][], a: Pos, b: Pos): boolean {
  const ta = board[a.r][a.c];
  const tb = board[b.r][b.c];
  if (ta.special === "bomb" || tb.special === "bomb") return true;
  if (ta.special !== "none" && tb.special !== "none") return true;
  return false;
}

function specialComboSeeds(board: Tile[][], a: Pos, b: Pos): Pos[] {
  const ta = board[a.r][a.c];
  const tb = board[b.r][b.c];
  const seeds: Pos[] = [a, b];
  const bomb = ta.special === "bomb" ? ta : tb.special === "bomb" ? tb : null;
  const other = ta.special === "bomb" ? tb : ta;
  const otherPos = ta.special === "bomb" ? b : a;
  if (ta.special === "bomb" && tb.special === "bomb") {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) seeds.push({ r, c });
    return seeds;
  }
  if (bomb) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c].fruit === other.fruit) seeds.push({ r, c });
      }
    }
    if (other.special !== "none") seeds.push(otherPos);
    return seeds;
  }
  return seeds;
}

function resolve(board: Tile[][], fruitCount: number, collected: number[], swapInto: Pos | null, comboStart: number): Step[] {
  const steps: Step[] = [];
  let combo = comboStart;
  while (true) {
    const matched = findMatchedCells(board);
    if (matched.size === 0) break;
    const groups = connectedGroups(matched, board);
    const spawns: { at: Pos; special: Special }[] = [];
    for (const g of groups) {
      const spec = specialForGroup(board, g, combo === comboStart ? swapInto : null);
      if (spec) spawns.push(spec);
    }
    const seeds = [...matched].map(parse);
    const toClear = activateSpecials(board, seeds);
    const cleared = applyClears(board, toClear, spawns, collected);
    combo += 1;
    const points = (toClear.size * 40 + Math.max(0, toClear.size - 3) * 20) * combo;
    steps.push({
      board: cloneBoard(board),
      cleared,
      combo,
      score: points,
      collected: [...collected],
    });
    gravity(board, fruitCount);
    steps.push({
      board: cloneBoard(board),
      cleared: [],
      combo,
      score: 0,
      collected: [...collected],
    });
  }
  return steps;
}

function hasMatches(board: Tile[][]): boolean {
  return findMatchedCells(board).size > 0;
}

export function findHint(board: Tile[][]): { a: Pos; b: Pos } | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const neighbors: Pos[] = [];
      if (c + 1 < COLS) neighbors.push({ r, c: c + 1 });
      if (r + 1 < ROWS) neighbors.push({ r: r + 1, c });
      for (const n of neighbors) {
        const a = { r, c };
        swapTiles(board, a, n);
        const good = isSpecialCombo(board, a, n) || hasMatches(board);
        swapTiles(board, a, n);
        if (good) return { a, b: n };
      }
    }
  }
  return null;
}

function fillBoard(fruitCount: number): Tile[][] {
  const board: Tile[][] = [];
  for (let r = 0; r < ROWS; r++) {
    board[r] = [];
    for (let c = 0; c < COLS; c++) board[r][c] = randomTile(fruitCount);
  }
  return board;
}

export function createBoard(fruitCount: number): Tile[][] {
  for (let attempt = 0; attempt < 80; attempt++) {
    const board = fillBoard(fruitCount);
    if (hasMatches(board)) continue;
    if (!findHint(board)) continue;
    return board;
  }
  const board = fillBoard(fruitCount);
  return board;
}

export function shuffleBoard(board: Tile[][], fruitCount: number): Tile[][] {
  const tiles = board.flat().map((t) => ({ ...t }));
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = tiles[i];
    tiles[i] = tiles[j];
    tiles[j] = tmp;
  }
  const next: Tile[][] = [];
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    next[r] = [];
    for (let c = 0; c < COLS; c++) next[r][c] = tiles[i++];
  }
  if (hasMatches(next) || !findHint(next)) return createBoard(fruitCount);
  return next;
}

export class CrushGame {
  board: Tile[][];
  score = 0;
  moves: number;
  collected: number[];
  level: LevelDef;
  won = false;
  lost = false;

  constructor(levelId: number) {
    this.level = getLevel(levelId);
    this.moves = this.level.moves;
    this.collected = [0, 0, 0, 0, 0, 0];
    this.board = createBoard(this.level.fruitCount);
  }

  goalProgress(): { current: number; target: number } {
    const g = this.level.goal;
    if (g.kind === "score") return { current: this.score, target: g.target };
    return { current: this.collected[g.fruit], target: g.target };
  }

  goalMet(): boolean {
    const g = this.level.goal;
    if (g.kind === "score") return this.score >= g.target;
    return this.collected[g.fruit] >= g.target;
  }

  private finishIfNeeded(): void {
    if (this.goalMet()) this.won = true;
    else if (this.moves <= 0) this.lost = true;
  }

  trySwap(a: Pos, b: Pos): SwapResult {
    if (this.won || this.lost) return { ok: false, steps: [], invalid: false };
    if (!areAdjacent(a, b)) return { ok: false, steps: [], invalid: false };
    const board = this.board;
    const special = isSpecialCombo(board, a, b);
    swapTiles(board, a, b);
    if (!special && !hasMatches(board)) {
      swapTiles(board, a, b);
      return { ok: false, steps: [], invalid: true };
    }
    this.moves -= 1;
    const steps: Step[] = [];
    if (special) {
      const seeds = specialComboSeeds(board, a, b);
      const toClear = activateSpecials(board, seeds);
      const cleared = applyClears(board, toClear, [], this.collected);
      const points = toClear.size * 50;
      this.score += points;
      steps.push({
        board: cloneBoard(board),
        cleared,
        combo: 1,
        score: points,
        collected: [...this.collected],
      });
      gravity(board, this.level.fruitCount);
      steps.push({
        board: cloneBoard(board),
        cleared: [],
        combo: 1,
        score: 0,
        collected: [...this.collected],
      });
    }
    const cascade = resolve(board, this.level.fruitCount, this.collected, b, special ? 1 : 0);
    for (const s of cascade) this.score += s.score;
    steps.push(...cascade);
    if (!findHint(board)) {
      this.board = shuffleBoard(board, this.level.fruitCount);
      steps.push({
        board: cloneBoard(this.board),
        cleared: [],
        combo: 0,
        score: 0,
        collected: [...this.collected],
      });
    } else {
      this.board = board;
    }
    this.finishIfNeeded();
    return { ok: true, steps, invalid: false };
  }

  smash(p: Pos): SwapResult {
    if (this.won || this.lost) return { ok: false, steps: [], invalid: false };
    const board = this.board;
    const tile = board[p.r][p.c];
    if (tile.fruit < 0 && tile.special !== "bomb") return { ok: false, steps: [], invalid: true };
    const toClear = activateSpecials(board, [p]);
    const cleared = applyClears(board, toClear, [], this.collected);
    const points = Math.max(40, toClear.size * 40);
    this.score += points;
    const steps: Step[] = [
      {
        board: cloneBoard(board),
        cleared,
        combo: 1,
        score: points,
        collected: [...this.collected],
      },
    ];
    gravity(board, this.level.fruitCount);
    steps.push({
      board: cloneBoard(board),
      cleared: [],
      combo: 1,
      score: 0,
      collected: [...this.collected],
    });
    const cascade = resolve(board, this.level.fruitCount, this.collected, null, 1);
    for (const s of cascade) this.score += s.score;
    steps.push(...cascade);
    if (!findHint(board)) this.board = shuffleBoard(board, this.level.fruitCount);
    else this.board = board;
    this.finishIfNeeded();
    return { ok: true, steps, invalid: false };
  }

  shuffle(): void {
    this.board = shuffleBoard(this.board, this.level.fruitCount);
  }

  addMoves(n: number): void {
    this.moves += n;
    this.lost = false;
  }

  goal(): Goal {
    return this.level.goal;
  }
}
