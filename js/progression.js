/**
 * progression.js — Persistent currency & item-ownership system
 * Dependencies (must load first): data.js (DEFAULT_OWNED_IDS, ALL_EQUIPPABLE)
 * Backed by localStorage — survives reloads/rematches (this is a static site,
 * so localStorage is the only persistence option available).
 *
 * Ownership is quantity-based (own N copies of an item), not a boolean — this is
 * what makes dual-wielding two copies of the same weapon possible: own 2, equip 2.
 * Owned items {} stored as { [itemId]: quantity }. A legacy array-of-ids format
 * (from before quantities existed) is transparently migrated to quantity 1 each
 * on first read.
 *
 * Exports (browser globals):
 *   getCredits()                     → number
 *   addCredits(amount, reason?)      → new balance (also logs to console)
 *   getOwnedQuantity(itemId)         → number (0 if never owned)
 *   isOwned(itemId)                  → boolean (getOwnedQuantity(itemId) > 0)
 *   buyItem(itemId)                  → { ok: boolean, reason?: string }
 *   sellItem(itemId)                 → { ok: boolean, reason?: string, refund?: number }
 *   awardMatchCredits(battleScore, difficulty?) → number credits awarded (can be negative)
 *   resetProgression()               → wipes credits/ownership back to defaults (debug/testing)
 *   recordDefeat(charId, difficulty) → marks a win against charId on that difficulty
 *   getDefeatProgress(charId)        → { easy, medium, hard, impossible } booleans
 *   isCharUnlocked(charId)           → boolean (starter, or won on all 4 difficulties)
 *
 * ── Credit formula ──────────────────────────────────────────────────────
 * creditsEarned = round(100 × battleScore × difficultyMultiplier)
 * `battleScore` is the tanh(net dmg)+survivability number shown on the end-game
 * modal (see computeBattleScore() in combat.js). Hard/Impossible pay out more for
 * the same performance, since they're meaningfully harder to win.
 *
 * ── Selling ──────────────────────────────────────────────────────────────
 * sellItem() refunds 50% of an item's price (rounded down), removing one owned
 * unit. Selling below what a character's saved Equip loadout needs is allowed —
 * equip.js re-validates quantities every time the Equip screen opens and clears
 * any slot that's no longer covered by what you actually own.
 */
'use strict';

const CREDITS_KEY = 'bb-credits';
const OWNED_KEY = 'bb-owned';
const STARTING_CREDITS = 100;

// rewards = battleScore × $100 × multiplier — Hard/Impossible pay more for the
// same performance since they're meaningfully harder to win against.
const DIFFICULTY_CREDIT_MULTIPLIER = { easy: 0.5, medium: 1.0, hard: 2.0, impossible: 4.0 };

function _defaultOwnedMap() {
  const map = {};
  for (const id of DEFAULT_OWNED_IDS) map[id] = 1;
  return map;
}

function _loadOwned() {
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    if (!raw) return _defaultOwnedMap();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Legacy format (Set-like array of ids, implicitly quantity 1 each) — migrate.
      const map = {};
      for (const id of parsed) map[id] = 1;
      return map;
    }
    if (parsed && typeof parsed === 'object') return parsed;
    return _defaultOwnedMap();
  } catch {
    return _defaultOwnedMap();
  }
}

function _saveOwned(map) {
  localStorage.setItem(OWNED_KEY, JSON.stringify(map));
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

/** Number of copies currently owned of an item (0 if never bought). */
function getOwnedQuantity(itemId) {
  const map = _loadOwned();
  return map[itemId] || 0;
}

function isOwned(itemId) {
  return getOwnedQuantity(itemId) > 0;
}

/**
 * Buys one additional copy of an item. Owning multiple copies is what allows
 * equipping the same weapon into both hand slots (or both arm slots).
 * @param {string} itemId
 * @returns {{ ok: boolean, reason?: string }}
 */
function buyItem(itemId) {
  const item = ALL_EQUIPPABLE.find(i => i.id === itemId);
  if (!item) return { ok: false, reason: 'Unknown item.' };
  const bal = getCredits();
  if (bal < item.price) return { ok: false, reason: 'Not enough credits.' };
  addCredits(-item.price, `bought ${item.name}`);
  const map = _loadOwned();
  map[itemId] = (map[itemId] || 0) + 1;
  _saveOwned(map);
  return { ok: true };
}

/**
 * Sells one owned copy of an item back for 50% of its price (rounded down).
 * @param {string} itemId
 * @returns {{ ok: boolean, reason?: string, refund?: number }}
 */
function sellItem(itemId) {
  const item = ALL_EQUIPPABLE.find(i => i.id === itemId);
  if (!item) return { ok: false, reason: 'Unknown item.' };
  const map = _loadOwned();
  const qty = map[itemId] || 0;
  if (qty <= 0) return { ok: false, reason: "You don't own this." };
  const refund = Math.floor(item.price * 0.5);
  map[itemId] = qty - 1;
  if (map[itemId] <= 0) delete map[itemId];
  _saveOwned(map);
  addCredits(refund, `sold ${item.name}`);
  return { ok: true, refund };
}

/**
 * Awards credits at the end of a match, scaled by the match's Battle Score AND
 * the difficulty played — Hard/Impossible pay out more for the same performance.
 * @param {number} battleScore - The same score shown on the end-game modal
 *   (see computeBattleScore() in combat.js). Roughly -1.5 to +1.5.
 * @param {string} [difficulty] - 'easy'|'medium'|'hard'|'impossible' (defaults to 1x if omitted/unknown)
 * @returns {number} credits awarded (may be negative; balance itself is clamped at 0)
 */
function awardMatchCredits(battleScore, difficulty) {
  const multiplier = DIFFICULTY_CREDIT_MULTIPLIER[difficulty] ?? 1.0;
  const amount = Math.round(100 * battleScore * multiplier);
  addCredits(amount, `battle score ${battleScore.toFixed(3)} × ${multiplier} (${difficulty || 'unknown'})`);
  return amount;
}

// ── Character unlocks ────────────────────────────────────────────────────
// A character unlocks once you've WON against them, as the bot opponent, on
// every one of the 4 difficulties. Starter characters (STARTER_UNLOCKED_IDS,
// in data.js) skip this requirement entirely.
const DEFEATS_KEY = 'bb-defeats';
const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'impossible'];

function _loadDefeats() {
  try {
    const raw = localStorage.getItem(DEFEATS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

function _saveDefeats(map) {
  localStorage.setItem(DEFEATS_KEY, JSON.stringify(map));
}

/**
 * Records a win against `charId` on `difficulty`. Safe to call repeatedly —
 * re-beating someone on a difficulty you've already cleared is a no-op.
 * @param {string} charId
 * @param {string} difficulty - 'easy'|'medium'|'hard'|'impossible'
 * @returns {boolean} true if this was the first win recorded for that pairing
 */
function recordDefeat(charId, difficulty) {
  if (!DIFFICULTY_LEVELS.includes(difficulty)) return false;
  const map = _loadDefeats();
  if (!map[charId]) map[charId] = {};
  const wasNew = !map[charId][difficulty];
  map[charId][difficulty] = true;
  _saveDefeats(map);
  return wasNew;
}

/**
 * Win progress against a specific character, one flag per difficulty.
 * @param {string} charId
 * @returns {{ easy: boolean, medium: boolean, hard: boolean, impossible: boolean }}
 */
function getDefeatProgress(charId) {
  const entry = _loadDefeats()[charId] || {};
  return {
    easy: !!entry.easy, medium: !!entry.medium,
    hard: !!entry.hard, impossible: !!entry.impossible,
  };
}

/**
 * Whether a character can currently be selected to play as — starters always
 * can; everyone else needs a recorded win on all 4 difficulties.
 * @param {string} charId
 * @returns {boolean}
 */
function isCharUnlocked(charId) {
  if (typeof STARTER_UNLOCKED_IDS !== 'undefined' && STARTER_UNLOCKED_IDS.includes(charId)) return true;
  const progress = getDefeatProgress(charId);
  return DIFFICULTY_LEVELS.every(d => progress[d]);
}

/** Debug helper — wipes progression back to defaults. Not wired to any UI button by default. */
function resetProgression() {
  localStorage.setItem(CREDITS_KEY, String(STARTING_CREDITS));
  _saveOwned(_defaultOwnedMap());
  localStorage.removeItem(DEFEATS_KEY);
  localStorage.removeItem('bb-loadouts');
}
