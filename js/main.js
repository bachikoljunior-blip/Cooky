// =============================================================
// main.js - ゲームループ / 状態管理 / UI配線
//   状態: title / hub(魂の広場) / run(周回)
// =============================================================
'use strict';

const Game = (() => {
  const canvas = document.getElementById('game');
  const g = canvas.getContext('2d');
  let state = 'title';
  let overlay = null;   // null | 'skill' | 'station' | 'pause' | 'result' | 'help'
  let lastT = 0, titleT = 0;

  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const el = id => document.getElementById(id);
  const show = id => el(id).classList.remove('hidden');
  const hide = id => el(id).classList.add('hidden');

  // ---------------- 状態遷移 ----------------
  function toTitle(){
    state = 'title'; overlay = null;
    show('title-screen'); hide('hud');
    document.body.classList.add('in-title');
    Sfx.setScene('title');
  }
  function toHub(){
    state = 'hub'; overlay = null;
    document.body.classList.remove('in-title');
    hide('title-screen'); hide('hud'); hide('result-panel'); hide('station-panel');
    Hub.enter();
    Sfx.setScene('hub');
  }
  function startRun(pos){
    state = 'run'; overlay = null;
    document.body.classList.remove('in-title');
    hide('title-screen'); hide('station-panel'); hide('skill-panel'); hide('pause-panel');
    show('hud');
    el('interact-hint').classList.add('hidden');
    Run.start(pos);
    Sfx.setScene('run');
  }
  // 周回中に基地へ着いた: 拠点マップへ転移(周回は裏で保持)
  function enterBaseFromRun(baseId){
    state = 'hub'; overlay = null;
    hide('hud'); hide('station-panel'); hide('skill-panel'); hide('pause-panel');
    el('interact-hint').classList.add('hidden');
    Hub.enterFromRun(baseId);
    Sfx.setScene('hub');
  }
  // 拠点マップのゲートから周回へ復帰(Run.startは呼ばず状態を維持)
  function resumeRun(){
    state = 'run'; overlay = null;
    hide('station-panel'); hide('skill-panel'); hide('pause-panel');
    show('hud');
    el('interact-hint').classList.add('hidden');
    Run.state.noInteractT = 1.0;   // 復帰直後に再び転移しないよう猶予
    Sfx.setScene('run');
  }

  // ---------------- 周回中のNPC会話 ----------------
  let runDlg = null;
  function openRunDialog(name, lines, onDone, face){
    overlay = 'dialog';
    const faceEl = el('dialog-face');
    if (face) { faceEl.src = Sprites.get(face).toDataURL(); faceEl.classList.remove('hidden'); }
    else faceEl.classList.add('hidden');
    el('dialog-name').textContent = name;
    el('dialog-choices').innerHTML = '';
    runDlg = { lines: lines.slice(), onDone };
    show('dialog-box');
    advanceRunDialog();
  }
  function advanceRunDialog(){
    if (!runDlg) {
      // 選択肢の表示中などにE/Escで閉じる(「やめておく」扱い)
      hide('dialog-box');
      el('dialog-choices').innerHTML = '';
      overlay = null;
      return;
    }
    if (!runDlg.lines.length) {
      hide('dialog-box');
      const cb = runDlg.onDone; runDlg = null;
      overlay = null;
      if (cb) cb();
      return;
    }
    el('dialog-text').textContent = runDlg.lines.shift();
  }
  // 汎用ダイアログAPI(クエスト・NPC会話が使う。表示中はゲーム停止)
  function dialog(name, face, lines, onDone){
    openRunDialog(name, lines, onDone, face);
  }
  function dialogChoice(name, face, text, choices){
    overlay = 'dialog';
    const faceEl = el('dialog-face');
    if (face) { faceEl.src = Sprites.get(face).toDataURL(); faceEl.classList.remove('hidden'); }
    else faceEl.classList.add('hidden');
    el('dialog-name').textContent = name;
    el('dialog-text').textContent = text;
    const ch = el('dialog-choices');
    ch.innerHTML = choices.map((c, i) =>
      `<button class="dlg-choice ${c.sub ? 'sub' : ''}" id="dlg-c${i}" ${c.disabled ? 'disabled' : ''}>${c.label}</button>`).join('');
    show('dialog-box');
    choices.forEach((c, i) => {
      el('dlg-c' + i).onclick = () => {
        if (c.disabled) return;
        ch.innerHTML = '';
        hide('dialog-box');
        overlay = null;
        if (c.cb) c.cb();
      };
    });
  }

  // 解放済み基地のNPCと再会話(豆知識 + 2段階目クエストの提案/報告)
  function npcTalk(baseId){
    const q = DATA.QUESTS[baseId];
    if (!q) return;
    // 2段階目クエスト進行中ならクエスト側の会話(報告・途中経過)
    if (Quest.activeFor('base2', baseId)) { Quest.atNpc(); return; }
    const tip = DATA.NPC_TIPS[Math.floor(Math.random() * DATA.NPC_TIPS.length)];
    const lines = (q.after ? q.after.slice() : ['おお、また会えたな。ここはもうお前の拠点だ。'])
      .concat(['「' + tip + '」']);
    const q2 = DATA.QUESTS2[baseId];
    const done2 = SaveSys.data.quests2 && SaveSys.data.quests2[baseId];
    dialog(q.npcName, q.npc, lines, () => {
      if (!q2 || done2 || Quest.active) return;
      dialogChoice(q.npcName, q.npc, q2.offer, [
        { label:'話を聞く', cb(){ Quest.offer('base2', baseId); } },
        { label:'また今度', sub:true },
      ]);
    });
  }

  function pauseFor(kind){
    overlay = kind;
    if (kind === 'station') show('station-panel');
  }
  function closeStation(){
    hide('station-panel');
    overlay = null;
  }

  function toggleSkillPanel(){
    if (state !== 'run') return;
    if (overlay === 'skill') { Skills.close(); overlay = null; }
    else if (!overlay) { Skills.open(); overlay = 'skill'; }
  }
  function togglePause(){
    if (state !== 'run') return;
    if (overlay === 'pause') { hide('pause-panel'); overlay = null; }
    else if (!overlay) {
      const R = Run.state;
      el('pause-info').textContent =
        '経過 ' + fmtTime(R.time) + ' / 撃破 ' + R.kills + ' / 🪙 ' + fmtNum(R.coins) +
        ' / 仲間 ' + R.allies.length + '。リタイアすると獲得コインと素材換金分を持ち帰る。';
      show('pause-panel'); overlay = 'pause';
    }
  }

  function showResult(res){
    overlay = 'result';
    el('result-title').textContent = res.retired ? '帰還した' :
      (res.time >= DATA.REAPER_AT ? '終焉に呑まれた…' : '力尽きた…');
    el('result-body').innerHTML = `
      <div class="r-line">生存時間: <b>${fmtTime(res.time)}</b></div>
      <div class="r-line">到達距離: <b>${fmtNum(res.dist)}</b></div>
      <div class="r-line">撃破数: <b>${fmtNum(res.kills)}</b> / 仲間にした数: <b>${res.recruits}</b></div>
      <div class="r-line">獲得コイン: <b>${fmtNum(res.coins)}</b></div>
      <div class="r-line">余り素材の換金: <b>+${fmtNum(res.matBonus)}</b></div>
      <div class="r-line r-big">持ち帰り合計: 🪙 ${fmtNum(res.total)}</div>
      <div class="r-line small">銀行残高: 🪙 ${fmtNum(SaveSys.data.coins)}</div>
      ${(res.newAchs || []).map(a => `<div class="r-line" style="color:#ffd766">🏆 実績解除「${a.name}」! ― ${a.reward}</div>`).join('')}`;
    show('result-panel');
  }

  function endRun(retired){
    const res = Run.finishRun(retired);
    hide('pause-panel'); hide('skill-panel'); hide('station-panel'); hide('hud');
    showResult(res);
  }

  // ---------------- 入力(フレーム毎) ----------------
  function handleKeys(){
    if (Input.once('Tab')) toggleSkillPanel();
    if (Input.once('KeyN') && state === 'run') Run.toggleMap();
    if (Input.once('KeyM')) {
      const m = Sfx.toggleMute();
      if (state === 'run') { Run.state.warnMsg = m ? '🔇 ミュート' : '🔊 サウンドON'; Run.state.warnT = 1.2; }
    }
    if (Input.once('KeyE') || Input.once('Space')) {
      if (overlay === 'dialog') advanceRunDialog();
      else if (!overlay) {
        if (state === 'run') Run.doInteract();
        else if (state === 'hub') Hub.doInteract();
      }
    }
    if (Input.once('KeyP') || Input.once('Escape')) {
      if (overlay === 'dialog') { advanceRunDialog(); return; }
      if (overlay === 'skill') toggleSkillPanel();
      else if (overlay === 'station') closeStation();
      else togglePause();
    }
  }

  // ---------------- メインループ ----------------
  function loop(t){
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    const W = canvas.width, H = canvas.height;

    if (state !== 'title') handleKeys();
    Input.endFrame();

    if (state === 'run') {
      const R = Run.state;
      if (!overlay && !R.over) Run.update(dt);
      Run.draw(g, W, H);
      Run.updateHud(dt);
      Sfx.setScene(R.time >= DATA.REAPER_AT ? 'reaper'
        : (R.bossAlive && !R.bossAlive.dead) ? 'boss'
        : Sfx.biomeScene(R.curBiome || 'grass'));
      if (R.over && overlay !== 'result') endRun(false);
    } else if (state === 'hub') {
      if (!overlay) Hub.update(dt);
      Hub.draw(g, W, H);
    } else {
      // タイトル背景: 夜空+浮遊する光の粒
      titleT += dt;
      const bgGrad = g.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#0b0f1a');
      bgGrad.addColorStop(0.6, '#131c33');
      bgGrad.addColorStop(1, '#1a1230');
      g.fillStyle = bgGrad;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 42; i++) {
        const sp = 12 + (i * 37) % 30;
        const px = ((i * 227) % 100) / 100 * W + Math.sin(titleT * 0.5 + i) * 30;
        const py = H - (((titleT * sp + i * 173) % (H + 80)) - 40);
        const hue = [45, 30, 200, 280][i % 4];
        g.fillStyle = `hsla(${hue}, 90%, 65%, ${0.25 + (i % 3) * 0.12})`;
        g.beginPath(); g.arc(px, py, 1.5 + (i % 3), 0, 7); g.fill();
      }
      // 地平線のシルエット
      g.fillStyle = 'rgba(8,12,22,.85)';
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 40) g.lineTo(x, H - 40 - Math.sin(x * 0.01 + 2) * 24);
      g.lineTo(W, H); g.closePath(); g.fill();
    }
  }

  // ミニマップをタップ/クリックで全画面の全体図を開く/閉じる
  canvas.addEventListener('pointerdown', e => {
    if (state !== 'run' || overlay) return;
    Run.tapMap(e.clientX, e.clientY, canvas.width);
  });

  // 移動パネル設定 (表示/非表示/自動)
  const PAD_LABELS = { on:'移動パネル: 表示', off:'移動パネル: 非表示', auto:'移動パネル: 自動' };
  function refreshPadButtons(){
    const label = PAD_LABELS[Input.getPadMode()];
    el('btn-pad').textContent = label;
    el('pause-pad').textContent = label;
  }
  function cyclePad(){
    const order = ['on','off','auto'];
    const next = order[(order.indexOf(Input.getPadMode()) + 1) % order.length];
    Input.setPadMode(next);
    SaveSys.data.settings.pad = next;
    SaveSys.save();
    refreshPadButtons();
  }
  el('btn-pad').onclick = cyclePad;
  el('pause-pad').onclick = cyclePad;

  // ---------------- UI配線 ----------------
  el('btn-start').onclick = () => {
    Sfx.buy();
    if (SaveSys.data.stats.runs === 0) startRun({ x:0, y:0 });
    else toHub();
  };
  el('btn-help').onclick = () => { show('help-panel'); };
  el('help-close').onclick = () => { hide('help-panel'); };
  el('btn-wipe').onclick = () => {
    if (confirm('本当に全データを消しますか?(恒久強化・基地・港もリセット)')) {
      SaveSys.wipe();
      alert('初期化しました');
    }
  };
  el('skill-close').onclick = () => toggleSkillPanel();
  el('station-close').onclick = () => {
    closeStation();
  };
  el('result-ok').onclick = () => { hide('result-panel'); toHub(); };
  el('pause-resume').onclick = () => togglePause();
  el('pause-retire').onclick = () => { endRun(true); };
  el('btn-skill').onclick = () => toggleSkillPanel();
  el('btn-act').onclick = () => {
    if (overlay === 'dialog') { advanceRunDialog(); return; }
    if (!overlay) {
      if (state === 'run') Run.doInteract();
      else if (state === 'hub') Hub.doInteract();
    }
  };
  el('dialog-box').addEventListener('pointerdown', e => {
    if (e.target.classList.contains('dlg-choice')) return;   // 選択肢は自身のonclick
    if (overlay === 'dialog') advanceRunDialog();
  });

  // スマホのダブルタップ拡大・ピンチ拡大を防止
  document.addEventListener('dblclick', e => e.preventDefault(), { passive:false });
  document.addEventListener('gesturestart', e => e.preventDefault(), { passive:false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', e => {
    const now = performance.now();
    if (now - lastTouchEnd < 320) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });

  // ---------------- 起動 ----------------
  SaveSys.load();
  World.initExplored(SaveSys.data.explored);
  Input.setPadMode(SaveSys.data.settings.pad);
  Sprites.loadOverrides();
  toTitle();
  refreshPadButtons();
  setTimeout(() => World.worldImage(), 60);   // 全世界ミニマップを裏で生成
  requestAnimationFrame(loop);

  return { startRun, enterBaseFromRun, resumeRun, pauseFor, closeStation, toHub, npcTalk, dialog, dialogChoice,
           advanceDialog: advanceRunDialog, get state(){ return state; } };
})();
