/** Switchback rules v1: forward or one allowed quarter-turn followed by a step. */
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const ACTIONS = ['forward', 'turn'];

export function key(state) {
  return `${state.x},${state.y},${state.heading},${state.mode}`;
}

export function isExit(puzzle, state) {
  return state.x === puzzle.exit.x && state.y === puzzle.exit.y;
}

function isState(puzzle, state) {
  return Number.isInteger(state.x) && Number.isInteger(state.y)
    && Number.isInteger(state.heading) && state.heading >= 0 && state.heading < 4
    && (state.mode === 'left' || state.mode === 'right')
    && ['.', 'S'].includes(puzzle.rows[state.y]?.[state.x]);
}

/** Return a fresh state, or null when the action is blocked or the game is over. */
export function transition(puzzle, state, action) {
  if (!ACTIONS.includes(action) || !isState(puzzle, state) || isExit(puzzle, state)) return null;
  const rotation = action === 'turn' ? (state.mode === 'left' ? 3 : 1) : 0;
  const heading = (state.heading + rotation) % 4;
  const [dx, dy] = DIRECTIONS[heading];
  const x = state.x + dx;
  const y = state.y + dy;
  const tile = puzzle.rows[y]?.[x];
  if (tile !== '.' && tile !== 'S') return null;
  const mode = tile === 'S' ? (state.mode === 'left' ? 'right' : 'left') : state.mode;
  return { x, y, heading, mode };
}

/**
 * Breadth-first search over full states, with exact action-sequence counts.
 * All exit states in the first successful layer contribute to shortestCount.
 * Counts are ordinary numbers when safe; exceptionally large counts are bigint.
 * explored counts distinct full states visited through the successful layer.
 */
export function solve(puzzle, start = puzzle.start) {
  const failure = explored => ({
    solvable: false, distance: null, shortestCount: 0, actions: [], states: [], explored,
  });
  if (!isState(puzzle, start)) return failure(0);
  const initial = { ...start };
  const records = new Map([[key(initial), {
    state: initial, distance: 0, count: 1n, parent: null, action: null,
  }]]);
  let frontier = [key(initial)];
  while (frontier.length) {
    const exits = frontier.filter(id => isExit(puzzle, records.get(id).state));
    if (exits.length) {
      const count = exits.reduce((sum, id) => sum + records.get(id).count, 0n);
      const actions = [];
      const states = [];
      let record = records.get(exits[0]);
      const distance = record.distance;
      while (record) {
        states.push(record.state);
        if (record.action) actions.push(record.action);
        record = record.parent === null ? null : records.get(record.parent);
      }
      return {
        solvable: true,
        distance,
        shortestCount: count <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(count) : count,
        actions: actions.reverse(),
        states: states.reverse(),
        explored: records.size,
      };
    }
    const nextFrontier = [];
    for (const id of frontier) {
      const current = records.get(id);
      for (const action of ACTIONS) {
        const state = transition(puzzle, current.state, action);
        if (!state) continue;
        const nextId = key(state);
        const known = records.get(nextId);
        if (!known) {
          records.set(nextId, {
            state, distance: current.distance + 1, count: current.count, parent: id, action,
          });
          nextFrontier.push(nextId);
        } else if (known.distance === current.distance + 1) {
          known.count += current.count;
        }
      }
    }
    frontier = nextFrontier;
  }
  return failure(records.size);
}

/** Change only the named tile, preserving an independent copy of the original. */
export function editPuzzle(puzzle, enabled) {
  const { x, y } = puzzle.editable;
  const rows = [...puzzle.rows];
  rows[y] = rows[y].slice(0, x) + (enabled ? 'S' : '.') + rows[y].slice(x + 1);
  return {
    ...puzzle, rows,
    start: { ...puzzle.start }, exit: { ...puzzle.exit }, editable: { ...puzzle.editable },
  };
}
