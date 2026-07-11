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
  let lastT = 0;

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
  }
  function toHub(){
    state = 'hub'; overlay = null;
    hide('title-screen'); hide('hud'); hide('result-panel'); hide('station-panel');
    Hub.enter();
  }
  function startRun(pos){
    state = 'run'; overlay = null;
    hide('title-screen'); hide('station-panel'); hide('skill-panel'); hide('pause-panel');
    show('hud');
    el('interact-hint').classList.add('hidden');
    Run.start(pos);
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
      <div class="r-line small">銀行残高: 🪙 ${fmtNum(SaveSys.data.coins)}</div>`;
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
    if (Input.once('KeyM')) {
      const m = Sfx.toggleMute();
      if (state === 'run') { Run.state.warnMsg = m ? '🔇 ミュート' : '🔊 サウンドON'; Run.state.warnT = 1.2; }
    }
    if (Input.once('KeyE') || Input.once('Space')) {
      if (!overlay) {
        if (state === 'run') Run.doInteract();
        else if (state === 'hub') Hub.doInteract();
      }
    }
    if (Input.once('KeyP') || Input.once('Escape')) {
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
      if (R.over && overlay !== 'result') endRun(false);
    } else if (state === 'hub') {
      if (!overlay) Hub.update(dt);
      Hub.draw(g, W, H);
    } else {
      // タイトル背景
      g.fillStyle = '#0b0f1a';
      g.fillRect(0, 0, W, H);
    }
  }

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
    if (!overlay) {
      if (state === 'run') Run.doInteract();
      else if (state === 'hub') Hub.doInteract();
    }
  };

  // ---------------- 起動 ----------------
  SaveSys.load();
  Sprites.loadOverrides();
  toTitle();
  requestAnimationFrame(loop);

  return { startRun, pauseFor, closeStation, toHub, get state(){ return state; } };
})();
