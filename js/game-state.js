/**
 * game-state.js — Blast Battles game state management & phase engine
 * Dependencies (must load first): data.js, utils.js, grid.js, combat.js
 * Reads/writes the global `G` object.
 * Calls: render() (render.js), updateHint() (render.js),
 *        botMoveSmart() (ai-bot.js), botPlayPhase() (ai-bot.js),
 *        impossibleBotPlayPhase() (ai-bot.js), loadOnnxModel() (ai-bot.js)
 *
 * Exports (browser globals):
 *   startWithDifficulty(diff)
 *   initGame()
 *   startPhase()
 *   advancePhase()
 *   checkPhaseComplete()
 *   skipPhase()
 *   clearPhaseTimer()
 *   startPhaseTimer()
 *   updateTimerDisplay()
 *   getPhaseSpeed()
 *   updatePhaseSpeed(val)
 *   hasAnyPlayableCard()
 *   playerPlayCard(card)
 *   playerPlaySelectedCard()
 *   toggleLog()
 *   logMsg(type, text)
 *   _selectedCharId   (mutable — set by char-select.js)
 */

'use strict';

// ── Mutable globals ──────────────────────────────────────────────────────────
/** G is the live game state object. It gets reset each match; see initGame() for structure*/
let G = {};

/** Set by char-select.js when the player confirms their character. */
let _selectedCharId = null;

/** Phase timer state */
const PHASE_DURATIONS = { fast: 15, medium: 15, slow: 15, charged: 15 };
let _phaseTimerInterval = null;
let _phaseTimeLeft = 15;
let _autoCheckTimeout = null;

// ── Difficulty entry point ────────────────────────────────────────────────────

/**
 * Called when the player selects a difficulty on the overlay.
 * Loads the ONNX model for 'impossible' difficulty, then starts the game.
 *
 * @param {'easy'|'medium'|'hard'|'impossible'} diff
 */
async function startWithDifficulty(diff) {
  G.difficulty = diff;
  document.getElementById('difficulty-overlay').classList.add('hidden');
  if (diff === 'impossible') await loadOnnxModel();
  initGame();
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Resets all game state and starts a new match.
 * Called on first load (after char select) and on rematch.
 */
function initGame() {
  document.getElementById('modal-overlay').classList.add('hidden');

  // Reset phase speed slider to 1×
  const slider = document.getElementById('phase-speed-slider');
  if (slider) { slider.value = 1; updatePhaseSpeed(1); }

  // Fresh shuffled decks
  const weaponDeck = shuffle(deepClone(WEAPON_POOL));
  const defenseDeck = shuffle(deepClone(DEFENSE_POOL));
  const charPool = shuffle(deepClone(CHARACTER_POOL));

  // Use player's selected character; bot gets a random from the opposite faction —
  // UNLESS a Bestiary Challenge picked a specific locked character to fight (see
  // char-select.js showOpponentSelect()/selectOpponent()), in which case that exact character is forced.
  const selectedChar = CHARACTER_POOL.find(c => c.id === _selectedCharId);
  if (!selectedChar && !charPool[0]) {
    console.error('No characters available in pool. Check CHARACTER_POOL is populated.');
    return;
  }
  const playerChar = deepClone(selectedChar || charPool[0]);
  const oppFaction = playerChar.faction === 'hero' ? 'villain' : 'hero';
  const botCandidates = charPool.filter(c => c.faction === oppFaction && c.id !== playerChar.id);
  const challengeTarget = (typeof _challengeTargetCharId !== 'undefined' && _challengeTargetCharId)
    ? CHARACTER_POOL.find(c => c.id === _challengeTargetCharId)
    : null;
  const botChar = deepClone(challengeTarget || botCandidates[0] || charPool.find(c => c.id !== playerChar.id));
  _challengeTargetCharId = null; // one-shot — consumed

  // The Shadow: mirrors the opponent's attribute, speed, and HP
  function applyShadowMirror(shadow, mirror) {
    shadow.attribute = mirror.attribute;
    shadow.speed = mirror.speed;
    shadow.hp = mirror.maxHp;
    shadow.maxHp = mirror.maxHp;
    shadow.name = `Dark ${mirror.name}`;
    const parts = mirror.attrDesc.split(' · ');
    shadow.attrDesc = `Same HP & ${parts[0]}` + (parts[1] ? ` · Always acts after bot` : ' · Always acts after bot');
  }
  if (botChar.attribute === 'shadow_clone') applyShadowMirror(botChar, playerChar);
  if (playerChar.attribute === 'shadow_clone') applyShadowMirror(playerChar, botChar);

  // Starter hand — 1 thematic weapon + 1 defense card (or 2nd weapon for Pete/Tracy)
  function starterDeck(char, wDeck, dDeck) {
    const attr = char.attribute;
    const subtypeMap = {
      dual_wield: 'pistol',
      deadeye: 'revolver',
      pistol_specialist: 'pistol',
      revolver_specialist: 'revolver',
      shotgun_specialist: 'shotgun',
      rifle_specialist: 'assault_rifle',
      sniper_specialist: 'sniper',
      melee_specialist: 'melee',
      swift_melee: 'melee',
      explosive_specialist: 'explosive',
    };
    const preferredSubtype = subtypeMap[attr];

    let weapon = null;
    if (preferredSubtype) {
      const idx = wDeck.findIndex(c => c.subtype === preferredSubtype);
      if (idx !== -1) weapon = wDeck.splice(idx, 1)[0];
    }
    if (!weapon) {
      const fallbackSubtype = attr === 'swift_melee' ? 'melee'
        : ['swift', 'extra_carry'].includes(attr) ? 'pistol'
          : 'assault_rifle';
      const idx = wDeck.findIndex(c => c.subtype === fallbackSubtype);
      weapon = idx !== -1 ? wDeck.splice(idx, 1)[0] : wDeck.shift();
    }

    let defense = null;
    if (attr === 'extra_carry' || attr === 'dual_wield') {
      if (attr === 'dual_wield') {
        // Pistol Pete: clone his first pistol for the paired slot
        const clone = deepClone(weapon);
        clone.id = clone.id + '_clone_' + Math.random().toString(36).slice(2, 7);
        const pairId = 'dwpair_' + Math.random().toString(36).slice(2, 9);
        weapon.dualWieldPairId = pairId;
        clone.dualWieldPairId = pairId;
        defense = clone;
      } else {
        defense = wDeck.length > 0 ? deepClone(wDeck.shift()) : null;
      }
    } else {
      const defSubtypeMap = {
        healing: 'syringe',
        heavy_armor: 'plate_armor',
        sniper_resist: 'plate_armor',
        run_and_gun: 'helmet',
      };
      const preferredDef = defSubtypeMap[attr];
      if (preferredDef) {
        const idx = dDeck.findIndex(c => c.subtype === preferredDef);
        if (idx !== -1) defense = dDeck.splice(idx, 1)[0];
      }
      if (!defense) defense = dDeck.shift();
    }
    return [weapon, defense].map(c => {
      const clone = deepClone(c);
      if (clone && clone.type === 'weapon' && clone.ammo !== undefined) clone._maxAmmo = clone.ammo;
      return clone;
    });
  }

  // Player's starting hand + passive gear — from the Equip screen loadout if one
  // was made, otherwise fall back to the old random starterDeck (e.g. quick-play).
  const hasLoadout = typeof PlayerLoadout !== 'undefined' && (PlayerLoadout.hand1 || PlayerLoadout.hand2);
  const cloneLoadoutItem = id => {
    const c = deepClone(ALL_EQUIPPABLE.find(i => i.id === id));
    if (c.maxDurability) c.durability = c.maxDurability;
    if (c.ammo !== undefined) c._maxAmmo = c.ammo;
    c.id = c.id + '_eq_' + Math.random().toString(36).slice(2, 7); // guarantee uniqueness (dupes possible across slots)
    return c;
  };
  let playerHand, playerLoadoutGear;
  if (hasLoadout) {
    playerHand = ['hand1', 'hand2'].map(s => PlayerLoadout[s]).filter(Boolean).map(cloneLoadoutItem);
    playerLoadoutGear = ['head', 'chest', 'legs', 'feet', 'armL', 'armR'].map(s => PlayerLoadout[s]).filter(Boolean).map(cloneLoadoutItem);

    // Pistol Pete: the dual-wield "fire your second pistol free" mechanic is driven
    // entirely by a shared dualWieldPairId — starterDeck() used to set this up, but
    // the Equip screen never did, so loadout-built hands need it wired up here too.
    if (playerChar.attribute === 'dual_wield') {
      const pairable = playerHand.filter(c => c.type === 'weapon' && (c.subtype === 'pistol' || c.subtype === 'revolver'));
      if (pairable.length >= 2) {
        const pairId = 'dwpair_' + Math.random().toString(36).slice(2, 9);
        pairable[0].dualWieldPairId = pairId;
        pairable[1].dualWieldPairId = pairId;
      }
    }
  } else {
    playerHand = starterDeck(playerChar, weaponDeck, defenseDeck);
    playerLoadoutGear = [];
  }
  const botHand = starterDeck(botChar, weaponDeck, defenseDeck);

  // 7×7 grid — center tile always neutral
  const locs = shuffle(deepClone(LOCATION_POOL)).slice(0, 49);
  locs[24] = deepClone({
    id: 'lCenter', name: 'Central Ground', effect: 'neutral',
    effectDesc: 'No special effect', icon: '⬜', css: 'neutral'
  });

  // Reset G — player starts top-left (0), bot starts bottom-right (48)
  G = {
    turn: 1,
    phase: 0,
    difficulty: G.difficulty || 'medium',
    playerChar: deepClone(playerChar),
    botChar: deepClone(botChar),
    playerHand,
    botHand,
    playerInPlay: playerLoadoutGear,
    botInPlay: [],
    playerPos: 0,
    botPos: 48,
    revealedTiles: new Set([0]),
    locations: locs,
    weaponDeck,
    defenseDeck,
    selectedCard: null,
    playerActedThisPhase: false,
    botActedThisPhase: false,
    awaitingMove: false,
    awaitingScrapChoice: false,
    playerMovedThisPhase: false,
    xrayUsedThisPhase: false,
    radarPingActive: false,
    dualWieldFiredIds: new Set(),
    playerToxicTurns: 0,
    botToxicTurns: 0,
    gameOver: false,
    log: [],
    botRevealedCard: null,
    playerDmgDealt: 0,
    botDmgDealt: 0,
    playerHealTotal: 0,
    botHealTotal: 0,
    lastKillingBlow: null,
    matchStartTime: Date.now(),
  };

  logMsg('system', `=== BLAST BATTLES — Turn 1 [${G.difficulty.toUpperCase()}] ===`);
  logMsg('system', `You select: ${G.playerChar.name} (${G.playerChar.faction}) | Bot selects: ${G.botChar.name} (${G.botChar.faction})`);
  logMsg('system', `You start at ${G.locations[G.playerPos].name} (top-left). Bot starts at ${G.locations[G.botPos].name} (bottom-right).`);
  if (playerLoadoutGear.length > 0) {
    logMsg('system', `Equipped: ${playerLoadoutGear.map(g => `${g.icon} ${g.name}`).join(', ')}`);
  }
  if (G.botChar.name.startsWith('Dark ')) {
    logMsg('system', `🥷 ${G.botChar.name} has mirrored ${G.playerChar.name} — same ability, same weakness!`);
  } else if (G.playerChar.name.startsWith('Dark ')) {
    logMsg('system', `🥷 You play as ${G.playerChar.name} — mirroring ${G.botChar.name}'s ability and weakness!`);
  }

  render();
  BB_Audio.startGameplay(G.playerChar.id);
  startPhase();
}

// ── Phase management ──────────────────────────────────────────────────────────

/**
 * Starts the current phase (G.phase / G.turn are already set).
 * - Resets per-phase flags
 * - Applies location effects
 * - Determines who acts first (by speed)
 * - Launches the bot if it goes first
 * - Starts the auto-skip timer
 */
function startPhase() {
  G.playerActedThisPhase = false;
  G.botActedThisPhase = false;
  G.selectedCard = null;
  G.awaitingMove = false;
  G.awaitingScrapChoice = false;
  G.playerMovedThisPhase = false;
  G.xrayUsedThisPhase = false;
  G.dualWieldFiredIds = new Set();
  clearPhaseTimer();

  const phase = PHASES[G.phase];
  logMsg('phase', `— ${phase.toUpperCase()} PHASE — (move OR play a card)`);

  // Location effects — damage/heal every phase; card draws on medium/charged
  const isFirstPhase = G.turn === 1 && G.phase === 0;
  const isCardDrawPhase = phase === 'medium' || phase === 'charged';
  if (!isFirstPhase) applyLocationEffects(isCardDrawPhase);
  checkWin();
  if (G.gameOver) return;

  // ── Movement gating by character attribute ─────────────────────────────────
  const isTitanPlayer = G.playerChar.attribute === 'heavy_armor';        // Charged only
  const isSamPlayer = G.playerChar.attribute === 'shotgun_specialist'; // Slow & Charged
  const isHuntressPlayer = G.playerChar.attribute === 'sniper_specialist';  // Fast & Medium
  const isTankPlayer = G.playerChar.attribute === 'explosive_specialist'; // Not Fast

  const heavyMoveOk = !isTitanPlayer || phase === 'charged';
  const samMoveOk = !isSamPlayer || phase === 'slow' || phase === 'charged';
  const huntressMoveOk = !isHuntressPlayer || phase === 'fast' || phase === 'medium';
  const tankMoveOk = !isTankPlayer || phase !== 'fast';

  if (!heavyMoveOk) {
    G.awaitingMove = false;
    logMsg('system', `⚙️ ${G.playerChar.name}'s heavy armor restricts movement to Charged phase only.`);
  } else if (!samMoveOk) {
    G.awaitingMove = false;
    logMsg('system', `⚙️ ${G.playerChar.name} can only move during Slow & Charged phases.`);
  } else if (!huntressMoveOk) {
    G.awaitingMove = false;
    logMsg('system', `🎯 ${G.playerChar.name} holds position — can only move on Fast & Medium phases.`);
  } else if (!tankMoveOk) {
    // Hank the Tank — fully locked during Fast phase
    G.awaitingMove = false;
    G.playerActedThisPhase = true;
    G.botActedThisPhase = true;
    G.playerAutoSkippedPhase = true;
    logMsg('system', `💣 ${G.playerChar.name} is too slow to act during the Fast phase. Holding position...`);
    setTimeout(() => checkPhaseComplete(), 400);
  } else {
    G.awaitingMove = true;
  }

  // ── Speed-based turn order ─────────────────────────────────────────────────
  // The Shadow always follows — never acts before the bot
  const isShadowPlayer = G.playerChar.name.startsWith('Dark ') || G.playerChar.name === 'The Shadow';
  const effPlayerSpd = getEffectiveSpeed(G.playerChar, G.playerHand, G.playerInPlay);
  const effBotSpd = getEffectiveSpeed(G.botChar, G.botHand, G.botInPlay);
  const playerFirst = isShadowPlayer ? false
    : effPlayerSpd > effBotSpd ? true
      : effBotSpd > effPlayerSpd ? false
        : Math.random() < 0.5;

  if (!playerFirst) {
    setTimeout(() => {
      if (G.difficulty === 'impossible') {
        botMoveSmart(); impossibleBotPlayPhase(); G.botActedThisPhase = true;
        render(); checkWin();
        if (!G.gameOver) { render(); updateHint(); checkForDeadTurn(); }
      } else {
        botMoveSmart(); botPlayPhase();
        G.botActedThisPhase = true;
        render(); checkWin();
        if (!G.gameOver) { render(); updateHint(); checkForDeadTurn(); }
      }
    }, 500);
    startPhaseTimer();
  } else {
    render();
    updateHint();
    // If the player has literally no legal action this phase (movement locked AND
    // no playable card), skip instantly instead of burning the full phase timer.
    if (!checkForDeadTurn()) startPhaseTimer();
  }
}

/**
 * Detects a "dead turn" — the player has no legal action available this phase
 * (movement is locked by their attribute AND no card in hand/in-play is playable).
 * If so, auto-skips immediately with a log message instead of waiting on the timer.
 * Distance/position can change if the bot moves first, so this is checked both
 * right after startPhase() sets up movement gating and again after the bot acts.
 *
 * @returns {boolean} true if a dead turn was detected and auto-skipped
 */
function checkForDeadTurn() {
  if (G.gameOver) return false;
  if (G.playerActedThisPhase) return false;
  if (G.awaitingScrapChoice) return false;
  if (G.awaitingMove) return false;
  if (hasAnyPlayableCard()) return false;

  clearPhaseTimer();
  logMsg('system', `${G.playerChar.name} has no playable action this phase — auto-skipping.`);
  G.playerActedThisPhase = true;
  render();
  checkPhaseComplete();
  return true;
}

/**
 * Advances to the next phase (or next turn).
 * Applies Sprinting Sue's extra Fast-phase move if applicable.
 * Resets per-phase flags and calls startPhase().
 */
function advancePhase() {
  G.phase++;
  if (G.phase >= PHASES.length) {
    G.phase = 0;
    G.turn++;
    logMsg('system', `=== Turn ${G.turn} ===`);
  }
  // Sprinting Sue: on Fast phase she may move an extra space
  if (G.phase === 0 && G.playerChar.attribute === 'swift') {
    G.playerMovedThisPhase = false; // fresh flag for the bonus move
  }
  startPhase();
}

/**
 * Checks whether both sides have finished their actions.
 * If the bot hasn't acted yet, triggers its turn now (it goes second).
 * Once both have acted, advances the phase.
 *
 * Bot acting after the player is the "player-first" flow; the bot acting
 * before the player is handled inside startPhase().
 */
function checkPhaseComplete() {
  if (G.gameOver) return;

  // If the bot hasn't acted yet, trigger its turn now
  if (!G.botActedThisPhase) {
    setTimeout(() => {
      if (G.difficulty === 'impossible') {
        botMoveSmart(); impossibleBotPlayPhase(); G.botActedThisPhase = true;
        render(); checkWin();
        if (!G.gameOver) { render(); updateHint(); advancePhase(); }
      } else {
        botMoveSmart(); botPlayPhase();
        G.botActedThisPhase = true;
        render(); checkWin();
        if (!G.gameOver) { render(); updateHint(); advancePhase(); }
      }
    }, 500);
    return;
  }

  // Both acted — move forward
  advancePhase();
}

/**
 * Skips the player's action for the current phase (called by the timer
 * or when the player clicks END TURN without acting).
 * Marks the player as having acted, then calls checkPhaseComplete.
 */
function skipPhase() {
  if (G.gameOver) return;
  G.playerActedThisPhase = true;
  G.awaitingMove = false;
  G.awaitingScrapChoice = false;
  render();
  checkPhaseComplete();
}

// ── Phase timer ───────────────────────────────────────────────────────────────

/** Stops any running phase timer intervals/timeouts. */
function clearPhaseTimer() {
  if (_phaseTimerInterval) { clearInterval(_phaseTimerInterval); _phaseTimerInterval = null; }
  if (_autoCheckTimeout) { clearTimeout(_autoCheckTimeout); _autoCheckTimeout = null; }
  _phaseTimeLeft = 0;
}

/** Returns the current phase speed multiplier (1–5) from the slider. */
function getPhaseSpeed() {
  const slider = document.getElementById('phase-speed-slider');
  return slider ? parseInt(slider.value) : 1;
}

/**
 * Updates the phase-speed slider label and fill gradient.
 * @param {number} val - Speed multiplier (1–5)
 */
function updatePhaseSpeed(val) {
  const label = document.getElementById('phase-speed-label');
  if (label) label.textContent = `${val}x`;
  const slider = document.getElementById('phase-speed-slider');
  if (slider) {
    const pct = ((val - 1) / 4) * 100;
    slider.style.setProperty('background',
      `linear-gradient(to right, var(--accent) ${pct}%, var(--border) ${pct}%)`);
  }
}

/** Returns true if the player has at least one legally playable card this phase. */
function hasAnyPlayableCard() {
  const allCards = [
    ...G.playerHand,
    ...G.playerInPlay.filter(c => c.type === 'weapon'),
  ];
  return allCards.some(c => isCardPlayable(c));
}

/**
 * Starts the countdown timer for the current phase.
 * At speed 1: 15 s.  At speed 5: 3 s.  Timer always reaches 0.
 *
 * Auto-skip behaviour at 0:
 *   • Player already acted → checkPhaseComplete
 *   • Pete fired first shot only → log miss, mark acted, checkPhaseComplete
 *   • speed > 1 and no playable cards → log wait, skipPhase
 *   • otherwise → log "Time up!", skipPhase
 */
function startPhaseTimer() {
  const speed = getPhaseSpeed();
  const totalSecs = Math.ceil(15 / speed);
  _phaseTimeLeft = totalSecs;
  updateTimerDisplay();

  if (_autoCheckTimeout) clearTimeout(_autoCheckTimeout);

  _phaseTimerInterval = setInterval(() => {
    _phaseTimeLeft--;
    updateTimerDisplay();
    if (_phaseTimeLeft <= 0) {
      clearPhaseTimer();
      if (G.gameOver) return;

      if (G.playerActedThisPhase) {
        checkPhaseComplete();
      } else if (G.dualWieldFiredIds && G.dualWieldFiredIds.size > 0) {
        // Pete fired first shot but ran out of time before the second
        logMsg('system', '⏱ Time up! Second shot missed.');
        G.playerActedThisPhase = true;
        checkPhaseComplete();
        render();
      } else if (speed > 1 && !hasAnyPlayableCard()) {
        logMsg('system', `${G.playerChar.name} waits patiently for ${G.botChar.name}'s next play.`);
        skipPhase();
      } else {
        logMsg('system', '⏱ Time up!');
        skipPhase();
      }
    }
  }, 1000);
}

/** Updates the on-screen phase timer display (colour changes as time runs low). */
function updateTimerDisplay() {
  const el = document.getElementById('phase-timer');
  if (!el) return;
  el.textContent = `⏱ ${_phaseTimeLeft}s`;
  el.style.color = _phaseTimeLeft <= 5 ? 'var(--accent2)'
    : _phaseTimeLeft <= 10 ? 'var(--medium)'
      : 'var(--muted)';
}

// ── Card play (player) ────────────────────────────────────────────────────────

/**
 * Executes the player's chosen card action (fire weapon or equip/use defense).
 * Validates all restrictions, applies damage/heal, updates ammo/durability,
 * handles Dual Wield's two-shot mechanic, then calls checkPhaseComplete.
 *
 * @param {{ type: string, subtype?: string, speed?: string, ammo?: number,
 *           healAmount?: number, defense?: number, durability?: number,
 *           dualWieldPairId?: string, range?: number }} card
 */
function playerPlayCard(card) {
  const isPairedCard = G.playerChar.attribute === 'dual_wield' && card.dualWieldPairId != null;
  const thisCardFired = isPairedCard && G.dualWieldFiredIds.has(card.id);
  if (thisCardFired) { logMsg('system', 'That pistol already fired this phase.'); return; }
  if (!isPairedCard && G.playerActedThisPhase) { logMsg('system', 'You already acted this phase.'); return; }
  if (G.gameOver) return;
  if (G.awaitingScrapChoice) { logMsg('system', 'You must choose a card to scrap first.'); return; }

  const phase = PHASES[G.phase];

  // ── Weapon ─────────────────────────────────────────────────────────────────
  if (card.type === 'weapon') {
    if (!isWeaponSpeedReady(card, phase, G.playerChar.attribute)) {
      logMsg('system', `${card.name} (${card.speed}) isn't ready yet — it becomes playable from the ${card.speed} phase onward.`); return;
    }
    // Subtype restrictions
    if (G.playerChar.attribute === 'dual_wield' && card.subtype !== 'pistol' && card.subtype !== 'revolver') { logMsg('system', `${G.playerChar.name} can only fire pistols or revolvers — ${card.name} is locked.`); return; }
    if (G.playerChar.attribute === 'deadeye' && card.subtype !== 'revolver' && card.subtype !== 'pistol') { logMsg('system', `${G.playerChar.name} uses revolvers & pistols only — ${card.name} is locked.`); return; }
    if (G.playerChar.attribute === 'pistol_specialist' && card.subtype !== 'pistol') { logMsg('system', `${G.playerChar.name} can only fire pistols — ${card.name} is locked.`); return; }
    if (G.playerChar.attribute === 'revolver_specialist' && card.subtype !== 'revolver') { logMsg('system', `${G.playerChar.name} can only fire revolvers — ${card.name} is locked.`); return; }
    if (G.playerChar.attribute === 'swift_melee' && card.subtype !== 'melee') { logMsg('system', `${G.playerChar.name} can only use melee weapons — ${card.name} is locked.`); return; }
    if (G.playerChar.attribute === 'rifle_specialist' && card.subtype !== 'assault_rifle' && card.subtype !== 'sniper') { logMsg('system', `${G.playerChar.name} uses rifles only — ${card.name} is locked.`); return; }
    if (G.playerChar.attribute === 'run_and_gun' && !G.playerMovedThisPhase) { logMsg('system', `${G.playerChar.name} must move before attacking — Run AND Gun!`); return; }

    const dist = getDistance(G.playerPos, G.botPos);
    if (card.subtype === 'melee' && dist !== 0) { logMsg('system', `${card.name} is melee — move adjacent (range 0) to use it.`); return; }
    if (card.subtype !== 'melee' && dist > card.range) { logMsg('system', `${card.name} has max range ${card.range} — you are ${dist} space(s) away.`); return; }

    // Move weapon from hand to inPlay if needed
    if (G.playerHand.find(c => c.id === card.id)) {
      G.playerHand = G.playerHand.filter(c => c.id !== card.id);
      G.playerInPlay.push(card);
    }

    let dmg = card.damage;
    dmg = applyRangeMultiplier(dmg, card, dist);
    dmg = applyPlayerWeaponBuff(dmg, card);
    dmg = applyLocationDamageBuff(dmg, G.playerChar, G.playerPos, card);
    const result = applyBotArmor(dmg, card);

    // Agent Ace (as bot): 50% dodge vs non-explosive, non-melee
    const aceCanDodge = G.botChar.attribute === 'dodge_bullets'
      && card.subtype !== 'explosive' && card.subtype !== 'missile' && card.subtype !== 'melee';
    if (aceCanDodge && Math.random() < 0.50) {
      const missSplash = getMissSplashDamage(result.finalDmg);
      G.botChar.hp = Math.max(0, G.botChar.hp - missSplash);
      G.playerDmgDealt += missSplash;
      logMsg('bot', `♠️ Agent Ace dodges the direct hit from ${card.name} — but takes ${missSplash} splash dmg from the near-miss!`);
    } else {
      G.botChar.hp = Math.max(0, G.botChar.hp - result.finalDmg);
      G.playerDmgDealt += result.finalDmg;
      const rangePct = card.subtype === 'melee'
        ? '(melee)'
        : `(${dist}/${card.range} rng — ${Math.round(getRangeMultiplier(card, dist) * 100)}% dmg)`;
      logMsg('player', `You fire ${card.name} → ${result.finalDmg} dmg ${rangePct}${result.armorNote}.`);

      // Explosive/missile splash — anyone within 1 tile of the target's tile,
      // including the attacker on a close-range throw, takes 50% splash dmg.
      if (card.subtype === 'explosive' || card.subtype === 'missile') {
        const selfSplash = getExplosiveSplashDamage(result.finalDmg, dist);
        if (selfSplash > 0) {
          G.playerChar.hp = Math.max(0, G.playerChar.hp - selfSplash);
          logMsg('player', `💥 ${card.name} catches ${G.playerChar.name} in the blast radius — ${selfSplash} splash dmg!`);
        }
      }
    }

    card.ammo--;
    if (card.ammo <= 0) {
      G.playerInPlay = G.playerInPlay.filter(c => c.id !== card.id);
      logMsg('system', `${card.name} is out of ammo and discarded.`);
    }

    // Dual Wield: track first shot; return early if partner card still unfired
    if (isPairedCard) {
      G.dualWieldFiredIds.add(card.id);
      const allPaired = [...G.playerHand, ...G.playerInPlay]
        .filter(c => c.dualWieldPairId === card.dualWieldPairId && c.id !== card.id);
      const partnerUnfired = allPaired.some(c => !G.dualWieldFiredIds.has(c.id));
      if (partnerUnfired) {
        G.selectedCard = null;
        logMsg('player', `🔫 Dual Wield! Fire your second pistol!`);
        checkWin();
        if (!G.gameOver) render();
        return;
      }
    }

    G.playerActedThisPhase = true;
    G.selectedCard = null;
    checkWin();
    if (!G.gameOver) checkPhaseComplete();
    render();

    // ── Defense / Heal ──────────────────────────────────────────────────────────
  } else if (card.type === 'defense') {
    if (G.playerChar.attribute === 'extra_carry') { logMsg('system', `Tracy Guns carries only weapons — defense cards are locked.`); return; }
    // Pete (dual_wield): both hands are full of pistols, so armor is locked — but a
    // med kit doesn't need a free hand, so healing items are allowed.
    if (G.playerChar.attribute === 'dual_wield' && card.healAmount === 0) { logMsg('system', `Pistol Pete's hands are full — armor is locked (healing items are still OK).`); return; }

    if (card.healAmount > 0) {
      // Healing item
      if (G.playerChar.hp >= G.playerChar.maxHp) { logMsg('system', `You are already at full health — ${card.name} cannot be used.`); return; }
      const healAmt = G.playerChar.attribute === 'healing'
        ? Math.ceil(card.healAmount * 1.4)
        : card.healAmount;
      if (G.playerChar.hp + healAmt > G.playerChar.maxHp) {
        logMsg('system', `${card.name} would overheal — you need at least ${G.playerChar.maxHp - G.playerChar.hp} missing HP, and this heals ${healAmt}.`); return;
      }
      healPlayer(healAmt);
      G.playerHealTotal += healAmt;
      const boostedNote = G.playerChar.attribute === 'healing'
        ? ` (healing boost: ${healAmt} vs base ${card.healAmount})` : '';
      logMsg('heal', `You use ${card.name} → +${healAmt} HP${boostedNote}.`);
      G.playerHand = G.playerHand.filter(c => c.id !== card.id);
      G.playerInPlay = G.playerInPlay.filter(c => c.id !== card.id);
    } else {
      // Armor equip
      if (G.playerInPlay.find(c => c.id === card.id)) { logMsg('system', `${card.name} is already equipped.`); return; }
      const equippedDefense = G.playerInPlay.filter(c => c.type === 'defense' && c.healAmount === 0).length;
      if (equippedDefense >= 2) { logMsg('system', `You can only have 2 defensive items equipped at a time. Unequip one first.`); return; }
      G.playerHand = G.playerHand.filter(c => c.id !== card.id);
      G.playerInPlay.push(card);
      logMsg('player', `You equip ${card.name} (${card.defense} def, ${card.durability} dur).`);
    }

    G.playerActedThisPhase = true;
    G.selectedCard = null;
    checkPhaseComplete();
    render();
  }
}

/**
 * Plays whichever card is currently selected (G.selectedCard).
 * Called by the FIRE / EQUIP / USE button overlay.
 */
function playerPlaySelectedCard() {
  if (!G.selectedCard) return;
  const card = G.playerHand.find(c => c.id === G.selectedCard)
    || G.playerInPlay.find(c => c.id === G.selectedCard);
  if (!card) { logMsg('system', 'Card not found.'); return; }
  playerPlayCard(card);
}

// ── UI helpers ────────────────────────────────────────────────────────────────

/** Toggles the battle-log panel open/closed. */
function toggleLog() {
  const log = document.getElementById('log');
  const arrow = document.getElementById('log-toggle-arrow');
  if (!log) return;
  const collapsed = log.classList.toggle('collapsed');
  if (arrow) arrow.textContent = collapsed ? '▶' : '▼';
}

// ── Logging ───────────────────────────────────────────────────────────────────

/**
 * Appends a message to the in-game log panel and the slim log bar.
 *
 * @param {'system'|'player'|'bot'|'phase'|'damage'|'heal'} type
 * @param {string} text
 */
function logMsg(type, text) {
  if (!G.log) G.log = [];
  G.log.push({ type, text });

  const el = document.getElementById('log');
  if (!el) return;
  const div = document.createElement('div');
  div.className = `log-entry log-${type} new-entry`;
  div.textContent = text;

  const slim = document.getElementById('slim-log');
  if (slim) slim.textContent = text;

  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}
