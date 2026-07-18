// =============================================================
// input.js - キーボード + 固定仮想パッド(タッチ/スマホ標準)
//   パッドは画面左下に固定表示。設定で 表示/非表示/自動 を切替
// =============================================================
'use strict';

const Input = (() => {
  const keys = {};
  const pressedOnce = {};   // 1フレーム限りのキー押下
  let stick = { active:false, id:null, dx:0, dy:0 };
  let padMode = 'on';       // 'on' | 'off' | 'auto'
  let touchedOnce = false;

  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true;
    pressedOnce[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  // Space: 突撃の号令(押した瞬間だけ拾う)
  let sigQueued = false;
  window.addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat) sigQueued = true; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // ---- 固定仮想パッド ----
  const zone = document.getElementById('stick-zone');
  const base = document.getElementById('stick-base');
  const knob = document.getElementById('stick-knob');
  const R = 52;

  function padVisible(){
    return padMode === 'on' || (padMode === 'auto' && touchedOnce);
  }
  function refreshPad(){
    document.body.classList.toggle('pad-visible', padVisible());
  }
  function setPadMode(mode){
    padMode = (mode === 'off' || mode === 'auto') ? mode : 'on';
    refreshPad();
  }
  function getPadMode(){ return padMode; }

  function baseCenter(){
    const r = base.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function stickMove(x, y){
    const c = baseCenter();
    let dx = x - c.x, dy = y - c.y;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    stick.dx = dx / R; stick.dy = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function stickEnd(){
    stick.active = false; stick.id = null; stick.dx = 0; stick.dy = 0;
    knob.style.transform = 'translate(0px, 0px)';
  }

  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (!padVisible()) return;
    const t = e.changedTouches[0];
    if (!stick.active) { stick.active = true; stick.id = t.identifier; stickMove(t.clientX, t.clientY); }
  }, { passive:false });
  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === stick.id) stickMove(t.clientX, t.clientY);
  }, { passive:false });
  const endH = e => { for (const t of e.changedTouches) if (t.identifier === stick.id) stickEnd(); };
  zone.addEventListener('touchend', endH);
  zone.addEventListener('touchcancel', endH);

  // 初回タッチで自動モードのパッドを出す
  window.addEventListener('touchstart', () => {
    if (!touchedOnce) { touchedOnce = true; refreshPad(); }
  }, { passive:true });

  // マウスでもパッド操作可能(PCデバッグ用)
  zone.addEventListener('mousedown', e => {
    if (!padVisible()) return;
    stick.active = true; stick.id = 'mouse'; stickMove(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', e => { if (stick.active && stick.id === 'mouse') stickMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (stick.id === 'mouse') stickEnd(); });

  // 移動ベクトル取得 (-1..1)
  function axis(){
    let x = 0, y = 0;
    if (keys['KeyW'] || keys['ArrowUp']) y -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) y += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) x += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x:x/l, y:y/l }; }
    if (stick.active) return { x: stick.dx, y: stick.dy };
    return { x:0, y:0 };
  }

  function once(code){ const v = !!pressedOnce[code]; pressedOnce[code] = false; return v; }
  function endFrame(){ for (const k in pressedOnce) pressedOnce[k] = false; }

  refreshPad();
  return { takeSig(){ const q = sigQueued; sigQueued = false; return q; }, axis, once, endFrame, keys, setPadMode, getPadMode };
})();
