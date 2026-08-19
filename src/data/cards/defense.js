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