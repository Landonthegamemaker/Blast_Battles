/**
 * progression.js — Persistent currency & item-ownership system
 * Dependencies (must load first): data.js (DEFAULT_OWNED_IDS, ALL_EQUIPPABLE)
 * Backed by localStorage — survives reloads/rematches (this is a static site,
 * so localStorage is the only persistence option available).
 *
 * Exports (browser globals):
 *   getCredits()                     → number
 *   addCredits(amount, reason?)      → new balance (also logs to console)
 *   isOwned(itemId)                  → boolean
 *   buyItem(itemId)                  → { ok: boolean, reason?: string }
 *   awardMatchCredits(battleScore)   → number credits awarded (can be negative — see below)
 *   resetProgression()               → wipes credits/ownership back to defaults (debug/testing)
 *
 * ── Credit formula ──────────────────────────────────────────────────────
 * creditsEarned = round(100 × battleScore)
 * `battleScore` is the same tanh(net dmg)+survivability number already shown on the
 * end-game modal (see computeBattleScore() in combat.js) — so credits scale with how
 * well the match actually went, not just win/loss. An immediate retreat carries the
 * full early-exit penalty baked into that score, which works out to roughly -$50.
 * Balance is clamped at 0 — a bad enough result can't push you into debt.
 */
'use strict';

const CREDITS_KEY = 'bb-credits';
const OWNED_KEY = 'bb-owned';
const STARTING_CREDITS = 100;

function _loadOwned() {
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    if (!raw) return new Set(DEFAULT_OWNED_IDS);
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : DEFAULT_OWNED_IDS);
  } catch {
    return new Set(DEFAULT_OWNED_IDS);
  }
}

function _saveOwned(set) {
  localStorage.setItem(OWNED_KEY, JSON.stringify([...set]));
}

function getCredits() {
  const raw = localStorage.getItem(CREDITS_KEY);
  if (raw === null) {
    localStorage.setItem(CREDITS_KEY, String(STARTING_CREDITS));
    return STARTING_CREDITS;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : STARTING_CREDITS;
}

function addCredits(amount, reason = '') {
  const bal = Math.max(0, getCredits() + amount);
  localStorage.setItem(CREDITS_KEY, String(bal));
  if (reason) console.log(`[credits] ${amount >= 0 ? '+' : ''}${amount} (${reason}) — balance: ${bal}`);
  return bal;
}

function isOwned(itemId) {
  return _loadOwned().has(itemId);
}

/**
 * Attempts to purchase an item. Deducts credits and marks it owned on success.
 * @param {string} itemId
 * @returns {{ ok: boolean, reason?: string }}
 */
function buyItem(itemId) {
  const item = ALL_EQUIPPABLE.find(i => i.id === itemId);
  if (!item) return { ok: false, reason: 'Unknown item.' };
  const owned = _loadOwned();
  if (owned.has(itemId)) return { ok: false, reason: 'Already owned.' };
  const bal = getCredits();
  if (bal < item.price) return { ok: false, reason: 'Not enough credits.' };
  addCredits(-item.price, `bought ${item.name}`);
  owned.add(itemId);
  _saveOwned(owned);
  return { ok: true };
}

/**
 * Awards credits at the end of a match, scaled by the match's Battle Score.
 * @param {number} battleScore - The same score shown on the end-game modal
 *   (see computeBattleScore() in combat.js). Roughly -1.5 to +1.5.
 * @returns {number} credits awarded (may be negative; balance itself is clamped at 0)
 */
function awardMatchCredits(battleScore) {
  const amount = Math.round(100 * battleScore);
  addCredits(amount, `battle score ${battleScore.toFixed(3)}`);
  return amount;
}

/** Debug helper — wipes progression back to defaults. Not wired to any UI button by default. */
function resetProgression() {
  localStorage.setItem(CREDITS_KEY, String(STARTING_CREDITS));
  _saveOwned(new Set(DEFAULT_OWNED_IDS));
}
