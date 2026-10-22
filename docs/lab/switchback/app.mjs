import { transition, solve, isExit, editPuzzle } from './model.mjs';
import { PUZZLE, PROPERTIES } from './puzzle.mjs';

const byId = id => document.getElementById(id);
const DIRECTIONS = ['North', 'East', 'South', 'West'];
const ARROWS = ['↑', '→', '↓', '←'];
const coord = s => `${String.fromCharCode(65 + s.x)}${s.y + 1}`;
const cap = s => s[0].toUpperCase() + s.slice(1);
let puzzle = editPuzzle(PUZZLE, true);
let solution = solve(puzzle);
let history = [puzzle.start];
let revealing = false;
let revealIndex = 0;
let timer = null;
let switchEnabled = true;
let insightPause = false;
let hintsOpen = false;
let hintLevel = 0;
let hasEscaped = false;
let bestMoves = null;
let challengeActive = false;
let prediction = null;
let experimentChecked = false;
const HINTS = [
  'Look at the exit. From the square below it, which way would you need to face—or be able to turn?',
  'The switch changes a rule you carry with you. A square you have already visited may offer a different move when you return.',
  'Plan your arrival at the switch. Entering it from the east leaves you facing west with right turns, ready for the corridor back to the start.',
];
const current = () => revealing ? solution.states[revealIndex] : history.at(-1);
const visibleStates = () => revealing ? solution.states.slice(0, revealIndex + 1) : history;
const svgNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, content) {
  const node = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  if (content !== undefined) node.textContent = content;
  return node;
}
function drawBoard() {
  const state = current();
  const n = puzzle.rows.length;
  const step = 576 / n;
  const center = s => [36 + (s.x + .5) * step, 36 + (s.y + .5) * step];
  const tiles = byId('tiles');
  const markers = byId('markers');
  tiles.replaceChildren(); markers.replaceChildren();
  for (let y = 0; y < n; y++) for (let x = 0; x < puzzle.rows[y].length; x++) {
    const wall = puzzle.rows[y][x] === '#';
    const attrs = { x: 36 + x * step + 3, y: 36 + y * step + 3, width: step - 6, height: step - 6, rx: 5 };
    tiles.append(svg('rect', { ...attrs, class: wall ? 'tile-wall' : 'tile' }));
    if (wall) tiles.append(svg('rect', { ...attrs, fill: 'url(#wall-hatch)' }));
    const [cx, cy] = center({ x, y });
    if (puzzle.rows[y][x] === 'S') {
      markers.append(svg('path', { d: `M${cx} ${cy - 21}l21 21 -21 21 -21 -21Z`, class: 'switch-symbol' }));
      markers.append(svg('text', { x: cx, y: cy + 1, class: 'switch-glyph' }, '±'));
    }
    if (x === puzzle.editable.x && y === puzzle.editable.y) markers.append(svg('rect', { ...attrs, x: attrs.x + 5, y: attrs.y + 5, width: attrs.width - 10, height: attrs.height - 10, class: 'edit-outline' }));
  }
  for (let i = 0; i < n; i++) {
    tiles.append(svg('text', { x: 36 + (i + .5) * step, y: 17, class: 'grid-label' }, String.fromCharCode(65 + i)));
    tiles.append(svg('text', { x: 17, y: 36 + (i + .5) * step, class: 'grid-label' }, i + 1));
  }
  const [sx, sy] = center(puzzle.start);
  markers.append(svg('circle', { cx: sx, cy: sy, r: 13, class: 'start-marker' }));
  const [ex, ey] = center(puzzle.exit);
  markers.append(svg('rect', { x: ex - 22, y: ey - 22, width: 44, height: 44, rx: 6, class: 'exit-outline' }));
  markers.append(svg('text', { x: ex, y: ey + 1, class: 'exit-label' }, 'E'));
  const trail = byId('trail'); trail.replaceChildren();
  const states = visibleStates();
  if (states.length > 1) trail.append(svg('polyline', { points: states.map(s => center(s).join(',')).join(' '), class: 'route-line' }));
  for (const s of states.slice(0, -1)) { const [cx, cy] = center(s); trail.append(svg('circle', { cx, cy, r: 4, class: 'route-dot' })); }
  if (states.slice(0, -1).some(s => s.x === state.x && s.y === state.y)) {
    const [cx, cy] = center(state);
    markers.append(svg('rect', { x: cx - step / 2 + 7, y: cy - step / 2 + 7, width: step - 14, height: step - 14, rx: 4, class: 'revisited-tile' }));
  }
  const [px, py] = center(state);
  const player = byId('player'); player.replaceChildren();
  player.append(svg('circle', { cx: px, cy: py, r: 24, class: 'player-disc' }));
  player.append(svg('path', { d: 'M0 -15L11 -1H5V14H-5V-1H-11Z', transform: `translate(${px},${py}) rotate(${state.heading * 90})`, class: 'player-arrow' }));
  byId('board-description').textContent = `${n} by ${n} maze. You are at ${coord(state)}, facing ${DIRECTIONS[state.heading]}, allowed to turn ${state.mode}. Start ${coord(puzzle.start)}; exit ${coord(puzzle.exit)}. The editable tile at ${coord(puzzle.editable)} is ${switchEnabled ? 'a switch' : 'floor'}. Full layout is available under Read the board as text.`;
  byId('text-board').textContent = `   ${Array.from({length:n}, (_, i) => String.fromCharCode(65 + i)).join(' ')}\n` + puzzle.rows.map((row, y) => `${y + 1}  ${[...row].map((tile, x) => x === puzzle.start.x && y === puzzle.start.y ? 'O' : x === puzzle.exit.x && y === puzzle.exit.y ? 'E' : tile === 'S' ? '◆' : tile === '.' ? '·' : '#').join(' ')}`).join('\n');
}
function stopAuto() {
  if (timer !== null) clearInterval(timer);
  timer = null;
  byId('auto-play').textContent = revealIndex === solution.distance ? 'Replay route' : revealIndex > 0 ? 'Continue route' : 'Play route';
}
function announce(text) {
  if (byId('announcement').textContent !== text) byId('announcement').textContent = text;
}
function setMessage(text, kind = '') {
  byId('message').textContent = text;
  byId('message').dataset.kind = kind;
  announce(text);
}
function showBoardForPlay() {
  if (!window.matchMedia('(max-width: 700px) and (min-height: 541px)').matches) return;
  const board = byId('board');
  const rect = board.getBoundingClientRect();
  const panelTop = document.querySelector('.play-panel').getBoundingClientRect().top;
  if (rect.top < 0 || rect.bottom > panelTop) board.scrollIntoView({ block: 'start' });
}
function renderExperiment() {
  // A prediction and an explicit check are required before showing the verdict.
  byId('board-version').textContent = switchEnabled ? 'original puzzle' : 'edited puzzle';
  byId('edit-coordinate').textContent = coord(puzzle.editable);
  for (const answer of ['yes', 'no']) {
    byId(`predict-${answer}`).setAttribute('aria-pressed', String(prediction === answer));
    byId(`predict-${answer}`).disabled = experimentChecked;
  }
  byId('prediction-status').textContent = prediction === null
    ? 'Make a prediction, then try the changed maze or check your answer.'
    : `Your prediction: ${prediction === 'yes' ? 'a route still exists' : 'no route remains'}.`;
  byId('try-prediction').disabled = prediction === null || !switchEnabled;
  byId('try-prediction').textContent = switchEnabled ? 'Try with floor' : 'Floor version in play';
  byId('check-prediction').disabled = prediction === null;
  byId('check-prediction').hidden = experimentChecked;
  byId('experiment-result').hidden = !experimentChecked;
  byId('experiment-proof').hidden = !experimentChecked;
  byId('restore').hidden = switchEnabled;
}
function renderDiscovery() {
  byId('hint-toggle').hidden = revealing || !switchEnabled;
  byId('hint-toggle').setAttribute('aria-expanded', String(hintsOpen));
  byId('hint-toggle').textContent = hintsOpen ? 'Close hints −' : 'Need a nudge? +';
  byId('hints').hidden = revealing || !switchEnabled || !hintsOpen;
  byId('hint-count').textContent = hintLevel ? `Hint ${hintLevel} of ${HINTS.length}` : '';
  byId('hint-text').textContent = HINTS[hintLevel - 1] || '';
  byId('next-hint').hidden = hintLevel === HINTS.length;
  const won = switchEnabled && !revealing && isExit(puzzle, current());
  byId('success-panel').hidden = !won;
  byId('start-challenge').hidden = challengeActive;
  byId('challenge-status').hidden = !challengeActive || !switchEnabled || revealing;
  byId('challenge-status').textContent = challengeActive
    ? `Route challenge · target ${PROPERTIES.shortestDistance} moves · your best ${bestMoves}${bestMoves === PROPERTIES.shortestDistance ? ' · complete' : ''}`
    : '';
  byId('afterword').hidden = !hasEscaped && !experimentChecked;
}
function render() {
  const previousFocus = document.activeElement;
  byId('instrument').dataset.revealing = String(revealing);
  const state = current();
  const won = isExit(puzzle, state);
  const steps = revealing ? revealIndex : history.length - 1;
  byId('move-count').textContent = steps;
  byId('move-unit').textContent = steps === 1 ? 'move' : 'moves';
  byId('mobile-moves').textContent = ` · ${steps} ${steps === 1 ? 'move' : 'moves'}`;
  byId('heading-value').textContent = `${ARROWS[state.heading]} ${DIRECTIONS[state.heading]}`;
  byId('mode-value').textContent = `${state.mode === 'left' ? '↶' : '↷'} ${cap(state.mode)}`;
  byId('position-value').textContent = coord(state);
  byId('forward-icon').textContent = ARROWS[state.heading];
  byId('turn-icon').textContent = state.mode === 'left' ? '↶' : '↷';
  byId('turn-label').textContent = `${cap(state.mode)} + step`;
  for (const action of ['forward', 'turn']) {
    const next = transition(puzzle, state, action);
    byId(action).disabled = revealing || !next;
    byId(action).title = revealing ? 'Use the walkthrough controls below' : !next ? won ? 'Exit reached' : 'Blocked by a wall or the edge' : `Move to ${coord(next)}`;
    byId(`${action}-target`).textContent = next ? `${DIRECTIONS[next.heading]} · ${coord(next)}` : won ? 'Exit reached' : 'Blocked';
  }
  byId('undo').disabled = revealing || history.length === 1;
  byId('reset').disabled = revealing;
  byId('reveal').hidden = revealing;
  byId('reveal').disabled = !solution.solvable;
  byId('walkthrough').hidden = !revealing;
  if (revealing) {
    byId('reveal-step').textContent = `Step ${revealIndex} of ${solution.distance} · ${coord(state)}${insightPause ? ' · paused to inspect' : ''}`;
    byId('previous-step').disabled = revealIndex === 0;
    byId('next-step').disabled = won;
    byId('auto-play').textContent = timer !== null ? 'Pause' : won ? 'Replay route' : revealIndex > 0 ? 'Continue route' : 'Play route';
    const previous = solution.states[revealIndex - 1];
    const action = solution.actions[revealIndex - 1];
    let explanation = revealIndex === 0 ? 'Your run is saved. Watch the turn rule; playback will pause at the important return.' : `${action === 'forward' ? 'Forward' : `${cap(previous.mode)} turn + step`} to ${coord(state)}.`;
    if (revealIndex === PROPERTIES.approachChoice?.move) explanation += ' Turning now reaches the switch sooner. Going forward lets you enter it facing west, giving you a shorter way back.';
    if (previous && previous.mode !== state.mode) explanation += ` The switch flips the rule: ${state.mode} turns are now allowed.`;
    if (won) explanation += ' Exit reached.';
    if (revealIndex === PROPERTIES.samePositionWitness.secondMove) {
      explanation = 'Same square, same heading. Only the turn rule has changed.';
      const nextTurn = transition(puzzle, state, 'turn');
      if (nextTurn && isExit(puzzle, nextTurn)) explanation += ` Now a ${state.mode} turn reaches the exit.`;
    }
    byId('step-explanation').textContent = explanation;
    const earlierIndex = solution.states.slice(0, revealIndex).findIndex(s => s.x === state.x && s.y === state.y);
    const revisit = byId('revisit'); revisit.replaceChildren(); revisit.hidden = earlierIndex < 0;
    if (earlierIndex >= 0) {
      const earlier = solution.states[earlierIndex];
      const title = document.createElement('strong'); title.textContent = `Back at ${coord(state)}. A different situation.`; revisit.append(title);
      for (const [label, s] of [[`Step ${earlierIndex}`, earlier], [`Step ${revealIndex}`, state]]) {
        const line = document.createElement('span'); line.textContent = `${label}: ${ARROWS[s.heading]} ${DIRECTIONS[s.heading]}, ${s.mode} turns`; revisit.append(line);
      }
    }
    const comparison = earlierIndex >= 0 ? ` Earlier, at step ${earlierIndex}, you faced ${DIRECTIONS[solution.states[earlierIndex].heading].toLowerCase()} with ${solution.states[earlierIndex].mode} turns.` : '';
    announce(`Step ${revealIndex} of ${solution.distance}. At ${coord(state)}, facing ${DIRECTIONS[state.heading].toLowerCase()}, with ${state.mode} turns. ${explanation}${comparison}${insightPause ? ' Playback paused. Choose Next step or Continue route when ready.' : ''}`);
  }
  renderDiscovery();
  drawBoard();
  if (!revealing && previousFocus?.matches('#forward, #turn, #undo') && previousFocus.disabled) byId('board').focus({ preventScroll: true });
}
function move(action) {
  if (revealing) return;
  const previous = current();
  const next = transition(puzzle, previous, action);
  if (!next) { if (!isExit(puzzle, previous)) setMessage('That move is blocked. Try the other action, or undo.'); return; }
  history.push(next);
  const won = isExit(puzzle, next);
  let previousVisit = -1;
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].x === next.x && history[i].y === next.y) { previousVisit = i; break; }
  }
  let message = `At ${coord(next)}, facing ${DIRECTIONS[next.heading].toLowerCase()}. ${cap(next.mode)} turns allowed.`;
  if (previousVisit >= 0) {
    const earlier = history[previousVisit];
    const sameState = earlier.heading === next.heading && earlier.mode === next.mode;
    message += sameState
      ? ` Same state as move ${previousVisit}: this loop changed nothing. Try a different choice.`
      : ` Earlier at move ${previousVisit}: ${DIRECTIONS[earlier.heading].toLowerCase()}, ${earlier.mode} turns.`;
  } else if (next.mode !== previous.mode) message += ' Switch entered: the turn rule flipped and stays with you.';
  if (!won && !transition(puzzle, next, 'forward') && !transition(puzzle, next, 'turn')) message += ' No legal moves here; undo to try another route.';
  if (won) {
    const moves = history.length - 1;
    hasEscaped = true;
    bestMoves = bestMoves === null ? moves : Math.min(bestMoves, moves);
    message = challengeActive && moves === PROPERTIES.shortestDistance
      ? `Route challenge complete! You found a shortest way out in ${moves} moves.`
      : `You found the way out in ${moves} moves!`;
  }
  setMessage(message, won ? 'won' : ''); render(); showBoardForPlay();
}
function openingMessage() {
  const start = puzzle.start;
  const turn = transition(puzzle, start, 'turn');
  if (turn && transition(puzzle, start, 'forward')) return `Start at ${coord(start)}, facing ${DIRECTIONS[start.heading].toLowerCase()}, with ${start.mode} turns. Both moves are open. Find your way to E.`;
  return `Start at ${coord(start)}, facing ${DIRECTIONS[start.heading].toLowerCase()}. ${cap(start.mode)} + step ${turn ? `turns you ${DIRECTIONS[turn.heading].toLowerCase()} and moves to ${coord(turn)}` : 'is blocked'}.`;
}
function reset(message = openingMessage()) {
  stopAuto(); revealing = false; revealIndex = 0; insightPause = false; history = [puzzle.start]; setMessage(message); render();
}
function undo() {
  if (revealing || history.length < 2) return;
  history.pop(); const state = current(); setMessage(`Undone. At ${coord(state)}, facing ${DIRECTIONS[state.heading].toLowerCase()}, with ${state.mode} turns.`); render();
}
function edit(enabled) {
  if (enabled === switchEnabled) return;
  const restoreWasFocused = document.activeElement === byId('restore');
  switchEnabled = enabled; puzzle = editPuzzle(PUZZLE, enabled); solution = solve(puzzle);
  hintsOpen = false;
  renderExperiment();
  reset(`${enabled ? 'Original switch restored.' : 'E3 is now floor. Your prediction is saved; explore, then choose Check my prediction.'} New run at ${coord(puzzle.start)}, facing ${DIRECTIONS[puzzle.start.heading].toLowerCase()}, with ${puzzle.start.mode} turns.`);
  if (restoreWasFocused) byId('try-prediction').focus({ preventScroll: true });
}
function revealStep(delta, automatic = false) {
  if (!revealing) return;
  const previousFocus = document.activeElement;
  revealIndex = Math.max(0, Math.min(solution.distance, revealIndex + delta));
  insightPause = automatic && revealIndex === PROPERTIES.samePositionWitness.secondMove;
  if (revealIndex === solution.distance || insightPause) stopAuto();
  render();
  if (previousFocus === byId('next-step') && byId('next-step').disabled) byId('previous-step').focus({ preventScroll: true });
  if (previousFocus === byId('previous-step') && byId('previous-step').disabled) byId('next-step').focus({ preventScroll: true });
  if (!automatic) showBoardForPlay();
}
for (const action of ['forward', 'turn']) byId(action).addEventListener('click', () => {
  move(action);
  if (byId(action).disabled) byId('board').focus({ preventScroll: true });
});
byId('board').addEventListener('click', () => byId('board').focus({ preventScroll: true }));
byId('undo').addEventListener('click', undo);
byId('reset').addEventListener('click', () => reset());
byId('hint-toggle').addEventListener('click', () => {
  hintsOpen = !hintsOpen;
  if (hintsOpen && !hintLevel) hintLevel = 1;
  renderDiscovery();
  if (hintsOpen) announce(`Hint ${hintLevel} of ${HINTS.length}. ${HINTS[hintLevel - 1]}`);
});
byId('next-hint').addEventListener('click', () => {
  hintLevel = Math.min(HINTS.length, hintLevel + 1);
  renderDiscovery();
  announce(`Hint ${hintLevel} of ${HINTS.length}. ${HINTS[hintLevel - 1]}`);
  if (hintLevel === HINTS.length) byId('reveal').focus({ preventScroll: true });
});
byId('start-challenge').addEventListener('click', () => {
  if (!hasEscaped) return;
  challengeActive = true; hintsOpen = false;
  if (bestMoves === PROPERTIES.shortestDistance) {
    setMessage(`You already found a shortest route: ${bestMoves} moves. Route challenge complete!`, 'won');
    render();
  } else reset(`You found a way out. Now try reaching the exit in ${PROPERTIES.shortestDistance} moves. Your best so far is ${bestMoves}.`);
  byId('board').focus({ preventScroll: true }); showBoardForPlay();
});
byId('explore-switch').addEventListener('click', () => {
  byId('experiment').open = true;
  byId('experiment').querySelector('summary').focus({ preventScroll: true });
  byId('experiment').scrollIntoView({ block: 'start' });
});
for (const answer of ['yes', 'no']) byId(`predict-${answer}`).addEventListener('click', () => {
  if (experimentChecked) return;
  prediction = answer; renderExperiment();
  announce(`Prediction saved: ${answer === 'yes' ? 'a route still exists' : 'no route remains'}. Try with floor, or check your prediction.`);
});
byId('try-prediction').addEventListener('click', () => {
  if (prediction === null) return;
  edit(false);
  byId('board').focus({ preventScroll: true }); showBoardForPlay();
});
byId('check-prediction').addEventListener('click', () => {
  if (prediction === null || experimentChecked) return;
  const result = solve(editPuzzle(PUZZLE, false));
  experimentChecked = true;
  renderExperiment(); renderDiscovery();
  const correct = (prediction === 'yes') === result.solvable;
  byId('solver-verdict').textContent = result.solvable ? 'A route remains with ordinary floor' : 'No route with ordinary floor';
  byId('solver-detail').textContent = `${correct ? 'Your prediction holds.' : `You predicted ${prediction === 'yes' ? 'a route would remain' : 'no route would remain'}.`} ${result.solvable ? 'The exit can still be reached.' : 'The passage stays open, but without the switch the turn rule never changes and the exit cannot be reached.'}`;
  byId('solver-proof').textContent = result.solvable
    ? 'The local solver found a route using the same two moves you use.'
    : `The local solver exhausted all ${result.explored} states reachable from the start with E3 as floor. None reaches the exit. A state includes square, heading, and turn rule.`;
  byId('experiment-result').dataset.solvable = String(result.solvable);
  announce(`${byId('solver-verdict').textContent}. ${byId('solver-detail').textContent}`);
  byId('experiment-proof').querySelector('summary').focus({ preventScroll: true });
});
byId('restore').addEventListener('click', () => edit(true));
byId('reveal').addEventListener('click', () => {
  if (!solution.solvable) return;
  stopAuto(); revealing = true; revealIndex = 0; insightPause = false;
  byId('message').textContent = `Walkthrough mode. Your run at move ${history.length - 1} is saved.`;
  byId('message').dataset.kind = '';
  render(); byId('next-step').focus({ preventScroll: true }); showBoardForPlay();
});
byId('leave-reveal').addEventListener('click', () => {
  stopAuto(); revealing = false; insightPause = false; hintsOpen = true;
  const state = current();
  setMessage(`Your run resumes at move ${history.length - 1}: ${coord(state)}, facing ${DIRECTIONS[state.heading].toLowerCase()}, with ${state.mode} turns.`);
  render(); byId('reveal').focus({ preventScroll: true });
});
byId('previous-step').addEventListener('click', () => { stopAuto(); revealStep(-1); });
byId('next-step').addEventListener('click', () => { stopAuto(); revealStep(1); });
byId('auto-play').addEventListener('click', () => {
  if (timer !== null) { stopAuto(); announce(`Playback paused at step ${revealIndex}.`); return; }
  if (revealIndex === solution.distance) revealIndex = 0;
  insightPause = false;
  timer = setInterval(() => revealStep(1, true), 1250); render(); showBoardForPlay();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAuto(); });
window.addEventListener('pagehide', stopAuto);
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if (!event.target.closest('#board, .play-panel')) return;
  // Native Space on a focused control must activate that control only once.
  if (key === ' ' && event.target.closest('button, a, summary')) return;
  if (key === 'escape' && revealing) { event.preventDefault(); stopAuto(); announce(`Playback paused at step ${revealIndex}.`); return; }
  if (revealing) return;
  const actions = { f: () => move('forward'), arrowup: () => move('forward'), t: () => move('turn'), ' ': () => move('turn'), z: undo, r: () => reset() };
  if (actions[key]) { event.preventDefault(); actions[key](); }
});
byId('puzzle-title').textContent = PUZZLE.title;
byId('instrument').hidden = false;
const controls = document.querySelector('.play-panel');
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--controls-height', `${Math.ceil(controls.getBoundingClientRect().height)}px`);
}).observe(controls);
renderExperiment();
reset();
