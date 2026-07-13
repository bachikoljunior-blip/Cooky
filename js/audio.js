// =============================================================
// audio.js - 簡易効果音シンセ (WebAudio) / Mキーでミュート
// =============================================================
'use strict';

const Sfx = (() => {
  let ctx = null, muted = false;
  function ac(){ if (!ctx) { try { ctx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} } return ctx; }

  function tone(freq, dur, type, vol, slide){
    const a = ac(); if (!a || muted) return;
    if (a.state !== 'running') { a.resume(); return; }   // 復帰直後の一発目でノイズを鳴らさない
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    const t0 = a.currentTime;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide), t0 + dur);
    const v = vol || 0.06;
    // 立ち上がりに短いフェードイン ― 音の頭の「プツッ」という爆音(クリック)を防ぐ
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0); o.stop(t0 + dur);
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
    // ---- バイオーム別BGM(周回中、エリアで曲が変わる) ----
    vol:    { tempo:124, root:92,    vol:.024, bass:[0,0,-1,-1,-3,-3,-1,-1], arp:[0,3,5,3,7,5,3,5], pad:[0,-1] },   // 灼熱/溶岩
    des:    { tempo:100, root:116,   vol:.021, bass:[0,-2,0,-4],             arp:[0,1,4,5,4,1,0,-1], pad:[0,-4] },  // 砂漠/白亜/骨
    dark:   { tempo:92,  root:82.4,  vol:.023, bass:[0,0,-2,-2,-5,-5,-2,-2], arp:[0,3,7,10,7,3,0,3], pad:[0,-5] }, // 魔界/虚無/黄昏
    cold:   { tempo:88,  root:146.8, vol:.019, bass:[0,-3,-2,-3],            arp:[0,7,4,7,2,7,4,7], pad:[0,-3] },   // 氷原/月影/霧
    wild:   { tempo:118, root:104,   vol:.022, bass:[0,0,-3,-3,0,0,-4,-4],   arp:[0,4,7,9,7,4,2,4], pad:[0] },     // 密林/嵐/黒曜
    sea:    { tempo:76,  root:123.5, vol:.019, bass:[0,-4,-3,-4],            arp:[0,4,7,11,7,4,0,4], pad:[0,-4] },  // 海
    end:    { tempo:140, root:73.4,  vol:.027, bass:[0,-1,0,-1,0,-2,0,-1],   arp:[0,6,3,6,1,6,4,6], pad:[0] },     // 終焉の大陸
  };
  // バイオーム → BGMシーンの対応
  const BIOME_BGM = {
    grass:'run', volcano:'vol', magma:'vol', desert:'des', chalk:'des', bones:'des',
    makai:'dark', void:'dark', twilight:'dark', frost:'cold', moon:'cold', mist:'cold',
    jungle:'wild', storm:'wild', obsidian:'wild', end:'end', sea:'sea',
  };
  function biomeScene(biome){ return BIOME_BGM[biome] || 'run'; }
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

  // ゲームを閉じて再開した後に音が消える対策(特にiOS Safari):
  //  - suspended / interrupted → resume。300ms待っても running に戻らなければ作り直す
  //  - closed → コンテキスト作り直し(次のtone/BGMで再生成)
  //  - タブ復帰時は「running のフリをして無音」の死んだコンテキストも検知して作り直す
  //    (currentTime が進んでいなければ死んでいる)
  //  - 作り直した直後のコンテキストは suspended のことがあるので、
  //    タッチ・キー操作のたびに resume を試みる
  function hardReset(){
    try { if (ctx) ctx.close(); } catch(e){}
    ctx = null;
    ac();   // すぐ作り直す(ユーザー操作中なら即 running になる)
  }
  function tryResume(){
    if (!ctx) { ac(); return; }
    if (ctx.state === 'closed') { ctx = null; ac(); return; }
    if (ctx.state !== 'running') {
      try {
        const pr = ctx.resume();
        if (pr && pr.catch) pr.catch(() => {});
      } catch(e){}
      setTimeout(() => { if (ctx && ctx.state !== 'running') hardReset(); }, 300);
    }
  }
  function wakeCheck(){
    tryResume();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    setTimeout(() => {
      if (ctx && ctx.state === 'running' && ctx.currentTime === t0) hardReset();
    }, 350);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wakeCheck(); });
  window.addEventListener('pageshow', wakeCheck);
  window.addEventListener('focus', tryResume);
  window.addEventListener('pointerdown', tryResume, { passive:true });
  window.addEventListener('touchstart', tryResume, { passive:true });
  window.addEventListener('touchend', tryResume, { passive:true });
  window.addEventListener('keydown', tryResume);

  return {
    setScene, biomeScene,
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
    boss(){ tone(90,.45,'triangle',.06, -20); setTimeout(()=>tone(70,.5,'triangle',.06,-14),280); },
    // 大群の警告: 深すぎず耳障りでない、上がっていくアラート音
    horde(){ tone(330,.12,'square',.05,80); setTimeout(()=>tone(440,.14,'square',.05,60),130); },
    die(){ tone(300,.5,'sawtooth',.08,-260); },
    boat(){ tone(200,.25,'triangle',.06, 120); },
    unlock(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.18,'triangle',.06), i*110)); },
  };
})();
