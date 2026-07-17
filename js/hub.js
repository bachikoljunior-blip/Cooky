// =============================================================
// hub.js - 魂の広場(死後のフィールド)
//   ・初期の広場: 祭壇/研究所/宿舎/書庫/武器庫/石碑 + 転送ゲート
//   ・転送ゲート(最初からある): 出撃地点の選択 と 解放済み基地への移動
//   ・解放済み基地は独自の小さなマップを持ち、その基地の特別強化施設がある
//   ・画面隅に施設マップを常時表示
// =============================================================
'use strict';

const Hub = (() => {
  const H = { player:{ x:0, y:80, dir:1 }, interact:null, area:'main' };

  // ---------------- エリアと施設配置 ----------------
  function bounds(){
    return H.area === 'main'
      ? { x0:-800, y0:-360, x1:800, y1:400 }
      : { x0:-460, y0:-360, x1:460, y1:400 };
  }

  function stations(){
    if (H.area === 'main') {
      return [
        { kind:'meta', st:'altar',  x:-420, y:-170 },
        { kind:'meta', st:'lab',    x:-140, y:-170 },
        { kind:'meta', st:'camp',   x:140,  y:-170 },
        { kind:'meta', st:'lib',    x:420,  y:-170 },
        { kind:'armory', x:620, y:240 },
        { kind:'gate',   x:0,   y:260 },
        { kind:'stats',  x:-620, y:240 },
        // ストーリーで移り住んでくる住民たち
        ...((DATA.SIDEQUESTS && DATA.SIDEQUESTS.main) || []).filter(sq => Quest.sideVisible(sq))
          .map((sq, i) => ({ kind:'sidenpc', sq:sq.id, name:sq.npcName, spr:sq.npc, x:-300 + i * 300, y:60 })),
      ];
    }
    // 基地エリア: 特別強化施設 + NPC + ゲート(周回中に転移してきた時も同じマップ)
    const list = [];
    const facs = Object.keys(DATA.BASE_FACS);
    const present = facs.filter(f => Object.values(DATA.META).some(d => d.st === H.area && d.fac === f));
    present.forEach((f, i) => {
      const x = (i - (present.length - 1) / 2) * 260;
      list.push({ kind:'meta', st:H.area, fac:f, x, y:-90 });
    });
    if (DATA.QUESTS[H.area]) list.push({ kind:'npc', base:H.area, x:0, y:-250 });
    // 住民(サイドクエスト): しに戻り後もここで依頼を受けられる
    (DATA.SIDEQUESTS && DATA.SIDEQUESTS[H.area] || []).filter(sq => Quest.sideVisible(sq)).forEach((sq, i) => {
      list.push({ kind:'sidenpc', sq:sq.id, name:sq.npcName, spr:sq.npc, x:(i + 1) * 240 - 480, y:-250 });
    });
    list.push({ kind:'gate', x:0, y:260 });
    return list;
  }

  function areaName(){
    if (H.area === 'main') return '魂の広場';
    const b = DATA.BASES.find(b => b.id === H.area);
    return b ? '拠点「' + b.name + '」' : '拠点';
  }

  function enter(){
    H.fromRun = false;
    H.area = 'main';
    H.player.x = 0; H.player.y = 80;
    SaveSys.checkAchievements();
    H.list = stations();
  }

  function travel(areaId){
    H.fromRun = false;
    H.area = areaId;
    H.list = stations();
    H.player.x = 0; H.player.y = 90;
    Sfx.skill();
  }

  // 周回中に基地へ着いた時の転移: 拠点マップ(ゲートから行けるマップと同じ)に入る。
  // 周回は裏で保持され、ゲートの「周回に戻る」で続きから再開する。
  function enterFromRun(areaId){
    H.fromRun = true;
    H.area = areaId;
    H.list = stations();
    H.player.x = 0; H.player.y = 200;
    Sfx.skill();
  }

  function update(dt){
    const p = H.player;
    const ax = Input.axis();
    const b = bounds();
    p.x += ax.x * 240 * dt;
    p.y += ax.y * 240 * dt;
    p.x = Math.max(b.x0 + 40, Math.min(b.x1 - 40, p.x));
    p.y = Math.max(b.y0 + 40, Math.min(b.y1 - 40, p.y));
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
      const fac = s.fac && DATA.BASE_FACS[s.fac];
      const b = DATA.BASES.find(b => b.id === s.st);
      const name = st ? st.name : (b ? b.name + 'の' : '') + (fac ? fac.name : '特別強化');
      if (H.fromRun) return name + '(周回中は強化できない)';
      return st ? st.name : name + (fac ? '(' + fac.desc + ')' : '');
    }
    if (s.kind === 'npc') { const q = DATA.QUESTS[s.base]; return (q ? q.npcName : 'NPC') + 'と話す'; }
    if (s.kind === 'sidenpc') return s.name + 'と話す';
    if (s.kind === 'armory') return '武器庫(攻撃手段の切替・強化)';
    if (s.kind === 'gate') return H.fromRun ? '転送ゲート(周回に戻る)' : '転送ゲート(出撃 / 基地へ移動)';
    if (s.kind === 'stats') return '記録の石碑を見る';
    return '調べる';
  }

  function doInteract(){
    const s = H.interact;
    if (!s) return;
    if (s.kind === 'meta') {
      if (H.fromRun) { Game.dialog('', null, ['ここは戦いの最中。強化は しに戻ってから 落ち着いて行おう。'], null); return; }
      openMetaPanel(s.st, s.fac);
    }
    else if (s.kind === 'npc') {
      if (!SaveSys.data.bases[s.base]) Quest.offer('base', s.base);   // 未解放: 解放依頼(受注/報告)
      else Game.npcTalk(s.base);
    }
    else if (s.kind === 'sidenpc') Quest.offer('side', s.sq);
    else if (s.kind === 'armory') openArmoryPanel();
    else if (s.kind === 'gate') openGatePanel();
    else if (s.kind === 'stats') openStatsPanel();
  }

  // ---------------- 転送ゲート ----------------
  function openGatePanel(){
    Game.pauseFor('station');
    document.getElementById('station-title').textContent = '⛩ 転送ゲート';
    const body = document.getElementById('station-body');
    // 周回中に転移してきた時は「周回に戻る」だけ
    if (H.fromRun) {
      const b = DATA.BASES.find(b => b.id === H.area);
      body.innerHTML = `<p class="small">ここは周回中の拠点「${b ? b.name : ''}」。強化はしに戻ってから。</p>
        <div class="up-card"><div class="info">
          <div class="name">周回に戻る</div><div class="desc">この拠点の場所から探索を続ける</div></div>
          <button class="buy-btn" data-resume="1">戻る</button></div>`;
      body.querySelector('[data-resume]').onclick = () => { Sfx.buy(); Game.closeStation(); Game.resumeRun(); };
      return;
    }
    const unlocked = DATA.BASES.filter(b => SaveSys.data.bases[b.id]);
    let h = '<div class="sec-head">出撃する(出撃場所を選ぶ)</div>';
    h += `<div class="up-card"><div class="info">
      <div class="name">初期地点</div><div class="desc">始まりの大陸の中心から出撃する</div></div>
      <button class="buy-btn" data-depart="__origin">出撃</button></div>`;
    for (const b of unlocked) {
      h += `<div class="up-card"><div class="info">
        <div class="name">${b.name}</div><div class="desc">解放済みの基地から出撃する(危険度に注意)</div></div>
        <button class="buy-btn" data-depart="${b.id}">出撃</button></div>`;
    }
    h += '<div class="sec-head">基地へ移動(それぞれの基地に特別強化の施設がある)</div>';
    if (H.area !== 'main') {
      h += `<div class="up-card"><div class="info">
        <div class="name">魂の広場</div><div class="desc">祭壇・研究所・宿舎・書庫・武器庫のある最初の広場へ戻る</div></div>
        <button class="buy-btn" data-travel="main">移動</button></div>`;
    }
    let anyTravel = false;
    for (const b of unlocked) {
      if (b.id === H.area) continue;
      anyTravel = true;
      const items = Object.values(DATA.META).filter(d => d.st === b.id);
      const facs = Object.keys(DATA.BASE_FACS).filter(f => items.some(d => d.fac === f))
        .map(f => DATA.BASE_FACS[f].name).join('・');
      h += `<div class="up-card"><div class="info">
        <div class="name">${b.name}</div><div class="desc">施設: ${facs || '?'}(${items.length}種の強化)</div></div>
        <button class="buy-btn" data-travel="${b.id}">移動</button></div>`;
    }
    if (!anyTravel && H.area === 'main') {
      h += '<p class="small">まだ移動できる基地がない。周回中に基地を解放すると、ここから行き来できるようになる。</p>';
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-depart]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.depart;
        Sfx.buy();
        Game.closeStation();
        if (id === '__origin') Game.startRun({ x:0, y:0 });
        else { const b = DATA.BASES.find(b => b.id === id); Game.startRun({ x:b.x, y:b.y + 60 }); }
      };
    });
    body.querySelectorAll('[data-travel]').forEach(btn => {
      btn.onclick = () => {
        Game.closeStation();
        travel(btn.dataset.travel);
      };
    });
  }

  // ---------------- 武器庫(攻撃手段) ----------------
  function openArmoryPanel(){
    Game.pauseFor('station');
    renderArmory();
  }
  function renderArmory(){
    document.getElementById('station-title').textContent =
      '🗡 武器庫 ― 攻撃手段はここで選ぶ ― 🪙 ' + fmtNum(SaveSys.data.coins);
    const body = document.getElementById('station-body');
    let h = '<p class="small">主人公の攻撃手段は周回中のスキルでは手に入らない。ここで購入・強化し、どれか1つを選んで出撃する。</p>';
    for (const id in DATA.WEAPONS) {
      const def = DATA.WEAPONS[id];
      const lv = SaveSys.weaponLv(id);
      const max = SaveSys.weaponMax(id);
      const active = SaveSys.data.weapon === id;
      const iconUrl = Sprites.get(def.icon).toDataURL ? Sprites.get(def.icon).toDataURL() : '';
      // 実績ロック
      if (!lv && def.unlockAch && !SaveSys.data.ach[def.unlockAch]) {
        const ach = DATA.ACHIEVEMENTS.find(a => a.id === def.unlockAch);
        h += `<div class="up-card" style="opacity:.55"><div class="info">
          <div class="name">🔒 ???</div>
          <div class="desc">実績「${ach ? ach.name : '???'}」(${ach ? ach.desc : ''})で解放</div></div></div>`;
        continue;
      }
      if (!lv) {
        // 未購入
        const req = def.requires;
        const reqOk = !req || SaveSys.weaponLv(req.weapon) >= req.lv;
        const reqTxt = req ? `条件: ${DATA.WEAPONS[req.weapon].name} Lv${req.lv}` : '';
        const can = reqOk && SaveSys.data.coins >= def.buy;
        h += `<div class="up-card" ${reqOk ? '' : 'style="opacity:.6"'}>
          <img class="icon" src="${iconUrl}" alt="" style="width:34px;height:34px">
          <div class="info">
            <div class="name">${def.name}</div>
            <div class="desc">${def.desc}${reqTxt ? ' <span class="small">[' + reqTxt + ']</span>' : ''}</div>
          </div>
          <button class="buy-btn" data-wbuy="${id}" ${can ? '' : 'disabled'}>🪙 ${fmtNum(def.buy)}</button>
        </div>`;
        continue;
      }
      // 所持済み: 切替 + 強化
      const maxed = lv >= max;
      const cost = maxed ? 0 : def.up(lv);
      const canUp = !maxed && SaveSys.data.coins >= cost;
      const nextTxt = maxed ? '最大レベル' : 'Lv' + (lv + 1) + ': ' + (def.lvText[lv - 1] || '強化');
      h += `<div class="up-card" ${active ? 'style="border-color:#ffd766"' : ''}>
        <img class="icon" src="${iconUrl}" alt="" style="width:34px;height:34px">
        <div class="info">
          <div class="name">${active ? '⚔ ' : ''}${def.name} <span class="small">Lv ${lv}/${max}${active ? ' ― 選択中' : ''}</span></div>
          <div class="desc">${nextTxt}</div>
        </div>
        ${active ? '' : `<button class="buy-btn" data-wsel="${id}" style="background:#1f6feb">装備</button>`}
        <button class="buy-btn" data-wup="${id}" ${canUp ? '' : 'disabled'}>${maxed ? 'MAX' : '🪙 ' + fmtNum(cost)}</button>
      </div>`;
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-wbuy]').forEach(b => {
      b.onclick = () => { if (SaveSys.buyWeapon(b.dataset.wbuy)) { Sfx.buy(); renderArmory(); } else Sfx.deny(); };
    });
    body.querySelectorAll('[data-wup]').forEach(b => {
      b.onclick = () => { if (SaveSys.upWeapon(b.dataset.wup)) { Sfx.buy(); renderArmory(); } else Sfx.deny(); };
    });
    body.querySelectorAll('[data-wsel]').forEach(b => {
      b.onclick = () => { if (SaveSys.setWeapon(b.dataset.wsel)) { Sfx.skill(); renderArmory(); } else Sfx.deny(); };
    });
  }

  // ---------------- 強化パネル ----------------
  function openMetaPanel(stKey, fac){
    Game.pauseFor('station');
    const stDef = DATA.STATIONS[stKey];
    const base = DATA.BASES.find(b => b.id === stKey);
    const facDef = fac && DATA.BASE_FACS[fac];
    document.getElementById('station-title').textContent =
      (stDef ? stDef.name : '✦ ' + (base ? base.name : '') + 'の' + (facDef ? facDef.name : '特別強化')) +
      ' ― 🪙 ' + fmtNum(SaveSys.data.coins);
    renderMetaList(stKey, fac);
  }

  function renderMetaList(stKey, fac){
    const body = document.getElementById('station-body');
    let h = '';
    if (fac && DATA.BASE_FACS[fac]) h += `<p class="small">${DATA.BASE_FACS[fac].desc}。施設は基地ごとに品揃えが違う。</p>`;
    for (const id in DATA.META) {
      const def = DATA.META[id];
      if (def.st !== stKey) continue;
      if (fac && def.fac !== fac) continue;
      // 実績で解放される項目
      if (def.unlockAch && !SaveSys.data.ach[def.unlockAch]) {
        const ach = DATA.ACHIEVEMENTS.find(a => a.id === def.unlockAch);
        h += `<div class="up-card" style="opacity:.55">
          <div class="info">
            <div class="name">🔒 ???</div>
            <div class="desc">実績「${ach ? ach.name : '???'}」(${ach ? ach.desc : ''})で解放</div>
          </div></div>`;
        continue;
      }
      // 基地の解放数で解放される項目(古い地図の修復など)
      if (def.unlockBases && Object.keys(SaveSys.data.bases).length < def.unlockBases) {
        h += `<div class="up-card" style="opacity:.55">
          <div class="info">
            <div class="name">🔒 ???</div>
            <div class="desc">周回中に基地を${def.unlockBases}つ解放すると現れる</div>
          </div></div>`;
        continue;
      }
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
    // 書庫: 周回中スキル表示の設定(解放したことのあるスキルを非表示にできる)
    if (stKey === 'lib') {
      const seen = SaveSys.data.skillsSeen || {};
      const ids = Object.keys(seen).filter(id => DATA.SKILLS[id]);
      if (ids.length) {
        h += '<div class="sec-head">周回中のスキル獲得設定(いらないスキルを獲得候補から外せる)</div>';
        for (const id of ids) {
          const hidden = SaveSys.data.skillHidden && SaveSys.data.skillHidden[id];
          h += `<div class="up-card"><div class="info">
            <div class="name">${DATA.SKILLS[id].name}</div>
            <div class="desc">${hidden ? '周回中は獲得できない(リストにも出ない)' : '周回中に獲得できる'}</div></div>
            <button class="buy-btn" data-hide="${id}" style="background:${hidden ? '#8b1e24' : '#1f6feb'}">${hidden ? '獲得しない' : '獲得する'}</button>
          </div>`;
        }
      }
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-hide]').forEach(b => {
      b.onclick = () => {
        SaveSys.data.skillHidden = SaveSys.data.skillHidden || {};
        const id = b.dataset.hide;
        SaveSys.data.skillHidden[id] = !SaveSys.data.skillHidden[id];
        SaveSys.save();
        Sfx.buy();
        renderMetaList(stKey, fac);
      };
    });
    body.querySelectorAll('.buy-btn[data-meta]').forEach(b => {
      b.onclick = () => {
        if (SaveSys.buyMeta(b.dataset.meta)) {
          Sfx.buy();
          document.getElementById('station-title').textContent =
            document.getElementById('station-title').textContent.replace(/🪙 .+$/, '🪙 ' + fmtNum(SaveSys.data.coins));
          renderMetaList(stKey, fac);
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
        <p>素材収集: <b>${fmtNum(s.matsCollected||0)}</b> / オブジェクト破壊: <b>${fmtNum(s.objectsDestroyed||0)}</b> / スキル取得: <b>${s.skillsAcquired||0}回</b></p>
        <div class="sec-head">🏆 実績 (${Object.keys(SaveSys.data.ach).length}/${DATA.ACHIEVEMENTS.length})</div>
        ${DATA.ACHIEVEMENTS.map(a => {
          const done = SaveSys.data.ach[a.id];
          return `<p style="opacity:${done ? 1 : .5}">${done ? '✅' : '⬜'} <b>${a.name}</b> ― ${a.desc}<br>
            <span class="small">報酬: ${a.reward}</span></p>`;
        }).join('')}
      </div>`;
  }

  // ---------------- 描画 ----------------
  function stationVisual(s){
    if (s.kind === 'meta') {
      const stDef = DATA.STATIONS[s.st];
      if (stDef) return { spr: stDef.sprite, label: stDef.name, short: stDef.name.slice(-2) };
      const fac = s.fac && DATA.BASE_FACS[s.fac];
      if (fac) return { spr: fac.sprite, label: fac.name, short: fac.short };
      return { spr:'st_altar', label:'特別強化', short:'強化' };
    }
    if (s.kind === 'npc') { const q = DATA.QUESTS[s.base]; return { spr: (q && q.npc) || 'npc_elder', label: q ? q.npcName : 'NPC', short: 'NPC' }; }
    if (s.kind === 'sidenpc') return { spr: s.spr || 'npc_girl', label: s.name, short: '住民' };
    if (s.kind === 'armory') return { spr:'st_armory', label:'武器庫', short:'武器' };
    if (s.kind === 'gate') return { spr:'st_gate', label:'転送ゲート', short:'ゲート' };
    if (s.kind === 'stats') return { spr:'ob_rock', label:'記録の石碑', short:'石碑' };
    return { spr:'st_altar', label:'', short:'' };
  }
  // 施設マップ用の短い名前
  const SHORT_NAMES = { altar:'祭壇', lab:'研究所', camp:'宿舎', lib:'書庫' };

  function draw(g, W, H2){
    const p = H.player;
    const camX = p.x - W/2, camY = p.y - H2/2;
    const bnd = bounds();
    // 床
    g.fillStyle = H.area === 'main' ? '#131a2b' : '#16202b';
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

    // 広場の縁(装飾つき)
    g.strokeStyle = '#2b3654'; g.lineWidth = 6;
    g.strokeRect(bnd.x0, bnd.y0, bnd.x1 - bnd.x0, bnd.y1 - bnd.y0);
    g.strokeStyle = 'rgba(118,227,234,.14)'; g.lineWidth = 2;
    g.strokeRect(bnd.x0 + 14, bnd.y0 + 14, bnd.x1 - bnd.x0 - 28, bnd.y1 - bnd.y0 - 28);

    // 浮遊する魂の粒
    const hbT = performance.now() / 1000;
    const bw = bnd.x1 - bnd.x0, bh = bnd.y1 - bnd.y0;
    for (let i = 0; i < 26; i++) {
      const sx = bnd.x0 + 40 + ((i * 331) % (bw - 80));
      const sy = bnd.y0 + (((hbT * (8 + i % 5 * 4) + i * 197)) % bh);
      g.fillStyle = `hsla(${185 + (i % 3) * 30}, 80%, 70%, ${0.10 + (i % 3) * 0.06})`;
      g.beginPath(); g.arc(sx + Math.sin(hbT + i) * 14, bnd.y0 + bh - (sy - bnd.y0), 2 + (i % 3), 0, 7); g.fill();
    }

    // 施設
    for (const s of H.list) {
      const v = stationVisual(s);
      const glow = H.interact === s;
      const gg = g.createRadialGradient(s.x, s.y + 20, 4, s.x, s.y + 20, 66);
      gg.addColorStop(0, glow ? 'rgba(255,215,102,.30)' : 'rgba(118,227,234,.12)');
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gg;
      g.beginPath(); g.arc(s.x, s.y + 20, 66, 0, 7); g.fill();
      Sprites.draw(g, v.spr, s.x, s.y, 84);
      g.fillStyle = glow ? '#ffd766' : '#c9d1d9';
      g.font = '13px sans-serif'; g.textAlign = 'center';
      g.fillText(v.label, s.x, s.y + 60);
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
    g.fillText(areaName() + '  🪙 ' + fmtNum(SaveSys.data.coins), 14, 26);
    g.fillStyle = '#8b949e'; g.font = '13px sans-serif'; g.textAlign = 'right';
    g.fillText('周回 ' + SaveSys.data.stats.runs + ' / 最長 ' + fmtTime(SaveSys.data.stats.bestTime), W - 14, 26);

    drawFacilityMap(g, W);
  }

  // 施設マップ: どこに何のパワーアップ施設があるか一目でわかる
  function drawFacilityMap(g, W){
    const bnd = bounds();
    const mw = Math.min(200, Math.floor(W * 0.36));
    const scale = mw / (bnd.x1 - bnd.x0);
    const mh = Math.ceil((bnd.y1 - bnd.y0) * scale);
    const x0 = W - mw - 10, y0 = 48;
    g.fillStyle = 'rgba(5,9,18,.72)';
    g.fillRect(x0, y0, mw, mh);
    g.strokeStyle = '#30363d'; g.strokeRect(x0, y0, mw, mh);
    const pt = (wx, wy) => ({ x: x0 + (wx - bnd.x0) * scale, y: y0 + (wy - bnd.y0) * scale });
    g.textAlign = 'center';
    for (const s of H.list) {
      const q = pt(s.x, s.y);
      const col = s.kind === 'gate' ? '#76e3ea' : s.kind === 'stats' ? '#8b949e' : '#ffd766';
      g.fillStyle = col;
      g.beginPath(); g.arc(q.x, q.y, 3, 0, 7); g.fill();
      const v = stationVisual(s);
      const short = s.kind === 'meta' && SHORT_NAMES[s.st] ? SHORT_NAMES[s.st] : v.short;
      g.font = '9px sans-serif';
      g.fillStyle = H.interact === s ? '#ffd766' : '#c9d1d9';
      g.fillText(short, q.x, q.y - 6);
    }
    const pq = pt(H.player.x, H.player.y);
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(pq.x, pq.y, 3, 0, 7); g.fill();
    g.fillStyle = '#8b949e'; g.font = '10px sans-serif';
    g.fillText('施設マップ', x0 + mw / 2, y0 + mh + 12);
  }

  return { enter, update, draw, doInteract, travel, enterFromRun, get state(){ return H; } };
})();
