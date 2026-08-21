/**
 * utils.js — Blast Battles pure utility functions
 * Dependencies: PHASES (data.js) for isWeaponSpeedReady — load after data.js.
 *
 * Exports (browser globals):
 *   deepClone(obj)       → deep copy via JSON round-trip
 *   shuffle(arr)         → new array, Fisher-Yates shuffled
 *   pick(arr, n?)        → n random unique items (default 1)
 *   rand(arr)            → single random element
 *   isWeaponSpeedReady(card, phase, attribute?) → boolean
 */

'use strict';

/**
 * Whether a weapon's speed makes it playable during the given phase.
 *
 * Weapons become "ready" starting at their designated phase and stay ready
 * for every phase after that (cascading forward through fast→medium→slow→
 * charged): Fast is playable in all 4 phases, Medium in 3 (medium/slow/
 * charged), Slow in 2 (slow/charged), Charged in just 1 (charged only).
 * Faster weapons are simply always-ready; slower/heavier ones need to "charge
 * up" and are restricted to their own phase or later.
 *
 * Deadeye's revolvers additionally get a one-phase-early bonus stacked on
 * top of this (fires as if their speed were one notch faster).
 *
 * This is the single source of truth for this rule — combat.js, render.js,
 * game-state.js, player-actions.js, and ai-bot.js all call this instead of
 * each re-implementing the same phase-index comparison.
 *
 * @param {{ speed: string, subtype?: string }} card
 * @param {string} phase - current phase name ('fast'|'medium'|'slow'|'charged')
 * @param {string} [attribute] - acting character's attribute, for the deadeye bonus
 * @returns {boolean}
 */
function isWeaponSpeedReady(card, phase, attribute) {
  const currentIdx = PHASES.indexOf(phase);
  let cardIdx = PHASES.indexOf(card.speed);
  if (attribute === 'deadeye' && card.subtype === 'revolver' && cardIdx > 0) cardIdx -= 1;
  return currentIdx >= cardIdx;
}

/**
 * Deep-clones any JSON-serialisable value.
 * Uses JSON round-trip — fast and sufficient for all game data.
 *
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Returns a new array containing the same elements in a random order.
 * Original array is not mutated.
 * Uses the Fisher-Yates (Knuth) algorithm.
 *
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks n unique random elements from arr (without replacement).
 * Returns a new array; never mutates the input.
 *
 * @template T
 * @param {T[]} arr
 * @param {number} [n=1]
 * @returns {T[]}
 */
function pick(arr, n = 1) {
  return shuffle(arr).slice(0, n);
}

/**
 * Returns a single uniformly-random element from arr.
 * Returns undefined for an empty array.
 *
 * @template T
 * @param {T[]} arr
 * @returns {T | undefined}
 */
function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
