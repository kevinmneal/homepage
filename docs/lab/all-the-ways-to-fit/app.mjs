import { BOARDS, createGeometry } from "./engine.mjs";
import { BackgroundSolver, stateKey } from "./background-solver.mjs";
import { grabPoint, transformGrab, dragPosition } from "./drag-geometry.mjs";
import {
  choiceSummary,
  nudgePiece,
  describeChange,
} from "./possibility-insights.mjs";
import { wrapRank, changedPieces } from "./finish-comparison.mjs";

const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries(
  [
    "board-picker",
    "board-label",
    "progress",
    "board",
    "board-stage",
    "board-help",
    "pieces",
    "selection-label",
    "selection-options",
    "count",
    "count-description",
    "count-badge",
    "retry-count",
    "possibility-panel",
    "preview-line",
    "trail",
    "rotate",
    "flip",
    "place",
    "undo",
    "reset",
    "hint",
    "peek",
    "message",
    "engine-stats",
    "solved-stamp",
    "another-fit",
    "finish-browser",
    "finish-label",
    "finish-prev",
    "finish-next",
    "finish-description",
    "finish-pieces",
    "finish-retry",
  ].map((id) => [id, $(id)]),
);
const names = {
  L4: "Elbow",
  T4: "Little tee",
  O4: "Square",
  S4: "Zigzag",
  I4: "Long bar",
  I3: "Bar",
  V3: "Corner",
  I2: "Domino",
  F: "Fork",
  I: "Rail",
  L: "Long L",
  P: "Pocket",
  T: "Tee",
  U: "Cup",
  Y: "Branch",
  N: "Step",
  V: "Angle",
};
const fmt = (n) => (n == null ? "…" : n.toLocaleString("en-US"));
const keyOf = ([x, y]) => `${x},${y}`;
const normalize = (cells) => {
  const xMin = Math.min(...cells.map((c) => c[0])),
    yMin = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([x, y]) => [x - xMin, y - yMin])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
};
const shapeKey = (cells) => normalize(cells).map(keyOf).join(";");

let puzzle,
  analysis,
  initialCount,
  selectedId,
  fixedIds = [],
  orientations = new Map();
let cursor = null,
  preview = null,
  history = [],
  peekIds = [],
  hintedId = null;
let lastPointerType = window.matchMedia("(pointer: coarse)").matches
  ? "touch"
  : "mouse";
let cellElements = new Map(),
  pieceElements = new Map(),
  activeCells = new Set(),
  placedByCell = new Map();
let chosenBoard =
  BOARDS.find((board) => board.id === location.hash.slice(1))?.id ||
  BOARDS[0].id;
let drag = null,
  suppressClickUntil = 0;
let predictedCount = null,
  currentCompletion = [],
  solverProgress = null,
  countError = null;
let choices = null,
  nudge = null;
let browsing = null;
const puzzles = new Map();
const dragGhost = document.createElement("div");
dragGhost.className = "drag-ghost";
dragGhost.hidden = true;
dragGhost.setAttribute("aria-hidden", "true");
document.body.append(dragGhost);

const solver = new BackgroundSolver({
  onInitial(count) {
    initialCount = count;
    history[0].count = count;
  },
  onSnapshot(key, result) {
    for (const step of history)
      if (stateKey(step.fixedIds) === key) step.count = result.analysis.count;
    if (drag?.active && stateKey(drag.before.fixedIds) === key) {
      drag.before.analysis = result.analysis;
      drag.before.count = result.analysis.count;
      drag.before.currentCompletion = result.completion || [];
    }
    // A completed older request can fill in history, but never change the
    // count, hints, or peek for the arrangement now on the board.
    if (key === stateKey(fixedIds)) {
      analysis = result.analysis;
      predictedCount = analysis.count;
      currentCompletion = result.completion || [];
      countError = null;
      solverProgress = null;
      if (!drag?.active && analysis.count === 0n)
        message(
          "The pieces fit, but there’s no way to fill the space that remains. Undo, or lift a tile to try again.",
          true,
        );
    }
    render();
  },
  onProgress(stats) {
    solverProgress = stats;
    if (!analysis) renderStats();
  },
  onError(error) {
    countError = error;
    analysis = null;
    currentCompletion = [];
    closeFinishes();
    render();
  },
  onCompletion(key, rank, ids) {
    if (
      !browsing ||
      key !== stateKey(fixedIds) ||
      key !== browsing.key ||
      rank !== browsing.rank
    )
      return;
    if (browsing.shownRank !== rank) {
      browsing.changed = changedPieces(puzzle, peekIds, ids, fixedIds);
      browsing.previousRank = browsing.shownRank;
    }
    browsing.shownRank = rank;
    browsing.loading = false;
    browsing.error = null;
    peekIds = [...ids];
    render();
  },
  onCompletionError(error) {
    if (browsing) {
      browsing.loading = false;
      browsing.error = error;
      render();
    }
  },
});

function closeFinishes() {
  browsing = null;
  peekIds = [];
  solver.cancelCompletion();
}

function refreshAnalysis(countHint = null) {
  closeFinishes();
  analysis = null;
  predictedCount = countHint;
  currentCompletion = [];
  countError = null;
  solverProgress = null;
  render();
  solver.request(fixedIds);
}

function pieceName(id) {
  return names[id] || id;
}
function piece(id) {
  return puzzle.board.pieces.find((p) => p.id === id);
}
function orient() {
  return selectedId
    ? puzzle.orientations.get(selectedId)[orientations.get(selectedId) || 0]
    : null;
}
function used(id) {
  return fixedIds.some((p) => puzzle.getPlacement(p).pieceId === id);
}
function message(text, important = false) {
  ui.message.textContent = text;
  ui.message.classList.toggle("important", important);
}

function shapeSVG(cells, color) {
  const normalized = normalize(cells),
    w = Math.max(...normalized.map((c) => c[0])) + 1,
    h = Math.max(...normalized.map((c) => c[1])) + 1;
  return `<svg viewBox="-1 -1 ${w * 12 + 2} ${h * 12 + 2}" aria-hidden="true">${normalized.map(([x, y]) => `<rect x="${x * 12}" y="${y * 12}" width="12" height="12" rx="1" fill="${color}" stroke="#102b32" stroke-width=".65"/>`).join("")}</svg>`;
}

function selectBoard(id) {
  finishDrag(false);
  closeFinishes();
  const reuseSearch = Boolean(
    puzzle && id === chosenBoard && solver.boardId === id && !solver.failed,
  );
  const rootCount = reuseSearch ? initialCount : null;
  chosenBoard = id;
  if (!puzzles.has(id)) puzzles.set(id, createGeometry(id));
  puzzle = puzzles.get(id);
  window.history.replaceState(null, "", `#${id}`);
  fixedIds = [];
  orientations = new Map();
  cursor = null;
  preview = null;
  peekIds = [];
  hintedId = null;
  nudge = null;
  analysis = null;
  initialCount = rootCount;
  predictedCount = rootCount;
  currentCompletion = [];
  solverProgress = null;
  countError = null;
  history = [{ count: initialCount, placement: null, fixedIds: [] }];
  selectedId = puzzle.board.pieces[0].id;
  activeCells = new Set(puzzle.board.cells.map(keyOf));
  ui["board-picker"].innerHTML = BOARDS.map(
    (board, i) =>
      `<button class="board-option" aria-pressed="${board.id === id}" data-board="${board.id}" title="${board.subtitle}"><span class="board-num">0${i + 1}</span><span class="board-copy"><span>${board.name}</span><span class="board-meta">${board.pieces.length} pieces · ${board.cells.length} squares</span></span></button>`,
  ).join("");
  ui.pieces.classList.toggle("many-pieces", puzzle.board.pieces.length > 6);
  ui.board.classList.toggle("large-board", puzzle.board.pieces.length > 6);
  ui["board-label"].textContent = puzzle.board.name.toUpperCase();
  ui.board.setAttribute(
    "aria-label",
    `${puzzle.board.name}, ${puzzle.board.width} by ${puzzle.board.height} board. Use arrow keys to position a piece, R to rotate, F to flip, Enter to place.`,
  );
  ui.board.setAttribute("aria-rowcount", puzzle.board.height);
  ui.board.setAttribute("aria-colcount", puzzle.board.width);
  ui.board.style.gridTemplateColumns = `repeat(${puzzle.board.width},1fr)`;
  ui.board.style.setProperty(
    "--board-ratio",
    `${puzzle.board.width}/${puzzle.board.height}`,
  );
  ui.board.style.setProperty(
    "--board-width",
    `${puzzle.board.pieces.length > 6 ? 520 : Math.min(385, (340 * puzzle.board.width) / puzzle.board.height)}px`,
  );
  ui.board.innerHTML = "";
  cellElements = new Map();
  for (let y = 0; y < puzzle.board.height; y++) {
    const row = document.createElement("div");
    row.className = "board-row";
    row.setAttribute("role", "row");
    ui.board.append(row);
    for (let x = 0; x < puzzle.board.width; x++) {
      const button = document.createElement("button");
      button.className = "cell";
      button.dataset.x = x;
      button.dataset.y = y;
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-rowindex", y + 1);
      button.setAttribute("aria-colindex", x + 1);
      button.tabIndex =
        x === puzzle.board.cells[0][0] && y === puzzle.board.cells[0][1]
          ? 0
          : -1;
      if (!activeCells.has(`${x},${y}`)) {
        button.disabled = true;
        button.setAttribute(
          "aria-label",
          `Row ${y + 1}, column ${x + 1}, outside board`,
        );
      }
      row.append(button);
      cellElements.set(`${x},${y}`, button);
    }
  }
  ui.pieces.innerHTML = puzzle.board.pieces
    .map(
      (p, i) =>
        `<button class="piece-card" data-piece="${p.id}" style="--piece-color:${p.color}" aria-label="Choose ${pieceName(p.id)}"><span class="piece-art">${shapeSVG(p.cells, p.color)}</span><span class="piece-number">${pieceName(p.id)}</span></button>`,
    )
    .join("");
  pieceElements = new Map(
    [...ui.pieces.querySelectorAll("button")].map((b) => [b.dataset.piece, b]),
  );
  message(
    "Drag a tile onto the board. Rotations and flips are allowed. Use every piece once.",
  );
  render();
  if (reuseSearch) solver.request([]);
  else solver.load(id);
}

function derivePreview() {
  preview = null;
  if (browsing || !selectedId || !cursor || used(selectedId)) return;
  const o = orient();
  const cells = o.cells.map(([x, y]) => [x + cursor[0], y + cursor[1]]);
  const placement = puzzle.findPlacement(selectedId, o.id, ...cursor);
  const overlap = cells.some((c) => placedByCell.has(keyOf(c)));
  const valid = Boolean(placement) && !overlap;
  preview = {
    cells,
    placement,
    valid,
    count: valid && analysis ? analysis.supports.get(placement.id) || 0n : null,
    overlap,
  };
}

function render() {
  placedByCell = new Map();
  for (const id of fixedIds) {
    const p = puzzle.getPlacement(id);
    for (const c of p.cells) placedByCell.set(keyOf(c), p);
  }
  choices = choiceSummary(puzzle, analysis, fixedIds);
  derivePreview();
  ui.progress.textContent = `${fixedIds.length} / ${puzzle.board.pieces.length} placed`;
  const shownCount = drag?.active
    ? drag.before.count
    : (analysis?.count ?? predictedCount);
  ui.count.textContent =
    countError && shownCount === null ? "—" : fmt(shownCount);
  ui.count.classList.toggle("long", fmt(shownCount).length > 6);
  const solved = fixedIds.length === puzzle.board.pieces.length;
  ui["possibility-panel"].classList.toggle("dead", shownCount === 0n);
  ui["possibility-panel"].classList.toggle("solved", solved);
  ui["possibility-panel"].classList.toggle(
    "counting",
    !analysis && !countError,
  );
  ui.count.setAttribute("aria-busy", String(!analysis && !countError));
  ui["count-badge"].textContent = countError
    ? "COUNT PAUSED"
    : !analysis
      ? "COUNTING"
      : "EXACT COUNT";
  ui["retry-count"].hidden = !countError;
  const remaining = puzzle.board.pieces.length - fixedIds.length;
  const forcedCount = choices
    ? [...choices.values()].filter((n) => n === 1).length
    : 0;
  const choiceDescription = forcedCount
    ? `${forcedCount} of the ${remaining} remaining pieces ${forcedCount === 1 ? "has" : "have"} just one possible fit.`
    : fixedIds.length
      ? `Each of the ${remaining} remaining pieces still has more than one possible fit.`
      : `${remaining} pieces. Try a hunch and see what changes.`;
  ui["count-description"].textContent = countError
    ? "The count stopped. Your tiles are safe."
    : drag?.active
      ? "Before this move · release to place."
      : solved
        ? "You found a complete tiling."
        : !analysis
          ? shownCount === null
            ? "Counting the possibilities. Keep playing."
            : `${fmt(shownCount)} tilings remain. Checking next moves…`
          : shownCount === 0n
            ? "No way to finish. Lift a tile or undo."
            : shownCount === 1n
              ? `The rest is determined. ${remaining} ${remaining === 1 ? "piece" : "pieces"} still to place.`
              : choiceDescription;
  ui["solved-stamp"].hidden = !solved;
  ui.undo.disabled = history.length <= 1 || Boolean(drag?.active);
  ui.hint.disabled =
    solved || !analysis || analysis.count === 0n || Boolean(drag?.active);
  ui.hint.textContent = nudge ? "Show a place ↗" : "A little nudge ↗";
  ui.peek.disabled =
    solved || !analysis || analysis.count === 0n || Boolean(drag?.active);
  ui.peek.textContent = browsing ? "Back to playing" : "Browse finishes";
  ui.peek.setAttribute("aria-expanded", String(Boolean(browsing)));
  ui.peek.classList.toggle("active", peekIds.length > 0);
  ui.rotate.disabled = !selectedId;
  ui.flip.disabled = !selectedId;
  ui["selection-label"].textContent = selectedId
    ? `${pieceName(selectedId)} selected`
    : solved
      ? "All home"
      : "Pick one";
  const selectedChoices = choices?.get(selectedId);
  ui["selection-options"].textContent = !selectedId
    ? ""
    : selectedChoices != null
      ? `${fmt(selectedChoices)} possible ${selectedChoices === 1 ? "fit" : "fits"}`
      : analysis?.count === 0n
        ? "No finish from here"
        : countError
          ? "Fits not counted"
          : "Counting fits…";
  ui["selection-options"].setAttribute(
    "aria-label",
    selectedChoices != null
      ? `${pieceName(selectedId)} has ${selectedChoices} ${selectedChoices === 1 ? "placement that allows" : "placements that allow"} a complete tiling, including rotations and flips.`
      : ui["selection-options"].textContent,
  );
  for (const [id, el] of pieceElements) {
    const isUsed = used(id);
    el.disabled = isUsed;
    el.classList.toggle("placed", isUsed);
    el.setAttribute("aria-pressed", String(id === selectedId));
    el.classList.toggle("lifting", Boolean(drag?.active && id === selectedId));
    el.classList.toggle(
      "comparison-changed",
      Boolean(browsing?.changed.has(id)),
    );
    el.setAttribute(
      "aria-label",
      `${isUsed ? "Placed" : "Choose"} ${pieceName(id)}`,
    );
    el.querySelector(".piece-number").textContent = isUsed
      ? `${pieceName(id)} ✓`
      : pieceName(id);
    const p = piece(id),
      o = puzzle.orientations.get(id)[orientations.get(id) || 0];
    el.querySelector(".piece-art").innerHTML = shapeSVG(o.cells, p.color);
  }
  renderTrail();
  renderPreview();
  renderBoard();
  renderStats();
  renderFinishes();
}

function renderPreview() {
  ui["preview-line"].classList.toggle(
    "warning",
    Boolean(preview && !preview.valid) ||
      Boolean(preview && preview.count === 0n) ||
      (!cursor && !drag?.active && history.at(-1)?.count === 0n),
  );
  let main = "",
    detail = "";
  if (browsing) {
    main = "Preview only · your tiles stay put.";
    detail =
      analysis.count === 1n
        ? "There is just one possible finish."
        : "Browse another finish to see which pieces move.";
  } else if (!selectedId) {
    main =
      fixedIds.length === puzzle.board.pieces.length
        ? "Every piece is in its place."
        : "Choose another piece.";
  } else if (!cursor) {
    const latest = history.at(-1),
      previous = history.at(-2);
    const change =
      previous && describeChange(previous.count, latest.count, latest.kind);
    if (drag?.active) main = "Bring the tile over the board.";
    else if (change) {
      main = `${fmt(previous.count)} → ${fmt(latest.count)}`;
      detail = `Last move · ${change.toLowerCase()}`;
    } else main = "Pick up a tile to compare a few possibilities.";
  } else if (!preview.valid) {
    main = preview.overlap
      ? "Those squares are already taken."
      : "The piece needs to stay on the board.";
  } else if (preview.count === null) {
    main = countError
      ? "Fits here · count unavailable."
      : "Fits here · counting possible finishes…";
  } else {
    const before = drag?.active ? drag.before.count : analysis.count;
    main = `${fmt(before)} → ${fmt(preview.count)} ${preview.count === 1n ? "way" : "ways"}`;
    detail =
      describeChange(
        before,
        preview.count,
        drag?.sourceId ? "move" : "place",
      ) || "Counting the starting possibilities…";
  }
  const mainLine = document.createElement("span");
  mainLine.className = "preview-main";
  mainLine.textContent = main;
  const detailLine = document.createElement("span");
  detailLine.className = "preview-detail";
  detailLine.textContent = detail;
  ui["preview-line"].replaceChildren(mainLine, detailLine);
  ui.place.disabled = !preview?.valid;
  ui.place.classList.toggle(
    "dead",
    Boolean(preview?.valid && preview.count === 0n),
  );
  ui.place.textContent = preview?.valid
    ? preview.count === 0n
      ? "Place anyway — explore the dead end"
      : `Place ${pieceName(selectedId).toLowerCase()} here`
    : selectedId
      ? "Choose a place on the board"
      : "All pieces placed";
  const baseHelp =
    lastPointerType === "touch"
      ? "Drag a tile · or tap to preview, then tap again to place"
      : "Drag tiles to place or move · R rotate · F flip · Z undo";
  ui["board-help"].textContent = drag?.active
    ? "Release to place · R rotate · F flip · Esc to put it back"
    : browsing
      ? "Preview only · choose a piece or press Escape to keep playing."
      : fixedIds.length === puzzle.board.pieces.length
        ? "A lovely fit. You can still pick up any tile."
        : baseHelp;
}

function renderBoard() {
  const ghost = new Map();
  for (const id of peekIds) {
    const p = puzzle.getPlacement(id);
    if (!fixedIds.includes(id)) for (const c of p.cells) ghost.set(keyOf(c), p);
  }
  const previewCells = new Set(preview?.cells.map(keyOf) || []);
  const hintPlacement = hintedId ? puzzle.getPlacement(hintedId) : null;
  const hintCells = new Set(hintPlacement?.cells.map(keyOf) || []);
  for (const [key, el] of cellElements) {
    const [x, y] = key.split(",").map(Number),
      placed = placedByCell.get(key),
      peek = ghost.get(key);
    const isPreview = previewCells.has(key),
      inactive = !activeCells.has(key);
    el.className = `cell${inactive ? " inactive" : ""}${placed ? " filled" : ""}${peek && !placed && !isPreview ? " peek" : ""}${isPreview ? " preview" : ""}${isPreview && !preview.valid ? " invalid" : ""}${isPreview && preview.valid && preview.count === 0n ? " dead" : ""}${hintCells.has(key) ? " forced" : ""}${cursor && cursor[0] === x && cursor[1] === y ? " active-cursor" : ""}`;
    if (peek && !placed && browsing && browsing.previousRank !== null) {
      el.classList.add(
        browsing.changed.has(peek.pieceId)
          ? "finish-changed"
          : "finish-unchanged",
      );
    }
    const currentColor = isPreview
      ? piece(selectedId).color
      : placed
        ? piece(placed.pieceId).color
        : peek
          ? piece(peek.pieceId).color
          : null;
    if (currentColor) el.style.setProperty("--piece-color", currentColor);
    else el.style.removeProperty("--piece-color");
    const borderCells = isPreview
      ? previewCells
      : placed
        ? new Set(placed.cells.map(keyOf))
        : peek
          ? new Set(peek.cells.map(keyOf))
          : null;
    for (const [side, dx, dy] of [
      ["top", 0, -1],
      ["right", 1, 0],
      ["bottom", 0, 1],
      ["left", -1, 0],
    ])
      el.dataset[side] = String(
        Boolean(borderCells && !borderCells.has(`${x + dx},${y + dy}`)),
      );
    if (!inactive)
      el.setAttribute(
        "aria-label",
        `Row ${y + 1}, column ${x + 1}${placed ? `, ${pieceName(placed.pieceId)} placed, drag to move or click to lift` : peek ? `, ${pieceName(peek.pieceId)} finish preview${browsing?.changed.has(peek.pieceId) ? ", changed from previous finish" : ""}` : isPreview ? `, ${pieceName(selectedId)} preview` : ", empty"}`,
      );
    el.setAttribute("aria-selected", String(Boolean(isPreview)));
  }
}

function renderFinishes() {
  ui["finish-browser"].hidden = !browsing;
  ui.board.classList.toggle("browsing-finishes", Boolean(browsing));
  if (!browsing) return;
  const total = analysis.count;
  ui["finish-label"].textContent =
    `Finish ${fmt(browsing.shownRank + 1n)} of ${fmt(total)}`;
  ui["finish-browser"].setAttribute("aria-busy", String(browsing.loading));
  ui["finish-prev"].disabled = total < 2n;
  ui["finish-next"].disabled = total < 2n;
  ui["finish-retry"].hidden = !browsing.error;
  ui["finish-retry"].textContent = solver.failed
    ? "Restart counting ↻"
    : "Try this finish again ↻";
  const changed = browsing.changed.size;
  ui["finish-description"].textContent = browsing.error
    ? "This finish could not load. Your board is unchanged."
    : browsing.loading
      ? `Loading finish ${fmt(browsing.rank + 1n)}…`
      : browsing.previousRank === null
        ? total === 1n
          ? "This is the only finish. The faint tiles fill the remaining space."
          : "Next or Previous compares another finish with this one."
        : `${changed} ${changed === 1 ? "tile changes" : "tiles change"} from finish ${fmt(browsing.previousRank + 1n)}. Bright outlines mark their new positions.`;
  ui["finish-description"].setAttribute(
    "aria-label",
    `${ui["finish-label"].textContent}. ${ui["finish-description"].textContent}`,
  );
  ui["finish-pieces"].replaceChildren(
    ...puzzle.board.pieces
      .filter((p) => browsing.changed.has(p.id))
      .map((p) => {
        const label = document.createElement("span");
        label.className = "changed-piece";
        label.style.setProperty("--piece-color", p.color);
        label.textContent = pieceName(p.id);
        return label;
      }),
  );
}

function renderTrail() {
  ui.trail.innerHTML = history
    .map(
      (step, i) =>
        `${i ? '<span class="trail-arrow" aria-hidden="true">→</span>' : ""}<button class="trail-step${step.count === 0n ? " dead" : ""}" data-step="${i}" aria-label="Return to ${i === 0 ? "the empty board" : `move ${i}`}, ${fmt(step.count)} ${step.count === 1n ? "completion" : "completions"}" ${i === history.length - 1 ? 'aria-current="step"' : ""} style="--step-color:${step.placement ? piece(puzzle.getPlacement(step.placement).pieceId).color : "#a4b8b8"}"><span></span>${fmt(step.count)}</button>`,
    )
    .join("");
}

function renderStats() {
  const s = analysis?.stats;
  ui["engine-stats"].innerHTML =
    `<div class="engine-stat"><strong>${fmt(initialCount)}</strong><span>INITIAL TILINGS</span></div><div class="engine-stat"><strong>${fmt(s?.nodes ?? solverProgress?.nodes)}</strong><span>CACHED SUBPROBLEMS</span></div><div class="engine-stat"><strong>${s ? `${(s.buildMs / 1000).toFixed(2)} s` : solverProgress ? `${(solverProgress.elapsedMs / 1000).toFixed(1)} s` : "…"}</strong><span>${s ? "INITIAL SEARCH" : "COUNTING TIME"}</span></div>`;
  if (countError) {
    const detail = document.createElement("p");
    detail.className = "count-error";
    detail.textContent = countError;
    ui["engine-stats"].append(detail);
  }
}

function selectPiece(id) {
  if (drag?.active || used(id)) return;
  closeFinishes();
  selectedId = id;
  peekIds = [];
  hintedId = null;
  nudge = null;
  message(
    `Choose a place for the ${pieceName(id).toLowerCase()}. Rotate or flip it to explore other fits.`,
  );
  render();
}

function moveCursor(x, y) {
  if (cursor && cursor[0] === x && cursor[1] === y) return;
  cursor = [x, y];
  hintedId = null;
  derivePreview();
  renderPreview();
  renderBoard();
}

function transformPiece(kind) {
  if (!selectedId) return;
  closeFinishes();
  const o = orient(),
    transformed = o.cells.map(([x, y]) =>
      kind === "rotate" ? [-y, x] : [-x, y],
    );
  const next = puzzle.orientations
    .get(selectedId)
    .find((candidate) => shapeKey(candidate.cells) === shapeKey(transformed));
  if (next) {
    if (drag?.active) drag.grab = transformGrab(o.cells, drag.grab, kind);
    orientations.set(selectedId, next.id);
    hintedId = null;
    peekIds = [];
    if (drag?.active) updateDrag(drag.point);
    render();
  }
}

function rememberMove(placement, count, kind = "place") {
  history.push({ count, placement, kind, fixedIds: [...fixedIds] });
}

function placePreview(replacing = null) {
  if (!preview?.valid) return;
  closeFinishes();
  const p = preview.placement,
    countHint = preview.count;
  if (replacing)
    fixedIds = replacing.fixedIds.map((id) =>
      id === replacing.sourceId ? p.id : id,
    );
  else fixedIds.push(p.id);
  rememberMove(p.id, countHint, replacing ? "move" : "place");
  selectedId = puzzle.board.pieces.find((piece) => !used(piece.id))?.id || null;
  cursor = null;
  peekIds = [];
  hintedId = null;
  nudge = null;
  if (countHint === 0n)
    message(
      "The piece fits, but the remaining pieces can’t fill the space. Undo, or click a placed piece to lift it.",
      true,
    );
  else if (fixedIds.length === puzzle.board.pieces.length)
    message(
      `One of ${fmt(initialCount)} ways. Try another arrangement, or explore the next board.`,
      true,
    );
  else
    message(
      "Keep going. You can lift a placed piece by clicking it, or revisit any step below the board.",
    );
  refreshAnalysis(countHint);
}

function returnToStep(step) {
  if (drag?.active || step === history.length - 1) return;
  closeFinishes();
  fixedIds = [...history[step].fixedIds];
  history = history.slice(0, step + 1);
  selectedId = puzzle.board.pieces.find((p) => !used(p.id))?.id || null;
  cursor = null;
  peekIds = [];
  hintedId = null;
  nudge = null;
  message("A little room to try something else.");
  refreshAnalysis(history[step].count);
}

function removePiece(id) {
  closeFinishes();
  const removed = puzzle.getPlacement(id);
  fixedIds = fixedIds.filter((p) => p !== id);
  selectedId = removed.pieceId;
  orientations.set(selectedId, removed.orientation);
  cursor = null;
  peekIds = [];
  hintedId = null;
  nudge = null;
  rememberMove(id, null, "lift");
  message(
    `${pieceName(selectedId)} lifted. The other pieces stay where you put them.`,
  );
  refreshAnalysis();
}

function giveHint() {
  if (drag?.active || !analysis?.count) return;
  closeFinishes();
  const key = stateKey(fixedIds);
  if (!nudge || nudge.key !== key || nudge.pieceId !== selectedId) {
    const id = nudgePiece(choices, selectedId);
    if (!id) return;
    selectedId = id;
    cursor = null;
    peekIds = [];
    hintedId = null;
    nudge = { key, pieceId: id };
    const fits = choices.get(id);
    message(
      fits === 1
        ? `The ${pieceName(id).toLowerCase()} has just one possible fit. See if you can find it.`
        : `Try the ${pieceName(id).toLowerCase()}: it has only ${fits} possible fits across all rotations and flips, the fewest of the remaining pieces.`,
      true,
    );
    render();
    return;
  }
  const placement = puzzle.placements
    .filter((p) => p.pieceId === selectedId && analysis.supports.get(p.id) > 0n)
    .sort((a, b) => {
      const ac = analysis.supports.get(a.id),
        bc = analysis.supports.get(b.id);
      return ac > bc ? -1 : ac < bc ? 1 : 0;
    })[0];
  if (!placement) return;
  orientations.set(selectedId, placement.orientation);
  cursor = [...placement.anchor];
  peekIds = [];
  hintedId = placement.id;
  nudge = null;
  const remaining = analysis.supports.get(placement.id);
  message(
    remaining === analysis.count
      ? `The ${pieceName(selectedId).toLowerCase()} must go here: every remaining tiling includes this placement.`
      : `Here’s a place for the ${pieceName(selectedId).toLowerCase()} that leaves ${fmt(remaining)} ${remaining === 1n ? "way" : "ways"} to finish.`,
    true,
  );
  render();
}

function peek() {
  if (drag?.active || !analysis?.count) return;
  nudge = null;
  if (browsing) {
    closeFinishes();
    message("Back to your own path.");
  } else {
    browsing = {
      key: stateKey(fixedIds),
      rank: 0n,
      shownRank: 0n,
      previousRank: null,
      changed: new Set(),
      loading: false,
      error: null,
    };
    peekIds = [...currentCompletion];
    cursor = null;
    hintedId = null;
    message(
      "Faint pieces show a possible finish. Nothing has been placed.",
      true,
    );
  }
  derivePreview();
  render();
}

function browseFinish(direction) {
  if (!browsing || !analysis?.count) return;
  browsing.rank = wrapRank(browsing.rank + BigInt(direction), analysis.count);
  browsing.loading = true;
  browsing.error = null;
  renderFinishes();
  solver.requestCompletion(fixedIds, browsing.rank);
}

function boardGeometry() {
  const rect = ui.board.getBoundingClientRect();
  const left = rect.left + ui.board.clientLeft,
    top = rect.top + ui.board.clientTop;
  return {
    left,
    top,
    right: left + ui.board.clientWidth,
    bottom: top + ui.board.clientHeight,
    cellWidth: ui.board.clientWidth / puzzle.board.width,
    cellHeight: ui.board.clientHeight / puzzle.board.height,
  };
}

function prepareDrag(event) {
  if (drag || !event.isPrimary || event.button !== 0) return;
  suppressClickUntil = 0;
  lastPointerType = event.pointerType || "mouse";
  const card = event.target.closest("[data-piece]"),
    cell = event.target.closest(".cell");
  const source = cell
    ? placedByCell.get(`${cell.dataset.x},${cell.dataset.y}`)
    : null;
  if (!source && (!card || card.disabled)) return;
  const id = source?.pieceId || card.dataset.piece;
  const orientation = source?.orientation ?? (orientations.get(id) || 0);
  const shape = puzzle.orientations.get(id)[orientation];
  let point;
  if (source) {
    const board = boardGeometry();
    point = [
      (event.clientX - board.left) / board.cellWidth - source.anchor[0],
      (event.clientY - board.top) / board.cellHeight - source.anchor[1],
    ];
  } else {
    const svg = card.querySelector("svg"),
      rect = svg.getBoundingClientRect();
    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        svg.getScreenCTM().inverse(),
      );
      point = [local.x / 12, local.y / 12];
    } else point = shape.cells[0].map((n) => n + 0.5);
  }
  drag = {
    pointerId: event.pointerId,
    id,
    sourceId: source?.id || null,
    orientation,
    grab: grabPoint(shape.cells, point),
    start: [event.clientX, event.clientY],
    point: [event.clientX, event.clientY],
    capture: source ? ui.board : ui.pieces,
    active: false,
  };
}

function activateDrag() {
  closeFinishes();
  drag.before = {
    fixedIds: [...fixedIds],
    analysis,
    count: analysis?.count ?? predictedCount,
    currentCompletion: [...currentCompletion],
    selectedId,
    orientations: new Map(orientations),
    cursor: cursor && [...cursor],
    peekIds: [...peekIds],
    hintedId,
  };
  drag.active = true;
  drag.capture.setPointerCapture(drag.pointerId);
  if (drag.sourceId) fixedIds = fixedIds.filter((id) => id !== drag.sourceId);
  selectedId = drag.id;
  orientations.set(selectedId, drag.orientation);
  cursor = null;
  peekIds = [];
  hintedId = null;
  nudge = null;
  document.body.classList.add("dragging");
  dragGhost.hidden = false;
  message(
    `${pieceName(selectedId)} picked up. Drop it on the board, or press Escape to put it back.`,
  );
  if (drag.sourceId) refreshAnalysis();
  else render();
}

function updateDrag(point) {
  drag.point = point;
  const board = boardGeometry(),
    position = dragPosition(point, drag.grab, board),
    o = orient();
  cursor = position.anchor;
  derivePreview();
  renderPreview();
  renderBoard();
  // The floating tile stays under the grabbed square; the board shows the snap.
  dragGhost.style.left = `${position.left}px`;
  dragGhost.style.top = `${position.top}px`;
  dragGhost.style.width = `${o.width * board.cellWidth}px`;
  dragGhost.style.height = `${o.height * board.cellHeight}px`;
  dragGhost.innerHTML = `<svg viewBox="0 0 ${o.width * 12} ${o.height * 12}">${o.cells.map(([x, y]) => `<rect x="${x * 12 + 0.4}" y="${y * 12 + 0.4}" width="11.2" height="11.2" rx=".6" fill="${piece(selectedId).color}" stroke="#102b3277" stroke-width=".25"/>`).join("")}</svg>`;
  dragGhost.classList.toggle("over-board", Boolean(cursor));
  dragGhost.classList.toggle("invalid", Boolean(cursor && !preview?.valid));
}

function finishDrag(commit = false) {
  if (!drag) return;
  const ending = drag;
  drag = null;
  if (ending.capture.hasPointerCapture(ending.pointerId))
    ending.capture.releasePointerCapture(ending.pointerId);
  if (!ending.active) return;
  suppressClickUntil = performance.now() + 700;
  document.body.classList.remove("dragging");
  dragGhost.hidden = true;
  const unchanged = preview?.placement?.id === ending.sourceId;
  if (commit && preview?.valid && !unchanged) {
    placePreview(
      ending.sourceId
        ? { sourceId: ending.sourceId, fixedIds: ending.before.fixedIds }
        : null,
    );
  } else {
    ({
      fixedIds,
      analysis,
      selectedId,
      orientations,
      cursor,
      peekIds,
      hintedId,
      currentCompletion,
    } = ending.before);
    predictedCount = ending.before.count;
    // A restored hover preview could cover the tile we just put back.
    cursor = null;
    hintedId = null;
    peekIds = [];
    message(
      unchanged
        ? "Back in the same place."
        : ending.sourceId
          ? "Tile put back. The board is unchanged."
          : "Tile returned to the tray. Try another spot.",
    );
    render();
    solver.request(fixedIds);
  }
}

ui.pieces.addEventListener("pointerdown", prepareDrag);
ui.board.addEventListener("pointerdown", prepareDrag);
document.addEventListener(
  "pointermove",
  (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = [event.clientX, event.clientY];
    if (
      !drag.active &&
      Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]) < 6
    )
      return;
    event.preventDefault();
    if (!drag.active) activateDrag();
    updateDrag(point);
  },
  { passive: false },
);
document.addEventListener("pointerup", (event) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (drag.active) updateDrag([event.clientX, event.clientY]);
  finishDrag(true);
});
document.addEventListener("pointercancel", (event) => {
  if (event.pointerId === drag?.pointerId) finishDrag(false);
});
for (const surface of [ui.board, ui.pieces]) {
  surface.addEventListener("lostpointercapture", (event) => {
    if (event.pointerId === drag?.pointerId) finishDrag(false);
  });
  surface.addEventListener("dragstart", (event) => event.preventDefault());
}
document.addEventListener(
  "click",
  (event) => {
    if (drag?.active && !event.target.closest("#rotate,#flip")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.detail && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = 0;
    }
  },
  true,
);
window.addEventListener("blur", () => finishDrag(false));
window.addEventListener("resize", () => finishDrag(false));
window.addEventListener("scroll", () => finishDrag(false), true);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) finishDrag(false);
});

ui["board-picker"].addEventListener("click", (event) => {
  const b = event.target.closest("[data-board]");
  if (b) selectBoard(b.dataset.board);
});
window.addEventListener("hashchange", () => {
  const id = location.hash.slice(1);
  if (id !== chosenBoard && BOARDS.some((board) => board.id === id))
    selectBoard(id);
});
ui.pieces.addEventListener("click", (event) => {
  const b = event.target.closest("[data-piece]");
  if (b) selectPiece(b.dataset.piece);
});
ui.rotate.addEventListener("click", () => transformPiece("rotate"));
ui.flip.addEventListener("click", () => transformPiece("flip"));
ui.place.addEventListener("click", () => {
  if (!drag?.active) placePreview();
});
ui.undo.addEventListener("click", () =>
  returnToStep(Math.max(0, history.length - 2)),
);
ui.reset.addEventListener("click", () => selectBoard(chosenBoard));
ui["another-fit"].addEventListener("click", () => selectBoard(chosenBoard));
ui.hint.addEventListener("click", giveHint);
ui.peek.addEventListener("click", peek);
ui["finish-prev"].addEventListener("click", () => browseFinish(-1));
ui["finish-next"].addEventListener("click", () => browseFinish(1));
ui["finish-retry"].addEventListener("click", () => {
  if (solver.failed) {
    closeFinishes();
    analysis = null;
    countError = null;
    render();
    solver.retry(fixedIds);
    message(
      "Restarting the count. Your tiles stay where they are; browse finishes again when it is ready.",
    );
  } else browseFinish(0);
});
ui["retry-count"].addEventListener("click", () => {
  closeFinishes();
  analysis = null;
  countError = null;
  solverProgress = null;
  currentCompletion = [];
  render();
  solver.retry(fixedIds);
});
ui.trail.addEventListener("click", (event) => {
  const b = event.target.closest("[data-step]");
  if (b) returnToStep(Number(b.dataset.step));
});

ui.board.addEventListener("pointermove", (event) => {
  if (drag || browsing) return;
  if (event.pointerType === "touch") return;
  lastPointerType = event.pointerType || "mouse";
  const cell = event.target.closest(".cell");
  if (cell && !cell.disabled)
    moveCursor(Number(cell.dataset.x), Number(cell.dataset.y));
});
ui.board.addEventListener("pointerleave", () => {
  if (drag) return;
  if (
    lastPointerType === "touch" ||
    ui.board.contains(document.activeElement) ||
    hintedId
  )
    return;
  cursor = null;
  derivePreview();
  renderPreview();
  renderBoard();
});
ui.board.addEventListener("pointerdown", (event) => {
  lastPointerType = event.pointerType || "mouse";
});
ui.board.addEventListener("focusin", (event) => {
  const focused = event.target.closest(".cell");
  if (!focused) return;
  for (const cell of cellElements.values())
    cell.tabIndex = cell === focused ? 0 : -1;
});
ui.board.addEventListener("click", (event) => {
  if (drag?.active) return;
  if (browsing) {
    closeFinishes();
    cursor = null;
    render();
    return;
  }
  const cell = event.target.closest(".cell");
  if (!cell || cell.disabled) return;
  const x = Number(cell.dataset.x),
    y = Number(cell.dataset.y),
    placed = placedByCell.get(`${x},${y}`);
  const same = cursor && cursor[0] === x && cursor[1] === y;
  moveCursor(x, y);
  // A shape's bounding-box corner can be empty. Its anchor may therefore sit
  // on another piece even when its actual footprint fits without overlap.
  if (preview?.valid) {
    if (lastPointerType !== "touch" || same) placePreview();
  } else if (placed) {
    removePiece(placed.id);
  }
});
ui.board.addEventListener("keydown", (event) => {
  if (drag?.active) return;
  if (
    browsing &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(
      event.key,
    )
  ) {
    event.preventDefault();
    closeFinishes();
    cursor = null;
    render();
    return;
  }
  const cell = event.target.closest(".cell");
  if (!cell) return;
  const deltas = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (deltas[event.key]) {
    event.preventDefault();
    lastPointerType = "keyboard";
    const [dx, dy] = deltas[event.key];
    let x = Number(cell.dataset.x),
      y = Number(cell.dataset.y);
    for (
      let n = 0;
      n < Math.max(puzzle.board.width, puzzle.board.height);
      n++
    ) {
      x += dx;
      y += dy;
      if (x < 0 || x >= puzzle.board.width || y < 0 || y >= puzzle.board.height)
        break;
      const next = cellElements.get(`${x},${y}`);
      if (next && !next.disabled) {
        cell.tabIndex = -1;
        next.tabIndex = 0;
        next.focus();
        moveCursor(x, y);
        break;
      }
    }
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    lastPointerType = "keyboard";
    moveCursor(Number(cell.dataset.x), Number(cell.dataset.y));
    if (preview?.valid) placePreview();
    else {
      const p = placedByCell.get(`${cell.dataset.x},${cell.dataset.y}`);
      if (p) removePiece(p.id);
    }
  }
});
document.addEventListener("keydown", (event) => {
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.target.matches("input,textarea,select")
  )
    return;
  if (
    drag?.active &&
    !["r", "f", "Escape"].includes(event.key) &&
    !["R", "F"].includes(event.key)
  ) {
    event.preventDefault();
    return;
  }
  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    transformPiece("rotate");
  } else if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    transformPiece("flip");
  } else if (event.key === "Escape") {
    if (drag) finishDrag(false);
    else {
      closeFinishes();
      cursor = null;
      hintedId = null;
      nudge = null;
      render();
    }
  } else if (event.key.toLowerCase() === "z" && history.length > 1) {
    event.preventDefault();
    returnToStep(history.length - 2);
  }
});

try {
  selectBoard(chosenBoard);
} catch (error) {
  ui.count.textContent = "—";
  ui["count-description"].textContent = "The board couldn’t load.";
  message(
    "Please reload to try again. If this persists, the local prototype needs a fix.",
    true,
  );
  console.error(error);
}
