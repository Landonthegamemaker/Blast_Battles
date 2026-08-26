/**
 * shop.js — Shop screen: spend credits earned from matches (via Battle Score) to unlock
 * new gear/weapons, or sell owned copies back for 50% of their price.
 * Dependencies (must load first): data.js (ALL_EQUIPPABLE),
 *   progression.js (getCredits/getOwnedQuantity/buyItem/sellItem)
 * Layers on top of whichever screen opened it (usually the Equip screen) — closing it
 * just hides the shop overlay and refreshes the screen underneath.
 *
 * Ownership is quantity-based — BUY is always available (even once owned), since
 * owning multiple copies of the same item is what lets a character dual-wield two
 * of the same weapon. SELL appears once you own at least one.
 *
 * Exports (browser globals):
 *   openShop()   — show the shop, filtered to "All" items
 *   closeShop()  — hide the shop, refresh the equip/char-select screen behind it
 */
'use strict';

let _shopFilterSlot = 'all';
const SHOP_SLOTS = ['all', 'hand', 'head', 'chest', 'legs', 'feet', 'arm'];
const SHOP_SLOT_LABELS = { all: 'All', hand: 'Hand', head: 'Head', chest: 'Chest', legs: 'Legs', feet: 'Feet', arm: 'Arm' };

function openShop() {
  _shopFilterSlot = 'all';
  _setShopMsg('');
  const banner = document.getElementById('shop-target-banner');
  const shoppingFor = _currentShopChar();
  if (shoppingFor && typeof _shopTargetCharId !== 'undefined' && _shopTargetCharId) {
    const subs = (typeof getAllowedPurchaseSubtypes === 'function' ? getAllowedPurchaseSubtypes(shoppingFor.id) : []);
    banner.style.display = '';
    banner.innerHTML = `🎯 Shopping for <b>${shoppingFor.name}</b> (locked) — ${subs.length ? subs.map(s => s.replace('_', ' ')).join('/') : 'any'} weapons, plus their own gear`;
  } else {
    banner.style.display = 'none';
  }
  _renderShopTabs();
  _renderShopGrid();
  document.getElementById('shop-overlay').classList.remove('hidden');
}

function closeShop() {
  document.getElementById('shop-overlay').classList.add('hidden');
  if (typeof _shopTargetCharId !== 'undefined') _shopTargetCharId = null; // one-time override, don't linger
  const equipOverlay = document.getElementById('equip-overlay');
  const charSelectOverlay = document.getElementById('char-select-overlay');
  if (equipOverlay && !equipOverlay.classList.contains('hidden')) {
    document.getElementById('equip-credits').textContent = `💰 ${getCredits()}`;
    if (typeof _activeEquipSlot !== 'undefined' && _activeEquipSlot) openSlotPicker(_activeEquipSlot);
  }
  if (charSelectOverlay && charSelectOverlay.style.display !== 'none') {
    const el = document.getElementById('charselect-credits');
    if (el) el.textContent = `💰 ${getCredits()}`;
    if (typeof renderCharGrids === 'function' && typeof _currentSort !== 'undefined') renderCharGrids(_currentSort);
  }
}

function _setShopMsg(text) {
  const el = document.getElementById('shop-msg');
  if (el) el.textContent = text;
}

function _renderShopTabs() {
  const el = document.getElementById('shop-tabs');
  el.innerHTML = '';
  for (const s of SHOP_SLOTS) {
    const btn = document.createElement('button');
    btn.className = 'shop-tab' + (s === _shopFilterSlot ? ' active-tab' : '');
    btn.textContent = SHOP_SLOT_LABELS[s];
    btn.onclick = () => { _shopFilterSlot = s; _renderShopTabs(); _renderShopGrid(); };
    el.appendChild(btn);
  }
}

function _shopItemStat(item) {
  if (item.type === 'weapon') return `${item.damage} DMG · ${item.subtype.replace('_', ' ')}`;
  if (item.healAmount > 0) return `+${item.healAmount} HP`;
  return `${item.defense} DEF · ${item.durability}×`;
}

/**
 * Wipes credits/ownership/loadouts/unlock progress back to defaults, after a
 * confirmation prompt — wired to the "RESET ALL PROGRESS" testing button.
 */
function confirmResetProgression() {
  if (typeof resetProgression !== 'function') return;
  const ok = confirm('Reset ALL progress? This wipes credits, owned items, character loadouts, and unlock progress back to defaults. This cannot be undone.');
  if (!ok) return;
  resetProgression();
  _setShopMsg('✓ Progress reset.');
  _renderShopGrid();
  // The dialogue's "seen" flag was just cleared by resetProgression() — close the
  // shop and show it right away, cleanly, instead of stacking it on top of an
  // open modal and waiting for the next char-select visit.
  if (typeof maybeShowTutorial === 'function' && localStorage.getItem('bb-tutorial-seen') === null) {
    document.getElementById('shop-overlay').classList.add('hidden');
    document.getElementById('equip-overlay').classList.add('hidden');
    if (typeof _shopTargetCharId !== 'undefined') _shopTargetCharId = null;
    maybeShowTutorial();
    return;
  }
  // Refresh whichever screen is behind the shop so it reflects the reset immediately.
  const equipOverlay = document.getElementById('equip-overlay');
  const charSelectOverlay = document.getElementById('char-select-overlay');
  if (equipOverlay && !equipOverlay.classList.contains('hidden') && typeof showEquipScreen === 'function') {
    showEquipScreen();
  } else if (charSelectOverlay && charSelectOverlay.style.display !== 'none' && typeof renderCharGrids === 'function') {
    renderCharGrids(_currentSort);
    const el = document.getElementById('charselect-credits');
    if (el) el.textContent = `💰 ${getCredits()}`;
  }
}
function _currentShopChar() {
  const shoppingForId = (typeof _shopTargetCharId !== 'undefined' && _shopTargetCharId)
    || (typeof _selectedCharId !== 'undefined' && _selectedCharId);
  return (shoppingForId && typeof CHARACTER_POOL !== 'undefined')
    ? CHARACTER_POOL.find(c => c.id === shoppingForId)
    : null;
}

function _renderShopGrid() {
  document.getElementById('shop-credits').textContent = `💰 ${getCredits()}`;
  const shoppingFor = _currentShopChar();
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';
  const items = ALL_EQUIPPABLE
    .filter(i => _shopFilterSlot === 'all' || i.slot === _shopFilterSlot)
    .sort((a, b) => a.price - b.price);

  for (const item of items) {
    const qty = getOwnedQuantity(item.id);
    const owned = qty > 0;
    const sellValue = Math.floor(item.price * 0.5);
    const isUniversal = typeof isUniversalItem === 'function' && isUniversalItem(item.id);
    let locked = false, lockLabel = '';
    if (!isUniversal && shoppingFor) {
      if (item.type === 'weapon') {
        const allowed = (typeof getAllowedPurchaseSubtypes === 'function') ? getAllowedPurchaseSubtypes(shoppingFor.id) : [];
        if (allowed.length && !allowed.includes(item.subtype)) {
          locked = true;
          lockLabel = `🔒 ${shoppingFor.name} buys ${allowed.map(s => s.replace('_', ' ')).join('/')} only`;
        }
      } else {
        const owners = (typeof getGearItemOwners === 'function') ? getGearItemOwners(item.id) : null;
        if (owners && !owners.includes(shoppingFor.id)) {
          locked = true;
          lockLabel = `🔒 Not ${shoppingFor.name}'s gear`;
        }
      }
    }
    const card = document.createElement('div');
    card.className = 'shop-card' + (owned ? ' owned' : '') + (locked ? ' locked-item' : '');
    card.innerHTML = `
      <div class="sc-icon">${item.icon}</div>
      <div class="sc-name">${item.name}${owned ? ` <span style="color:var(--muted);">×${qty}</span>` : ''}</div>
      <div class="sc-stat">${lockLabel || _shopItemStat(item)}</div>
      <div class="sc-stat" style="color:var(--accent);">💰 ${item.price}${owned ? ` · sell 💰${sellValue}` : ''}</div>
    `;
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:3px;width:100%;';

    // BUY — always available (owning multiple copies is how dual-wielding the
    // same weapon works), just disabled when unaffordable OR still M9-gated.
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn primary';
    buyBtn.textContent = owned ? '+ BUY' : 'BUY';
    const canAfford = getCredits() >= item.price;
    buyBtn.disabled = !canAfford || locked;
    if (!canAfford || locked) buyBtn.style.opacity = '0.5';
    buyBtn.onclick = () => {
      const res = buyItem(item.id);
      if (res.ok) { _setShopMsg(`✓ Bought ${item.name}.`); _renderShopGrid(); }
      else { _setShopMsg(`✗ ${res.reason}`); }
    };
    btnRow.appendChild(buyBtn);

    // SELL — only shown once you own at least one.
    if (owned) {
      const sellBtn = document.createElement('button');
      sellBtn.className = 'btn';
      sellBtn.textContent = `SELL`;
      sellBtn.onclick = () => {
        const res = sellItem(item.id);
        if (res.ok) { _setShopMsg(`✓ Sold ${item.name} for 💰${res.refund}.`); _renderShopGrid(); }
        else { _setShopMsg(`✗ ${res.reason}`); }
      };
      btnRow.appendChild(sellBtn);
    }

    card.appendChild(btnRow);
    grid.appendChild(card);
  }
}
