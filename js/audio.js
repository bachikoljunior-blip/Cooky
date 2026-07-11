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

  // ---------------- BGM (プロシージャル・シーケンサー) ----------------
  // マイナースケール上のパターンをシーンごとに演奏。ファイル不要・軽量
  const SCALE = [0, 2, 3, 5, 7, 8, 10];
  function note(root, deg, oct){
    const n = SCALE[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7) + 12 * (oct || 0);
    return root * Math.pow(2, n / 12);
  }
  const BGM_DEFS = {
    title:  { tempo:72,  root:110,   vol:.020, bass:[0,0,-4,-4,-2,-2,-3,-3], arp:[0,2,4,2,0,2,4,7], pad:[0,-2] },
    hub:    { tempo:84,  root:130.8, vol:.018, bass:[0,-3,-4,-2],            arp:[0,4,2,4,0,4,2,7], pad:[0,-3] },
    run:    { tempo:112, root:110,   vol:.022, bass:[0,0,0,0,-2,-2,-3,-3],   arp:[0,4,7,4,2,4,7,9], pad:[0] },
    boss:   { tempo:132, root:98,    vol:.026, bass:[0,0,-1,-1,0,0,-2,-2],   arp:[0,3,7,3,0,3,8,3], pad:[0,-1] },
    reaper: { tempo:152, root:87.3,  vol:.028, bass:[0,-1,0,-2,0,-1,3,-2],   arp:[0,7,3,7,1,7,4,7], pad:[0] },
  };
  let bgmScene = null, bgmTimer = null, bgmStep = 0;
  function setScene(name){
    if (bgmScene === name) return;
    bgmScene = name; bgmStep = 0;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    if (!name || !BGM_DEFS[name]) return;
    const d = BGM_DEFS[name];
    bgmTimer = setInterval(() => {
      if (muted) return;
      const a = ac(); if (!a) return;
      if (a.state === 'suspended') { a.resume(); return; }
      const s = bgmStep++;
      const bp = d.bass[(s >> 1) % d.bass.length];
      if (s % 2 === 0 && bp !== null) tone(note(d.root, bp, 0), 0.30, 'triangle', d.vol * 1.5);
      const ap = d.arp[s % d.arp.length];
      if (ap !== null) tone(note(d.root, ap, 1), 0.12, 'square', d.vol * 0.7);
      if (s % 16 === 0) tone(note(d.root, d.pad[(s >> 4) % d.pad.length], 0), 1.4, 'sine', d.vol);
    }, 60000 / BGM_DEFS[name].tempo / 2);
  }

  // ゲーム再開後に音が消える対策: タブ復帰や操作でAudioContextを再開する
  function tryResume(){ if (ctx && ctx.state === 'suspended') ctx.resume(); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tryResume(); });
  window.addEventListener('pointerdown', tryResume, { passive:true });
  window.addEventListener('keydown', tryResume);
  window.addEventListener('focus', tryResume);

  return {
    setScene,
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
