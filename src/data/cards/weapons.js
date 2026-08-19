
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