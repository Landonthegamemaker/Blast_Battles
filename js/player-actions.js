/**
 * Name: player-actions.js
 * Description: Player action handlers for movement, Tactical Tim X-Ray, and skipping phases.
 * Dependencies (must load first): ai-bot.js, render.js
 * Exports (browser globals): playerMove, playerXray, skipPhase
 */
'use strict';
// Tactical Tim X-Ray: reveal a random hidden bot card for 5 seconds (costs action)
function playerXray() {
  if (G.gameOver || G.playerActedThisPhase || G.xrayUsedThisPhase) return;
  if (G.playerChar.attribute !== 'tactical_xray') return;
  const hiddenCards = G.botHand.filter(c => c.id !== G.botRevealedCard);
  if (hiddenCards.length === 0) {
    logMsg('system', `No hidden bot cards to scan.`); return;
  }
  const card = hiddenCards[Math.floor(Math.random() * hiddenCards.length)];
  G.xrayUsedThisPhase = true;
  G.playerActedThisPhase = true;
  logMsg('player', `🔍 ${G.playerChar.name} scans the enemy — reveals: ${card.name}!`);
  G.botRevealedCard = card.id;
  render();
  setTimeout(() => { G.botRevealedCard = null; render(); }, 5000);
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
    .some(c => c.type === 'weapon' && c.speed === phase && c.ammo > 0
      && getDistance(locIndex, G.botPos) <= c.range);

  // Logan triggered: opponent must have been adjacent BEFORE the move (use pre-move playerPos)
  const opponentWasAdjacent = getDistance(G.playerPos, G.botPos) <= 1;
  const hasMeleeThisPhase = [...G.playerHand, ...G.playerInPlay]
    .some(c => c.type === 'weapon' && c.subtype === 'melee' && c.speed === phase && c.ammo > 0);
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