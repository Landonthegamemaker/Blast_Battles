/**
 * Name: player-actions.js
 * Description: Player action handlers for movement, Tactical Tim's Radar, and skipping phases.
 * Dependencies (must load first): ai-bot.js, render.js
 * Exports (browser globals): playerMove, playerXray, skipPhase
 */
'use strict';

/**
 * Tactical Tim's Radar (costs the phase's action): pings outward in each of the
 * 4 cardinal directions from the player's position, one tile at a time. If a
 * pulse's straight-line path reaches the bot's exact tile before running off
 * the grid, the signal "bounces back" — revealing the bot's direction and
 * distance, and briefly making its token visible on the arena regardless of
 * the fog-of-war radius. If no direction lines up with the bot, the sweep
 * comes back with nothing.
 */
function playerXray() {
  if (G.gameOver || G.playerActedThisPhase || G.xrayUsedThisPhase) return;
  if (G.playerChar.attribute !== 'tactical_xray') return;

  const pr = rowOf(G.playerPos), pc = colOf(G.playerPos);
  const br = rowOf(G.botPos), bc = colOf(G.botPos);
  const DIRECTIONS = [
    { name: 'North', dr: -1, dc: 0 },
    { name: 'South', dr: 1, dc: 0 },
    { name: 'East', dr: 0, dc: 1 },
    { name: 'West', dr: 0, dc: -1 },
  ];

  let hit = null;
  for (const dir of DIRECTIONS) {
    // Step the pulse outward one tile at a time until it leaves the grid or lands on the bot
    let r = pr, c = pc, dist = 0;
    while (true) {
      r += dir.dr; c += dir.dc; dist++;
      if (r < 0 || r > 6 || c < 0 || c > 6) break; // signal fades off the edge of the grid
      if (r === br && c === bc) { hit = { name: dir.name, dist }; break; }
    }
    if (hit) break;
  }

  G.xrayUsedThisPhase = true;
  G.playerActedThisPhase = true;

  if (hit) {
    logMsg('player', `📡 ${G.playerChar.name} pings ${hit.name} — signal bounces back! Enemy detected ${hit.dist} tile(s) out.`);
    G.radarPingActive = true;
    render();
    setTimeout(() => { G.radarPingActive = false; render(); }, 5000);
  } else {
    logMsg('player', `📡 ${G.playerChar.name} sweeps all directions — no contact. Enemy isn't aligned with you on any axis.`);
    render();
  }
  checkPhaseComplete();
}

function skipPhase() {
  if (G.playerActedThisPhase) return;
  // If awaiting scrap choice, dismiss it without discarding then continue the skip
  if (G.awaitingScrapChoice) {
    G.awaitingScrapChoice = false;
    logMsg('system', 'You pass on the Scrap Heap.');
  }
  logMsg('player', 'You skip this phase.');
  G.awaitingMove = false;
  G.playerActedThisPhase = true;
  checkPhaseComplete();
  render();
}

function checkPhaseComplete() {
  if (G.playerActedThisPhase && G.botActedThisPhase) {
    advancePhase();
    return;
  }
  // Player acted first — now bot takes its turn
  if (G.playerActedThisPhase && !G.botActedThisPhase) {
    const currentPhaseName = PHASES[G.phase]?.name?.toLowerCase();
    const playerAutoSkipped = G.playerChar.attribute === 'explosive_specialist' && currentPhaseName === 'fast';
    if (playerAutoSkipped) {
      G.playerAutoSkippedPhase = true;
      checkPhaseComplete();
      return;
    }
    setTimeout(() => {
      botMoveSmart();
      if (G.difficulty === 'impossible') {
        impossibleBotPlayPhase(); G.botActedThisPhase = true; render(); checkWin(); if (!G.gameOver) advancePhase();
      } else {
        botPlayPhase();
        G.botActedThisPhase = true;
        render(); checkWin();
        if (!G.gameOver) advancePhase();
      }
    }, 500);
  }
}

function advancePhase() {
  clearPhaseTimer();
  G.phase++;
  if (G.phase >= PHASES.length) {
    // New turn — apply end-of-turn effects first
    G.phase = 0;
    G.turn++;

    // Toxic Trooper: compounding turn-end penalty for staying off hazard tiles
    const checkToxicPenalty = (char, pos, isPlayer) => {
      if (char.attribute !== 'radioactive_resist') return;
      const loc = G.locations[pos];
      if (loc.effect === 'radiation') {
        // Reset counter when on a hazard tile
        if (isPlayer) G.playerToxicTurns = 0; else G.botToxicTurns = 0;
      } else {
        // Increment counter and apply compounding penalty
        if (isPlayer) G.playerToxicTurns++; else G.botToxicTurns++;
        const turns = isPlayer ? G.playerToxicTurns : G.botToxicTurns;
        const penalty = turns * 2;  // +2 HP per consecutive turn off hazard (2, 4, 6, 8...)
        char.hp = Math.max(0, char.hp - penalty);
        logMsg('damage', `☠️ ${char.name} off hazard tile for ${turns} turn(s) — loses ${penalty} HP!`);
      }
    };
    checkToxicPenalty(G.playerChar, G.playerPos, true);
    checkToxicPenalty(G.botChar, G.botPos, false);

    logMsg('system', `=== TURN ${G.turn} BEGINS ===`);
    if (G.turn === MAX_TURNS - 5) logMsg('system', `⚠️ ${MAX_TURNS - G.turn} turns remaining — tiebreaker: HP% × (DMG dealt + Healing done). Outscore your opponent!`);
    if (G.turn === MAX_TURNS - 2) logMsg('system', `⚠️ FINAL 3 TURNS — scores: You ${((G.playerChar.hp / G.playerChar.maxHp) * (G.playerDmgDealt + G.playerHealTotal)).toFixed(0)} vs Bot ${((G.botChar.hp / G.botChar.maxHp) * (G.botDmgDealt + G.botHealTotal)).toFixed(0)} — deal damage AND stay healthy!`);
  }
  if (G.gameOver) return;
  setTimeout(() => { startPhase(); render(); }, 200);
}

function playerMove(locIndex) {
  if (!G.awaitingMove || G.gameOver) return;
  const isSwift = G.playerChar.attribute === 'swift';
  const steps = isSwift ? (PHASES[G.phase] === 'fast' ? 2 : 1) : 1;
  const reachable = getReachableForChar(G.playerChar, G.playerPos, steps);

  if (locIndex === G.playerPos) {
    // Staying in place counts as passing movement — doesn't consume action
    G.awaitingMove = false;
    render();
    return;
  } else if (reachable.includes(locIndex)) {
    logMsg('player', `You move to ${G.locations[locIndex].name}.`);
    G.playerPos = locIndex;
    if (!G.revealedTiles) G.revealedTiles = new Set();
    G.revealedTiles.add(locIndex);
    G.playerMovedThisPhase = true;
    BB_Audio.stopSfx();
    BB_Audio.playZoneSfx(G.locations[locIndex].effect);
  } else {
    logMsg('system', 'That location is not reachable this turn.'); return;
  }

  // Movement consumes the player's action — UNLESS a triggered bonus applies:
  //   Run & Gun  (run_and_gun):  pistol still ready after moving
  //   Logan      (swift_melee):  if the opponent was within 1 tile at phase start AND
  //                              a melee weapon is playable this phase, movement is free —
  //                              the opponent is punished for staying in Logan's strike zone.
  const phase = PHASES[G.phase];
  const isRunAndGun = G.playerChar.attribute === 'run_and_gun';
  const isSwiftMelee = G.playerChar.attribute === 'swift_melee';

  const isReady = isRunAndGun && [...G.playerHand, ...G.playerInPlay]
    .some(c => c.type === 'weapon' && isWeaponSpeedReady(c, phase, G.playerChar.attribute) && c.ammo > 0
      && getDistance(locIndex, G.botPos) <= c.range);

  // Logan triggered: opponent must have been adjacent BEFORE the move (use pre-move playerPos)
  const opponentWasAdjacent = getDistance(G.playerPos, G.botPos) <= 1;
  const hasMeleeThisPhase = [...G.playerHand, ...G.playerInPlay]
    .some(c => c.type === 'weapon' && c.subtype === 'melee' && isWeaponSpeedReady(c, phase, G.playerChar.attribute) && c.ammo > 0);
  const loganTriggered = isSwiftMelee && opponentWasAdjacent && hasMeleeThisPhase;
  // After the triggered move, check if Logan landed adjacent — if so, keep action open for strike
  const loganCanStrike = loganTriggered && getDistance(locIndex, G.botPos) === 0;

  if (isRunAndGun && isReady) {
    logMsg('player', `${G.playerChar.name} runs into position — ${card.name} still ready!`);
  } else if (loganCanStrike) {
    logMsg('player', `⚡ ${G.playerChar.name} strikes while adjacent — melee attack available!`);
    // Don't consume action — allow the follow-up melee strike
  } else if (loganTriggered) {
    logMsg('player', `⚡ ${G.playerChar.name} pursues — opponent was in range. Move is free, but not adjacent to strike.`);
    // Move is free (opponent was adjacent), but Logan didn't land on the bot's tile
  } else {
    G.playerActedThisPhase = true;
  }
  render();
  updateHint();
  if (!G.botActedThisPhase && !G.gameOver) {
    const wasAutoSkip = G.playerAutoSkippedPhase;
    G.playerAutoSkippedPhase = false;  // reset immediately
    if (wasAutoSkip) {
      // Bot already acted this phase — don't give it a second turn
      checkPhaseComplete();
      return;
    }
    setTimeout(() => {
      botMoveSmart();
      if (G.difficulty === 'impossible') {
        impossibleBotPlayPhase(); G.botActedThisPhase = true;
      } else {
        botPlayPhase(); G.botActedThisPhase = true;
      }
      render(); checkWin();
      if (!G.gameOver) checkPhaseComplete();
    }, 400);
  } else {
    checkPhaseComplete();
  }
}