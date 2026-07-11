// =============================================================
// quest.js - RPG風クエストシーン
//   未解放の基地/未修理の船に近づくと周回を一時停止して転移。
//   NPCとの会話 → 討伐/収集/防衛/納品クエスト → 解放。
//   クリア(または退出)すると周回のその場に戻る(時間は進まない)。
// =============================================================
'use strict';

const Quest = (() => {
  const Q = {};   // クエスト状態

  const dlgBox = () => document.getElementById('dialog-box');
  const objEl = () => document.getElementById('quest-obj');

  // ---------------- 開始 ----------------
  function start(kind, id){
    const def = DATA.QUESTS[id];
    if (!def) return false;
    Q.kind = kind; Q.id = id; Q.def = def;
    Q.w = 1500; Q.h = 1000;
    const st = Run.state.stats;
    Q.player = { x: Q.w/2, y: Q.h - 200, hp: st.maxHp, dir: 1, invuln: 0, boltCd: 0 };
    Q.npc = { x: Q.w/2, y: 280 };
    Q.enemies = []; Q.projs = []; Q.items = []; Q.effects = []; Q.popups = [];
    Q.phase = 'intro';   // intro / active / return / done / fail
    Q.killed = 0; Q.spawnedN = 0; Q.got = 0;
    Q.timer = def.time || 0;
    Q.spawnAcc = 0; Q.time = 0;
    // 場所のバイオームと危険度(敵スケールに使用)
    const loc = kind === 'base' ? DATA.BASES.find(b => b.id === id)
                                : World.ports.find(p => p.id === id);
    Q.biome = loc ? (World.tileAt(loc.x, loc.y).biome || 'grass') : 'grass';
    Q.ring = loc ? World.ringOf(loc.x, loc.y) : 0;
    // 小道具(見た目)
    Q.props = [];
    for (let i = 0; i < 10; i++) {
      Q.props.push({ x: 120 + ((i * 733) % (Q.w - 240)), y: 120 + ((i * 977) % (Q.h - 240)),
        s: ['ob_tree','ob_rock','ob_crate'][i % 3] });
    }
    // 収集クエスト: アイテムを散らす
    if (def.type === 'fetch') {
      for (let i = 0; i < def.count; i++) {
        Q.items.push({ x: 150 + ((i * 613 + 211) % (Q.w - 300)),
                       y: 200 + ((i * 419 + 97) % (Q.h - 400)), got: false });
      }
    }
    openDialog(def.npcName, def.intro.slice(), () => {
      if (def.type === 'delivery') showDelivery();
      else {
        Q.phase = 'active';
        refreshObj();
      }
    });
    objEl().classList.remove('hidden');
    document.getElementById('quest-exit').classList.remove('hidden');
    refreshObj();
    return true;
  }

  // ---------------- ダイアログ ----------------
  let dlgLines = [], dlgDone = null;
  function openDialog(name, lines, onDone){
    dlgLines = lines.slice(); dlgDone = onDone;
    document.getElementById('dialog-name').textContent = name;
    document.getElementById('dialog-choices').innerHTML = '';
    dlgBox().classList.remove('hidden');
    nextLine();
  }
  function nextLine(){
    if (!dlgLines.length) {
      dlgBox().classList.add('hidden');
      const cb = dlgDone; dlgDone = null;
      if (cb) cb();
      return;
    }
    document.getElementById('dialog-text').textContent = dlgLines.shift();
  }
  function dialogOpen(){ return !dlgBox().classList.contains('hidden'); }

  // 納品クエスト: 選択肢を表示
  function showDelivery(){
    const need = Q.def.need;
    const wallet = SaveSys.data.coins + Run.state.coins;
    let ok = wallet >= (need.coins || 0);
    let listTxt = '🪙' + fmtNum(need.coins || 0);
    for (const m in need.mats || {}) {
      const have = Skills.matCount(m);
      if (have < need.mats[m]) ok = false;
      listTxt += ' / ' + DATA.MATERIALS[m].name + ' ' + have + '/' + need.mats[m];
    }
    document.getElementById('dialog-name').textContent = Q.def.npcName;
    document.getElementById('dialog-text').textContent = '必要なもの: ' + listTxt;
    const ch = document.getElementById('dialog-choices');
    ch.innerHTML = `
      <button class="dlg-choice" id="dlg-give" ${ok ? '' : 'disabled'}>渡す</button>
      <button class="dlg-choice sub" id="dlg-later">また今度</button>`;
    dlgBox().classList.remove('hidden');
    document.getElementById('dlg-give').onclick = () => {
      if (!ok) return;
      // 支払い(周回の所持金→銀行の順)
      let amount = need.coins || 0;
      const fromRun = Math.min(Run.state.coins, amount);
      Run.state.coins -= fromRun;
      SaveSys.data.coins -= (amount - fromRun);
      for (const m in need.mats || {}) Skills.mats()[m] -= need.mats[m];
      SaveSys.save();
      ch.innerHTML = '';
      complete();
    };
    document.getElementById('dlg-later').onclick = () => {
      ch.innerHTML = '';
      openDialog(Q.def.npcName, ['そうか…また揃ったら来てくれ。'], () => Game.exitQuest(false));
    };
  }

  // ---------------- 目標表示 ----------------
  function refreshObj(){
    const d = Q.def;
    let t = '';
    if (Q.phase === 'intro') t = d.npcName + 'と話そう';
    else if (Q.phase === 'return') t = d.npcName + 'に報告しよう';
    else if (d.type === 'hunt') t = '討伐: ' + Q.killed + ' / ' + d.count + '(' + DATA.ENEMIES[d.enemy].name + ')';
    else if (d.type === 'fetch') t = d.itemName + ': ' + Q.got + ' / ' + d.count;
    else if (d.type === 'survive') t = '生き延びろ: あと ' + Math.ceil(Q.timer) + '秒';
    else t = d.npcName + 'と話そう';
    objEl().textContent = '📜 ' + t;
  }

  // ---------------- クリア/失敗 ----------------
  function complete(){
    Q.phase = 'done';
    Q.enemies.length = 0;
    openDialog(Q.def.npcName, Q.def.done.slice(), () => Game.exitQuest(true));
  }
  function fail(){
    Q.phase = 'fail';
    Q.enemies.length = 0;
    openDialog(Q.def.npcName, ['おっと、無理は禁物だ…。', '体勢を立て直して、また来てくれ。'], () => Game.exitQuest(false));
  }
  function _forceComplete(){ complete(); }   // テスト用

  // ---------------- 更新 ----------------
  function spawnEnemy(){
    const def = DATA.ENEMIES[Q.def.enemy];
    // プレイヤーの周囲300〜450pxに出現(テンポ重視)
    const a = Math.random() * Math.PI * 2;
    const dist = 300 + Math.random() * 150;
    const x = Math.max(60, Math.min(Q.w - 60, Q.player.x + Math.cos(a) * dist));
    const y = Math.max(60, Math.min(Q.h - 60, Q.player.y + Math.sin(a) * dist));
    Q.enemies.push({
      def, x, y,
      maxHp: def.hp * (1.3 + Q.ring * 0.4),
      hp: def.hp * (1.3 + Q.ring * 0.4),
      dmg: Math.max(4, def.dmg * (0.7 + Q.ring * 0.12)),
      contactCd: 0, flash: 0, wander: Math.random() * 7,
    });
    Q.spawnedN++;
  }

  function update(dt){
    if (dialogOpen()) return;   // 会話中は停止
    Q.time += dt;
    const p = Q.player;
    const st = Run.state.stats;
    p.invuln = Math.max(0, p.invuln - dt);

    // 移動(壁あり)
    const ax = Input.axis();
    p.x = Math.max(40, Math.min(Q.w - 40, p.x + ax.x * st.speed * dt));
    p.y = Math.max(40, Math.min(Q.h - 40, p.y + ax.y * st.speed * dt));
    if (ax.x) p.dir = ax.x < 0 ? -1 : 1;

    const d = Q.def;
    if (Q.phase === 'active') {
      // 敵スポーン
      if (d.type === 'hunt' && Q.spawnedN < d.count) {
        Q.spawnAcc += dt;
        if (Q.spawnAcc > 0.9) { Q.spawnAcc = 0; spawnEnemy(); }
      }
      if (d.type === 'survive') {
        Q.timer -= dt;
        Q.spawnAcc += dt;
        const interval = Math.max(1.6, 3.4 - Q.time * 0.03);
        if (Q.spawnAcc > interval && Q.enemies.length < 24) { Q.spawnAcc = 0; spawnEnemy(); spawnEnemy(); }
        if (Q.timer <= 0) { complete(); return; }
        refreshObj();
      }
      // 収集
      if (d.type === 'fetch') {
        for (const it of Q.items) {
          if (!it.got && Math.hypot(it.x - p.x, it.y - p.y) < 30) {
            it.got = true; Q.got++;
            Sfx.mat();
            refreshObj();
          }
        }
        if (Q.got >= d.count) { Q.phase = 'return'; refreshObj(); }
      }
    }

    // 自動攻撃(シンプルなボルト)
    p.boltCd -= dt;
    if (p.boltCd <= 0 && Q.enemies.length) {
      let tgt = null, bd = 340 * st.range;
      for (const e of Q.enemies) {
        const dd = Math.hypot(e.x - p.x, e.y - p.y);
        if (dd < bd) { tgt = e; bd = dd; }
      }
      if (tgt) {
        p.boltCd = 0.42;
        const dd = bd || 1;
        Q.projs.push({ x: p.x, y: p.y, vx: (tgt.x - p.x) / dd * 430, vy: (tgt.y - p.y) / dd * 430, life: 1.2 });
        Sfx.shoot();
      }
    }
    // 弾
    for (let i = Q.projs.length - 1; i >= 0; i--) {
      const b = Q.projs[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { Q.projs.splice(i, 1); continue; }
      for (const e of Q.enemies) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.def.r + 6) {
          e.hp -= 15 * st.atk;
          e.flash = 0.08;
          Sfx.hit();
          Q.projs.splice(i, 1);
          break;
        }
      }
    }
    // 敵
    for (let i = Q.enemies.length - 1; i >= 0; i--) {
      const e = Q.enemies[i];
      if (e.hp <= 0) {
        Q.enemies.splice(i, 1);
        Q.killed++;
        Q.effects.push({ x: e.x, y: e.y, t: 0 });
        if (d.type === 'hunt') {
          refreshObj();
          if (Q.killed >= d.count) { Q.phase = 'return'; refreshObj(); }
        }
        continue;
      }
      e.flash = Math.max(0, e.flash - dt);
      e.contactCd = Math.max(0, e.contactCd - dt);
      const pd = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      const spd = e.def.speed * 0.9;
      e.x += (p.x - e.x) / pd * spd * dt;
      e.y += (p.y - e.y) / pd * spd * dt;
      if (pd < e.def.r + 16 && e.contactCd <= 0 && p.invuln <= 0) {
        e.contactCd = 0.7;
        p.hp -= e.dmg;
        p.invuln = 0.4;
        Sfx.hurt();
        if (p.hp <= 0) { fail(); return; }
      }
    }
    // エフェクト
    for (let i = Q.effects.length - 1; i >= 0; i--) {
      Q.effects[i].t += dt;
      if (Q.effects[i].t > 0.4) Q.effects.splice(i, 1);
    }
  }

  // ---------------- インタラクト ----------------
  function doInteract(){
    if (dialogOpen()) { nextLine(); return; }
    // NPCの近くでE: 報告 or 会話
    const p = Q.player;
    if (Math.hypot(Q.npc.x - p.x, Q.npc.y - p.y) < 80) {
      if (Q.phase === 'return') complete();
      else if (Q.phase === 'active') {
        const d = Q.def;
        const hint = d.type === 'hunt' ? 'まだ敵が残っているぞ。'
          : d.type === 'fetch' ? 'まだ' + d.itemName + 'が揃っていないようだね。'
          : '今は持ちこたえてくれ!';
        openDialog(d.npcName, [hint], null);
      } else if (Q.phase === 'intro' && Q.def.type === 'delivery') {
        showDelivery();
      }
    }
  }

  // ---------------- 描画 ----------------
  function draw(g, W, H){
    const p = Q.player;
    const camX = Math.max(0, Math.min(Q.w - W, p.x - W/2));
    const camY = Math.max(0, Math.min(Q.h - H, p.y - H/2));
    // 床(バイオーム色)
    const bio = DATA.BIOMES[Q.biome] || DATA.BIOMES.grass;
    const T = 40;
    for (let iy = Math.floor(camY/T); iy <= Math.ceil((camY+H)/T); iy++) {
      for (let ix = Math.floor(camX/T); ix <= Math.ceil((camX+W)/T); ix++) {
        g.fillStyle = (ix + iy) % 2 === 0 ? bio.g1 : bio.g2;
        g.fillRect(ix*T - camX, iy*T - camY, T+1, T+1);
      }
    }
    g.save();
    g.translate(-camX, -camY);
    // 外周の結界
    g.strokeStyle = 'rgba(118,227,234,.5)'; g.lineWidth = 6;
    g.strokeRect(20, 20, Q.w - 40, Q.h - 40);
    // 小道具
    for (const pr of Q.props) Sprites.draw(g, pr.s, pr.x, pr.y, 38);
    // 収集アイテム
    for (const it of Q.items) {
      if (it.got) continue;
      const bob = Math.sin(Q.time * 4 + it.x) * 4;
      g.fillStyle = 'rgba(255,215,102,.25)';
      g.beginPath(); g.arc(it.x, it.y + bob, 16, 0, 7); g.fill();
      Sprites.draw(g, 'q_item', it.x, it.y + bob, 22);
    }
    // NPC
    const npcGlow = Math.hypot(Q.npc.x - p.x, Q.npc.y - p.y) < 80;
    if (npcGlow) {
      g.fillStyle = 'rgba(255,215,102,.15)';
      g.beginPath(); g.arc(Q.npc.x, Q.npc.y, 46, 0, 7); g.fill();
    }
    Sprites.draw(g, Q.def.npc, Q.npc.x, Q.npc.y, 42);
    g.fillStyle = '#ffd766'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
    g.fillText((Q.phase === 'return' ? '❗ ' : '') + Q.def.npcName, Q.npc.x, Q.npc.y - 34);
    // 敵
    for (const e of Q.enemies) {
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.beginPath(); g.ellipse(e.x, e.y + e.def.r, e.def.r * 0.8, 4, 0, 0, 7); g.fill();
      if (e.flash > 0) g.globalAlpha = 0.6;
      Sprites.draw(g, e.def.sprite, e.x, e.y, e.def.r * 2.6, e.x > p.x);
      g.globalAlpha = 1;
      if (e.hp < e.maxHp) {
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(e.x - e.def.r, e.y - e.def.r - 10, e.def.r * 2, 4);
        g.fillStyle = '#f85149'; g.fillRect(e.x - e.def.r, e.y - e.def.r - 10, e.def.r * 2 * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
    // 弾
    g.fillStyle = '#58a6ff';
    for (const b of Q.projs) { g.beginPath(); g.arc(b.x, b.y, 6, 0, 7); g.fill(); }
    // 撃破エフェクト
    for (const ef of Q.effects) {
      g.strokeStyle = '#ffd766'; g.globalAlpha = 1 - ef.t / 0.4; g.lineWidth = 3;
      g.beginPath(); g.arc(ef.x, ef.y, 10 + ef.t * 60, 0, 7); g.stroke();
      g.globalAlpha = 1;
    }
    // プレイヤー
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.beginPath(); g.ellipse(p.x, p.y + 15, 12, 4, 0, 0, 7); g.fill();
    if (p.invuln > 0 && Math.floor(Q.time * 12) % 2 === 0) g.globalAlpha = 0.4;
    Sprites.draw(g, 'player', p.x, p.y, 36, p.dir < 0);
    g.globalAlpha = 1;
    g.restore();

    // HPバー(上部)
    const st = Run.state.stats;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(W/2 - 110, 12, 220, 18);
    g.fillStyle = p.hp / st.maxHp > 0.35 ? '#3fb950' : '#f85149';
    g.fillRect(W/2 - 107, 15, 214 * Math.max(0, p.hp / st.maxHp), 12);
    // NPCヒント
    if (npcGlow && !dialogOpen()) {
      g.fillStyle = '#ffd766'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center';
      g.fillText('E / 実行ボタン: 話す', W/2, H - 130);
    }
  }

  return { start, update, draw, doInteract, dialogOpen, _forceComplete, get state(){ return Q; } };
})();
