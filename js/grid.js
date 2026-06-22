/**
 * grid.js — Blast Battles 7×7 grid geometry
 * Dependencies: none (data.js not required — grid size is self-contained).
 *
 * Exports (browser globals):
 *   ADJACENCY            — precomputed cardinal neighbour map  { index → index[] }
 *   getAdjacentIndices(pos)                → index[]
 *   rowOf(idx)                             → 0–6
 *   colOf(idx)                             → 0–6
 *   getReachable(pos, steps)               → index[]  (Chebyshev / king moves)
 *   getReachableForChar(char, pos, steps)  → index[]  (character-specific movement)
 *   getDistance(a, b)                      → number   (Chebyshev distance)
 *
 * Grid layout (row-major, index = row * 5 + col):
 *
 *   0  1  2  3  4  5  6
 *   7  8  9  10 11 12 13
 *   14 15 16 17 18 19 20
 *   21 22 23 24 25 26 27
 *   28 29 30 31 32 33 34
 *   35 36 37 38 39 40 41
 *   42 43 44 45 46 47 48
 *
 * Player starts at 0 (top-left), bot starts at 48 (bottom-right).
 */

'use strict';

// ── Precomputed cardinal adjacency map ──────────────────────────────────────
// Each cell lists its horizontal and vertical (non-diagonal) neighbours.
// Built once at load time; never mutated afterwards.
const ADJACENCY = (function () {
  const adj = {};
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const i = r * 7 + c;
      adj[i] = [];
      if (r > 0) adj[i].push((r - 1) * 7 + c); // up
      if (r < 4) adj[i].push((r + 1) * 7 + c); // down
      if (c > 0) adj[i].push(r * 7 + c - 1);   // left
      if (c < 4) adj[i].push(r * 7 + c + 1);   // right
    }
  }
  return adj;
})();

// ── Basic coordinate helpers ─────────────────────────────────────────────────

/** Returns the 0-based row of a grid index. */
function rowOf(idx) { return Math.floor(idx / 7); }

/** Returns the 0-based column of a grid index. */
function colOf(idx) { return idx % 7; }

/** Returns cardinal neighbours of `pos` (up/down/left/right only). */
function getAdjacentIndices(pos) { return ADJACENCY[pos] || []; }

// ── Reachability ─────────────────────────────────────────────────────────────

/**
 * Returns all tile indices within Chebyshev distance `steps` of `pos`.
 * Chebyshev (king-move) distance counts diagonals as 1 step, so a 1-step
 * radius yields the 8 surrounding tiles (where they exist on the grid).
 * The origin tile (`pos`) is excluded from the result.
 *
 * @param {number} pos   - Origin tile index (0–48)
 * @param {number} steps - Maximum king-move steps
 * @returns {number[]}
 */
function getReachable(pos, steps) {
  const reachable = [];
  const pr = rowOf(pos), pc = colOf(pos);
  for (let i = 0; i < 49; i++) {
    if (i === pos) continue;
    const ir = rowOf(i), ic = colOf(i);
    if (Math.max(Math.abs(ir - pr), Math.abs(ic - pc)) <= steps) reachable.push(i);
  }
  return reachable;
}

/**
 * Character-aware movement — returns the tiles reachable by `char` from `pos`
 * in one move action, given the number of allowed `steps`.
 *
 * Movement patterns:
 *   • healing (Macy the Medic) — cardinal rook: straight lines only,
 *     no diagonals. Thematic: medic moving along corridors.
 *   • all others               — standard Chebyshev king moves (8 directions),
 *     including swift_melee (Lunging Logan).
 *
 * Design notes:
 *   - Logan's diagonal movement is intentional and thematic (zig-zag pursuit).
 *   - Macy's cardinal restriction keeps her feeling like a support character.
 *   - Both patterns guarantee every tile is reachable across multiple turns.
 *
 * @param {{ attribute: string }} char - Character object (only `.attribute` is read)
 * @param {number} pos   - Current tile index (0–48)
 * @param {number} steps - Move range (1 normally, 2 during Fast phase for swift chars)
 * @returns {number[]}
 */
function getReachableForChar(char, pos, steps) {
  if (char.attribute === 'healing') {
    // Macy: cardinal moves only — exactly 1 axis changes, the other stays zero
    const pr = rowOf(pos), pc = colOf(pos);
    const result = [];
    for (let i = 0; i < 49; i++) {
      if (i === pos) continue;
      const dr = Math.abs(rowOf(i) - pr);
      const dc = Math.abs(colOf(i) - pc);
      if ((dr === 0 && dc <= steps && dc > 0) || (dc === 0 && dr <= steps && dr > 0)) {
        result.push(i);
      }
    }
    return result;
  }

  // Default: standard Chebyshev king moves for all other characters
  return getReachable(pos, steps);
}

// ── Distance ─────────────────────────────────────────────────────────────────

/**
 * Chebyshev distance between two tile indices on the 5×5 grid.
 * Diagonals count as 1 (king-move distance), matching `getReachable`.
 * Used for range checks (melee = 0, pistol/shotgun = 1, AR = 2, sniper = 3).
 *
 * @param {number} a - Tile index (0–24)
 * @param {number} b - Tile index (0–24)
 * @returns {number}
 */
function getDistance(a, b) {
  return Math.max(
    Math.abs(rowOf(a) - rowOf(b)),
    Math.abs(colOf(a) - colOf(b))
  );
}
