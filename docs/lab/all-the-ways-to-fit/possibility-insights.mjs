// Translate exact support counts into choices a player can reason about.
// A fit is one distinct position/orientation that occurs in a full tiling.
export function choiceSummary(puzzle, analysis, fixedIds) {
  if (!analysis || analysis.count === 0n) return null;
  const used = new Set(fixedIds.map((id) => puzzle.getPlacement(id).pieceId));
  const choices = new Map(
    puzzle.board.pieces.filter((p) => !used.has(p.id)).map((p) => [p.id, 0]),
  );
  for (const placement of puzzle.placements) {
    if (
      choices.has(placement.pieceId) &&
      analysis.supports.get(placement.id) > 0n
    ) {
      choices.set(placement.pieceId, choices.get(placement.pieceId) + 1);
    }
  }
  return choices;
}

export function nudgePiece(choices, selectedId) {
  if (!choices?.size) return null;
  const fewest = Math.min(...choices.values());
  if (choices.get(selectedId) === fewest) return selectedId;
  return [...choices].find(([, count]) => count === fewest)?.[0] ?? null;
}

function percent(part, total) {
  if (part * 100n < total) return "<1%";
  // Keep the arithmetic exact even when the counts exceed Number's range.
  const tenths = (part * 1000n + total / 2n) / total;
  if (part < total && tenths >= 1000n) return ">99.9%";
  return `${Number(tenths) / 10}%`;
}

export function describeChange(before, after, kind = "place") {
  if (before == null || after == null) return null;
  if (after === 0n) return "No way to finish from here";
  if (before === 0n) return "A way forward again";
  // Repositioning changes which solutions exist. Equal counts do not mean
  // the same solutions survived, so only additions may say "keeps".
  if (kind !== "place") {
    if (after === before)
      return "Same number of finishes, a different arrangement";
    return after > before ? "More room to finish" : "Fewer possible finishes";
  }
  if (after === before) return "Every finish uses this placement";
  if (after > before) return "More room to finish";
  return `Keeps ${percent(after, before)} of the finishes`;
}
