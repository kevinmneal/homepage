#!/usr/bin/env node
import assert from 'node:assert/strict';
import { transition, solve, key, isExit, editPuzzle } from '../docs/lab/switchback/model.mjs';
import { PUZZLE, WITNESS, PROPERTIES } from '../docs/lab/switchback/puzzle.mjs';

// This oracle uses direction vectors and complete action-word layers, independent
// of the production rotation arithmetic, shortest-state queue, and parent links.
const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const actions = ['forward', 'turn'];
const oracleKey = s => JSON.stringify([s.x, s.y, s.heading, s.mode]);
function oracleStep(puzzle, state, action) {
  if (state.x === puzzle.exit.x && state.y === puzzle.exit.y) return null;
  let [dx, dy] = vectors[state.heading];
  if (action === 'turn') {
    [dx, dy] = state.mode === 'left' ? [dy, -dx] : [-dy, dx];
  }
  const x = state.x + dx;
  const y = state.y + dy;
  if (y < 0 || y >= puzzle.rows.length || x < 0 || x >= puzzle.rows[y].length) return null;
  if (puzzle.rows[y][x] === '#') return null;
  return {
    x, y,
    heading: vectors.findIndex(([vx, vy]) => vx === dx && vy === dy),
    mode: puzzle.rows[y][x] === 'S'
      ? ({ left: 'right', right: 'left' })[state.mode] : state.mode,
  };
}

// Each layer includes all action sequences of exactly that length, including
// revisits. A finite-state shortest solution has at most |states| - 1 moves.
function oracleShortest(puzzle, start = puzzle.start, target = state =>
  state.x === puzzle.exit.x && state.y === puzzle.exit.y) {
  const open = puzzle.rows.join('').replaceAll('#', '').length;
  let layer = new Map([[oracleKey(start), { state: start, count: 1n }]]);
  for (let distance = 0; distance < open * 8; distance += 1) {
    const terminal = [...layer.values()].filter(({ state }) => target(state));
    if (terminal.length) return {
      distance, shortestCount: terminal.reduce((n, entry) => n + entry.count, 0n), terminal,
    };
    const next = new Map();
    for (const { state, count } of layer.values()) {
      for (const action of actions) {
        const target = oracleStep(puzzle, state, action);
        if (!target) continue;
        const id = oracleKey(target);
        if (!next.has(id)) next.set(id, { state: target, count: 0n });
        next.get(id).count += count;
      }
    }
    layer = next;
    if (!layer.size) break;
  }
  return { distance: null, shortestCount: 0n, terminal: [] };
}

// History is essential here: a position-only or full-state BFS cannot establish
// the absence of a path that visits each position at most once.
function noPositionRepeat(puzzle) {
  let pathPrefixes = 0;
  function visit(state, positions) {
    pathPrefixes += 1;
    if (state.x === puzzle.exit.x && state.y === puzzle.exit.y) return true;
    for (const action of actions) {
      const target = oracleStep(puzzle, state, action);
      if (!target) continue;
      const position = `${target.x},${target.y}`;
      if (positions.has(position)) continue;
      const nextPositions = new Set(positions);
      nextPositions.add(position);
      if (visit(target, nextPositions)) return true;
    }
    return false;
  }
  return {
    solvable: visit(puzzle.start, new Set([`${puzzle.start.x},${puzzle.start.y}`])),
    pathPrefixes,
  };
}

const originalText = JSON.stringify(PUZZLE);
const original = solve(PUZZLE);
assert.equal(original.solvable, true);
assert.equal(original.distance, PROPERTIES.shortestDistance);
assert.equal(original.shortestCount, PROPERTIES.shortestCount);
assert.deepEqual(original.actions, WITNESS.actions);
assert.deepEqual(original.states, WITNESS.states);
assert.equal(original.states.length, original.distance + 1);

let replay = PUZZLE.start;
for (let move = 0; move < WITNESS.actions.length; move += 1) {
  const action = WITNESS.actions[move];
  const expected = WITNESS.states[move + 1];
  assert.deepEqual(transition(PUZZLE, replay, action), expected, `production replay move ${move + 1}`);
  assert.deepEqual(oracleStep(PUZZLE, replay, action), expected, `independent replay move ${move + 1}`);
  replay = expected;
}
assert.equal(isExit(PUZZLE, replay), true);
assert.equal(transition(PUZZLE, replay, 'forward'), null);
assert.equal(transition(PUZZLE, replay, 'turn'), null);
assert.deepEqual(solve(PUZZLE, replay), {
  solvable: true, distance: 0, shortestCount: 1, actions: [], states: [replay], explored: 1,
});

// The same position and heading can have a different legal next action.
const before = WITNESS.states[PROPERTIES.samePositionWitness.firstMove];
const after = WITNESS.states[PROPERTIES.samePositionWitness.secondMove];
assert.deepEqual([before.x, before.y, before.heading], [after.x, after.y, after.heading]);
assert.notEqual(before.mode, after.mode);
assert.notEqual(key(before), key(after));
assert.notEqual(key(before), key({ ...before, heading: 0 }));
assert.equal(transition(PUZZLE, before, 'turn').y, 3);
assert.equal(transition(PUZZLE, after, 'turn').y, 1);
assert.equal(PROPERTIES.samePositionWitness.sameHeading, true);
assert.equal(PROPERTIES.samePositionWitness.differentMode, true);
assert.deepEqual([before.x, before.y],
  [PROPERTIES.samePositionWitness.x, PROPERTIES.samePositionWitness.y]);

// The curated route enters the switch once; merely leaving it does not flip.
const switchMoves = WITNESS.states.flatMap((state, move) =>
  move > 0 && PUZZLE.rows[state.y][state.x] === 'S' ? [move] : []);
assert.deepEqual(switchMoves, PROPERTIES.switchEntryMoves);
assert.deepEqual(switchMoves.map(move => WITNESS.states[move].mode), ['right']);
for (const move of switchMoves) {
  assert.notEqual(WITNESS.states[move - 1].mode, WITNESS.states[move].mode);
  assert.equal(WITNESS.states[move].mode, WITNESS.states[move + 1].mode);
}

// An explicit loop checks repeated entry even though it is not needed by the
// curated shortest route. Turn direction changes globally after each entry.
const loop = {
  rows: ['...', '.S.', '...'],
  start: { x: 0, y: 1, heading: 1, mode: 'left' }, exit: { x: 2, y: 2 },
};
let loopState = loop.start;
const loopEntries = [];
for (const action of ['forward', ...Array(8).fill('turn')]) {
  const previous = loopState;
  const expected = oracleStep(loop, previous, action);
  loopState = transition(loop, previous, action);
  assert.deepEqual(loopState, expected);
  assert.notEqual(loopState, null);
  if (loop.rows[loopState.y][loopState.x] === 'S') {
    assert.notEqual(loopState.mode, previous.mode);
    loopEntries.push(loopState.mode);
  } else assert.equal(loopState.mode, previous.mode);
}
assert.deepEqual(loopEntries, ['right', 'left', 'right']);

const edited = editPuzzle(PUZZLE, false);
assert.equal(edited.rows[PUZZLE.editable.y][PUZZLE.editable.x], '.');
assert.equal(JSON.stringify(PUZZLE), originalText);
assert.deepEqual(editPuzzle(edited, true), PUZZLE);
assert.notEqual(edited.rows, PUZZLE.rows);
assert.notEqual(edited.start, PUZZLE.start);
let changedTiles = 0;
for (let y = 0; y < PUZZLE.rows.length; y += 1) {
  for (let x = 0; x < PUZZLE.rows[y].length; x += 1) {
    if (PUZZLE.rows[y][x] !== edited.rows[y][x]) changedTiles += 1;
  }
}
assert.equal(changedTiles, 1);
assert.equal(solve(edited).solvable, false);
assert.equal(solve(edited).explored, PROPERTIES.withoutSwitch.reachableStates);
assert.equal(oracleShortest(edited).distance, null);
assert.equal(PROPERTIES.necessarySwitch, true);
assert.equal(PROPERTIES.withoutSwitch.solvable, false);

const noRepeat = noPositionRepeat(PUZZLE);
assert.deepEqual(noRepeat, { solvable: false, pathPrefixes: PROPERTIES.noPositionRepeat.pathPrefixes });
assert.equal(PROPERTIES.noPositionRepeat.status, 'EXHAUSTIVE_NO_SOLUTION');
assert.equal(PROPERTIES.necessaryRevisit, true);

// Inspect real decisions with the independent oracle: every legal alternative
// along the shortest witness remains solvable, with the recorded extra cost.
const choices = [];
let forcedChain = 0;
let longestForcedChain = 0;
for (let move = 0; move < WITNESS.actions.length; move += 1) {
  const state = WITNESS.states[move];
  const options = actions.map(action => ({ action, state: oracleStep(PUZZLE, state, action) }))
    .filter(option => option.state);
  if (options.length === 1) {
    forcedChain += 1;
    longestForcedChain = Math.max(longestForcedChain, forcedChain);
    continue;
  }
  forcedChain = 0;
  const alternative = options.find(option => option.action !== WITNESS.actions[move]);
  const remaining = oracleShortest(PUZZLE, alternative.state).distance;
  assert.notEqual(remaining, null, `alternative at move ${move} must be recoverable`);
  choices.push({ move, extra: move + 1 + remaining - original.distance });
}
assert.deepEqual(choices.map(choice => choice.move), PROPERTIES.pacing.choiceMoves);
assert.deepEqual(choices.map(choice => choice.extra), PROPERTIES.pacing.alternateExtraMoves);
assert.equal(choices[0].move, PROPERTIES.pacing.firstRecoverableChoiceMove);
assert.equal(PROPERTIES.pacing.allAlternativesRecoverable, true);
assert.equal(longestForcedChain, PROPERTIES.pacing.maxForcedChainOnShortest);

const onSwitch = state => PUZZLE.rows[state.y][state.x] === 'S';
const earliestSwitch = oracleShortest(PUZZLE, PUZZLE.start, onSwitch);
assert.equal(earliestSwitch.distance, PROPERTIES.pacing.earliestSwitchMove);
assert.equal(switchMoves[0], PROPERTIES.pacing.firstSwitchOnShortest);
// Check all states that can reach the switch at the earliest time: none yields
// the shortest overall route. Arriving earlier and arriving well are distinct.
const earliestSwitchFinish = Math.min(...earliestSwitch.terminal.map(({ state }) => {
  const remaining = oracleShortest(PUZZLE, state).distance;
  return remaining === null ? Infinity : earliestSwitch.distance + remaining;
}));
assert.equal(earliestSwitchFinish, PROPERTIES.pacing.earliestSwitchSolutionDistance);

const approach = PROPERTIES.approachChoice;
const approachState = WITNESS.states[approach.move];
assert.deepEqual([approachState.x, approachState.y], [approach.x, approach.y]);
assert.equal(WITNESS.actions[approach.move], approach.shortestAction);
assert.equal(original.distance, approach.shortestDistance);
assert.equal(switchMoves[0], approach.shortestSwitchMove);
assert.equal(WITNESS.states[switchMoves[0]].heading, approach.shortestSwitchHeading);
const earlierArrival = oracleStep(PUZZLE, approachState, approach.earlierSwitchAction);
assert.equal(onSwitch(earlierArrival), true);
assert.equal(approach.move + 1, approach.earlierSwitchMove);
assert.equal(earlierArrival.heading, approach.earlierSwitchHeading);
assert.equal(approach.move + 1 + oracleShortest(PUZZLE, earlierArrival).distance,
  approach.earlierSwitchDistance);

// The opening alternative genuinely approaches the switch another way, rather
// than only returning to the same state and following the chosen opening.
const opening = PROPERTIES.openingChoice;
assert.equal(opening.move, choices[0].move);
assert.equal(opening.shortestAction, WITNESS.actions[opening.move]);
const otherOpening = oracleStep(PUZZLE, WITNESS.states[opening.move], opening.alternativeAction);
assert.equal(opening.move + 1 + oracleShortest(PUZZLE, otherOpening).distance, opening.alternativeDistance);
const alternativeWitness = solve(PUZZLE, otherOpening);
let alternativeState = otherOpening;
let firstAlternativeSwitch = null;
for (const action of alternativeWitness.actions) {
  alternativeState = oracleStep(PUZZLE, alternativeState, action);
  if (onSwitch(alternativeState) && !firstAlternativeSwitch) firstAlternativeSwitch = alternativeState;
}
assert.equal(isExit(PUZZLE, alternativeState), true);
assert.equal(firstAlternativeSwitch.heading, opening.alternativeSwitchHeading);
assert.equal(WITNESS.states[switchMoves[0]].heading, opening.shortestSwitchHeading);
assert.notEqual(opening.shortestSwitchHeading, opening.alternativeSwitchHeading);

// Explicit boundary and blocked-turn examples also ensure no in-place turning.
const small = { rows: ['...', '.#.', '...'], exit: { x: 2, y: 2 } };
assert.equal(transition(small, { x: 0, y: 0, heading: 0, mode: 'left' }, 'forward'), null);
assert.equal(transition(small, { x: 1, y: 0, heading: 1, mode: 'right' }, 'turn'), null);
assert.deepEqual(transition(small, { x: 0, y: 0, heading: 0, mode: 'right' }, 'turn'),
  { x: 1, y: 0, heading: 1, mode: 'right' });
assert.equal(transition(PUZZLE, PUZZLE.start, 'reverse'), null);
assert.equal(transition(PUZZLE, PUZZLE.start, 'rotate'), null);

// One fixture has equal shortest paths to different terminal headings/modes;
// another has two action sequences merging into the same terminal state.
const distinctExits = {
  rows: ['.S..', '..S.', '....', '..#.'],
  start: { x: 1, y: 2, heading: 1, mode: 'left' }, exit: { x: 3, y: 1 },
};
assert.equal(solve(distinctExits).distance, 3);
assert.equal(solve(distinctExits).shortestCount, 2);
assert.equal(oracleShortest(distinctExits).terminal.length, 2);
const mergedPaths = {
  rows: ['....', '....', '....', 'SS..'],
  start: { x: 2, y: 1, heading: 0, mode: 'left' }, exit: { x: 3, y: 0 },
};
assert.equal(solve(mergedPaths).distance, 6);
assert.equal(solve(mergedPaths).shortestCount, 2);
assert.equal(oracleShortest(mergedPaths).terminal.length, 1);

// Compare every transition and every possible restart on both curated boards
// and the counting fixtures. This also checks live "solve from here" feedback.
let checkedStates = 0;
for (const puzzle of [PUZZLE, edited, distinctExits, mergedPaths]) {
  for (let y = 0; y < puzzle.rows.length; y += 1) {
    for (let x = 0; x < puzzle.rows[y].length; x += 1) {
      if (puzzle.rows[y][x] === '#') continue;
      for (let heading = 0; heading < 4; heading += 1) {
        for (const mode of ['left', 'right']) {
          const start = { x, y, heading, mode };
          for (const action of actions) {
            assert.deepEqual(transition(puzzle, start, action), oracleStep(puzzle, start, action));
          }
          const actual = solve(puzzle, start);
          const expected = oracleShortest(puzzle, start);
          assert.equal(actual.solvable, expected.distance !== null);
          assert.equal(actual.distance, expected.distance);
          assert.equal(BigInt(actual.shortestCount), expected.shortestCount);
          if (actual.solvable) {
            let state = start;
            for (const action of actual.actions) state = oracleStep(puzzle, state, action);
            assert.equal(isExit(puzzle, state), true);
            assert.equal(actual.actions.length, actual.distance);
          }
          checkedStates += 1;
        }
      }
    }
  }
}
assert.equal(JSON.stringify(PUZZLE), originalText, 'all rules, edits and solves preserve source puzzle');
console.log(`Switchback passed: ${checkedStates} restart states and ${checkedStates * 2} transitions checked independently.`);
console.log(`Curated puzzle: unique ${original.distance}-move shortest solution; switch removal unsolvable; no-repeat search exhausted ${noRepeat.pathPrefixes} prefixes.`);
console.log(`Pacing: first recoverable choice at move ${choices[0].move}; all ${choices.length} alternate actions recover; earliest switch at ${earliestSwitch.distance} needs ${earliestSwitchFinish} total moves versus ${original.distance} via the better approach.`);
console.log(`Search: ${original.explored} states through the shortest winning layer; ${solve(edited).explored} reachable states exhausted without the switch.`);
