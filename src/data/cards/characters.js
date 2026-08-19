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