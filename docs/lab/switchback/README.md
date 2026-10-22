# Switchback Foundry

[Play the puzzle](https://kevinmneal.com/lab/switchback/) · [Kevin's lab](https://kevinmneal.com/lab/)

A small, state-dependent maze: go forward, or turn and step, while only one turn direction is allowed. One curated puzzle, gradual hints, an optional shortest-route challenge, and a prediction experiment that changes one switch to floor.

This is a playable prototype for human playtesting. Its rules and structural properties have independent checks; those checks do not establish human difficulty or enjoyment.

Plain HTML, CSS, SVG, and JavaScript modules. No production dependencies, accounts, storage, analytics, or network calls are needed to play. The site supplies its shared Solarized stylesheet and theme control.

## Play and discovery

Click or Tab to the maze for F / Up to move forward, T / Space to turn and step, Z to undo, and R to reset. The buttons show the same actions with direction and destination. Shortcuts operate only when the maze or play controls have focus; focused buttons retain native Space activation.

- **Hints:** Need a nudge? reveals one clue. Another hint advances from thinking about the exit, to carrying a changed rule, to planning the switch approach. The full walkthrough is available inside the help panel. It preserves the interrupted run, explains the approach, and pauses at the important return.
- **First success:** Reaching the exit celebrates the completed route without an automatic comparison. Try the route challenge then reveals the target and keeps the best completed route for this page session. Watching the walkthrough does not count as a personal win. An already-optimal first route completes the optional challenge immediately.
- **Prediction:** Explore the switch is an optional disclosure. Choose whether a route would remain if E3 became ordinary floor. Try with floor changes the board and starts a fresh run without disclosing the answer. Check my prediction explicitly reveals the result without changing the current run. The checked prediction is retained; returning to the original maze preserves the session's best route.
- **Explanation:** A closer look at the way home appears after a personal success or a requested prediction check. Solver counts are kept behind the experiment's How was this checked? disclosure.

Hints, progress, and predictions last only for the current page session. Reloading starts fresh. Movement, hints, and requested results use one persistent live announcement. Narrow screens dock the controls; short screens use normal page flow. Responsive browser checks are not a physical-device or spoken screen-reader audit.

## Rules

State is `(x, y, heading, mode)`, with headings north/east/south/west numbered 0–3 and mode `left` or `right`. A legal action moves forward, or makes the allowed quarter-turn and moves one square. Entering a switch flips mode every time; leaving it does not. There are no in-place turns, reverse actions, or moves after reaching the exit. Undo and reset are interface controls outside the solver's move set.

`model.mjs` contains the shared transition rules and shortest-path solver. `puzzle.mjs` saves the board, start, rules version, replayable shortest witness, and checked properties. `app.mjs` controls presentation and session progress. The maze and solver were kept unchanged during the discovery-flow pass.

<details>
<summary>Checked puzzle structure (solution spoilers)</summary>

The puzzle is **The long way round**, `long-way-round-v2`, rules `1.0`.

- Exactly one shortest action sequence, length **11**.
- The first recoverable choice appears after move **1**. All seven alternatives along the shortest route can still reach the exit; this does not claim that every action elsewhere is recoverable.
- The opening alternative gives a distinct **17-move** solution with a different heading at the switch.
- At E4 on move 4, turning onto the switch immediately gives a **13-move** completion. Passing it and entering from the east gives **11**. Earlier arrival is not the best arrival.
- The shortest route enters E3 at move **7**, then returns to B3 at move **10** facing west, now with right turns. The next turn reaches B2.
- No solution avoids revisiting a position: an exhaustive search retaining visited-position history checks **68** legal path prefixes.
- Replacing E3 with traversable floor makes the exit unreachable: **46** reachable full states are exhausted.

</details>

## Verification

From the repository root:

```sh
node scripts/check-switchback.mjs
node --check docs/lab/switchback/app.mjs
python3 scripts/build-agent-pages.py --check
git diff --check
```

The model check uses an independent direction-vector transition oracle and action-word layer enumeration. It checks 600 possible restart states and 1,200 transitions over the original board, edited board, and shortest-count fixtures; separate checks cover repeated switch entry, terminal behavior, witness replay, no-position-repeat exhaustion, edit isolation, and the route-choice properties. GitHub Actions runs the model and discovery checks.

The discovery pass was also exercised in a browser: staged hints, saved-run restoration, a full walkthrough that does not award a win, first finishes in 13 and 11 moves, both challenge paths, prediction-first gating, trying the floor variant before checking, and checking without resetting the run. Desktop and narrow layouts were visually inspected.

## Local preview and portable export

Serve the site's `docs/` directory and open `/lab/switchback/`:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

To produce a self-contained HTML file with the same model, puzzle, styles, and UI:

```sh
python3 scripts/build-switchback-preview.py /absolute/output/Switchback_Foundry.html
```

The export needs no server or external runtime assets; its lab links point to the public lab. The module files remain the source of truth. Direct-file launch was not visually tested because the browser automation's URL policy blocks it; the HTTP module version and export structure/syntax were checked.

Keep further work focused on observations from first-time players: can they predict a turn-and-step, plan a useful return, and explain why the switch approach matters? There is no generator, daily service, leaderboard, or account system in this prototype.
