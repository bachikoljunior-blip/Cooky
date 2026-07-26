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
    show('title-screen'); hide('hud'); hide('btn-skill'); hide('btn-sig'); hide('btn-pause');
    document.body.classList.add('in-title');
    refreshTitleRecord();
    Sfx.setScene('title');
  }
  function toHub(){
    state = 'hub'; overlay = null;
    document.body.classList.remove('in-title');
    hide('title-screen'); hide('hud'); hide('result-panel'); hide('station-panel'); hide('btn-sig');
    show('btn-skill');   // 街でもスキル画面は開ける
    show('btn-pause');   // 街でも一時停止(あそびかた・タイトルへ戻る)を開ける
    hide('quest-obj'); hide('interact-hint'); hide('help-panel');   // 周回の帯・開きっぱなしのヘルプを持ち込まない
    Hub.enter();
    Sfx.setScene('hub');
  }
  function startRun(pos){
    // プロローグ: 最初の周回で、地図に印の付いた基地を目指すよう導く
    if (!SaveSys.data.introSeen && Object.keys(SaveSys.data.bases).length === 0) {
      SaveSys.data.introSeen = true; SaveSys.save();
      setTimeout(() => dialog('', null, [
        '…気がつくと、見知らぬ草原に立っていた。名前も、来た道も思い出せない。',
        'ポケットには古びた地図の切れ端。「北の砦」とだけ記され、印が打たれている。(🗺 地図に「?」)',
        '切れ端の裏に、自分のものではない字。――「君も還る側なら、果ての城で待っている」',
        '(還る、とは。誰が、誰を待っている?)',
      ], () => dialogChoice('', null, '…どうする?', [
        { label:'書いた者を探す', cb(){ dialog('', null, ['(この字の主に会う。それだけが、いまの手がかりだ)'], null); } },
        { label:'まず北の砦へ', cb(){ dialog('', null, ['(印の打たれた場所へ。答えは、人のいるところにある)'], null); } },
        { label:'帰り道を探す', cb(){ dialog('', null, ['(振り返っても、来た道の記憶がない。……進むしかない)'], null); } },
      ])), 400);
    }
    state = 'run'; overlay = null;
    document.body.classList.remove('in-title');
    hide('title-screen'); hide('station-panel'); hide('skill-panel'); hide('pause-panel'); hide('help-panel');
    show('hud'); show('btn-skill'); show('btn-sig'); show('btn-pause');   // スキル/号令/⏸は周回中のみ
    el('interact-hint').classList.add('hidden');
    Run.start(pos);
    Sfx.setScene('run');
  }
  // 周回中に基地へ着いた: 拠点マップへ転移(周回は裏で保持)
  function enterBaseFromRun(baseId){
    state = 'hub'; overlay = null;
    hide('hud'); hide('station-panel'); hide('skill-panel'); hide('pause-panel'); hide('btn-sig'); hide('btn-pause');
    show('btn-skill');   // 立ち寄った街でもスキル画面は開ける
    hide('quest-obj');
    el('interact-hint').classList.add('hidden');
    Hub.enterFromRun(baseId);
    Sfx.setScene('hub');
  }
  // 周回中に港へ着いた: 港町マップへ転移(周回は裏で保持)
  function enterPortFromRun(portId){
    state = 'hub'; overlay = null;
    hide('hud'); hide('station-panel'); hide('skill-panel'); hide('pause-panel'); hide('btn-sig'); hide('btn-pause');
    show('btn-skill');   // 立ち寄った街でもスキル画面は開ける
    hide('quest-obj');
    el('interact-hint').classList.add('hidden');
    Hub.enterFromRun('port:' + portId);
    Sfx.setScene('hub');
  }
  // 拠点マップのゲートから周回へ復帰(Run.startは呼ばず状態を維持)
  function resumeRun(){
    state = 'run'; overlay = null;
    hide('station-panel'); hide('skill-panel'); hide('pause-panel');
    show('hud'); show('btn-skill'); show('btn-sig'); show('btn-pause');
    el('interact-hint').classList.add('hidden');
    Run.state.noInteractT = 1.0;   // 復帰直後に再び転移しないよう猶予
    Sfx.setScene('run');
  }

  // ---------------- 周回中のNPC会話 ----------------
  // 進め方の案内は端末に合わせる。鍵盤しかない画面に「タップ」とだけ出しても伝わらない
  function advanceHint(){ return (Input.padOn() ? 'タップ / E' : 'E キー') + ' で進む ▼'; }
  let runDlg = null;
  function openRunDialog(name, lines, onDone, face){
    overlay = 'dialog';
    el('interact-hint').classList.add('hidden');   // 会話中は「E:〜」のピルを重ねない
    el('dialog-hint').textContent = advanceHint();
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
    el('interact-hint').classList.add('hidden');
    // 選択肢中の実態に合わせる。やめ方は端末ごとに押すものが違う
    el('dialog-hint').textContent = '選んでください(' + (Input.padOn() ? '「実行」' : 'E キー') + 'で やめておく)';
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
    if (Quest.activeFor('base2', baseId)) { Quest.atNpc('base2', baseId); return; }
    // 施設解放クエストが残っているなら、雑談を挟まず真っ先にその話をする
    {
      const q2p = DATA.QUESTS2[baseId];
      const done2p = SaveSys.data.quests2 && SaveSys.data.quests2[baseId];
      if (q2p && !done2p) {
        dialogChoice(q.npcName, q.npc, q2p.offer, [
          { label:'話を聞く', cb(){ Quest.offer('base2', baseId); } },
          { label:'また今度', sub:true },
        ]);
        return;
      }
    }
    const tip = DATA.NPC_TIPS[Math.floor(Math.random() * DATA.NPC_TIPS.length)];
    const lines = [];
    // エピローグ: 果ての城の物語を見届けた後は、世界の語りが変わる
    if ((SaveSys.data.story || {}).end_throne && DATA.EPILOGUE && DATA.EPILOGUE[baseId]) lines.push(DATA.EPILOGUE[baseId]);
    // 死に戻りの回数に、世界がちゃんと反応する。
    // 誰の台詞にもなる行なので、話者の口調と混ざらないよう地の文で語る
    const deaths = SaveSys.data.stats.deaths || 0;
    if (deaths >= 30) lines.push('(' + deaths + '回の死に戻り。それでも立ち上がる魂を、この土地の誰もが敬い始めている)');
    else if (deaths >= 15) lines.push('(何度でも帰ってくるお前を、この村はもう当たり前のように迎えてくれる)');
    else if (deaths >= 5) lines.push('(「本当に、戻ってくるのだな」― 死に戻りを見るその目から、驚きが消え始めている)');
    // 物語が進むと第一声が変わる人がいる(afterIf: フラグ → 台詞)
    let said = null;
    for (const flag in q.afterIf || {})
      if ((SaveSys.data.story || {})[flag]) { said = q.afterIf[flag]; break; }
    lines.push(...(said ? [].concat(said)
      : q.after ? q.after.slice() : ['(もうすっかり顔なじみだ。今日も変わらぬ様子で迎えてくれた)']));
    // 豆知識は話者の口調と混ざらないよう、地の文(見聞きした噂)として添える
    lines.push('(別れ際、こんな噂話も聞かせてくれた ―「' + tip + '」)');
    const q2 = DATA.QUESTS2[baseId];
    const done2 = SaveSys.data.quests2 && SaveSys.data.quests2[baseId];
    dialog(q.npcName, q.npc, lines, () => {
      if (!q2 || done2 || Quest.activeFor('base2', baseId)) return;
      dialogChoice(q.npcName, q.npc, q2.offer, [
        { label:'話を聞く', cb(){ Quest.offer('base2', baseId); } },
        { label:'また今度', sub:true },
      ]);
    });
  }

  function pauseFor(kind){
    overlay = kind;
    // 画面を開いている間、街の歩き回りは止まる。足元の[E]の案内はその時のまま
    // 残ってしまうので、ここで消しておく(閉じれば次の巡回で出し直される)
    hide('interact-hint'); hide('btn-act');
    if (kind === 'station') show('station-panel');
  }
  function closeStation(){
    hide('station-panel');
    overlay = null;
  }

  // スキル画面は周回中だけでなく街(基地・港・魂の広場)でも開ける ―
  // 周回中に立ち寄った街でも、素材の確認やその場での取得ができる
  function toggleSkillPanel(){
    if (state !== 'run' && state !== 'hub') return;
    if (overlay === 'skill') { Skills.close(); overlay = null; }
    else if (!overlay) { Skills.open(); overlay = 'skill'; hide('interact-hint'); hide('btn-act'); }
  }
  // 街(魂の広場・基地・港)でも開ける ― 「あそびかた」がタイトルにしかないと、
  // 一度旅に出た後は操作の一覧を二度と読めない行き止まりになるため
  function togglePause(){
    if (state !== 'run' && state !== 'hub') return;
    if (overlay === 'pause') { hide('pause-panel'); hide('help-panel'); overlay = null; return; }
    if (overlay) return;
    const inRun = state === 'run';
    if (inRun) {
      const R = Run.state;
      el('pause-info').textContent =
        '経過 ' + fmtTime(R.time) + ' / 撃破 ' + R.kills + ' / 🪙 ' + fmtNum(R.coins) +
        ' / 仲間 ' + R.allies.length + '。リタイアすると獲得コインと余り素材の換金分を持ち帰る。';
    } else {
      el('pause-info').textContent = '街にいる間は時も敵も動かない。貯えは自動で残る。';
    }
    el('pause-retire').classList.toggle('hidden', !inRun);   // 街では帰る先がない
    el('pause-title').classList.toggle('hidden', inRun);     // 旅の途中では抜けさせない
    show('pause-panel'); overlay = 'pause'; hide('interact-hint'); hide('btn-act');
  }

  function showResult(res){
    overlay = 'result';
    el('result-title').textContent = res.retired ? '帰還した' :
      (res.time >= DATA.REAPER_AT ? '終焉に呑まれた…' : '力尽きた…');
    el('result-body').innerHTML = `
      ${res.recap ? `<div class="r-line" style="color:#f85149">死因: <b>${res.recap.killer}</b>
        <span class="small">(直前10秒: ${res.recap.list.map(l => l[0] + ' ' + l[1]).join(' / ')})</span></div>` : ''}
      <div class="r-line">生存時間: <b>${fmtTime(res.time)}</b></div>
      <div class="r-line">到達距離: <b>${fmtNum(res.dist)}</b></div>
      <div class="r-line">撃破数: <b>${fmtNum(res.kills)}</b> / 仲間にした数: <b>${res.recruits}</b></div>
      <div class="r-line">獲得コイン: <b>${fmtNum(res.coins)}</b></div>
      <div class="r-line">余り素材の換金: <b>+${fmtNum(res.matBonus)}</b></div>
      <div class="r-line r-big">持ち帰り合計: 🪙 ${fmtNum(res.total)}</div>
      <div class="r-line small">貯えたコイン: 🪙 ${fmtNum(SaveSys.data.coins)}</div>
      ${(res.newAchs || []).map(a => `<div class="r-line" style="color:#ffd766">🏆 実績解除「${a.name}」! ― ${a.reward}</div>`).join('')}`;
    show('result-panel');
  }

  function endRun(retired){
    const res = Run.finishRun(retired);
    hide('pause-panel'); hide('skill-panel'); hide('station-panel'); hide('hud'); hide('btn-skill'); hide('btn-sig'); hide('btn-pause');
    hide('quest-obj'); hide('interact-hint');
    showResult(res);
  }

  // ---------------- 入力(フレーム毎) ----------------
  function handleKeys(){
    // 画面を開いている間の Space は捨てる。溜めたままにすると、
    // 画面を閉じた瞬間に覚えのない号令が飛ぶ
    if (overlay) Input.takeSig();
    if (Input.once('Tab')) toggleSkillPanel();
    if (Input.once('KeyN') && state === 'run') Run.toggleMap();
    if (Input.once('KeyM')) {
      const m = Sfx.toggleMute();
      SaveSys.data.settings.mute = m; SaveSys.save();   // 再開後もミュート設定を保持
      if (state === 'run') {
        Run.state.warnMsg = m ? '🔇 ミュート' : '🔊 サウンドON';
        Run.state.warnColor = '#a5d8ff';   // 情報色(危険スタイルの誤発火・前の色の残留を防ぐ)
        Run.state.warnT = 1.2;
      }
    }
    // Space は「突撃の号令」専用(会話中だけは読み進めに使う)。
    // 調べる・話すは E だけ ― 両方に割り当てると、桟橋や人の前で押した一回が
    // 号令と調べるを同時に起こしてしまう
    if (Input.once('Space') && overlay === 'dialog') { advanceRunDialog(); return; }
    if (Input.once('KeyE')) {
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
        : Sfx.biomeScene(R.curBiome || 'grass'));   // ボスでBGMは変えない(終焉の刻のみ)
      if (R.over && overlay !== 'result') endRun(false);
    } else if (state === 'hub') {
      if (!overlay) Hub.update(dt);
      Hub.draw(g, W, H);
    } else {
      // タイトル背景: この世界そのものを見せる ―
      // 魂の広場を実際の街の絵で描き、ゲートの前をゆっくり見渡す
      titleT += dt;
      const bnd = { x0:-800, y0:-360, x1:800, y1:400 };
      const plan = Town.plan('main', bnd);
      // 縦横どちらの画面でも、広場が画面いっぱいに入る倍率を選ぶ
      const Z = Math.min(1.25, Math.max(W / 1560, H / 780));
      const VW = W / Z, VH = H / Z;
      // 祭壇の壇からゲートへ、ゆっくり視線が流れる(広場の外は映さない)
      const look = { x: Math.sin(titleT * 0.05) * 90, y: -20 + Math.cos(titleT * 0.04) * 50 };
      const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
      const camX = clamp(look.x - VW / 2, bnd.x0, bnd.x1 - VW);
      const camY = clamp(look.y - VH / 2, bnd.y0, bnd.y1 - VH);
      g.save();
      g.scale(Z, Z);
      Town.drawGround(g, plan, camX, camY, VW, VH, titleT);
      g.save();
      g.translate(-camX, -camY);
      const draws = Town.items(plan, titleT).slice();
      // 広場に立つ人影(死に戻りと、迎える住人たち)
      // 人影は釦の列(画面中央)と、泉・建物の上を避けて道の上に置く
      const cast = [['player', -380, 300], ['npc_miko', -360, 40], ['npc_smith', -470, -40],
                    ['npc_elder', 330, 120], ['npc_girl', 470, 230]];
      for (const [spr, x, y] of cast) {
        draws.push({ sy: y, draw:(g2) => {
          g2.fillStyle = 'rgba(0,0,0,.35)';
          g2.beginPath(); g2.ellipse(x, y + 14, 15, 6, 0, 0, 7); g2.fill();
          Sprites.draw(g2, spr, x, y - Town.elevAt(plan, x, y), spr === 'player' ? 52 : 84,
                       spr === 'npc_elder' || spr === 'npc_smith');
        } });
      }
      // 転送ゲート ― この物語の中心。灯りをまとって立つ
      draws.push({ sy: 300, draw:(g2) => {
        const gl = g2.createRadialGradient(0, 290, 6, 0, 290, 92);
        gl.addColorStop(0, 'rgba(118,227,234,.30)'); gl.addColorStop(1, 'rgba(118,227,234,0)');
        g2.fillStyle = gl; g2.beginPath(); g2.arc(0, 330, 92, 0, 7); g2.fill();
        Sprites.draw(g2, 'st_gate', 0, 300, 110);
      } });
      draws.sort((a2, b2) => a2.sy - b2.sy);
      for (const d of draws) d.draw(g);
      Town.drawAir(g, plan, titleT);
      g.restore();
      g.restore();
      // 立ちのぼる魂の粒(この世界の空気)
      for (let i = 0; i < 34; i++) {
        const sp = 10 + (i * 37) % 26;
        const px = ((i * 227) % 100) / 100 * W + Math.sin(titleT * 0.5 + i) * 26;
        const py = H - (((titleT * sp + i * 173) % (H + 80)) - 40);
        g.fillStyle = `hsla(${[186, 200, 45][i % 3]}, 85%, 70%, ${0.16 + (i % 3) * 0.1})`;
        g.beginPath(); g.arc(px, py, 1.5 + (i % 3), 0, 7); g.fill();
      }
      // 文字が読めるように、上下を落とす(絵は真ん中に残す)
      const scrim = g.createLinearGradient(0, 0, 0, H);
      scrim.addColorStop(0, 'rgba(6,9,17,.80)');
      scrim.addColorStop(0.40, 'rgba(6,9,17,.26)');
      scrim.addColorStop(0.72, 'rgba(6,9,17,.40)');
      scrim.addColorStop(1, 'rgba(6,9,17,.88)');
      g.fillStyle = scrim; g.fillRect(0, 0, W, H);
    }
  }

  // タイトルに「これまでの旅」を一行。死んで戻るゲームなので、回数そのものが物語になる
  function refreshTitleRecord(){
    const e = el('title-record');
    const st = SaveSys.data.stats || {};
    if (!st.runs) { e.classList.add('hidden'); return; }
    const lit = Object.keys(SaveSys.data.bases || {}).length;
    e.textContent = '周回 ' + st.runs + ' ・ 灯したゲート ' + lit
      + ' ・ 最長 ' + fmtTime(st.bestTime || 0);
    e.classList.remove('hidden');
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
    const st = SaveSys.data.stats || {};
    if (!confirm('全データを消しますか?\n\n周回 ' + (st.runs || 0) + ' ・ 灯したゲート '
        + Object.keys(SaveSys.data.bases || {}).length + ' ・ パワーアップと武器\nすべて最初からになります。')) return;
    if (!confirm('本当に消しますか?この操作は元に戻せません。')) return;
    SaveSys.wipe();
    refreshTitleRecord();
    alert('初期化しました');
  };
  el('skill-close').onclick = () => toggleSkillPanel();
  el('station-close').onclick = () => {
    closeStation();
  };
  el('result-ok').onclick = () => { hide('result-panel'); toHub(); };
  el('pause-resume').onclick = () => togglePause();
  el('pause-help').onclick = () => { show('help-panel'); };
  el('pause-title').onclick = () => { hide('pause-panel'); hide('help-panel'); toTitle(); };
  el('pause-retire').onclick = () => { endRun(true); };
  el('btn-skill').onclick = () => toggleSkillPanel();
  el('btn-pause').onclick = () => togglePause();   // タッチ端末でも一時停止・リタイアできる
  el('btn-sig').onclick = () => { if (state === 'run') Run.warcry(); };
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
  Sfx.setMuted(SaveSys.data.settings.mute);   // ミュート設定を復元
  Sprites.loadOverrides();
  // ページを閉じる/リロードする時: 周回中なら帰還扱いで精算して保存
  // (再開後に「その周回で得たもの・晴らした霧」が巻き戻らない)
  const settleOnLeave = () => {
    try {
      const R = Run.state;
      const inRun = R && R.player && !R.settled &&
        (state === 'run' || (state === 'hub' && Hub.state.fromRun));
      if (inRun) Run.finishRun(true);
      else SaveSys.data.explored = World.exploredArray();
      SaveSys.save();
    } catch(e) {}
  };
  window.addEventListener('pagehide', settleOnLeave);
  window.addEventListener('beforeunload', settleOnLeave);
  toTitle();
  refreshPadButtons();
  setTimeout(() => World.worldImage(), 60);   // 全世界ミニマップを裏で生成
  requestAnimationFrame(loop);

  return { startRun, enterBaseFromRun, enterPortFromRun, resumeRun, pauseFor, closeStation, toHub, npcTalk, dialog, dialogChoice,
           advanceDialog: advanceRunDialog, get state(){ return state; } };
})();
