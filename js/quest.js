// =============================================================
// quest.js - マップ内クエスト管理
//   NPCと会話(時間停止) → 依頼を受ける → 本編マップで達成
//   (討伐 / 基地の防衛 / 素材納品) → NPCに報告して解放。
//   専用アリーナへの転移はしない。
// =============================================================
'use strict';

const Quest = (() => {
  let active = null;   // { kind:'base'|'base2', id, def, loc, phase:'go'|'return', killed, timer }

  function reset(){ active = null; }
  function activeFor(kind, id){ return active && active.kind === kind && active.id === id; }

  function locOf(kind, id){
    return kind === 'port' ? World.ports.find(p => p.id === id)
                           : DATA.BASES.find(b => b.id === id);
  }
  function defOf(kind, id){
    return kind === 'base2' ? DATA.QUESTS2[id] : DATA.QUESTS[id];
  }
  function faceOf(kind, id, def){
    return def.npc || (DATA.QUESTS[id] && DATA.QUESTS[id].npc) || 'npc_elder';
  }

  function objSummary(def){
    if (def.type === 'hunt') return DATA.ENEMIES[def.enemy].name + 'を' + def.count + '体討伐する';
    if (def.type === 'survive') return 'この場所の近くで' + def.time + '秒間守り抜く';
    if (def.type === 'delivery') return '素材とコインを届ける';
    return '依頼をこなす';
  }
  function objText(){
    if (!active) return '';
    const d = active.def;
    if (active.phase === 'return') return '📜 ' + d.npcName + 'に報告しよう';
    if (d.type === 'hunt') return '📜 討伐: ' + active.killed + ' / ' + d.count + '(' + DATA.ENEMIES[d.enemy].name + ')';
    if (d.type === 'survive') {
      const near = active.near ? '' : '(場所に近づけ!)';
      return '📜 防衛: あと ' + Math.ceil(active.timer) + '秒 ' + near;
    }
    return '📜 ' + objSummary(d);
  }

  // ---------------- NPCに話しかけた ----------------
  function offer(kind, id){
    const def = defOf(kind, id);
    if (!def) return;
    const face = faceOf(kind, id, def);
    // 進行中の依頼がある
    if (active) {
      if (activeFor(kind, id)) { atNpc(); return; }
      Game.dialog(def.npcName, face, ['別の依頼を抱えているようだな。', 'まずはそちらを片付けてきてくれ。'], null);
      return;
    }
    // 新規: イントロ → 納品 or 受諾
    Game.dialog(def.npcName, face, def.intro.slice(), () => {
      if (def.type === 'delivery') deliveryChoice(kind, id, def);
      else {
        Game.dialogChoice(def.npcName, face, '『' + objSummary(def) + '』― 引き受けるか?', [
          { label:'依頼を受ける', cb(){ startActive(kind, id, def); } },
          { label:'やめておく', sub:true },
        ]);
      }
    });
  }

  function startActive(kind, id, def){
    active = { kind, id, def, loc: locOf(kind === 'port' ? 'port' : 'base', id),
               phase:'go', killed:0, timer: def.time || 0, near:false };
    const R = Run.state;
    R.warnMsg = '📜 依頼開始: ' + objSummary(def);
    R.warnColor = '#ffd766'; R.warnT = 4;
  }

  // 納品: 選択肢
  function deliveryChoice(kind, id, def){
    const need = def.need;
    const R = Run.state;
    const wallet = SaveSys.data.coins + R.coins;
    let ok = wallet >= (need.coins || 0);
    let listTxt = '🪙' + fmtNum(need.coins || 0);
    for (const m in need.mats || {}) {
      const have = Skills.matCount(m);
      if (have < need.mats[m]) ok = false;
      listTxt += ' / ' + DATA.MATERIALS[m].name + ' ' + have + '/' + need.mats[m];
    }
    Game.dialogChoice(def.npcName, faceOf(kind, id, def), '必要なもの: ' + listTxt, [
      { label:'渡す', disabled: !ok, cb(){
          let amount = need.coins || 0;
          const fromRun = Math.min(R.coins, amount);
          R.coins -= fromRun;
          SaveSys.data.coins -= (amount - fromRun);
          for (const m in need.mats || {}) Skills.mats()[m] -= need.mats[m];
          SaveSys.save();
          complete(kind, id, def);
        } },
      { label:'また今度', sub:true },
    ]);
  }

  // 進行中にNPCへ(報告 or 途中経過)
  function atNpc(){
    if (!active) return;
    const d = active.def;
    const face = faceOf(active.kind, active.id, d);
    if (active.phase === 'return') {
      const kind = active.kind, id = active.id;
      active = null;
      complete(kind, id, d);
    } else {
      const hint = d.type === 'hunt'
        ? 'まだ敵が残っているぞ。あと' + (d.count - active.killed) + '体だ。'
        : '今は持ちこたえてくれ!';
      Game.dialog(d.npcName, face, [hint], null);
    }
  }

  // ---------------- 完了処理 ----------------
  function complete(kind, id, def){
    const face = faceOf(kind, id, def);
    Game.dialog(def.npcName, face, def.done.slice(), () => finalize(kind, id, def));
  }

  function finalize(kind, id, def){
    const R = Run.state;
    active = null;
    if (kind === 'port') {
      SaveSys.data.ports[id] = true;
      const p = DATA.PORTS.find(p => p.id === id);
      R.warnMsg = '⚓ ' + (p ? p.name : '') + 'の船が直った!出航できるぞ';
    } else if (kind === 'base2') {
      // 2段階目: 報酬
      SaveSys.data.quests2 = SaveSys.data.quests2 || {};
      SaveSys.data.quests2[id] = true;
      const rw = def.reward || {};
      const txt = [];
      if (rw.coins) { R.coins += rw.coins; txt.push('🪙' + rw.coins); }
      for (const mm in rw.mats || {}) { Skills.addMat(mm, rw.mats[mm]); txt.push(DATA.MATERIALS[mm].name + '×' + rw.mats[mm]); }
      R.warnMsg = '🎁 依頼達成! 報酬: ' + txt.join('・');
    } else {
      SaveSys.data.bases[id] = true;
      const b = DATA.BASES.find(b => b.id === id);
      R.warnMsg = '✦ 基地「' + (b ? b.name : '') + '」を解放した!魂の広場にゲートが開いた';
      onBaseUnlocked(id, def);
    }
    R.warnColor = '#ffd766'; R.warnT = 5;
    R.noInteractT = 1.2;   // 直後の誤タップ防止
    SaveSys.save();
    SaveSys.checkAchievements();
    Sfx.unlock();
  }

  // 最寄りの未解放の主大陸の基地
  function nextLockedBase(fx, fy){
    let best = null, bd = 1e18;
    for (const b of DATA.BASES) {
      if (b.cont !== 'main' || SaveSys.data.bases[b.id]) continue;
      const d = Math.hypot(b.x - fx, b.y - fy);
      if (d < bd) { best = b; bd = d; }
    }
    return best;
  }

  // 基地解放時のストーリー進行: マップに記すヒントは「最初の一つ」だけ
  function onBaseUnlocked(id, def){
    const n = Object.keys(SaveSys.data.bases).length;
    const face = def.npc || 'npc_elder';
    SaveSys.data.seen = SaveSys.data.seen || {};
    // ヒント先の基地を解放したらヒントを消す(以降は新しいヒントを出さない)
    if (SaveSys.data.nextHint === id) SaveSys.data.nextHint = null;

    if (n === 1) {
      // 最初の基地: マップの使い方 + 次の拠点を一つだけ記す(これが唯一のヒント)
      const b0 = DATA.BASES.find(b => b.id === id);
      const best = nextLockedBase(b0 ? b0.x : 0, b0 ? b0.y : 0);
      if (best) { SaveSys.data.nextHint = best.id; SaveSys.data.seen[best.id] = true; }
      Game.dialog(def.npcName, face, [
        'これを持っていけ。この辺り一帯の古い地図じゃ。',
        '…擦り切れておるが、次の拠点の場所だけは読み取れる。',
        'マップに印がついた。あとは自分の足で探すことじゃ。',
        '(🗺 マップは魂の広場の「スキル書庫」で作成できる。次の拠点が一つ記された)',
      ], null);
    } else {
      Game.dialog(def.npcName, face, [
        'よくぞここまで来た。この拠点はもうお前のものだ。',
        '他にも拠点や港が眠っておる。自分の目で見つけるといい。',
      ], null);
    }
  }

  // ---------------- 周回からのフック ----------------
  function notifyKill(defKey){
    if (!active || active.phase !== 'go' || active.def.type !== 'hunt') return;
    if (defKey !== active.def.enemy) return;
    active.killed++;
    if (active.killed >= active.def.count) {
      active.phase = 'return';
      const R = Run.state;
      R.warnMsg = '📜 討伐完了!' + active.def.npcName + 'に報告しよう';
      R.warnColor = '#ffd766'; R.warnT = 4;
      Sfx.skill();
    }
  }

  function tick(dt){
    if (!active || active.phase !== 'go' || active.def.type !== 'survive') return;
    const R = Run.state;
    active.near = Math.hypot(R.player.x - active.loc.x, R.player.y - active.loc.y) < 800;
    if (active.near) {
      active.timer -= dt;
      if (active.timer <= 0) {
        active.phase = 'return';
        R.warnMsg = '📜 守り抜いた!' + active.def.npcName + 'に報告しよう';
        R.warnColor = '#ffd766'; R.warnT = 4;
        Sfx.skill();
      }
    }
  }

  // 討伐依頼中は対象の敵が近くに湧きやすくなる
  function wantSpawn(){
    if (!active || active.phase !== 'go' || active.def.type !== 'hunt') return null;
    return active.def.enemy;
  }

  function _forceReturn(){ if (active) active.phase = 'return'; }   // テスト用

  return { reset, offer, atNpc, notifyKill, tick, wantSpawn, objText, activeFor, _forceReturn,
           get active(){ return active; } };
})();
