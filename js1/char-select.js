/**
 * Name: char-select.js
 * Description: Character selection screen logic for the game.
 * Handles rendering character grids, sorting, selection, and confirmation.
 * Dependencies (must load first):
 * - character-data.js (CHARACTER_POOL array)
 * - audio.js (BB_Audio for music preview)
 * - equip.js (showEquipScreen() — confirmCharSelect() now routes here, not straight to difficulty)
 * Exports (browser globals):
 * - showCharSelect() - display the character selection screen
 * - selectChar(charId) - select a character by ID
 * - confirmCharSelect() - confirm the current character selection and proceed to the Equip screen
 * Internal state:
 * - _selectedCharId: currently selected character ID (null if none)
 * - _currentSort: current sorting key for character grids ('faction', 'name', 'hp', 'speed', 'ability')
*/
'use strict';

function detectOrientation() {
    const saved = localStorage.getItem('bb-orientation');
    if (saved) return saved;
    return window.innerWidth < window.innerHeight ? 'portrait' : 'landscape';
}

let _currentSort = 'faction';

function getAbilityPct(char) {
    const m = char.attrDesc.match(/([+-]?\d+)%/);
    return m ? parseInt(m[1]) : 0;
}

function sortChars(chars, sortKey) {
    return [...chars].sort((a, b) => {
        switch (sortKey) {
            case 'name': return a.name.localeCompare(b.name);
            case 'hp': return a.hp - b.hp;
            case 'speed': return a.speed - b.speed;
            case 'ability': return getAbilityPct(a) - getAbilityPct(b);
            default: return 0; // faction — handled by separate grids
        }
    });
}

function renderCharGrids(sortKey) {
    const heroGrid = document.getElementById('hero-grid');
    const villainGrid = document.getElementById('villain-grid');
    const body = document.getElementById('char-select-body');
    const divider = document.getElementById('char-divider');
    const heroHdr = document.getElementById('hero-header');
    const villainHdr = document.getElementById('villain-header');
    heroGrid.innerHTML = '';
    villainGrid.innerHTML = '';

    const heroes = CHARACTER_POOL.filter(c => c.faction === 'hero');
    const villains = CHARACTER_POOL.filter(c => c.faction === 'villain');

    const orientation = detectOrientation();
    const isPortrait = orientation === 'portrait';
    const colCount = isPortrait ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';

    if (sortKey === 'faction') {
        body.style.gridTemplateColumns = isPortrait ? '1fr' : '1fr 1px 1fr';
        divider.style.display = isPortrait ? 'none' : '';
        heroHdr.style.display = '';
        villainHdr.style.display = '';
        heroGrid.style.cssText = `display:grid;grid-template-columns:${colCount};gap:6px;`;
        villainGrid.style.cssText = `display:grid;grid-template-columns:${colCount};gap:6px;`;
        sortChars(heroes, 'name').forEach(c => heroGrid.appendChild(makeCharCard(c)));
        sortChars(villains, 'name').forEach(c => villainGrid.appendChild(makeCharCard(c)));
    } else {
        body.style.gridTemplateColumns = '1fr';
        divider.style.display = 'none';
        heroHdr.style.display = 'none';
        villainHdr.style.display = 'none';
        heroGrid.style.cssText = `display:grid;grid-template-columns:${colCount};gap:8px;`;
        villainGrid.style.cssText = 'display:none;';
        const all = sortChars([...heroes, ...villains], sortKey);
        all.forEach(c => heroGrid.appendChild(makeCharCard(c)));
    }

    // Restore selection highlight
    if (_selectedCharId) {
        const el = document.querySelector(`[data-char-id="${_selectedCharId}"]`);
        if (el) applySelectionStyle(el);
    }
}

function makeCharCard(char) {
    const isHero = char.faction === 'hero';
    const glowColor = isHero ? 'var(--hero)' : 'var(--villain)';
    const glowRgb = isHero ? '74,184,255' : '196,75,255';
    const div = document.createElement('div');
    div.dataset.charId = char.id;
    div.style.cssText = 'border-radius:12px;border:1.5px solid ' + glowColor + ';box-shadow:0 0 10px rgba(' + glowRgb + ',0.35);background:rgba(' + glowRgb + ',0.06);padding:0 0 6px 0;cursor:pointer;transition:all 0.15s;user-select:none;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;text-align:center;height:160px;overflow:hidden;position:relative;';
    const isShadow = char.name === 'The Shadow' || char.name.startsWith('Dark ');
    const shadowCardFilter = isShadow ? 'filter:brightness(0.7) saturate(0.4) hue-rotate(200deg);' : '';
    const imgPos = (isShadow ? '50% 20%' : 'top center');
    div.innerHTML = (char.img
        ? `<img src="${char.img}" style="width:100%;height:60px;object-fit:cover;object-position:${imgPos};border-radius:6px 6px 0 0;margin-bottom:3px;display:block;${shadowCardFilter}">`
        : `<div style="width:100%;height:60px;display:flex;align-items:center;justify-content:center;font-size:2rem;background:rgba(${glowRgb},0.15);border-radius:6px 6px 0 0;margin-bottom:3px;">${char.icon}</div>`
    ) +
        `<div style="font-family:'Black Ops One','Impact','Arial Black',sans-serif;font-size:0.62rem;color:${glowColor};margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;padding:0 6px;">${char.icon} ${char.name}</div>
    <div style="font-family:'Share Tech Mono','Courier New',monospace;font-size:0.38rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">${char.faction.toUpperCase()}</div>
    <div style="font-size:0.46rem;color:var(--text);line-height:1.5;margin-bottom:3px;width:100%;padding:0 6px;box-sizing:border-box;">
      <div>❤ <b>${char.attribute === 'shadow_clone' ? '?' : char.hp}</b> HP</div>
      <div>⚡ SPD <b>${char.attribute === 'shadow_clone' ? '?' : char.speed}</b></div>
    </div>
    ${(([ability, weakness]) =>
            `<div style="font-size:0.42rem;color:var(--accent);background:rgba(232,184,75,0.08);border:1px solid rgba(232,184,75,0.2);border-radius:3px;padding:2px 4px;width:calc(100% - 12px);box-sizing:border-box;line-height:1.3;margin:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">⭐ ${ability}</div>`
            + (weakness ? `<div style="font-size:0.40rem;color:var(--accent2);background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.3);border-radius:3px;padding:2px 4px;width:calc(100% - 12px);box-sizing:border-box;line-height:1.3;margin:2px 6px 0;white-space:normal;overflow:hidden;">⚠ ${weakness}</div>` : '')
        )(char.attrDesc.split(' · '))}`;
    div.addEventListener('click', () => selectChar(char.id));
    return div;
}

function applySelectionStyle(el) {
    el.style.borderColor = '#ffffff';
    el.style.boxShadow = '0 0 14px rgba(255,255,255,0.6), 0 0 4px rgba(255,255,255,0.9)';
    el.style.background = 'rgba(255,255,255,0.08)';
}

function sortCharSelect(sortKey) {
    _currentSort = sortKey;
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.toggle('active-sort', btn.dataset.sort === sortKey);
    });
    renderCharGrids(sortKey);
}

function showCharSelect() {
    const orientation = detectOrientation();
    const body = document.getElementById('char-select-body');

    if (orientation === 'portrait') {
        body.style.gridTemplateColumns = '1fr';  // stack heroes/villains vertically
        body.classList.add('portrait-mode');
    } else {
        body.style.gridTemplateColumns = '1fr 1px 1fr';  // side by side (default)
        body.classList.remove('portrait-mode');
    }

    BB_Audio.init();
    BB_Audio.returnToSelect();
    _selectedCharId = null;
    _currentSort = 'faction';
    // Reset sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.toggle('active-sort', btn.dataset.sort === 'faction');
    });
    // Reset villain grid visibility
    const vg = document.getElementById('villain-grid');
    if (vg) { vg.style.display = ''; vg.innerHTML = ''; }
    renderCharGrids('faction');
    document.getElementById('char-select-overlay').style.display = 'flex';
    document.getElementById('char-select-confirm').disabled = true;
    const btn = document.getElementById('char-select-confirm');
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';
    document.getElementById('char-select-preview').innerHTML = '← Select a character to continue';
}

function selectChar(charId) {
    _selectedCharId = charId;
    const char = CHARACTER_POOL.find(c => c.id === charId);

    // Play first 10 seconds of character theme, muting select screen BGM
    BB_Audio.previewCharTheme(charId);

    // Reset all cards, remove any existing overlays
    document.querySelectorAll('#hero-grid [data-char-id], #villain-grid [data-char-id]').forEach(el => {
        const c = CHARACTER_POOL.find(x => x.id === el.dataset.charId);
        const isHero = c.faction === 'hero';
        const glowColor = isHero ? 'var(--hero)' : 'var(--villain)';
        const glowRgb = isHero ? '74,184,255' : '196,75,255';
        el.style.borderColor = glowColor;
        el.style.boxShadow = `0 0 8px rgba(${glowRgb},0.35)`;
        el.style.background = `rgba(${glowRgb},0.06)`;
        const ov = el.querySelector('.card-confirm-overlay');
        if (ov) ov.remove();
    });

    // White glow + translucent CONFIRM overlay on selected card
    const selected = document.querySelector(`[data-char-id="${charId}"]`);
    if (selected) {
        applySelectionStyle(selected);
        const overlay = document.createElement('div');
        overlay.className = 'card-confirm-overlay';
        overlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);border-radius:10px;cursor:pointer;z-index:3;';
        overlay.innerHTML = `<span style="font-family:'Black Ops One','Impact','Arial Black',sans-serif;font-size:0.7rem;color:var(--accent);letter-spacing:2px;text-shadow:0 0 8px rgba(232,184,75,0.8);">✓ CONFIRM</span>`;
        overlay.onclick = confirmCharSelect;
        selected.appendChild(overlay);
    }

    const btn = document.getElementById('char-select-confirm');
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';

    const glowColor = char.faction === 'hero' ? 'var(--hero)' : 'var(--villain)';
    const previewEl = document.getElementById('char-select-preview');
    const isShadowPreview = char.attribute === 'shadow_clone';
    previewEl.innerHTML = `${char.icon} <span style="font-family:'Black Ops One','Impact','Arial Black',sans-serif;color:${glowColor};">${char.name}</span> <span style="color:var(--muted);">· ${char.faction.toUpperCase()} ·</span> ❤ <b>${isShadowPreview ? '?' : char.hp}</b> HP <span style="color:var(--muted);">·</span> ⚡ SPD <b>${isShadowPreview ? '?' : char.speed}</b> <span style="color:var(--border);">|</span> <span style="color:var(--accent);">⭐ ${char.attrDesc.split(' · ')[0]}</span>${char.attrDesc.split(' · ')[1] ? ` <span style="color:var(--accent2);">⚠ ${char.attrDesc.split(' · ')[1]}</span>` : ''}`;
}

function confirmCharSelect() {
    if (!_selectedCharId) return;
    document.getElementById('char-select-overlay').style.display = 'none';
    showEquipScreen();
}

// Boot — show character select screen
window.addEventListener('load', () => { showCharSelect(); });