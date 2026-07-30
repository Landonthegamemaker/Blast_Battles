/**
 * game-state.js — Blast Battles revamp game state & turn engine
 * Dependencies: data.js, utils.js, grid.js, combat.js
 *
 * Turn model:
 *   - Each round both sides receive +1 Energy (scales: round 1 = 1, round 2 = 2, etc., cap at 10)
 *   - Speed determines act-order within the round (highest Speed acts first)
 *   - Ties in Speed broken by coin flip at round start
 *   - Player gets 20s to act; bot acts instantly on its turn
 *   - Round cap: MAX_TURNS (15). Tiebreaker: HP remaining + Blasters alive.
 *
 * Exports (browser globals):
 *   G                        — live game state object
 *   initGame(squadConfig)    — starts a new match
 *   startRound()             — begins a new round
 *   startBlasterTurn(side, blasterIndex)
 *   endBlasterTurn(side)
 *   spendEnergy(side, blasterIndex, amount) → boolean
 *   tickActionTimer()
 *   clearActionTimer()
 *   checkWin()
 *   endGame(winner)
 *   logMsg(type, text)
 *   saveEndurance()          — persists Endurance to localStorage
 *   loadEndurance()          — restores Endurance from localStorage
 */

'use strict';

// ── Live game state ───────────────────────────────────────────────────────────

let G = {
  round:            1,
  energyPool:       1,       // current round Energy allotment (both sides)
  playerSquad:      [],      // array of 5 live Blaster state objects
  botSquad:         [],
  playerEnergy:     0,       // squad shared Energy this round
  botEnergy:        0,
  actOrder:         [],      // [{ side, idx }] sorted by Speed for this round
  actOrderIndex:    0,       // pointer into actOrder
  locations:        [],      // 25 tile location objects
  playerPositions:  [],      // tile index per Blaster (player squad)
  botPositions:     [],
  selectedBlaster:  null,    // { side, idx } currently acting
  gameOver:         false,
  log:              [],
  matchStartTime:   Date.now(),
  playerDmgDealt:   0,
  botDmgDealt:      0,
  playerHealTotal:  0,
  botHealTotal:     0,
  consumableSlots:  CONSUMABLE_SLOTS_START,
  playerConsumables:[],
  botConsumables:   [],
  difficulty:       'medium',
};

// ── Action timer state ────────────────────────────────────────────────────────

let _actionTimerInterval = null;
let _actionTimeLeft      = 20;

// ── Endurance persistence ─────────────────────────────────────────────────────

function saveEndurance() {
  const data = {};
  [...G.playerSquad, ...G.botSquad].forEach(b => {
    data[b.id] = b.endurance;
  });
  try { localStorage.setItem('bb_endurance', JSON.stringify(data)); } catch(e) {}
}

function loadEndurance() {
  try {
    const raw = localStorage.getItem('bb_endurance');
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

// ── Squad builder helper ──────────────────────────────────────────────────────

/**
 * Converts a raw Blaster definition from BLASTER_POOL into a live match object.
 * Applies saved Endurance from localStorage.
 *
 * @param {object} blasterDef  — entry from BLASTER_POOL
 * @param {object} savedEndurance — { [id]: currentEndurance }
 * @returns {object} live Blaster state
 */
function makeLiveBlaster(blasterDef, savedEndurance) {
  const b = deepClone(blasterDef);
  b.hp          = b.health;
  b.maxHp       = b.health;
  b.energy      = 0;          // starts at 0 each match; filled by round allotment
  b.maxEnergy   = b.stamina;  // Stamina = Energy ceiling
  b.ko          = false;
  b.buffs       = [];         // active buffs: [{ effect, turnsLeft }]
  b.weapon      = null;       // equipped weapon (from WEAPON_POOL)
  b.armor       = [];         // equipped armor (up to 4 slots)
  b.gadget      = null;       // equipped gadget (from GADGET_POOL)
  b.abilityUsed = false;      // resets each round
  b.actedThisRound = false;
  // Restore persistent Endurance
  if (savedEndurance[b.id] !== undefined) {
    b.endurance = savedEndurance[b.id];
  }
  return b;
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Starts a new match.
 *
 * @param {{
 *   playerSquad: string[],   — array of 5 Blaster IDs chosen by the player
 *   difficulty: string,
 *   consumableSlots: number,
 *   playerConsumables: string[],  — consumable IDs
 * }} config
 */
function initGame(config) {
  document.getElementById('modal-overlay')?.classList.add('hidden');

  const saved = loadEndurance();

  // Build live squads
  const playerDefs = config.playerSquad.map(id => BLASTER_POOL.find(b => b.id === id));
  const botDefs    = _buildBotSquad(config.difficulty, playerDefs);

  // Drain Endurance on match start (meta-layer)
  playerDefs.forEach(def => {
    if (saved[def.id] !== undefined) saved[def.id] = Math.max(0, saved[def.id] - ENDURANCE_COST_PER_MATCH);
    else saved[def.id] = Math.max(0, def.endurance - ENDURANCE_COST_PER_MATCH);
  });

  const playerSquad = playerDefs.map(def => makeLiveBlaster(def, saved));
  const botSquad    = botDefs.map(def => makeLiveBlaster(def, {}));

  // Assign default weapons (first weapon in pool matching squad diversity)
  playerSquad.forEach((b, i) => { b.weapon = deepClone(WEAPON_POOL[i % WEAPON_POOL.length]); });
  botSquad.forEach((b, i)    => { b.weapon = deepClone(WEAPON_POOL[(i + 2) % WEAPON_POOL.length]); });

  // 5×5 grid — center always neutral
  const locs = shuffle(deepClone(LOCATION_POOL)).slice(0, 25);
  locs[12] = { id: 'lCenter', name: 'Central Ground', effect: 'neutral', effectDesc: 'No special effect', icon: '⬜', css: 'neutral' };

  // Starting positions: player squad top row (0–4), bot squad bottom row (20–24)
  const playerPositions = [0, 1, 2, 3, 4];
  const botPositions    = [20, 21, 22, 23, 24];

  G = {
    round:            1,
    energyPool:       1,
    playerSquad,
    botSquad,
    playerEnergy:     1,
    botEnergy:        1,
    playerEnergyBank: 0,   // carry token — banked from previous rounds
    botEnergyBank:    0,
    actOrder:         [],
    actOrderIndex:    0,
    locations:        locs,
    playerPositions,
    botPositions,
    selectedBlaster:  null,
    gameOver:         false,
    log:              [],
    matchStartTime:   Date.now(),
    playerDmgDealt:   0,
    botDmgDealt:      0,
    playerHealTotal:  0,
    botHealTotal:     0,
    consumableSlots:  config.consumableSlots || CONSUMABLE_SLOTS_START,
    playerConsumables: (config.playerConsumables || []).map(id => deepClone(CONSUMABLE_POOL.find(c => c.id === id))),
    botConsumables:   [],
    difficulty:       config.difficulty || 'medium',
  };

  saveEndurance();

  logMsg('system', `=== BLAST BATTLES — Round 1 [${G.difficulty.toUpperCase()}] ===`);
  logMsg('system', `Your squad: ${playerSquad.map(b => b.name).join(', ')}`);
  logMsg('system', `Bot squad:  ${botSquad.map(b => b.name).join(', ')}`);

  render();
  startRound();
}

// ── Bot squad builder ─────────────────────────────────────────────────────────

/**
 * Builds a bot squad of 5 Blasters scaled to difficulty.
 * easy:       random low-stat Blasters
 * medium:     random balanced Blasters opposite faction where possible
 * hard:       highest-stat Blasters available
 * impossible: mirrors player squad stat totals exactly
 */
function _buildBotSquad(difficulty, playerDefs) {
  const pool = deepClone(BLASTER_POOL);

  // Prefer opposite alignment
  const playerAlignments = new Set(playerDefs.map(b => b.alignment));
  const opposite = b =>
    (playerAlignments.has('hero')    && b.alignment === 'villain') ||
    (playerAlignments.has('villain') && b.alignment === 'hero')    ||
    b.alignment === 'neutral' || b.alignment === 'flex';

  const statTotal = b => b.speed + b.stamina + b.strength + b.health / 10 + b.endurance;

  let candidates;
  if (difficulty === 'easy') {
    candidates = pool.sort((a, b) => statTotal(a) - statTotal(b));
  } else if (difficulty === 'hard' || difficulty === 'impossible') {
    candidates = pool.sort((a, b) => statTotal(b) - statTotal(a));
  } else {
    candidates = shuffle(pool.filter(opposite));
    if (candidates.length < 5) candidates = shuffle(pool);
  }

  return candidates.slice(0, 5);
}

// ── Round management ──────────────────────────────────────────────────────────

/**
 * Begins a new round.
 * - Calculates Energy allotment (round number, cap 10)
 * - Distributes Energy to both squads
 * - Sorts act order by Speed (ties broken randomly)
 * - Kicks off the first Blaster's turn
 */
function startRound() {
  if (G.gameOver) return;

  // Energy allotment scales with round number, capped at 10
  // Banked Energy (carry token) is added on top of the fresh allotment
  G.energyPool   = Math.min(G.round, 10);
  G.playerEnergy = G.energyPool + (G.playerEnergyBank || 0);
  G.botEnergy    = G.energyPool + (G.botEnergyBank    || 0);
  // Clear the bank after distributing it
  G.playerEnergyBank = 0;
  G.botEnergyBank    = 0;

  // Reset per-round flags
  G.playerSquad.forEach(b => { b.actedThisRound = false; b.abilityUsed = false; });
  G.botSquad.forEach(b    => { b.actedThisRound = false; b.abilityUsed = false; });

  // Tick down buff durations
  [...G.playerSquad, ...G.botSquad].forEach(b => {
    b.buffs = b.buffs
      .map(buf => ({ ...buf, turnsLeft: buf.turnsLeft - 1 }))
      .filter(buf => buf.turnsLeft > 0);
  });

  logMsg('phase', `— Round ${G.round} — Energy: ${G.energyPool} —`);

  // Build act order: all non-KO'd Blasters sorted by Speed desc, ties shuffled
  const entries = [];
  G.playerSquad.forEach((b, i) => { if (!b.ko) entries.push({ side: 'player', idx: i, speed: b.speed }); });
  G.botSquad.forEach((b, i)    => { if (!b.ko) entries.push({ side: 'bot',    idx: i, speed: b.speed }); });

  // Shuffle first to randomise ties, then stable-sort by speed desc
  const shuffled = shuffle(entries);
  G.actOrder      = shuffled.sort((a, b) => b.speed - a.speed);
  G.actOrderIndex = 0;

  render();
  _nextTurn();
}

/**
 * Advances to the next Blaster in the act order.
 * Skips KO'd Blasters. When all have acted, advances the round.
 */
function _nextTurn() {
  if (G.gameOver) return;

  // Skip already-acted or KO'd slots
  while (G.actOrderIndex < G.actOrder.length) {
    const { side, idx } = G.actOrder[G.actOrderIndex];
    const squad = side === 'player' ? G.playerSquad : G.botSquad;
    if (!squad[idx].ko && !squad[idx].actedThisRound) break;
    G.actOrderIndex++;
  }

  if (G.actOrderIndex >= G.actOrder.length) {
    // All Blasters acted — end of round
    _endRound();
    return;
  }

  const { side, idx } = G.actOrder[G.actOrderIndex];
  startBlasterTurn(side, idx);
}

/**
 * Ends the current round, checks win condition, advances to next round.
 * Carries over exactly 1 unspent Energy per side into the bank (cap: ENERGY_BANK_CAP).
 * The bank is separate from the round allotment and displayed as a carry token in the UI.
 */
function _endRound() {
  checkWin();
  if (G.gameOver) return;

  // Bank 1 Energy per side if they have unspent Energy, up to ENERGY_BANK_CAP
  if (G.playerEnergy > 0) {
    G.playerEnergyBank = Math.min((G.playerEnergyBank || 0) + 1, ENERGY_BANK_CAP);
    logMsg('system', `You bank 1 Energy → stored: ${G.playerEnergyBank}/${ENERGY_BANK_CAP}`);
  }
  if (G.botEnergy > 0) {
    G.botEnergyBank = Math.min((G.botEnergyBank || 0) + 1, ENERGY_BANK_CAP);
  }

  if (G.round >= MAX_TURNS) {
    _resolveTiebreaker();
    return;
  }

  G.round++;
  startRound();
}

/**
 * Tiebreaker at round cap: most HP remaining + most Blasters alive wins.
 */
function _resolveTiebreaker() {
  const pAlive  = G.playerSquad.filter(b => !b.ko).length;
  const bAlive  = G.botSquad.filter(b => !b.ko).length;
  const pHp     = G.playerSquad.reduce((s, b) => s + b.hp, 0);
  const bHp     = G.botSquad.reduce((s, b) => s + b.hp, 0);
  const pScore  = pAlive * 1000 + pHp;
  const bScore  = bAlive * 1000 + bHp;
  if      (pScore > bScore) endGame('player');
  else if (bScore > pScore) endGame('bot');
  else                      endGame('draw');
}

// ── Blaster turn ──────────────────────────────────────────────────────────────

/**
 * Opens the action window for one Blaster.
 * Bot acts instantly; player gets a 20s timer.
 *
 * @param {'player'|'bot'} side
 * @param {number} idx  — index into playerSquad / botSquad
 */
function startBlasterTurn(side, idx) {
  if (G.gameOver) return;
  const squad  = side === 'player' ? G.playerSquad : G.botSquad;
  const b      = squad[idx];
  G.selectedBlaster = { side, idx };

  // Check Energy lockout
  const locked = _isEnergyLocked(side, b);

  logMsg(side, `${b.name}'s turn. Energy available: ${side === 'player' ? G.playerEnergy : G.botEnergy}${locked ? ' [LOCKED — low energy]' : ''}`);

  if (side === 'bot') {
    _botAct(idx, locked);
    endBlasterTurn('bot');
    return;
  }

  // Player turn — start action timer
  if (locked) {
    logMsg('system', `${b.name} is energy-locked — skipping turn.`);
    endBlasterTurn('player');
    return;
  }

  render();
  _startActionTimer();
}

/**
 * Returns true if a Blaster is below the energy lockout threshold.
 * Lockout is based on the *squad* shared energy vs the Blaster's stamina.
 *
 * @param {'player'|'bot'} side
 * @param {object} blaster
 * @returns {boolean}
 */
function _isEnergyLocked(side, blaster) {
  const squadEnergy = side === 'player' ? G.playerEnergy : G.botEnergy;
  return squadEnergy < blaster.stamina * ENERGY_LOCKOUT_THRESHOLD;
}

/**
 * Marks the current Blaster as having acted and advances the turn order.
 * @param {'player'|'bot'} side
 */
function endBlasterTurn(side) {
  clearActionTimer();
  const { idx } = G.selectedBlaster || {};
  if (idx !== undefined) {
    const squad = side === 'player' ? G.playerSquad : G.botSquad;
    if (squad[idx]) squad[idx].actedThisRound = true;
  }
  G.selectedBlaster = null;
  G.actOrderIndex++;
  checkWin();
  if (!G.gameOver) {
    render();
    setTimeout(_nextTurn, 400);
  }
}

// ── Energy spending ───────────────────────────────────────────────────────────

/**
 * Attempts to spend Energy from the squad pool.
 * Returns false (and logs a warning) if there isn't enough.
 *
 * @param {'player'|'bot'} side
 * @param {number} amount
 * @returns {boolean}
 */
function spendEnergy(side, amount) {
  if (side === 'player') {
    if (G.playerEnergy < amount) {
      logMsg('system', `Not enough Energy — need ${amount}, have ${G.playerEnergy}.`);
      return false;
    }
    G.playerEnergy -= amount;
  } else {
    if (G.botEnergy < amount) return false;
    G.botEnergy -= amount;
  }
  return true;
}

// ── Action timer ──────────────────────────────────────────────────────────────

function _startActionTimer() {
  _actionTimeLeft = 20;
  _updateTimerDisplay();
  _actionTimerInterval = setInterval(() => {
    _actionTimeLeft--;
    _updateTimerDisplay();
    if (_actionTimeLeft <= 0) {
      clearActionTimer();
      logMsg('system', '⏱ Time up — turn skipped.');
      endBlasterTurn('player');
    }
  }, 1000);
}

function clearActionTimer() {
  if (_actionTimerInterval) { clearInterval(_actionTimerInterval); _actionTimerInterval = null; }
  _actionTimeLeft = 0;
}

function _updateTimerDisplay() {
  const el = document.getElementById('action-timer');
  if (!el) return;
  el.textContent = `⏱ ${_actionTimeLeft}s`;
  el.style.color = _actionTimeLeft <= 5  ? 'var(--accent2)'
    : _actionTimeLeft <= 10 ? 'var(--medium)'
    : 'var(--muted)';
}

// ── Bot AI (placeholder — expanded in ai-bot.js) ─────────────────────────────

/**
 * Simple bot action. ai-bot.js will override this with full heuristics.
 * @param {number} idx
 * @param {boolean} locked
 */
function _botAct(idx, locked) {
  if (locked) { logMsg('bot', `${G.botSquad[idx].name} is energy-locked.`); return; }
  const b = G.botSquad[idx];
  if (!b.weapon || G.botEnergy < b.weapon.energyCost) {
    logMsg('bot', `${b.name} holds position.`);
    return;
  }
  // Find a valid target (first non-KO'd player Blaster)
  const targetIdx = G.playerSquad.findIndex(p => !p.ko);
  if (targetIdx === -1) return;
  const target = G.playerSquad[targetIdx];
  const dist   = getDistance(G.botPositions[idx], G.playerPositions[targetIdx]);
  if (dist > b.weapon.range) { logMsg('bot', `${b.name} is out of range — holds position.`); return; }
  if (!spendEnergy('bot', b.weapon.energyCost)) return;
  // Basic damage: weapon.damage × (strength / 5) — tuned in combat.js later
  const dmg = Math.round(b.weapon.damage * (b.strength / 5));
  target.hp  = Math.max(0, target.hp - dmg);
  if (target.hp <= 0) target.ko = true;
  G.botDmgDealt += dmg;
  logMsg('bot', `${b.name} fires ${b.weapon.name} → ${dmg} dmg to ${target.name}.`);
}

// ── Win condition ─────────────────────────────────────────────────────────────

function checkWin() {
  if (G.gameOver) return;
  const pAlive = G.playerSquad.some(b => !b.ko);
  const bAlive = G.botSquad.some(b => !b.ko);
  if (!pAlive) { endGame('bot');    return; }
  if (!bAlive) { endGame('player'); return; }
}

// ── End game ──────────────────────────────────────────────────────────────────

function endGame(winner) {
  G.gameOver = true;
  saveEndurance();
  clearActionTimer();

  const elapsed = Math.round((Date.now() - G.matchStartTime) / 1000);
  const mins    = Math.floor(elapsed / 60);
  const secs    = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const titles  = { player: '🏆 VICTORY!', bot: '💀 DEFEATED', draw: '🤝 DRAW' };
  const msgs    = {
    player: `You defeated the enemy squad in ${timeStr}!`,
    bot:    `Your squad was eliminated in ${timeStr}.`,
    draw:   `Both squads fought to a standstill — ${timeStr}.`,
  };

  document.getElementById('modal-title').textContent = titles[winner] || '—';
  document.getElementById('modal-msg').textContent   = msgs[winner]   || '';
  document.getElementById('modal-overlay')?.classList.remove('hidden');
  logMsg('system', `=== ${titles[winner]} === ${msgs[winner]}`);
}

// ── Logging ───────────────────────────────────────────────────────────────────

function logMsg(type, text) {
  if (!G.log) G.log = [];
  G.log.push({ type, text });

  // ── Dual play-by-play routing ──────────────────────────
  const _appendDualLog = (id, t, ty) => {
    const el = document.getElementById(id);
    if (!el) return;
    const div = document.createElement('div');
    div.className   = `bb-log-entry ${ty}`;
    div.textContent = t;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  };

  if (type === 'player') {
    _appendDualLog('bb-log-player', text, type);
  } else if (type === 'bot') {
    _appendDualLog('bb-log-bot', text, type);
  } else if (type === 'damage') {
    const toBot = G.botSquad && G.botSquad.some(b => text.includes(b.name));
    _appendDualLog(toBot ? 'bb-log-bot' : 'bb-log-player', text, type);
  } else if (type === 'heal') {
    const toBot = G.botSquad && G.botSquad.some(b => text.includes(b.name));
    _appendDualLog(toBot ? 'bb-log-bot' : 'bb-log-player', text, type);
  } else {
    // system / phase → both logs
    _appendDualLog('bb-log-player', text, type);
    _appendDualLog('bb-log-bot',    text, type);
  }
}
