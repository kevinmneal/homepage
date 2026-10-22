import { createPuzzle } from "./engine.mjs";

// The worker owns the search graph. Only analysis results and one ranked
// completion cross the boundary, never a collection of solutions or the DAG.
let puzzle = null;
let initialCount = 0n;
let activeId = null;

self.onmessage = ({ data }) => {
  const { id, type } = data ?? {};
  activeId = id;
  try {
    if (type === "completion") {
      if (!puzzle) throw new Error("Choose a board before browsing finishes.");
      if (!Array.isArray(data.fixedIds))
        throw new Error("Placements must be an array.");
      if (typeof data.rank !== "bigint")
        throw new Error("A completion rank must be a BigInt.");
      const completion = puzzle.completion(data.fixedIds, data.rank);
      self.postMessage({ id, type: "completion", rank: data.rank, completion });
      return;
    }
    let analysis;
    if (type === "init") {
      puzzle = null;
      initialCount = 0n;
      puzzle = createPuzzle(data.boardId, {
        maxStates: 2_500_000,
        maxMs: 30_000,
        onProgress: (stats) =>
          self.postMessage({ id: activeId, type: "progress", stats }),
      });
      analysis = puzzle.analyze();
      initialCount = analysis.count;
    } else if (type === "analyze") {
      if (!puzzle)
        throw new Error("Choose a board before analyzing placements.");
      if (!Array.isArray(data.fixedIds))
        throw new Error("Placements must be an array.");
      analysis = puzzle.analyze(data.fixedIds);
    } else {
      throw new Error("Unknown solver request.");
    }
    const fixedIds = type === "init" ? [] : data.fixedIds;
    const completion =
      analysis.count > 0n
        ? puzzle.completion(fixedIds, data.variant ?? 0)
        : null;
    self.postMessage({
      id,
      type: "result",
      analysis,
      completion,
      initialCount,
    });
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
