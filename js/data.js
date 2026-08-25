/**
 * data.js — Blast Battles static data
 * No dependencies. Safe to import first.
 *
 * Exports (browser globals when loaded via <script>):
 *   SPEED_ORDER, PHASES,
 *   WEAPON_POOL, DEFENSE_POOL, GEAR_POOL, CHARACTER_POOL, LOCATION_POOL,
 *   ALL_EQUIPPABLE                — [...WEAPON_POOL, ...DEFENSE_POOL, ...GEAR_POOL], for Shop/Equip screens
 *   DEFAULT_OWNED_IDS             — starter-unlocked item ids (computed, see below)
 *   WEAPON_ATTRIBUTE_RESTRICTIONS — { attribute: allowedSubtype[] }
 *   getAllowedWeaponSubtypes(attribute) → string[] | null   (null = no restriction)
 *
 * ── Pricing ──────────────────────────────────────────────────────────────
 *   Weapon price  = (damage + ammo) × (range + REV_SPEED_FACTOR[speed])
 *                   REV_SPEED_FACTOR: charged=4, slow=3, medium=2, fast=1 —
 *                   heavier/slower-to-fire weapons cost more, same direction range pushes in.
 *   Defense price = defense × durability          (armor pieces)
 *   Heal price    = healAmount × 3                (medkits/syringes/bandages — defense is 0,
 *                                                   so the armor formula doesn't apply; this is
 *                                                   a judgment-call fallback, easy to change)
 *   Prices are computed from the formula rather than hardcoded, so they always match the stats.
 *
 * ── Equip slots ──────────────────────────────────────────────────────────
 * Every equippable item carries a `slot` field:
 *   'hand'  (×2, flexible)  — weapons, shields, healing items — chosen pre-match, becomes starting hand
 *   'head'  (×1)  — helmets, masks, goggles — passive, pre-equipped into *InPlay at match start
 *   'chest' (×1)  — vests, plate armor, jacket — passive, pre-equipped
 *   'legs'  (×1)  — pants/leggings — passive, pre-equipped
 *   'feet'  (×1)  — boots/sneakers — passive, pre-equipped
 *   'arm'   (×2)  — elbow pads, sleeves, gauntlets — passive, pre-equipped
 * All slot items (except hand-slot weapons) share the DEFENSE_POOL shape, so they plug directly
 * into the existing armor-resolution logic in combat.js — and are subject to the SAME "2 equipped
 * defense items max" rule already enforced in-match (see game-state.js playerPlayCard). The Equip
 * screen enforces this too — see equip.js.
 *
 * ── Weapon restrictions ────────────────────────────────────────────────────
 * Some characters can only ever fire certain weapon subtypes (mirrors the existing in-match
 * checks in game-state.js/render.js isCardPlayable). The Equip screen uses
 * getAllowedWeaponSubtypes() to hide/grey out weapons a character isn't allowed to equip
 * (e.g. Lunging Logan can't take a gun into a hand slot — melee only).
 */

'use strict';

// ── Phase ordering ──────────────────────────────────────────────────────────
const SPEED_ORDER = ['fast', 'medium', 'slow', 'charged'];
const PHASES = ['fast', 'medium', 'slow', 'charged'];

// ── Weapon cards (30) ───────────────────────────────────────────────────────
// All weapons live in the 2 flexible HAND slots (see GEAR_POOL for body slots).
const WEAPON_POOL_BASE = [
  // Pistols (range 1)
  { id: 'w1', name: 'Desert Eagle', type: 'weapon', subtype: 'pistol', damage: 42, ammo: 7, speed: 'medium', range: 1, icon: '🔫', slot: 'hand' },
  { id: 'w2', name: 'Glock 18', type: 'weapon', subtype: 'pistol', damage: 18, ammo: 18, speed: 'fast', range: 1, icon: '🔫', slot: 'hand' },
  { id: 'w3', name: 'Magnum .357', type: 'weapon', subtype: 'revolver', damage: 35, ammo: 7, speed: 'slow', range: 1, icon: '🔫', slot: 'hand' },
  { id: 'w4', name: 'M9', type: 'weapon', subtype: 'pistol', damage: 20, ammo: 5, speed: 'medium', range: 1, icon: '🔫', slot: 'hand' },
  { id: 'w5', name: 'Magnum .44', type: 'weapon', subtype: 'revolver', damage: 40, ammo: 4, speed: 'slow', range: 1, icon: '🔫', slot: 'hand' },
  // Shotguns (range 1)
  { id: 'w6', name: 'SPAS-12', type: 'weapon', subtype: 'shotgun', damage: 64, ammo: 5, speed: 'slow', range: 1, icon: '🪃', slot: 'hand' },
  { id: 'w7', name: 'Mossberg 500', type: 'weapon', subtype: 'shotgun', damage: 56, ammo: 4, speed: 'slow', range: 1, icon: '🪃', slot: 'hand' },
  { id: 'w8', name: 'AA-12 Auto', type: 'weapon', subtype: 'shotgun', damage: 38, ammo: 8, speed: 'medium', range: 1, icon: '🪃', slot: 'hand' },
  // Assault Rifles (range 2)
  { id: 'w9', name: 'M4A1', type: 'weapon', subtype: 'assault_rifle', damage: 34, ammo: 10, speed: 'medium', range: 2, icon: '🎯', slot: 'hand' },
  { id: 'w10', name: 'AK-47', type: 'weapon', subtype: 'assault_rifle', damage: 47, ammo: 12, speed: 'slow', range: 2, icon: '🎯', slot: 'hand' },
  { id: 'w11', name: 'SCAR-H', type: 'weapon', subtype: 'assault_rifle', damage: 44, ammo: 7, speed: 'medium', range: 2, icon: '🎯', slot: 'hand' },
  { id: 'w12', name: 'Honey Badger', type: 'weapon', subtype: 'assault_rifle', damage: 32, ammo: 12, speed: 'fast', range: 2, icon: '🎯', slot: 'hand' },
  // Sniper Rifles (range 3)
  { id: 'w13', name: 'Barrett M82', type: 'weapon', subtype: 'sniper', damage: 82, ammo: 4, speed: 'charged', range: 3, icon: '🎯', slot: 'hand' },
  { id: 'w14', name: 'Dragunov SVD', type: 'weapon', subtype: 'sniper', damage: 65, ammo: 5, speed: 'slow', range: 3, icon: '🎯', slot: 'hand' },
  { id: 'w15', name: 'AWP', type: 'weapon', subtype: 'sniper', damage: 92, ammo: 3, speed: 'charged', range: 3, icon: '🎯', slot: 'hand' },
  { id: 'w16', name: 'Intervention', type: 'weapon', subtype: 'sniper', damage: 76, ammo: 4, speed: 'charged', range: 3, icon: '🎯', slot: 'hand' },
  // Grenades / Explosives (range 1)
  { id: 'w17', name: 'Frag Grenade', type: 'weapon', subtype: 'explosive', damage: 60, ammo: 2, speed: 'slow', range: 1, icon: '💣', slot: 'hand' },
  { id: 'w18', name: 'Flashbang', type: 'weapon', subtype: 'explosive', damage: 30, ammo: 3, speed: 'fast', range: 1, icon: '💣', slot: 'hand' },
  { id: 'w19', name: 'Smoke Bomb', type: 'weapon', subtype: 'explosive', damage: 20, ammo: 4, speed: 'fast', range: 1, icon: '💣', slot: 'hand' },
  { id: 'w20', name: 'Sticky Bomb', type: 'weapon', subtype: 'explosive', damage: 75, ammo: 2, speed: 'charged', range: 1, icon: '💣', slot: 'hand' },
  // Missile / Heavy (range 2)
  { id: 'w21', name: 'RPG-7', type: 'weapon', subtype: 'explosive', damage: 100, ammo: 1, speed: 'charged', range: 2, icon: '🚀', slot: 'hand' },
  { id: 'w22', name: 'Stinger SAM', type: 'weapon', subtype: 'explosive', damage: 85, ammo: 1, speed: 'charged', range: 2, icon: '🚀', slot: 'hand' },
  { id: 'w23', name: 'Javelin', type: 'weapon', subtype: 'explosive', damage: 115, ammo: 1, speed: 'charged', range: 2, icon: '🚀', slot: 'hand' },
  // Melee (range 0)
  { id: 'w24', name: 'Combat Knife', type: 'weapon', subtype: 'melee', damage: 30, ammo: 10, speed: 'fast', range: 0, icon: '🗡️', slot: 'hand' },
  { id: 'w25', name: 'War Hammer', type: 'weapon', subtype: 'melee', damage: 60, ammo: 4, speed: 'slow', range: 0, icon: '⚔️', slot: 'hand' },
  { id: 'w26', name: 'Katana', type: 'weapon', subtype: 'melee', damage: 56, ammo: 6, speed: 'medium', range: 0, icon: '⚔️', slot: 'hand' },
  { id: 'w27', name: 'Chainsaw', type: 'weapon', subtype: 'melee', damage: 75, ammo: 3, speed: 'slow', range: 0, icon: '⚙️', slot: 'hand' },
  { id: 'w28', name: 'Shock Baton', type: 'weapon', subtype: 'melee', damage: 25, ammo: 10, speed: 'fast', range: 0, icon: '⚡', slot: 'hand' },
  { id: 'w29', name: 'Plasma Blade', type: 'weapon', subtype: 'melee', damage: 50, ammo: 5, speed: 'medium', range: 0, icon: '⚡', slot: 'hand' },
  { id: 'w30', name: 'Uzi', type: 'weapon', subtype: 'pistol', damage: 23, ammo: 21, speed: 'fast', range: 1, icon: '🔫', slot: 'hand' },

  // ── Imported from the weapon card deck (base stats only — special abilities like
  // Cycle/Dual Wield/Snake Bite/etc. dropped for now; several assume a multi-enemy
  // Zone system this 1v1 grid engine doesn't have). Damage = card's red starburst
  // number, speed = lightning-bolt initiative score bucketed (5=fast, 3-4=medium,
  // 1-2=slow, 0=charged), ammo = top of the card's ammo ladder. Subtypes folded
  // onto existing categories: SMG/Machine Gun/Machine Pistol → their closest fit,
  // Laser Cannon → missile (heavy single-charge weapon), Marksman/Sniper Rifle → sniper.
  // 1-star
  { id: 'w31', name: 'Pulse Phaser', type: 'weapon', subtype: 'pistol', damage: 12, ammo: 8, speed: 'fast', range: 2, icon: '🔫', slot: 'hand' },
  { id: 'w33', name: 'Two Banger', type: 'weapon', subtype: 'revolver', damage: 28, ammo: 2, speed: 'slow', range: 1, icon: '🔫', slot: 'hand' },
  { id: 'w35', name: 'Clover Charm', type: 'weapon', subtype: 'pistol', damage: 24, ammo: 3, speed: 'charged', range: 1, icon: '🔫', slot: 'hand' },
  // 2-star
  { id: 'w37', name: 'Zig Zag', type: 'weapon', subtype: 'smg', damage: 32, ammo: 6, speed: 'medium', range: 1, icon: '🔫', slot: 'hand' },
  { id: 'w39', name: 'Even Steven', type: 'weapon', subtype: 'shotgun', damage: 32, ammo: 2, speed: 'slow', range: 1, icon: '🪃', slot: 'hand' },
  { id: 'w40', name: 'Rattler Ranger', type: 'weapon', subtype: 'revolver', damage: 40, ammo: 5, speed: 'slow', range: 1, icon: '🔫', slot: 'hand' },
  // 3-star
  { id: 'w42', name: 'Zap Cannon', type: 'weapon', subtype: 'assault_rifle', damage: 24, ammo: 4, speed: 'medium', range: 2, icon: '🎯', slot: 'hand' },
  { id: 'w43', name: 'Triple Threat', type: 'weapon', subtype: 'shotgun', damage: 48, ammo: 3, speed: 'slow', range: 1, icon: '🪃', slot: 'hand' },
  { id: 'w44', name: 'Magnificent Six', type: 'weapon', subtype: 'revolver', damage: 48, ammo: 6, speed: 'slow', range: 1, icon: '🔫', slot: 'hand' },
  { id: 'w45', name: 'Speed Demon', type: 'weapon', subtype: 'smg', damage: 32, ammo: 6, speed: 'fast', range: 1, icon: '🔫', slot: 'hand' },
  // 4-star
  { id: 'w46', name: 'Sweet Revenge', type: 'weapon', subtype: 'assault_rifle', damage: 40, ammo: 5, speed: 'fast', range: 2, icon: '🎯', slot: 'hand' },
  { id: 'w47', name: 'Tactical Strike', type: 'weapon', subtype: 'assault_rifle', damage: 48, ammo: 8, speed: 'medium', range: 2, icon: '🎯', slot: 'hand' },
  { id: 'w48', name: 'Ranged Rifle', type: 'weapon', subtype: 'sniper', damage: 56, ammo: 8, speed: 'medium', range: 3, icon: '🎯', slot: 'hand' },
  { id: 'w49', name: 'Heat Hawk', type: 'weapon', subtype: 'pistol', damage: 64, ammo: 7, speed: 'slow', range: 1, icon: '🔫', slot: 'hand' },
  { id: 'w50', name: 'Supreme Scope', type: 'weapon', subtype: 'sniper', damage: 72, ammo: 6, speed: 'slow', range: 3, icon: '🎯', slot: 'hand' },
  { id: 'w51', name: 'Atomic Boom', type: 'weapon', subtype: 'explosive', damage: 80, ammo: 1, speed: 'charged', range: 1, icon: '💣', slot: 'hand' },
  // 5-star
  { id: 'w52', name: 'Ion Cannon', type: 'weapon', subtype: 'explosive', damage: 64, ammo: 1, speed: 'medium', range: 2, icon: '🚀', slot: 'hand' },
  { id: 'w53', name: 'Master Blaster', type: 'weapon', subtype: 'assault_rifle', damage: 56, ammo: 10, speed: 'medium', range: 2, icon: '🎯', slot: 'hand' },
  { id: 'w54', name: 'Big Bertha', type: 'weapon', subtype: 'assault_rifle', damage: 48, ammo: 14, speed: 'fast', range: 2, icon: '🎯', slot: 'hand' },
  // Unrated (revolver-heavy set)
  { id: 'w55', name: 'Lever King', type: 'weapon', subtype: 'assault_rifle', damage: 48, ammo: 5, speed: 'charged', range: 2, icon: '🎯', slot: 'hand' },
  { id: 'w56', name: 'Raging Rhino', type: 'weapon', subtype: 'revolver', damage: 56, ammo: 4, speed: 'charged', range: 1, icon: '🔫', slot: 'hand' },
  { id: 'w57', name: 'Judgement Day', type: 'weapon', subtype: 'revolver', damage: 72, ammo: 3, speed: 'charged', range: 1, icon: '🔫', slot: 'hand' },
];
// Weapon price = (damage + ammo) × (range + REV_SPEED_FACTOR[speed]).
// REV_SPEED_FACTOR runs Charged(4) > Slow(3) > Medium(2) > Fast(1) — heavier,
// slower-to-fire weapons cost more, same direction range already pushes in.
const REV_SPEED_FACTOR = { charged: 4, slow: 3, medium: 2, fast: 1 };
const WEAPON_POOL = WEAPON_POOL_BASE.map(w => ({ ...w, price: (w.damage + w.ammo) * (w.range + REV_SPEED_FACTOR[w.speed]) }));

// ── Defense cards (30) ──────────────────────────────────────────────────────
// Armor effectiveness:
//   vest         → pistol, assault_rifle, shotgun     (slot: chest)
//   helmet       → sniper                             (slot: head)
//   blast_armor  → explosive, missile                 (slot: chest)
//   plate_armor  → all                                (slot: chest, except the 2 named "Shield"
//                                                        items below, which are hand-held)
//   medkit / syringe / bandage / ointment → heal (healAmount > 0, no defense) (slot: hand)
const DEFENSE_POOL_BASE = [
  // Bullet Proof Vests → CHEST
  { id: 'd1', name: 'Kevlar Vest', type: 'defense', subtype: 'vest', defense: 40, durability: 3, maxDurability: 3, effectiveVs: ['pistol', 'assault_rifle', 'shotgun'], healAmount: 0, icon: '🛡️', slot: 'chest' },
  { id: 'd2', name: 'Tactical Vest', type: 'defense', subtype: 'vest', defense: 50, durability: 3, maxDurability: 3, effectiveVs: ['pistol', 'assault_rifle', 'shotgun'], healAmount: 0, icon: '🛡️', slot: 'chest' },
  { id: 'd3', name: 'Riot Vest', type: 'defense', subtype: 'vest', defense: 30, durability: 4, maxDurability: 4, effectiveVs: ['pistol', 'assault_rifle', 'shotgun'], healAmount: 0, icon: '🛡️', slot: 'chest' },
  { id: 'd4', name: 'Nano Vest', type: 'defense', subtype: 'vest', defense: 60, durability: 2, maxDurability: 2, effectiveVs: ['pistol', 'assault_rifle', 'shotgun'], healAmount: 0, icon: '🛡️', slot: 'chest' },
  // Helmets → HEAD
  { id: 'd5', name: 'Combat Helmet', type: 'defense', subtype: 'helmet', defense: 45, durability: 3, maxDurability: 3, effectiveVs: ['sniper'], healAmount: 0, icon: '⛑️', slot: 'head' },
  { id: 'd6', name: 'Ballistic Helm', type: 'defense', subtype: 'helmet', defense: 55, durability: 3, maxDurability: 3, effectiveVs: ['sniper'], healAmount: 0, icon: '⛑️', slot: 'head' },
  // Blast Armor → CHEST
  { id: 'd9', name: 'Blast Suit', type: 'defense', subtype: 'blast_armor', defense: 60, durability: 3, maxDurability: 3, effectiveVs: ['explosive'], healAmount: 0, icon: '🦺', slot: 'chest' },
  // Plate Armor → CHEST
  { id: 'd14', name: 'Titanium Plate', type: 'defense', subtype: 'plate_armor', defense: 40, durability: 4, maxDurability: 4, effectiveVs: ['pistol', 'assault_rifle', 'shotgun', 'sniper', 'explosive', 'melee'], healAmount: 0, icon: '🔰', slot: 'chest' },
  // Riot Shield — held, not worn → HAND
  { id: 'd16', name: 'Riot Shield', type: 'defense', subtype: 'plate_armor', defense: 35, durability: 6, maxDurability: 6, effectiveVs: ['pistol', 'assault_rifle', 'shotgun', 'sniper', 'explosive', 'melee'], healAmount: 0, icon: '🔰', slot: 'hand' },
  // Melee-specific armor → CHEST
  // Healing items (one-time use, defense: 0) → HAND
  { id: 'd19', name: 'Med Kit', type: 'defense', subtype: 'medkit', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 50, icon: '🏥', slot: 'hand' },
  { id: 'd22', name: 'Adrenaline Shot', type: 'defense', subtype: 'syringe', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 25, icon: '💉', slot: 'hand' },
  { id: 'd23', name: 'Bandages', type: 'defense', subtype: 'bandage', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 20, icon: '🩹', slot: 'hand' },
  // More armors → CHEST
  // Energy Shield — held, not worn → HAND
  { id: 'd28', name: 'Energy Shield', type: 'defense', subtype: 'plate_armor', defense: 45, durability: 3, maxDurability: 3, effectiveVs: ['pistol', 'assault_rifle', 'shotgun', 'sniper', 'explosive', 'melee'], healAmount: 0, icon: '🔵', slot: 'hand' },
  // New, added for the character-locked gear system
  { id: 'd31', name: 'Hazmat Suit', type: 'defense', subtype: 'blast_armor', defense: 40, durability: 3, maxDurability: 3, effectiveVs: ['explosive'], healAmount: 0, icon: '☣️', slot: 'chest' },
  { id: 'd32', name: 'Pain Killers', type: 'defense', subtype: 'bandage', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 15, icon: '💊', slot: 'hand' },
];
const DEFENSE_POOL = DEFENSE_POOL_BASE.map(d => ({ ...d, price: d.healAmount > 0 ? d.healAmount * 3 : d.defense * d.durability }));

// ── Gear cards (head/legs/feet/arms — the 6 fixed equip slots) ─────────────
// Same shape as DEFENSE_POOL so they plug straight into the existing armor-
// resolution logic in combat.js (applyPlayerArmor/applyBotArmor) with zero extra code.
const GEAR_POOL_BASE = [
  // Head — helmets live in DEFENSE_POOL; these are the other head slot options
  { id: 'g3', name: 'Gas Mask', type: 'defense', subtype: 'gear_head', defense: 30, durability: 3, maxDurability: 3, effectiveVs: ['explosive'], healAmount: 0, icon: '🥽', slot: 'head' },
  { id: 'g4', name: 'Night Vision Goggles', type: 'defense', subtype: 'gear_head', defense: 15, durability: 3, maxDurability: 3, effectiveVs: ['sniper'], healAmount: 0, icon: '🥽', slot: 'head', nightVision: true },
  // Chest — Jacket (carries extra items: +1 max hand size, see getMaxHandSize)
  // Legs
  // Feet
  { id: 'g9', name: 'Sneakers', type: 'defense', subtype: 'gear_feet', defense: 8, durability: 2, maxDurability: 2, effectiveVs: [], healAmount: 0, icon: '👟', slot: 'feet' },
  { id: 'g10', name: 'Combat Boots', type: 'defense', subtype: 'gear_feet', defense: 20, durability: 3, maxDurability: 3, effectiveVs: ['melee'], healAmount: 0, icon: '🥾', slot: 'feet' },
  { id: 'g11', name: 'Steel-Toe Boots', type: 'defense', subtype: 'gear_feet', defense: 28, durability: 4, maxDurability: 4, effectiveVs: ['melee', 'explosive'], healAmount: 0, icon: '🥾', slot: 'feet' },
  // Arms (worn — separate from the flexible hand slots)
  // New, added for the character-locked gear system
  { id: 'g15', name: 'Headband', type: 'defense', subtype: 'gear_head', defense: 10, durability: 2, maxDurability: 2, effectiveVs: [], healAmount: 0, icon: '🎽', slot: 'head' },
  { id: 'g16', name: 'Cloak', type: 'defense', subtype: 'gear_chest', defense: 35, durability: 4, maxDurability: 4, effectiveVs: ['sniper'], healAmount: 0, icon: '🧥', slot: 'chest' },
  { id: 'g17', name: 'Cowboy Hat', type: 'defense', subtype: 'gear_head', defense: 20, durability: 3, maxDurability: 3, effectiveVs: [], healAmount: 0, icon: '🤠', slot: 'head' },
  { id: 'g18', name: 'Trench Coat', type: 'defense', subtype: 'gear_chest', defense: 25, durability: 3, maxDurability: 3, effectiveVs: [], healAmount: 0, icon: '🧥', slot: 'chest' },
  { id: 'g19', name: 'Cowboy Boots', type: 'defense', subtype: 'gear_feet', defense: 15, durability: 3, maxDurability: 3, effectiveVs: [], healAmount: 0, icon: '🥾', slot: 'feet' },
  { id: 'g20', name: 'Holster', type: 'defense', subtype: 'gear_hand', defense: 5, durability: 2, maxDurability: 2, effectiveVs: [], healAmount: 0, icon: '🔫', slot: 'hand' },
  { id: 'g21', name: 'Riot Face Shield', type: 'defense', subtype: 'gear_head', defense: 40, durability: 3, maxDurability: 3, effectiveVs: ['pistol', 'assault_rifle', 'shotgun', 'sniper', 'explosive', 'melee'], healAmount: 0, icon: '🪖', slot: 'head' },
  { id: 'g22', name: 'Jean Jacket', type: 'defense', subtype: 'gear_chest', defense: 20, durability: 3, maxDurability: 3, effectiveVs: [], healAmount: 0, icon: '🧥', slot: 'chest' },
  { id: 'g23', name: 'Ammo Belt', type: 'defense', subtype: 'gear_legs', defense: 15, durability: 3, maxDurability: 3, effectiveVs: [], healAmount: 0, icon: '🎒', slot: 'legs' },
  { id: 'g24', name: 'Goggles', type: 'defense', subtype: 'gear_head', defense: 12, durability: 3, maxDurability: 3, effectiveVs: ['sniper'], healAmount: 0, icon: '🥽', slot: 'head' },
  { id: 'g25', name: 'Radar Remote', type: 'defense', subtype: 'gear_hand', defense: 5, durability: 2, maxDurability: 2, effectiveVs: [], healAmount: 0, icon: '📡', slot: 'hand', radarPing: true },
  { id: 'g26', name: 'Shades', type: 'defense', subtype: 'gear_head', defense: 15, durability: 3, maxDurability: 3, effectiveVs: [], healAmount: 0, icon: '🕶️', slot: 'head' },
  { id: 'g27', name: 'Fedora', type: 'defense', subtype: 'gear_head', defense: 15, durability: 3, maxDurability: 3, effectiveVs: [], healAmount: 0, icon: '🎩', slot: 'head' },
];
const GEAR_POOL = GEAR_POOL_BASE.map(g => ({ ...g, price: g.defense * g.durability }));

// ── Character unlocks ────────────────────────────────────────────────────
// Everyone else starts locked — win against a character on EVERY difficulty
// (easy/medium/hard/impossible) to unlock them. See progression.js for the
// win-tracking functions and char-select.js for the Bestiary/Challenge UI.
// Only Pete is a static starter now — Clint is unlocked through the Sterling
// Cross tutorial itself (see char-select.js launchCombatTutorial()), not as a
// free starting character. If Clint were also in this list, the entire
// tutorial premise ("you're locked out of him until you beat him") would be
// moot, since he'd already be unlocked before the tutorial even started.
const STARTER_UNLOCKED_IDS = ['c1']; // Pistol Pete only

// Every equippable item across all three pools, for the Shop and Equip screens.
const ALL_EQUIPPABLE = [...WEAPON_POOL, ...DEFENSE_POOL, ...GEAR_POOL];

// ── Weapon restrictions (mirrors the in-match checks in game-state.js) ─────
const WEAPON_ATTRIBUTE_RESTRICTIONS = {
  dual_wield: ['pistol', 'revolver'],           // Pistol Pete
  deadeye: ['revolver', 'pistol'],              // Cowboy Clint
  pistol_specialist: ['pistol'],
  revolver_specialist: ['revolver'],
  swift_melee: ['melee'],                       // Lunging Logan — can't wield a gun
  rifle_specialist: ['assault_rifle', 'sniper'], // Ranger Kate
};
/** Returns the allowed weapon subtypes for a character attribute, or null if unrestricted. */
function getAllowedWeaponSubtypes(attribute) {
  return WEAPON_ATTRIBUTE_RESTRICTIONS[attribute] || null;
}

// ── Character unlock requirements (weapon groups + specific gear) ──────────
// Each character's requirement has:
//   - difficulties: which difficulties must be beaten (defaults to all 4)
//   - weaponGroups: string[][] — an array of OR-groups. The character must own
//     at least one weapon from EVERY group (groups are ANDed together, options
//     within a group are ORed) — e.g. Macy's single group ['pistol','melee']
//     means "own a pistol OR a melee weapon"; Titan's two single-option groups
//     [['revolver'],['explosive']] means "own a revolver AND an explosive".
//   - gearItems: string[] — specific item ids that must ALL be owned.
//   - requiresAnyHealing: true for Macy only — she needs any one of the
//     universal healing items (see HEALING_ITEM_IDS below), not a specific one.
// This is the single source of truth for both the unlock check AND the Shop
// purchase lock — once unlocked, a character can keep buying any subtype that
// appears anywhere in their own weaponGroups, and any gear item their id is
// listed as an allowed buyer for (see GEAR_ITEM_OWNERS below).
const ALL_WEAPON_SUBTYPES = ['pistol', 'revolver', 'shotgun', 'assault_rifle', 'sniper', 'explosive', 'melee', 'smg'];
const _EVERY_SUBTYPE_SEPARATELY = ALL_WEAPON_SUBTYPES.map(s => [s]); // "one of each type" — Shadow, Tracy

const CHARACTER_UNLOCK_REQUIREMENTS = {
  c1: { weaponGroups: [['pistol']], gearItems: ['g9'] }, // Pistol Pete — starter, no difficulty gate; sneakers
  c2: { difficulties: ['easy', 'medium', 'hard'], weaponGroups: [['revolver'], ['explosive']], gearItems: ['d5', 'd14', 'g11', 'd28'] }, // Iron Titan — 6 items is heaviest of any regular character, dropping Impossible to balance total burden
  c3: { weaponGroups: [['melee']], gearItems: [] }, // Lunging Logan — weapon only, no gear
  c4: { weaponGroups: [['pistol', 'melee']], gearItems: ['d5'], requiresAnyHealing: true }, // Macy the Medic
  c5: { weaponGroups: [['explosive']], gearItems: ['d5', 'g3', 'd31'] }, // Toxic Trooper (d31 = new Hazmat Suit)
  c6: { weaponGroups: [['smg', 'melee']], gearItems: ['g9', 'g15'] }, // Sprinting Sue (g15 = new Headband)
  c7: { difficulties: ['easy', 'medium', 'hard'], weaponGroups: [['smg'], ['assault_rifle']], gearItems: ['g4', 'd6'] }, // Commando Cole — no Impossible needed
  c8: { weaponGroups: _EVERY_SUBTYPE_SEPARATELY, gearItems: ['g16'] }, // The Shadow (g16 = new Cloak)
  c9: { difficulties: ['easy'], weaponGroups: [['revolver']], gearItems: ['g17', 'g18', 'g19', 'g20'] }, // Cowboy Clint — tutorial unlock, Easy only
  c10: { difficulties: ['easy', 'medium', 'hard'], weaponGroups: [['shotgun'], ['explosive']], gearItems: ['g21', 'd3', 'd16'] }, // Sentinel Sam (g21 = new Riot Face Shield)
  c11: { weaponGroups: _EVERY_SUBTYPE_SEPARATELY, gearItems: ['g22', 'g23'] }, // Tracy Guns (new: jean jacket/ammo belt)
  c12: { difficulties: ['easy', 'medium', 'hard'], weaponGroups: [['sniper'], ['shotgun'], ['melee']], gearItems: ['d4', 'g24'] }, // Huntress Hellena (g24 = new Goggles)
  c13: { weaponGroups: [['pistol'], ['smg']], gearItems: ['g25', 'd2'] }, // Tactical Tim (g25 = new Radar Remote)
  c14: { difficulties: ['easy', 'medium', 'hard'], weaponGroups: [['assault_rifle'], ['sniper']], gearItems: ['d5', 'd2', 'g10'] }, // Ranger Kate
  c15: { weaponGroups: [['explosive'], ['smg']], gearItems: ['g26', 'd9'] }, // Hank the Tank (g26 = new Shades)
  c16: { difficulties: ['easy', 'medium', 'hard'], weaponGroups: [['pistol'], ['revolver']], gearItems: ['g26', 'g27', 'd1'] }, // Agent Ace (g27 = new Fedora)
};

/** Returns { difficulties, weaponGroups, gearItems, requiresAnyHealing } for a character. */
function getUnlockRequirement(charId) {
  const req = CHARACTER_UNLOCK_REQUIREMENTS[charId] || { weaponGroups: [], gearItems: [] };
  return {
    difficulties: req.difficulties || ['easy', 'medium', 'hard', 'impossible'],
    weaponGroups: req.weaponGroups || [],
    gearItems: req.gearItems || [],
    requiresAnyHealing: !!req.requiresAnyHealing,
  };
}

/** Every weapon subtype a character is allowed to keep buying, once unlocked —
 *  the flattened union of all their weaponGroups. */
function getAllowedPurchaseSubtypes(charId) {
  const req = getUnlockRequirement(charId);
  const set = new Set();
  for (const group of req.weaponGroups) for (const sub of group) set.add(sub);
  return [...set];
}

// ── Gear item ownership groups ──────────────────────────────────────────────
// Which character(s) are allowed to buy a given non-universal gear item.
// Some items belong to more than one character (e.g. Shades → Hank AND Ace,
// Sneakers → Pete AND Sue, Combat Helmet → four different characters) —
// exclusivity applies per ITEM-GROUP, not strictly one item per character.
const GEAR_ITEM_OWNERS = {
  g9: ['c1', 'c6'],                          // Sneakers — Pete, Sue
  d5: ['c2', 'c4', 'c5', 'c14'],              // Combat Helmet — Titan, Macy, Toxic, Kate
  d14: ['c2'],                                // Titanium Plate — Titan
  g11: ['c2'],                                // Steel-Toe Boots — Titan
  d28: ['c2'],                                // Energy Shield — Titan
  g3: ['c5'],                                 // Gas Mask — Toxic
  d31: ['c5'],                                // Hazmat Suit (new) — Toxic
  g15: ['c6'],                                // Headband (new) — Sue
  g4: ['c7'],                                 // Night Vision Goggles — Cole
  d6: ['c7'],                                 // Ballistic Helm — Cole
  g16: ['c8'],                                // Cloak (new) — Shadow
  g17: ['c9'], g18: ['c9'], g19: ['c9'], g20: ['c9'], // Cowboy Hat/Trench Coat/Cowboy Boots/Holster (new) — Clint
  g21: ['c10'],                               // Riot Face Shield (new) — Sam
  d3: ['c10'],                                // Riot Vest — Sam
  d16: ['c10'],                               // Riot Shield — Sam
  g22: ['c11'], g23: ['c11'],                 // Jean Jacket/Ammo Belt (new) — Tracy
  d4: ['c12'],                                // Nano Vest — Hellena
  g24: ['c12'],                               // Goggles (new) — Hellena
  g25: ['c13'],                               // Radar Remote (new) — Tim
  d2: ['c13', 'c14'],                         // Tactical Vest — Tim, Kate
  g10: ['c14'],                               // Combat Boots — Kate
  g26: ['c15', 'c16'],                        // Shades (new) — Hank, Ace
  d9: ['c15'],                                // Blast Suit — Hank
  g27: ['c16'],                               // Fedora (new) — Ace
  d1: ['c16'],                                // Kevlar Vest — Ace
};
/** Returns the list of character ids allowed to buy this gear item, or null if universal. */
function getGearItemOwners(itemId) {
  return GEAR_ITEM_OWNERS[itemId] || null;
}

// Healing items are exempt from the character lock — any character can buy
// any of these. Macy's unlock requires owning at least one (requiresAnyHealing).
const HEALING_ITEM_IDS = ['d19', 'd22', 'd23', 'd32']; // Med Kit, Adrenaline Shot, Bandages, Pain Killers (new)
function isUniversalItem(itemId) {
  return HEALING_ITEM_IDS.includes(itemId);
}

// ── Default starter-owned items ─────────────────────────────────────────────
// Nothing is pre-unlocked — new players start with $100 credits and zero owned
// gear, and must buy their first loadout from the Shop before they can equip
// anything. This is deliberate: at $50 each, two M9s (a full dual-wield loadout
// for Pistol Pete) costs exactly $100 — both starter characters (Pete, Cowboy
// Clint) are pistol/revolver-restricted, so this covers either one of them.
//
// Caveat: NOT every restricted character is covered by a fresh $100 budget —
// Ranger Kate's cheapest legal weapon (assault_rifle/sniper only) currently
// costs more than $100, so she stays unaffordable immediately after unlocking
// until some savings build up. That's a known gap, not an oversight — flag if
// it should be addressed by repricing/adding a cheaper rifle-class weapon.
const DEFAULT_OWNED_IDS = [];

// ── Character unlocks ────────────────────────────────────────────────────
// Everyone else starts locked — unlocked permanently the first time you defeat
// them as a bot opponent (see combat.js endGame(), progression.js unlockChar()).
// Picked Commando Cole & Toxic Trooper as starters specifically because neither
// has a weapon-subtype restriction or a movement-phase lock — the least
// confusing first-match experience for a brand new player.
const STARTER_CHARACTER_IDS = ['c7', 'c5']; // Commando Cole (hero), Toxic Trooper (villain)

// ── Character cards (16: 8 heroes, 8 villains) ──────────────────────────────
const CHARACTER_POOL = [
  // Heroes
  { id: 'c1', name: 'Pistol Pete', type: 'character', faction: 'hero', hp: 170, maxHp: 170, speed: 8, attribute: 'dual_wield', attrDesc: 'Dual Wield · Pistol only', icon: '🔫🔫', img: 'img/char/pistol_pete.png' },
  { id: 'c4', name: 'Macy the Medic', type: 'character', faction: 'hero', hp: 160, maxHp: 160, speed: 9, attribute: 'healing', attrDesc: 'Healing +40% eff · Melee only', icon: '🩺', img: 'img/char/macy_the_medic.png' },
  { id: 'c6', name: 'Sprinting Sue', type: 'character', faction: 'hero', hp: 150, maxHp: 150, speed: 10, attribute: 'swift', attrDesc: 'Move 2 spaces · SMG only', icon: '🏃‍♀️', img: 'img/char/sprinting_sue.png' },
  { id: 'c7', name: 'Commando Cole', type: 'character', faction: 'hero', hp: 180, maxHp: 180, speed: 7, attribute: 'run_and_gun', attrDesc: 'Run & Gun · Sniper only', icon: '😎', img: 'img/char/commando_cole.png' },
  { id: 'c10', name: 'Sentinel Sam', type: 'character', faction: 'hero', hp: 230, maxHp: 230, speed: 2, attribute: 'shotgun_specialist', attrDesc: 'Shotgun +40% dmg · Shotgun only', icon: '🛡️', img: 'img/char/sentinel_sam.png' },
  { id: 'c11', name: 'Tracy Guns', type: 'character', faction: 'hero', hp: 160, maxHp: 160, speed: 9, attribute: 'extra_carry', attrDesc: 'Hold 5 weapons · Any Gun', icon: '🔥', img: 'img/char/tracy_guns.png' },
  { id: 'c14', name: 'Ranger Kate', type: 'character', faction: 'hero', hp: 190, maxHp: 190, speed: 6, attribute: 'rifle_specialist', attrDesc: 'Rifle +25% dmg · Assault Rifle only', icon: '🪖', img: 'img/char/ranger_kate.png' },
  { id: 'c16', name: 'Agent Ace', type: 'character', faction: 'hero', hp: 150, maxHp: 150, speed: 10, attribute: 'dodge_bullets', attrDesc: '50% chance to dodge bullets · Revolver only', icon: '♠️', img: 'img/char/agent_ace.png' },
  // Villains
  { id: 'c2', name: 'Iron Titan', type: 'character', faction: 'villain', hp: 240, maxHp: 240, speed: 1, attribute: 'heavy_armor', attrDesc: 'Riot Gear +25% eff · Shotgun only', icon: '🦾', img: 'img/char/iron_titan.png' },
  { id: 'c3', name: 'Lunging Logan', type: 'character', faction: 'villain', hp: 150, maxHp: 150, speed: 10, attribute: 'swift_melee', attrDesc: 'Move and Attack · Melee only', icon: '🔪', img: 'img/char/lunging_logan.png' },
  { id: 'c5', name: 'Toxic Trooper', type: 'character', faction: 'villain', hp: 210, maxHp: 210, speed: 4, attribute: 'radioactive_resist', attrDesc: '100% radiation immunity · SMG only', icon: '☢️', img: 'img/char/toxic_trooper.png' },
  { id: 'c8', name: 'The Shadow', type: 'character', faction: 'villain', hp: 1, maxHp: 1, speed: 0, attribute: 'shadow_clone', attrDesc: 'Mirrors the hero · Any Gun', icon: '🥷', img: 'img/char/the_shadow.jpeg' },
  { id: 'c9', name: 'Cowboy Clint', type: 'character', faction: 'villain', hp: 160, maxHp: 160, speed: 9, attribute: 'deadeye', attrDesc: 'Fire Revolvers faster · Revolver only', icon: '🤠', img: 'img/char/cowboy_clint.png' },
  { id: 'c12', name: 'Huntress Hellena', type: 'character', faction: 'villain', hp: 200, maxHp: 200, speed: 5, attribute: 'sniper_specialist', attrDesc: 'Sniper+33% dmg · Sniper only', icon: '🎯', img: 'img/char/huntress_hellena.png' },
  { id: 'c13', name: 'Tactical Tim', type: 'character', faction: 'villain', hp: 140, maxHp: 140, speed: 11, attribute: 'tactical_xray', attrDesc: 'Radar: ping enemy direction & range · Pistol only', icon: '🧠', img: 'img/char/tactical_tim.png' },
  { id: 'c15', name: 'Hank the Tank', type: 'character', faction: 'villain', hp: 220, maxHp: 220, speed: 3, attribute: 'explosive_specialist', attrDesc: 'Explosive +40% dmg · Explosive only', icon: '💥', img: 'img/char/hank_the_tank.png' },
];

// ── Location cards (49 for 7×7 grid) ────────────────────────────────────────
const LOCATION_POOL = [
  { id: 'l1', name: 'Neutral Zone', effect: 'neutral', effectDesc: ' ', icon: '⬜', css: 'neutral' },
  { id: 'l2', name: 'Hero Sanctum', effect: 'hero_zone', effectDesc: ' +25% hero dmg', icon: '🦸', css: 'hero-zone' },
  { id: 'l3', name: 'Villain Den', effect: 'villain_zone', effectDesc: ' +25% villain dmg', icon: '🦹', css: 'villain-zone' },
  { id: 'l4', name: 'The Armory', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l5', name: 'The Forge', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l6', name: 'Radiation Zone', effect: 'radiation', effectDesc: '-5 HP/phase', icon: '☢️', css: 'danger' },
  { id: 'l7', name: 'Stink Swamp', effect: 'radiation', effectDesc: '-5 HP/phase', icon: '🍄', css: 'danger' },
  { id: 'l8', name: 'Scrap Heap', effect: 'discard', effectDesc: 'Optionally discard 1 card', icon: '🗑️', css: 'neutral' },
  { id: 'l9', name: 'The Hospital', effect: 'heal', effectDesc: '+3 HP/phase', icon: '❤️‍🩹', css: 'buff' },
  { id: 'l10', name: 'Bunker', effect: 'neutral', effectDesc: ' ', icon: '🕳️', css: 'neutral' },
  { id: 'l11', name: 'Crossroads', effect: 'neutral', effectDesc: ' ', icon: '🔀', css: 'neutral' },
  { id: 'l12', name: 'Fire Zone', effect: 'radiation', effectDesc: ' -5 HP/phase', icon: '🔥', css: 'danger' },
  { id: 'l13', name: 'Supply Depot', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l14', name: 'Medic Post', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l15', name: 'Light Room', effect: 'hero_zone', effectDesc: ' +25% hero dmg', icon: '☀️', css: 'hero-zone' },
  { id: 'l16', name: 'Dark Alley', effect: 'villain_zone', effectDesc: ' +25% villain dmg', icon: '🌑', css: 'villain-zone' },
  { id: 'l17', name: 'Ruined City', effect: 'neutral', effectDesc: ' ', icon: '🏚️', css: 'neutral' },
  { id: 'l18', name: 'Toxic Waste', effect: 'radiation', effectDesc: '-5 HP/phase', icon: '☣️', css: 'danger' },
  { id: 'l19', name: 'Power Station', effect: 'heal', effectDesc: '+3 HP/phase', icon: '⚡', css: 'buff' },
  { id: 'l20', name: 'Open Field', effect: 'neutral', effectDesc: ' ', icon: '🌾', css: 'neutral' },
  { id: 'l21', name: 'Sniper Nest', effect: 'sniper_nest', effectDesc: 'Snipers +33% dmg', icon: '🎯', css: 'buff' },
  { id: 'l22', name: 'Crash Site', effect: 'neutral', effectDesc: ' ', icon: '💥', css: 'neutral' },
  { id: 'l23', name: 'Watch Tower', effect: 'sniper_nest', effectDesc: 'Snipers +33% dmg', icon: '👀', css: 'buff' },
  { id: 'l24', name: 'Tech Lab', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  // Dead center of the 7×7 grid (index 24) — the single most fought-over tile.
  // Faction-agnostic +25% damage, unlike hero_zone/villain_zone which only help one side.
  { id: 'l25', name: 'Power Core', effect: 'damage_boost', effectDesc: '+25% dmg (either side)', icon: '💠', css: 'buff' },
  { id: 'l26', name: 'Abandoned Mine', effect: 'neutral', effectDesc: ' ', icon: '⛏️', css: 'neutral' },
  { id: 'l27', name: 'Toxic Swamp', effect: 'radiation', effectDesc: ' -5 HP/phase', icon: '🦠', css: 'danger' },
  { id: 'l28', name: 'Barricade', effect: 'neutral', effectDesc: ' ', icon: '🚧', css: 'neutral' },
  { id: 'l29', name: 'Armory Vault', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l30', name: 'Medical Bay', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l31', name: 'Hero Hideout', effect: 'hero_zone', effectDesc: ' +25% hero dmg', icon: '🦸‍♂️', css: 'hero-zone' },
  { id: 'l32', name: 'Evil Lair', effect: 'villain_zone', effectDesc: ' +25% villain dmg', icon: '🦹‍♂️', css: 'villain-zone' },
  { id: 'l33', name: 'Pawn Shop', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l34', name: 'First Aid Tent', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l35', name: 'Sunny Meadow', effect: 'hero_zone', effectDesc: ' +25% hero dmg', icon: '🌻', css: 'hero-zone' },
  { id: 'l36', name: 'Shadow Alley', effect: 'villain_zone', effectDesc: ' +25% villain dmg', icon: '🌘', css: 'villain-zone' },
  { id: 'l37', name: 'Weapon Cache', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l38', name: 'Defense Depot', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l39', name: 'Radiation Field', effect: 'radiation', effectDesc: '-5 HP/phase', icon: '☢️', css: 'danger' },
  { id: 'l40', name: 'Open Plains', effect: 'neutral', effectDesc: ' ', icon: '🌾', css: 'neutral' },
  { id: 'l41', name: 'Sniper Tower', effect: 'sniper_nest', effectDesc: 'Snipers +33% dmg', icon: '🏹', css: 'buff' },
  { id: 'l42', name: 'Crash Zone', effect: 'neutral', effectDesc: ' ', icon: '💥', css: 'neutral' },
  { id: 'l43', name: 'Observation Deck', effect: 'sniper_nest', effectDesc: 'Snipers +33% dmg', icon: '🔭', css: 'buff' },
  { id: 'l44', name: 'Research Lab', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l45', name: 'Clinic', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
  { id: 'l46', name: 'Abandoned Office', effect: 'neutral', effectDesc: ' ', icon: '⬜', css: 'neutral' },
  { id: 'l47', name: 'Nuclear Plant', effect: 'radiation', effectDesc: '-5 HP/phase', icon: '🏭', css: 'danger' },
  { id: 'l48', name: 'Barricade Zone', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'neutral' },
  { id: 'l49', name: 'Army Base', effect: 'ammo_refill', effectDesc: '+1 ammo/turn', icon: '🔋', css: 'buff' },
];
