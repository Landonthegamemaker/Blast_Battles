/**
 * main.js — Blast Battles revamp entry point
 * Dependencies: data.js, utils.js, grid.js, combat.js, game-state.js, render.js
 * Loads last. Builds the HTML shell, wires all event listeners, bootstraps the game.
 *
 * Responsibilities:
 *   - Inject the full game HTML shell into <body>
 *   - Wire difficulty selection, rematch, and squad builder UI
 *   - Patch logMsg() so player/bot messages route to the dual play-by-play logs
 *   - Kick off squad builder on load
 */

'use strict';

// ── HTML shell ────────────────────────────────────────────────────────────────

function _buildShell() {
  document.body.style.margin  = '0';
  document.body.style.padding = '0';
  document.body.style.overflow= 'hidden';
  document.body.style.background = '#0d0f14';

  document.body.innerHTML = `
    <!-- ── Game container ───────────────────────────────── -->
    <div id="bb-game">

      <!-- Dual play-by-play logs -->
      <div id="bb-logs">
        <div class="bb-log bb-log-player">
          <div class="bb-log-label">Your Squad</div>
          <div id="bb-log-player"></div>
        </div>
        <div class="bb-log bb-log-bot">
          <div class="bb-log-label">Bot Squad</div>
          <div id="bb-log-bot"></div>
        </div>
      </div>

      <!-- Main arena: player panel | grid | bot panel -->
      <div id="bb-arena">

        <!-- Player squad panel -->
        <div id="bb-squad-player" class="bb-squad-panel">
          <div class="bb-squad-energy" id="bb-energy-player">
            <span class="bb-energy-val">⚡ 0</span>
            <span class="bb-energy-label">Energy</span>
          </div>
          <!-- Blaster cards injected by render() -->
        </div>

        <!-- Grid + info -->
        <div id="bb-grid-wrap">
          <div id="bb-grid"></div>
          <div id="bb-grid-info"></div>
        </div>

        <!-- Bot squad panel -->
        <div id="bb-squad-bot" class="bb-squad-panel">
          <div class="bb-squad-energy" id="bb-energy-bot">
            <span class="bb-energy-val">⚡ 0</span>
            <span class="bb-energy-label">Energy</span>
          </div>
          <!-- Blaster cards injected by render() -->
        </div>

      </div>

      <!-- Hint bar -->
      <div id="bb-hint">Select a Blaster to begin.</div>

    </div>

    <!-- ── Spotlight overlay ─────────────────────────────── -->
    <div id="bb-spotlight" class="hidden">
      <div id="bb-spotlight-card"></div>
    </div>

    <!-- ── Squad builder overlay ─────────────────────────── -->
    <div id="squad-builder-overlay">
      <div id="squad-builder-box">
        <div id="sb-title">BUILD YOUR SQUAD</div>
        <div id="sb-subtitle">Choose 5 Blasters · Mix factions for synergy bonuses</div>

        <!-- Difficulty row -->
        <div id="sb-difficulty-row">
          <span class="sb-label">DIFFICULTY</span>
          <div id="sb-difficulty-btns">
            <button class="sb-diff-btn" data-diff="easy">Easy</button>
            <button class="sb-diff-btn active" data-diff="medium">Medium</button>
            <button class="sb-diff-btn" data-diff="hard">Hard</button>
            <button class="sb-diff-btn" data-diff="impossible">Impossible</button>
          </div>
        </div>

        <!-- Era filter tabs -->
        <div id="sb-era-tabs">
          <button class="sb-era-tab active" data-era="all">All</button>
          <button class="sb-era-tab" data-era="era1">Era I</button>
          <button class="sb-era-tab" data-era="era2">Era II</button>
          <button class="sb-era-tab" data-era="era3">Era III</button>
          <button class="sb-era-tab" data-era="bounty_hunter">Bounty</button>
        </div>

        <!-- Blaster grid -->
        <div id="sb-blaster-grid"></div>

        <!-- Selected squad preview -->
        <div id="sb-selected-label">YOUR SQUAD <span id="sb-count">0 / 5</span></div>
        <div id="sb-selected-row"></div>

        <!-- Synergy hint -->
        <div id="sb-synergy-hint"></div>

        <!-- Launch button -->
        <button id="sb-launch-btn" disabled onclick="_launchGame()">
          SELECT 5 BLASTERS TO BEGIN
        </button>
      </div>
    </div>

    <!-- ── Result modal ───────────────────────────────────── -->
    <div id="modal-overlay" class="hidden">
      <div id="modal-box">
        <div id="modal-title"></div>
        <div id="modal-msg"></div>
        <div id="modal-stats"></div>
        <button id="modal-rematch" onclick="_rematch()">⚔️ REMATCH</button>
      </div>
    </div>
  `;

  _injectBuilderStyles();
}

// ── Squad builder styles ──────────────────────────────────────────────────────

function _injectBuilderStyles() {
  if (document.getElementById('bb-builder-styles')) return;
  const s = document.createElement('style');
  s.id = 'bb-builder-styles';
  s.textContent = `
    #squad-builder-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.92);
      display: flex; align-items: center; justify-content: center;
      z-index: 300;
      overflow-y: auto;
      padding: 16px;
    }
    #squad-builder-overlay.hidden { display: none; }

    #squad-builder-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 24px 28px;
      width: min(680px, 98vw);
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: var(--shadow);
    }

    #sb-title {
      font-size: 1.6rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: var(--energy);
    }
    #sb-subtitle {
      font-size: 0.78rem;
      color: var(--muted);
      margin-top: -8px;
    }

    /* Difficulty */
    #sb-difficulty-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .sb-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
      white-space: nowrap;
    }
    #sb-difficulty-btns { display: flex; gap: 6px; flex-wrap: wrap; }
    .sb-diff-btn {
      padding: 5px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface2);
      color: var(--text-dim);
      font-family: var(--font-main);
      font-size: 0.78rem;
      cursor: pointer;
      transition: all 0.12s;
    }
    .sb-diff-btn.active {
      border-color: var(--energy);
      color: var(--energy);
      background: rgba(255,224,102,0.08);
    }

    /* Era tabs */
    #sb-era-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .sb-era-tab {
      padding: 4px 12px;
      border: 1px solid var(--border);
      border-radius: 20px;
      background: transparent;
      color: var(--text-dim);
      font-family: var(--font-main);
      font-size: 0.74rem;
      cursor: pointer;
      transition: all 0.12s;
    }
    .sb-era-tab.active {
      border-color: var(--hero);
      color: var(--hero);
      background: rgba(74,184,255,0.08);
    }

    /* Blaster grid */
    #sb-blaster-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px;
      max-height: 280px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .sb-blaster-card {
      padding: 10px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      cursor: pointer;
      transition: all 0.12s;
      position: relative;
    }
    .sb-blaster-card:hover { border-color: var(--hero); }
    .sb-blaster-card.selected {
      border-color: var(--energy);
      background: rgba(255,224,102,0.06);
    }
    .sb-blaster-card.disabled {
      opacity: 0.38;
      cursor: default;
      pointer-events: none;
    }
    .sb-card-icon   { font-size: 1.5rem; }
    .sb-card-name   { font-size: 0.78rem; font-weight: 700; margin-top: 4px; }
    .sb-card-faction{ font-size: 0.6rem; color: var(--muted); text-transform: uppercase; }
    .sb-card-stats  { font-size: 0.62rem; color: var(--text-dim); margin-top: 4px; }
    .sb-selected-badge {
      position: absolute; top: 5px; right: 5px;
      background: var(--energy); color: #000;
      border-radius: 50%; width: 16px; height: 16px;
      font-size: 0.55rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    /* Endurance warning */
    .sb-endurance-low { border-color: var(--danger) !important; }
    .sb-endurance-pip {
      font-size: 0.58rem;
      color: var(--danger);
      margin-top: 2px;
    }

    /* Selected row */
    #sb-selected-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
    }
    #sb-count { color: var(--energy); margin-left: 6px; }
    #sb-selected-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      min-height: 44px;
    }
    .sb-selected-pip {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      background: var(--surface2);
      border: 1px solid var(--energy);
      border-radius: var(--radius);
      font-size: 0.74rem;
      cursor: pointer;
    }
    .sb-selected-pip:hover { opacity: 0.75; }

    /* Synergy hint */
    #sb-synergy-hint {
      font-size: 0.72rem;
      color: var(--accent2);
      min-height: 18px;
    }

    /* Launch button */
    #sb-launch-btn {
      padding: 13px;
      background: var(--accent);
      border: none;
      border-radius: var(--radius);
      color: #fff;
      font-family: var(--font-main);
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    #sb-launch-btn:hover:not(:disabled) { opacity: 0.88; }
    #sb-launch-btn:disabled {
      opacity: 0.38;
      cursor: default;
    }
  `;
  document.head.appendChild(s);
}

// ── Squad builder state ───────────────────────────────────────────────────────

let _selectedIds  = [];   // up to 5 Blaster IDs
let _selectedDiff = 'medium';
let _activeEra    = 'all';
let _savedEndurance = {};

function _openSquadBuilder() {
  _selectedIds    = [];
  _savedEndurance = loadEndurance();
  document.getElementById('squad-builder-overlay').classList.remove('hidden');
  _renderBuilderGrid();
  _renderSelectedRow();
}

function _renderBuilderGrid() {
  const grid = document.getElementById('sb-blaster-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = BLASTER_POOL.filter(b => {
    if (_activeEra === 'all') return true;
    if (_activeEra === 'bounty_hunter') return b.faction === 'bounty_hunter';
    return b.era === _activeEra;
  });

  filtered.forEach(b => {
    const isSelected = _selectedIds.includes(b.id);
    const endurance  = _savedEndurance[b.id] !== undefined
      ? _savedEndurance[b.id]
      : b.endurance;
    const isRested   = endurance > 0;
    const isDisabled = !isSelected && (_selectedIds.length >= 5 || !isRested);
    const faction    = FACTIONS.find(f => f.id === b.faction);
    const selOrder   = _selectedIds.indexOf(b.id) + 1;

    const card = document.createElement('div');
    card.className = [
      'sb-blaster-card',
      isSelected ? 'selected'  : '',
      isDisabled ? 'disabled'  : '',
      endurance <= 1 && isRested ? 'sb-endurance-low' : '',
    ].filter(Boolean).join(' ');

    card.innerHTML = `
      ${isSelected ? `<div class="sb-selected-badge">${selOrder}</div>` : ''}
      <div class="sb-card-icon">${b.icon}</div>
      <div class="sb-card-name">${b.name}</div>
      <div class="sb-card-faction">${faction ? faction.name : b.faction}</div>
      <div class="sb-card-stats">
        SPD ${b.speed} · STM ${b.stamina} · STR ${b.strength} · HP ${b.health}
      </div>
      ${!isRested ? `<div class="sb-endurance-pip">😴 Resting — no Endurance</div>`
        : endurance <= 1 ? `<div class="sb-endurance-pip">⚠️ ${endurance} Endurance left</div>`
        : `<div class="sb-card-stats" style="color:var(--heal);">❤️ ${endurance} Endurance</div>`}
    `;

    if (!isDisabled || isSelected) {
      card.addEventListener('click', () => _toggleBlaster(b.id));
    }
    grid.appendChild(card);
  });
}

function _toggleBlaster(id) {
  if (_selectedIds.includes(id)) {
    _selectedIds = _selectedIds.filter(x => x !== id);
  } else if (_selectedIds.length < 5) {
    _selectedIds.push(id);
  }
  _renderBuilderGrid();
  _renderSelectedRow();
  _renderSynergyHint();
  _updateLaunchBtn();
}

function _renderSelectedRow() {
  const row = document.getElementById('sb-selected-row');
  const cnt = document.getElementById('sb-count');
  if (!row) return;
  row.innerHTML = '';
  cnt.textContent = `${_selectedIds.length} / 5`;

  _selectedIds.forEach(id => {
    const b    = BLASTER_POOL.find(x => x.id === id);
    if (!b) return;
    const pip  = document.createElement('div');
    pip.className   = 'sb-selected-pip';
    pip.innerHTML   = `${b.icon} ${b.name}`;
    pip.title       = 'Click to remove';
    pip.addEventListener('click', () => _toggleBlaster(id));
    row.appendChild(pip);
  });
}

function _renderSynergyHint() {
  const el = document.getElementById('sb-synergy-hint');
  if (!el) return;

  if (_selectedIds.length === 0) { el.textContent = ''; return; }

  // Count factions
  const factionCount = {};
  _selectedIds.forEach(id => {
    const b = BLASTER_POOL.find(x => x.id === id);
    if (b) factionCount[b.faction] = (factionCount[b.faction] || 0) + 1;
  });

  const hints = [];
  Object.entries(factionCount).forEach(([fid, count]) => {
    const f = FACTIONS.find(x => x.id === fid);
    if (!f) return;
    const tier = SYNERGY_THRESHOLDS.filter(t => count >= t).length;
    if (tier > 0) hints.push(`${f.name} ×${count} — ${f.synergy} (Tier ${tier})`);
  });

  // United Front: all different alignments
  const alignments = new Set(_selectedIds.map(id => {
    const b = BLASTER_POOL.find(x => x.id === id);
    return b ? b.alignment : null;
  }));
  if (alignments.size >= 3 && _selectedIds.length === 5) {
    hints.push(`⚖️ United Front — ${UNITED_FRONT_BONUS.desc}`);
  }

  el.textContent = hints.length > 0
    ? `✨ ${hints.join('  ·  ')}`
    : 'Mix factions for synergy bonuses.';
}

function _updateLaunchBtn() {
  const btn = document.getElementById('sb-launch-btn');
  if (!btn) return;
  const ready = _selectedIds.length === 5;
  btn.disabled     = !ready;
  btn.textContent  = ready ? '⚔️ DEPLOY SQUAD' : `SELECT 5 BLASTERS TO BEGIN (${_selectedIds.length}/5)`;
}

function _launchGame() {
  document.getElementById('squad-builder-overlay').classList.add('hidden');
  initGame({
    playerSquad:       _selectedIds,
    difficulty:        _selectedDiff,
    consumableSlots:   CONSUMABLE_SLOTS_START,
    playerConsumables: [],
  });
}

function _rematch() {
  document.getElementById('modal-overlay').classList.add('hidden');
  _openSquadBuilder();
}

// ── logMsg routing ────────────────────────────────────────────────────────────
// Patch the logMsg from game-state.js so player/bot messages
// also appear in the dual play-by-play logs.

const _origLogMsg = typeof logMsg === 'function' ? logMsg : null;

function logMsg(type, text) {
  // Write to the main G.log and the slim center log (from game-state.js)
  if (_origLogMsg) _origLogMsg(type, text);

  // Route to dual play-by-play panels
  if (type === 'player' || type === 'heal' && text.includes('You')) {
    logPlayerMsg(text, type);
  } else if (type === 'bot') {
    logBotMsg(text, type);
  } else if (type === 'damage') {
    // Damage to player → player log; damage to bot → bot log
    const toBot = text.includes('bot') || text.includes('Bot') ||
                  (G.botSquad && G.botSquad.some(b => text.includes(b.name)));
    if (toBot) logBotMsg(text, type);
    else       logPlayerMsg(text, type);
  } else {
    // System / phase messages go to both logs
    logPlayerMsg(text, type);
    logBotMsg(text, type);
  }
}

// ── Event wiring ──────────────────────────────────────────────────────────────

function _wireEvents() {
  // Difficulty buttons
  document.addEventListener('click', e => {
    if (e.target.classList.contains('sb-diff-btn')) {
      document.querySelectorAll('.sb-diff-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      _selectedDiff = e.target.dataset.diff;
    }
    if (e.target.classList.contains('sb-era-tab')) {
      document.querySelectorAll('.sb-era-tab').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      _activeEra = e.target.dataset.era;
      _renderBuilderGrid();
    }
  });

  // Close spotlight on backdrop click
  document.addEventListener('click', e => {
    const spotlight = document.getElementById('bb-spotlight');
    if (spotlight && e.target === spotlight) closeSpotlight();
  });

  // Keyboard: Escape closes spotlight
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSpotlight();
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  _buildShell();
  _wireEvents();
  _openSquadBuilder();
});
