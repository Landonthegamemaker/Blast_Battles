/** 
 * audio.js - BLAST BATTLES AUDIO ENGINE v2
 * No dependencies required. Safe to import and call BB_Audio functions immediately, but will defer actual audio start until user interaction (click or keypress) to comply with browser autoplay policies.
    * All files live in .audio/music/ — committed to soundRealm branch.
    * See AUDIO_SETUP.md for full attribution and rename map.
 * Exports (browser globals):
 * BB_Audio (init, 
 * previewCharTheme, 
 * startGameplay, 
 * returnToSelect, 
 * playEndMusic, 
 * playZoneSfx, 
 * stopSfx, 
 * toggleMute, 
 * setVolume, 
 * isMuted)
 */
'use strict';

// ── Constants ────────────────────────────────────────────────────────────────
const BB_Audio = (() => {
    const TRACKS = {
        select: { src: './audio/music/Hero_Theme_-_MK2.mp3', loop: true },
        char_commando_cole: { src: './audio/music/amaksi-shadow-protocol-425633.mp3', loop: false },
        char_agent_ace: { src: './audio/music/nickpanekaiassets-epic-sci-fi-villain-theme-for-cinematic-projects-224750.mp3', loop: false },
        char_macy: { src: './audio/music/Different Heaven, EH!DE - My Heart [NCS Release].mp3', loop: false },
        char_pistol_pete: { src: './audio/music/prettyjohn1-basketball-basketball-music_35sec-500589.mp3', loop: false },
        char_ranger_kate: { src: './audio/music/luis_humanoide-soldiers-march-289540.mp3', loop: false },
        char_sentinel_sam: { src: './audio/music/Pat - Shotgun [NCS Release].mp3', loop: false },
        char_sprinting_sue: { src: './audio/music/Tom Wilson - Run For Your Life  [NCS Release].mp3', loop: false },
        char_tracy_guns: { src: "./audio/music/HXI - Lock n' Load [NCS Release].mp3", loop: false },
        char_cowboy_carl: { src: './audio/music/roybushband-dark-western-149423.mp3', loop: false },
        char_hank: { src: './audio/music/Thor_s_Hammer_-_Ethan_Meixsell.mp3', loop: false },
        char_huntress: { src: './audio/music/RAIZHELL, CLOUD ZERO - KILL ZONE [NCS Release].mp3', loop: false },
        char_iron_titan: { src: './audio/music/NIVIRO - The Riot [NCS Release].mp3', loop: false },
        char_lunging_logan: { src: './audio/music/Jim Yosef - Samurai [NCS Release].mp3', loop: false },
        char_tactical_tim: { src: './audio/music/nickpanekaiassets-epic-orchestral-villain-theme-281930.mp3', loop: false },
        char_the_shadow: { src: './audio/music/the_mountain-eerie-375969.mp3', loop: false },
        char_toxic_trooper: { src: './audio/music/white_records-toxic-drift-phonk-house-background-music-for-video-stories-57-second-503889.mp3', loop: false },
        gameplay_1: { src: './audio/music/black_rose_rabbit-dark-music-249503.mp3', loop: true },
        gameplay_2: { src: './audio/music/Actin_Up_-_MK2.mp3', loop: true },
        gameplay_3: { src: './audio/music/M.I.M.E, Requenze, Asketa & Natan Chaim - Warriors [NCS Release].mp3', loop: true },
        gameplay_4: { src: './audio/music/Hoober, Axol - How We Do It (ft. Marvin Divine) [NCS Release].mp3', loop: true },
        gameplay_5: { src: './audio/music/TOKYO MACHINE, NEFFEX - Desperate [NCS Release].mp3', loop: true },
        gameplay_6: { src: './audio/music/Ship Wrek - Ark [NCS Release].mp3', loop: true },
        gameplay_7: { src: './audio/music/Fareoh - Under Water [NCS Release].mp3', loop: true },
        gameplay_8: { src: './audio/music/JPB, Ashley Apollodor - Defeat The Night (feat. Ashley Apollodor) [NCS Release].mp3', loop: true },
        end_hero_victory: { src: './audio/music/Janji, Johnning - Heroes Tonight (feat. Johnning) [NCS Release].mp3', loop: false },
        end_villain_victory: { src: './audio/music/NIVIRO - Demons [NCS Release].mp3', loop: false },
        end_draw: { src: './audio/music/Sync, Avi Snow, Marky Style - Alright [NCS Release].mp3', loop: false },
        end_defeat: { src: './audio/music/Cartoon, Coleman Trapp, Jeja - Why We Lose (feat. Coleman Trapp) [NCS Release].mp3', loop: false },
        sfx_hero: { src: './audio/sfx/569062__humanoide9000__superhero-theme.wav', loop: false },
        sfx_villain: { src: './audio/sfx/569047__humanoide9000__evil-villian-theme.wav', loop: false },
        sfx_hazard: { src: './audio/sfx/328381__leonelmail__radioactive-machine.mp3', loop: false },
        sfx_scrap: { src: './audio/sfx/847481__gettinsomegamesounds__dropped-scrap-metal.mp3', loop: false },
    };

    const CHAR_THEMES = {
        c16: 'char_agent_ace',     // Agent Ace
        c7: 'char_commando_cole', // Commando Cole
        c4: 'char_macy',          // Macy the Medic
        c1: 'char_pistol_pete',   // Pistol Pete
        c14: 'char_ranger_kate',   // Ranger Kate
        c10: 'char_sentinel_sam',  // Sentinel Sam
        c6: 'char_sprinting_sue', // Sprinting Sue
        c11: 'char_tracy_guns',    // Tracy Guns
        c9: 'char_cowboy_carl',   // Cowboy Carl
        c15: 'char_hank',          // Hank the Tank
        c12: 'char_huntress',      // Huntress Hellena
        c2: 'char_iron_titan',    // Iron Titan
        c3: 'char_lunging_logan', // Lunging Logan
        c13: 'char_tactical_tim',  // Tactical Tim
        c8: 'char_the_shadow',    // The Shadow
        c5: 'char_toxic_trooper', // Toxic Trooper
    };

    const GAMEPLAY_POOL = ['gameplay_1', 'gameplay_2', 'gameplay_3', 'gameplay_4',
        'gameplay_5', 'gameplay_6', 'gameplay_7', 'gameplay_8'];

    let currentBgm = null, currentKey = null, sfxDucked = false;
    let muted = false, _charTimer = null, _started = false;
    let bgmVol = 0.50, sfxVol = 0.70;
    let _startingGameplay = false;

    const cache = {};
    function get(key) {
        if (!cache[key]) {
            const t = TRACKS[key];
            if (!t) return null;
            const a = new Audio(t.src);
            a.loop = t.loop; a.volume = key.startsWith('sfx') ? sfxVol : bgmVol; a.preload = 'auto';
            cache[key] = a;
        }
        return cache[key];
    }

    function fadeTo(audio, targetVol, ms, onDone) {
        const steps = 30, delay = ms / steps;
        let delta = (targetVol - audio.volume) / steps, count = 0;
        const id = setInterval(() => {
            count++; audio.volume = Math.max(0, Math.min(1, audio.volume + delta));
            if (count >= steps) { clearInterval(id); audio.volume = targetVol; if (onDone) onDone(); }
        }, delay);
    }

    function stopCurrent(fadeMs = 1000) {
        if (currentBgm && !currentBgm.paused) {
            const old = currentBgm;
            fadeTo(old, 0, fadeMs, () => { old.pause(); old.currentTime = 0; });
        }
        if (_charTimer) { clearTimeout(_charTimer); _charTimer = null; }
    }

    function playBgm(key, fadeMs = 1200) {
        if (muted || currentKey === key) return;
        const next = get(key); if (!next) return;
        next.volume = 0; next.currentTime = 0; next.play().catch((e) => { console.warn(`BB_Audio BGM failed [${key}]:`, e.message, TRACKS[key]?.src); });
        stopCurrent(fadeMs);
        fadeTo(next, muted ? 0 : bgmVol, fadeMs);
        currentBgm = next; currentKey = key;
    }

    let currentSfx = null;  // track active SFX so we can stop it on next move

    function playSfx(key) {
        if (muted) return;
        // Stop any currently playing SFX immediately
        if (currentSfx && !currentSfx.paused) {
            currentSfx.pause();
            currentSfx.currentTime = 0;
            if (currentBgm) fadeTo(currentBgm, muted ? 0 : bgmVol, 400);
            sfxDucked = false;
        }
        const sfx = get(key); if (!sfx) return;
        sfx.currentTime = 0; sfx.volume = sfxVol;
        if (currentBgm && !sfxDucked) { sfxDucked = true; fadeTo(currentBgm, bgmVol * 0.2, 200); }
        sfx.play().catch((e) => { console.warn(`BB_Audio SFX failed [${key}]:`, e.message, TRACKS[key]?.src); });
        currentSfx = sfx;
        sfx.onended = () => {
            if (currentBgm) fadeTo(currentBgm, muted ? 0 : bgmVol, 600);
            sfxDucked = false;
            currentSfx = null;
        };
    }

    function stopSfx() {
        if (currentSfx && !currentSfx.paused) {
            currentSfx.pause();
            currentSfx.currentTime = 0;
            if (currentBgm) fadeTo(currentBgm, muted ? 0 : bgmVol, 400);
            sfxDucked = false;
            currentSfx = null;
        }
    }

    function playRandomGameplay() {
        const pool = GAMEPLAY_POOL.filter(k => k !== currentKey);
        const key = pool[Math.floor(Math.random() * pool.length)];
        playBgm(key, 1500);
        const audio = get(key);
        if (audio) audio.onended = () => { if (currentKey === key) playRandomGameplay(); };
    }

    return {
        init() { if (_started) return; _started = true; playBgm('select', 800); },

        // Preview first 10s of char theme on select screen click
        previewCharTheme(charId) {
            BB_Audio.init(); // ensure audio started
            const key = CHAR_THEMES[charId];
            console.log(`BB_Audio preview: charId=${charId} key=${key} src=${TRACKS[key]?.src}`);
            if (!key) return;
            if (_charTimer) { clearTimeout(_charTimer); _charTimer = null; }
            // Fade out select BGM
            if (currentBgm && !currentBgm.paused) fadeTo(currentBgm, 0, 400);
            const preview = get(key);
            if (!preview) return;
            preview.currentTime = 15;  // skip quiet intro
            preview.volume = 0;
            preview.play().catch((e) => { console.warn(`BB_Audio preview failed [${key}]:`, e.message, TRACKS[key]?.src); });
            fadeTo(preview, bgmVol, 400);
            currentBgm = preview; currentKey = key;
            // After 10s fade back to select theme
            _charTimer = setTimeout(() => {
                fadeTo(preview, 0, 600, () => { preview.pause(); preview.currentTime = 0; });
                const sel = get('select');
                if (sel) { sel.currentTime = 0; sel.volume = 0; sel.play().catch(() => { }); fadeTo(sel, bgmVol, 800); currentBgm = sel; currentKey = 'select'; }
                _charTimer = null;
            }, 10000);
        },

        startGameplay(charId) {
            // Cancel any pending preview fade-back-to-select timer
            _startingGameplay = true;
            if (_charTimer) { clearTimeout(_charTimer); _charTimer = null; }

            const sel = get('select');
            if (sel && !sel.paused) { sel.pause(); sel.currentTime = 0; }

            const themeKey = CHAR_THEMES[charId];
            if (themeKey) {
                const theme = get(themeKey);
                if (theme) {
                    if (currentBgm === theme) {
                        // Theme already playing as a preview — restart cleanly from the top
                        fadeTo(theme, 0, 300, () => {
                            theme.currentTime = 0;
                            theme.volume = 0;
                            theme.play().catch(() => { });
                            fadeTo(theme, bgmVol, 800);
                        });
                    } else {
                        // Different track playing (select music, or nothing) — fade it out and start theme
                        if (currentBgm && !currentBgm.paused) {
                            fadeTo(currentBgm, 0, 600, () => { currentBgm.pause(); currentBgm.currentTime = 0; });
                        }
                        theme.currentTime = 0;
                        theme.volume = 0;
                        theme.play().catch(() => { });
                        fadeTo(theme, bgmVol, 800);
                    }
                    currentBgm = theme; currentKey = themeKey;
                    // After 30s hand off to random gameplay music
                    _charTimer = setTimeout(() => { _charTimer = null; playRandomGameplay(); }, 30000);
                } else {
                    _startingGameplay = false;
                    playRandomGameplay();
                }
            } else {
                playRandomGameplay();
            }
        },

        returnToSelect() {
            _startingGameplay = false;
            if (_charTimer) { clearTimeout(_charTimer); _charTimer = null; }
            // Force stop whatever is playing
            if (currentBgm && !currentBgm.paused) {
                fadeTo(currentBgm, 0, 400, () => {
                    currentBgm.pause();
                    currentBgm.currentTime = 0;
                });
            }
            currentBgm = null;
            currentKey = null;
            // Now start select music fresh
            setTimeout(() => playBgm('select', 800), 450);
        },

        playEndMusic(winner, playerFaction) {
            if (_charTimer) { clearTimeout(_charTimer); _charTimer = null; }
            stopCurrent(800);
            let key;
            if (winner === 'draw') key = 'end_draw';
            else if (winner === 'player') key = playerFaction === 'hero' ? 'end_hero_victory' : 'end_villain_victory';
            else key = 'end_defeat';  // player lost — always Why We Lose
            setTimeout(() => {
                const endAudio = get(key);
                if (endAudio) endAudio.currentTime = 30;
                playBgm(key, 1200);
            }, 600);
        },

        playZoneSfx(effect) {
            if (effect === 'hero_zone') playSfx('sfx_hero');
            if (effect === 'villain_zone') playSfx('sfx_villain');
            if (effect === 'radiation') playSfx('sfx_hazard');
            if (effect === 'discard') playSfx('sfx_scrap');
        },
        stopSfx() { stopSfx(); },

        toggleMute() { muted = !muted; if (currentBgm) currentBgm.volume = muted ? 0 : bgmVol; return muted; },
        setVolume(val) {
            const v = Math.max(0, Math.min(1, val));
            bgmVol = v;
            sfxVol = Math.min(1, v * 1.4);
            if (currentBgm && !muted) currentBgm.volume = bgmVol;
        },
        isMuted() { return muted; }
    };
})();

document.addEventListener('click', () => BB_Audio.init(), { once: true });
document.addEventListener('keydown', () => BB_Audio.init(), { once: true });