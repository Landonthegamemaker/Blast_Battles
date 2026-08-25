/**
 * combat.js — Blast Battles combat resolution & game-state helpers
 * Dependencies (must load first): data.js, utils.js, grid.js, progression.js (awardMatchCredits)
 * Reads/writes the global `G` object (game state).
 * Calls: logMsg() (game-state.js), render() (render.js), clearPhaseTimer() (game-state.js)
 *
 * Exports (browser globals):
 *   applyRangeMultiplier(baseDmg, card, dist)          → number
 *   applyPlayerWeaponBuff(dmg, card)                   → number
 *   applyBotWeaponBuff(dmg, card)                      → number
 *   applyLocationDamageBuff(dmg, char, pos, card?)     → number
 *   applyBotArmor(dmg, attackingCard)                  → { finalDmg, armorNote }
 *   applyPlayerArmor(dmg, attackingCard)               → { finalDmg, armorNote }
 *   getEffectiveSpeed(char, hand, inPlay)              → number
 *   getMaxHandSize(char)                               → number
 *   playerTotalCards()                                 → number
 *   botTotalCards()                                    → number
 *   healPlayer(amount)
 *   healBot(amount)
 *   applyLocationEffects(isCardDrawPhase?)
 *   playerScrapCard(cardId)
 *   isCardPlayable(card)                               → boolean
 *   checkWin()
 *   computeBattleScore(isRetreat?)                     → { battleFinal, survivBonus, earlyExitPenalty }
 *   endGame(winner, timeLimit?)
 *   retreat()
 *   buildModalStatsHTML(opts)                          → string (HTML)
 *   glowClassPlayer(playerVal, botVal)                 → boolean
 *   glowClassBot(playerVal, botVal)                    → boolean
 *   MAX_TURNS                                          → 20
 *   MAX_MATCH_TIME_SEC                                 → 1600
 */

'use strict';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_TURNS = 20;
const MAX_MATCH_TIME_SEC = 1600; // 20 turns × 4 phases × 20s

// ── Range & damage multipliers ───────────────────────────────────────────────

/**
 * Fraction of direct-hit damage that "anything within 1 tile of the hit"
 * takes — used for grenade self-splash (the attacker throwing at close range)
 * and for near-miss splash (a dodged shot that still lands nearby).
 */
const AOE_SPLASH_MULTIPLIER = 0.5;

/**
 * Explosive/missile weapons detonate on impact — anyone within 1 tile of the
 * target's tile (including the attacker themselves, on a close-range throw)
 * takes splash damage. Returns 0 when the attacker was outside the blast
 * radius (dist > 1), so lobbing a grenade from range is safe.
 *
 * @param {number} finalDmg   - The direct-hit damage already dealt to the target
 * @param {number} attackerDist - Chebyshev distance from attacker to target
 * @returns {number}
 */
function getExplosiveSplashDamage(finalDmg, attackerDist) {
  return attackerDist <= 1 ? Math.round(finalDmg * AOE_SPLASH_MULTIPLIER) : 0;
}

/**
 * A dodged ("missed") shot still detonates/lands near the target — they take
 * partial splash damage rather than walking away completely unscathed.
 *
 * @param {number} finalDmg - The damage that would have been dealt on a direct hit
 * @returns {number}
 */
function getMissSplashDamage(finalDmg) {
  return Math.round(finalDmg * AOE_SPLASH_MULTIPLIER);
}

/**
 * Scales base damage by how far the shot is from the weapon's max range.
 * Full listed damage lands exactly AT max range; firing closer than that
 * deals proportionally less — a range-3 sniper is nasty at range 3, but
 * weak firing point-blank. Melee (range 0) always fires at dist 0, and the
 * formula naturally resolves to a flat 1.0 there — no special case needed.
 *
 * mult(dist) = 1 / (maxRange - dist + 1)
 *   dist == maxRange → 100% (full listed damage)
 *   dist 0 (maxRange 3) → 25%
 *   dist 0 (maxRange 1) → 50%
 *   dist 0 (maxRange 0, melee) → 100% (0 - 0 + 1 = 1)
 *
 * @param {{ range: number }} card
 * @param {number} dist - Chebyshev distance to target
 * @returns {number}
 */
function getRangeMultiplier(card, dist) {
  return 1 / (card.range - dist + 1);
}

/**
 * Applies the range multiplier to base damage, rounding to a whole number.
 *
 * @param {number} baseDmg
 * @param {{ subtype: string, range: number }} card
 * @param {number} dist - Chebyshev distance to target
 * @returns {number}
 */
function applyRangeMultiplier(baseDmg, card, dist) {
  return Math.round(baseDmg * getRangeMultiplier(card, dist));
}

/**
 * Applies the player character's weapon specialisation bonus.
 * dual_wield gets no per-shot bonus — the power is the double-attack.
 *
 * @param {number} dmg
 * @param {{ subtype: string }} card
 * @returns {number}
 */
function applyPlayerWeaponBuff(dmg, card) {
  const attr = G.playerChar.attribute;
  const sub  = card.subtype;
  if (attr === 'dual_wield'          && (sub === 'pistol' || sub === 'revolver'))            return dmg; // bonus is the second shot
  if (attr === 'deadeye'             && sub === 'revolver')                                  return Math.ceil(dmg * 1.25);
  if (attr === 'pistol_specialist'   && sub === 'pistol')                                    return Math.ceil(dmg * 1.3);
  if (attr === 'shotgun_specialist'  && sub === 'shotgun')                                   return Math.ceil(dmg * 1.3);
  if (attr === 'rifle_specialist'    && (sub === 'assault_rifle' || sub === 'sniper'))       return Math.ceil(dmg * 1.25);
  if (attr === 'sniper_specialist'   && sub === 'sniper')                                    return Math.ceil(dmg * 1.33);
  if (attr === 'explosive_specialist'&& sub === 'explosive')          return Math.ceil(dmg * 1.35);
  if (attr === 'melee_specialist'    && sub === 'melee')                                     return Math.ceil(dmg * 1.4);
  if (attr === 'swift_melee'         && sub === 'melee')                                     return Math.ceil(dmg * 1.4);
  return dmg;
}

/**
 * Applies the bot character's weapon specialisation bonus.
 * Mirrors applyPlayerWeaponBuff but reads G.botChar.
 * Note: sniper_specialist bot gets 1.35× (vs 1.33× for player) — intentional difficulty edge.
 *
 * @param {number} dmg
 * @param {{ subtype: string }} card
 * @returns {number}
 */
function applyBotWeaponBuff(dmg, card) {
  const attr = G.botChar.attribute;
  const sub  = card.subtype;
  if (attr === 'dual_wield'          && (sub === 'pistol' || sub === 'revolver'))            return dmg;
  if (attr === 'deadeye'             && sub === 'revolver')                                  return Math.ceil(dmg * 1.25);
  if (attr === 'pistol_specialist'   && sub === 'pistol')                                    return Math.ceil(dmg * 1.3);
  if (attr === 'shotgun_specialist'  && sub === 'shotgun')                                   return Math.ceil(dmg * 1.3);
  if (attr === 'rifle_specialist'    && (sub === 'assault_rifle' || sub === 'sniper'))       return Math.ceil(dmg * 1.25);
  if (attr === 'sniper_specialist'   && sub === 'sniper')                                    return Math.ceil(dmg * 1.35);
  if (attr === 'explosive_specialist'&& sub === 'explosive')          return Math.ceil(dmg * 1.35);
  if (attr === 'melee_specialist'    && sub === 'melee')                                     return Math.ceil(dmg * 1.4);
  if (attr === 'swift_melee'         && sub === 'melee')                                     return Math.ceil(dmg * 1.4);
  return dmg;
}

/**
 * Applies a location-based damage buff to the attacker.
 * Hero Zone: +25% for heroes; Villain Zone: +25% for villains.
 * Sniper Nest / Watch Tower: +33% for sniper weapons.
 *
 * @param {number} dmg
 * @param {{ faction: string }} char  - Attacking character
 * @param {number} pos                - Attacker's tile index
 * @param {{ subtype: string }|null} [card]
 * @returns {number}
 */
function applyLocationDamageBuff(dmg, char, pos, card = null) {
  const loc = G.locations[pos];
  if (!loc) return dmg;
  if (loc.effect === 'hero_zone'    && char.faction === 'hero')                        return Math.ceil(dmg * 1.25);
  if (loc.effect === 'villain_zone' && char.faction === 'villain')                     return Math.ceil(dmg * 1.25);
  if (loc.effect === 'sniper_nest'  && card && card.subtype === 'sniper')              return Math.ceil(dmg * 1.33);
  // Center-of-map power tile — faction-agnostic, unlike hero/villain zones, so it's
  // worth contesting regardless of which side you're on.
  if (loc.effect === 'damage_boost')                                                   return Math.ceil(dmg * 1.25);
  return dmg;
}

// ── Armor resolution ─────────────────────────────────────────────────────────

/**
 * Resolves incoming damage against the bot's equipped armor.
 * Effective armor reduces by full `defense` value; ineffective by 40%.
 * Heavy armor (Iron Titan) boosts Riot Shield / Riot Vest by 25%.
 * Armor durability decreases each hit; broken armor is removed from inPlay.
 * Mutates G.botChar.hp indirectly via G.botInPlay armor durability.
 *
 * @param {number} dmg
 * @param {{ subtype: string }} attackingCard
 * @returns {{ finalDmg: number, armorNote: string }}
 */
function applyBotArmor(dmg, attackingCard) {
  let finalDmg = dmg;
  let armorNote = '';
  for (const armor of G.botInPlay.filter(c => c.type === 'defense' && c.healAmount === 0)) {
    const isEffective = armor.effectiveVs.includes(attackingCard.subtype);
    let reduction = isEffective ? armor.defense : Math.ceil(armor.defense * 0.4);
    if (G.botChar.attribute === 'heavy_armor' && (armor.name === 'Riot Shield' || armor.name === 'Riot Vest'))
      reduction = Math.ceil(reduction * 1.25);
    if (G.botChar.attribute === 'sniper_resist' && attackingCard.subtype === 'sniper')
      reduction = Math.ceil(dmg * 0.5);
    if (G.botChar.attribute === 'run_and_gun' && attackingCard.subtype === 'explosive')
      reduction = Math.ceil(dmg * 0.4);
    const actualReduction = Math.min(finalDmg, reduction);
    finalDmg -= actualReduction;
    if (actualReduction > 0) {
      const durabLost = isEffective ? 1 : (dmg > 50 ? 2 : 1);
      armor.durability -= durabLost;
      armorNote += ` (${armor.name} blocked ${actualReduction})`;
      if (armor.durability <= 0) {
        G.botInPlay = G.botInPlay.filter(c => c.id !== armor.id);
        armorNote += ' [BROKEN]';
      }
    }
  }
  return { finalDmg: Math.max(0, finalDmg), armorNote };
}

/**
 * Resolves incoming damage against the player's equipped armor.
 * Mirrors applyBotArmor but reads G.playerChar / G.playerInPlay.
 *
 * @param {number} dmg
 * @param {{ subtype: string }} attackingCard
 * @returns {{ finalDmg: number, armorNote: string }}
 */
function applyPlayerArmor(dmg, attackingCard) {
  let finalDmg = dmg;
  let armorNote = '';
  for (const armor of G.playerInPlay.filter(c => c.type === 'defense' && c.healAmount === 0)) {
    const isEffective = armor.effectiveVs.includes(attackingCard.subtype);
    let reduction = isEffective ? armor.defense : Math.ceil(armor.defense * 0.4);
    if (G.playerChar.attribute === 'heavy_armor' && (armor.name === 'Riot Shield' || armor.name === 'Riot Vest'))
      reduction = Math.ceil(reduction * 1.25);
    if (G.playerChar.attribute === 'sniper_resist' && attackingCard.subtype === 'sniper')
      reduction = Math.ceil(dmg * 0.5);
    if (G.playerChar.attribute === 'run_and_gun' && attackingCard.subtype === 'explosive')
      reduction = Math.ceil(dmg * 0.4);
    const actualReduction = Math.min(finalDmg, reduction);
    finalDmg -= actualReduction;
    if (actualReduction > 0) {
      const durabLost = isEffective ? 1 : (dmg > 50 ? 2 : 1);
      armor.durability -= durabLost;
      armorNote += ` (${armor.name} blocked ${actualReduction})`;
      if (armor.durability <= 0) {
        G.playerInPlay = G.playerInPlay.filter(c => c.id !== armor.id);
        armorNote += ' [BROKEN]';
      }
    }
  }
  return { finalDmg: Math.max(0, finalDmg), armorNote };
}

// ── Character stat helpers ───────────────────────────────────────────────────

/**
 * Returns the effective speed of a character, accounting for Tactical Tim's
 * passive: speed decreases by 1 for each card held (hand + in-play).
 *
 * @param {{ attribute: string, speed: number }} char
 * @param {any[]} hand
 * @param {any[]} inPlay
 * @returns {number}
 */
function getEffectiveSpeed(char, hand, inPlay) {
  if (char.attribute === 'tactical_xray') {
    const cardsEquipped = (hand ? hand.length : 0) + (inPlay ? inPlay.length : 0);
    return Math.max(0, char.speed - cardsEquipped);
  }
  return char.speed;
}

/**
 * Returns the maximum number of cards (hand + in-play combined) a character
 * may hold.
 * extra_carry (Tracy Guns): 5  — she holds 5 weapons, no defense.
 * dual_wield  (Pistol Pete): 4 — 2 pistols + 2 draw slots.
 * tactical_xray (Tim): 4       — every extra card costs 1 SPD.
 * everyone else: 4.
 *
 * @param {{ attribute: string }} char
 * @returns {number}
 */
function getMaxHandSize(char) {
  let base = 4;
  if (char.attribute === 'extra_carry')   base = 5;
  if (char.attribute === 'dual_wield')    base = 4;
  if (char.attribute === 'tactical_xray') base = 4;
  // Field Jacket (chest gear, carryBonus:1) — check whichever side this char belongs to
  const inPlay = char === G.playerChar ? G.playerInPlay : char === G.botChar ? G.botInPlay : [];
  const carryBonus = (inPlay || []).reduce((sum, c) => sum + (c.carryBonus || 0), 0);
  return base + carryBonus;
}

/** Total cards (hand + in-play) currently held by the player. */
function playerTotalCards() {
  return G.playerHand.length + G.playerInPlay.length;
}

/** Total cards (hand + in-play) currently held by the bot. */
function botTotalCards() {
  return G.botHand.length + G.botInPlay.length;
}

// ── Healing ──────────────────────────────────────────────────────────────────

/** Heals the player, capped at maxHp. */
function healPlayer(amount) {
  G.playerChar.hp = Math.min(G.playerChar.maxHp, G.playerChar.hp + amount);
}

/** Heals the bot, capped at maxHp. */
function healBot(amount) {
  G.botChar.hp = Math.min(G.botChar.maxHp, G.botChar.hp + amount);
}

// ── Location effects ─────────────────────────────────────────────────────────

/**
 * Applies all tile effects for the current phase to both player and bot.
 * Called at the start of every phase (except Turn 1 / Phase 0).
 *
 * Damage / heal effects fire every phase.
 * Card-draw effects (Armory, Forge) fire only on card-draw phases (medium/charged).
 * Scrap Heap prompts the player to discard; the bot makes an automatic decision.
 *
 * Toxic Trooper (radioactive_resist) special rules:
 *   - Immune to radiation tiles (0 damage).
 *   - Heal tiles deal 3 damage instead.
 *   - All other (non-radiation, non-heal) tiles deal 1 damage per phase.
 *
 * @param {boolean} [isCardDrawPhase=true]
 */
function applyLocationEffects(isCardDrawPhase = true) {
  // ── Player tile ────────────────────────────────────────────────────────────
  const pLoc = G.locations[G.playerPos];

  if (pLoc.effect === 'radiation') {
    const dmg = G.playerChar.attribute === 'radioactive_resist' ? 0 : 5;
    if (dmg > 0) {
      G.playerChar.hp = Math.max(0, G.playerChar.hp - dmg);
      logMsg('damage', `${pLoc.name} deals ${dmg} damage to you.`);
    } else {
      logMsg('system', `☢️ ${G.playerChar.name} is immune to radiation — no damage!`);
    }
  }

  if (pLoc.effect === 'heal') {
    if (G.playerChar.attribute === 'radioactive_resist') {
      G.playerChar.hp = Math.max(0, G.playerChar.hp - 3);
      logMsg('damage', `☠️ ${pLoc.name} is toxic to ${G.playerChar.name} — deals 3 damage!`);
    } else {
      const pMissing = G.playerChar.maxHp - G.playerChar.hp;
      if (pMissing > 0) {
        const base = Math.min(3, pMissing);
        const pRestored = G.playerChar.attribute === 'healing'
          ? Math.min(Math.ceil(base * 1.4), pMissing)
          : base;
        healPlayer(pRestored);
        G.playerHealTotal += pRestored;
        logMsg('heal', `${pLoc.name} restores ${pRestored} HP to you.`);
      }
    }
  }

  // Toxic Trooper off-hazard penalty
  if (G.playerChar.attribute === 'radioactive_resist'
    && pLoc.effect !== 'radiation' && pLoc.effect !== 'heal' && pLoc.effect !== 'poison') {
    G.playerChar.hp = Math.max(0, G.playerChar.hp - 1);
    logMsg('damage', `☠️ ${G.playerChar.name} is off a hazard tile — takes 1 toxic dmg!`);
  }

  // Scrap Heap — prompts player choice (resolved via playerScrapCard)
  if (pLoc.effect === 'discard') {
    const allPlayerCards = [...G.playerHand, ...G.playerInPlay];
    if (allPlayerCards.length > 0) {
      G.awaitingScrapChoice = true;
      logMsg('system', 'Scrap Heap: optionally click a card to discard it, or END TURN to keep all cards.');
    }
  }

  // Ammo Station — every phase you're standing on it, each weapon below max
  // ammo gains +1 (never disappears, unlike the old one-time full-refill version).
  if (pLoc.effect === 'ammo_refill') {
    const weapons = [...G.playerHand, ...G.playerInPlay].filter(c => c.type === 'weapon');
    const refillable = weapons.filter(c => c._maxAmmo !== undefined && c.ammo < c._maxAmmo);
    if (refillable.length > 0) {
      for (const c of refillable) c.ammo = Math.min(c._maxAmmo, c.ammo + 1);
      logMsg('player', `🔋 ${pLoc.name} tops up your ammo by 1.`);
    }
  }

  // Card draws for weapons/defense no longer exist — replaced by Ammo Stations above.

  // ── Bot tile ───────────────────────────────────────────────────────────────
  const bLoc = G.locations[G.botPos];

  if (bLoc.effect === 'radiation' || bLoc.effect === 'poison') {
    const dmg = (bLoc.effect === 'radiation' && G.botChar.attribute === 'radioactive_resist') ? 0 : 5;
    if (dmg > 0) {
      G.botChar.hp = Math.max(0, G.botChar.hp - dmg);
      logMsg('damage', `${bLoc.name} deals ${dmg} damage to bot.`);
    } else {
      logMsg('system', `☢️ ${G.botChar.name} is immune to radiation — no damage!`);
    }
  }

  if (bLoc.effect === 'heal') {
    if (G.botChar.attribute === 'radioactive_resist') {
      G.botChar.hp = Math.max(0, G.botChar.hp - 3);
      logMsg('damage', `☠️ ${bLoc.name} is toxic to ${G.botChar.name} — deals 3 damage!`);
    } else {
      const bMissing = G.botChar.maxHp - G.botChar.hp;
      if (bMissing > 0) {
        const base = Math.min(3, bMissing);
        const bRestored = G.botChar.attribute === 'healing'
          ? Math.min(Math.ceil(base * 1.4), bMissing)
          : base;
        healBot(bRestored);
        G.botHealTotal += bRestored;
        logMsg('heal', `${bLoc.name} restores ${bRestored} HP to bot.`);
      }
    }
  }

  // Toxic Trooper off-hazard penalty (bot)
  if (G.botChar.attribute === 'radioactive_resist'
    && bLoc.effect !== 'radiation' && bLoc.effect !== 'heal' && bLoc.effect !== 'poison') {
    G.botChar.hp = Math.max(0, G.botChar.hp - 1);
    logMsg('damage', `☠️ ${G.botChar.name} is off a hazard tile — takes 1 toxic dmg!`);
  }

  // Ammo Station (bot) — same +1/phase, repeating, as the player gets.
  if (bLoc.effect === 'ammo_refill') {
    const botWeapons = [...G.botHand, ...G.botInPlay].filter(c => c.type === 'weapon');
    const botRefillable = botWeapons.filter(c => c._maxAmmo !== undefined && c.ammo < c._maxAmmo);
    if (botRefillable.length > 0) {
      for (const c of botRefillable) c.ammo = Math.min(c._maxAmmo, c.ammo + 1);
      logMsg('bot', `🔋 Bot's weapons top up by 1 at ${bLoc.name}.`);
    }
  }

  // Bot card draws — card-draw phases only
  if (isCardDrawPhase) {
    // Scrap Heap — bot auto-scrap: dump the lowest-value card if it's truly useless
    if (bLoc.effect === 'discard') {
      const allBotCards = [...G.botHand, ...G.botInPlay];
      if (allBotCards.length > 0) {
        function scrapScore(c) {
          const botAttr = G.botChar.attribute;
          const isUseless =
            (c.type === 'weapon'  && c.ammo <= 0) ||
            (c.type === 'defense' && c.durability <= 0) ||
            ((botAttr === 'pistol_specialist' || botAttr === 'dual_wield')   && c.type === 'weapon' && c.subtype !== 'pistol'        && c.subtype !== 'revolver') ||
            ((botAttr === 'revolver_specialist' || botAttr === 'deadeye')    && c.type === 'weapon' && c.subtype !== 'revolver'      && c.subtype !== 'pistol')   ||
            (botAttr === 'swift_melee'   && c.type === 'weapon' && c.subtype !== 'melee')                                                                          ||
            (botAttr === 'rifle_specialist' && c.type === 'weapon' && c.subtype !== 'assault_rifle' && c.subtype !== 'sniper')                                     ||
            (botAttr === 'extra_carry'   && c.type === 'defense');
          if (isUseless)                                  return 0;
          if (c.type === 'weapon'  && c.ammo <= 1)        return 10;
          if (c.type === 'weapon')                         return 20 + c.damage;
          if (c.type === 'defense' && c.healAmount > 0)   return 50;
          if (c.type === 'defense')                        return 30 + (c.defense || 0);
          return 15;
        }
        const worstCard = allBotCards.reduce((a, b) => scrapScore(a) <= scrapScore(b) ? a : b);
        if (scrapScore(worstCard) < 15) {
          G.botHand   = G.botHand.filter(c   => c.id !== worstCard.id);
          G.botInPlay = G.botInPlay.filter(c => c.id !== worstCard.id);
          logMsg('bot', `Bot scraps ${worstCard.name} at Scrap Heap — dead weight cleared.`);
        } else {
          logMsg('bot', `Bot passes on Scrap Heap — no useless cards to dump.`);
        }
      }
    }
  }
}

/**
 * Called when the player clicks a card at the Scrap Heap.
 * Removes the card from hand or inPlay and clears the awaiting flag.
 *
 * @param {string} cardId
 */
function playerScrapCard(cardId) {
  if (!G.awaitingScrapChoice) return;
  const card = G.playerHand.find(c => c.id === cardId) || G.playerInPlay.find(c => c.id === cardId);
  if (!card) return;
  G.playerHand   = G.playerHand.filter(c   => c.id !== cardId);
  G.playerInPlay = G.playerInPlay.filter(c => c.id !== cardId);
  logMsg('player', `You scrap ${card.name}.`);
  G.awaitingScrapChoice = false;
  render();
}

// ── Card playability ──────────────────────────────────────────────────────────

/**
 * Returns true if the given card is legally playable by the player this phase.
 * Used both by the UI (greying out cards) and the auto-skip timer.
 *
 * Checks:
 *   - Game not over
 *   - Player hasn't acted yet (or it's a dual-wield second shot)
 *   - Phase matches weapon speed (Deadeye gets revolvers one phase early)
 *   - Weapon has ammo remaining
 *   - Character subtype restrictions (dual_wield, deadeye, swift_melee, etc.)
 *   - Commando Cole (run_and_gun) must have moved before attacking
 *   - Range: melee needs dist=0; ranged needs dist <= card.range
 *   - Defense: healing cards only usable when missing HP
 *
 * @param {{ type: string, subtype?: string, speed?: string, ammo?: number,
 *           dualWieldPairId?: string, healAmount?: number, range?: number }} card
 * @returns {boolean}
 */
function isCardPlayable(card) {
  if (G.gameOver) return false;
  const isPairedCard = G.playerChar.attribute === 'dual_wield' && card.dualWieldPairId != null;
  if (isPairedCard && G.dualWieldFiredIds.has(card.id)) return false;
  if (!isPairedCard && G.playerActedThisPhase) return false;

  const phase = PHASES[G.phase];

  if (card.type === 'weapon') {
    if (!isWeaponSpeedReady(card, phase, G.playerChar.attribute)) return false;
    if (card.ammo <= 0) return false;
    if (G.playerChar.attribute === 'dual_wield'         && card.subtype !== 'pistol'        && card.subtype !== 'revolver')     return false;
    if (G.playerChar.attribute === 'deadeye'            && card.subtype !== 'revolver'      && card.subtype !== 'pistol')       return false;
    if (G.playerChar.attribute === 'pistol_specialist'  && card.subtype !== 'pistol')                                           return false;
    if (G.playerChar.attribute === 'revolver_specialist'&& card.subtype !== 'revolver')                                         return false;
    if (G.playerChar.attribute === 'swift_melee'        && card.subtype !== 'melee')                                            return false;
    if (G.playerChar.attribute === 'rifle_specialist'   && card.subtype !== 'assault_rifle' && card.subtype !== 'sniper')       return false;
    if (G.playerChar.attribute === 'run_and_gun'        && !G.playerMovedThisPhase)                                             return false;
    const dist = getDistance(G.playerPos, G.botPos);
    if (card.subtype === 'melee') return dist === 0;
    return dist <= card.range;
  }

  if (card.type === 'defense') {
    if (G.playerChar.attribute === 'extra_carry') return false; // Tracy Guns: weapons only
    if (G.playerChar.attribute === 'dual_wield' && card.healAmount === 0) return false; // Pete: no armor, healing OK
    if (card.healAmount > 0) {
      return G.playerChar.hp < G.playerChar.maxHp &&
             G.playerChar.hp + card.healAmount <= G.playerChar.maxHp;
    }
    return true;
  }

  return false;
}

// ── Win condition ─────────────────────────────────────────────────────────────

/**
 * Checks whether the game has ended and calls endGame() if so.
 * Called after every action and at the start of every phase.
 *
 * Win conditions:
 *   1. Either character reaches 0 HP → immediate knockout.
 *   2. Turn 20, phase 3 (last phase of last turn) → score comparison.
 *      Score = (remaining HP / maxHP) × (damage dealt + healing done).
 *      Proportional HP prevents high-max-HP characters winning on stats alone.
 */
function checkWin() {
  if (G.gameOver) return;
  if (G.playerChar.hp <= 0) { endGame('bot');    return; }
  if (G.botChar.hp   <= 0) { endGame('player'); return; }
  if (G.turn >= MAX_TURNS && G.phase === 3) {
    const pScore = (G.playerChar.hp / G.playerChar.maxHp) * (G.playerDmgDealt + G.playerHealTotal);
    const bScore = (G.botChar.hp   / G.botChar.maxHp)    * (G.botDmgDealt    + G.botHealTotal);
    if      (pScore > bScore) endGame('player', true);
    else if (bScore > pScore) endGame('bot',    true);
    else                      endGame('draw',   true);
  }
}

/**
 * Computes the normalised Battle Score using tanh(net damage) + survivability bonus.
 * Shared by the end-game modal display AND the credit-reward calculation
 * (progression.js awardMatchCredits), so both always agree on the same number.
 *
 * Battle Score formula:
 *   netPlayer    = playerDmgDealt - botHealTotal
 *   netBot       = botDmgDealt - playerHealTotal
 *   rawBattle    = netPlayer - netBot
 *   scale        = max(1, (totalDmg + totalHeal) / 2)   — prevents tanh saturating early
 *   survivBonus  = turnFrac × (pHpRatio - bHpRatio) - earlyExitPenalty
 *   battleFinal  = tanh(rawBattle / scale) + survivBonus
 *
 * @param {boolean} [isRetreat=false] - True when the match ended via retreat (adds the early-exit penalty)
 * @returns {{ battleFinal: number, survivBonus: number, earlyExitPenalty: number }}
 */
function computeBattleScore(isRetreat = false) {
  const netPlayer  = G.playerDmgDealt - G.botHealTotal;
  const netBot     = G.botDmgDealt    - G.playerHealTotal;
  const rawBattle  = netPlayer - netBot;

  const MAX_EARLY_EXIT_PENALTY = 0.554;
  const completionRatio  = G.turn / MAX_TURNS;
  const earlyExitPenalty = isRetreat
    ? Math.pow(1 - completionRatio, 2) * MAX_EARLY_EXIT_PENALTY
    : 0;

  const turnFrac    = Math.min(G.turn, MAX_TURNS) / MAX_TURNS;
  const pHpRatio    = G.playerChar.hp / G.playerChar.maxHp;
  const bHpRatio    = G.botChar.hp    / G.botChar.maxHp;
  const survivBonus = turnFrac * (pHpRatio - bHpRatio) - earlyExitPenalty;

  const scale       = Math.max(1, (G.playerDmgDealt + G.botDmgDealt + G.playerHealTotal + G.botHealTotal) / 2);
  const battleFinal = Math.tanh(rawBattle / scale) + survivBonus;

  return { battleFinal, survivBonus, earlyExitPenalty };
}

// ── Modal stats builder ───────────────────────────────────────────────────────

/**
 * Returns true if the player's value is >= the bot's (used to highlight the
 * winning stat box with a faction-coloured glow).
 */
function glowClassPlayer(playerVal, botVal) { return playerVal >= botVal; }

/**
 * Returns true if the bot's value is >= the player's.
 */
function glowClassBot(playerVal, botVal) { return botVal >= playerVal; }

/**
 * Builds the inner HTML for the end-game / retreat modal stats panel.
 * Computes a normalised Battle Score using tanh(net damage) + survivability bonus.
 *
 * Battle Score formula:
 *   netPlayer    = playerDmgDealt - botHealTotal
 *   netBot       = botDmgDealt - playerHealTotal
 *   rawBattle    = netPlayer - netBot
 *   scale        = max(1, (totalDmg + totalHeal) / 2)   — prevents tanh saturating early
 *   survivBonus  = turnFrac × (pHpRatio - bHpRatio) - earlyExitPenalty
 *   battleFinal  = tanh(rawBattle / scale) + survivBonus
 *
 * @param {{
 *   pImg: string, bImg: string,
 *   pDeadOverlay?: string, bDeadOverlay?: string,
 *   pDead?: boolean, bDead?: boolean,
 *   pBorderColor: string, bBorderColor: string,
 *   pFactionColor?: string, bFactionColor?: string,
 *   timeStr: string, elapsed: number,
 *   isRetreat?: boolean,
 *   winner?: string
 * }} opts
 * @returns {string} HTML string
 */
function buildModalStatsHTML(opts) {
  const {
    pImg, bImg,
    pDeadOverlay = '', bDeadOverlay = '',
    pDead = false, bDead = false,
    pBorderColor, bBorderColor,
    pFactionColor = 'var(--hero)', bFactionColor = 'var(--villain)',
    timeStr, elapsed,
    isRetreat = false,
    winner = 'player'
  } = opts;

  const { battleFinal, survivBonus, earlyExitPenalty } = computeBattleScore(isRetreat);

  const battleFinalDisplay = (battleFinal >= 0 ? '+' : '') + (Math.round(battleFinal * 1000) / 1000).toFixed(3);
  const battleFinalColor   = battleFinal >= 0 ? '#44ff88' : '#ff4444';
  const survivSign         = survivBonus >= 0 ? '+' : '';
  const survivStr          = `${survivSign}${(Math.round(survivBonus * 1000) / 1000).toFixed(3)}`;

  const dmgGlowP  = glowClassPlayer(G.playerDmgDealt,  G.botDmgDealt);
  const dmgGlowB  = glowClassBot   (G.playerDmgDealt,  G.botDmgDealt);
  const healGlowP = glowClassPlayer(G.playerHealTotal,  G.botHealTotal);
  const healGlowB = glowClassBot   (G.playerHealTotal,  G.botHealTotal);

  return `
    <div class="modal-stat-split">
      <div class="split-left">
        <div class="modal-stat-label">⏱ TURNS ⏱</div>
        <div class="modal-stat-value">${G.turn} / ${MAX_TURNS}</div>
      </div>
      <div class="split-right">
        <div class="modal-stat-label">🕐 MATCH TIME 🕐</div>
        <div class="modal-stat-value">${timeStr}</div>
      </div>
    </div>
    <div class="modal-char-card" style="border-color:${pBorderColor}">
      ${pImg}${pDeadOverlay}
      <div class="modal-char-info">
        <div class="modal-char-name" style="color:${pFactionColor};">${G.playerChar.name}</div>
        <div class="modal-char-hp" style="color:${pDead ? '#ff4444' : pFactionColor};">${G.playerChar.hp} <span class="modal-char-maxhp">/ ${G.playerChar.maxHp} HP</span></div>
      </div>
    </div>
    <div class="modal-char-card" style="border-color:${bBorderColor}">
      ${bImg}${bDeadOverlay}
      <div class="modal-char-info">
        <div class="modal-char-name" style="color:${bFactionColor};">${G.botChar.name}</div>
        <div class="modal-char-hp" style="color:${bDead ? '#ff4444' : bFactionColor};">${G.botChar.hp} <span class="modal-char-maxhp">/ ${G.botChar.maxHp} HP</span></div>
      </div>
    </div>
    <div class="modal-stat" style="${dmgGlowP ? `border-color:${pFactionColor};box-shadow:0 0 10px ${pFactionColor}44;` : ''}"><div class="modal-stat-label">Your Dmg Dealt</div><div class="modal-stat-value">${G.playerDmgDealt}</div></div>
    <div class="modal-stat" style="${dmgGlowB ? `border-color:${bFactionColor};box-shadow:0 0 10px ${bFactionColor}44;` : ''}"><div class="modal-stat-label">Bot Dmg Dealt</div><div class="modal-stat-value">${G.botDmgDealt}</div></div>
    <div class="modal-stat" style="${healGlowP ? `border-color:${pFactionColor};box-shadow:0 0 10px ${pFactionColor}44;` : ''}"><div class="modal-stat-label">Your Healing</div><div class="modal-stat-value">${G.playerHealTotal}</div></div>
    <div class="modal-stat" style="${healGlowB ? `border-color:${bFactionColor};box-shadow:0 0 10px ${bFactionColor}44;` : ''}"><div class="modal-stat-label">Bot Healing</div><div class="modal-stat-value">${G.botHealTotal}</div></div>
    <div class="modal-stat" style="grid-column:1/-1;background:${battleFinal >= 0 ? 'rgba(30,90,40,0.45)' : 'rgba(90,20,20,0.45)'};border-color:${battleFinal >= 0 ? 'rgba(68,255,136,0.7)' : 'rgba(255,68,68,0.7)'};box-shadow:0 0 12px ${battleFinal >= 0 ? 'rgba(68,255,136,0.35)' : 'rgba(255,68,68,0.35)'};">
      <div class="modal-stat-label" style="display:flex;justify-content:space-between;align-items:baseline;">
        <span>⭐Battle Score⭐</span>
        <span style="font-size:0.58rem;color:var(--muted);">tanh(DMG−HEAL) + ⛉️${survivStr}${earlyExitPenalty > 0 ? ` ·⚠︎EXIT −${earlyExitPenalty.toFixed(2)}` : ''}</span>
      </div>
      <div class="modal-stat-value" style="font-size:1.3rem;color:${battleFinalColor};">${battleFinalDisplay}</div>
    </div>
  `;
}

// ── End game & retreat ────────────────────────────────────────────────────────

/**
 * Ends the match, plays end music, and displays the result modal.
 *
 * @param {'player'|'bot'|'draw'} winner
 * @param {boolean} [timeLimit=false] - True when the match ended on turn limit
 */
function endGame(winner, timeLimit = false) {
  G.gameOver = true;
  BB_Audio.playEndMusic(winner, G.playerChar.faction);

  const won     = winner === 'player';
  const draw    = winner === 'draw';
  const elapsed = Math.round((Date.now() - G.matchStartTime) / 1000);
  const mins    = Math.floor(elapsed / 60);
  const secs    = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const { battleFinal } = computeBattleScore(false);
  const outcome = won ? 'win' : draw ? 'draw' : 'loss';
  let creditsEarned = (typeof awardMatchCredits === 'function') ? awardMatchCredits(battleFinal, G.difficulty, outcome) : 0;

  // Character unlocks: winning marks this difficulty beaten for G.botChar. If that
  // was the last of the 4 difficulties needed, they're now unlocked to play as.
  let unlockStr = '';
  if (won && typeof recordDefeat === 'function' && typeof isCharUnlocked === 'function') {
    const wasUnlockedBefore = isCharUnlocked(G.botChar.id);
    recordDefeat(G.botChar.id, G.difficulty);
    if (!wasUnlockedBefore && isCharUnlocked(G.botChar.id)) {
      unlockStr = ` 🔓 ${G.botChar.name} UNLOCKED!`;
    }
  }

  // Sterling Cross tutorial match (Pete vs Clint, Easy) — first win only:
  //   1. Pre-flags Clint's Medium/Hard/Impossible defeat progress, since the
  //      tutorial only ever plays out on Easy — without this he could never
  //      actually reach "beaten on all 4 difficulties" through this path.
  //   2. Tops credits up to at least the price of Two Banger (his designated
  //      revolver, cheapest one in the pool) — a real battle score might not
  //      clear that on a first win, and the whole point of the tutorial is to
  //      guarantee the player can afford the purchase that unlocks him.
  let tutorialStr = '';
  if (G.isTutorialMatch && won && !localStorage.getItem(TUTORIAL_MATCH_DONE_KEY)) {
    if (typeof recordDefeat === 'function') {
      recordDefeat(G.botChar.id, 'medium');
      recordDefeat(G.botChar.id, 'hard');
      recordDefeat(G.botChar.id, 'impossible');
    }
    if (typeof isCharUnlocked === 'function' && isCharUnlocked(G.botChar.id)) {
      unlockStr = ` 🔓 ${G.botChar.name} UNLOCKED!`;
    }
    if (typeof WEAPON_POOL !== 'undefined' && typeof getCredits === 'function' && typeof addCredits === 'function') {
      const twoBanger = WEAPON_POOL.find(w => w.id === 'w33');
      const target = twoBanger ? twoBanger.price : 120;
      const shortfall = target - getCredits();
      if (shortfall > 0) {
        addCredits(shortfall, 'tutorial guarantee');
        creditsEarned += shortfall; // reflect the top-up in the displayed total
      }
    }
    localStorage.setItem(TUTORIAL_MATCH_DONE_KEY, '1');
    // Without this, the shop would still be locked to whichever character is
    // _selectedCharId (Pete, pistol-only) — blocking the exact purchase this
    // message promises. Pre-targets the shop at Clint's subtype (revolver) so
    // buying Two Banger is actually possible however the player gets there.
    if (typeof _shopTargetCharId !== 'undefined') _shopTargetCharId = G.botChar.id;
    tutorialStr = ` 🎖 You now have enough for a Two Banger — visit the Shop!`;
  }
  const creditsStr = ` (${creditsEarned >= 0 ? '+' : ''}${creditsEarned} 💰)`;

  const pDmgWon  = G.playerDmgDealt  > G.botDmgDealt;
  const pHealWon = G.playerHealTotal > G.botHealTotal;
  const edge     = !pDmgWon && !pHealWon ? 'DMG & Healing'
    : !pDmgWon  ? 'DMG'
    : !pHealWon ? 'Healing'
    : 'neither stat';

  let title, msg;
  if (draw) {
    title = '🤝 DRAW!';
    msg   = `You and ${G.botChar.name} somehow ended up with equal DMG & Healing!${creditsStr}`;
  } else if (timeLimit) {
    title = won ? '🏆 VICTORY! ⏳' : '💀 DEFEATED ⏳';
    msg   = won
      ? `Time's up — you outscored ${G.botChar.name} in ${pDmgWon && pHealWon ? 'DMG & Healing' : pDmgWon ? 'DMG' : pHealWon ? 'Healing' : 'NOTHING'}!${creditsStr}${unlockStr}${tutorialStr}`
      : `Time's up — ${G.botChar.name} outscored you in ${edge}.${creditsStr}`;
  } else {
    title = won ? '🏆 VICTORY!' : '💀 DEFEATED';
    msg   = won
      ? `You defeated ${G.botChar.name}! Leading in ${pDmgWon && pHealWon ? 'DMG & Healing' : pDmgWon ? 'DMG' : pHealWon ? 'Healing' : 'NOTHING'}!${creditsStr}${unlockStr}${tutorialStr}`
      : (G.lastKillingBlow
          ? `${G.botChar.name} eliminated you with ${G.lastKillingBlow}.${creditsStr}`
          : `${G.botChar.name} has eliminated you.${creditsStr}`);
  }

  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-msg').textContent   = msg;

  const shadowFilter  = 'brightness(0.35) saturate(0.2) hue-rotate(200deg) contrast(1.3) sepia(0.4)';
  const pFactionColor = G.playerChar.faction === 'villain' ? 'var(--villain)' : 'var(--hero)';
  const bFactionColor = G.botChar.faction    === 'villain' ? 'var(--villain)' : 'var(--hero)';
  const pPortraitBg   = G.playerChar.faction === 'villain' ? 'rgba(196,75,255,0.1)' : 'rgba(74,184,255,0.1)';
  const bPortraitBg   = G.botChar.faction    === 'villain' ? 'rgba(196,75,255,0.1)' : 'rgba(74,184,255,0.1)';
  const pIsShadow     = G.playerChar.name.startsWith('Dark ');
  const bIsShadow     = G.botChar.name.startsWith('Dark ');
  const pSrc          = pIsShadow && G.botChar.img    ? G.botChar.img    : G.playerChar.img;
  const bSrc          = bIsShadow && G.playerChar.img ? G.playerChar.img : G.botChar.img;
  const pImgStyle     = pIsShadow ? ` style="filter:${shadowFilter};"` : '';
  const bImgStyle     = bIsShadow ? ` style="filter:${shadowFilter};"` : '';

  const pDead = G.playerChar.hp <= 0;
  const bDead = G.botChar.hp   <= 0;
  const pImg  = pSrc ? `<img class="modal-char-img" src="${pSrc}"${pImgStyle}>` : `<div class="modal-char-img-placeholder" style="background:${pPortraitBg};">${G.playerChar.icon}</div>`;
  const bImg  = bSrc ? `<img class="modal-char-img" src="${bSrc}"${bImgStyle}>` : `<div class="modal-char-img-placeholder" style="background:${bPortraitBg};">${G.botChar.icon}</div>`;

  document.getElementById('modal-stats').innerHTML = buildModalStatsHTML({
    pImg, bImg,
    pDeadOverlay: pDead ? `<div class="modal-dead-overlay">💀</div>` : '',
    bDeadOverlay: bDead ? `<div class="modal-dead-overlay">💀</div>` : '',
    pDead, bDead,
    pFactionColor, bFactionColor,
    pBorderColor: pDead ? '#7a0000' : pFactionColor,
    bBorderColor: bDead ? '#7a0000' : bFactionColor,
    timeStr, elapsed,
    isRetreat: false,
    winner
  });
  document.getElementById('modal-overlay').classList.remove('hidden');
}

/**
 * Called when the player clicks the retreat (🏳) button.
 * Confirms, stops the phase timer, and shows the escaped modal.
 */
function retreat() {
  if (G.gameOver) return;
  if (!confirm('Are you sure you would like to retreat? The match will end immediately.')) return;

  clearPhaseTimer();
  logMsg('system', '🏳️ You retreated from battle.');
  G.gameOver = true;

  const { battleFinal } = computeBattleScore(true);
  const creditsEarned = (typeof awardMatchCredits === 'function') ? awardMatchCredits(battleFinal, G.difficulty, 'retreat') : 0;

  const elapsed = Math.round((Date.now() - G.matchStartTime) / 1000);
  const mins    = Math.floor(elapsed / 60);
  const secs    = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const shadowFilter  = 'brightness(0.35) saturate(0.2) hue-rotate(200deg) contrast(1.3) sepia(0.4)';
  const rPFaction     = G.playerChar.faction === 'villain' ? 'var(--villain)' : 'var(--hero)';
  const rBFaction     = G.botChar.faction    === 'villain' ? 'var(--villain)' : 'var(--hero)';
  const rPPortBg      = G.playerChar.faction === 'villain' ? 'rgba(196,75,255,0.1)' : 'rgba(74,184,255,0.1)';
  const rBPortBg      = G.botChar.faction    === 'villain' ? 'rgba(196,75,255,0.1)' : 'rgba(74,184,255,0.1)';
  const rPIsShadow    = G.playerChar.name.startsWith('Dark ');
  const rBIsShadow    = G.botChar.name.startsWith('Dark ');
  const rPSrc         = rPIsShadow && G.botChar.img    ? G.botChar.img    : G.playerChar.img;
  const rBSrc         = rBIsShadow && G.playerChar.img ? G.playerChar.img : G.botChar.img;
  const rPImgStyle    = rPIsShadow ? ` style="filter:${shadowFilter};"` : '';
  const rBImgStyle    = rBIsShadow ? ` style="filter:${shadowFilter};"` : '';
  const rPImg         = rPSrc ? `<img class="modal-char-img" src="${rPSrc}"${rPImgStyle}>` : `<div class="modal-char-img-placeholder" style="background:${rPPortBg};">${G.playerChar.icon}</div>`;
  const rBImg         = rBSrc ? `<img class="modal-char-img" src="${rBSrc}"${rBImgStyle}>` : `<div class="modal-char-img-placeholder" style="background:${rBPortBg};">${G.botChar.icon}</div>`;

  document.getElementById('modal-title').textContent = '🏳️ ESCAPED';
  document.getElementById('modal-msg').textContent   = `You live to fight another battle. (${creditsEarned >= 0 ? '+' : ''}${creditsEarned} 💰)`;
  document.getElementById('modal-stats').innerHTML   = buildModalStatsHTML({
    pImg: rPImg, bImg: rBImg,
    pBorderColor: rPFaction, bBorderColor: rBFaction,
    pFactionColor: rPFaction, bFactionColor: rBFaction,
    timeStr, elapsed,
    isRetreat: true,
    winner: 'retreat'
  });
  document.getElementById('modal-overlay').classList.remove('hidden');
}
