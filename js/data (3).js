/**
 * data.js — Blast Battles revamp static data
 * No dependencies. Safe to import first.
 *
 * Locked v1 attributes per Blaster:
 *   speed    → Energy regen rate (ticks per 3s interval)
 *   stamina  → Max Energy capacity (Energy ceiling)
 *   strength → Damage output multiplier
 *   health   → Max HP
 *   endurance→ Matches playable before rest (meta-layer, persists via localStorage)
 *   xp       → Persistent progression (starts at 0, grows with use)
 *
 * Stubbed for later (do not use in v1 logic):
 *   movementSpeed, agility, precision, iq
 *
 * Squad: 5 Blasters per side.
 * Factions: 9 across 3 Eras (3 per Era: Hero / Villain / Neutral).
 * Alignments: Hero, Villain, Neutral, Bounty Hunter (flex).
 */

'use strict';

// ── Era & Faction registry ───────────────────────────────────────────────────

const ERAS = [
  { id: 'era1', name: 'The Shadow Age',  arc: 'Fall',       pgcAgc: 'PGC' },
  { id: 'era2', name: 'The Remnants',    arc: 'Wilderness', pgcAgc: 'AGC' },
  { id: 'era3', name: 'The Search',      arc: 'Exodus',     pgcAgc: 'AGC' },
];

const FACTIONS = [
  // Era I — Fall
  { id: 'alpha_agents',  name: 'Alpha Agents',   era: 'era1', alignment: 'hero',    synergy: 'Coordinated Strike' },
  { id: 'iron_dominion', name: 'Iron Dominion',  era: 'era1', alignment: 'villain', synergy: 'Unbreakable'        },
  { id: 'architects',    name: 'The Architects', era: 'era1', alignment: 'neutral', synergy: 'Countermeasures'    },
  // Era II — Wilderness
  { id: 'saviors',       name: 'The Saviors',    era: 'era2', alignment: 'hero',    synergy: 'Make Do'            },
  { id: 'conquerors',    name: 'The Conquerors', era: 'era2', alignment: 'villain', synergy: 'Spoils of War'      },
  { id: 'pirates',       name: 'The Pirates',    era: 'era2', alignment: 'neutral', synergy: 'Plunder'            },
  // Era III — Exodus
  { id: 'pioneers',      name: 'The Pioneers',   era: 'era3', alignment: 'hero',    synergy: 'Vanguard'           },
  { id: 'invaders',      name: 'The Invaders',   era: 'era3', alignment: 'villain', synergy: 'Alien Physiology'   },
  { id: 'fates',         name: 'The Fates',      era: 'era3', alignment: 'neutral', synergy: 'Foresight'          },
  // Era-less
  { id: 'bounty_hunter', name: 'Bounty Hunter',  era: null,   alignment: 'flex',    synergy: 'Highest Bidder'     },
];

// ── Blaster pool (27 + 3 Bounty Hunters = 30 total) ─────────────────────────
//
// Stat ranges (v1 baselines — tune via playtesting):
//   speed:    1–10   (higher = faster Energy regen)
//   stamina:  10–50  (Energy ceiling; also gates Energy regen)
//   strength: 1–10   (damage multiplier applied in combat.js)
//   health:   80–300 (raw HP pool)
//   endurance:3–10   (matches before rest; higher = more durable campaign runner)
//   xp:       starts at 0 for all
//
// Stubbed nulls (do not read in v1 logic):
//   movementSpeed, agility, precision, iq

const BLASTER_POOL = [

  // ── Era I · Alpha Agents (Hero) ───────────────────────────────────────────
  {
    id: 'aa1', name: 'Commander Voss',
    faction: 'alpha_agents', alignment: 'hero', era: 'era1',
    speed: 6, stamina: 35, strength: 7, health: 180, endurance: 8, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Rally — briefly boosts squad Energy regen for 1 match phase.',
    icon: '🎖️', img: null,
  },
  {
    id: 'aa2', name: 'Agent Sable',
    faction: 'alpha_agents', alignment: 'hero', era: 'era1',
    speed: 9, stamina: 25, strength: 5, health: 130, endurance: 6, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Vanish — next attack ignores enemy armor.',
    icon: '🕶️', img: null,
  },
  {
    id: 'aa3', name: 'Shield Warden',
    faction: 'alpha_agents', alignment: 'hero', era: 'era1',
    speed: 4, stamina: 45, strength: 6, health: 260, endurance: 10, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Bulwark — absorbs the next hit entirely for one ally.',
    icon: '🛡️', img: null,
  },

  // ── Era I · Iron Dominion (Villain) ──────────────────────────────────────
  {
    id: 'id1', name: 'Lord Kaine',
    faction: 'iron_dominion', alignment: 'villain', era: 'era1',
    speed: 3, stamina: 50, strength: 9, health: 290, endurance: 10, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Iron Fist — next hit deals bonus damage equal to 20% of own Health.',
    icon: '⚔️', img: null,
  },
  {
    id: 'id2', name: 'Enforcer Drak',
    faction: 'iron_dominion', alignment: 'villain', era: 'era1',
    speed: 5, stamina: 40, strength: 8, health: 220, endurance: 9, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Suppress — reduces target Energy regen by 50% for one phase.',
    icon: '🦾', img: null,
  },
  {
    id: 'id3', name: 'Wraith',
    faction: 'iron_dominion', alignment: 'villain', era: 'era1',
    speed: 8, stamina: 22, strength: 6, health: 140, endurance: 6, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Shadow Step — costs no Energy to act on next turn.',
    icon: '🥷', img: null,
  },

  // ── Era I · The Architects (Neutral) ─────────────────────────────────────
  {
    id: 'arc1', name: 'Seer Yuna',
    faction: 'architects', alignment: 'neutral', era: 'era1',
    speed: 7, stamina: 30, strength: 4, health: 150, endurance: 7, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: "Foresee — reveals the bot's next action before it resolves.",
    icon: '🔮', img: null,
  },
  {
    id: 'arc2', name: 'Null',
    faction: 'architects', alignment: 'neutral', era: 'era1',
    speed: 5, stamina: 35, strength: 6, health: 170, endurance: 7, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Countermeasure — cancels the next enemy ability.',
    icon: '🚫', img: null,
  },
  {
    id: 'arc3', name: 'The Curator',
    faction: 'architects', alignment: 'neutral', era: 'era1',
    speed: 4, stamina: 40, strength: 5, health: 200, endurance: 9, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Archive — restores one consumed item to the squad inventory.',
    icon: '📜', img: null,
  },

  // ── Era II · The Saviors (Hero) ───────────────────────────────────────────
  {
    id: 'sav1', name: 'Doc Reyes',
    faction: 'saviors', alignment: 'hero', era: 'era2',
    speed: 6, stamina: 30, strength: 3, health: 160, endurance: 8, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: "Field Patch — restores 30 HP to the squad's lowest-HP Blaster.",
    icon: '🩺', img: null,
  },
  {
    id: 'sav2', name: 'Grit',
    faction: 'saviors', alignment: 'hero', era: 'era2',
    speed: 5, stamina: 38, strength: 7, health: 210, endurance: 9, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Last Stand — when below 20% Health, Strength doubles.',
    icon: '💪', img: null,
  },
  {
    id: 'sav3', name: 'Beacon',
    faction: 'saviors', alignment: 'hero', era: 'era2',
    speed: 8, stamina: 28, strength: 4, health: 140, endurance: 7, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Signal Boost — next ally to act gains +3 Energy instantly.',
    icon: '📡', img: null,
  },

  // ── Era II · The Conquerors (Villain) ────────────────────────────────────
  {
    id: 'con1', name: 'Warlord Mace',
    faction: 'conquerors', alignment: 'villain', era: 'era2',
    speed: 4, stamina: 45, strength: 10, health: 250, endurance: 9, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Spoils — each hit refunds 2 Energy.',
    icon: '⚒️', img: null,
  },
  {
    id: 'con2', name: 'Siege',
    faction: 'conquerors', alignment: 'villain', era: 'era2',
    speed: 3, stamina: 50, strength: 9, health: 280, endurance: 10, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Bombard — deals damage to all enemies simultaneously.',
    icon: '💣', img: null,
  },
  {
    id: 'con3', name: 'Razor',
    faction: 'conquerors', alignment: 'villain', era: 'era2',
    speed: 9, stamina: 20, strength: 7, health: 120, endurance: 5, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Blitz — fires twice in one action at half Strength each.',
    icon: '⚡', img: null,
  },

  // ── Era II · The Pirates (Neutral) ───────────────────────────────────────
  {
    id: 'pir1', name: 'Captain Fenn',
    faction: 'pirates', alignment: 'neutral', era: 'era2',
    speed: 7, stamina: 32, strength: 6, health: 170, endurance: 7, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Plunder — on KO, steals one consumable from the enemy squad.',
    icon: '🏴‍☠️', img: null,
  },
  {
    id: 'pir2', name: 'Powder Keg',
    faction: 'pirates', alignment: 'neutral', era: 'era2',
    speed: 6, stamina: 30, strength: 8, health: 155, endurance: 6, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Detonate — sacrifices 5 HP to deal 15 bonus damage.',
    icon: '💥', img: null,
  },
  {
    id: 'pir3', name: 'Navigator',
    faction: 'pirates', alignment: 'neutral', era: 'era2',
    speed: 8, stamina: 26, strength: 4, health: 130, endurance: 7, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Chart Course — next ally acts with +20% Energy efficiency.',
    icon: '🧭', img: null,
  },

  // ── Era III · The Pioneers (Hero) ────────────────────────────────────────
  {
    id: 'pio1', name: 'Trailblazer',
    faction: 'pioneers', alignment: 'hero', era: 'era3',
    speed: 7, stamina: 33, strength: 6, health: 175, endurance: 8, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Vanguard — first action each match costs 0 Energy.',
    icon: '🌅', img: null,
  },
  {
    id: 'pio2', name: 'Ironside',
    faction: 'pioneers', alignment: 'hero', era: 'era3',
    speed: 4, stamina: 44, strength: 7, health: 240, endurance: 10, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Fortify — reduces all incoming damage by 25% for one phase.',
    icon: '🪨', img: null,
  },
  {
    id: 'pio3', name: 'Scout',
    faction: 'pioneers', alignment: 'hero', era: 'era3',
    speed: 10, stamina: 20, strength: 4, health: 110, endurance: 6, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Reconnaissance — reveals enemy loadout for one phase.',
    icon: '🔭', img: null,
  },

  // ── Era III · The Invaders (Villain) ─────────────────────────────────────
  {
    id: 'inv1', name: 'Overlord Zyx',
    faction: 'invaders', alignment: 'villain', era: 'era3',
    speed: 5, stamina: 42, strength: 8, health: 200, endurance: 8, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: "Dominate — forces the enemy's lowest-Energy Blaster to skip next action.",
    icon: '👾', img: null,
  },
  {
    id: 'inv2', name: 'Swarm',
    faction: 'invaders', alignment: 'villain', era: 'era3',
    speed: 8, stamina: 22, strength: 5, health: 115, endurance: 5, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Multiply — spawns a weak copy that absorbs one hit.',
    icon: '🐝', img: null,
  },
  {
    id: 'inv3', name: 'Void',
    faction: 'invaders', alignment: 'villain', era: 'era3',
    speed: 6, stamina: 35, strength: 7, health: 165, endurance: 7, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Drain — steals 3 Energy from the active enemy Blaster.',
    icon: '🌑', img: null,
  },

  // ── Era III · The Fates (Neutral) ────────────────────────────────────────
  {
    id: 'fat1', name: 'Oracle',
    faction: 'fates', alignment: 'neutral', era: 'era3',
    speed: 6, stamina: 32, strength: 4, health: 150, endurance: 7, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Decree — locks one enemy card for 2 phases.',
    icon: '⚖️', img: null,
  },
  {
    id: 'fat2', name: 'Loom',
    faction: 'fates', alignment: 'neutral', era: 'era3',
    speed: 5, stamina: 38, strength: 5, health: 180, endurance: 8, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: "Reweave — resets one ally's Energy bar to full.",
    icon: '🧵', img: null,
  },
  {
    id: 'fat3', name: 'The Severed',
    faction: 'fates', alignment: 'neutral', era: 'era3',
    speed: 7, stamina: 28, strength: 6, health: 145, endurance: 6, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Cut Thread — removes all buffs from one enemy Blaster.',
    icon: '✂️', img: null,
  },

  // ── Bounty Hunters (Era-less · Flex alignment) ───────────────────────────
  {
    id: 'bh1', name: 'Dex',
    faction: 'bounty_hunter', alignment: 'flex', era: null,
    speed: 8, stamina: 28, strength: 7, health: 155, endurance: 7, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Mercenary — copies the active ability of the last ally to act.',
    icon: '🎯', img: null,
  },
  {
    id: 'bh2', name: 'Marrow',
    faction: 'bounty_hunter', alignment: 'flex', era: null,
    speed: 6, stamina: 33, strength: 8, health: 170, endurance: 7, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: "Headhunter — deals +30% damage to the enemy's highest-Health Blaster.",
    icon: '💀', img: null,
  },
  {
    id: 'bh3', name: 'Echo',
    faction: 'bounty_hunter', alignment: 'flex', era: null,
    speed: 9, stamina: 24, strength: 5, health: 130, endurance: 6, xp: 0,
    movementSpeed: null, agility: null, precision: null, iq: null,
    ability: 'Mimic — after being hit, reflects 15% of damage back to attacker.',
    icon: '🪞', img: null,
  },
];

// ── Weapon pool ──────────────────────────────────────────────────────────────
// range:      0=melee, 1=close, 2=mid, 3=long
// energyCost: flat tier by weapon type
//   melee, pistol, smg  → 1
//   assault_rifle       → 2
//   shotgun, revolver   → 3
//   sniper, explosive, missile → 4
// damage:     base value — multiplied by Strength in combat.js
// fireSpeed:  delay in seconds (base — Precision modifies later)

const WEAPON_ENERGY_COST = {
  melee:         1,
  pistol:        1,
  smg:           1,
  assault_rifle: 2,
  shotgun:       3,
  revolver:      3,
  sniper:        4,
  explosive:     5,
  missile:       5,
};

const WEAPON_POOL = [
  // Melee (range 0) — cost 1
  { id: 'w1',  name: 'Combat Knife',  subtype: 'melee',         range: 0, damage: 18, energyCost: 1, fireSpeed: 0.6, icon: '🗡️' },
  { id: 'w2',  name: 'War Hammer',    subtype: 'melee',         range: 0, damage: 35, energyCost: 1, fireSpeed: 1.4, icon: '🔨' },
  { id: 'w3',  name: 'Katana',        subtype: 'melee',         range: 0, damage: 28, energyCost: 1, fireSpeed: 1.0, icon: '⚔️' },
  // Pistols (range 1) — cost 1
  { id: 'w4',  name: 'Glock 18',      subtype: 'pistol',        range: 1, damage: 15, energyCost: 1, fireSpeed: 0.7, icon: '🔫' },
  { id: 'w5',  name: 'Desert Eagle',  subtype: 'pistol',        range: 1, damage: 28, energyCost: 1, fireSpeed: 1.1, icon: '🔫' },
  // Revolvers (range 1) — cost 3
  { id: 'w6',  name: 'Magnum .357',   subtype: 'revolver',      range: 1, damage: 32, energyCost: 3, fireSpeed: 1.2, icon: '🔫' },
  // Shotguns (range 1) — cost 3
  { id: 'w7',  name: 'SPAS-12',       subtype: 'shotgun',       range: 1, damage: 42, energyCost: 3, fireSpeed: 1.3, icon: '🪃' },
  { id: 'w8',  name: 'AA-12 Auto',    subtype: 'shotgun',       range: 1, damage: 30, energyCost: 3, fireSpeed: 1.0, icon: '🪃' },
  // Assault Rifles (range 2) — cost 2
  { id: 'w9',  name: 'M4A1',          subtype: 'assault_rifle', range: 2, damage: 25, energyCost: 2, fireSpeed: 1.0, icon: '🎯' },
  { id: 'w10', name: 'AK-47',         subtype: 'assault_rifle', range: 2, damage: 32, energyCost: 2, fireSpeed: 1.2, icon: '🎯' },
  { id: 'w11', name: 'SCAR-H',        subtype: 'assault_rifle', range: 2, damage: 30, energyCost: 2, fireSpeed: 1.1, icon: '🎯' },
  // Sniper Rifles (range 3) — cost 4
  { id: 'w12', name: 'AWP',           subtype: 'sniper',        range: 3, damage: 65, energyCost: 4, fireSpeed: 2.0, icon: '🔭' },
  { id: 'w13', name: 'Barrett M82',   subtype: 'sniper',        range: 3, damage: 55, energyCost: 4, fireSpeed: 1.8, icon: '🔭' },
  // Explosives (range 1–2) — cost 5
  { id: 'w14', name: 'Frag Grenade',  subtype: 'explosive',     range: 1, damage: 45, energyCost: 5, fireSpeed: 1.5, icon: '💣' },
  { id: 'w15', name: 'RPG-7',         subtype: 'missile',       range: 2, damage: 70, energyCost: 5, fireSpeed: 2.2, icon: '🚀' },
];

// ── Armor pool ───────────────────────────────────────────────────────────────
// defense:     flat damage reduction per hit
// durability:  hits before breaking
// effectiveVs: subtypes where full defense applies (40% reduction otherwise)
// healAmount:  > 0 means healing item (defense ignored)

const ARMOR_POOL = [
  { id: 'a1', name: 'Kevlar Vest',   subtype: 'vest',        defense: 30, durability: 3, effectiveVs: ['pistol','revolver','assault_rifle','shotgun'],                                    healAmount: 0,  icon: '🛡️' },
  { id: 'a2', name: 'Tactical Vest', subtype: 'vest',        defense: 40, durability: 3, effectiveVs: ['pistol','revolver','assault_rifle','shotgun'],                                    healAmount: 0,  icon: '🛡️' },
  { id: 'a3', name: 'Riot Shield',   subtype: 'plate_armor', defense: 35, durability: 6, effectiveVs: ['pistol','revolver','assault_rifle','shotgun','sniper','explosive','missile','melee'], healAmount: 0, icon: '🔰' },
  { id: 'a4', name: 'Combat Helmet', subtype: 'helmet',      defense: 40, durability: 3, effectiveVs: ['sniper'],                                                                        healAmount: 0,  icon: '⛑️' },
  { id: 'a5', name: 'Blast Suit',    subtype: 'blast_armor', defense: 50, durability: 3, effectiveVs: ['explosive','missile'],                                                           healAmount: 0,  icon: '🦺' },
  { id: 'a6', name: 'Med Kit',       subtype: 'medkit',      defense: 0,  durability: 1, effectiveVs: [],                                                                               healAmount: 50, icon: '🏥' },
  { id: 'a7', name: 'Syringe',       subtype: 'syringe',     defense: 0,  durability: 1, effectiveVs: [],                                                                               healAmount: 30, icon: '💉' },
  { id: 'a8', name: 'Bandages',      subtype: 'bandage',     defense: 0,  durability: 1, effectiveVs: [],                                                                               healAmount: 20, icon: '🩹' },
];

// ── Gadget pool (Permanent — 1 slot per Blaster) ─────────────────────────────
// type:   'passive' (always on) | 'triggered' (costs Energy to activate)
// effect: string key read by combat.js / game-state.js

const GADGET_POOL = [
  { id: 'g1', name: 'Adrenaline Injector', type: 'passive',   effect: 'endurance_regen_boost', desc: '+1 Endurance regen per rest cycle.',            icon: '💉' },
  { id: 'g2', name: 'Energy Cell',         type: 'passive',   effect: 'energy_regen_boost',    desc: 'Energy ticks every 2.5s instead of 3s.',        icon: '🔋' },
  { id: 'g3', name: 'Armor Weave',         type: 'passive',   effect: 'damage_reduction',      desc: 'Reduces all incoming damage by 10%.',            icon: '🧱' },
  { id: 'g4', name: 'Combat Stim',         type: 'triggered', effect: 'strength_boost',        desc: 'Spend 4 Energy → +50% Strength for one action.', icon: '⚡' },
  { id: 'g5', name: 'Shield Emitter',      type: 'triggered', effect: 'absorb_next_hit',       desc: 'Spend 5 Energy → absorb the next hit entirely.',  icon: '🔵' },
];

// ── Consumable pool (shared squad inventory, 1–5 slots) ─────────────────────
// Usable on any Blaster's turn during a match.
// Slots start at 1, unlock up to 5 via Chapter milestones.

const CONSUMABLE_POOL = [
  { id: 'c1', name: 'Full Restore',  effect: 'heal_full',       desc: "Fully restores one Blaster's HP.",           icon: '❤️'  },
  { id: 'c2', name: 'Energy Drink',  effect: 'energy_refill',   desc: "Instantly fills one Blaster's Energy bar.",  icon: '🥤'  },
  { id: 'c3', name: 'Stamina Tonic', effect: 'stamina_restore', desc: 'Restores Stamina cap to max for one Blaster.',icon: '🧪'  },
  { id: 'c4', name: 'Smoke Screen',  effect: 'enemy_blind',     desc: 'Enemy squad misses their next action.',      icon: '💨'  },
  { id: 'c5', name: 'Defibrillator', effect: 'revive',          desc: "Revives one KO'd Blaster at 25% HP.",        icon: '⚡'  },
];

// ── Location pool (5×5 grid — 25 tiles) ─────────────────────────────────────
// Held structurally identical to v1; effects re-evaluated after movement redesign.

const LOCATION_POOL = [
  { id: 'l1',  name: 'Neutral Zone',   effect: 'neutral',      effectDesc: 'No special effect',         icon: '⬜', css: 'neutral'      },
  { id: 'l2',  name: 'Hero Sanctum',   effect: 'hero_zone',    effectDesc: '+25% dmg for heroes',       icon: '🦸', css: 'hero-zone'    },
  { id: 'l3',  name: 'Villain Den',    effect: 'villain_zone', effectDesc: '+25% dmg for villains',     icon: '🦹', css: 'villain-zone' },
  { id: 'l4',  name: 'The Armory',     effect: 'draw_weapon',  effectDesc: 'Draw a weapon card',        icon: '⚔️', css: 'buff'         },
  { id: 'l5',  name: 'The Forge',      effect: 'draw_armor',   effectDesc: 'Draw an armor card',        icon: '⚒️', css: 'buff'         },
  { id: 'l6',  name: 'Radiation Zone', effect: 'radiation',    effectDesc: '-5 HP per tick here',       icon: '☢️', css: 'danger'       },
  { id: 'l7',  name: 'Stink Swamp',    effect: 'radiation',    effectDesc: '-5 HP per tick here',       icon: '🍄', css: 'danger'       },
  { id: 'l8',  name: 'Scrap Heap',     effect: 'discard',      effectDesc: 'Optionally discard 1 card', icon: '🗑️', css: 'neutral'      },
  { id: 'l9',  name: 'The Hospital',   effect: 'heal',         effectDesc: '+3 HP per tick here',       icon: '❤️‍🩹', css: 'buff'     },
  { id: 'l10', name: 'Bunker',         effect: 'neutral',      effectDesc: 'No special effect',         icon: '🕳️', css: 'neutral'      },
  { id: 'l11', name: 'Crossroads',     effect: 'neutral',      effectDesc: 'No special effect',         icon: '🔀', css: 'neutral'      },
  { id: 'l12', name: 'Fire Zone',      effect: 'radiation',    effectDesc: '-5 HP per tick here',       icon: '🔥', css: 'danger'       },
  { id: 'l13', name: 'Supply Depot',   effect: 'draw_weapon',  effectDesc: 'Draw a weapon card',        icon: '📦', css: 'buff'         },
  { id: 'l14', name: 'Medic Post',     effect: 'draw_armor',   effectDesc: 'Draw an armor card',        icon: '🏥', css: 'buff'         },
  { id: 'l15', name: 'Light Room',     effect: 'hero_zone',    effectDesc: '+25% dmg for heroes',       icon: '☀️', css: 'hero-zone'    },
  { id: 'l16', name: 'Dark Alley',     effect: 'villain_zone', effectDesc: '+25% dmg for villains',     icon: '🌑', css: 'villain-zone' },
  { id: 'l17', name: 'Ruined City',    effect: 'neutral',      effectDesc: 'No special effect',         icon: '🏚️', css: 'neutral'      },
  { id: 'l18', name: 'Toxic Waste',    effect: 'radiation',    effectDesc: '-5 HP per tick here',       icon: '☣️', css: 'danger'       },
  { id: 'l19', name: 'Power Station',  effect: 'heal',         effectDesc: '+3 HP per tick here',       icon: '⚡', css: 'buff'         },
  { id: 'l20', name: 'Open Field',     effect: 'neutral',      effectDesc: 'No special effect',         icon: '🌾', css: 'neutral'      },
  { id: 'l21', name: 'Sniper Nest',    effect: 'sniper_nest',  effectDesc: 'Snipers +33% dmg here',     icon: '🎯', css: 'buff'         },
  { id: 'l22', name: 'Crash Site',     effect: 'neutral',      effectDesc: 'No special effect',         icon: '💥', css: 'neutral'      },
  { id: 'l23', name: 'Watch Tower',    effect: 'sniper_nest',  effectDesc: 'Snipers +33% dmg here',     icon: '👀', css: 'buff'         },
  { id: 'l24', name: 'Tech Lab',       effect: 'draw_weapon',  effectDesc: 'Draw a weapon card',        icon: '🔬', css: 'buff'         },
  { id: 'l25', name: 'Safe Room',      effect: 'draw_armor',   effectDesc: 'Draw an armor card',        icon: '🔒', css: 'buff'         },
];

// ── Synergy config ───────────────────────────────────────────────────────────

const SYNERGY_THRESHOLDS = [2, 3, 4, 5];

const UNITED_FRONT_BONUS = {
  effect: 'united_front',
  desc: 'All-alignment squad: passive counter-attack chance + Fallen But Not Forgotten on first KO.',
  counterAttackChance: 0.20,
};

// ── System constants ─────────────────────────────────────────────────────────

const ENDURANCE_COST_PER_MATCH  = 1;       // flat drain per match attempt (meta)
const ENERGY_LOCKOUT_THRESHOLD  = 0.15;    // locked out below 15% of Stamina
const ABILITY_DRAIN_AMOUNT      = 0.60;    // ability drains 60% of current Energy
const MAX_TURNS                 = 15;      // turn cap before tiebreaker
const ENERGY_CARRY_OVER         = 1;       // Energy banked per round (always exactly 1)
const ENERGY_BANK_CAP           = 3;       // max Energy storable across rounds
const CONSUMABLE_SLOTS_START    = 1;       // starting squad consumable slots
const CONSUMABLE_SLOTS_MAX      = 5;       // hard cap unlockable via milestones
