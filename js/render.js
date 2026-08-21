/**
 * Name: render.js
 * Description: UI rendering for the game state, including character panels, cards, arena, and phase/hint updates.
 * Dependencies (must load first): G, utils.js
 * Exports (browser globals): render, renderCharDisplay, renderHand, renderBotHand, renderArena, renderInPlay, renderDeckSizes, updatePhaseUI, updateHint, showHelp, toggleHand
 */
'use strict';

/**
 * HP threshold → colour, shared by the side-panel HP text and the arena's
 * mini token HP bar. >50% green, 26–50% yellow/orange, <=25% red.
 *
 * @param {number} pct - Current HP as a percentage of max HP (0–100)
 * @returns {string} CSS colour value
 */
function hpBarColor(pct) {
  if (pct <= 25) return 'var(--accent2)'; // red
  if (pct <= 50) return 'var(--slow)';    // yellow/orange
  return 'var(--green)';                  // green
}

    function render() {
      renderCharDisplay('player-char-display', G.playerChar, G.locations[G.playerPos]);
      renderCharDisplay('bot-char-display', G.botChar, G.locations[G.botPos]);
      renderHand();
      renderBotHand();
      renderArena();
      renderInPlay();
      renderDeckSizes();
      updatePhaseUI();
      updateHint();
    }

    function renderCharDisplay(elId, char, loc) {
      const el = document.getElementById(elId); if (!el) return;
      const pct = Math.max(0, (char.hp / char.maxHp) * 100);
      const hpColor = hpBarColor(pct);
      const isHero = char.faction === 'hero';
      const borderColor = isHero ? 'var(--hero)' : 'var(--villain)';
      const glowColor = isHero ? 'rgba(74,184,255,0.35)' : 'rgba(196,75,255,0.35)';
      el.style.border = `1px solid ${borderColor}`;
      el.style.boxShadow = `0 0 10px ${glowColor}, inset 0 0 6px ${glowColor}`;
      el.style.padding = '0';
      el.style.overflow = 'hidden';
      const shadowFilter = 'brightness(0.40) saturate(0.2) hue-rotate(200deg) contrast(1.3) sepia(0.4)';
      const isShadow = char.name === 'The Shadow' || char.name.startsWith('Dark ');
      // shadow's panel: show opponent's portrait darkened (he IS their shadow)
      // Opponent's panel: show normally (no filter)
      const opponent = (char === G.playerChar) ? G.botChar : G.playerChar;
      const displayImg = isShadow && opponent.img ? opponent.img : char.img;
      const imgFilterStyle = isShadow ? ` style="filter:${shadowFilter};"` : '';
      const panelImgPos = (isShadow ? '50% 20%' : 'top center');
      const imgHtml = displayImg
        ? `<img src="${displayImg}"${imgFilterStyle} style="width:72px;max-width:72px;height:80px;max-height:80px;object-fit:cover;object-position:${panelImgPos};display:block;flex-shrink:0;">`
        : `<div style="width:72px;max-width:72px;height:80px;max-height:80px;display:flex;align-items:center;justify-content:center;font-size:2rem;background:rgba(255,255,255,0.04);flex-shrink:0;">${char.icon}</div>`;
      el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:0;min-height:100px;max-height:100px;overflow:hidden;">
      ${imgHtml}
      <div style="flex:1;min-width:0;padding:5px 6px;display:flex;flex-direction:column;gap:3px;justify-content:center;">
        <div style="display:flex;align-items:baseline;gap:4px;flex-wrap:nowrap;overflow:hidden;">
          <div class="char-name" style="font-size:0.68rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">${char.name}</div>
          <div class="char-type ${char.faction}" style="font-size:0.5rem;flex-shrink:0;white-space:nowrap;">${char.faction.toUpperCase()}</div>
        </div>
        <div class="hp-bar-wrap">
          <div class="hp-label" style="color:${hpColor};">${char.hp}/${char.maxHp} HP</div>
          <div class="hp-label">${(() => {
          const isPlayer = char === G.playerChar;
          const hand = isPlayer ? G.playerHand : G.botHand;
          const inPlay = isPlayer ? G.playerInPlay : G.botInPlay;
          const effSpd = getEffectiveSpeed(char, hand, inPlay);
          return char.attribute === 'tactical_xray'
            ? `${effSpd} SPD <span style="color:var(--muted);font-size:0.48rem;">(${char.speed}-${hand.length + inPlay.length})</span>`
            : `${char.speed} SPD`;
        })()}</div>
        </div>
        ${(([ability, weakness]) =>
          `<div class="char-attr" style="font-size:0.52rem;white-space:normal;overflow:hidden;">⭐ ${ability}</div>`
          + (weakness ? `<div style="font-size:0.49rem;color:var(--accent2);background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.3);border-radius:3px;padding:1px 5px;white-space:normal;overflow:hidden;">⚠ ${weakness}</div>` : '')
        )(char.attrDesc.split(' · '))}
      </div>
    </div>
  `;
    }

    function isCardPlayable(card) {
      if (G.gameOver) return false;
      const isPairedCard = G.playerChar.attribute === 'dual_wield' && card.dualWieldPairId != null;
      // A paired card that already fired this phase is locked
      if (isPairedCard && G.dualWieldFiredIds.has(card.id)) return false;
      // Non-paired actions require playerActedThisPhase = false
      if (!isPairedCard && G.playerActedThisPhase) return false;
      const phase = PHASES[G.phase];
      if (card.type === 'weapon') {
        if (!isWeaponSpeedReady(card, phase, G.playerChar.attribute)) return false;
        if (card.ammo <= 0) return false;
        // Weapon subtype restrictions
        if (G.playerChar.attribute === 'dual_wield' && card.subtype !== 'pistol' && card.subtype !== 'revolver') return false;
        if (G.playerChar.attribute === 'deadeye' && card.subtype !== 'revolver' && card.subtype !== 'pistol') return false;
        if (G.playerChar.attribute === 'pistol_specialist' && card.subtype !== 'pistol') return false;
        if (G.playerChar.attribute === 'revolver_specialist' && card.subtype !== 'revolver') return false;
        if (G.playerChar.attribute === 'swift_melee' && card.subtype !== 'melee') return false;
        if (G.playerChar.attribute === 'rifle_specialist' && card.subtype !== 'assault_rifle' && card.subtype !== 'sniper') return false;
        // Commando Cole (run_and_gun): must have moved this phase before attacking
        if (G.playerChar.attribute === 'run_and_gun' && !G.playerMovedThisPhase) return false;
        const dist = getDistance(G.playerPos, G.botPos);
        if (card.subtype === 'melee') return dist === 0;
        return dist <= card.range;
      }
      if (card.type === 'defense') {
        // extra_carry (Tracy Guns): weapons only, no exceptions.
        // dual_wield (Pete): both hands full of pistols — armor is locked, but
        // healing items don't need a free hand, so those are still allowed.
        if (G.playerChar.attribute === 'extra_carry') return false;
        if (G.playerChar.attribute === 'dual_wield' && card.healAmount === 0) return false;
        if (card.healAmount > 0) {
          return G.playerChar.hp < G.playerChar.maxHp &&
            G.playerChar.hp + card.healAmount <= G.playerChar.maxHp;
        }
        return true;
      }
      return false;
    }

    function renderPlayerCards() {
      const el = document.getElementById('player-all-cards'); if (!el) return;
      el.innerHTML = '';
      // Equipped weapons float to the top, then equipped defense, then hand cards —
      // keeps the active loadout visually up front regardless of pickup order.
      const allCards = [
        ...G.playerInPlay.filter(c => c.type === 'weapon').map(c => ({ card: c, inPlay: true })),
        ...G.playerInPlay.filter(c => c.type === 'defense').map(c => ({ card: c, inPlay: true })),
        ...G.playerHand.map(c => ({ card: c, inPlay: false }))
      ];
      for (const { card, inPlay } of allCards) {
        const isEquippedArmor = inPlay && card.type === 'defense';
        const div = isEquippedArmor ? buildCompactArmorCardEl(card) : buildCardEl(card, true, inPlay);
        const playable = isCardPlayable(card);

        if (G.awaitingScrapChoice) {
          // All cards scrappable — hand and equipped
          div.style.cursor = 'pointer';
          if (inPlay && !isEquippedArmor) div.classList.add('in-play-badge'); // keep equipped label
          const badge = document.createElement('div');
          badge.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(255,68,68,0.92);color:#fff;font-size:0.5rem;text-align:center;padding:4px 2px;font-family:Share Tech Mono,monospace;font-weight:700;letter-spacing:1px;z-index:4;border-radius:0 0 4px 4px;';
          badge.textContent = 'CLICK TO SCRAP';
          div.appendChild(badge);
          div.addEventListener('click', () => playerScrapCard(card.id));
        } else if (inPlay && card.type === 'weapon' && playable) {
          // Equipped weapon — still fireable this phase
          div.classList.add('playable');
          div.style.cursor = 'pointer';
          div.addEventListener('click', () => { G.selectedCard = G.selectedCard === card.id ? null : card.id; render(); });
          if (G.selectedCard === card.id) div.classList.add('selected');
        } else if (inPlay && card.type === 'weapon') {
          // Equipped weapon — wrong phase or out of ammo
          div.classList.add('in-play-badge');
          div.classList.add('unplayable');
          div.style.cursor = 'default';
        } else if (isEquippedArmor) {
          // Equipped defense — compact display, non-interactive
          div.style.cursor = 'default';
        } else if (playable) {
          div.classList.add('playable');
          div.style.cursor = 'pointer';
          div.addEventListener('click', () => { G.selectedCard = G.selectedCard === card.id ? null : card.id; render(); });
          if (G.selectedCard === card.id) div.classList.add('selected');
        } else {
          div.classList.add('unplayable');
          div.style.cursor = 'default';
        }
        el.appendChild(div);
      }
      // Inject FIRE/EQUIP button as overlay on the selected card
      document.querySelectorAll('.card-action-overlay').forEach(b => b.remove());
      if (G.awaitingScrapChoice || !G.selectedCard || G.gameOver || G.playerActedThisPhase) return;
      const card = G.playerHand.find(c => c.id === G.selectedCard) || G.playerInPlay.find(c => c.id === G.selectedCard);
      if (!card || !isCardPlayable(card)) return;

      // Find the rendered card div for this card
      const cardEls = document.querySelectorAll('#player-all-cards .card');
      let targetCardEl = null;
      for (const cel of cardEls) {
        if (cel.dataset.id === card.id) { targetCardEl = cel; break; }
      }
      if (!targetCardEl) return;

      const overlay = document.createElement('div');
      overlay.className = 'card-action-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:4;border-radius:5px;';

      const btn = document.createElement('button');
      btn.className = 'btn action-btn';
      btn.style.cssText = 'width:90%;font-size:0.55rem;padding:4px 2px;text-align:center;white-space:normal;line-height:1.2;';

      if (card.type === 'weapon') {
        const dist = getDistance(G.playerPos, G.botPos);
        const inRange = card.subtype === 'melee' ? dist === 0 : dist <= card.range;
        if (inRange) {
          btn.classList.add('primary');
          let displayPct = '';
          if (card.subtype !== 'melee') {
            // Compute full expected damage: range multiplier × location buff
            const rangeMult = getRangeMultiplier(card, dist);
            const baseAfterRange = Math.round(card.damage * rangeMult);
            const afterLocation = applyLocationDamageBuff(baseAfterRange, G.playerChar, G.playerPos, card);
            const totalPct = Math.round(afterLocation / card.damage * 100);
            const locBonus = afterLocation > baseAfterRange;
            displayPct = ` (${totalPct}% · ~${afterLocation} dmg${locBonus ? ' ⭐' : ''})`;
          }
          btn.textContent = `🔥 FIRE${displayPct}`;
          btn.style.background = 'var(--accent)';
          btn.onclick = () => playerPlaySelectedCard();
        } else {
          btn.style.borderColor = 'var(--accent2)';
          btn.style.color = 'var(--accent2)';
          btn.style.background = 'rgba(10,12,15,0.9)';
          const need = card.subtype === 'melee' ? 'adjacent (0sp)' : `≤${card.range}sp`;
          btn.textContent = `MOVE TO\n${need}`;
          btn.onclick = () => logMsg('system', `Out of range: ${card.name} needs ${need}, you are ${dist}sp away.`);
        }
      } else {
        btn.textContent = card.healAmount > 0 ? `💊 USE` : `🛡️ EQUIP`;
        btn.style.borderColor = 'var(--hero)';
        btn.style.color = 'var(--hero)';
        btn.style.background = 'rgba(10,12,15,0.9)';
        btn.onclick = () => playerPlaySelectedCard();
      }

      overlay.appendChild(btn);
      targetCardEl.style.position = 'relative';
      targetCardEl.appendChild(overlay);
    }

    function renderHand() { renderPlayerCards(); }

    function renderInPlay() { renderBotCards(); } // player in-play handled in renderPlayerCards

    function renderBotCards() {
      const el = document.getElementById('bot-all-cards'); if (!el) return;
      el.innerHTML = '';
      // In-play cards shown face-up with EQUIPPED badge (armor gets the compact layout)
      for (const card of G.botInPlay) {
        if (card.type === 'defense') {
          el.appendChild(buildCompactArmorCardEl(card));
          continue;
        }
        const div = buildCardEl(card, false, true);
        div.classList.add('in-play-badge');
        div.style.cursor = 'default';
        el.appendChild(div);
      }
      // Hand cards shown face-down unless recently revealed
      for (const card of G.botHand) {
        const isRevealed = G.botRevealedCard === card.id;
        if (isRevealed) {
          const div = buildCardEl(card, false, false);
          div.style.cursor = 'default';
          div.style.opacity = '0.9';
          el.appendChild(div);
        } else {
          el.appendChild(buildHiddenCard());
        }
      }
    }

    function renderBotHand() { renderBotCards(); }

    function buildCardEl(card, isPlayer, isInPlay = false) {
      const div = document.createElement('div');
      div.className = `card ${card.type}`;
      div.dataset.id = card.id;

      if (card.type === 'weapon') {
        const speedColor = { 'fast': 'var(--fast)', 'medium': 'var(--medium)', 'slow': 'var(--slow)', 'charged': 'var(--charged)' }[card.speed] || 'var(--muted)';
        const ammoPips = Array.from({ length: card.ammo + ((card._maxAmmo || card.ammo) - card.ammo) }, (_, i) => `<div class="ammo-pip${i >= card.ammo ? ' used' : ''}"></div>`).join('');
        div.innerHTML = `
      <div class="card-art"><div class="card-art-glow"></div>${card.icon || '🔫'}</div>
      <div class="card-header">
        <div class="card-name">${card.name}</div>
        <div class="card-type-badge weapon-badge">WEAPON · ${card.subtype.replace('_', ' ')}</div>
      </div>
      <div class="card-body">
        <div class="card-stat"><span class="card-stat-label">DMG</span><span class="card-stat-value" style="color:var(--accent2)">${card.damage}</span></div>
        <div class="card-stat"><span class="card-stat-label">RNG</span><span class="card-stat-value">${card.subtype === 'melee' ? '0sp' : `0–${card.range}sp`}</span></div>
        <div class="card-stat"><span class="card-stat-label">SPD</span><span class="card-stat-value" style="color:${speedColor}">${card.speed.toUpperCase()}</span></div>
      </div>
      <div class="card-footer"><div class="ammo-pips">${Array.from({ length: Math.min(card.ammo, 10) }, () => '<div class="ammo-pip"></div>').join('')}</div><span style="font-size:0.45rem;color:var(--muted);">${card.ammo}★</span></div>
    `;
      } else if (card.type === 'defense') {
        const isHeal = card.healAmount > 0;
        div.innerHTML = `
      <div class="card-art"><div class="card-art-glow"></div>${card.icon || '🛡️'}</div>
      <div class="card-header">
        <div class="card-name">${card.name}</div>
        <div class="card-type-badge defense-badge">DEFENSE · ${card.subtype}</div>
      </div>
      <div class="card-body">
        ${isHeal ? `<div class="card-stat"><span class="card-stat-label">HEAL</span><span class="card-stat-value" style="color:var(--green)">+${card.healAmount}</span></div>` : `
        <div class="card-stat"><span class="card-stat-label">DEF</span><span class="card-stat-value" style="color:var(--hero)">${card.defense}</span></div>
        <div class="card-stat"><span class="card-stat-label">DUR</span><span class="card-stat-value">${card.durability}/${card.maxDurability}</span></div>
        `}
      </div>
      <div class="card-footer">
        ${isHeal ? '<span style="font-size:0.48rem;color:var(--green)">ONE USE</span>' : `<div class="durability-bar"><div class="durability-fill" style="width:${(card.durability / card.maxDurability) * 100}%"></div></div>`}
      </div>
    `;
      } else if (card.type === 'character') {
        div.innerHTML = `
      <div class="card-art"><div class="card-art-glow"></div>${card.icon}</div>
      <div class="card-header">
        <div class="card-name">${card.name}</div>
        <div class="card-type-badge character-badge">CHARACTER · ${card.faction}</div>
      </div>
      <div class="card-body">
        <div class="card-stat"><span class="card-stat-label">HP</span><span class="card-stat-value">${card.hp}/${card.maxHp}</span></div>
        <div class="card-stat"><span class="card-stat-label">SPD</span><span class="card-stat-value">${card.speed}</span></div>
        <div style="font-size:0.48rem;color:var(--accent);margin-top:3px;">${card.attrDesc}</div>
      </div>
    `;
      }
      return div;
    }

    function buildCompactArmorCardEl(card) {
      const div = document.createElement('div');
      div.className = 'card defense mini-armor';
      div.dataset.id = card.id;
      const pct = Math.max(0, (card.durability / card.maxDurability) * 100);
      div.innerHTML = `
      <div class="mini-armor-icon">${card.icon || '🛡️'}</div>
      <div class="mini-armor-info">
        <div class="mini-armor-name">${card.name}</div>
        <div class="mini-armor-stats">DEF ${card.defense} · ${card.durability}/${card.maxDurability}</div>
        <div class="mini-armor-bar"><div class="mini-armor-bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;
      return div;
    }

    function buildHiddenCard() {
      const div = document.createElement('div');
      div.className = 'card hidden-card';
      div.innerHTML = `<div class="card-hidden-inner"><div class="shield">⚔️</div><span>HIDDEN</span></div>`;
      return div;
    }

    function renderArena() {
      const el = document.getElementById('arena-grid'); if (!el) return;
      el.innerHTML = '';

      const isSwift = G.playerChar.attribute === 'swift';
      const swiftSteps = isSwift ? (PHASES[G.phase] === 'fast' ? 2 : 1) : 1;
      const reachable = G.awaitingMove ? getReachableForChar(G.playerChar, G.playerPos, swiftSteps) : [];

      // Live weapon-range preview — if the player has a weapon card selected, the tiles
      // forming the straight line-of-fire between player and bot get a green outline,
      // and the bot's tile gets a 🎯 bullseye plus a valid/invalid outline to explain
      // why FIRE is (or isn't) available.
      const selCard = (!G.awaitingScrapChoice && G.selectedCard && !G.gameOver && !G.playerActedThisPhase)
        ? (G.playerHand.find(c => c.id === G.selectedCard) || G.playerInPlay.find(c => c.id === G.selectedCard))
        : null;
      const showRangePreview = !!(selCard && selCard.type === 'weapon');
      const previewRange = showRangePreview ? (selCard.subtype === 'melee' ? 0 : selCard.range) : -1;
      const linePath = showRangePreview ? new Set(getLinePath(G.playerPos, G.botPos)) : null;

      // Per-token HP bars, with a segmented shield sub-bar for any equipped armor.
      // Segment count = summed maxDurability of all equipped armor; filled segments
      // = summed remaining durability (i.e. hits the armor can still absorb).
      const pPct = Math.max(0, (G.playerChar.hp / G.playerChar.maxHp) * 100);
      const bPct = Math.max(0, (G.botChar.hp / G.botChar.maxHp) * 100);
      const getShieldStatus = inPlay => {
        const armor = inPlay.filter(c => c.type === 'defense' && c.healAmount === 0);
        const durability = armor.reduce((sum, c) => sum + Math.max(0, c.durability), 0);
        const maxDurability = armor.reduce((sum, c) => sum + c.maxDurability, 0);
        return { durability, maxDurability };
      };
      const shieldBarHtml = inPlay => {
        const { durability, maxDurability } = getShieldStatus(inPlay);
        if (maxDurability <= 0) return '';
        const segments = Array.from({ length: maxDurability }, (_, i) =>
          `<div class="shield-segment${i < durability ? ' filled' : ''}"></div>`
        ).join('');
        return `<div class="token-shield-bar">${segments}<span class="shield-label">${durability}</span></div>`;
      };
      const tokenHpBar = (pct, inPlay) => `${shieldBarHtml(inPlay)}<div class="token-hp-bar"><div class="token-hp-fill" style="width:${pct}%;background:${hpBarColor(pct)}"></div></div>`;

      // 7x7 grid: 7 rows × 7 cols = 49 tiles
      for (let r = 0; r < 7; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'arena-row';
        for (let c = 0; c < 7; c++) {
          const idx = r * 7 + c;
          const loc = G.locations[idx];
          const tile = document.createElement('div');
          tile.className = 'location-tile';
          const pHere = G.playerPos === idx;
          const bHere = G.botPos === idx;
          const dist = getDistance(G.playerPos, idx);
          // Fog of war only applies on Hard & Impossible — on Easy & Medium the whole
          // arena (including the bot's position) is always visible.
          //   Hard:       1-tile radius around the player, AND once a tile has been
          //               explored it stays revealed for the rest of the match (memory).
          //   Impossible: only the exact tile the player is standing on — no radius,
          //               no memory. The harshest visibility in the game.
          // The bot only appears within that same live radius, or briefly while a
          // Radar ping (Tactical Tim) has located it — Night Vision Goggles do NOT
          // reveal the bot, only the terrain (see below).
          const fogEnabled = G.difficulty === 'hard' || G.difficulty === 'impossible';
          const fogRadius = G.difficulty === 'impossible' ? 0 : 1;
          const permanentlyKnown = fogEnabled && G.difficulty === 'hard' && !!(G.revealedTiles && G.revealedTiles.has(idx));
          const revealed = !fogEnabled || dist <= fogRadius || permanentlyKnown || (bHere && G.radarPingActive);
          const botVisible = bHere && revealed;

          // Night Vision Goggles (head gear, nightVision:true) — always shows the map's
          // terrain in a translucent green tint, even where fog would normally hide it.
          // Doesn't reveal the bot itself, just the layout.
          const hasNightVision = fogEnabled && G.playerInPlay.some(c => c.nightVision);
          const nvgOnly = hasNightVision && !revealed;
          const showTerrain = revealed || hasNightVision;

          if (!showTerrain) tile.classList.add('fogged');
          else if (nvgOnly) tile.classList.add('nvg-tile');
          if (pHere && botVisible) tile.classList.add('both-here');
          else if (pHere) tile.classList.add('player-here');
          else if (botVisible) tile.classList.add('bot-here');
          if (G.awaitingMove && reachable.includes(idx)) tile.classList.add('selectable');
          else if (G.awaitingMove && !pHere) tile.classList.add('not-reachable');

          if (showRangePreview) {
            const inRange = dist <= previewRange;
            if (botVisible) {
              tile.classList.add(inRange ? 'weapon-target-valid' : 'weapon-target-invalid');
            } else if (linePath.has(idx)) {
              tile.classList.add('weapon-line');
            }
          }

          tile.innerHTML = `
        <div class="loc-icons">
          ${pHere ? `<div class="token-stack">${tokenHpBar(pPct, G.playerInPlay)}<div class="player-token ${G.playerChar.faction === 'hero' ? 'p' : 'b'}">${G.playerChar.icon}</div></div>` : ''}
          ${botVisible ? `<div class="token-stack">${tokenHpBar(bPct, G.botInPlay)}<div class="player-token ${G.botChar.faction === 'hero' ? 'p' : 'b'}">${G.botChar.icon}</div></div>` : ''}
        </div>
        ${showRangePreview && botVisible ? '<div class="weapon-bullseye">🎯</div>' : ''}
        <div class="loc-name">${showTerrain ? `${loc.icon} ${loc.name}` : '❔ ???'}</div>
        <div class="loc-effect ${showTerrain ? loc.css : ''}">${showTerrain ? loc.effectDesc : ''}</div>
        <div class="loc-dist">${dist > 0 ? dist + 'sp' : ''}</div>
      `;
          if (G.awaitingMove) {
            tile.addEventListener('click', () => playerMove(idx));
          }
          rowDiv.appendChild(tile);
        }
        el.appendChild(rowDiv);
      }
    }

    function renderDeckSizes() {
      // Update player card count label
      const countEl = document.getElementById('player-card-count');
      if (countEl) {
        const total = playerTotalCards();
        const max = getMaxHandSize(G.playerChar);
        countEl.textContent = `${total}/${max} CARDS`;
        countEl.style.color = total >= max ? 'var(--accent2)' : 'var(--muted)';
      }
    }

    function updatePhaseUI() {
      const phase = PHASES[G.phase];
      const badge = document.getElementById('phase-badge');
      badge.className = 'phase-badge';
      badge.classList.add(`phase-${phase}`);
      badge.textContent = phase.toUpperCase() + ' PHASE';
      document.getElementById('turn-num').textContent = G.turn;

      const skipBtn = document.getElementById('btn-skip');
      skipBtn.disabled = (!G.awaitingScrapChoice && G.playerActedThisPhase) || G.gameOver;
      if (G.awaitingScrapChoice) {
        skipBtn.textContent = 'PASS SCRAP';
      } else {
        skipBtn.textContent = 'END TURN';
      }

      // Tactical Tim Radar button — show when available
      const xrayBtn = document.getElementById('btn-xray');
      if (xrayBtn) {
        const canXray = G.playerChar.attribute === 'tactical_xray'
          && !G.playerActedThisPhase && !G.xrayUsedThisPhase
          && !G.gameOver;
        xrayBtn.style.display = G.playerChar.attribute === 'tactical_xray' ? 'inline-flex' : 'none';
        xrayBtn.disabled = !canXray;
        xrayBtn.style.opacity = canXray ? '1' : '0.4';
      }
    }

    function updateHint() {
      const el = document.getElementById('action-hint'); if (!el) return;
      const phase = PHASES[G.phase];
      if (G.gameOver) { el.textContent = 'Game over.'; return; }
      if (G.awaitingScrapChoice) {
        el.textContent = '⚠ SCRAP HEAP: Click a card to discard it, or PASS SCRAP to keep all.';
        el.style.color = 'var(--accent2)';
        return;
      }
      el.style.color = 'var(--muted)';
      if (G.playerActedThisPhase) {
        el.textContent = 'Waiting for bot...';
      } else if (G.awaitingMove) {
        const isSwift = G.playerChar.attribute === 'swift';
        const swiftSteps = isSwift ? (phase === 'fast' ? 2 : 1) : 1;
        el.textContent = `Move to a highlighted tile (costs your action — up to ${swiftSteps} space${swiftSteps > 1 ? 's' : ''}) — or play a card — or END TURN.`;
      } else if (!G.awaitingMove && G.playerChar.attribute === 'swift_melee' && getDistance(G.playerPos, G.botPos) === 0) {
        el.textContent = `⚡ logan in contact — strike now with a melee weapon, or END TURN!`;
        el.style.color = 'var(--accent2)';
      } else if (G.playerChar.attribute === 'heavy_armor' && (phase === 'fast' || phase === 'medium')) {
        el.textContent = `⚙️ Heavy armor: movement locked until Slow/Charged phase. Play a card or END TURN.`;
        el.style.color = 'var(--slow)';
      } else if (G.playerChar.attribute === 'sniper_specialist' && phase !== 'fast' && phase !== 'medium') {
        el.textContent = `🎯 Sniper stance: movement locked on Slow & Charged phases. Play a card or END TURN.`;
        el.style.color = 'var(--slow)';
      } else {
        el.textContent = `${phase.toUpperCase()} phase: play a ${phase} weapon, or any defense card. Or skip.`;
      }
    }

    function showHelp() { document.getElementById('help-overlay').classList.remove('hidden'); }

    function toggleHand(who) {
      const toggle = document.getElementById(`${who}-hand-toggle`);
      const collapsible = document.getElementById(`${who}-hand-collapsible`);
      if (!toggle || !collapsible) return;
      const isCollapsed = collapsible.classList.contains('collapsed');
      collapsible.classList.toggle('collapsed', !isCollapsed);
      toggle.classList.toggle('collapsed', !isCollapsed);
    }

    // Start both hands collapsed
    document.addEventListener('DOMContentLoaded', () => {
      ['player', 'bot'].forEach(who => {
        const t = document.getElementById(`${who}-hand-toggle`);
        if (t) t.classList.add('collapsed');
      });
    });