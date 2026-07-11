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
  // 解放済み基地のNPCと再会話(豆知識 + 2段階目クエストの提案)
  function npcTalk(baseId){
    const q = DATA.QUESTS[baseId];
    if (!q) return;
    const tip = DATA.NPC_TIPS[Math.floor(Math.random() * DATA.NPC_TIPS.length)];
    const lines = (q.after ? q.after.slice() : ['おお、また会えたな。ここはもうお前の拠点だ。'])
      .concat(['「' + tip + '」']);
    const npcFace = q.npc;
    const q2 = DATA.QUESTS2[baseId];
    const done2 = SaveSys.data.quests2 && SaveSys.data.quests2[baseId];
    openRunDialog(q.npcName, lines, () => {
      if (!q2 || done2) return;
      // 追加依頼の提案
      overlay = 'dialog';
      el('dialog-name').textContent = q.npcName;
      el('dialog-text').textContent = q2.offer;
      el('dialog-choices').innerHTML = `
        <button class="dlg-choice" id="dlg-q2yes">依頼を受ける</button>
        <button class="dlg-choice sub" id="dlg-q2no">やめておく</button>`;
      show('dialog-box');
      el('dlg-q2yes').onclick = () => {
        el('dialog-choices').innerHTML = '';
        hide('dialog-box'); overlay = null;
        enterQuest('base2', baseId);
      };
      el('dlg-q2no').onclick = () => {
        el('dialog-choices').innerHTML = '';
        hide('dialog-box'); overlay = null;
      };
    }, npcFace);
  }

  // クエスト転移(周回は一時停止したまま保持される)
  function enterQuest(kind, id){
    if (state !== 'run') return;
    if (kind === 'base' && SaveSys.data.bases[id]) return;   // 解放済みは再入場不可
    if (kind === 'port' && SaveSys.data.ports[id]) return;
    if (!Quest.start(kind, id)) return;
    state = 'quest';
    hide('hud');
    el('interact-hint').classList.add('hidden');
    el('btn-act').classList.remove('hidden');   // 会話送りに使う
    Sfx.setScene('hub');
  }
  function exitQuest(success){
    document.getElementById('dialog-box').classList.add('hidden');
    document.getElementById('quest-obj').classList.add('hidden');
    document.getElementById('quest-exit').classList.add('hidden');
    state = 'run';
    show('hud');
    const R = Run.state;
    if (success) {
      const q = Quest.state;
      if (q.kind === 'base2') {
        // 追加依頼クリア: 報酬を獲得(限定スキルはquests2フラグで解放される)
        SaveSys.data.quests2 = SaveSys.data.quests2 || {};
        SaveSys.data.quests2[q.id] = true;
        const rw = q.def.reward || {};
        let txt = [];
        if (rw.coins) { R.coins += rw.coins; txt.push('🪙' + rw.coins); }
        for (const mm in rw.mats || {}) { Skills.addMat(mm, rw.mats[mm]); txt.push(DATA.MATERIALS[mm].name + '×' + rw.mats[mm]); }
        R.warnMsg = '🎁 依頼達成! 報酬: ' + txt.join('・');
        R.warnColor = '#ffd766'; R.warnT = 5;
        SaveSys.save();
        Sfx.unlock();
        Sfx.setScene('run');
        return;
      }
      if (q.kind === 'base') {
        SaveSys.data.bases[q.id] = true;
        const b = DATA.BASES.find(b => b.id === q.id);
        R.warnMsg = '✦ 基地「' + (b ? b.name : '') + '」を解放した!魂の広場にゲートが開いた';
      } else {
        SaveSys.data.ports[q.id] = true;
        const p = DATA.PORTS.find(p => p.id === q.id);
        R.warnMsg = '⚓ ' + (p ? p.name : '') + 'の船が直った!出航できるぞ';
      }
      R.warnColor = null; R.warnT = 5;
      SaveSys.save();
      SaveSys.checkAchievements();
      Sfx.unlock();
    }
    Sfx.setScene('run');
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
    if (Input.once('Tab') && state !== 'quest') toggleSkillPanel();
    if (Input.once('KeyN') && state === 'run') Run.toggleMap();
    if (Input.once('KeyM')) {
      const m = Sfx.toggleMute();
      if (state === 'run') { Run.state.warnMsg = m ? '🔇 ミュート' : '🔊 サウンドON'; Run.state.warnT = 1.2; }
    }
    if (Input.once('KeyE') || Input.once('Space')) {
      if (overlay === 'dialog') advanceRunDialog();
      else if (state === 'quest') Quest.doInteract();
      else if (!overlay) {
        if (state === 'run') Run.doInteract();
        else if (state === 'hub') Hub.doInteract();
      }
    }
    if (Input.once('KeyP') || Input.once('Escape')) {
      if (overlay === 'dialog') { advanceRunDialog(); return; }
      if (state === 'quest') { exitQuest(false); return; }
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
      Sfx.setScene(R.time >= DATA.REAPER_AT ? 'reaper' : (R.bossAlive && !R.bossAlive.dead) ? 'boss' : 'run');
      if (R.over && overlay !== 'result') endRun(false);
    } else if (state === 'quest') {
      Quest.update(dt);
      Quest.draw(g, W, H);
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

  // ミニマップをタップ/クリックで周辺図⇔全体図
  canvas.addEventListener('pointerdown', e => {
    if (state !== 'run' || overlay) return;
    const sz = Math.min(World.MM_SIZE, Math.floor(canvas.width * 0.34));
    if (e.clientX > canvas.width - sz - 10 && e.clientY < sz + 24) Run.toggleMap();
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
    if (state === 'quest') { Quest.doInteract(); return; }
    if (!overlay) {
      if (state === 'run') Run.doInteract();
      else if (state === 'hub') Hub.doInteract();
    }
  };
  el('dialog-box').addEventListener('pointerdown', e => {
    if (e.target.classList.contains('dlg-choice')) return;   // 選択肢は自身のonclick
    if (overlay === 'dialog') advanceRunDialog();
    else if (state === 'quest') Quest.doInteract();
  });
  el('quest-exit').onclick = () => { if (state === 'quest') exitQuest(false); };

  // ---------------- 起動 ----------------
  SaveSys.load();
  World.initExplored(SaveSys.data.explored);
  Input.setPadMode(SaveSys.data.settings.pad);
  Sprites.loadOverrides();
  toTitle();
  refreshPadButtons();
  setTimeout(() => World.worldImage(), 60);   // 全世界ミニマップを裏で生成
  requestAnimationFrame(loop);

  return { startRun, pauseFor, closeStation, toHub, enterQuest, exitQuest, npcTalk, get state(){ return state; } };
})();
