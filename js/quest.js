// =============================================================
// quest.js - マップ内クエスト管理
//   NPCと会話(時間停止) → 依頼を受ける → 本編マップで達成
//   (討伐 / 基地の防衛 / 素材納品) → NPCに報告して解放。
//   専用アリーナへの転移はしない。
// =============================================================
'use strict';

const Quest = (() => {
  // 複数のクエストを同時に抱えられる。進行状況はセーブに保存し、周回を跨いで保持する。
  let actives = [];   // [{ kind, id, def, loc, phase:'go'|'return', killed, timer, near }]

  function persist(){
    SaveSys.data.questsActive = actives.map(a => ({ kind:a.kind, id:a.id, phase:a.phase, killed:a.killed, timer:a.timer }));
    SaveSys.save();
  }
  function rebuild(s){
    const def = defOf(s.kind, s.id);
    if (!def) return null;
    return { kind:s.kind, id:s.id, def, loc: locOf(s.kind === 'port' ? 'port' : 'base', s.id),
             phase: s.phase || 'go', killed: s.killed || 0,
             timer: (s.timer != null ? s.timer : (def.time || 0)), near:false };
  }
  // 周回開始時: 進行中クエストをセーブから復元(達成度は周回を跨いで保持)
  function reset(){ actives = (SaveSys.data.questsActive || []).map(rebuild).filter(Boolean); }
  function activeFor(kind, id){ return actives.find(a => a.kind === kind && a.id === id) || null; }
  function hasActive(){ return actives.length > 0; }
  function removeActive(kind, id){ actives = actives.filter(a => !(a.kind === kind && a.id === id)); persist(); }

  // サイドクエスト索引: sqId -> { def, base }
  let sideIdx = null;
  function sideOf(id){
    if (!sideIdx) {
      sideIdx = {};
      for (const bid in DATA.SIDEQUESTS || {}) for (const sq of DATA.SIDEQUESTS[bid]) sideIdx[sq.id] = { def: sq, base: bid };
    }
    return sideIdx[id] || null;
  }
  function locOf(kind, id){
    if (kind === 'side') { const s = sideOf(id); return s ? DATA.BASES.find(b => b.id === s.base) : null; }
    return kind === 'port' ? World.ports.find(p => p.id === id)
                           : DATA.BASES.find(b => b.id === id);
  }
  function defOf(kind, id){
    if (kind === 'side') { const s = sideOf(id); return s ? s.def : null; }
    return kind === 'base2' ? DATA.QUESTS2[id] : DATA.QUESTS[id];
  }
  // visit型の目的地(座標指定 or 港指定)
  function visitLoc(def){
    if (!def.visit) return null;
    if (def.visit.port) { const p = World.ports.find(p => p.id === def.visit.port); return p ? { x:p.x, y:p.y } : null; }
    return { x:def.visit.x, y:def.visit.y };
  }
  function faceOf(kind, id, def){
    if (kind === 'side') return def.npc || 'npc_elder';
    return def.npc || (DATA.QUESTS[id] && DATA.QUESTS[id].npc) || 'npc_elder';
  }

  function objSummary(def){
    if (def.type === 'hunt') return DATA.ENEMIES[def.enemy].name + 'を' + def.count + '体討伐する';
    if (def.type === 'survive') return 'この場所の近くで' + def.time + '秒間守り抜く';
    if (def.type === 'delivery') return '素材とコインを届ける';
    if (def.type === 'visit') return '「' + (def.visit.label || '目的地') + '」を見てくる(マップに📍)';
    return '依頼をこなす';
  }
  function oneObjText(a){
    const d = a.def;
    if (a.phase === 'return') return '📜 ' + d.npcName + 'に報告';
    if (d.type === 'hunt') return '📜 討伐: ' + a.killed + ' / ' + d.count + '(' + DATA.ENEMIES[d.enemy].name + ')';
    if (d.type === 'survive') {
      const near = a.near ? '' : '(場所に近づけ!)';
      return '📜 防衛: あと ' + Math.ceil(a.timer) + '秒 ' + near;
    }
    if (d.type === 'visit') return '📜 目的地へ: ' + (d.visit.label || '') + '(マップの📍)';
    return '📜 ' + objSummary(d);
  }
  function objText(){ return actives.map(oneObjText).join('\n'); }

  // ---------------- NPCに話しかけた ----------------
  function offer(kind, id){
    const def = defOf(kind, id);
    if (!def) return;
    const face = faceOf(kind, id, def);
    if (kind === 'side') {
      if ((SaveSys.data.sideDone || {})[id]) {
        Game.dialog(def.npcName, face, [def.done[def.done.length - 1]], null);   // 後日談
        return;
      }
      // ストーリーが進むまで受けられない依頼
      if (def.requiresStory && !(SaveSys.data.story || {})[def.requiresStory]) {
        Game.dialog(def.npcName, face, [def.lockedLine || '…今は話せることがない。'], null);
        return;
      }
    }
    // このNPCの依頼が進行中なら報告/経過。他の依頼を抱えていても新規は受けられる(同時進行OK)
    if (activeFor(kind, id)) { atNpc(kind, id); return; }
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
    actives.push({ kind, id, def, loc: locOf(kind === 'port' ? 'port' : 'base', id),
                   phase:'go', killed:0, timer: def.time || 0, near:false });
    persist();
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

  // 進行中にNPCへ(報告 or 途中経過)。どのNPCの依頼かは kind/id で特定する
  function atNpc(kind, id){
    const a = activeFor(kind, id);
    if (!a) return;
    const d = a.def;
    const face = faceOf(kind, id, d);
    if (a.phase === 'return') {
      removeActive(kind, id);
      complete(kind, id, d);
    } else {
      const hint = d.type === 'hunt'
        ? 'まだ敵が残っているぞ。あと' + (d.count - a.killed) + '体だ。'
        : d.type === 'visit' ? 'マップの📍の場所じゃ。頼んだぞ。'
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
    removeActive(kind, id);
    if (kind === 'port') {
      SaveSys.data.ports[id] = true;
      const p = DATA.PORTS.find(p => p.id === id);
      R.warnMsg = '⚓ ' + (p ? p.name : '') + 'の船が直った!出航できるぞ';
    } else if (kind === 'side') {
      SaveSys.data.sideDone = SaveSys.data.sideDone || {};
      SaveSys.data.sideDone[id] = true;
      const rw = def.reward || {};
      const txt = [];
      if (rw.coins) { SaveSys.data.coins += rw.coins; txt.push('🪙' + rw.coins); }
      for (const mm in rw.mats || {}) { Skills.addMat(mm, rw.mats[mm]); txt.push(DATA.MATERIALS[mm].name + '×' + rw.mats[mm]); }
      if (rw.story) { SaveSys.data.story = SaveSys.data.story || {}; SaveSys.data.story[rw.story] = true; }
      SaveSys.data.seen = SaveSys.data.seen || {};
      if (rw.hintBase) { SaveSys.data.seen[rw.hintBase] = true; SaveSys.data.nextHint = rw.hintBase;
        const hb = DATA.BASES.find(b => b.id === rw.hintBase); txt.push('🗺「' + (hb ? hb.name : '') + '」の場所'); }
      if (rw.hintPort) { SaveSys.data.seen[rw.hintPort] = true;
        const hp = DATA.PORTS.find(p => p.id === rw.hintPort); txt.push('🗺「' + (hp ? hp.name : '') + '」の場所'); }
      R.warnMsg = '🎁 依頼達成! ' + (txt.length ? '報酬: ' + txt.join('・') : '');
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

  // 基地を一つでも解放したら、全ての基地の場所をマップにヒント表示する。
  function refreshHint(fx, fy){
    SaveSys.data.seen = SaveSys.data.seen || {};
    if (Object.keys(SaveSys.data.bases).length > 0) {
      SaveSys.data.allHints = true;
      // 全体図に収まるよう、主大陸の基地は既知(seen)にしておく
      for (const b of DATA.BASES) if (b.cont === 'main') SaveSys.data.seen[b.id] = true;
    }
    // 互換: 単一ヒント(nextHint)も未解放の最寄りへ維持
    const cur = SaveSys.data.nextHint;
    const valid = cur && !SaveSys.data.bases[cur] && DATA.BASES.some(b => b.id === cur);
    if (!valid) {
      const best = nextLockedBase(fx || 0, fy || 0);
      SaveSys.data.nextHint = best ? best.id : null;
      if (best) SaveSys.data.seen[best.id] = true;
    }
    SaveSys.save();
  }

  // 基地解放時のストーリー進行: 次の拠点ヒントを一つだけ更新する
  function onBaseUnlocked(id, def){
    const n = Object.keys(SaveSys.data.bases).length;
    const face = def.npc || 'npc_elder';
    SaveSys.data.seen = SaveSys.data.seen || {};
    // 解放した基地がヒント先なら、次の未解放の拠点へヒントを進める
    const b0 = DATA.BASES.find(b => b.id === id);
    if (SaveSys.data.nextHint === id) SaveSys.data.nextHint = null;
    refreshHint(b0 ? b0.x : 0, b0 ? b0.y : 0);

    if (n === 1) {
      // 最初の基地: マップの使い方 + 次の拠点を一つ記す
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
    let changed = false;
    for (const a of actives) {
      if (a.phase !== 'go' || a.def.type !== 'hunt' || a.def.enemy !== defKey) continue;
      a.killed++; changed = true;
      if (a.killed >= a.def.count) {
        a.phase = 'return';
        const R = Run.state;
        R.warnMsg = '📜 討伐完了!' + a.def.npcName + 'に報告しよう';
        R.warnColor = '#ffd766'; R.warnT = 4;
        Sfx.skill();
      }
    }
    if (changed) persist();   // 討伐数は周回を跨いで保持
  }

  function tick(dt){
    const R = Run.state;
    let persistNeeded = false;
    for (const a of actives) {
      // visit型: 目的地に到達したら達成 → 報告へ
      if (a.phase === 'go' && a.def.type === 'visit') {
        const vl = visitLoc(a.def);
        if (vl && Math.hypot(R.player.x - vl.x, R.player.y - vl.y) < 420) {
          a.phase = 'return';
          R.warnMsg = '📜 目的地を確認した!' + a.def.npcName + 'に報告しよう';
          R.warnColor = '#ffd766'; R.warnT = 4;
          Sfx.skill();
          persist();
        }
        continue;
      }
      if (a.phase !== 'go' || a.def.type !== 'survive') continue;
      const secBefore = Math.ceil(a.timer);
      a.near = Math.hypot(R.player.x - a.loc.x, R.player.y - a.loc.y) < 800;
      if (a.near) {
        a.timer -= dt;
        if (Math.ceil(a.timer) !== secBefore) persistNeeded = true;   // 1秒ごとに進捗保存
        if (a.timer <= 0) {
          a.phase = 'return';
          R.warnMsg = '📜 守り抜いた!' + a.def.npcName + 'に報告しよう';
          R.warnColor = '#ffd766'; R.warnT = 4;
          Sfx.skill();
          persistNeeded = true;
        }
      }
    }
    if (persistNeeded) persist();
  }

  // 討伐依頼中は対象の敵が近くに湧きやすくなる(進行中の討伐依頼の対象)
  function wantSpawn(){
    const a = actives.find(a => a.phase === 'go' && a.def.type === 'hunt');
    return a ? a.def.enemy : null;
  }

  function _forceReturn(kind, id){ const a = kind ? activeFor(kind, id) : actives[0]; if (a) { a.phase = 'return'; persist(); } }

  function visitTargets(){
    const out = [];
    for (const a of actives) {
      if (a.phase !== 'go' || a.def.type !== 'visit') continue;
      const vl = visitLoc(a.def);
      if (vl) out.push({ x:vl.x, y:vl.y, label:a.def.visit.label || '' });
    }
    return out;
  }
  return { reset, offer, atNpc, notifyKill, tick, wantSpawn, objText, activeFor, hasActive, _forceReturn, refreshHint, visitTargets,
           get active(){ return actives[0] || null; } };
})();
