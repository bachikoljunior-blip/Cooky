// =============================================================
// hub.js - 魂の広場(死後のフィールド)
//   歩き回って各施設で恒久強化 / 基地ワープゲート / 出撃
// =============================================================
'use strict';

const Hub = (() => {
  const H = { player:{ x:0, y:80, dir:1 }, interact:null };

  // 施設配置
  function stations(){
    const list = [
      { kind:'meta', st:'altar', x:-420, y:-170 },
      { kind:'meta', st:'lab',   x:-140, y:-170 },
      { kind:'meta', st:'camp',  x:140,  y:-170 },
      { kind:'meta', st:'lib',   x:420,  y:-170 },
      { kind:'depart', x:0, y:260 },
      { kind:'stats',  x:-620, y:260 },
    ];
    // 解放済み基地のワープゲート + 専用強化
    let i = 0;
    for (const b of DATA.BASES) {
      if (!SaveSys.data.bases[b.id]) continue;
      const gx = -540 + (i % 5) * 270, gy = 480 + Math.floor(i / 5) * 200;
      list.push({ kind:'warp', base:b, x:gx, y:gy });
      list.push({ kind:'meta', st:b.id, x:gx + 110, y:gy, small:true });
      i++;
    }
    return list;
  }

  function enter(){
    H.player.x = 0; H.player.y = 80;
    H.list = stations();
  }

  function update(dt){
    const p = H.player;
    const ax = Input.axis();
    p.x += ax.x * 240 * dt;
    p.y += ax.y * 240 * dt;
    p.x = Math.max(-760, Math.min(760, p.x));
    p.y = Math.max(-320, Math.min(760, p.y));
    if (ax.x) p.dir = ax.x < 0 ? -1 : 1;

    H.interact = null;
    for (const s of H.list) {
      if (Math.hypot(p.x - s.x, p.y - s.y) < 75) { H.interact = s; break; }
    }
    const hint = document.getElementById('interact-hint');
    const actBtn = document.getElementById('btn-act');
    if (H.interact) {
      hint.textContent = 'E: ' + interactLabel(H.interact);
      hint.classList.remove('hidden');
      actBtn.classList.remove('hidden');
    } else { hint.classList.add('hidden'); actBtn.classList.add('hidden'); }
  }

  function interactLabel(s){
    if (s.kind === 'meta') {
      const st = DATA.STATIONS[s.st];
      if (st) return st.name;
      const b = DATA.BASES.find(b => b.id === s.st);
      return b ? b.name + 'の強化' : '強化';
    }
    if (s.kind === 'depart') return '出撃する(初期地点)';
    if (s.kind === 'warp') return 'ワープ出撃: ' + s.base.name;
    if (s.kind === 'stats') return '記録の石碑を見る';
    return '調べる';
  }

  function doInteract(){
    const s = H.interact;
    if (!s) return;
    if (s.kind === 'meta') openMetaPanel(s.st);
    else if (s.kind === 'depart') Game.startRun({ x:0, y:0 });
    else if (s.kind === 'warp') Game.startRun({ x:s.base.x, y:s.base.y + 60 });
    else if (s.kind === 'stats') openStatsPanel();
  }

  // ---------------- 強化パネル ----------------
  function openMetaPanel(stKey){
    Game.pauseFor('station');
    const stDef = DATA.STATIONS[stKey];
    const base = DATA.BASES.find(b => b.id === stKey);
    document.getElementById('station-title').textContent =
      (stDef ? stDef.name : '✦ ' + (base ? base.name : '') + ' の特別強化') +
      ' ― 🪙 ' + fmtNum(SaveSys.data.coins);
    renderMetaList(stKey);
  }

  function renderMetaList(stKey){
    const body = document.getElementById('station-body');
    let h = '';
    for (const id in DATA.META) {
      const def = DATA.META[id];
      if (def.st !== stKey) continue;
      const lv = SaveSys.metaLv(id);
      const maxed = lv >= def.max;
      const cost = maxed ? 0 : def.cost(lv);
      const can = !maxed && SaveSys.data.coins >= cost;
      h += `<div class="up-card">
        <div class="info">
          <div class="name">${def.name} <span class="small">Lv ${lv}/${def.max}</span></div>
          <div class="desc">${def.desc}</div>
        </div>
        <button class="buy-btn" data-meta="${id}" ${can ? '' : 'disabled'}>
          ${maxed ? 'MAX' : '🪙 ' + fmtNum(cost)}</button>
      </div>`;
    }
    if (!h) h = '<p class="small">ここにはまだ強化がない。</p>';
    body.innerHTML = h;
    body.querySelectorAll('.buy-btn').forEach(b => {
      b.onclick = () => {
        if (SaveSys.buyMeta(b.dataset.meta)) {
          Sfx.buy();
          document.getElementById('station-title').textContent =
            document.getElementById('station-title').textContent.replace(/🪙 .+$/, '🪙 ' + fmtNum(SaveSys.data.coins));
          renderMetaList(stKey);
        } else Sfx.deny();
      };
    });
  }

  function openStatsPanel(){
    Game.pauseFor('station');
    const s = SaveSys.data.stats;
    document.getElementById('station-title').textContent = '📜 記録の石碑';
    const basesN = Object.keys(SaveSys.data.bases).length;
    const portsN = Object.keys(SaveSys.data.ports).length;
    document.getElementById('station-body').innerHTML = `
      <div class="help-body">
        <p>周回数: <b>${s.runs}</b></p>
        <p>最長生存時間: <b>${fmtTime(s.bestTime)}</b> ${s.bestTime >= DATA.REAPER_AT ? '☠(終焉の刻を超えた!)' : ''}</p>
        <p>最遠到達距離: <b>${fmtNum(s.maxDist)}</b></p>
        <p>総撃破数: <b>${fmtNum(s.kills)}</b> / ボス撃破: <b>${s.bossKills}</b> / リーパー撃破: <b>${s.reaperKills}</b></p>
        <p>仲間にした数: <b>${s.recruits}</b></p>
        <p>総獲得コイン: <b>${fmtNum(s.totalCoins)}</b></p>
        <p>解放した基地: <b>${basesN} / ${DATA.BASES.length}</b></p>
        <p>修理した港: <b>${portsN} / ${DATA.PORTS.length}</b></p>
      </div>`;
  }

  // ---------------- 描画 ----------------
  function draw(g, W, H2){
    const p = H.player;
    const camX = p.x - W/2, camY = p.y - H2/2;
    // 床
    g.fillStyle = '#131a2b';
    g.fillRect(0, 0, W, H2);
    const T = 48;
    const x0 = Math.floor(camX/T), y0 = Math.floor(camY/T);
    for (let iy = 0; iy <= Math.ceil(H2/T)+1; iy++) {
      for (let ix = 0; ix <= Math.ceil(W/T)+1; ix++) {
        if (((x0+ix)+(y0+iy)) % 2 === 0) continue;
        g.fillStyle = 'rgba(255,255,255,.025)';
        g.fillRect((x0+ix)*T - camX, (y0+iy)*T - camY, T, T);
      }
    }
    g.save();
    g.translate(-camX, -camY);

    // 広場の縁
    g.strokeStyle = '#2b3654'; g.lineWidth = 6;
    g.strokeRect(-800, -360, 1600, 1160);

    // 施設
    for (const s of H.list) {
      let spr = 'st_altar', label = '';
      if (s.kind === 'meta') {
        const stDef = DATA.STATIONS[s.st];
        if (stDef) { spr = stDef.sprite; label = stDef.name; }
        else { spr = 'st_altar'; const b = DATA.BASES.find(b => b.id === s.st); label = (b?b.name:'') + 'の強化'; }
      } else if (s.kind === 'depart') { spr = 'st_gate'; label = '出撃ゲート'; }
      else if (s.kind === 'warp') { spr = 'st_warp'; label = '→ ' + s.base.name; }
      else if (s.kind === 'stats') { spr = 'ob_rock'; label = '記録の石碑'; }
      const glow = H.interact === s;
      if (glow) {
        g.fillStyle = 'rgba(255,215,102,.12)';
        g.beginPath(); g.arc(s.x, s.y, 70, 0, 7); g.fill();
      }
      Sprites.draw(g, spr, s.x, s.y, s.small ? 52 : 84);
      g.fillStyle = glow ? '#ffd766' : '#c9d1d9';
      g.font = (s.small ? '11px' : '13px') + ' sans-serif'; g.textAlign = 'center';
      g.fillText(label, s.x, s.y + (s.small ? 40 : 60));
    }

    // プレイヤー(魂verは少し透ける)
    g.globalAlpha = 0.92;
    Sprites.draw(g, 'player', p.x, p.y, 36, p.dir < 0);
    g.globalAlpha = 1;

    g.restore();

    // 上部情報
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.fillRect(0, 0, W, 40);
    g.fillStyle = '#ffd766'; g.font = 'bold 17px sans-serif'; g.textAlign = 'left';
    g.fillText('魂の広場  🪙 ' + fmtNum(SaveSys.data.coins), 14, 26);
    g.fillStyle = '#8b949e'; g.font = '13px sans-serif'; g.textAlign = 'right';
    g.fillText('周回 ' + SaveSys.data.stats.runs + ' / 最長 ' + fmtTime(SaveSys.data.stats.bestTime), W - 14, 26);
  }

  return { enter, update, draw, doInteract, get state(){ return H; } };
})();
