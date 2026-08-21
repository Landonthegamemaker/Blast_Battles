/**
 * Name: char-select.js
 * Description: Character selection screen logic for the game.
 * Handles rendering character grids, sorting, selection, confirmation, and
 * the Bestiary/Challenge flow for unlocking locked characters.
 * Dependencies (must load first):
 * - character-data.js (CHARACTER_POOL array, STARTER_UNLOCKED_IDS)
 * - audio.js (BB_Audio for music preview)
 * - progression.js (isCharUnlocked, getDefeatProgress — locked-character gating)
 * - equip.js (showEquipScreen() — confirmCharSelect() and startChallenge() both route here)
 * Exports (browser globals):
 * - showCharSelect() - display the character selection screen
 * - selectChar(charId) - select a character by ID (unlocked characters only)
 * - confirmCharSelect() - confirm the current character selection and proceed to the Equip screen
 * - openBestiary(charId) / closeBestiary() - locked character detail + per-difficulty progress
 * - startChallenge(charId, difficulty) - deliberately target a specific locked character +
 *   difficulty instead of waiting on random matchmaking; skips the manual Difficulty screen
 * - showTutorial() / closeTutorial() / maybeShowTutorial() - first-time welcome tutorial,
 *   auto-shown once on a brand-new account (see TUTORIAL_SEEN_KEY), re-triggerable from Help
 * Internal state:
 * - _selectedCharId: currently selected character ID (null if none)
 * - _currentSort: current sorting key for character grids ('faction', 'name', 'hp', 'speed', 'ability')
 * - _challengeTargetCharId / _challengeDifficulty: pending Bestiary Challenge, consumed by initGame()
*/
'use strict';

// ── First-time tutorial ──────────────────────────────────────────────────
const TUTORIAL_SEEN_KEY = 'bb-tutorial-seen';

/** Shows the welcome tutorial unconditionally — used by the "show again" link in Help. */
function showTutorial() {
    document.getElementById('tutorial-overlay').classList.remove('hidden');
}

function closeTutorial() {
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    document.getElementById('tutorial-overlay').classList.add('hidden');
}

/** Shows the tutorial once, automatically, the first time a new player ever loads the game. */
function maybeShowTutorial() {
    if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) showTutorial();
}

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
    const unlocked = (typeof isCharUnlocked === 'function') ? isCharUnlocked(char.id) : true;
    const div = document.createElement('div');
    div.dataset.charId = char.id;
    const lockedFilter = unlocked ? '' : 'filter:grayscale(0.85) brightness(0.55);';
    div.style.cssText = 'border-radius:12px;border:1.5px solid ' + glowColor + ';box-shadow:0 0 10px rgba(' + glowRgb + ',0.35);background:rgba(' + glowRgb + ',0.06);padding:0 0 6px 0;cursor:' + (unlocked ? 'pointer' : 'default') + ';transition:all 0.15s;user-select:none;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;text-align:center;height:160px;overflow:hidden;position:relative;' + lockedFilter;
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
    if (unlocked) {
        div.addEventListener('click', () => selectChar(char.id));
    } else {
        const progress = (typeof getDefeatProgress === 'function') ? getDefeatProgress(char.id) : {};
        const beatenCount = ['easy', 'medium', 'hard', 'impossible'].filter(d => progress[d]).length;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);border-radius:10px;z-index:3;gap:4px;';
        overlay.innerHTML = `<span style="font-size:1.3rem;">🔒</span><span style="font-family:'Share Tech Mono',monospace;font-size:0.42rem;color:var(--text);">Win vs. all 4 difficulties</span><span style="font-family:'Share Tech Mono',monospace;font-size:0.5rem;color:var(--accent);">${beatenCount}/4 beaten</span>`;
        div.appendChild(overlay);
        div.addEventListener('click', () => openBestiary(char.id));
    }
    return div;
}

// ── Bestiary / Challenge flow ────────────────────────────────────────────────
// Lets the player deliberately target a specific locked character + difficulty
// instead of waiting on random matchmaking to hand them the exact pairing they
// still need. Consumed once by initGame() (see game-state.js), then cleared.
let _challengeTargetCharId = null;
let _challengeDifficulty = null;

const DIFFICULTY_LABELS = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard', impossible: '🤖 Impossible' };

function openBestiary(charId) {
    const char = CHARACTER_POOL.find(c => c.id === charId);
    if (!char) return;
    const progress = (typeof getDefeatProgress === 'function') ? getDefeatProgress(charId) : {};
    const glowColor = char.faction === 'hero' ? 'var(--hero)' : 'var(--villain)';

    const playerChar = _selectedCharId ? CHARACTER_POOL.find(c => c.id === _selectedCharId) : null;
    const oppositeFactionPicked = playerChar && playerChar.faction !== char.faction;

    let rows = '';
    for (const diff of ['easy', 'medium', 'hard', 'impossible']) {
        const beaten = !!progress[diff];
        if (beaten) {
            rows += `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border:1px solid var(--border);border-radius:6px;margin-bottom:5px;background:rgba(68,255,136,0.06);">
        <span style="font-size:0.7rem;">${DIFFICULTY_LABELS[diff]}</span>
        <span style="font-size:0.7rem;color:var(--green);">✓ BEATEN</span>
      </div>`;
        } else {
            const enabled = !!oppositeFactionPicked;
            rows += `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border:1px solid var(--border);border-radius:6px;margin-bottom:5px;">
        <span style="font-size:0.7rem;">${DIFFICULTY_LABELS[diff]}</span>
        <button class="btn primary" style="font-size:0.6rem;padding:4px 10px;${enabled ? '' : 'opacity:0.4;pointer-events:none;'}" onclick="startChallenge('${charId}','${diff}')">🎯 CHALLENGE</button>
      </div>`;
        }
    }

    const hint = oppositeFactionPicked
        ? ''
        : `<div style="font-size:0.62rem;color:var(--accent2);margin-bottom:8px;">⚠ Pick your own ${char.faction === 'hero' ? 'villain' : 'hero'} character first (on the main screen), then come back to challenge.</div>`;

    document.getElementById('bestiary-body').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px;">
      <span style="font-size:1.4rem;">${char.icon}</span>
      <h2 style="font-family:'Black Ops One','Impact','Arial Black',sans-serif;font-size:1.1rem;color:${glowColor};margin:0;">${char.name}</h2>
    </div>
    <div style="font-family:'Share Tech Mono',monospace;font-size:0.5rem;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">${char.faction.toUpperCase()} · LOCKED</div>
    <div style="font-size:0.68rem;color:var(--muted);margin-bottom:10px;">Win against ${char.name} on every difficulty to unlock them.</div>
    ${hint}
    ${rows}
  `;
    document.getElementById('bestiary-overlay').classList.remove('hidden');
}

function closeBestiary() {
    document.getElementById('bestiary-overlay').classList.add('hidden');
}

/** Sets up a deliberate challenge match against a specific locked character at a
 *  specific difficulty, then proceeds through the normal Equip flow — the
 *  difficulty is already decided, so the Difficulty screen is skipped. */
function startChallenge(charId, difficulty) {
    if (!_selectedCharId) return; // shouldn't happen — button is disabled until a character is picked
    _challengeTargetCharId = charId;
    _challengeDifficulty = difficulty;
    closeBestiary();
    document.getElementById('char-select-overlay').style.display = 'none';
    showEquipScreen();
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
    const creditsEl = document.getElementById('charselect-credits');
    if (creditsEl && typeof getCredits === 'function') creditsEl.textContent = `💰 ${getCredits()}`;
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
    maybeShowTutorial();
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
    if (typeof isCharUnlocked === 'function' && !isCharUnlocked(_selectedCharId)) return;
    document.getElementById('char-select-overlay').style.display = 'none';
    showEquipScreen();
}

// Boot — show character select screen
window.addEventListener('load', () => { showCharSelect(); });