// Coordinates here are in tile-cell units, independent of screen size.
export function grabPoint(cells, point) {
  const cell = cells.reduce((best, c) => {
    const distance = ([x, y]) =>
      (x + 0.5 - point[0]) ** 2 + (y + 0.5 - point[1]) ** 2;
    return distance(c) < distance(best) ? c : best;
  });
  return cell.map(
    (value, axis) =>
      value + Math.max(0.05, Math.min(0.95, point[axis] - value)),
  );
}

export function transformGrab(cells, point, kind) {
  // Cell origins and points transform differently: a square has unit width.
  const raw = cells.map(([x, y]) => (kind === "rotate" ? [-y, x] : [-x, y]));
  const minX = Math.min(...raw.map((c) => c[0])),
    minY = Math.min(...raw.map((c) => c[1]));
  const transformed =
    kind === "rotate" ? [1 - point[1], point[0]] : [1 - point[0], point[1]];
  return [transformed[0] - minX, transformed[1] - minY];
}

export function dragPosition(point, grab, board) {
  const x = point[0] - grab[0] * board.cellWidth;
  const y = point[1] - grab[1] * board.cellHeight;
  const overBoard =
    point[0] >= board.left &&
    point[0] < board.right &&
    point[1] >= board.top &&
    point[1] < board.bottom;
  return {
    left: x,
    top: y,
    anchor: overBoard
      ? [
          Math.round((x - board.left) / board.cellWidth) + 0,
          Math.round((y - board.top) / board.cellHeight) + 0,
        ]
      : null,
  };
}
