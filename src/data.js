/**
 * data.js — Blast Battles static data
 * No dependencies. Safe to import first.
 *
 * Exports (browser globals when loaded via <script>):
 * WEAPON_POOL, DEFENSE_POOL, CHARACTER_POOL, LOCATION_POOL
 */

'use strict';

// ── Weapon cards (30) ───────────────────────────────────────────────────────
const WEAPON_POOL = [
  // Pistols (range 1)
  { id: 'w1', name: 'Desert Eagle', type: 'weapon', subtype: 'pistol', damage: 42, ammo: 7, speed: 'medium', range: 1, icon: '🔫' },
  { id: 'w2', name: 'Glock 18', type: 'weapon', subtype: 'pistol', damage: 18, ammo: 18, speed: 'fast', range: 1, icon: '🔫' },
  { id: 'w3', name: 'Magnum .357', type: 'weapon', subtype: 'revolver', damage: 35, ammo: 7, speed: 'slow', range: 1, icon: '🔫' },
  { id: 'w4', name: 'M9', type: 'weapon', subtype: 'pistol', damage: 20, ammo: 15, speed: 'fast', range: 1, icon: '🔫' },
  { id: 'w5', name: 'Magnum .44', type: 'weapon', subtype: 'revolver', damage: 40, ammo: 4, speed: 'slow', range: 1, icon: '🔫' },
  // Shotguns (range 1)
  { id: 'w6', name: 'SPAS-12', type: 'weapon', subtype: 'shotgun', damage: 64, ammo: 5, speed: 'slow', range: 1, icon: '🪃' },
  { id: 'w7', name: 'Mossberg 500', type: 'weapon', subtype: 'shotgun', damage: 56, ammo: 4, speed: 'slow', range: 1, icon: '🪃' },
  { id: 'w8', name: 'AA-12 Auto', type: 'weapon', subtype: 'shotgun', damage: 38, ammo: 8, speed: 'medium', range: 1, icon: '🪃' },
  // Assault Rifles (range 2)
  { id: 'w9', name: 'M4A1', type: 'weapon', subtype: 'assault_rifle', damage: 34, ammo: 10, speed: 'medium', range: 2, icon: '🎯' },
  { id: 'w10', name: 'AK-47', type: 'weapon', subtype: 'assault_rifle', damage: 47, ammo: 12, speed: 'slow', range: 2, icon: '🎯' },
  { id: 'w11', name: 'SCAR-H', type: 'weapon', subtype: 'assault_rifle', damage: 44, ammo: 7, speed: 'medium', range: 2, icon: '🎯' },
  { id: 'w12', name: 'Honey Badger', type: 'weapon', subtype: 'assault_rifle', damage: 32, ammo: 12, speed: 'fast', range: 2, icon: '🎯' },
  // Sniper Rifles (range 3)
  { id: 'w13', name: 'Barrett M82', type: 'weapon', subtype: 'sniper', damage: 82, ammo: 4, speed: 'charged', range: 3, icon: '🎯' },
  { id: 'w14', name: 'Dragunov SVD', type: 'weapon', subtype: 'sniper', damage: 67, ammo: 5, speed: 'slow', range: 3, icon: '🎯' },
  { id: 'w15', name: 'AWP', type: 'weapon', subtype: 'sniper', damage: 92, ammo: 3, speed: 'charged', range: 3, icon: '🎯' },
  { id: 'w16', name: 'Intervention', type: 'weapon', subtype: 'sniper', damage: 76, ammo: 4, speed: 'charged', range: 3, icon: '🎯' },
  // Grenades / Explosives (range 1)
  { id: 'w17', name: 'Frag Grenade', type: 'weapon', subtype: 'explosive', damage: 60, ammo: 2, speed: 'slow', range: 1, icon: '💣' },
  { id: 'w18', name: 'Flashbang', type: 'weapon', subtype: 'explosive', damage: 30, ammo: 3, speed: 'fast', range: 1, icon: '💣' },
  { id: 'w19', name: 'Smoke Bomb', type: 'weapon', subtype: 'explosive', damage: 20, ammo: 4, speed: 'fast', range: 1, icon: '💣' },
  { id: 'w20', name: 'Sticky Bomb', type: 'weapon', subtype: 'explosive', damage: 75, ammo: 2, speed: 'charged', range: 1, icon: '💣' },
  // Missile / Heavy (range 2)
  { id: 'w21', name: 'RPG-7', type: 'weapon', subtype: 'missile', damage: 100, ammo: 1, speed: 'charged', range: 2, icon: '🚀' },
  { id: 'w22', name: 'Stinger SAM', type: 'weapon', subtype: 'missile', damage: 85, ammo: 1, speed: 'charged', range: 2, icon: '🚀' },
  { id: 'w23', name: 'Javelin', type: 'weapon', subtype: 'missile', damage: 115, ammo: 1, speed: 'charged', range: 2, icon: '🚀' },
  // Melee (range 0)
  { id: 'w24', name: 'Combat Knife', type: 'weapon', subtype: 'melee', damage: 30, ammo: 8, speed: 'fast', range: 0, icon: '🗡️' },
  { id: 'w25', name: 'War Hammer', type: 'weapon', subtype: 'melee', damage: 60, ammo: 4, speed: 'slow', range: 0, icon: '⚔️' },
  { id: 'w26', name: 'Katana', type: 'weapon', subtype: 'melee', damage: 56, ammo: 6, speed: 'medium', range: 0, icon: '⚔️' },
  { id: 'w27', name: 'Chainsaw', type: 'weapon', subtype: 'melee', damage: 75, ammo: 3, speed: 'slow', range: 0, icon: '⚙️' },
  { id: 'w28', name: 'Shock Baton', type: 'weapon', subtype: 'melee', damage: 25, ammo: 10, speed: 'fast', range: 0, icon: '⚡' },
  { id: 'w29', name: 'Plasma Blade', type: 'weapon', subtype: 'melee', damage: 50, ammo: 5, speed: 'medium', range: 0, icon: '⚡' },
  { id: 'w30', name: 'Uzi', type: 'weapon', subtype: 'pistol', damage: 23, ammo: 21, speed: 'fast', range: 1, icon: '🔫' },
];

// ── Defense cards (30) ──────────────────────────────────────────────────────
// Armor effectiveness:
//   vest         → pistol, assault_rifle, shotgun
//   helmet       → sniper
//   blast_armor  → explosive, missile
//   plate_armor  → all
//   medkit / syringe / bandage / ointment → heal (healAmount > 0, no defense)
const DEFENSE_POOL = [
  // Bullet Proof Vests
  { id: 'd1', name: 'Kevlar Vest', type: 'defense', subtype: 'vest', defense: 40, durability: 3, maxDurability: 3, effectiveVs: ['pistol', 'assault_rifle', 'shotgun'], healAmount: 0, icon: '🛡️' },
  { id: 'd2', name: 'Tactical Vest', type: 'defense', subtype: 'vest', defense: 50, durability: 3, maxDurability: 3, effectiveVs: ['pistol', 'assault_rifle', 'shotgun'], healAmount: 0, icon: '🛡️' },
  { id: 'd3', name: 'Riot Vest', type: 'defense', subtype: 'vest', defense: 30, durability: 4, maxDurability: 4, effectiveVs: ['pistol', 'assault_rifle', 'shotgun'], healAmount: 0, icon: '🛡️' },
  { id: 'd4', name: 'Nano Vest', type: 'defense', subtype: 'vest', defense: 60, durability: 2, maxDurability: 2, effectiveVs: ['pistol', 'assault_rifle', 'shotgun'], healAmount: 0, icon: '🛡️' },
  // Helmets (effective vs sniper)
  { id: 'd5', name: 'Combat Helmet', type: 'defense', subtype: 'helmet', defense: 45, durability: 3, maxDurability: 3, effectiveVs: ['sniper'], healAmount: 0, icon: '⛑️' },
  { id: 'd6', name: 'Ballistic Helm', type: 'defense', subtype: 'helmet', defense: 55, durability: 3, maxDurability: 3, effectiveVs: ['sniper'], healAmount: 0, icon: '⛑️' },
  { id: 'd7', name: 'Full Face Guard', type: 'defense', subtype: 'helmet', defense: 35, durability: 4, maxDurability: 4, effectiveVs: ['sniper'], healAmount: 0, icon: '⛑️' },
  { id: 'd8', name: 'Exo Helm', type: 'defense', subtype: 'helmet', defense: 65, durability: 2, maxDurability: 2, effectiveVs: ['sniper'], healAmount: 0, icon: '⛑️' },
  // Blast Armor (effective vs explosive, missile)
  { id: 'd9', name: 'Blast Suit', type: 'defense', subtype: 'blast_armor', defense: 60, durability: 3, maxDurability: 3, effectiveVs: ['explosive', 'missile'], healAmount: 0, icon: '🦺' },
  { id: 'd10', name: 'EOD Gear', type: 'defense', subtype: 'blast_armor', defense: 70, durability: 2, maxDurability: 2, effectiveVs: ['explosive', 'missile'], healAmount: 0, icon: '🦺' },
  { id: 'd11', name: 'Blast Plate', type: 'defense', subtype: 'blast_armor', defense: 50, durability: 4, maxDurability: 4, effectiveVs: ['explosive', 'missile'], healAmount: 0, icon: '🦺' },
  { id: 'd12', name: 'Demo Shield', type: 'defense', subtype: 'blast_armor', defense: 45, durability: 3, maxDurability: 3, effectiveVs: ['explosive', 'missile'], healAmount: 0, icon: '🦺' },
  // Plate Armor (general — effective vs all)
  { id: 'd13', name: 'Steel Plate', type: 'defense', subtype: 'plate_armor', defense: 30, durability: 5, maxDurability: 5, effectiveVs: ['pistol', 'assault_rifle', 'shotgun', 'sniper', 'explosive', 'missile', 'melee'], healAmount: 0, icon: '🔰' },
  { id: 'd14', name: 'Titanium Plate', type: 'defense', subtype: 'plate_armor', defense: 40, durability: 4, maxDurability: 4, effectiveVs: ['pistol', 'assault_rifle', 'shotgun', 'sniper', 'explosive', 'missile', 'melee'], healAmount: 0, icon: '🔰' },
  { id: 'd15', name: 'Dragon Scale', type: 'defense', subtype: 'plate_armor', defense: 50, durability: 3, maxDurability: 3, effectiveVs: ['pistol', 'assault_rifle', 'shotgun', 'sniper', 'explosive', 'missile', 'melee'], healAmount: 0, icon: '🔰' },
  { id: 'd16', name: 'Riot Shield', type: 'defense', subtype: 'plate_armor', defense: 35, durability: 6, maxDurability: 6, effectiveVs: ['pistol', 'assault_rifle', 'shotgun', 'sniper', 'explosive', 'missile', 'melee'], healAmount: 0, icon: '🔰' },
  // Melee-specific armor
  { id: 'd17', name: 'Chain Mail', type: 'defense', subtype: 'plate_armor', defense: 55, durability: 4, maxDurability: 4, effectiveVs: ['melee'], healAmount: 0, icon: '🔗' },
  { id: 'd18', name: 'Spike Guard', type: 'defense', subtype: 'plate_armor', defense: 45, durability: 3, maxDurability: 3, effectiveVs: ['melee'], healAmount: 0, icon: '🔗' },
  // Healing items (one-time use, defense: 0)
  { id: 'd19', name: 'Med Kit', type: 'defense', subtype: 'medkit', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 50, icon: '🏥' },
  { id: 'd20', name: 'Med Kit II', type: 'defense', subtype: 'medkit', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 40, icon: '🏥' },
  { id: 'd21', name: 'Syringe', type: 'defense', subtype: 'syringe', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 30, icon: '💉' },
  { id: 'd22', name: 'Adrenaline Shot', type: 'defense', subtype: 'syringe', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 25, icon: '💉' },
  { id: 'd23', name: 'Bandages', type: 'defense', subtype: 'bandage', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 20, icon: '🩹' },
  { id: 'd24', name: 'Field Dressing', type: 'defense', subtype: 'bandage', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 15, icon: '🩹' },
  { id: 'd25', name: 'Ointment', type: 'defense', subtype: 'ointment', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 12, icon: '🧴' },
  { id: 'd26', name: 'Combat Stim', type: 'defense', subtype: 'syringe', defense: 0, durability: 1, maxDurability: 1, effectiveVs: [], healAmount: 35, icon: '💉' },
  // More armors
  { id: 'd27', name: 'Exo Suit', type: 'defense', subtype: 'plate_armor', defense: 55, durability: 3, maxDurability: 3, effectiveVs: ['pistol', 'assault_rifle', 'shotgun', 'sniper', 'explosive', 'missile', 'melee'], healAmount: 0, icon: '🤖' },
  { id: 'd28', name: 'Energy Shield', type: 'defense', subtype: 'plate_armor', defense: 45, durability: 3, maxDurability: 3, effectiveVs: ['pistol', 'assault_rifle', 'shotgun', 'sniper', 'explosive', 'missile', 'melee'], healAmount: 0, icon: '🔵' },
  { id: 'd29', name: 'Ceramic Plate', type: 'defense', subtype: 'vest', defense: 38, durability: 4, maxDurability: 4, effectiveVs: ['pistol', 'assault_rifle', 'shotgun'], healAmount: 0, icon: '🛡️' },
  { id: 'd30', name: 'Carbon Weave', type: 'defense', subtype: 'blast_armor', defense: 42, durability: 3, maxDurability: 3, effectiveVs: ['explosive', 'missile'], healAmount: 0, icon: '🦺' },
];

// ── Character cards (16: 8 heroes, 8 villains) ──────────────────────────────
const CHARACTER_POOL = [
  // Heroes
  { id: 'c1', name: 'Pistol Pete', type: 'character', faction: 'hero', hp: 170, maxHp: 170, speed: 8, attribute: 'dual_wield', attrDesc: 'Dual Wield · Pistols & Revolvers only', icon: '🔫🔫', img: 'img/char/pistol_pete.png' },
  { id: 'c4', name: 'Macy the Medic', type: 'character', faction: 'hero', hp: 160, maxHp: 160, speed: 9, attribute: 'healing', attrDesc: 'Healing +40% eff · Cardinal moves only', icon: '🩺', img: 'img/char/macy_the_medic.png' },
  { id: 'c6', name: 'Sprinting Sue', type: 'character', faction: 'hero', hp: 150, maxHp: 150, speed: 10, attribute: 'swift', attrDesc: 'Move 2 spaces · Fast phase only', icon: '🏃‍♀️', img: 'img/char/sprinting_sue.png' },
  { id: 'c7', name: 'Commando Cole', type: 'character', faction: 'hero', hp: 180, maxHp: 180, speed: 7, attribute: 'run_and_gun', attrDesc: 'Run & Gun · Must move to Attack', icon: '😎', img: 'img/char/commando_cole.png' },
  { id: 'c10', name: 'Sentinel Sam', type: 'character', faction: 'hero', hp: 230, maxHp: 230, speed: 2, attribute: 'shotgun_specialist', attrDesc: 'Shotgun +40% dmg · Moves Slow & Charged only', icon: '🛡️', img: 'img/char/sentinel_sam.png' },
  { id: 'c11', name: 'Tracy Guns', type: 'character', faction: 'hero', hp: 160, maxHp: 160, speed: 9, attribute: 'extra_carry', attrDesc: 'Hold 5 weapons · No defense cards', icon: '🔥', img: 'img/char/tracy_guns.png' },
  { id: 'c14', name: 'Ranger Kate', type: 'character', faction: 'hero', hp: 190, maxHp: 190, speed: 6, attribute: 'rifle_specialist', attrDesc: 'Rifle +25% dmg · Rifles only', icon: '🪖', img: 'img/char/ranger_kate.png' },
  { id: 'c16', name: 'Agent Ace', type: 'character', faction: 'hero', hp: 150, maxHp: 150, speed: 10, attribute: 'dodge_bullets', attrDesc: "50% chance to dodge bullets · Can't dodge Explosive, Missile, or Melee", icon: '♠️', img: 'img/char/agent_ace.png' },
  // Villains
  { id: 'c2', name: 'Iron Titan', type: 'character', faction: 'villain', hp: 240, maxHp: 240, speed: 1, attribute: 'heavy_armor', attrDesc: 'Riot Gear +25% eff · Moves Charged phase only', icon: '🦾', img: 'img/char/iron_titan.png' },
  { id: 'c3', name: 'Lunging Logan', type: 'character', faction: 'villain', hp: 150, maxHp: 150, speed: 10, attribute: 'swift_melee', attrDesc: 'Move and Attack · Melee only', icon: '🔪', img: 'img/char/lunging_logan.png' },
  { id: 'c5', name: 'Toxic Trooper', type: 'character', faction: 'villain', hp: 210, maxHp: 210, speed: 4, attribute: 'radioactive_resist', attrDesc: '100% radiation immunity · Non-hazard tiles deal dmg', icon: '☢️', img: 'img/char/toxic_trooper.png' },
  { id: 'c8', name: 'The Shadow', type: 'character', faction: 'villain', hp: 1, maxHp: 1, speed: 0, attribute: 'shadow_clone', attrDesc: 'Mirrors the hero · Turn always last', icon: '🥷', img: 'img/char/the_shadow.jpeg' },
  { id: 'c9', name: 'Cowboy Carl', type: 'character', faction: 'villain', hp: 160, maxHp: 160, speed: 9, attribute: 'deadeye', attrDesc: 'Fire Revolvers faster · Revolvers & Pistols only', icon: '🤠', img: 'img/char/cowboy_carl.png' },
  { id: 'c12', name: 'Huntress Hellena', type: 'character', faction: 'villain', hp: 200, maxHp: 200, speed: 5, attribute: 'sniper_specialist', attrDesc: 'Sniper+33% dmg · Move Fast & Medium only', icon: '🎯', img: 'img/char/huntress_hellena.png' },
  { id: 'c13', name: 'Tactical Tim', type: 'character', faction: 'villain', hp: 140, maxHp: 140, speed: 11, attribute: 'tactical_xray', attrDesc: 'X-Ray: reveal hidden card · -1 SPD per card equipped', icon: '🧠', img: 'img/char/tactical_tim.png' },
  { id: 'c15', name: 'Hank the Tank', type: 'character', faction: 'villain', hp: 220, maxHp: 220, speed: 3, attribute: 'explosive_specialist', attrDesc: 'Explosive +40% dmg · Too slow for Fast phase', icon: '💥', img: 'img/char/hank_the_tank.png' },
];

// ── Location cards (49 for 7×7 grid) ────────────────────────────────────────
const LOCATION_POOL = [
  { id: 'l1', name: 'Neutral Zone', effect: 'neutral', effectDesc: ' ', icon: '⬜', css: 'neutral' },
  { id: 'l2', name: 'Hero Sanctum', effect: 'hero_zone', effectDesc: ' +25% hero dmg', icon: '🦸', css: 'hero-zone' },
  { id: 'l3', name: 'Villain Den', effect: 'villain_zone', effectDesc: ' +25% villain dmg', icon: '🦹', css: 'villain-zone' },
  { id: 'l4', name: 'The Armory', effect: 'draw_weapon', effectDesc: 'Draw a weapon', icon: '⚔️', css: 'buff' },
  { id: 'l5', name: 'The Forge', effect: 'draw_defense', effectDesc: 'Draw a defense', icon: '⚒️', css: 'buff' },
  { id: 'l6', name: 'Radiation Zone', effect: 'radiation', effectDesc: '-5 HP/phase', icon: '☢️', css: 'danger' },
  { id: 'l7', name: 'Stink Swamp', effect: 'radiation', effectDesc: '-5 HP/phase', icon: '🍄', css: 'danger' },
  { id: 'l8', name: 'Scrap Heap', effect: 'discard', effectDesc: 'Optionally discard 1 card', icon: '🗑️', css: 'neutral' },
  { id: 'l9', name: 'The Hospital', effect: 'heal', effectDesc: '+3 HP/phase', icon: '❤️‍🩹', css: 'buff' },
  { id: 'l10', name: 'Bunker', effect: 'neutral', effectDesc: ' ', icon: '🕳️', css: 'neutral' },
  { id: 'l11', name: 'Crossroads', effect: 'neutral', effectDesc: ' ', icon: '🔀', css: 'neutral' },
  { id: 'l12', name: 'Fire Zone', effect: 'radiation', effectDesc: ' -5 HP/phase', icon: '🔥', css: 'danger' },
  { id: 'l13', name: 'Supply Depot', effect: 'draw_weapon', effectDesc: 'Draw a weapon', icon: '📦', css: 'buff' },
  { id: 'l14', name: 'Medic Post', effect: 'draw_defense', effectDesc: 'Draw a defense', icon: '🏥', css: 'buff' },
  { id: 'l15', name: 'Light Room', effect: 'hero_zone', effectDesc: ' +25% hero dmg', icon: '☀️', css: 'hero-zone' },
  { id: 'l16', name: 'Dark Alley', effect: 'villain_zone', effectDesc: ' +25% villain dmg', icon: '🌑', css: 'villain-zone' },
  { id: 'l17', name: 'Ruined City', effect: 'neutral', effectDesc: ' ', icon: '🏚️', css: 'neutral' },
  { id: 'l18', name: 'Toxic Waste', effect: 'radiation', effectDesc: '-5 HP/phase', icon: '☣️', css: 'danger' },
  { id: 'l19', name: 'Power Station', effect: 'heal', effectDesc: '+3 HP/phase', icon: '⚡', css: 'buff' },
  { id: 'l20', name: 'Open Field', effect: 'neutral', effectDesc: ' ', icon: '🌾', css: 'neutral' },
  { id: 'l21', name: 'Sniper Nest', effect: 'sniper_nest', effectDesc: 'Snipers +33% dmg', icon: '🎯', css: 'buff' },
  { id: 'l22', name: 'Crash Site', effect: 'neutral', effectDesc: ' ', icon: '💥', css: 'neutral' },
  { id: 'l23', name: 'Watch Tower', effect: 'sniper_nest', effectDesc: 'Snipers +33% dmg', icon: '👀', css: 'buff' },
  { id: 'l24', name: 'Tech Lab', effect: 'draw_weapon', effectDesc: ' Draw a weapon', icon: '🔬', css: 'buff' },
  { id: 'l25', name: 'Safe Room', effect: 'draw_defense', effectDesc: ' Draw a defense', icon: '🔒', css: 'buff' },
  { id: 'l26', name: 'Abandoned Mine', effect: 'neutral', effectDesc: ' ', icon: '⛏️', css: 'neutral' },
  { id: 'l27', name: 'Toxic Swamp', effect: 'radiation', effectDesc: ' -5 HP/phase', icon: '🦠', css: 'danger' },
  { id: 'l28', name: 'Barricade', effect: 'neutral', effectDesc: ' ', icon: '🚧', css: 'neutral' },
  { id: 'l29', name: 'Armory Vault', effect: 'draw_weapon', effectDesc: ' Draw a weapon', icon: '🗄️', css: 'buff' },
  { id: 'l30', name: 'Medical Bay', effect: 'draw_defense', effectDesc: ' Draw a defense', icon: '🏨', css: 'buff' },
  { id: 'l31', name: 'Hero Hideout', effect: 'hero_zone', effectDesc: ' +25% hero dmg', icon: '🦸‍♂️', css: 'hero-zone' },
  { id: 'l32', name: 'Evil Lair', effect: 'villain_zone', effectDesc: ' +25% villain dmg', icon: '🦹‍♂️', css: 'villain-zone' },
  { id: 'l33', name: 'Pawn Shop', effect: 'draw_weapon', effectDesc: ' Draw a weapon', icon: '🧰', css: 'buff' },
  { id: 'l34', name: 'First Aid Tent', effect: 'draw_defense', effectDesc: ' Draw a defense', icon: '⛑️', css: 'buff' },
  { id: 'l35', name: 'Sunny Meadow', effect: 'hero_zone', effectDesc: ' +25% hero dmg', icon: '🌻', css: 'hero-zone' },
  { id: 'l36', name: 'Shadow Alley', effect: 'villain_zone', effectDesc: ' +25% villain dmg', icon: '🌘', css: 'villain-zone' },
  { id: 'l37', name: 'Weapon Cache', effect: 'draw_weapon', effectDesc: ' Draw a weapon', icon: '🧨', css: 'buff' },
  { id: 'l38', name: 'Defense Depot', effect: 'draw_defense', effectDesc: ' Draw a defense', icon: '🛡️', css: 'buff' },
  { id: 'l39', name: 'Radiation Field', effect: 'radiation', effectDesc: '-5 HP/phase', icon: '☢️', css: 'danger' },
  { id: 'l40', name: 'Open Plains', effect: 'neutral', effectDesc: ' ', icon: '🌾', css: 'neutral' },
  { id: 'l41', name: 'Sniper Tower', effect: 'sniper_nest', effectDesc: 'Snipers +33% dmg', icon: '🏹', css: 'buff' },
  { id: 'l42', name: 'Crash Zone', effect: 'neutral', effectDesc: ' ', icon: '💥', css: 'neutral' },
  { id: 'l43', name: 'Observation Deck', effect: 'sniper_nest', effectDesc: 'Snipers +33% dmg', icon: '🔭', css: 'buff' },
  { id: 'l44', name: 'Research Lab', effect: 'draw_weapon', effectDesc: ' Draw a weapon', icon: '🦠', css: 'buff' },
  { id: 'l45', name: 'Clinic', effect: 'draw_defense', effectDesc: ' Draw a defense', icon: '🏥', css: 'buff' },
  { id: 'l46', name: 'Abandoned Office', effect: 'neutral', effectDesc: ' ', icon: '⬜', css: 'neutral' },
  { id: 'l47', name: 'Nuclear Plant', effect: 'radiation', effectDesc: '-5 HP/phase', icon: '🏭', css: 'danger' },
  { id: 'l48', name: 'Barricade Zone', effect: 'draw_defense', effectDesc: ' Draw a defense', icon: '🚧', css: 'neutral' },
  { id: 'l49', name: 'Army Base', effect: 'draw_weapon', effectDesc: ' Draw a weapon', icon: '🗄️', css: 'buff' },
];
