/**
 * render.js — Blast Battles revamp UI rendering
 * Dependencies: data.js, utils.js, grid.js, combat.js, game-state.js
 * Reads G (game state). Never writes to G directly.
 *
 * Exports (browser globals):
 *   render()                        — full UI repaint
 *   renderSpotlight(side, idx)      — opens active Blaster spotlight overlay
 *   closeSpotlight()                — closes spotlight
 *   updateHint(text)                — sets the hint bar text
 *   logPlayerMsg(text)              — appends to player play-by-play log
 *   logBotMsg(text)                 — appends to bot play-by-play log
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │  [Player Log]          [Bot Log]            │  ← dual play-by-play
 *   ├──────────┬──────────────────┬───────────────┤
 *   │  Player  │   5×5 Grid       │  Bot Squad    │
 *   │  Squad   │                  │               │
 *   │  Panel   │                  │               │
 *   ├──────────┴──────────────────┴───────────────┤
 *   │  [Hint bar]   [⚡ Energy]   [+1 carry token]│
 *   └─────────────────────────────────────────────┘
 *   Spotlight overlay appears centered when a Blaster acts.
 */

'use strict';

// ── CSS custom properties (injected once at load) ─────────────────────────────

(function injectCSS() {
  if (document.getElementById('bb-render-styles')) return;
  const style = document.createElement('style');
  style.id    = 'bb-render-styles';
  style.textContent = `
    /* ── Design tokens ───────────────────────────────────── */
    :root {
      --bg:          #0d0f14;
      --surface:     #161a23;
      --surface2:    #1e2330;
      --border:      #2a3145;
      --hero:        #4ab8ff;
      --villain:     #c44bff;
      --neutral:     #a0aabf;
      --flex:        #ffcc44;
      --accent:      #ff5f3d;
      --accent2:     #ff8c42;
      --heal:        #44ffaa;
      --danger:      #ff3d5f;
      --muted:       #5a6478;
      --text:        #e4e8f0;
      --text-dim:    #8892a4;
      --energy:      #ffe066;
      --stamina:     #66d9e8;
      --ko:          #3a1a1a;
      --radius:      8px;
      --radius-lg:   14px;
      --shadow:      0 4px 24px rgba(0,0,0,0.55);
      --font-main:   'Rajdhani', 'Segoe UI', sans-serif;
      --font-mono:   'Share Tech Mono', monospace;
    }

    /* ── Layout shell ────────────────────────────────────── */
    #bb-game {
      display: grid;
      grid-template-rows: auto 1fr auto;
      grid-template-columns: 1fr;
      height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-main);
      overflow: hidden;
    }

    /* ── Dual log bar ────────────────────────────────────── */
    #bb-logs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px;
      height: 96px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .bb-log {
      overflow-y: auto;
      padding: 6px 10px;
      font-size: 0.72rem;
      font-family: var(--font-mono);
      scrollbar-width: thin;
    }
    .bb-log-player { border-right: 1px solid var(--border); }
    .bb-log-label {
      font-size: 0.6rem;
      letter-spacing: 0.12em;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .bb-log-entry { margin: 1px 0; line-height: 1.35; }
    .bb-log-entry.damage { color: var(--danger); }
    .bb-log-entry.heal   { color: var(--heal);   }
    .bb-log-entry.system { color: var(--muted);  }
    .bb-log-entry.phase  { color: var(--energy); font-weight: 600; }
    .bb-log-entry.player { color: var(--hero);   }
    .bb-log-entry.bot    { color: var(--villain);}

    /* ── Main arena ──────────────────────────────────────── */
    #bb-arena {
      display: grid;
      grid-template-columns: 220px 1fr 220px;
      gap: 8px;
      padding: 8px;
      overflow: hidden;
    }

    /* ── Squad panels ────────────────────────────────────── */
    .bb-squad-panel {
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow-y: auto;
    }
    .bb-squad-energy {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 0.8rem;
    }
    .bb-energy-val {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--energy);
    }
    .bb-bank-val {
      font-size: 0.78rem;
      color: var(--accent2);
      opacity: 0.85;
    }

    /* ── Blaster cards ───────────────────────────────────── */
    .bb-blaster-card {
      position: relative;
      padding: 8px 10px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .bb-blaster-card:hover:not(.ko) {
      border-color: var(--hero);
      box-shadow: 0 0 10px rgba(74,184,255,0.2);
    }
    .bb-blaster-card.ko {
      background: var(--ko);
      opacity: 0.55;
      cursor: default;
    }
    .bb-blaster-card.active {
      border-color: var(--energy) !important;
      box-shadow: 0 0 14px rgba(255,224,102,0.35);
    }
    .bb-blaster-card.hero    { border-left: 3px solid var(--hero);    }
    .bb-blaster-card.villain { border-left: 3px solid var(--villain); }
    .bb-blaster-card.neutral { border-left: 3px solid var(--neutral); }
    .bb-blaster-card.flex    { border-left: 3px solid var(--flex);    }

    .bb-blaster-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .bb-blaster-icon { font-size: 1.3rem; }
    .bb-blaster-name {
      font-size: 0.82rem;
      font-weight: 700;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bb-blaster-faction {
      font-size: 0.6rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* HP bar */
    .bb-bar-row {
      display: flex;
      align-items: center;
      gap: 5px;
      margin: 2px 0;
      font-size: 0.68rem;
      color: var(--text-dim);
    }
    .bb-bar-track {
      flex: 1;
      height: 5px;
      background: var(--surface2);
      border-radius: 3px;
      overflow: hidden;
    }
    .bb-bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s;
    }
    .bb-bar-fill.hp      { background: var(--heal);    }
    .bb-bar-fill.stamina { background: var(--stamina); }
    .bb-bar-val { min-width: 28px; text-align: right; }

    /* Weapon tag */
    .bb-weapon-tag {
      display: inline-block;
      margin-top: 4px;
      padding: 1px 6px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 0.62rem;
      color: var(--text-dim);
    }

    /* ── Grid ────────────────────────────────────────────── */
    #bb-grid-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    #bb-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 3px;
      width: 100%;
      max-width: 360px;
    }
    .bb-tile {
      aspect-ratio: 1;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      position: relative;
      transition: border-color 0.15s;
    }
    .bb-tile.hero-zone    { border-color: var(--hero);    background: rgba(74,184,255,0.06);  }
    .bb-tile.villain-zone { border-color: var(--villain); background: rgba(196,75,255,0.06);  }
    .bb-tile.danger       { border-color: var(--danger);  background: rgba(255,61,95,0.06);   }
    .bb-tile.buff         { border-color: var(--heal);    background: rgba(68,255,170,0.05);  }
    .bb-tile.neutral      { border-color: var(--border);  }

    .bb-tile-icon  { font-size: 1.1rem; line-height: 1; }
    .bb-tile-name  {
      font-size: 0.42rem;
      color: var(--muted);
      text-align: center;
      padding: 0 2px;
      line-height: 1.2;
    }
    /* Blaster pips on tiles */
    .bb-tile-pips {
      position: absolute;
      bottom: 2px;
      right: 2px;
      display: flex;
      gap: 1px;
    }
    .bb-tile-pip {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .bb-tile-pip.player { background: var(--hero);    }
    .bb-tile-pip.bot    { background: var(--villain); }

    /* Round / energy info below grid */
    #bb-grid-info {
      display: flex;
      gap: 16px;
      font-size: 0.75rem;
      color: var(--text-dim);
    }
    #bb-grid-info span { color: var(--text); font-weight: 600; }

    /* ── Hint bar ────────────────────────────────────────── */
    #bb-hint {
      padding: 6px 12px;
      background: var(--surface);
      border-top: 1px solid var(--border);
      font-size: 0.72rem;
      color: var(--muted);
      text-align: center;
      min-height: 28px;
    }

    /* ── Spotlight overlay ───────────────────────────────── */
    #bb-spotlight {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.72);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      backdrop-filter: blur(3px);
    }
    #bb-spotlight.hidden { display: none; }

    #bb-spotlight-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px 24px;
      width: min(480px, 94vw);
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sp-header {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .sp-portrait {
      width: 72px;
      height: 72px;
      border-radius: 10px;
      background: var(--surface2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.4rem;
      border: 2px solid var(--border);
      flex-shrink: 0;
      overflow: hidden;
    }
    .sp-portrait img { width: 100%; height: 100%; object-fit: cover; }
    .sp-name {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .sp-faction {
      font-size: 0.68rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .sp-ability {
      font-size: 0.72rem;
      color: var(--accent2);
      margin-top: 3px;
      font-style: italic;
    }

    /* Stat bars in spotlight */
    .sp-bars { display: flex; flex-direction: column; gap: 5px; }
    .sp-bar-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.72rem;
    }
    .sp-bar-label { width: 64px; color: var(--text-dim); }
    .sp-bar-track {
      flex: 1;
      height: 7px;
      background: var(--surface2);
      border-radius: 4px;
      overflow: hidden;
    }
    .sp-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .sp-bar-fill.hp      { background: var(--heal);    }
    .sp-bar-fill.stamina { background: var(--stamina); }
    .sp-bar-val { width: 56px; text-align: right; color: var(--text); }

    /* Gear row */
    .sp-gear {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .sp-gear-item {
      padding: 4px 10px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.7rem;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .sp-gear-item.weapon  { border-color: var(--accent);  }
    .sp-gear-item.armor   { border-color: var(--stamina); }
    .sp-gear-item.gadget  { border-color: var(--flex);    }
    .sp-gear-empty { color: var(--muted); font-style: italic; }

    /* Energy in spotlight */
    .sp-energy-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: var(--surface2);
      border-radius: var(--radius);
      font-size: 0.78rem;
    }
    .sp-energy-main { font-size: 1.4rem; font-weight: 700; color: var(--energy); }
    .sp-energy-bank { color: var(--accent2); font-size: 0.78rem; }
    .sp-energy-label { color: var(--text-dim); font-size: 0.68rem; }
    .sp-timer {
      margin-left: auto;
      font-size: 1rem;
      font-weight: 700;
      color: var(--muted);
      font-family: var(--font-mono);
    }

    /* Action buttons */
    .sp-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .sp-btn {
      padding: 10px 0;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface2);
      color: var(--text);
      font-family: var(--font-main);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.05em;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .sp-btn:hover:not(:disabled) { background: var(--border); }
    .sp-btn:disabled { opacity: 0.38; cursor: default; }
    .sp-btn.fire     { border-color: var(--accent);  color: var(--accent);  }
    .sp-btn.ability  { border-color: var(--flex);    color: var(--flex);    }
    .sp-btn.item     { border-color: var(--heal);    color: var(--heal);    }
    .sp-btn.pass     { border-color: var(--muted);   color: var(--muted);   }
    .sp-btn.retreat  { border-color: var(--danger);  color: var(--danger);  grid-column: 1 / -1; }
    .sp-btn.fire:hover:not(:disabled)    { background: rgba(255,95,61,0.12);  }
    .sp-btn.ability:hover:not(:disabled) { background: rgba(255,204,68,0.1);  }
    .sp-btn.item:hover:not(:disabled)    { background: rgba(68,255,170,0.08); }
    .sp-btn.retreat:hover:not(:disabled) { background: rgba(255,61,95,0.1);   }

    /* Target select overlay on blaster cards */
    .bb-blaster-card.target-select {
      border-color: var(--accent) !important;
      box-shadow: 0 0 12px rgba(255,95,61,0.4);
      animation: pulse-target 1s infinite alternate;
    }
    @keyframes pulse-target {
      from { box-shadow: 0 0 8px rgba(255,95,61,0.3); }
      to   { box-shadow: 0 0 18px rgba(255,95,61,0.6); }
    }

    /* ── Result modal ────────────────────────────────────── */
    #modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.82);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
    }
    #modal-overlay.hidden { display: none; }
    #modal-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 28px 32px;
      width: min(520px, 96vw);
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    #modal-title {
      font-size: 2rem;
      font-weight: 800;
      text-align: center;
      letter-spacing: 0.06em;
    }
    #modal-msg {
      text-align: center;
      color: var(--text-dim);
      font-size: 0.88rem;
    }
    #modal-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .modal-stat {
      padding: 10px 12px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .modal-stat-label { font-size: 0.65rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .modal-stat-value { font-size: 1.1rem; font-weight: 700; margin-top: 2px; }
    .modal-squad-block {
      grid-column: 1 / -1;
      padding: 10px 12px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .modal-squad-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
    .modal-blaster-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      padding: 3px 0;
      border-bottom: 1px solid var(--border);
    }
    .modal-blaster-row:last-child { border-bottom: none; }
    .modal-blaster-icon { font-size: 1rem; }
    .modal-blaster-name { flex: 1; font-weight: 600; }
    .modal-blaster-hp { color: var(--text-dim); font-family: var(--font-mono); font-size: 0.72rem; }
    .modal-stat-split {
      grid-column: 1 / -1;
      display: flex;
      gap: 8px;
    }
    .modal-stat-split > * { flex: 1; padding: 10px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); }
    #modal-rematch {
      padding: 12px;
      background: var(--accent);
      border: none;
      border-radius: var(--radius);
      color: #fff;
      font-family: var(--font-main);
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.06em;
      transition: opacity 0.15s;
    }
    #modal-rematch:hover { opacity: 0.88; }
  `;
  document.head.appendChild(style);
})();

// ── State ─────────────────────────────────────────────────────────────────────

let _spotlightSide = null;
let _spotlightIdx  = null;
let _awaitingTarget = false; // true when player clicked FIRE and must pick a target

// ── Main render ───────────────────────────────────────────────────────────────

/**
 * Full UI repaint. Called after every state change.
 * Renders squad panels, grid, energy rows.
 */
function render() {
  _renderSquadPanel('player');
  _renderSquadPanel('bot');
  _renderGrid();
  _renderEnergyRows();
}

// ── Squad panels ──────────────────────────────────────────────────────────────

function _renderSquadPanel(side) {
  const panelId = side === 'player' ? 'bb-squad-player' : 'bb-squad-bot';
  const panel   = document.getElementById(panelId);
  if (!panel) return;

  const squad    = side === 'player' ? G.playerSquad : G.botSquad;
  const active   = G.selectedBlaster;

  // Keep energy row, rebuild blaster cards
  const energyEl = panel.querySelector('.bb-squad-energy');
  panel.innerHTML = '';
  if (energyEl) panel.appendChild(energyEl);

  squad.forEach((b, idx) => {
    const isActive = active && active.side === side && active.idx === idx;
    const card = document.createElement('div');
    card.className = [
      'bb-blaster-card',
      b.alignment,
      b.ko    ? 'ko'     : '',
      isActive ? 'active' : '',
    ].filter(Boolean).join(' ');
    card.dataset.side = side;
    card.dataset.idx  = idx;

    const hpPct  = Math.max(0, Math.round((b.hp / b.maxHp) * 100));
    const faction = FACTIONS.find(f => f.id === b.faction);

    card.innerHTML = `
      <div class="bb-blaster-header">
        <span class="bb-blaster-icon">${b.icon}</span>
        <div style="flex:1;min-width:0;">
          <div class="bb-blaster-name" style="color:${_alignColor(b.alignment)};">${b.name}</div>
          <div class="bb-blaster-faction">${faction ? faction.name : b.faction}</div>
        </div>
        ${b.ko ? '<span style="color:var(--danger);font-size:0.8rem;">💀 KO</span>' : ''}
      </div>
      <div class="bb-bar-row">
        <span>HP</span>
        <div class="bb-bar-track"><div class="bb-bar-fill hp" style="width:${hpPct}%;"></div></div>
        <span class="bb-bar-val">${b.hp}</span>
      </div>
      ${b.weapon ? `<div class="bb-weapon-tag">${b.weapon.icon} ${b.weapon.name} · cost ${b.weapon.energyCost}</div>` : '<div class="bb-weapon-tag" style="color:var(--muted);">No weapon</div>'}
    `;

    // Click to open spotlight (player cards only, non-KO, when it's player's turn)
    if (side === 'player' && !b.ko && active && active.side === 'player' && active.idx === idx) {
      card.addEventListener('click', () => renderSpotlight('player', idx));
    }

    // Click to select as target when awaiting target selection
    if (_awaitingTarget && side === 'bot' && !b.ko) {
      card.classList.add('target-select');
      card.addEventListener('click', () => _resolveTarget(idx));
    }

    panel.appendChild(card);
  });
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function _renderGrid() {
  const grid = document.getElementById('bb-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let i = 0; i < 25; i++) {
    const loc  = G.locations[i];
    const tile = document.createElement('div');
    tile.className = `bb-tile ${loc ? loc.css : 'neutral'}`;

    // Blaster pips
    const playerPips = G.playerPositions
      .map((pos, idx) => pos === i && !G.playerSquad[idx].ko ? idx : -1)
      .filter(x => x >= 0);
    const botPips = G.botPositions
      .map((pos, idx) => pos === i && !G.botSquad[idx].ko ? idx : -1)
      .filter(x => x >= 0);

    const pipHTML = [...playerPips.map(() => `<div class="bb-tile-pip player"></div>`),
                     ...botPips.map(()    => `<div class="bb-tile-pip bot"></div>`)].join('');

    tile.innerHTML = `
      <div class="bb-tile-icon">${loc ? loc.icon : '⬜'}</div>
      <div class="bb-tile-name">${loc ? loc.name : ''}</div>
      ${pipHTML ? `<div class="bb-tile-pips">${pipHTML}</div>` : ''}
    `;
    grid.appendChild(tile);
  }

  // Grid info row
  const info = document.getElementById('bb-grid-info');
  if (info) {
    info.innerHTML = `
      Round <span>${G.round} / ${MAX_TURNS}</span>
      &nbsp;·&nbsp;
      Difficulty <span>${(G.difficulty || '').toUpperCase()}</span>
    `;
  }
}

// ── Energy rows ───────────────────────────────────────────────────────────────

function _renderEnergyRows() {
  _renderEnergyRow('player');
  _renderEnergyRow('bot');
}

function _renderEnergyRow(side) {
  const id  = side === 'player' ? 'bb-energy-player' : 'bb-energy-bot';
  const el  = document.getElementById(id);
  if (!el) return;
  const energy = side === 'player' ? G.playerEnergy    : G.botEnergy;
  const bank   = side === 'player' ? G.playerEnergyBank: G.botEnergyBank;
  el.innerHTML = `
    <span class="bb-energy-val">⚡ ${energy}</span>
    <span class="bb-energy-label">Energy</span>
    ${bank > 0 ? `<span class="bb-bank-val">+${bank} stored</span>` : ''}
  `;
}

// ── Spotlight overlay ─────────────────────────────────────────────────────────

/**
 * Opens the active Blaster spotlight panel.
 * Auto-opens when it's the player's turn and a Blaster card is clicked.
 *
 * @param {'player'|'bot'} side
 * @param {number} idx
 */
function renderSpotlight(side, idx) {
  const overlay = document.getElementById('bb-spotlight');
  if (!overlay) return;

  _spotlightSide = side;
  _spotlightIdx  = idx;

  const squad = side === 'player' ? G.playerSquad : G.botSquad;
  const b     = squad[idx];
  if (!b) return;

  const energy  = side === 'player' ? G.playerEnergy     : G.botEnergy;
  const bank    = side === 'player' ? G.playerEnergyBank  : G.botEnergyBank;
  const hpPct   = Math.max(0, Math.round((b.hp / b.maxHp) * 100));
  const color   = _alignColor(b.alignment);
  const faction = FACTIONS.find(f => f.id === b.faction);

  // Portrait
  const portrait = b.img
    ? `<img src="${b.img}" alt="${b.name}">`
    : b.icon;

  // Gear
  const weaponTag  = b.weapon
    ? `<div class="sp-gear-item weapon">${b.weapon.icon} ${b.weapon.name} <span style="color:var(--muted);margin-left:4px;">·cost ${b.weapon.energyCost}</span></div>`
    : `<div class="sp-gear-item sp-gear-empty">No weapon</div>`;
  const armorTags  = (b.armor || []).length > 0
    ? b.armor.map(a => `<div class="sp-gear-item armor">${a.icon} ${a.name} <span style="color:var(--muted);margin-left:4px;">·${a.durability}dur</span></div>`).join('')
    : `<div class="sp-gear-item sp-gear-empty">No armor</div>`;
  const gadgetTag  = b.gadget
    ? `<div class="sp-gear-item gadget">${b.gadget.icon} ${b.gadget.name}</div>`
    : `<div class="sp-gear-item sp-gear-empty">No gadget</div>`;

  // Ability energy cost
  const abilityCost = Math.ceil(energy * ABILITY_DRAIN_AMOUNT);
  const canFire     = side === 'player' && b.weapon && energy >= b.weapon.energyCost;
  const canAbility  = side === 'player' && !b.abilityUsed && energy >= abilityCost && abilityCost > 0;
  const canItem     = side === 'player' && G.playerConsumables.length > 0;
  const isPlayerTurn= side === 'player' && G.selectedBlaster && G.selectedBlaster.side === 'player' && G.selectedBlaster.idx === idx;

  overlay.querySelector('#bb-spotlight-card').innerHTML = `
    <div class="sp-header">
      <div class="sp-portrait" style="border-color:${color};">${portrait}</div>
      <div>
        <div class="sp-name" style="color:${color};">${b.name}</div>
        <div class="sp-faction">${faction ? faction.name : b.faction} · ${b.alignment}</div>
        <div class="sp-ability">${b.ability || '—'}</div>
      </div>
    </div>

    <div class="sp-bars">
      <div class="sp-bar-row">
        <span class="sp-bar-label">HP</span>
        <div class="sp-bar-track"><div class="sp-bar-fill hp" style="width:${hpPct}%;"></div></div>
        <span class="sp-bar-val">${b.hp} / ${b.maxHp}</span>
      </div>
    </div>

    <div class="sp-energy-row">
      <div>
        <div class="sp-energy-main">⚡ ${energy}</div>
        <div class="sp-energy-label">Squad Energy${bank > 0 ? ` · <span class="sp-energy-bank">+${bank} stored</span>` : ''}</div>
      </div>
      ${isPlayerTurn ? `<div id="sp-timer" class="sp-timer">⏱ 20s</div>` : ''}
    </div>

    <div>
      <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px;">Gear</div>
      <div class="sp-gear">
        ${weaponTag}${armorTags}${gadgetTag}
      </div>
    </div>

    ${isPlayerTurn ? `
    <div class="sp-actions">
      <button class="sp-btn fire"    onclick="_onFire()"    ${canFire    ? '' : 'disabled'}>🔫 Fire (${b.weapon ? b.weapon.energyCost : '?'}⚡)</button>
      <button class="sp-btn ability" onclick="_onAbility()" ${canAbility ? '' : 'disabled'}>✨ Ability (${abilityCost}⚡)</button>
      <button class="sp-btn item"    onclick="_onItem()"    ${canItem    ? '' : 'disabled'}>🎒 Use Item</button>
      <button class="sp-btn pass"    onclick="_onPass()">⏭ Pass Turn</button>
      <button class="sp-btn retreat" onclick="retreat()">🏳 Retreat</button>
    </div>` : ''}
  `;

  overlay.classList.remove('hidden');
}

function closeSpotlight() {
  const overlay = document.getElementById('bb-spotlight');
  if (overlay) overlay.classList.add('hidden');
  _spotlightSide = null;
  _spotlightIdx  = null;
  _awaitingTarget = false;
}

// ── Spotlight action handlers ─────────────────────────────────────────────────

function _onFire() {
  if (_spotlightIdx === null) return;
  closeSpotlight();
  // Enter target-select mode — bot cards will pulse
  _awaitingTarget = true;
  render();
  updateHint('Select a target to fire at.');
}

function _resolveTarget(targetIdx) {
  _awaitingTarget = false;
  const atkIdx = G.selectedBlaster ? G.selectedBlaster.idx : 0;
  fireWeapon('player', atkIdx, targetIdx);
  render();
  endBlasterTurn('player');
}

function _onAbility() {
  if (_spotlightIdx === null) return;
  useAbility('player', _spotlightIdx);
  closeSpotlight();
  render();
  endBlasterTurn('player');
}

function _onItem() {
  if (G.playerConsumables.length === 0) return;
  // For now: use first consumable on the active Blaster
  // Full item-select UI to be added in a later pass
  const item = G.playerConsumables[0];
  useConsumable('player', item.id, _spotlightIdx);
  closeSpotlight();
  render();
  // Using an item does NOT end the turn
}

function _onPass() {
  closeSpotlight();
  endBlasterTurn('player');
}

// ── Hint bar ──────────────────────────────────────────────────────────────────

function updateHint(text) {
  const el = document.getElementById('bb-hint');
  if (el) el.textContent = text || '';
}

// ── Dual play-by-play logs ────────────────────────────────────────────────────

function logPlayerMsg(text, type = 'player') {
  _appendLog('bb-log-player', text, type);
}

function logBotMsg(text, type = 'bot') {
  _appendLog('bb-log-bot', text, type);
}

function _appendLog(id, text, type) {
  const el  = document.getElementById(id);
  if (!el) return;
  const div = document.createElement('div');
  div.className   = `bb-log-entry ${type}`;
  div.textContent = text;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

// ── Alignment color helper ────────────────────────────────────────────────────

function _alignColor(alignment) {
  switch (alignment) {
    case 'hero':    return 'var(--hero)';
    case 'villain': return 'var(--villain)';
    case 'flex':    return 'var(--flex)';
    default:        return 'var(--neutral)';
  }
}
