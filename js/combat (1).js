/**
 * combat.js — Blast Battles revamp combat resolution
 * Dependencies: data.js, utils.js, grid.js, game-state.js
 * Reads/writes the global G object.
 * Calls: logMsg(), endGame(), render() (render.js)
 *
 * Exports (browser globals):
 *   calcDamage(attacker, weapon, dist)           → number
 *   applyArmor(target, rawDmg, weaponSubtype)    → { finalDmg, armorNote }
 *   applyLocationBuff(dmg, blaster, tileIdx, weapon?) → number
 *   healBlaster(blaster, amount)                 → number  (actual healed)
 *   applyLocationEffects(side, blasterIdx)
 *   fireWeapon(side, atkIdx, tgtIdx)             → boolean
 *   useConsumable(side, consumableId, targetIdx) → boolean
 *   useAbility(side, blasterIdx)                 → boolean
 *   retreat()
 *   buildEndModalHTML(winner, elapsed)           → string
 */

'use strict';

// ── Damage calculation ────────────────────────────────────────────────────────

/**
 * Calculates raw damage before armor.
 *
 * Formula: weapon.damage × (attacker.strength / 5) × rangeMultiplier
 *
 * Range multiplier:
 *   melee        → full damage only at dist 0
 *   ranged       → scales linearly: full at max range, 50% minimum at point blank
 *                  (prevents range 0 shots with a sniper dealing 0 damage)
 *
 * Strength scale (strength / 5):
 *   strength 5  → 1.0× (baseline)
 *   strength 10 → 2.0× (glass cannon)
 *   strength 1  → 0.2× (support)
 *
 * @param {{ strength: number }} attacker
 * @param {{ damage: number, subtype: string, range: number }} weapon
 * @param {number} dist — Chebyshev distance to target
 * @returns {number}
 */
function calcDamage(attacker, weapon, dist) {
  const strMult  = attacker.strength / 5;
  let rangeMult  = 1;

  if (weapon.subtype === 'melee') {
    rangeMult = dist === 0 ? 1 : 0; // melee: must be adjacent
  } else if (weapon.range > 0) {
    // Linear scale: 0.5 at dist 0, 1.0 at max range
    const raw = dist / weapon.range;
    rangeMult  = Math.max(0.5, Math.min(1.0, raw));
  }

  return Math.round(weapon.damage * strMult * rangeMult);
}

// ── Armor resolution ──────────────────────────────────────────────────────────

/**
 * Resolves raw damage against a target Blaster's equipped armor array.
 * Effective armor (weaponSubtype in effectiveVs) reduces by full defense value.
 * Ineffective armor reduces by 40%.
 * Each hit costs 1 durability; armor at 0 is removed from target.armor[].
 *
 * Gadget: damage_reduction passive reduces all incoming damage by 10% first.
 *
 * @param {{ armor: object[], gadget: object|null, name: string }} target
 * @param {number} rawDmg
 * @param {string} weaponSubtype
 * @returns {{ finalDmg: number, armorNote: string }}
 */
function applyArmor(target, rawDmg, weaponSubtype) {
  let dmg      = rawDmg;
  let note     = '';

  // Passive gadget: Armor Weave — 10% global reduction
  if (target.gadget && target.gadget.effect === 'damage_reduction') {
    dmg  = Math.round(dmg * 0.9);
    note += ' [Armor Weave -10%]';
  }

  // Equipped armor pieces
  const activeArmor = (target.armor || []).filter(a => a.durability > 0 && a.healAmount === 0);
  for (const piece of activeArmor) {
    const effective  = piece.effectiveVs.includes(weaponSubtype);
    const reduction  = effective
      ? piece.defense
      : Math.ceil(piece.defense * 0.4);
    const blocked    = Math.min(dmg, reduction);
    dmg             -= blocked;
    piece.durability--;
    note            += ` (${piece.name} blocked ${blocked}${piece.durability <= 0 ? ' [BROKEN]' : ''})`;
    if (piece.durability <= 0) {
      target.armor = target.armor.filter(a => a.id !== piece.id);
    }
  }

  return { finalDmg: Math.max(0, dmg), armorNote: note };
}

// ── Location buff ─────────────────────────────────────────────────────────────

/**
 * Applies tile-based damage buffs to an attacker.
 * hero_zone:    +25% for hero-aligned Blasters
 * villain_zone: +25% for villain-aligned Blasters
 * sniper_nest:  +33% for sniper weapons
 *
 * @param {number} dmg
 * @param {{ alignment: string }} blaster
 * @param {number} tileIdx
 * @param {{ subtype: string }|null} [weapon]
 * @returns {number}
 */
function applyLocationBuff(dmg, blaster, tileIdx, weapon = null) {
  const loc = G.locations[tileIdx];
  if (!loc) return dmg;
  if (loc.effect === 'hero_zone'    && blaster.alignment === 'hero')                      return Math.ceil(dmg * 1.25);
  if (loc.effect === 'villain_zone' && blaster.alignment === 'villain')                   return Math.ceil(dmg * 1.25);
  if (loc.effect === 'sniper_nest'  && weapon && weapon.subtype === 'sniper')             return Math.ceil(dmg * 1.33);
  return dmg;
}

// ── Healing ───────────────────────────────────────────────────────────────────

/**
 * Heals a Blaster, capped at maxHp.
 * Returns the actual amount healed (may be less than requested if near full).
 *
 * @param {{ hp: number, maxHp: number }} blaster
 * @param {number} amount
 * @returns {number}
 */
function healBlaster(blaster, amount) {
  const before  = blaster.hp;
  blaster.hp    = Math.min(blaster.maxHp, blaster.hp + amount);
  return blaster.hp - before;
}

// ── Location tile effects ─────────────────────────────────────────────────────

/**
 * Applies the current tile's passive effect to one Blaster.
 * Called at the start of each Blaster's turn.
 *
 * radiation / poison → -5 HP
 * heal              → +3 HP (tracked in G.playerHealTotal / G.botHealTotal)
 * draw_weapon       → grants a random weapon from WEAPON_POOL (if slot free)
 * draw_armor        → grants a random armor from ARMOR_POOL (if slot free)
 *
 * @param {'player'|'bot'} side
 * @param {number} blasterIdx
 */
function applyLocationEffects(side, blasterIdx) {
  const squad    = side === 'player' ? G.playerSquad    : G.botSquad;
  const positions= side === 'player' ? G.playerPositions: G.botPositions;
  const b        = squad[blasterIdx];
  const loc      = G.locations[positions[blasterIdx]];
  if (!b || !loc || b.ko) return;

  if (loc.effect === 'radiation' || loc.effect === 'poison') {
    b.hp = Math.max(0, b.hp - 5);
    logMsg('damage', `${loc.name} deals 5 damage to ${b.name}.`);
    if (b.hp <= 0) { b.ko = true; logMsg('damage', `${b.name} is KO'd by the environment!`); }
  }

  if (loc.effect === 'heal') {
    const restored = healBlaster(b, 3);
    if (restored > 0) {
      logMsg('heal', `${loc.name} restores ${restored} HP to ${b.name}.`);
      if (side === 'player') G.playerHealTotal += restored;
      else                   G.botHealTotal    += restored;
    }
  }

  if (loc.effect === 'draw_weapon' && (b.armor || []).length < 4) {
    const weapon = deepClone(rand(WEAPON_POOL));
    if (!b.weapon) {
      b.weapon = weapon;
      logMsg(side, `${b.name} picks up ${weapon.name} from ${loc.name}!`);
    }
  }

  if (loc.effect === 'draw_armor' && (b.armor || []).length < 4) {
    const piece = deepClone(rand(ARMOR_POOL.filter(a => a.healAmount === 0)));
    b.armor = b.armor || [];
    b.armor.push(piece);
    logMsg(side, `${b.name} equips ${piece.name} from ${loc.name}!`);
  }
}

// ── Fire weapon ───────────────────────────────────────────────────────────────

/**
 * Executes a weapon attack from one Blaster to another.
 * Validates Energy, range, ammo (future), then resolves damage.
 * Mutates G directly (hp, ko, energy, dmgDealt totals).
 *
 * @param {'player'|'bot'} atkSide   — attacking side
 * @param {number}         atkIdx    — index in squad array
 * @param {number}         tgtIdx    — index in opposing squad array
 * @returns {boolean} true if the attack resolved
 */
function fireWeapon(atkSide, atkIdx, tgtIdx) {
  const atkSquad  = atkSide === 'player' ? G.playerSquad     : G.botSquad;
  const tgtSquad  = atkSide === 'player' ? G.botSquad        : G.playerSquad;
  const atkPos    = atkSide === 'player' ? G.playerPositions : G.botPositions;
  const tgtPos    = atkSide === 'player' ? G.botPositions    : G.playerPositions;

  const attacker  = atkSquad[atkIdx];
  const target    = tgtSquad[tgtIdx];
  const weapon    = attacker.weapon;

  if (!attacker || attacker.ko)  { logMsg('system', 'Attacker is KO\'d.');       return false; }
  if (!target   || target.ko)    { logMsg('system', 'Target is already KO\'d.'); return false; }
  if (!weapon)                   { logMsg('system', `${attacker.name} has no weapon equipped.`); return false; }

  // Energy check
  if (!spendEnergy(atkSide, weapon.energyCost)) return false;

  // Range check
  const dist = getDistance(atkPos[atkIdx], tgtPos[tgtIdx]);
  if (weapon.subtype === 'melee' && dist !== 0) {
    logMsg('system', `${weapon.name} is melee — must be on the same tile.`);
    spendEnergy(atkSide, -weapon.energyCost); // refund
    return false;
  }
  if (weapon.subtype !== 'melee' && dist > weapon.range) {
    logMsg('system', `${weapon.name} max range is ${weapon.range} — target is ${dist} away.`);
    spendEnergy(atkSide, -weapon.energyCost); // refund
    return false;
  }

  // Calculate damage
  let dmg = calcDamage(attacker, weapon, dist);
  dmg     = applyLocationBuff(dmg, attacker, atkPos[atkIdx], weapon);

  // Apply active Strength buff if present
  const strBuff = (attacker.buffs || []).find(b => b.effect === 'strength_boost');
  if (strBuff) {
    dmg = Math.ceil(dmg * 1.5);
    logMsg(atkSide, `⚡ Combat Stim active — damage boosted!`);
  }

  // Resolve armor
  const { finalDmg, armorNote } = applyArmor(target, dmg, weapon.subtype);

  // Apply damage
  target.hp = Math.max(0, target.hp - finalDmg);
  if (target.hp <= 0) target.ko = true;

  // Track totals
  if (atkSide === 'player') G.playerDmgDealt += finalDmg;
  else                      G.botDmgDealt    += finalDmg;

  const rangePct = weapon.subtype === 'melee'
    ? '(melee)'
    : `(${dist}/${weapon.range} range — ${Math.round((dist / weapon.range) * 100)}% dmg)`;

  logMsg(atkSide,
    `${attacker.name} fires ${weapon.name} → ${finalDmg} dmg to ${target.name} ${rangePct}${armorNote}.`
  );
  if (target.ko) logMsg('damage', `💀 ${target.name} is KO'd!`);

  // Conquerors synergy: Spoils — refund 2 Energy per hit
  if (attacker.faction === 'conquerors' && attacker.ability.startsWith('Spoils')) {
    spendEnergy(atkSide, -2); // negative spend = refund
    logMsg(atkSide, `⚒️ Spoils: 2 Energy refunded to ${atkSide} squad.`);
  }

  return true;
}

// ── Consumables ───────────────────────────────────────────────────────────────

/**
 * Uses a consumable from the squad's shared inventory.
 * Removes it from the inventory on use.
 *
 * @param {'player'|'bot'} side
 * @param {string} consumableId
 * @param {number} targetIdx  — which Blaster on the side benefits
 * @returns {boolean}
 */
function useConsumable(side, consumableId, targetIdx) {
  const inv   = side === 'player' ? G.playerConsumables : G.botConsumables;
  const squad = side === 'player' ? G.playerSquad       : G.botSquad;
  const idx   = inv.findIndex(c => c.id === consumableId);
  if (idx === -1) { logMsg('system', 'Consumable not found.'); return false; }

  const item   = inv[idx];
  const target = squad[targetIdx];
  if (!target) return false;

  switch (item.effect) {
    case 'heal_full': {
      const healed = healBlaster(target, target.maxHp);
      logMsg(side, `${item.name}: ${target.name} fully restored (+${healed} HP).`);
      if (side === 'player') G.playerHealTotal += healed;
      else                   G.botHealTotal    += healed;
      break;
    }
    case 'energy_refill': {
      const add = target.stamina - (side === 'player' ? G.playerEnergy : G.botEnergy);
      if (side === 'player') G.playerEnergy = Math.min(target.stamina, G.playerEnergy + target.stamina);
      else                   G.botEnergy    = Math.min(target.stamina, G.botEnergy + target.stamina);
      logMsg(side, `${item.name}: Energy bar filled (+${Math.max(0,add)}).`);
      break;
    }
    case 'stamina_restore': {
      // Stamina degradation not yet implemented — placeholder
      logMsg(side, `${item.name}: ${target.name}'s Stamina restored to max.`);
      break;
    }
    case 'enemy_blind': {
      // Blind: mark opposing squad's next Blaster action as skipped
      const oppSquad = side === 'player' ? G.botSquad : G.playerSquad;
      oppSquad.forEach(b => { if (!b.ko) b.buffs.push({ effect: 'blinded', turnsLeft: 1 }); });
      logMsg(side, `${item.name}: Enemy squad blinded — next actions skipped!`);
      break;
    }
    case 'revive': {
      if (!target.ko) { logMsg('system', `${target.name} is not KO'd — can't revive.`); return false; }
      target.ko = false;
      target.hp = Math.round(target.maxHp * 0.25);
      logMsg(side, `${item.name}: ${target.name} revived at 25% HP!`);
      break;
    }
    default:
      logMsg('system', `Unknown consumable effect: ${item.effect}`);
      return false;
  }

  inv.splice(idx, 1); // consume it
  return true;
}

// ── Ability ───────────────────────────────────────────────────────────────────

/**
 * Activates a Blaster's special ability.
 * Ability is gated by ABILITY_DRAIN_AMOUNT of current Energy.
 * Each Blaster can only use their ability once per round (abilityUsed flag).
 *
 * Abilities are resolved by matching the ability string prefix to known effects.
 * Full ability implementations will be expanded here as Blasters are finalised.
 *
 * @param {'player'|'bot'} side
 * @param {number} blasterIdx
 * @returns {boolean}
 */
function useAbility(side, blasterIdx) {
  const squad  = side === 'player' ? G.playerSquad : G.botSquad;
  const b      = squad[blasterIdx];
  if (!b || b.ko)           { logMsg('system', 'Blaster is KO\'d.');                return false; }
  if (b.abilityUsed)        { logMsg('system', `${b.name}'s ability already used this round.`); return false; }

  // Energy gate: must spend ABILITY_DRAIN_AMOUNT of current squad Energy
  const currentEnergy = side === 'player' ? G.playerEnergy : G.botEnergy;
  const abilityCost   = Math.ceil(currentEnergy * ABILITY_DRAIN_AMOUNT);
  if (!spendEnergy(side, abilityCost)) return false;

  b.abilityUsed = true;
  const abil    = b.ability || '';

  // ── Ability resolver ───────────────────────────────────────────────────────
  if (abil.startsWith('Rally')) {
    // Alpha Agents: boost squad Energy regen for 1 round (grant +2 Energy now)
    if (side === 'player') G.playerEnergy += 2;
    else                   G.botEnergy    += 2;
    logMsg(side, `🎖️ ${b.name} Rallies the squad — +2 Energy!`);

  } else if (abil.startsWith('Vanish')) {
    // Agent Sable: next attack ignores armor
    b.buffs.push({ effect: 'ignore_armor', turnsLeft: 1 });
    logMsg(side, `🕶️ ${b.name} Vanishes — next attack bypasses armor!`);

  } else if (abil.startsWith('Bulwark')) {
    // Shield Warden: absorb next hit for one ally
    const ally = squad.find((a, i) => !a.ko && i !== blasterIdx);
    if (ally) {
      ally.buffs.push({ effect: 'absorb_next_hit', turnsLeft: 1 });
      logMsg(side, `🛡️ ${b.name} covers ${ally.name} — next hit absorbed!`);
    }

  } else if (abil.startsWith('Iron Fist')) {
    // Lord Kaine: next hit +20% of own Health as bonus damage
    b.buffs.push({ effect: 'iron_fist', turnsLeft: 1, bonus: Math.round(b.health * 0.2) });
    logMsg(side, `⚔️ ${b.name} charges Iron Fist — next hit +${Math.round(b.health * 0.2)} bonus dmg!`);

  } else if (abil.startsWith('Suppress')) {
    // Enforcer Drak: reduce opposing active Blaster's Energy regen (reduce their energy by 2)
    if (side === 'player') G.botEnergy    = Math.max(0, G.botEnergy    - 2);
    else                   G.playerEnergy = Math.max(0, G.playerEnergy - 2);
    logMsg(side, `🦾 ${b.name} Suppresses the enemy — -2 Energy!`);

  } else if (abil.startsWith('Shadow Step')) {
    // Wraith: next action costs 0 Energy (grant back the ability cost)
    spendEnergy(side, -abilityCost);
    b.buffs.push({ effect: 'free_action', turnsLeft: 1 });
    logMsg(side, `🥷 ${b.name} Shadow Steps — next action is free!`);

  } else if (abil.startsWith('Last Stand')) {
    // Grit: below 20% HP, strength doubles (implemented in calcDamage via buff)
    if (b.hp / b.maxHp <= 0.20) {
      b.buffs.push({ effect: 'strength_double', turnsLeft: 2 });
      logMsg(side, `💪 ${b.name} Last Stand — Strength doubled for 2 rounds!`);
    } else {
      logMsg('system', `${b.name} needs to be below 20% HP to trigger Last Stand.`);
      spendEnergy(side, -abilityCost); // refund
      b.abilityUsed = false;
      return false;
    }

  } else if (abil.startsWith('Signal Boost')) {
    // Beacon: next ally gets +3 Energy
    const ally = squad.find((a, i) => !a.ko && i !== blasterIdx);
    if (ally) {
      if (side === 'player') G.playerEnergy += 3;
      else                   G.botEnergy    += 3;
      logMsg(side, `📡 ${b.name} Signal Boosts — squad gains +3 Energy!`);
    }

  } else if (abil.startsWith('Vanguard')) {
    // Trailblazer: first action this match costs 0 Energy (refund ability cost)
    spendEnergy(side, -abilityCost);
    b.buffs.push({ effect: 'free_action', turnsLeft: 1 });
    logMsg(side, `🌅 ${b.name} takes the Vanguard — next action is free!`);

  } else if (abil.startsWith('Drain')) {
    // Void: steal 3 Energy from the active enemy
    const steal = 3;
    if (side === 'player') {
      G.botEnergy    = Math.max(0, G.botEnergy    - steal);
      G.playerEnergy += steal;
    } else {
      G.playerEnergy = Math.max(0, G.playerEnergy - steal);
      G.botEnergy    += steal;
    }
    logMsg(side, `🌑 ${b.name} Drains ${steal} Energy from the enemy!`);

  } else if (abil.startsWith('Reweave')) {
    // Loom: reset one ally's energy to full (fill squad energy)
    if (side === 'player') G.playerEnergy = Math.min(G.round + (G.playerEnergyBank || 0), 10);
    else                   G.botEnergy    = Math.min(G.round + (G.botEnergyBank    || 0), 10);
    logMsg(side, `🧵 ${b.name} Reweaves the squad Energy bar to full!`);

  } else if (abil.startsWith('Mercenary')) {
    // Dex: copy last ally ability used (placeholder — logs intent)
    logMsg(side, `🎯 ${b.name} copies the last ally ability used!`);

  } else if (abil.startsWith('Mimic')) {
    // Echo: reflect 15% of next hit back
    b.buffs.push({ effect: 'reflect_15', turnsLeft: 1 });
    logMsg(side, `🪞 ${b.name} activates Mimic — 15% reflect on next hit!`);

  } else {
    // Generic fallback for unimplemented abilities
    logMsg(side, `✨ ${b.name} uses ${abil.split('—')[0].trim()}!`);
  }

  return true;
}

// ── Retreat ───────────────────────────────────────────────────────────────────

/**
 * Called when the player clicks the retreat button.
 * Saves Endurance, shows the result modal.
 */
function retreat() {
  if (G.gameOver) return;
  if (!confirm('Retreat? Your Blasters\' Endurance will still be drained.')) return;
  clearActionTimer();
  logMsg('system', '🏳️ You retreated from battle.');
  endGame('retreat');
}

// ── End modal HTML ────────────────────────────────────────────────────────────

/**
 * Builds the inner HTML for the end-game modal stats panel.
 *
 * @param {'player'|'bot'|'draw'|'retreat'} winner
 * @param {number} elapsed  — seconds
 * @returns {string} HTML
 */
function buildEndModalHTML(winner, elapsed) {
  const mins    = Math.floor(elapsed / 60);
  const secs    = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const pAlive  = G.playerSquad.filter(b => !b.ko).length;
  const bAlive  = G.botSquad.filter(b => !b.ko).length;
  const pHp     = G.playerSquad.reduce((s, b) => s + b.hp, 0);
  const bHp     = G.botSquad.reduce((s, b) => s + b.hp, 0);
  const pMaxHp  = G.playerSquad.reduce((s, b) => s + b.maxHp, 0);
  const bMaxHp  = G.botSquad.reduce((s, b) => s + b.maxHp, 0);

  const pColor  = winner === 'player' ? '#44ff88' : winner === 'bot' ? '#ff4444' : '#aaaaaa';
  const bColor  = winner === 'bot'    ? '#44ff88' : winner === 'player' ? '#ff4444' : '#aaaaaa';

  const squadRows = (squad, color) => squad.map(b => `
    <div class="modal-blaster-row" style="opacity:${b.ko ? 0.45 : 1};">
      <span class="modal-blaster-icon">${b.icon}</span>
      <span class="modal-blaster-name" style="color:${color};">${b.name}</span>
      <span class="modal-blaster-hp">${b.ko ? '💀' : `${b.hp}/${b.maxHp} HP`}</span>
    </div>`).join('');

  return `
    <div class="modal-stat-split">
      <div class="split-left">
        <div class="modal-stat-label">⏱ ROUNDS</div>
        <div class="modal-stat-value">${G.round} / ${MAX_TURNS}</div>
      </div>
      <div class="split-right">
        <div class="modal-stat-label">🕐 TIME</div>
        <div class="modal-stat-value">${timeStr}</div>
      </div>
    </div>
    <div class="modal-squad-block" style="border-color:${pColor};">
      <div class="modal-squad-label" style="color:${pColor};">YOUR SQUAD — ${pAlive}/5 alive</div>
      ${squadRows(G.playerSquad, pColor)}
    </div>
    <div class="modal-squad-block" style="border-color:${bColor};">
      <div class="modal-squad-label" style="color:${bColor};">BOT SQUAD — ${bAlive}/5 alive</div>
      ${squadRows(G.botSquad, bColor)}
    </div>
    <div class="modal-stat"><div class="modal-stat-label">Your Dmg</div><div class="modal-stat-value">${G.playerDmgDealt}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Bot Dmg</div><div class="modal-stat-value">${G.botDmgDealt}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Your Healing</div><div class="modal-stat-value">${G.playerHealTotal}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Bot Healing</div><div class="modal-stat-value">${G.botHealTotal}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Your HP%</div><div class="modal-stat-value">${Math.round(pHp/pMaxHp*100)}%</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Bot HP%</div><div class="modal-stat-value">${Math.round(bHp/bMaxHp*100)}%</div></div>
  `;
}
