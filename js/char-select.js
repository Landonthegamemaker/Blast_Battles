/**
 * Name: char-select.js
 * Description: Character selection screen logic for the game.
 * Handles rendering character grids, sorting, selection, confirmation, the
 * (view-only) Bestiary, and the post-Equip Opponent Select screen.
 * Dependencies (must load first):
 * - character-data.js (CHARACTER_POOL array, STARTER_UNLOCKED_IDS)
 * - audio.js (BB_Audio for music preview)
 * - progression.js (isCharUnlocked, getDefeatProgress — locked-character gating)
 * - equip.js (showEquipScreen() — confirmCharSelect() and backToEquipFromOpponentSelect() both route here)
 * Exports (browser globals):
 * - showCharSelect() - display the character selection screen
 * - selectChar(charId) - select a character by ID (unlocked characters only)
 * - confirmCharSelect() - confirm the current character selection and proceed to the Equip screen
 * - openBestiary(charId) / closeBestiary() - view-only locked character detail + per-difficulty progress
 * - showOpponentSelect() - reached from Equip's "⚔ BEGIN BATTLE" button; shows every character of
 *   the opposing faction (locked or unlocked) as a selectable opponent — matchmaking is never random
 * - selectOpponent(charId) - picks the opponent, proceeds to the Difficulty screen
 * - selectRandomOpponent() - skips picking a specific opponent, restoring the original
 *   random-opposite-faction-pick behavior (same logic initGame() always falls back to)
 * - backToEquipFromOpponentSelect() - returns to Equip without losing anything
 * - showTutorial() / closeTutorial() / maybeShowTutorial() - first-time welcome tutorial,
 *   auto-shown once on a brand-new account (see TUTORIAL_SEEN_KEY), re-triggerable from Help
 * Internal state:
 * - _selectedCharId: currently selected character ID (null if none)
 * - _currentSort: current sorting key for character grids ('faction', 'name', 'hp', 'speed', 'ability')
 * - _challengeTargetCharId: the opponent picked in Opponent Select, consumed once by initGame()
*/
'use strict';

// ── First-time tutorial: Sterling Cross dialogue → scripted Pete vs Clint match ──
const TUTORIAL_SEEN_KEY = 'bb-tutorial-seen'; // dialogue has been shown at least once
const TUTORIAL_MATCH_DONE_KEY = 'bb-tutorial-match-done'; // guaranteed reward/pre-flag only fires once

const STERLING_CROSS_DIALOGUE = [
    'Welcome to Shadow Squadron, Pete!',
    "We looked through your record and were very impressed with your shooting abilities on and off the court — your feats with akimbo pistols are legendary!",
    'That\u2019s why I had my men supply you with state-of-the-art \u201cPulse Phasers.\u201d They shoot lasers instead of standard ballistic rounds, so they travel at the speed of light. Kinda hard to dodge something moving that fast.',
    'Because they\u2019re experimental, they aren\u2019t perfect. They tend to overheat quickly, like a glue gun — you need to watch how fast you burn through them. Fortunately, my guys have designed charging stations to help you stay afloat.',
    'It\u2019s time to give those things a test run. I just got word from Agent Ace \u2014 Cowboy Clint has him pinned down. He needs backup, and you\u2019re all we\u2019ve got since the other agents went dark. It\u2019s game time!',
];
let _tutorialDialogueIdx = 0;
let _tutorialMatchPending = false; // one-shot, consumed by initGame() — see game-state.js

/** Shows the Sterling Cross dialogue from the start — used both for the automatic
 *  first-time trigger and the "show again" link in Help. */
function showTutorial() {
    _tutorialDialogueIdx = 0;
    _renderTutorialLine();
    document.getElementById('tutorial-overlay').classList.remove('hidden');
}

function _renderTutorialLine() {
    const isLast = _tutorialDialogueIdx === STERLING_CROSS_DIALOGUE.length - 1;
    document.getElementById('tutorial-dialogue-text').textContent = STERLING_CROSS_DIALOGUE[_tutorialDialogueIdx];
    document.getElementById('tutorial-next-btn').textContent = isLast ? '\u2694 BEGIN MISSION' : 'NEXT';
}

/** Advances to the next dialogue line. On the last line: launches the scripted
 *  tutorial match the FIRST time only — if the player already completed it
 *  (TUTORIAL_MATCH_DONE_KEY set), this is just a narrative replay from Help's
 *  "show tutorial again" link, so it shouldn't re-grant free gear, overwrite
 *  Pete's current loadout, or force another match on a returning player.
 *
 *  TUTORIAL_SEEN_KEY is only set here, at the point the match actually
 *  launches — NOT on every intermediate line. Since Pete is the only static
 *  starter now (Clint unlocks through this tutorial), marking it seen too
 *  early — e.g. if a player closes the tab after the first dialogue line —
 *  would mean the tutorial never re-triggers next visit, but the match that
 *  actually unlocks a villain never ran either: a permanent soft-lock with
 *  no path to ever play as anyone but Pete. */
function advanceTutorialDialogue() {
    const isLast = _tutorialDialogueIdx === STERLING_CROSS_DIALOGUE.length - 1;
    if (isLast) {
        localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
        document.getElementById('tutorial-overlay').classList.add('hidden');
        if (!localStorage.getItem(TUTORIAL_MATCH_DONE_KEY)) launchCombatTutorial();
        return;
    }
    _tutorialDialogueIdx++;
    _renderTutorialLine();
}

/** Closes the dialogue without launching the match. Deliberately does NOT mark
 *  TUTORIAL_SEEN_KEY — see the note on advanceTutorialDialogue() for why: doing
 *  so here would risk the same soft-lock (dialogue never shown again, but the
 *  match that actually unlocks a villain never ran). Not currently wired to
 *  any UI element — kept for future use (e.g. an outside-click dismiss). */
function closeTutorial() {
    document.getElementById('tutorial-overlay').classList.add('hidden');
}

/** Shows the tutorial once, automatically, the first time a new player ever loads the game. */
function maybeShowTutorial() {
    if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) showTutorial();
}

/**
 * Sets up and launches the scripted Pete-vs-Clint tutorial match: grants 2 free
 * Pulse Phasers (mission-issued, bypasses the shop entirely), force-equips them
 * on Pete, and jumps straight into an Easy match against Cowboy Clint — skipping
 * Equip/Opponent Select/Difficulty since all of that is already decided.
 */
function launchCombatTutorial() {
    if (typeof grantFreeItem === 'function') {
        grantFreeItem('w31', 2); // 2x Pulse Phaser
        grantFreeItem('g9', 2);  // 2x Sneakers (feetL + feetR need a matching pair)
        grantFreeItem('g28', 1); // Basketball Jersey
        grantFreeItem('g29', 1); // Netted Shorts
        grantFreeItem('g30', 2); // 2x Wristbands (wristL + wristR)
    }
    _selectedCharId = 'c1'; // Pistol Pete
    if (typeof PlayerLoadout !== 'undefined') {
        PlayerLoadout.hand1 = 'w31';
        PlayerLoadout.hand2 = 'w31';
        // Pete's full 5-piece kit — feet (1 unit, matched pair) + chest + legs +
        // both wrists (2 independent units) = exactly 5, fitting the armor cap
        // exactly now that it's been raised from 2 to 5 for this purpose.
        PlayerLoadout.feetL = 'g9';
        PlayerLoadout.feetR = 'g9';
        PlayerLoadout.chest = 'g28';
        PlayerLoadout.legs = 'g29';
        PlayerLoadout.wristL = 'g30';
        PlayerLoadout.wristR = 'g30';
        if (typeof _saveCurrentLoadout === 'function') _saveCurrentLoadout();
    }
    _challengeTargetCharId = 'c9'; // Cowboy Clint — forced as the bot opponent
    _tutorialMatchPending = true; // consumed by initGame() into G.isTutorialMatch, then cleared
    document.getElementById('char-select-overlay').style.display = 'none';
    if (typeof startWithDifficulty === 'function') startWithDifficulty('easy');
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
    const prog = (typeof getUnlockProgressCount === 'function') ? getUnlockProgressCount(char.id) : { current: 0, total: 1 };
    const beatenCount = prog.current;
    const progressTotal = prog.total || 1;
    const progressPct = unlocked ? 100 : (beatenCount / progressTotal) * 100;
    const div = document.createElement('div');
    div.dataset.charId = char.id;
    div.style.cssText = 'border-radius:12px;border:1.5px solid ' + glowColor + ';box-shadow:0 0 10px rgba(' + glowRgb + ',0.35);background:rgba(' + glowRgb + ',0.06);padding:0 0 6px 0;cursor:' + (unlocked ? 'pointer' : 'default') + ';transition:all 0.15s;user-select:none;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;text-align:center;height:160px;overflow:hidden;position:relative;';
    const isShadow = char.name === 'The Shadow' || char.name.startsWith('Dark ');
    const shadowCardFilter = isShadow ? 'filter:brightness(0.7) saturate(0.4) hue-rotate(200deg);' : '';
    const imgPos = (isShadow ? '50% 20%' : 'top center');

    // Locked characters: the portrait fills in with color from LEFT to RIGHT as
    // unlock progress (beaten difficulties / 4) increases, instead of a flat
    // grayscale treatment — a grayscale base layer with a full-color copy on top,
    // clipped to show only the leftmost progressPct% of the image.
    let imageBlock;
    if (char.img) {
        if (unlocked) {
            imageBlock = `<img src="${char.img}" style="width:100%;height:60px;object-fit:cover;object-position:${imgPos};border-radius:6px 6px 0 0;margin-bottom:3px;display:block;${shadowCardFilter}">`;
        } else {
            imageBlock = `<div style="position:relative;width:100%;height:60px;border-radius:6px 6px 0 0;margin-bottom:3px;overflow:hidden;">
        <img src="${char.img}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${imgPos};filter:grayscale(1) brightness(0.4);${shadowCardFilter}">
        <img src="${char.img}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${imgPos};clip-path:inset(0 ${100 - progressPct}% 0 0);transition:clip-path 0.3s;${shadowCardFilter}">
      </div>`;
        }
    } else {
        imageBlock = unlocked
            ? `<div style="width:100%;height:60px;display:flex;align-items:center;justify-content:center;font-size:2rem;background:rgba(${glowRgb},0.15);border-radius:6px 6px 0 0;margin-bottom:3px;">${char.icon}</div>`
            : `<div style="position:relative;width:100%;height:60px;border-radius:6px 6px 0 0;margin-bottom:3px;overflow:hidden;background:rgba(120,120,120,0.15);">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2rem;filter:grayscale(1) brightness(0.5);">${char.icon}</div>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2rem;background:rgba(${glowRgb},0.15);clip-path:inset(0 ${100 - progressPct}% 0 0);transition:clip-path 0.3s;">${char.icon}</div>
      </div>`;
    }

    div.innerHTML = imageBlock +
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
        // Small badge instead of a full dark overlay — the portrait's color-fill
        // is now the primary progress signal, this is just a clear numeric readout.
        const badge = document.createElement('div');
        badge.style.cssText = 'position:absolute;top:4px;right:4px;display:flex;align-items:center;gap:2px;background:rgba(0,0,0,0.65);border-radius:5px;padding:2px 6px;font-family:\'Share Tech Mono\',monospace;font-size:0.5rem;color:var(--accent);z-index:3;';
        badge.innerHTML = `🔒 ${beatenCount}/${progressTotal}`;
        div.appendChild(badge);
        div.addEventListener('click', () => openBestiary(char.id));
    }
    return div;
}

// ── Bestiary (view-only) ─────────────────────────────────────────────────────
// Shows a locked character's per-difficulty progress plus their full unlock
// requirement (weapon groups, specific gear items, healing if applicable).
// Purely informational — the Shop is universal now, so there's no special
// "shop for this locked character" flow needed to buy toward their unlock.
const DIFFICULTY_LABELS = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard', impossible: '🤖 Impossible' };

function openBestiary(charId) {
    const char = CHARACTER_POOL.find(c => c.id === charId);
    if (!char) return;
    const progress = (typeof getDefeatProgress === 'function') ? getDefeatProgress(charId) : {};
    const glowColor = char.faction === 'hero' ? 'var(--hero)' : 'var(--villain)';
    const req = (typeof getUnlockRequirement === 'function') ? getUnlockRequirement(charId) : { difficulties: ['easy', 'medium', 'hard', 'impossible'], weaponGroups: [], gearItems: [], requiresAnyHealing: false };

    // Only show rows for the difficulties this character's unlock actually requires
    // — most need all 4, but some (e.g. Cowboy Clint) only need Easy.
    let rows = '';
    for (const diff of ['easy', 'medium', 'hard', 'impossible']) {
        if (!req.difficulties.includes(diff)) continue;
        const beaten = !!progress[diff];
        rows += `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border:1px solid var(--border);border-radius:6px;margin-bottom:5px;${beaten ? 'background:rgba(68,255,136,0.06);' : ''}">
      <span style="font-size:0.7rem;">${DIFFICULTY_LABELS[diff]}</span>
      <span style="font-size:0.7rem;color:${beaten ? 'var(--green)' : 'var(--muted)'};">${beaten ? '✓ BEATEN' : 'Not yet'}</span>
    </div>`;
    }

    // Weapon groups — each group is satisfied by owning ANY ONE subtype within it
    // (an OR-group), but every group listed must be satisfied (AND between groups).
    const weaponRows = req.weaponGroups.map(group => {
        const owns = group.some(sub => _ownsAnyOfSubtype(sub));
        const label = group.map(s => s.replace('_', ' ')).join(' or ');
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border:1px solid var(--border);border-radius:5px;margin-bottom:3px;background:${owns ? 'rgba(68,255,136,0.06)' : 'transparent'};">
      <span style="font-size:0.62rem;text-transform:capitalize;">${label}</span>
      <span style="font-size:0.62rem;color:${owns ? 'var(--green)' : 'var(--muted)'};">${owns ? '✓' : '—'}</span>
    </div>`;
    }).join('');

    // Specific gear items — every one listed must be individually owned.
    const gearRows = req.gearItems.map(itemId => {
        const item = ALL_EQUIPPABLE.find(i => i.id === itemId);
        if (!item) return '';
        const neededQty = req.gearQuantities[itemId] || 1;
        const ownedQty = typeof getOwnedQuantity === 'function' ? getOwnedQuantity(itemId) : 0;
        const owns = ownedQty >= neededQty;
        const qtyLabel = neededQty > 1 ? ` ×${neededQty}` : '';
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border:1px solid var(--border);border-radius:5px;margin-bottom:3px;background:${owns ? 'rgba(68,255,136,0.06)' : 'transparent'};">
      <span style="font-size:0.62rem;">${item.icon} ${item.name}${qtyLabel}</span>
      <span style="font-size:0.62rem;color:${owns ? 'var(--green)' : 'var(--muted)'};">${owns ? '✓' : `${ownedQty}/${neededQty}`}</span>
    </div>`;
    }).join('');

    const healingRow = req.requiresAnyHealing ? (() => {
        const owns = typeof _ownsAnyHealingItem === 'function' ? _ownsAnyHealingItem() : false;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border:1px solid var(--border);border-radius:5px;margin-bottom:3px;background:${owns ? 'rgba(68,255,136,0.06)' : 'transparent'};">
      <span style="font-size:0.62rem;">💊 Any healing item</span>
      <span style="font-size:0.62rem;color:${owns ? 'var(--green)' : 'var(--muted)'};">${owns ? '✓' : '—'}</span>
    </div>`;
    })() : '';

    const allSatisfied = req.weaponGroups.every(g => g.some(sub => _ownsAnyOfSubtype(sub)))
        && req.gearItems.every(id => _ownsItemQty(id, req.gearQuantities[id] || 1))
        && (!req.requiresAnyHealing || _ownsAnyHealingItem());
    const unlockProg = (typeof getUnlockProgressCount === 'function') ? getUnlockProgressCount(charId) : { current: 0, total: 0 };
    const diffLabel = req.difficulties.length === 4 ? 'every difficulty' : req.difficulties.map(d => d[0].toUpperCase() + d.slice(1)).join('/');
    const gearSection = `
    <div style="font-size:0.68rem;color:var(--muted);margin-bottom:6px;">Unlocks by winning against ${char.name} on ${diffLabel}, plus the gear/weapons below.</div>
    ${weaponRows}
    ${gearRows}
    ${healingRow}
    ${!allSatisfied ? `<button class="btn primary" style="width:100%;margin:8px 0 10px;font-size:0.65rem;" onclick="closeBestiary();openShop();">🛒 Shop</button>` : ''}
  `;

    document.getElementById('bestiary-body').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px;">
      <span style="font-size:1.4rem;">${char.icon}</span>
      <h2 style="font-family:'Black Ops One','Impact','Arial Black',sans-serif;font-size:1.1rem;color:${glowColor};margin:0;">${char.name}</h2>
    </div>
    <div style="font-family:'Share Tech Mono',monospace;font-size:0.5rem;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">${char.faction.toUpperCase()} · LOCKED</div>
    <div style="font-family:'Share Tech Mono',monospace;font-size:0.85rem;color:${allSatisfied ? 'var(--green)' : 'var(--accent)'};margin-bottom:8px;">${unlockProg.current}/${unlockProg.total}</div>
    ${gearSection}
    ${rows}
  `;
    document.getElementById('bestiary-overlay').classList.remove('hidden');
}

/** Opens the Shop pre-authorized to buy the given LOCKED character's designated
 *  subtype, since they can't be _selectedCharId (not unlocked) to unlock it normally. */
function closeBestiary() {
    document.getElementById('bestiary-overlay').classList.add('hidden');
    const charSelectOverlay = document.getElementById('char-select-overlay');
    if (charSelectOverlay && charSelectOverlay.style.display !== 'none' && typeof renderCharGrids === 'function') {
        renderCharGrids(_currentSort);
    }
}

// ── Opponent Select ───────────────────────────────────────────────────────────
// Reached after Equip via the "⚔ BEGIN BATTLE" button. Always shows every
// character of the opposing faction — locked or unlocked — since locked ones
// can still be fought (that's how they get unlocked). Picking one leads to the
// Difficulty screen; matchmaking is never random.
let _challengeTargetCharId = null;

function showOpponentSelect() {
    const playerChar = CHARACTER_POOL.find(c => c.id === _selectedCharId);
    if (!playerChar) return;
    const oppFaction = playerChar.faction === 'hero' ? 'villain' : 'hero';
    const opponents = CHARACTER_POOL.filter(c => c.faction === oppFaction);

    const grid = document.getElementById('opponent-select-grid');
    grid.innerHTML = '';
    for (const opp of opponents) grid.appendChild(makeOpponentCard(opp));

    document.getElementById('opponent-select-overlay').classList.remove('hidden');
}

function makeOpponentCard(char) {
    const glowColor = char.faction === 'hero' ? 'var(--hero)' : 'var(--villain)';
    const glowRgb = char.faction === 'hero' ? '74,184,255' : '196,75,255';
    const unlocked = (typeof isCharUnlocked === 'function') ? isCharUnlocked(char.id) : true;
    const div = document.createElement('div');
    div.style.cssText = 'border-radius:12px;border:1.5px solid ' + glowColor + ';box-shadow:0 0 10px rgba(' + glowRgb + ',0.35);background:rgba(' + glowRgb + ',0.06);padding:0 0 6px 0;cursor:pointer;transition:all 0.15s;user-select:none;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;text-align:center;height:150px;overflow:hidden;position:relative;';
    const imgHtml = char.img
        ? `<img src="${char.img}" style="width:100%;height:60px;object-fit:cover;object-position:top center;border-radius:6px 6px 0 0;margin-bottom:3px;display:block;">`
        : `<div style="width:100%;height:60px;display:flex;align-items:center;justify-content:center;font-size:2rem;background:rgba(${glowRgb},0.15);border-radius:6px 6px 0 0;margin-bottom:3px;">${char.icon}</div>`;
    div.innerHTML = `${imgHtml}
    <div style="font-family:'Black Ops One','Impact','Arial Black',sans-serif;font-size:0.62rem;color:${glowColor};margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;padding:0 6px;">${char.icon} ${char.name}</div>
    <div style="font-size:0.46rem;color:var(--text);line-height:1.5;">
      <div>❤ <b>${char.attribute === 'shadow_clone' ? '?' : char.hp}</b> HP</div>
      <div>⚡ SPD <b>${char.attribute === 'shadow_clone' ? '?' : char.speed}</b></div>
    </div>
  `;
    if (!unlocked) {
        const prog = (typeof getUnlockProgressCount === 'function') ? getUnlockProgressCount(char.id) : { current: 0, total: 4 };
        const badge = document.createElement('div');
        badge.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);border-radius:4px;padding:1px 5px;font-family:\'Share Tech Mono\',monospace;font-size:0.4rem;color:var(--accent);';
        badge.textContent = `🔒 ${prog.current}/${prog.total}`;
        div.appendChild(badge);
    }
    div.addEventListener('click', () => selectOpponent(char.id));
    return div;
}

function selectOpponent(charId) {
    _challengeTargetCharId = charId;
    document.getElementById('opponent-select-overlay').classList.add('hidden');
    document.getElementById('difficulty-overlay').classList.remove('hidden');
}

/** Skips picking a specific opponent — leaves _challengeTargetCharId unset so
 *  initGame()'s original random-opposite-faction-pick logic runs unchanged. */
function selectRandomOpponent() {
    _challengeTargetCharId = null;
    document.getElementById('opponent-select-overlay').classList.add('hidden');
    document.getElementById('difficulty-overlay').classList.remove('hidden');
}

function backToEquipFromOpponentSelect() {
    document.getElementById('opponent-select-overlay').classList.add('hidden');
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

    if (typeof BB_Audio !== 'undefined') {
        try { BB_Audio.init(); BB_Audio.returnToSelect(); }
        catch (e) { console.warn('BB_Audio failed, continuing without it:', e); }
    }
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
    if (typeof BB_Audio !== 'undefined') { try { BB_Audio.previewCharTheme(charId); } catch (e) { console.warn('BB_Audio.previewCharTheme failed:', e); } }

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