/**
 * equip.js — Equip screen: pre-match 8-slot paperdoll loadout selection.
 * Dependencies (must load first): data.js (ALL_EQUIPPABLE, getAllowedWeaponSubtypes),
 *   progression.js (isOwned/getOwnedQuantity/getCredits), char-select.js (_selectedCharId, showCharSelect)
 *
 * ── Persistence model ──────────────────────────────────────────────────────
 * Each character has their OWN saved loadout — switching characters no longer
 * loses or corrupts anything; picking Pete's guns back up after playing Macy
 * shows exactly what Pete had equipped last time. All loadouts are persisted to
 * localStorage under 'bb-loadouts', keyed by character id.
 *
 * The `PlayerLoadout` global always mirrors whichever character is CURRENTLY
 * selected (loaded fresh in showEquipScreen(), saved on every pick) — this
 * keeps game-state.js's initGame() able to just read `PlayerLoadout.hand1` etc.
 * unchanged, regardless of the per-character storage underneath.
 *
 * Ownership is quantity-based (progression.js) — the same physical item can be
 * equipped into more than one slot on ONE character if you own enough copies
 * (e.g. own 2 RPG-7s → dual-wield RPGs on Pete), and completely independently,
 * a DIFFERENT character's saved loadout can reference that same owned weapon
 * too — only one character is ever actually fielded in a match at a time, so
 * there's no real conflict in two characters' loadouts both pointing at it.
 *
 * Exports (browser globals):
 *   PlayerLoadout        — { head, chest, legs, feet, armL, armR, hand1, hand2 } (item ids or null)
 *                           always mirrors the currently-selected character
 *   showEquipScreen()    — called from char-select.js on confirm; loads that character's saved loadout
 *   openSlotPicker(slot) — shows owned items for a slot in the side panel
 *   confirmEquip()       — validates (needs at least 1 hand item) and proceeds to Opponent Select
 *   backToCharSelect()   — returns to character select; current loadout is already saved
 *
 * ── Rules enforced here ─────────────────────────────────────────────────
 *   - Weapon restrictions: a character with a restricted attribute (e.g. Lunging Logan —
 *     melee only) can't put a disallowed weapon in a hand slot.
 *   - 2-armor cap: head/chest/legs/feet/armL/armR are all armor. At most 2 of those
 *     6 slots may be filled at once, same as the in-match "2 equipped defense items
 *     max" rule.
 *   - Quantity cap: an item can occupy multiple slots on ONE character only up to how
 *     many copies you own — own 1, it locks everywhere else once placed; own 2+, it
 *     stays available for a second slot.
 *   - Switching characters (or selling gear) revalidates the loadout on open: anything
 *     no longer usable (wrong weapon subtype, armor for Pete/Tracy, or sold below what's
 *     needed) is cleared automatically instead of silently staying equipped-but-broken.
 */
'use strict';

const LOADOUTS_KEY = 'bb-loadouts';

// Which ALL_EQUIPPABLE `.slot` value each paperdoll slot pulls from.
const EQUIP_SLOT_POOL = {
  head: 'head', chest: 'chest', legs: 'legs', feet: 'feet',
  armL: 'arm', armR: 'arm', hand1: 'hand', hand2: 'hand',
};
const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet', 'armL', 'armR'];
const ALL_SLOTS = [...ARMOR_SLOTS, 'hand1', 'hand2'];

function _emptyLoadout() {
  return { head: null, chest: null, legs: null, feet: null, armL: null, armR: null, hand1: null, hand2: null };
}

let PlayerLoadout = _emptyLoadout();
let _activeEquipSlot = null;

function _loadAllLoadouts() {
  try {
    const raw = localStorage.getItem(LOADOUTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

function _saveCurrentLoadout() {
  if (!_selectedCharId) return;
  const all = _loadAllLoadouts();
  all[_selectedCharId] = PlayerLoadout;
  localStorage.setItem(LOADOUTS_KEY, JSON.stringify(all));
}

function _slotShortStat(item) {
  if (item.type === 'weapon') return `${item.damage} DMG`;
  if (item.healAmount > 0) return `+${item.healAmount} HP`;
  return `${item.defense} DEF`;
}

function _currentPlayerChar() {
  return (typeof CHARACTER_POOL !== 'undefined' && _selectedCharId)
    ? CHARACTER_POOL.find(c => c.id === _selectedCharId)
    : null;
}

/** How many of the 6 armor slots (other than `excludeSlot`) currently hold an item. */
function _armorSlotsFilledCount(excludeSlot = null) {
  return ARMOR_SLOTS.filter(s => s !== excludeSlot && PlayerLoadout[s]).length;
}

/** True if a defense-type item is one this character can never actually play in-match. */
function _isDefenseItemBlocked(char, item) {
  if (item.type !== 'defense') return false;
  if (!char) return false;
  if (char.attribute === 'extra_carry') return true; // Tracy: weapons only, no exceptions
  if (char.attribute === 'dual_wield' && item.healAmount === 0) return true; // Pete: no armor, healing OK
  return false;
}

/**
 * True if a weapon-type item is off-limits for this character. Checks both:
 *   - the legacy hard equip restriction (WEAPON_ATTRIBUTE_RESTRICTIONS, 4 characters,
 *     e.g. Pete allows pistol OR revolver)
 *   - the newer designated-subtype system (all 16 characters, exactly one subtype each)
 * The designated subtype is the one that actually matters going forward, since
 * buyItem() only lets you acquire weapons of your designated subtype in the first
 * place — this just makes sure the Equip picker can't offer anything you could
 * never have bought (e.g. a revolver someone owned before this system existed).
 */
function _isWeaponItemBlocked(char, item) {
  if (item.type !== 'weapon' || !char) return false;
  const allowed = getAllowedWeaponSubtypes(char.attribute);
  if (allowed && !allowed.includes(item.subtype)) return true;
  const designated = (typeof getDesignatedSubtype === 'function') ? getDesignatedSubtype(char.id) : null;
  if (designated && item.subtype !== designated) return true;
  return false;
}

/**
 * Drops any loadout picks the currently-selected character can no longer use —
 * called whenever the Equip screen opens, so switching characters never leaves
 * stale, incompatible gear equipped.
 */
function _validateLoadoutForChar(char) {
  for (const slot of ALL_SLOTS) {
    const id = PlayerLoadout[slot];
    if (!id) continue;
    const item = ALL_EQUIPPABLE.find(i => i.id === id);
    if (!item) { PlayerLoadout[slot] = null; continue; }
    if (_isWeaponItemBlocked(char, item) || _isDefenseItemBlocked(char, item)) {
      PlayerLoadout[slot] = null;
    }
  }
}

/**
 * Drops any slot whose item has since been sold below what this loadout needs —
 * e.g. if 2 slots reference an item you now only own 1 of, the second is cleared
 * (first occurrence, in slot order, wins).
 */
function _validateQuantitiesForLoadout() {
  const counts = {};
  for (const slot of ALL_SLOTS) {
    const id = PlayerLoadout[slot];
    if (id) counts[id] = (counts[id] || 0) + 1;
  }
  for (const id in counts) {
    const owned = getOwnedQuantity(id);
    if (counts[id] <= owned) continue;
    let keep = owned;
    for (const slot of ALL_SLOTS) {
      if (PlayerLoadout[slot] !== id) continue;
      if (keep > 0) keep--;
      else PlayerLoadout[slot] = null;
    }
  }
}

function showEquipScreen() {
  _activeEquipSlot = null;
  const all = _loadAllLoadouts();
  PlayerLoadout = all[_selectedCharId] ? { ..._emptyLoadout(), ...all[_selectedCharId] } : _emptyLoadout();
  _validateLoadoutForChar(_currentPlayerChar());
  _validateQuantitiesForLoadout();
  _saveCurrentLoadout(); // persist any cleanup immediately, so it doesn't re-flash next open

  document.getElementById('equip-credits').textContent = `💰 ${getCredits()}`;
  document.querySelectorAll('.equip-slot').forEach(btn => {
    const slot = btn.dataset.slot;
    const id = PlayerLoadout[slot];
    const item = id ? ALL_EQUIPPABLE.find(i => i.id === id) : null;
    btn.classList.toggle('filled', !!item);
    btn.classList.remove('active-pick');
    btn.querySelector('.equip-slot-icon').textContent = item ? item.icon : '➕';
  });
  document.getElementById('equip-picker-empty').style.display = '';
  document.getElementById('equip-picker-empty').textContent = '← Tap a slot on the left to see what you own for it.';
  document.getElementById('equip-picker-list').style.display = 'none';
  document.getElementById('equip-overlay').classList.remove('hidden');
  _updateEquipConfirmState();
}

/** Returns to character select. The current character's loadout is already saved. */
function backToCharSelect() {
  document.getElementById('equip-overlay').classList.add('hidden');
  showCharSelect();
}

function openSlotPicker(slot) {
  _activeEquipSlot = slot;
  document.querySelectorAll('.equip-slot').forEach(b => b.classList.toggle('active-pick', b.dataset.slot === slot));

  const poolSlot = EQUIP_SLOT_POOL[slot];
  const isHandSlot = poolSlot === 'hand';
  const isArmorSlot = ARMOR_SLOTS.includes(slot);
  const char = _currentPlayerChar();
  const armorCapReached = isArmorSlot && !PlayerLoadout[slot] && _armorSlotsFilledCount(slot) >= 2;

  const owned = ALL_EQUIPPABLE.filter(i => i.slot === poolSlot && isOwned(i.id));
  const emptyEl = document.getElementById('equip-picker-empty');
  const listEl = document.getElementById('equip-picker-list');

  if (owned.length === 0) {
    emptyEl.style.display = '';
    emptyEl.textContent = `You don't own any ${poolSlot} items yet — visit the Shop.`;
    listEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.style.display = 'flex';
  listEl.innerHTML = '';

  if (armorCapReached) {
    const warn = document.createElement('div');
    warn.style.cssText = 'font-size:0.65rem;color:var(--accent2);padding:4px 2px;';
    warn.textContent = '⚠ 2 armor pieces already equipped elsewhere — unequip one first.';
    listEl.appendChild(warn);
  }

  const clearRow = document.createElement('div');
  clearRow.className = 'equip-pick-row' + (!PlayerLoadout[slot] ? ' selected' : '');
  clearRow.innerHTML = `<span class="epr-icon">🚫</span><span class="epr-name">Leave empty</span>`;
  clearRow.onclick = () => _pickSlotItem(slot, null);
  listEl.appendChild(clearRow);

  for (const item of owned) {
    const weaponBlocked = isHandSlot && _isWeaponItemBlocked(char, item);
    const defenseBlocked = _isDefenseItemBlocked(char, item);
    const armorBlocked = armorCapReached && item.id !== PlayerLoadout[slot];

    // Quantity check: how many units does this ONE character's loadout already use
    // elsewhere? If that's >= how many you own, there's nothing left for this slot.
    const usedElsewhereCount = ALL_SLOTS.filter(s => s !== slot && PlayerLoadout[s] === item.id).length;
    const ownedQty = getOwnedQuantity(item.id);
    const availableUnits = ownedQty - usedElsewhereCount;
    const quantityBlocked = availableUnits <= 0;

    const locked = weaponBlocked || defenseBlocked || armorBlocked || quantityBlocked;

    const row = document.createElement('div');
    row.className = 'equip-pick-row' + (PlayerLoadout[slot] === item.id ? ' selected' : '') + (locked ? ' locked' : '');
    const lockNote = weaponBlocked
      ? `🔒 ${char.name} can't use this`
      : defenseBlocked ? (char.attribute === 'dual_wield' ? `🔒 Pete's hands are full` : `🔒 ${char.name} carries weapons only`)
      : armorBlocked ? '🔒 2 armor max'
      : quantityBlocked ? `🔒 Own ${ownedQty}, all in use` : '';
    const qtyHint = !locked && ownedQty > 1 ? ` · own ${ownedQty}` : '';
    row.innerHTML = `<span class="epr-icon">${item.icon}</span><span class="epr-name">${item.name}</span><span class="epr-stat">${lockNote || (_slotShortStat(item) + qtyHint)}</span>`;
    if (!locked) row.onclick = () => _pickSlotItem(slot, item.id);
    listEl.appendChild(row);
  }
}

function _pickSlotItem(slot, itemId) {
  PlayerLoadout[slot] = itemId;
  _saveCurrentLoadout();
  const btn = document.querySelector(`.equip-slot[data-slot="${slot}"]`);
  const item = itemId ? ALL_EQUIPPABLE.find(i => i.id === itemId) : null;
  btn.classList.toggle('filled', !!item);
  btn.querySelector('.equip-slot-icon').textContent = item ? item.icon : '➕';
  openSlotPicker(slot); // re-render so "selected"/locked states update
  _updateEquipConfirmState();
}

function _updateEquipConfirmState() {
  const btn = document.getElementById('equip-confirm-btn');
  const ready = !!(PlayerLoadout.hand1 || PlayerLoadout.hand2);
  btn.style.opacity = ready ? '1' : '0.5';
  btn.style.pointerEvents = ready ? 'auto' : 'none';
}

function confirmEquip() {
  if (!PlayerLoadout.hand1 && !PlayerLoadout.hand2) return;
  document.getElementById('equip-overlay').classList.add('hidden');
  showOpponentSelect();
}
