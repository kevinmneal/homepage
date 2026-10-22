/** One curated puzzle. Recheck advertised properties with npm test. */
export const PUZZLE = {
  "id": "long-way-round-v2",
  "title": "The long way round",
  "rulesVersion": "1.0",
  "rows": [
    "#######",
    "#.#...#",
    "#...S.#",
    "#.....#",
    "#.#...#",
    "#....##",
    "#######"
  ],
  "start": {
    "x": 1,
    "y": 2,
    "heading": 3,
    "mode": "left"
  },
  "exit": {
    "x": 1,
    "y": 1
  },
  "editable": {
    "x": 4,
    "y": 2
  }
};

/** Replayable shortest witness; move zero is the initial state. */
export const WITNESS = {
  "actions": [
    "turn",
    "turn",
    "forward",
    "forward",
    "forward",
    "turn",
    "turn",
    "forward",
    "forward",
    "forward",
    "turn"
  ],
  "states": [
    {
      "x": 1,
      "y": 2,
      "heading": 3,
      "mode": "left"
    },
    {
      "x": 1,
      "y": 3,
      "heading": 2,
      "mode": "left"
    },
    {
      "x": 2,
      "y": 3,
      "heading": 1,
      "mode": "left"
    },
    {
      "x": 3,
      "y": 3,
      "heading": 1,
      "mode": "left"
    },
    {
      "x": 4,
      "y": 3,
      "heading": 1,
      "mode": "left"
    },
    {
      "x": 5,
      "y": 3,
      "heading": 1,
      "mode": "left"
    },
    {
      "x": 5,
      "y": 2,
      "heading": 0,
      "mode": "left"
    },
    {
      "x": 4,
      "y": 2,
      "heading": 3,
      "mode": "right"
    },
    {
      "x": 3,
      "y": 2,
      "heading": 3,
      "mode": "right"
    },
    {
      "x": 2,
      "y": 2,
      "heading": 3,
      "mode": "right"
    },
    {
      "x": 1,
      "y": 2,
      "heading": 3,
      "mode": "right"
    },
    {
      "x": 1,
      "y": 1,
      "heading": 0,
      "mode": "right"
    }
  ]
};

/** Structural and pacing facts, not a human difficulty rating.
 * The no-repeat check retains position history, separate from full-state BFS.
 * Choice move numbers describe the state before taking an action.
 */
export const PROPERTIES = {
  "shortestDistance": 11,
  "shortestCount": 1,
  "necessaryRevisit": true,
  "necessarySwitch": true,
  "withoutSwitch": {
    "solvable": false,
    "reachableStates": 46
  },
  "noPositionRepeat": {
    "status": "EXHAUSTIVE_NO_SOLUTION",
    "pathPrefixes": 68
  },
  "switchEntryMoves": [
    7
  ],
  "samePositionWitness": {
    "firstMove": 0,
    "secondMove": 10,
    "x": 1,
    "y": 2,
    "sameHeading": true,
    "differentMode": true
  },
  "pacing": {
    "firstRecoverableChoiceMove": 1,
    "choiceMoves": [
      1,
      2,
      3,
      4,
      6,
      7,
      8
    ],
    "alternateExtraMoves": [
      6,
      4,
      4,
      2,
      2,
      6,
      8
    ],
    "allAlternativesRecoverable": true,
    "maxForcedChainOnShortest": 2,
    "earliestSwitchMove": 5,
    "firstSwitchOnShortest": 7,
    "earliestSwitchSolutionDistance": 13
  },
  "openingChoice": {
    "move": 1,
    "shortestAction": "turn",
    "alternativeAction": "forward",
    "alternativeDistance": 17,
    "shortestSwitchHeading": 3,
    "alternativeSwitchHeading": 0
  },
  "approachChoice": {
    "move": 4,
    "x": 4,
    "y": 3,
    "shortestAction": "forward",
    "shortestSwitchMove": 7,
    "shortestSwitchHeading": 3,
    "shortestDistance": 11,
    "earlierSwitchAction": "turn",
    "earlierSwitchMove": 5,
    "earlierSwitchHeading": 0,
    "earlierSwitchDistance": 13
  }
};
