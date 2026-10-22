/**
 * Exact tilings of small finite boards, with shared subproblems.
 *
 * This is a memoized exact-cover search, not an implementation of the paper's
 * full ZDD/DXZ algorithm. Each retained node is (uncovered cells, unused pieces).
 * Edges place one piece; the child counts sum to the exact number of completions.
 * Counting supports traverses that DAG, never an array of complete solutions.
 *
 * Deliberate prototype bounds: at most 40 active cells and 15 distinct pieces.
 * Cell occupancy uses two 26-bit words; numeric memo keys remain exact.
 * Rotations and reflections are allowed. Symmetric orientations are deduplicated.
 * Pieces are labeled; board rotations/reflections count as distinct tilings.
 */

const SHAPES = {
  I2: [
    [0, 0],
    [1, 0],
  ],
  I3: [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  V3: [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  L4: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  T4: [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  O4: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  I4: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  F: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [1, 2],
  ],
  I: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
  ],
  L: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 3],
  ],
  P: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0, 2],
  ],
  N: [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [1, 3],
  ],
  T: [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
    [1, 2],
  ],
  U: [
    [0, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  V: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  Y: [
    [0, 0],
    [0, 1],
    [1, 1],
    [0, 2],
    [0, 3],
  ],
};

const COLORS = [
  "#ed9d82",
  "#74c8b1",
  "#e6c36a",
  "#a3ade6",
  "#cf8db9",
  "#abd098",
  "#76b5dd",
  "#d5b69a",
  "#ca9e58",
  "#aa8bd8",
];
const MASK_BITS = 26;
const MASK_BASE = 2 ** MASK_BITS;
const rectangle = (width, height) =>
  Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => [x, y]),
  ).flat();
const pieces = (ids) =>
  ids.map((id, index) => ({
    id,
    name: id,
    color: COLORS[index % COLORS.length],
    cells: SHAPES[id],
  }));

export const BOARDS = [
  {
    id: "first-fit",
    name: "First fit",
    subtitle: "Five pieces. A small board with room to explore.",
    width: 4,
    height: 4,
    cells: rectangle(4, 4),
    pieces: pieces(["L4", "T4", "I3", "V3", "I2"]),
  },
  {
    id: "six-of-a-kind",
    name: "The long room",
    subtitle: "Six pentominoes, thirty squares.",
    width: 6,
    height: 5,
    cells: rectangle(6, 5),
    pieces: pieces(["F", "L", "P", "T", "U", "Y"]),
  },
  {
    id: "missing-corner",
    name: "Around the corner",
    subtitle: "An awkward corner changes the possibilities.",
    width: 6,
    height: 6,
    cells: rectangle(6, 6).filter(([x, y]) => !(x >= 4 && y < 3)),
    pieces: pieces(["L", "N", "P", "U", "V", "Y"]),
  },
  {
    id: "the-alcove",
    name: "The alcove",
    subtitle:
      "Eight different pieces, a missing corner, and thousands of ways home.",
    width: 6,
    height: 6,
    cells: rectangle(6, 6).filter(([x, y]) => !(x < 2 && y < 2)),
    pieces: pieces(["I3", "V3", "L4", "T4", "O4", "I4", "F", "P"]),
  },
  {
    id: "wide-open",
    name: "Wide open",
    subtitle: "Nine pieces and a much larger space of possible finishes.",
    width: 9,
    height: 4,
    cells: rectangle(9, 4),
    pieces: pieces(["L4", "T4", "I3", "V3", "I2", "L", "P", "U", "V"]),
  },
  {
    id: "million-ways",
    name: "A million ways",
    subtitle:
      "Ten different pieces, forty squares, and over a million possible finishes.",
    width: 8,
    height: 5,
    cells: rectangle(8, 5),
    pieces: pieces(["L4", "T4", "I3", "V3", "I2", "O4", "F", "L", "P", "U"]),
  },
];

const normalize = (cells) => {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
};
const cellKey = (cells) => cells.map(([x, y]) => `${x},${y}`).join(";");
const clock = () => globalThis.performance?.now() ?? Date.now();

export function getOrientations(cells) {
  const seen = new Set();
  const result = [];
  for (let reflected = 0; reflected < 2; reflected += 1) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      let transformed = cells.map(([x, y]) => [reflected ? -x : x, y]);
      for (let turn = 0; turn < rotation; turn += 1) {
        transformed = transformed.map(([x, y]) => [-y, x]);
      }
      transformed = normalize(transformed);
      const key = cellKey(transformed);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: result.length,
        cells: transformed,
        width: 1 + Math.max(...transformed.map(([x]) => x)),
        height: 1 + Math.max(...transformed.map(([, y]) => y)),
        reflected: Boolean(reflected),
        rotation,
      });
    }
  }
  return result;
}

// Geometry is deliberately search-free so the board can render immediately.
export function createGeometry(boardOrId) {
  const board =
    typeof boardOrId === "string"
      ? BOARDS.find((entry) => entry.id === boardOrId)
      : boardOrId;
  if (!board) throw new Error("Unknown board.");
  const boardCells = board.cells ?? rectangle(board.width, board.height);
  if (
    !boardCells.length ||
    boardCells.length > 40 ||
    !board.pieces.length ||
    board.pieces.length > 15
  ) {
    throw new Error(
      "This prototype supports 1–40 active cells and 1–15 pieces.",
    );
  }
  const cellIndex = new Map(
    boardCells.map(([x, y], index) => [`${x},${y}`, index]),
  );
  if (cellIndex.size !== boardCells.length)
    throw new Error("Board cells must be unique.");
  if (new Set(board.pieces.map(({ id }) => id)).size !== board.pieces.length) {
    throw new Error("Every piece needs a unique id.");
  }
  if (
    board.pieces.reduce((sum, piece) => sum + piece.cells.length, 0) !==
    boardCells.length
  ) {
    throw new Error("Piece area must exactly match the board area.");
  }
  // The largest combined key uses cells + pieces bits. Keep it below 2^53.
  if (boardCells.length + board.pieces.length > 52)
    throw new Error("State exceeds exact numeric key range.");
  const orientations = new Map();
  const placements = [];
  const byId = new Map();
  const byAnchor = new Map();

  board.pieces.forEach((piece, pieceIndex) => {
    const variants = getOrientations(piece.cells);
    orientations.set(piece.id, variants);
    for (const orientation of variants) {
      for (let y = 0; y <= board.height - orientation.height; y += 1) {
        for (let x = 0; x <= board.width - orientation.width; x += 1) {
          const cells = orientation.cells.map(([dx, dy]) => [x + dx, y + dy]);
          const indices = cells.map(([cx, cy]) => cellIndex.get(`${cx},${cy}`));
          if (indices.some((index) => index === undefined)) continue;
          const maskLow = indices
            .filter((i) => i < MASK_BITS)
            .reduce((value, i) => value | (2 ** i), 0);
          const maskHigh = indices
            .filter((i) => i >= MASK_BITS)
            .reduce((value, i) => value | (2 ** (i - MASK_BITS)), 0);
          const placement = {
            id: `${piece.id}:${orientation.id}:${x}:${y}`,
            pieceId: piece.id,
            cells,
            orientation: orientation.id,
            anchor: [x, y],
            maskLow,
            maskHigh,
            pieceBit: 2 ** pieceIndex,
          };
          placements.push(placement);
          byId.set(placement.id, placement);
          byAnchor.set(placement.id, placement);
        }
      }
    }
  });

  return {
    board: { ...board, cells: boardCells },
    placements,
    orientations,
    findPlacement: (pieceId, orientationId, x, y) =>
      byAnchor.get(`${pieceId}:${orientationId}:${x}:${y}`) ?? null,
    getPlacement: (id) => byId.get(id) ?? null,
  };
}

// Limits protect both the initial build and later conditioned searches. Hitting
// either limit throws; a partial count must never be mistaken for an exact one.
export function createPuzzle(
  boardOrId,
  { onProgress, maxStates = 2_500_000, maxMs = 30_000 } = {},
) {
  if (!Number.isSafeInteger(maxStates) || maxStates < 1)
    throw new Error("maxStates must be a positive safe integer.");
  if (!Number.isFinite(maxMs) || maxMs <= 0)
    throw new Error("maxMs must be a positive finite duration.");
  if (onProgress !== undefined && typeof onProgress !== "function")
    throw new Error("onProgress must be a function.");
  const started = clock();
  const geometry = createGeometry(boardOrId);
  const { board, placements } = geometry;
  const boardCells = board.cells;
  const fullLow = 2 ** Math.min(MASK_BITS, boardCells.length) - 1;
  const fullHigh = 2 ** Math.max(0, boardCells.length - MASK_BITS) - 1;
  const pieceStates = 2 ** board.pieces.length;
  const fullPieces = pieceStates - 1;
  const cellIndex = new Map(
    boardCells.map(([x, y], index) => [`${x},${y}`, index]),
  );
  const byCell = boardCells.map(() => []);
  const byId = new Map(
    placements.map((placement) => [placement.id, placement]),
  );
  for (const placement of placements) {
    for (const [x, y] of placement.cells)
      byCell[cellIndex.get(`${x},${y}`)].push(placement);
  }
  const memo = new Map();
  let operationStarted = started;
  let lastProgress = -Infinity;
  let phase = "counting";
  let ticks = 0;
  function checkProgress(force = false) {
    if (!force && (++ticks & 1023) !== 0) return;
    const now = clock();
    const elapsedMs = now - operationStarted;
    if (elapsedMs > maxMs)
      throw new Error(
        `Exact search exceeded the ${maxMs} ms time limit. Try another board or reset this board.`,
      );
    if (force || now - lastProgress >= 100) {
      onProgress?.({ nodes: memo.size, elapsedMs, phase });
      lastProgress = now;
    }
  }
  function beginOperation(nextPhase) {
    phase = nextPhase;
    operationStarted = clock();
    ticks = 0;
    lastProgress = -Infinity;
    checkProgress(true);
  }
  function retain(key, node) {
    if (!memo.has(key) && memo.size >= maxStates) {
      throw new Error(
        `Exact search reached the ${maxStates.toLocaleString("en-US")} retained-state limit. Reset this board to release its search history.`,
      );
    }
    memo.set(key, node);
    return node;
  }

  const EMPTY = { count: 1n, edges: [] };
  const DEAD = { count: 0n, edges: [] };
  let cacheHits = 0;
  let edgeCount = 0;

  function solve(freeLow, freeHigh, unused) {
    checkProgress();
    if (unused === 0) return freeLow === 0 && freeHigh === 0 ? EMPTY : DEAD;
    const key = (freeLow + freeHigh * MASK_BASE) * pieceStates + unused;
    const cached = memo.get(key);
    if (cached) {
      cacheHits += 1;
      return cached;
    }
    let choices = null;
    // Choosing the most constrained uncovered square makes the recurrence
    // deterministic, so each complete tiling has one and only one DAG path.
    let cellsLeft = freeLow;
    let cellOffset = 0;
    while (cellsLeft !== 0 || cellOffset === 0) {
      if (cellsLeft === 0) {
        cellsLeft = freeHigh;
        cellOffset = MASK_BITS;
        if (cellsLeft === 0) break;
      }
      const bit = cellsLeft & -cellsLeft;
      const index = cellOffset + 31 - Math.clz32(bit);
      cellsLeft ^= bit;
      const candidates = [];
      for (const placement of byCell[index]) {
        if (
          unused & placement.pieceBit &&
          (freeLow & placement.maskLow) === placement.maskLow &&
          (freeHigh & placement.maskHigh) === placement.maskHigh
        ) {
          candidates.push(placement);
        }
      }
      if (candidates.length === 0) {
        return retain(key, DEAD);
      }
      if (choices === null || candidates.length < choices.length)
        choices = candidates;
      if (choices.length === 1) break;
    }
    const edges = [];
    let count = 0n;
    for (const placement of choices ?? []) {
      const child = solve(
        freeLow ^ placement.maskLow,
        freeHigh ^ placement.maskHigh,
        unused ^ placement.pieceBit,
      );
      if (child.count === 0n) continue;
      edges.push({ placement, child });
      count += child.count;
    }
    const node = count === 0n ? DEAD : { count, edges };
    edgeCount += edges.length;
    return retain(key, node);
  }

  beginOperation("counting");
  const root = solve(fullLow, fullHigh, fullPieces);
  checkProgress(true);
  const buildMs = clock() - started;
  const analysisCache = new Map();

  function prepare(fixedIds) {
    let freeLow = fullLow;
    let freeHigh = fullHigh;
    let unused = fullPieces;
    const fixed = [];
    for (const id of fixedIds) {
      const placement = byId.get(id);
      if (!placement)
        return { valid: false, reason: "That placement is not on this board." };
      if (!(unused & placement.pieceBit))
        return { valid: false, reason: "Each piece can be placed only once." };
      if (
        (freeLow & placement.maskLow) !== placement.maskLow ||
        (freeHigh & placement.maskHigh) !== placement.maskHigh
      )
        return { valid: false, reason: "Pieces cannot overlap." };
      freeLow ^= placement.maskLow;
      freeHigh ^= placement.maskHigh;
      unused ^= placement.pieceBit;
      fixed.push(placement);
    }
    return { valid: true, freeLow, freeHigh, unused, fixed };
  }

  function analyze(fixedIds = []) {
    beginOperation("analyzing");
    const analysisStarted = clock();
    const prepared = prepare(fixedIds);
    const stats = (visitedNodes = 0) => ({
      nodes: memo.size,
      cacheHits,
      buildMs,
      edges: edgeCount,
      visitedNodes,
      analysisMs: clock() - analysisStarted,
    });
    if (!prepared.valid)
      return {
        count: 0n,
        supports: new Map(),
        forced: [],
        valid: false,
        reason: prepared.reason,
        stats: stats(),
      };
    const cacheKey = [...fixedIds].sort().join("|");
    if (analysisCache.has(cacheKey)) {
      const cached = analysisCache.get(cacheKey);
      return { ...cached, stats: stats(cached.stats.visitedNodes) };
    }
    const node =
      fixedIds.length === 0
        ? root
        : solve(prepared.freeLow, prepared.freeHigh, prepared.unused);
    const supports = new Map(placements.map(({ id }) => [id, 0n]));
    for (const placement of prepared.fixed)
      supports.set(placement.id, node.count);
    let layer = new Map([[node, 1n]]);
    let visitedNodes = 0;
    while (layer.size > 0) {
      const nextLayer = new Map();
      for (const [current, pathsToNode] of layer) {
        checkProgress();
        visitedNodes += 1;
        for (const { placement, child } of current.edges) {
          supports.set(
            placement.id,
            supports.get(placement.id) + pathsToNode * child.count,
          );
          nextLayer.set(child, (nextLayer.get(child) ?? 0n) + pathsToNode);
        }
      }
      layer = nextLayer;
    }
    const fixedSet = new Set(fixedIds);
    const forced =
      node.count > 0n
        ? placements.filter(
            ({ id }) => !fixedSet.has(id) && supports.get(id) === node.count,
          )
        : [];
    const result = {
      count: node.count,
      supports,
      forced,
      valid: true,
      stats: stats(visitedNodes),
    };
    checkProgress(true);
    analysisCache.set(cacheKey, result);
    // Each result owns a full support map. Keep extended play from retaining
    // every board arrangement ever visited; evicted analyses can be recomputed.
    if (analysisCache.size > 128)
      analysisCache.delete(analysisCache.keys().next().value);
    return result;
  }

  function completion(fixedIds = [], variant = 0) {
    beginOperation("completion");
    const prepared = prepare(fixedIds);
    if (!prepared.valid) return null;
    let node =
      fixedIds.length === 0
        ? root
        : solve(prepared.freeLow, prepared.freeHigh, prepared.unused);
    if (node.count === 0n) return null;
    let rank = BigInt(variant) % node.count;
    if (rank < 0n) rank += node.count;
    const result = [...fixedIds];
    while (node.edges.length > 0) {
      for (const edge of node.edges) {
        if (rank >= edge.child.count) {
          rank -= edge.child.count;
          continue;
        }
        result.push(edge.placement.id);
        node = edge.child;
        break;
      }
    }
    checkProgress(true);
    return result;
  }

  return { ...geometry, analyze, completion };
}
