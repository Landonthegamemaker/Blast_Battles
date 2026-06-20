/**
 * utils.js — Blast Battles pure utility functions
 * No dependencies. Safe to import after data.js (or standalone).
 *
 * Exports (browser globals):
 *   deepClone(obj)       → deep copy via JSON round-trip
 *   shuffle(arr)         → new array, Fisher-Yates shuffled
 *   pick(arr, n?)        → n random unique items (default 1)
 *   rand(arr)            → single random element
 */

'use strict';

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
