// =============================================================
// audio.js - 簡易効果音シンセ (WebAudio) / Mキーでミュート
// =============================================================
'use strict';

const Sfx = (() => {
  let ctx = null, muted = false;
  function ac(){ if (!ctx) { try { ctx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} } return ctx; }

  function tone(freq, dur, type, vol, slide){
    const a = ac(); if (!a || muted) return;
    if (a.state === 'suspended') a.resume();
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide), a.currentTime + dur);
    g.gain.value = vol || 0.06;
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  }
  const lastPlay = {};
  function throttled(key, fn, ms){ const t = performance.now(); if (lastPlay[key] && t - lastPlay[key] < ms) return; lastPlay[key] = t; fn(); }

  return {
    toggleMute(){ muted = !muted; return muted; },
    get muted(){ return muted; },
    shoot(){ throttled('sh', ()=>tone(680, .07, 'square', .025, -300), 70); },
    hit(){ throttled('hit', ()=>tone(220, .06, 'sawtooth', .03, -80), 50); },
    coin(){ throttled('coin', ()=>{ tone(880, .06, 'square', .04); setTimeout(()=>tone(1320,.09,'square',.04),50); }, 90); },
    mat(){ throttled('mat', ()=>tone(520, .08, 'triangle', .05, 220), 90); },
    hurt(){ throttled('hurt', ()=>tone(140, .18, 'sawtooth', .07, -60), 150); },
    skill(){ tone(440,.1,'triangle',.06); setTimeout(()=>tone(660,.12,'triangle',.06),80); setTimeout(()=>tone(880,.16,'triangle',.06),160); },
    recruit(){ tone(523,.1,'sine',.07); setTimeout(()=>tone(784,.14,'sine',.07),90); },
    buy(){ tone(700,.08,'square',.05); setTimeout(()=>tone(1050,.1,'square',.05),70); },
    deny(){ tone(160,.14,'square',.05); },
    boss(){ tone(80,.5,'sawtooth',.09, -30); setTimeout(()=>tone(70,.6,'sawtooth',.09,-20),300); },
    die(){ tone(300,.5,'sawtooth',.08,-260); },
    boat(){ tone(200,.25,'triangle',.06, 120); },
    unlock(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.18,'triangle',.06), i*110)); },
  };
})();
