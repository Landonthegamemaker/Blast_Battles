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
 *   hasAnyOwnedItems()                → boolean (true once anything at all has been bought)
 *   buyItem(itemId)                  → { ok: boolean, reason?: string } — weapons locked to the
 *                                       shopping-for character's designated subtype (data.js);
 *                                       armor/gear locked until hasAnyOwnedItems() is true
 *   grantFreeItem(itemId, qty?)      → void — mission-issued gear, bypasses credits/subtype-lock entirely
 *   sellItem(itemId)                 → { ok: boolean, reason?: string, refund?: number }
 *   awardMatchCredits(battleScore, difficulty?, outcome) → number credits awarded
 *                                     (outcome: 'win'|'draw'|'loss'|'retreat' — see function docstring)
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
const STARTING_CREDITS = 120; // enough for 2 Pulse Phasers ($60 each) if bought outright

// rewards = battleScore × $100 × multiplier — Hard/Impossible pay more for the
// same performance since they're meaningfully harder to win against.
// Applies to wins and draws. Losses are always $0 (see awardMatchCredits) —
// losing shouldn't be able to wipe out a saved-up bankroll, only winning less.
const DIFFICULTY_WIN_MULTIPLIER = { easy: 0.5, medium: 1.0, hard: 2.0, impossible: 4.0 };
// Retreat still costs something (the early-exit penalty baked into battleScore
// via computeBattleScore(true)), but at a much gentler scale than a real loss
// would have — this exists purely to discourage retreat-spamming for free,
// not to punish retreating as harshly as an actual defeat.
const DIFFICULTY_RETREAT_MULTIPLIER = { easy: 0.25, medium: 0.5, hard: 1.0, impossible: 2.0 };

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

/**
 * Grants item ownership WITHOUT touching credits or the subtype-purchase-lock —
 * for mission-issued/scripted gear (e.g. the Sterling Cross tutorial handing
 * Pete 2 free Pulse Phasers) rather than a normal Shop purchase.
 * @param {string} itemId
 * @param {number} qty
 */
function grantFreeItem(itemId, qty = 1) {
  const map = _loadOwned();
  map[itemId] = (map[itemId] || 0) + qty;
  _saveOwned(map);
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

/** True if the player owns at least one item of any kind (any quantity > 0). */
function hasAnyOwnedItems() {
  const map = _loadOwned();
  return Object.values(map).some(qty => qty > 0);
}

function isOwned(itemId) {
  return getOwnedQuantity(itemId) > 0;
}

/**
 * Buys one additional copy of an item. Owning multiple copies is what allows
 * equipping the same weapon into both hand slots (or both arm slots).
 *
 * Both weapons AND gear are now character-locked (see data.js
 * CHARACTER_UNLOCK_REQUIREMENTS + GEAR_ITEM_OWNERS):
 *   - Weapons: purchasable if their subtype appears anywhere in the shopping-for
 *     character's weaponGroups (getAllowedPurchaseSubtypes).
 *   - Gear: purchasable if the shopping-for character's id is in that specific
 *     item's owner list (getGearItemOwners) — items can belong to more than
 *     one character (e.g. Shades → Hank AND Ace), not strictly one each.
 *   - Healing items are exempt from the lock entirely — any character can buy any of them.
 * "Shopping for" is normally whichever character is CURRENTLY SELECTED
 * (_selectedCharId), but the Bestiary can override this to a LOCKED character
 * via _shopTargetCharId (see char-select.js shopForLockedChar()), since you can
 * only ever *select* already-unlocked characters — without that override, any
 * item exclusive to a still-locked character could never be bought by anyone.
 * @param {string} itemId
 * @returns {{ ok: boolean, reason?: string }}
 */
function buyItem(itemId) {
  const item = ALL_EQUIPPABLE.find(i => i.id === itemId);
  if (!item) return { ok: false, reason: 'Unknown item.' };

  if (typeof isUniversalItem === 'function' && isUniversalItem(itemId)) {
    // Healing items — no character lock at all.
  } else {
    const shoppingForId = (typeof _shopTargetCharId !== 'undefined' && _shopTargetCharId)
      || (typeof _selectedCharId !== 'undefined' && _selectedCharId);
    const shoppingForChar = (shoppingForId && typeof CHARACTER_POOL !== 'undefined')
      ? CHARACTER_POOL.find(c => c.id === shoppingForId)
      : null;
    if (shoppingForChar) {
      if (item.type === 'weapon') {
        const allowed = (typeof getAllowedPurchaseSubtypes === 'function') ? getAllowedPurchaseSubtypes(shoppingForChar.id) : [];
        if (allowed.length && !allowed.includes(item.subtype)) {
          const label = allowed.map(s => s.replace('_', ' ')).join(' or ');
          return { ok: false, reason: `${shoppingForChar.name} can only buy ${label} weapons.` };
        }
      } else {
        const owners = (typeof getGearItemOwners === 'function') ? getGearItemOwners(itemId) : null;
        if (owners && !owners.includes(shoppingForChar.id)) {
          return { ok: false, reason: `${item.name} isn't ${shoppingForChar.name}'s gear.` };
        }
      }
    }
  }

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
 *
 * Safeguard: selling a weapon that would leave the player owning ZERO weapons
 * total is blocked UNLESS their credits after the sale can afford a weapon of
 * the CURRENTLY SELECTED character's designated subtype (if one is selected —
 * falls back to the cheapest weapon anywhere otherwise). This checks the
 * *purchasable* subtype specifically, not just anything they could equip —
 * since buyItem() now locks weapon purchases to one subtype per character,
 * "can afford some other weapon" isn't a real safety net if that other
 * weapon isn't even something they're allowed to buy going forward.
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

  if (item.type === 'weapon') {
    const totalWeaponsOwned = WEAPON_POOL.reduce((sum, w) => sum + (map[w.id] || 0), 0);
    const sellingLastWeapon = totalWeaponsOwned <= 1; // this is the only weapon unit left, of any kind
    if (sellingLastWeapon) {
      const creditsAfterSale = getCredits() + refund;
      const shoppingForId = (typeof _shopTargetCharId !== 'undefined' && _shopTargetCharId)
        || (typeof _selectedCharId !== 'undefined' && _selectedCharId);
      const selectedChar = (shoppingForId && typeof CHARACTER_POOL !== 'undefined')
        ? CHARACTER_POOL.find(c => c.id === shoppingForId)
        : null;
      const designated = selectedChar ? (typeof getAllowedPurchaseSubtypes === 'function' ? getAllowedPurchaseSubtypes(selectedChar.id) : []) : [];
      const candidatePool = designated.length ? WEAPON_POOL.filter(w => designated.includes(w.subtype)) : WEAPON_POOL;
      const cheapestReplacement = candidatePool.length
        ? candidatePool.reduce((min, w) => (w.price < min.price ? w : min), candidatePool[0])
        : null;
      if (!cheapestReplacement || creditsAfterSale < cheapestReplacement.price) {
        const who = selectedChar ? ` ${selectedChar.name} can buy` : '';
        return {
          ok: false,
          reason: cheapestReplacement
            ? `Selling your last weapon would leave you unable to afford a replacement${who} (cheapest is ${cheapestReplacement.name} at $${cheapestReplacement.price}). Buy something else first.`
            : `Selling your last weapon would leave you with nothing${who}. Buy something else first.`
        };
      }
    }
  }

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
/**
 * Awards credits at the end of a match. Outcome-aware:
 *   - 'win' / 'draw' — scales with Battle Score × difficulty (0.5x/1x/2x/4x), same as before.
 *   - 'loss'         — always $0. Losing costs nothing; it just doesn't earn anything either.
 *   - 'retreat'      — scales with Battle Score (already negative from the early-exit penalty)
 *                       × a much gentler difficulty scale (0.25x/0.5x/1x/2x), just enough to
 *                       discourage retreat-spamming without punishing it like a real loss.
 * @param {number} battleScore - The same score shown on the end-game modal
 *   (see computeBattleScore() in combat.js). Roughly -1.5 to +1.5.
 * @param {string} [difficulty] - 'easy'|'medium'|'hard'|'impossible' (defaults to 1x if omitted/unknown)
 * @param {'win'|'draw'|'loss'|'retreat'} outcome
 * @returns {number} credits awarded (retreat can be negative; balance itself is clamped at 0)
 */
function awardMatchCredits(battleScore, difficulty, outcome) {
  if (outcome === 'loss') {
    addCredits(0, `loss — no penalty (${difficulty || 'unknown'})`);
    return 0;
  }
  const table = outcome === 'retreat' ? DIFFICULTY_RETREAT_MULTIPLIER : DIFFICULTY_WIN_MULTIPLIER;
  const multiplier = table[difficulty] ?? 1.0;
  const amount = Math.round(100 * battleScore * multiplier);
  addCredits(amount, `${outcome || 'match'} — battle score ${battleScore.toFixed(3)} × ${multiplier} (${difficulty || 'unknown'})`);
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
/**
 * A locked character unlocks once ALL of these are true, per their unlock
 * requirement (see getUnlockRequirement() in data.js):
 *   1. You've won against them, as the bot opponent, on every difficulty
 *      their requirement lists (not necessarily all 4 — e.g. Clint just needs Easy).
 *   2. You own at least one weapon from EVERY weaponGroup they list — a group
 *      with multiple subtypes is satisfied by owning ANY one of them (e.g.
 *      Macy's ['pistol','melee'] group needs just a pistol OR a melee weapon),
 *      while separate groups are ALL required (e.g. Titan needs a revolver
 *      AND separately an explosive).
 *   3. You own every specific gear item in their gearItems list.
 *   4. If requiresAnyHealing is set (Macy only), you own at least one of the
 *      universal healing items.
 */
function isCharUnlocked(charId) {
  if (typeof STARTER_UNLOCKED_IDS !== 'undefined' && STARTER_UNLOCKED_IDS.includes(charId)) return true;
  const req = (typeof getUnlockRequirement === 'function') ? getUnlockRequirement(charId) : null;
  if (!req) return false;
  const progress = getDefeatProgress(charId);
  if (!req.difficulties.every(d => progress[d])) return false;
  if (!req.weaponGroups.every(group => group.some(sub => _ownsAnyOfSubtype(sub)))) return false;
  if (!req.gearItems.every(itemId => _ownsItem(itemId))) return false;
  if (req.requiresAnyHealing && !_ownsAnyHealingItem()) return false;
  return true;
}

/** True if the player owns at least one unit of any weapon with the given subtype. */
function _ownsAnyOfSubtype(subtype) {
  if (typeof WEAPON_POOL === 'undefined') return true;
  const map = _loadOwned();
  return WEAPON_POOL.some(w => w.subtype === subtype && (map[w.id] || 0) > 0);
}

/** True if the player owns at least one unit of a specific item id. */
function _ownsItem(itemId) {
  const map = _loadOwned();
  return (map[itemId] || 0) > 0;
}

/** True if the player owns at least one of the universal healing items. */
function _ownsAnyHealingItem() {
  if (typeof HEALING_ITEM_IDS === 'undefined') return true;
  const map = _loadOwned();
  return HEALING_ITEM_IDS.some(id => (map[id] || 0) > 0);
}

/** True if the player owns at least one weapon of EVERY real subtype (for 'any' characters). */
function _ownsAllSubtypes() {
  if (typeof ALL_WEAPON_SUBTYPES === 'undefined') return true;
  return ALL_WEAPON_SUBTYPES.every(sub => _ownsAnyOfSubtype(sub));
}

/**
 * A single merged X/N unlock-progress count for a character — combines
 * difficulties beaten, weapon-groups satisfied, specific gear items owned,
 * and the healing requirement (Macy only) into one number, matching the
 * "total weight" figure used to balance difficulty requirements against gear
 * burden (e.g. Lunging Logan is X/5, Tracy Guns is X/14).
 * @param {string} charId
 * @returns {{ current: number, total: number }}
 */
function getUnlockProgressCount(charId) {
  const req = (typeof getUnlockRequirement === 'function') ? getUnlockRequirement(charId) : null;
  if (!req) return { current: 0, total: 0 };
  const progress = getDefeatProgress(charId);
  let current = 0;
  let total = 0;

  total += req.difficulties.length;
  current += req.difficulties.filter(d => progress[d]).length;

  total += req.weaponGroups.length;
  current += req.weaponGroups.filter(group => group.some(sub => _ownsAnyOfSubtype(sub))).length;

  total += req.gearItems.length;
  current += req.gearItems.filter(id => _ownsItem(id)).length;

  if (req.requiresAnyHealing) {
    total += 1;
    if (_ownsAnyHealingItem()) current += 1;
  }

  return { current, total };
}

/** Debug helper — wipes progression back to defaults. Not wired to any UI button by default. */
function resetProgression() {
  localStorage.setItem(CREDITS_KEY, String(STARTING_CREDITS));
  _saveOwned(_defaultOwnedMap());
  localStorage.removeItem(DEFEATS_KEY);
  localStorage.removeItem('bb-loadouts');
  localStorage.removeItem('bb-tutorial-seen'); // replays the dialogue next time char-select shows
  localStorage.removeItem('bb-tutorial-match-done'); // without this, replaying the tutorial after
  // a reset wouldn't re-grant the guaranteed credit top-up or re-pre-flag Clint's higher
  // difficulties — the one-time gate would still show as already consumed from before.
}
