/**
 * equip.js — Equip screen: pre-match 8-slot paperdoll loadout selection.
 * Dependencies (must load first): data.js (ALL_EQUIPPABLE, getAllowedWeaponSubtypes),
 *   progression.js (isOwned/getCredits), char-select.js (_selectedCharId)
 * Reads/writes the global `PlayerLoadout` object, consumed by initGame() in game-state.js.
 *
 * Exports (browser globals):
 *   PlayerLoadout        — { head, chest, legs, feet, armL, armR, hand1, hand2 } (item ids or null)
 *   showEquipScreen()    — called from char-select.js on confirm
 *   openSlotPicker(slot) — shows owned items for a slot in the side panel
 *   confirmEquip()       — validates (needs at least 1 hand item) and proceeds to difficulty select
 *
 * ── Rules enforced here ─────────────────────────────────────────────────
 *   - Weapon restrictions: a character with a restricted attribute (e.g. Lunging Logan —
 *     melee only) can't put a disallowed weapon in a hand slot. Mirrors the in-match check
 *     in game-state.js playerPlayCard() (see WEAPON_ATTRIBUTE_RESTRICTIONS in data.js).
 *   - 2-armor cap: head/chest/legs/feet/armL/armR are all armor (type:'defense', defense>0).
 *     At most 2 of those 6 slots may be filled at once, same as the in-match
 *     "2 equipped defense items max" rule (game-state.js playerPlayCard).
 */
'use strict';

let PlayerLoadout = { head: null, chest: null, legs: null, feet: null, armL: null, armR: null, hand1: null, hand2: null };
let _activeEquipSlot = null;

// Which ALL_EQUIPPABLE `.slot` value each paperdoll slot pulls from.
const EQUIP_SLOT_POOL = {
  head: 'head', chest: 'chest', legs: 'legs', feet: 'feet',
  armL: 'arm', armR: 'arm', hand1: 'hand', hand2: 'hand',
};
const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet', 'armL', 'armR'];

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

function showEquipScreen() {
  _activeEquipSlot = null;
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

function openSlotPicker(slot) {
  _activeEquipSlot = slot;
  document.querySelectorAll('.equip-slot').forEach(b => b.classList.toggle('active-pick', b.dataset.slot === slot));

  const poolSlot = EQUIP_SLOT_POOL[slot];
  const isHandSlot = poolSlot === 'hand';
  const isArmorSlot = ARMOR_SLOTS.includes(slot);
  const char = _currentPlayerChar();
  const allowedWeaponSubtypes = (isHandSlot && char) ? getAllowedWeaponSubtypes(char.attribute) : null;
  // Pete (dual_wield) & Tracy (extra_carry) can never play a defense card in-match
  // (see game-state.js/combat.js playerPlayCard — "weapons only") — don't let them
  // equip one into a hand slot only to find it's permanently dead weight.
  const noDefenseCards = isHandSlot && char && (char.attribute === 'dual_wield' || char.attribute === 'extra_carry');
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
    const weaponBlocked = isHandSlot && item.type === 'weapon' && allowedWeaponSubtypes && !allowedWeaponSubtypes.includes(item.subtype);
    const defenseBlocked = isHandSlot && item.type === 'defense' && noDefenseCards;
    const armorBlocked = armorCapReached && item.id !== PlayerLoadout[slot];
    const locked = weaponBlocked || defenseBlocked || armorBlocked;

    const row = document.createElement('div');
    row.className = 'equip-pick-row' + (PlayerLoadout[slot] === item.id ? ' selected' : '') + (locked ? ' locked' : '');
    const lockNote = weaponBlocked
      ? `🔒 ${char.name} can't use this`
      : defenseBlocked ? `🔒 ${char.name} carries weapons only`
      : armorBlocked ? '🔒 2 armor max' : '';
    row.innerHTML = `<span class="epr-icon">${item.icon}</span><span class="epr-name">${item.name}</span><span class="epr-stat">${lockNote || _slotShortStat(item)}</span>`;
    if (!locked) row.onclick = () => _pickSlotItem(slot, item.id);
    listEl.appendChild(row);
  }
}

function _pickSlotItem(slot, itemId) {
  PlayerLoadout[slot] = itemId;
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
  document.getElementById('difficulty-overlay').classList.remove('hidden');
}
