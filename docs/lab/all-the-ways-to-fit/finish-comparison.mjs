// Ranks stay exact even when a board has more finishes than Number can hold.
export function wrapRank(rank, count) {
  if (count <= 0n) return null;
  return ((BigInt(rank) % count) + count) % count;
}

// A piece changes when its occupied squares change, including a rotation or
// reflection in place. Fixed pieces are excluded from the preview comparison.
export function changedPieces(puzzle, before, after, fixedIds = []) {
  const fixed = new Set(fixedIds.map((id) => puzzle.getPlacement(id).pieceId));
  const footprint = (id) =>
    puzzle
      .getPlacement(id)
      .cells.map(([x, y]) => `${x},${y}`)
      .sort()
      .join(";");
  const previous = new Map(
    before.map((id) => [puzzle.getPlacement(id).pieceId, footprint(id)]),
  );
  return new Set(
    after
      .filter((id) => {
        const p = puzzle.getPlacement(id);
        return (
          !fixed.has(p.pieceId) && previous.get(p.pieceId) !== footprint(id)
        );
      })
      .map((id) => puzzle.getPlacement(id).pieceId),
  );
}
