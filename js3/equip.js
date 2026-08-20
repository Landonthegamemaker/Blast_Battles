/**
 * equip.js — Equip screen: pre-match 8-slot paperdoll loadout selection.
 * Dependencies (must load first): data.js (ALL_EQUIPPABLE), progression.js (isOwned/getCredits)
 * Reads/writes the global `PlayerLoadout` object, consumed by initGame() in game-state.js.
 *
 * Exports (browser globals):
 *   PlayerLoadout        — { head, chest, legs, feet, armL, armR, hand1, hand2 } (item ids or null)
 *   showEquipScreen()    — called from char-select.js on confirm
 *   openSlotPicker(slot) — shows owned items for a slot in the side panel
 *   confirmEquip()       — validates (needs at least 1 hand item) and proceeds to difficulty select
 */
'use strict';

let PlayerLoadout = { head: null, chest: null, legs: null, feet: null, armL: null, armR: null, hand1: null, hand2: null };
let _activeEquipSlot = null;

// Which ALL_EQUIPPABLE `.slot` value each paperdoll slot pulls from.
const EQUIP_SLOT_POOL = {
  head: 'head', chest: 'chest', legs: 'legs', feet: 'feet',
  armL: 'arm', armR: 'arm', hand1: 'hand', hand2: 'hand',
};

function _slotShortStat(item) {
  if (item.type === 'weapon') return `${item.damage} DMG`;
  if (item.healAmount > 0) return `+${item.healAmount} HP`;
  return `${item.defense} DEF`;
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

  const clearRow = document.createElement('div');
  clearRow.className = 'equip-pick-row' + (!PlayerLoadout[slot] ? ' selected' : '');
  clearRow.innerHTML = `<span class="epr-icon">🚫</span><span class="epr-name">Leave empty</span>`;
  clearRow.onclick = () => _pickSlotItem(slot, null);
  listEl.appendChild(clearRow);

  for (const item of owned) {
    const row = document.createElement('div');
    row.className = 'equip-pick-row' + (PlayerLoadout[slot] === item.id ? ' selected' : '');
    row.innerHTML = `<span class="epr-icon">${item.icon}</span><span class="epr-name">${item.name}</span><span class="epr-stat">${_slotShortStat(item)}</span>`;
    row.onclick = () => _pickSlotItem(slot, item.id);
    listEl.appendChild(row);
  }
}

function _pickSlotItem(slot, itemId) {
  PlayerLoadout[slot] = itemId;
  const btn = document.querySelector(`.equip-slot[data-slot="${slot}"]`);
  const item = itemId ? ALL_EQUIPPABLE.find(i => i.id === itemId) : null;
  btn.classList.toggle('filled', !!item);
  btn.querySelector('.equip-slot-icon').textContent = item ? item.icon : '➕';
  openSlotPicker(slot); // re-render so the "selected" row updates
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
