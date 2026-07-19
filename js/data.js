// =============================================================
// data.js - 全ゲームデータ / バランス定義
// =============================================================
'use strict';

const DATA = {};

// ---------------- 素材 ----------------
// unlock: 魂の広場の研究所で解放しないと世界に出現しない素材
DATA.MATERIALS = {
  jelly:   { name:'スライムゼリー', color:'#7ee787', tier:0 },
  bone:    { name:'骨のかけら',     color:'#e6edf3', tier:0 },
  hide:    { name:'獣の毛皮',       color:'#b08968', tier:0 },
  wood:    { name:'木材',           color:'#8b5a2b', tier:0 },
  scrap:   { name:'鉄クズ',         color:'#9aa5b1', tier:1 },
  crystal: { name:'水晶',           color:'#a5d8ff', tier:1 },
  shell:   { name:'貝殻',           color:'#ffd6a5', tier:1, sea:true },
  magic:   { name:'魔石',           color:'#c084fc', tier:2, unlock:'lab_mat_magic' },
  coral:   { name:'珊瑚',           color:'#ff8fa3', tier:2, sea:true, unlock:'lab_mat_coral' },
  scale:   { name:'竜のうろこ',     color:'#2dd4bf', tier:3, unlock:'lab_mat_scale' },
  star:    { name:'星のかけら',     color:'#fde047', tier:3, unlock:'lab_mat_star' },
  abyss:   { name:'深淵の核',       color:'#a78bfa', tier:4, unlock:'lab_mat_abyss' },
  // 基地で解放する素材(解放するとその系統の魔物が落とすようになる)
  cinder:  { name:'燃え殻',         color:'#ff6b35', tier:2, unlock:'g_ember_mat' },
  iceshard:{ name:'氷晶',           color:'#a5d8ff', tier:2, unlock:'g_frost_mat' },
  soulshard:{ name:'魂片',          color:'#c084fc', tier:2, unlock:'g_bones_mat' },
  relic:    { name:'遺物のかけら',   color:'#9aa5b1', tier:2, unlock:'g_east_sk' },
  dew:      { name:'命の雫',         color:'#7ee787', tier:2, unlock:'g_south_sk' },
  duskveil: { name:'宵の紗',         color:'#f778ba', tier:2, unlock:'g_dusk_sk' },
  stardust: { name:'星屑',           color:'#fde047', tier:3, unlock:'g_star_sk' },
  beastfang:{ name:'獣牙',           color:'#b08968', tier:2, unlock:'g_green_sk' },
  obsidshard:{ name:'黒曜のかけら',  color:'#484f58', tier:3, unlock:'g_black_sk' },
  sunstone: { name:'太陽石',         color:'#d29922', tier:3, unlock:'g_sun_sk' },
  // レア源限定素材(特定のレアモンスター/レアオブジェクトしか落とさない)
  prism:   { name:'虹のかけら',     color:'#e879f9', tier:4 },
  amber:   { name:'太古の琥珀',     color:'#f59e0b', tier:3 },
  pearl:   { name:'真珠',           color:'#f1f5f9', tier:3 },
};

// コスト生成ヘルパ: lv(1〜)に応じて素材要求が増え、高レベルで上位素材が混ざる
// 魔物からドロップする素材の集合(遅延構築)。オブジェクト(木・岩など)からしか
// 出ない素材と要求量の伸び方を分けるために使う
let _foeMats = null;
function foeMats(){
  if (_foeMats) return _foeMats;
  _foeMats = new Set();
  for (const k in DATA.ENEMIES) for (const d of DATA.ENEMIES[k].drops || []) _foeMats.add(d.m);
  return _foeMats;
}
// ティアごとの素材一覧(遅延構築)。レアなオブジェクト/魔物専用の素材は
// 自動要求には使わない(手書きのコストでのみ登場する)
let _tierPool = null;
function tierPool(){
  if (_tierPool) return _tierPool;
  _tierPool = {};
  const skip = { amber:1, pearl:1, prism:1 };
  for (const m in DATA.MATERIALS) {
    if (skip[m]) continue;
    const t = DATA.MATERIALS[m].tier || 0;
    (_tierPool[t] = _tierPool[t] || []).push(m);
  }
  return _tierPool;
}
function matCost(lv, base, extras){
  // base: {mat: qty} lv1時 / extras: [{from: lv, mat, qty}]
  // 魔物素材はレベルごとに約1.6倍へ跳ね上がる(狩りの周回が要る)。
  // オブジェクト素材(木材など)は緩やかに増えるだけ
  const c = {};
  for (const m in base) {
    const mul = foeMats().has(m) ? Math.pow(1.6, lv - 1) : 1 + (lv - 1) * 0.6;
    c[m] = Math.ceil(base[m] * mul);
  }
  if (extras) for (const e of extras) {
    if (lv >= e.from) {
      const mul = foeMats().has(e.mat) ? Math.pow(1.6, lv - e.from) : 1 + (lv - e.from) * 0.5;
      c[e.mat] = Math.ceil(e.qty * mul);
    }
  }
  // レベルの節目ごとに「新しい種類の素材」が要る。高レベルほど高ティア=遠い土地の素材で、
  // どの素材かはスキルごとに固定(素材構成のハッシュで決まる)
  const seed = Object.keys(base).join(',');
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const steps = [[3, 1], [5, 2], [7, 3], [9, 4]];   // [lv節目, 素材ティア]
  for (const [from, tier] of steps) {
    if (lv < from) continue;
    const pool = (tierPool()[tier] || []).filter(m => !(m in c));
    if (!pool.length) continue;
    const m = pool[Math.abs(h + from * 7) % pool.length];
    c[m] = Math.ceil(2 * Math.pow(1.6, lv - from));
  }
  return c;
}

// ---------------- スキル ----------------
// stats(lv) は run.js の各スキル実装が参照する数値群
// lvText[lv-2] = lv へ上げた時の強化説明(レベルごとに違う強化)
DATA.SKILLS = {
  shield: {
    name:'ガーディアンシールド', cat:'sup', icon:'sk_shield',
    desc:'ダメージを1回無効化するバリアを張る。',
    cost:(lv)=>matCost(lv,{bone:5,crystal:3},[{from:2,mat:'shell',qty:3},{from:6,mat:'scale',qty:1}]),
    lvText:['再展開が早くなる','バリア展開時に周囲を弾き飛ばす','ストック+1','再展開がさらに早く','割れた時に爆発ダメージ','ストック+1'],
    stats:(lv)=>({ stocks:1+(lv>=4?1:0)+(lv>=7?1:0), cd:14*(lv>=2?0.75:1)*(lv>=5?0.7:1),
      knock:(lv>=3), burst:(lv>=6?60:0) }),
  },
  sanctuary: {
    name:'サンクチュアリ', cat:'sup', icon:'sk_sanct',
    desc:'自分と仲間のHPを徐々に回復するオーラ。',
    cost:(lv)=>matCost(lv,{jelly:6,shell:2},[{from:2,mat:'magic',qty:2},{from:6,mat:'coral',qty:3}]),
    lvText:['回復量+60%','範囲拡大(仲間に届きやすく)','回復量+60%','オーラ内の敵を微減速','回復量+80%・範囲拡大'],
    stats:(lv)=>({ hps:1.5*Math.pow(1.6,(lv>=2?1:0)+(lv>=4?1:0))*(lv>=6?1.8:1),
      radius:110+(lv>=3?50:0)+(lv>=6?50:0), slow:(lv>=5?0.15:0) }),
  },
  magnetSk: {
    name:'マグネットフィールド', cat:'sup', icon:'sk_magnet',
    desc:'アイテムの回収範囲が広がる。',
    cost:(lv)=>matCost(lv,{scrap:3,jelly:3},[{from:2,mat:'shell',qty:3},{from:5,mat:'magic',qty:2}]),
    lvText:['回収範囲+40%','たまに全画面吸引(30秒毎)','回収範囲+50%','全画面吸引の間隔-10秒'],
    stats:(lv)=>({ mult:1.5+(lv>=2?0.4:0)+(lv>=4?0.5:0), vacuum:(lv>=3), vacuumCd:(lv>=5?20:30) }),
  },
  resonance: {
    name:'共鳴の水晶', cat:'sup', icon:'sk_area',
    desc:'全てのスキルの効果範囲が広がる。',
    cost:(lv)=>matCost(lv,{crystal:5,jelly:4},[{from:2,mat:'magic',qty:2},{from:7,mat:'star',qty:1}]),
    lvText:Array.from({length:9},(_,i)=>`効果範囲+10%(累計${(i+2)*10}%)`),
    stats:(lv)=>({ passive:{ key:'areaMul', value:0.10*lv } }),
  },
  boots: {
    name:'ヘルメスの靴', cat:'sup', icon:'sk_boots',
    desc:'移動速度が上がる。逃げる敵を追いやすくなる。',
    cost:(lv)=>matCost(lv,{hide:4,bone:3},[{from:2,mat:'crystal',qty:3},{from:5,mat:'star',qty:1}]),
    lvText:['移動速度+8%','ダッシュの残像が敵にダメージ','移動速度+10%','移動速度+12%'],
    stats:(lv)=>({ mult:1.1+(lv>=2?0.08:0)+(lv>=4?0.10:0)+(lv>=5?0.12:0), trail:(lv>=3?5:0) }),
  },
  warbanner: {
    name:'ウォーバナー', cat:'ally', icon:'sk_banner',
    desc:'仲間の攻撃力とHPを強化する軍旗。【前提: カリスマの歌 Lv2】',
    requires:{ skill:'charisma', lv:2 },
    cost:(lv)=>matCost(lv,{hide:5,wood:5},[{from:2,mat:'magic',qty:2}]),
    lvText:['仲間攻撃+20%','仲間HP+30%','仲間攻撃+25%','仲間の移動速度+20%','仲間攻撃+35%・HP+35%'],
    stats:(lv)=>({ atk:1.2+(lv>=2?0.2:0)+(lv>=4?0.25:0)+(lv>=6?0.35:0),
      hp:1+(lv>=3?0.3:0)+(lv>=6?0.35:0), spd:(lv>=5?1.2:1) }),
  },
  // ---- 多角スキル: 仲間・敵・武器・経済 ----
  charisma: {
    name:'カリスマの歌', cat:'ally', icon:'sk_charisma',
    desc:'敵が仲間になる確率が上がる。',
    cost:(lv)=>matCost(lv,{jelly:4,hide:4},[{from:2,mat:'crystal',qty:3},{from:7,mat:'star',qty:1}]),
    lvText:['勧誘確率+3%','仲間の全能力+8%','勧誘確率+4%','仲間の全能力+8%','勧誘確率+5%','全能力+8%・確率+6%'],
    stats:(lv)=>({ recruit:0.03+(lv>=2?0.03:0)+(lv>=4?0.04:0)+(lv>=6?0.05:0)+(lv>=7?0.06:0),
      allyMul:Math.pow(1.08,(lv>=3?1:0)+(lv>=5?1:0)+(lv>=7?1:0)) }),
  },
  fear: {
    name:'威圧のオーラ', cat:'foe', icon:'sk_fear',
    desc:'周囲の敵の攻撃力を下げるオーラ。',
    cost:(lv)=>matCost(lv,{bone:5,hide:4},[{from:2,mat:'magic',qty:2},{from:6,mat:'scale',qty:1}]),
    lvText:['弱体化+10%','オーラ範囲拡大','弱体化+5%','弱体化+10%','オーラ範囲拡大','瀕死の敵が逃げ出す'],
    stats:(lv)=>({ radius:50+(lv>=3?45:0)+(lv>=6?65:0),
      reduce:Math.min(0.6, 0.15+(lv>=2?0.10:0)+(lv>=4?0.05:0)+(lv>=5?0.10:0)), flee:(lv>=7) }),
  },
  vampire: {
    name:'吸血の刻印', cat:'sup', icon:'sk_vampire',
    desc:'敵を倒すとHPを吸収する。【前提: サンクチュアリ Lv2】',
    requires:{ skill:'sanctuary', lv:2 },
    cost:(lv)=>matCost(lv,{hide:5,jelly:4},[{from:2,mat:'magic',qty:2},{from:6,mat:'abyss',qty:1}]),
    lvText:['吸収量+2','与ダメージの1%を回復','吸収量+3','与ダメ回復2%に強化','吸収量+5','与ダメ回復3%に強化'],
    stats:(lv)=>({ killHeal:3+(lv>=2?2:0)+(lv>=4?3:0)+(lv>=6?5:0),
      lifesteal:(lv>=3?0.01:0)+(lv>=5?0.01:0)+(lv>=7?0.01:0) }),
  },
  confuse: {
    name:'混沌の瘴気', cat:'foe', icon:'sk_confuse', unlock:'lib_sk_confuse',
    desc:'一定間隔で敵を混乱させ、同士討ちさせる。【要解放】',
    cost:(lv)=>matCost(lv,{magic:3,crystal:5},[{from:2,mat:'star',qty:2}]),
    lvText:['混乱数+1','混乱時間+50%・範囲拡大','混乱数+2','再発動-25%・範囲拡大','混乱数+2・時間さらに+'],
    stats:(lv)=>({ count:2+(lv>=2?1:0)+(lv>=4?2:0)+(lv>=6?2:0),
      dur:3*(lv>=3?1.5:1)*(lv>=6?1.4:1), cd:8*(lv>=5?0.75:1), radius:340+(lv>=3?80:0)+(lv>=5?100:0) }),
  },
  curse: {
    name:'衰弱の呪印', cat:'foe', icon:'sk_curse', unlock:'lib_sk_curse',
    desc:'一定間隔で周囲の敵を呪い、被ダメージ増加+減速。【要解放/前提: 混沌の瘴気 Lv2】',
    requires:{ skill:'confuse', lv:2 },
    cost:(lv)=>matCost(lv,{magic:4,bone:6},[{from:2,mat:'star',qty:1},{from:5,mat:'abyss',qty:1}]),
    lvText:['被ダメ増+10%','減速強化','再発動-25%','被ダメ増+15%','範囲拡大'],
    stats:(lv)=>({ radius:260+(lv>=6?100:0), shred:0.2+(lv>=2?0.1:0)+(lv>=5?0.15:0),
      slow:0.1+(lv>=3?0.15:0), dur:4, cd:6*(lv>=4?0.75:1) }),
  },
  // ---- 魂の広場で解放するスキル ----
  sands: {
    name:'時の砂', cat:'foe', icon:'sk_sands', unlock:'lib_sk_sands',
    desc:'一定間隔で周囲の敵を大きく減速させる。【要解放】',
    cost:(lv)=>matCost(lv,{star:2,magic:6},[{from:2,mat:'abyss',qty:1}]),
    lvText:['減速率アップ','効果時間+50%','範囲拡大','再発動-25%','ほぼ静止級の減速'],
    stats:(lv)=>({ slow:0.4+(lv>=2?0.15:0)+(lv>=6?0.25:0), dur:3*(lv>=3?1.5:1),
      radius:220+(lv>=4?120:0), cd:12*(lv>=5?0.75:1) }),
  },
  ember: {
    name:'火の粉', cat:'foe', icon:'sk_ember', unlock:'g_ember_sk',
    desc:'一定間隔で周囲の敵に火の粉を撒き、炎上させる。【要解放】',
    cost:(lv)=>matCost(lv,{scrap:4,hide:4},[{from:2,mat:'cinder',qty:3}]),
    lvText:['炎上ダメージ+50%','対象+2','再発動-25%','炎上ダメージ+60%','対象+3'],
    stats:(lv)=>({ count:3+(lv>=3?2:0)+(lv>=6?3:0), burn:4*(lv>=2?1.5:1)*(lv>=5?1.6:1),
      dur:3, cd:6*(lv>=4?0.75:1), radius:240 }),
  },
  frostaura: {
    name:'霜のオーラ', cat:'foe', icon:'sk_frostaura', unlock:'g_frost_sk',
    desc:'周囲の敵を絶えず減速させるオーラ。【要解放】',
    cost:(lv)=>matCost(lv,{crystal:4,shell:3},[{from:2,mat:'iceshard',qty:3}]),
    lvText:['減速+10%','範囲拡大','減速+10%','範囲拡大','減速+15%'],
    stats:(lv)=>({ radius:130+(lv>=3?40:0)+(lv>=5?50:0),
      slow:Math.min(0.75, 0.2+(lv>=2?0.1:0)+(lv>=4?0.1:0)+(lv>=6?0.15:0)) }),
  },
  bonewall: {
    name:'骨の呼び声', cat:'ally', icon:'sk_bonecall', unlock:'g_bones_sk',
    desc:'一定間隔で骸骨の仲間を呼び出す。【要解放】',
    cost:(lv)=>matCost(lv,{bone:6,jelly:4},[{from:2,mat:'soulshard',qty:3}]),
    lvText:['召喚間隔-20%','骸骨が強くなる','召喚間隔-20%','骸骨がさらに強く','召喚間隔-25%'],
    stats:(lv)=>({ cd:24*(lv>=2?0.8:1)*(lv>=4?0.8:1)*(lv>=6?0.75:1),
      hpMul:1+(lv>=3?0.8:0)+(lv>=5?1.2:0) }),
  },
  pulse: {
    name:'遺跡の脈動', cat:'foe', icon:'sk_pulse', unlock:'g_east_sk',
    desc:'一定間隔で周囲の敵を弾き飛ばし、短時間停止させる。【要解放】',
    cost:(lv)=>matCost(lv,{crystal:4,scrap:4},[{from:2,mat:'relic',qty:3}]),
    lvText:['停止時間+','範囲拡大','再発動-25%','弾き距離+','停止時間+'],
    stats:(lv)=>({ radius:170+(lv>=3?50:0), cd:9*(lv>=4?0.75:1),
      freeze:0.5+(lv>=2?0.3:0)+(lv>=6?0.4:0), push:70+(lv>=5?40:0) }),
  },
  spring: {
    name:'命の泉水', cat:'sup', icon:'sk_spring', unlock:'g_south_sk',
    desc:'一定間隔で自分と仲間のHPをまとめて回復する。【要解放】',
    cost:(lv)=>matCost(lv,{jelly:5,shell:3},[{from:2,mat:'dew',qty:3}]),
    lvText:['回復量+20','再発動-20%','回復量+30','再発動-25%','回復量+40'],
    stats:(lv)=>({ heal:30+(lv>=2?20:0)+(lv>=4?30:0)+(lv>=6?40:0),
      cd:16*(lv>=3?0.8:1)*(lv>=5?0.75:1) }),
  },
  forgefire: {
    name:'鍛冶の心火', cat:'ally', icon:'sk_forgefire', unlock:'g_west_sk',
    desc:'仲間の近接攻撃が確率で敵を炎上させる。【要解放】',
    cost:(lv)=>matCost(lv,{scrap:5,hide:4},[{from:2,mat:'cinder',qty:3}]),
    lvText:['確率+3%','炎上ダメージ+','確率+4%','炎上ダメージ+','確率+5%'],
    stats:(lv)=>({ chance:0.04+(lv>=2?0.03:0)+(lv>=4?0.04:0)+(lv>=6?0.05:0),
      burn:5+(lv>=3?4:0)+(lv>=5?6:0) }),
  },
  dragonscale: {
    name:'竜鱗の陣', cat:'ally', icon:'sk_dscale', unlock:'g_dragon_sk',
    desc:'仲間が受けるダメージを減らす。【要解放】',
    cost:(lv)=>matCost(lv,{bone:5,hide:5},[{from:2,mat:'scale',qty:1}]),
    lvText:Array.from({length:5},()=>'仲間の被ダメージ-5%'),
    stats:(lv)=>({ res:Math.min(0.5, 0.08+(lv-1)*0.05) }),
  },
  veil: {
    name:'黄昏の帳', cat:'sup', icon:'sk_veil', unlock:'g_dusk_sk',
    desc:'一定間隔で敵の弾をかき消し、周囲の敵の射撃を封じる。【要解放】',
    cost:(lv)=>matCost(lv,{hide:4,crystal:4},[{from:2,mat:'duskveil',qty:3}]),
    lvText:['再発動-20%','封印時間+1秒','封印時間+1秒','再発動-25%','封印時間+1秒'],
    stats:(lv)=>({ seal:2+(lv>=3?1:0)+(lv>=4?1:0)+(lv>=6?1:0),
      cd:12*(lv>=2?0.8:1)*(lv>=5?0.75:1), radius:400 }),
  },
  starluck: {
    name:'星の吉兆', cat:'sup', icon:'sk_starluck', unlock:'g_star_sk',
    desc:'素材が2個落ちる確率が上がる。【要解放】',
    cost:(lv)=>matCost(lv,{crystal:5,bone:4},[{from:2,mat:'stardust',qty:2}]),
    lvText:Array.from({length:9},(_,i)=>`2個ドロップ率+3%(累計${(i+2)*3}%)`),
    stats:(lv)=>({ passive:{ key:'luck2Add', value:0.03*lv } }),
  },
  wildcall: {
    name:'野生の呼び声', cat:'ally', icon:'sk_wildcall', unlock:'g_green_sk',
    desc:'一定間隔で近くの敵1体を仲間に引き入れる。【要解放】',
    cost:(lv)=>matCost(lv,{hide:5,wood:5},[{from:2,mat:'beastfang',qty:3}]),
    lvText:['再発動-15%','ティア2まで仲間化','再発動-20%','ティア4まで仲間化','再発動-25%'],
    stats:(lv)=>({ radius:200, cd:30*(lv>=2?0.85:1)*(lv>=4?0.8:1)*(lv>=6?0.75:1),
      tier:1+(lv>=3?1:0)+(lv>=5?2:0) }),
  },
  beacon: {
    name:'白亜の灯', cat:'sup', icon:'sk_beacon', unlock:'g_white_sk',
    desc:'一定間隔で画面中のアイテムを引き寄せる。【要解放】',
    cost:(lv)=>matCost(lv,{shell:5,crystal:3},[{from:2,mat:'magic',qty:2}]),
    lvText:['再発動-20%','引き寄せが速く','再発動-25%','引き寄せがさらに速く','再発動-30%'],
    stats:(lv)=>({ cd:20*(lv>=2?0.8:1)*(lv>=4?0.75:1)*(lv>=6?0.7:1),
      dur:2-(lv>=3?0.5:0)-(lv>=5?0.5:0) }),
  },
  pact: {
    name:'対価の契約', cat:'sup', icon:'sk_pact', unlock:'g_black_sk',
    desc:'コイン獲得量が増える。【要解放】',
    cost:(lv)=>matCost(lv,{bone:5,scrap:4},[{from:2,mat:'obsidshard',qty:2}]),
    lvText:Array.from({length:9},(_,i)=>`コイン+4%(累計${(i+2)*4}%)`),
    stats:(lv)=>({ passive:{ key:'coinMul', value:0.04*lv } }),
  },
  mistwalk: {
    name:'霧渡り', cat:'sup', icon:'sk_mistwalk', unlock:'g_mist_sk',
    desc:'移動速度が上がる。【要解放】',
    cost:(lv)=>matCost(lv,{jelly:4,crystal:4},[{from:2,mat:'magic',qty:2}]),
    lvText:Array.from({length:9},(_,i)=>`移動速度+2%(累計${(i+2)*2}%)`),
    stats:(lv)=>({ passive:{ key:'speedMul', value:0.02*lv } }),
  },
  forgeguard: {
    name:'神鉄の壁', cat:'ally', icon:'sk_fguard', unlock:'g_forge_sk',
    desc:'仲間の最大HPが上がる。【要解放】',
    cost:(lv)=>matCost(lv,{scrap:6,bone:4},[{from:2,mat:'scale',qty:1}]),
    lvText:Array.from({length:9},(_,i)=>`仲間HP+5%(累計${(i+2)*5}%)`),
    stats:(lv)=>({ passive:{ key:'allyHpMul', value:0.05*lv } }),
  },
  moonrush: {
    requires:{ skill:'boots', lv:2 },
    name:'月光の疾走', cat:'sup', icon:'sk_moonrush', unlock:'g_moon_sk',
    desc:'一定間隔で短時間、自分と仲間が加速する。【要解放】',
    cost:(lv)=>matCost(lv,{crystal:4,hide:4},[{from:2,mat:'stardust',qty:2}]),
    lvText:['持続+1秒','加速+10%','再発動-25%','持続+1.5秒','加速+15%'],
    stats:(lv)=>({ mult:1.25+(lv>=3?0.1:0)+(lv>=6?0.15:0),
      dur:3+(lv>=2?1:0)+(lv>=5?1.5:0), cd:18*(lv>=4?0.75:1) }),
  },
  stormcall: {
    requires:{ skill:'wildcall', lv:2 },
    name:'雷雲の呼び声', cat:'foe', icon:'sk_stormcall', unlock:'g_storm_sk',
    desc:'一定間隔で周囲の敵を感電させ、短時間動きを止める。【要解放】',
    cost:(lv)=>matCost(lv,{scrap:4,crystal:4},[{from:2,mat:'stardust',qty:2}]),
    lvText:['停止時間+','範囲拡大','再発動-25%','停止時間+','再発動-20%'],
    stats:(lv)=>({ radius:200+(lv>=3?60:0), dur:0.8+(lv>=2?0.4:0)+(lv>=5?0.5:0),
      cd:11*(lv>=4?0.75:1)*(lv>=6?0.8:1) }),
  },
  gravemark: {
    name:'墓守の加護', cat:'ally', icon:'sk_gravemark', unlock:'g_grave_sk',
    desc:'倒れた仲間が踏みとどまる確率が上がる。【要解放】',
    cost:(lv)=>matCost(lv,{bone:6,jelly:4},[{from:2,mat:'soulshard',qty:3}]),
    lvText:Array.from({length:9},(_,i)=>`踏みとどまる確率+3%(累計${(i+2)*3}%)`),
    stats:(lv)=>({ passive:{ key:'allyReviveAdd', value:0.03*lv } }),
  },
  sunburst: {
    requires:{ skill:'ember', lv:2 },
    name:'太陽の熱波', cat:'foe', icon:'sk_sunburst', unlock:'g_sun_sk',
    desc:'一定間隔で広範囲の敵をまとめて炎上させる。【要解放】',
    cost:(lv)=>matCost(lv,{bone:5,crystal:5},[{from:2,mat:'sunstone',qty:3}]),
    lvText:['炎上ダメージ+50%','範囲拡大','再発動-25%','炎上ダメージ+50%','範囲拡大'],
    stats:(lv)=>({ radius:280+(lv>=3?80:0)+(lv>=6?80:0), burn:6*(lv>=2?1.5:1)*(lv>=5?1.5:1),
      dur:4, cd:14*(lv>=4?0.75:1) }),
  },
  voidgrip: {
    name:'虚無の引力', cat:'foe', icon:'sk_voidgrip', unlock:'g_void_sk',
    desc:'一定間隔で周囲の敵を自分のそばへ引き寄せる。【要解放】',
    cost:(lv)=>matCost(lv,{magic:4,crystal:4},[{from:2,mat:'abyss',qty:1}]),
    lvText:['範囲拡大','再発動-15%','引きが強く','範囲拡大','再発動-25%'],
    stats:(lv)=>({ radius:260+(lv>=2?80:0)+(lv>=5?80:0), cd:13*(lv>=3?0.85:1)*(lv>=6?0.75:1),
      pull:0.35-(lv>=4?0.1:0) }),
  },
  tidebless: {
    name:'潮汐の恵み', cat:'sup', icon:'sk_spring', unlock:'g_sea_sk',
    desc:'沈み都の潮の力を身に宿し、自然回復が増す。【要解放】',
    cost:(lv)=>matCost(lv,{shell:6,coral:4},[{from:2,mat:'pearl',qty:1}]),
    lvText:Array.from({length:9},(_,i)=>`自然回復+1.0/秒(累計${((i+2)*1.0).toFixed(1)})`),
    stats:(lv)=>({ passive:{ key:'regenAdd', value:0.5*lv } }),
  },
  endpact: {
    name:'終焉の誓い', cat:'ally', icon:'sk_endpact', unlock:'g_end_sk',
    desc:'仲間の攻撃力が上がる。【要解放】',
    cost:(lv)=>matCost(lv,{bone:6,magic:4},[{from:2,mat:'abyss',qty:1}]),
    lvText:Array.from({length:9},(_,i)=>`仲間攻撃+4%(累計${(i+2)*4}%)`),
    stats:(lv)=>({ passive:{ key:'allyAtkMul', value:0.04*lv } }),
  },
  oath: {
    name:'老兵の誓い', icon:'sk_oath', cat:'ally', unlockQuest:'b_north',
    desc:'仲間の攻撃力が上がる。【クエスト報酬】',
    cost:(lv)=>matCost(lv,{bone:6,hide:4},[{from:2,mat:'crystal',qty:4},{from:6,mat:'scale',qty:1}]),
    lvText:Array.from({length:9},(_,i)=>`仲間の攻撃力+5%(累計${(i+2)*5}%)`),
    stats:(lv)=>({ passive:{ key:'allyAtkMul', value:0.05*lv } }),
  },
};
function crystalKey(){ return 'crystal'; }

// ---------------- 攻撃手段(武器) ----------------
// 主人公の攻撃はスキルではなく「攻撃手段」。魂の広場の武器庫でコインで購入・強化し、
// どれか1つを選んで出撃する(切り替え自由)。max = lvText.length + 1
function wcost(base){ return (lv) => Math.round(base * Math.pow(1.6, lv - 1)); }
DATA.WEAPONS = {
  bolt: {
    name:'マジックボルト', icon:'sk_bolt', buy:0, up:wcost(40),
    desc:'最も近い敵へ自動で魔弾を放つ。最初から持っている基本攻撃。',
    lvText:['威力+50%','威力+50%・2連射になる','威力+50%・連射間隔-20%','威力+60%','3連射になる','貫通+1','連射間隔-25%','威力+80%','4連射・弾速アップ'],
    stats:(lv)=>({ dmg:10*Math.pow(1.5,Math.min(lv-1,3))*(lv>=9?1.8:1)*(lv>=5?1.6:1),
      count:1+(lv>=3?1:0)+(lv>=6?1:0)+(lv>=10?1:0),
      cd:0.9*(lv>=4?0.8:1)*(lv>=8?0.75:1), pierce:(lv>=7?1:0), speed:420*(lv>=10?1.3:1) }),
  },
  axe: {
    name:'ブーメランアクス', icon:'sk_axe', buy:150, up:wcost(60),
    desc:'投げた斧が戻ってくる。往復で2回当たる。',
    lvText:['同時投擲+1','威力+65%','飛距離アップ','同時投擲+1','威力+65%','巨大な斧になる(範囲+)'],
    stats:(lv)=>({ dmg:20*Math.pow(1.65,(lv>=3?1:0)+(lv>=6?1:0)), count:1+(lv>=2?1:0)+(lv>=5?1:0),
      cd:2.0, range:260+(lv>=4?90:0), size:14*(lv>=7?1.7:1) }),
  },
  homing: {
    name:'追尾ミサイル', icon:'sk_homing', buy:250, up:wcost(70),
    desc:'敵を追尾する魔法ミサイルを放つ。',
    lvText:['同時発射+1','威力+75%','同時発射+1','追尾性能・弾速アップ','威力+75%','同時発射+2','爆発するようになる'],
    stats:(lv)=>({ dmg:14*Math.pow(1.75,(lv>=3?1:0)+(lv>=6?1:0)), count:1+(lv>=2?1:0)+(lv>=4?1:0)+(lv>=7?2:0),
      cd:1.6, turn:(lv>=5?7:3.5), speed:300*(lv>=5?1.3:1), blast:(lv>=8?70:0) }),
  },
  orbit: {
    name:'オービットオーブ', icon:'sk_orbit', buy:300, up:wcost(75),
    desc:'自分の周囲を回るオーブ。触れた敵にダメージ。',
    lvText:['オーブ+1','回転速度アップ','威力+75%','オーブ+1','範囲(半径)拡大','威力+75%','オーブ+2・巨大化'],
    stats:(lv)=>({ dmg:9*Math.pow(1.75,(lv>=4?1:0)+(lv>=7?1:0)), count:2+(lv>=2?1:0)+(lv>=5?1:0)+(lv>=8?2:0),
      radius:70+(lv>=6?35:0), spin:2+(lv>=3?1.2:0), size:12*(lv>=8?1.5:1) }),
  },
  flame: {
    name:'フレイムリング', icon:'sk_flame', buy:420, up:wcost(85),
    desc:'周囲に炎の波動を放ち、触れた敵を燃やす。',
    lvText:['範囲拡大','延焼ダメージ追加','威力+70%','攻撃間隔-30%','範囲拡大・威力+50%','延焼強化・威力+70%'],
    stats:(lv)=>({ dmg:12*Math.pow(1.7,(lv>=4?1:0))*(lv>=6?1.5:1)*(lv>=7?1.7:1),
      radius:90+(lv>=2?30:0)+(lv>=6?40:0), cd:2.2*(lv>=5?0.7:1), burn:(lv>=3?4:0)*(lv>=7?2.5:1) }),
  },
  nova: {
    name:'フロストノヴァ', icon:'sk_nova', buy:550, up:wcost(90),
    desc:'氷の衝撃波で敵を減速させる。生存の要。',
    lvText:['減速強化','範囲拡大','威力+80%','短時間の凍結付与','攻撃間隔-30%','凍結時間+・威力+80%'],
    stats:(lv)=>({ dmg:8*Math.pow(1.8,(lv>=4?1:0)+(lv>=7?1:0)), radius:120+(lv>=3?50:0),
      slow:0.35+(lv>=2?0.2:0), slowDur:2.5, freeze:(lv>=5?0.6:0)+(lv>=7?0.6:0), cd:3.5*(lv>=6?0.7:1) }),
  },
  chain: {
    name:'チェインライトニング', icon:'sk_chain', buy:700, up:wcost(100),
    desc:'敵から敵へ連鎖する稲妻。集団に強い。',
    lvText:['連鎖+2','威力+60%','連鎖+2','攻撃間隔-25%','威力+60%','連鎖+3・射程アップ'],
    stats:(lv)=>({ dmg:16*Math.pow(1.6,(lv>=3?1:0)+(lv>=6?1:0)), jumps:3+(lv>=2?2:0)+(lv>=4?2:0)+(lv>=7?3:0),
      cd:2.4*(lv>=5?0.75:1), range:240*(lv>=7?1.3:1) }),
  },
  poison: {
    name:'ポイズンミスト', icon:'sk_poison', buy:850, up:wcost(110),
    desc:'移動した跡に毒の霧を残す。触れた敵は継続ダメージ。',
    lvText:['霧が大きくなる','持続時間+50%','毒ダメージ+80%','霧の発生間隔-40%','毒が敵の防御を下げる','毒ダメージ+100%・巨大化'],
    stats:(lv)=>({ dps:6*Math.pow(1.8,(lv>=4?1:0))*(lv>=7?2:1), size:46+(lv>=2?20:0)+(lv>=7?26:0),
      dur:4*(lv>=3?1.5:1), interval:0.55*(lv>=5?0.6:1), shred:(lv>=6?0.25:0) }),
  },
  thunder: {
    name:'サンダーフォール', icon:'sk_thunder', buy:1100, up:wcost(130),
    desc:'ランダムな敵の頭上に落雷。単体高火力。',
    lvText:['落雷数+1','威力+70%','落雷数+1','範囲(爆風)追加','威力+90%','落雷数+2・爆風拡大'],
    stats:(lv)=>({ dmg:36*Math.pow(1.7,(lv>=3?1:0))*(lv>=6?1.9:1), count:1+(lv>=2?1:0)+(lv>=4?1:0)+(lv>=7?2:0),
      cd:2.8, blast:(lv>=5?60:26)*(lv>=7?1.5:1) }),
  },
  turret: {
    name:'オートタレット', icon:'sk_turret', buy:1500, up:wcost(150),
    desc:'その場に自動砲台を設置する。設置数に上限あり。',
    lvText:['設置上限+1','連射速度アップ','威力+70%','設置上限+1','射程アップ','威力+90%・2丁掃射'],
    stats:(lv)=>({ dmg:9*Math.pow(1.7,(lv>=4?1:0))*(lv>=7?1.9:1), maxTurrets:1+(lv>=2?1:0)+(lv>=5?1:0),
      fireCd:0.8*(lv>=3?0.6:1), range:280+(lv>=6?100:0), dual:(lv>=7), placeCd:9, life:20 }),
  },
  laser: {
    name:'プリズムレーザー', icon:'sk_laser', buy:2200, up:wcost(220), requires:{weapon:'bolt', lv:4},
    desc:'貫通する極太レーザーを一直線に放つ。',
    lvText:['威力+70%','照射時間+','2方向に発射','威力+90%','4方向に発射'],
    stats:(lv)=>({ dmg:30*Math.pow(1.7,(lv>=2?1:0))*(lv>=5?1.9:1), cd:4.5, dur:0.6*(lv>=3?1.6:1),
      beams:1+(lv>=4?1:0)+(lv>=6?2:0), width:18 }),
  },
  meteor: {
    name:'メテオストーム', icon:'sk_meteor', buy:4500, up:wcost(350), requires:{weapon:'thunder', lv:3},
    desc:'広範囲に隕石を降らせる大火力の攻撃手段。',
    lvText:['隕石+2','威力+80%','隕石+2','爆発範囲拡大','隕石+3・威力+100%'],
    stats:(lv)=>({ dmg:50*Math.pow(1.8,(lv>=3?1:0))*(lv>=6?2:1), count:3+(lv>=2?2:0)+(lv>=4?2:0)+(lv>=6?3:0),
      cd:6, blast:80*(lv>=5?1.4:1) }),
  },
  prism_ray: {
    name:'虹の奔流', icon:'sk_prism', buy:6000, up:wcost(420), unlockAch:'ach_rare', requires:{weapon:'laser', lv:2},
    desc:'【実績解放】回転する虹の光線が全てを薙ぎ払う。',
    lvText:['威力+70%','光線+1','回転が速くなる','威力+90%','光線+2'],
    stats:(lv)=>({ dmg:40*Math.pow(1.7,(lv>=2?1:0))*(lv>=5?1.9:1), beams:3+(lv>=3?1:0)+(lv>=6?2:0),
      width:14, len:430, spin:0.7*(lv>=4?1.6:1), cd:7 }),
  },
  dragonbreath: {
    name:'ドラゴンブレス', icon:'sk_breath', buy:9000, up:wcost(550), requires:{weapon:'flame', lv:3},
    desc:'移動方向へ焼き尽くす吐息を放つ最強格の攻撃手段。',
    lvText:['威力+70%','範囲(角度)拡大','持続+','威力+90%','超射程・威力+80%'],
    stats:(lv)=>({ dps:35*Math.pow(1.7,(lv>=2?1:0))*(lv>=5?1.9:1)*(lv>=6?1.8:1),
      arc:0.6+(lv>=3?0.35:0), range:170+(lv>=6?130:0), dur:1.4*(lv>=4?1.5:1), cd:5 }),
  },
};

// ---- 「心得」パッシブスキル群: 素材の組み合わせごとに存在する多数の強化 ----
// スキルは仲間(軍勢)主体。主人公の攻撃関連は武器研磨・集中詠唱など一部のみ
// [id, 名前, 効果説明, 効果キー, 1Lvあたりの値, 表示単位, 素材A, 個数A, 素材B, 個数B, カテゴリ]
const PASSIVE_DEFS = [
  // 仲間(軍勢)を育てる心得
  ['p_shepherd','庇護の心得',     '仲間の最大HP',         'allyHpMul',  .08,  '+16%',   'jelly',8,'wood',7, 'ally'],
  ['p_vanguard','先陣の心得',     '仲間の攻撃力',         'allyAtkMul', .06,  '+12%',   'wood',7,'hide',6,  'ally'],
  ['p_warcry',  '鬨の心得',       '仲間の攻撃間隔短縮',   'allyAtkSpdAdd',.03, '+6%',   'hide',7,'bone',6,  'ally'],
  ['p_mend',    '軍医の心得',     '仲間のHP自動回復',     'allyRegenAdd',.04,  '+8%/秒', 'jelly',7,'hide',5,'ally'],
  ['p_stand',   '不倒の心得',     '仲間が倒れても踏みとどまる確率', 'allyReviveAdd', .05, '+10%', 'bone',7,'crystal',5, 'ally'],
  ['p_recruit', '同胞の心得',     '敵が仲間になる確率',   'recruitAdd', .03,  '+6%',    'hide',6,'jelly',6, 'ally'],
  ['p_swift',   '俊足の心得',     '仲間の移動速度',       'allySpeedMul',.04, '+8%',    'hide',6,'wood',6,  'ally'],
  // 主人公のステータスを上げる心得は廃止(強化はしに戻り後のパワーアップのみ)。
  // 仲間強化の心得だけが残る。
];
// レベルが上がると必要素材の種類も変化する。序盤は解放不要の素材だけを使う(陸で採れるものを優先)
const FLUX = ['scrap', 'crystal', 'hide', 'wood', 'bone', 'jelly', 'shell'];
PASSIVE_DEFS.forEach(([id, name, effDesc, key, per, unit, ma, qa, mb, qb, cat], idx) => {
  const avail = FLUX.filter(m => m !== ma && m !== mb);   // 基本素材と重複しないもの
  const flux1 = avail[idx % avail.length];               // lv4から加わる新素材
  const flux2 = avail[(idx + 3) % avail.length];         // lv7からさらに別の素材
  DATA.SKILLS[id] = {
    name, icon: 'sk_' + id, cat: cat || 'kokoroe',
    desc: `【心得】${effDesc} ${unit}/Lv。`,
    cost: (lv) => {
      // 心得は数が多く、安いと中盤に一気に取り切れてしまう。基本素材は1.5倍で
      // 「1周回に数件ずつ」のペースに調整(序盤の主力スキルには影響しない)
      const c = matCost(lv, { [ma]: Math.ceil(qa * 1.5), [mb]: Math.ceil(qb * 1.5) });
      if (lv >= 2) c[flux1] = (c[flux1] || 0) + Math.ceil(1 + (lv - 2) * 0.5);
      if (lv >= 7 && flux2 !== flux1) c[flux2] = (c[flux2] || 0) + Math.ceil(1 + (lv - 7) * 0.5);
      return c;
    },
    lvText: Array.from({ length: 9 }, (_, i) => `${effDesc} ${unit}(累計${i + 2}段)`),
    stats: (lv) => ({ passive: { key, value: per * lv } }),
  };
});

DATA.SKILL_CATS = { sup:'補助', ally:'仲間', foe:'敵干渉', kokoroe:'心得' };
DATA.SKILL_BASE_CAP = 5; // 書庫の上限解放で +1 ずつ(最大10)
DATA.SKILL_CAP_MAX = 10;

// ---------------- 敵 ----------------
// env: land / sea / both, move: chase / kite / wander
// heal: {radius, hps} を持つ敵はヒーラー(kite挙動で距離を保つ)
DATA.ENEMIES = {
  slime:    { name:'スライム',        hp:12,  dmg:6,  speed:10.8,  r:12, tier:0, env:'land', move:'chase', coin:1, sprite:'en_slime',  drops:[{m:'jelly',c:.4},{m:'dew',c:.25}] },
  bat:      { name:'コウモリ',        hp:8,   dmg:5,  speed:18,  r:10, tier:0, env:'both', move:'chase', coin:1, sprite:'en_bat',    drops:[{m:'hide',c:.3},{m:'duskveil',c:.25}] },
  skeleton: { name:'スケルトン',      hp:20,  dmg:9,  speed:12,  r:13, tier:0, env:'land', move:'chase', coin:2, sprite:'en_skel',   drops:[{m:'bone',c:.45}] },
  wolf:     { name:'ウルフ',          hp:26,  dmg:11, speed:22.8,  r:13, tier:1, env:'land', move:'chase', coin:3, sprite:'en_wolf',   drops:[{m:'hide',c:.45},{m:'beastfang',c:.3}] },
  goblin:   { name:'ゴブリン弓兵',    hp:22,  dmg:8,  speed:13.6,  r:12, tier:1, env:'land', move:'chase', ranged:{range:260,cd:2.2,pspeed:60}, coin:3, sprite:'en_goblin', drops:[{m:'wood',c:.35},{m:'scrap',c:.2}] },
  shaman:   { name:'回復シャーマン',  hp:34,  dmg:5,  speed:36, r:13, tier:1, env:'land', move:'kite',  heal:{radius:220,hps:6}, coin:8, sprite:'en_shaman', drops:[{m:'crystal',c:.5},{m:'magic',c:.25}] },
  crab:     { name:'アイアンクラブ',  hp:40,  dmg:10, speed:10,  r:14, tier:1, env:'both', move:'chase', armor:.3, coin:4, sprite:'en_crab',  drops:[{m:'shell',c:.5}] },
  orc:      { name:'オーク',          hp:60,  dmg:16, speed:14.4,  r:16, tier:2, env:'land', move:'chase', coin:5, sprite:'en_orc',    drops:[{m:'hide',c:.4},{m:'scrap',c:.3}] },
  golem:    { name:'ストーンゴーレム',hp:150, dmg:24, speed:8,  r:20, tier:2, env:'land', move:'chase', armor:.4, coin:9, sprite:'en_golem', drops:[{m:'scrap',c:.5},{m:'crystal',c:.3},{m:'relic',c:.35}] },
  wisp:     { name:'ウィスプ',        hp:30,  dmg:13, speed:27.6,  r:10, tier:2, env:'both', move:'chase', coin:5, sprite:'en_wisp',   drops:[{m:'crystal',c:.4},{m:'magic',c:.2},{m:'duskveil',c:.3}] },
  jellyfish:{ name:'クラゲ',          hp:30,  dmg:12, speed:12.8,  r:13, tier:1, env:'sea',  move:'chase', coin:4, sprite:'en_jelly',  drops:[{m:'shell',c:.4},{m:'jelly',c:.3},{m:'dew',c:.3}] },
  shark:    { name:'シャーク',        hp:80,  dmg:20, speed:25.6,  r:16, tier:2, env:'sea',  move:'chase', coin:7, sprite:'en_shark',  drops:[{m:'hide',c:.4},{m:'coral',c:.3}] },
  siren:    { name:'セイレーン',      hp:60,  dmg:8,  speed:37.6, r:13, tier:2, env:'sea',  move:'kite',  heal:{radius:240,hps:12}, coin:14, sprite:'en_siren', drops:[{m:'coral',c:.5},{m:'star',c:.15}] },
  lizard:   { name:'リザードマン',    hp:90,  dmg:20, speed:18,  r:15, tier:2, env:'both', move:'chase', coin:7, sprite:'en_lizard', drops:[{m:'scale',c:.3},{m:'hide',c:.3}] },
  ogre:     { name:'オーガ',          hp:220, dmg:32, speed:12.8,  r:20, tier:3, env:'land', move:'chase', coin:12, sprite:'en_ogre',  drops:[{m:'hide',c:.5},{m:'magic',c:.3}] },
  knight:   { name:'ダークナイト',    hp:280, dmg:36, speed:16,  r:16, tier:3, env:'land', move:'chase', armor:.35, coin:15, sprite:'en_knight', drops:[{m:'scrap',c:.6},{m:'magic',c:.35},{m:'relic',c:.35}] },
  necro:    { name:'ネクロマンサー',  hp:180, dmg:12, speed:38.4, r:14, tier:3, env:'land', move:'kite', heal:{radius:260,hps:25}, coin:25, sprite:'en_necro', drops:[{m:'magic',c:.6},{m:'star',c:.2},{m:'soulshard',c:.4}] },
  serpent:  { name:'シーサーペント',  hp:320, dmg:38, speed:20.8,  r:20, tier:3, env:'sea',  move:'chase', coin:16, sprite:'en_serpent', drops:[{m:'coral',c:.5},{m:'scale',c:.35}] },
  whelp:    { name:'ドラゴンチャイルド', hp:260, dmg:30, speed:20, r:15, tier:3, env:'both', move:'chase', ranged:{range:240,cd:2.5,pspeed:72}, coin:18, sprite:'en_whelp', drops:[{m:'scale',c:.5},{m:'star',c:.2}] },
  dragon:   { name:'エンシェントドラゴン', hp:900, dmg:55, speed:17.6, r:24, tier:4, env:'both', move:'chase', ranged:{range:300,cd:2.2,pspeed:84}, coin:45, sprite:'en_dragon', drops:[{m:'scale',c:.7},{m:'abyss',c:.25}] },
  demon:    { name:'デーモン',        hp:700, dmg:60, speed:20.8,  r:20, tier:4, env:'land', move:'chase', coin:40, sprite:'en_demon', drops:[{m:'magic',c:.6},{m:'abyss',c:.25},{m:'obsidshard',c:.35}] },
  abysslord:{ name:'アビスロード',    hp:1200,dmg:70, speed:18,  r:24, tier:4, env:'sea',  move:'chase', armor:.3, coin:60, sprite:'en_abyss', drops:[{m:'abyss',c:.5},{m:'star',c:.4},{m:'obsidshard',c:.4}] },
  rainbow:  { name:'レインボースライム', hp:40, dmg:0, speed:46.4, r:12, tier:1, env:'both', move:'kite', rare:true, coin:120, sprite:'en_rainbow', drops:[{m:'prism',c:1}] },
  reaper:   { name:'終焉のリーパー',  hp:45000, dmg:160, speed:28.4, r:24, tier:9, env:'both', move:'chase', coin:250, sprite:'en_reaper', isReaper:true, drops:[{m:'abyss',c:.8},{m:'star',c:.8}] },
  // ---- エリート種: 強くて大きい範囲攻撃(スラム)持ち。いるバイオドームといないバイオドームがある ----
  kingslime:  { name:'キングスライム',       hp:180, dmg:18, speed:9,  r:22, tier:2, env:'land', move:'chase', slam:{radius:80, cd:3.5}, coin:12, sprite:'en_kingslime',  drops:[{m:'jelly',c:.8},{m:'crystal',c:.3},{m:'dew',c:.5}] },
  frostgiant: { name:'フロストジャイアント', hp:420, dmg:30, speed:10, r:24, tier:3, env:'land', move:'chase', slam:{radius:95, cd:3.5}, coin:20, sprite:'en_frostgiant', drops:[{m:'crystal',c:.6},{m:'star',c:.25}] },
  magmatitan: { name:'マグマタイタン',       hp:800, dmg:45, speed:9,  r:26, tier:4, env:'land', move:'chase', armor:.3, slam:{radius:105, cd:3.8}, coin:38, sprite:'en_magmatitan', drops:[{m:'scale',c:.5},{m:'abyss',c:.2}] },
  voidtitan:  { name:'虚無の巨像',           hp:1000,dmg:55, speed:10, r:26, tier:4, env:'both', move:'chase', armor:.3, slam:{radius:110, cd:3.5}, coin:50, sprite:'en_voidtitan',  drops:[{m:'abyss',c:.4},{m:'star',c:.3},{m:'relic',c:.4}] },
  // ---- バイオドーム別の敵(既存の描画kindを配色替え。場所ごとに顔ぶれが変わる) ----
  boar:     { name:'イノシシ',        hp:34,  dmg:12, speed:24,   r:14, tier:1, env:'land', move:'chase', coin:3, sprite:'en_boar',    drops:[{m:'hide',c:.5},{m:'wood',c:.2},{m:'beastfang',c:.3}] },
  mush:     { name:'マイコニド',      hp:26,  dmg:8,  speed:11,   r:12, tier:1, env:'land', move:'chase', coin:3, sprite:'en_mush',    drops:[{m:'jelly',c:.4},{m:'wood',c:.3},{m:'dew',c:.35}] },
  iceslime: { name:'アイススライム',  hp:16,  dmg:7,  speed:10,   r:12, tier:0, env:'land', move:'chase', coin:2, sprite:'en_iceslime',drops:[{m:'crystal',c:.35},{m:'iceshard',c:.35}] },
  frostwolf:{ name:'フロストウルフ',  hp:40,  dmg:14, speed:23,   r:13, tier:2, env:'land', move:'chase', coin:5, sprite:'en_frostwolf',drops:[{m:'crystal',c:.4},{m:'hide',c:.3},{m:'iceshard',c:.35},{m:'beastfang',c:.3}] },
  yeti:     { name:'イエティ',        hp:240, dmg:30, speed:12,   r:20, tier:3, env:'land', move:'chase', coin:13, sprite:'en_yeti',   drops:[{m:'crystal',c:.5},{m:'star',c:.2},{m:'iceshard',c:.5}] },
  icewisp:  { name:'アイスウィスプ',  hp:34,  dmg:13, speed:27,   r:10, tier:2, env:'both', move:'chase', coin:6, sprite:'en_icewisp', drops:[{m:'crystal',c:.4},{m:'star',c:.15},{m:'stardust',c:.3}] },
  lavaslime:{ name:'ラヴァスライム',  hp:30,  dmg:11, speed:11,   r:13, tier:1, env:'land', move:'chase', coin:4, sprite:'en_lavaslime',drops:[{m:'scrap',c:.35},{m:'scale',c:.12},{m:'cinder',c:.35}] },
  emberbat: { name:'エンバーバット',  hp:16,  dmg:9,  speed:22,   r:10, tier:1, env:'both', move:'chase', coin:3, sprite:'en_emberbat',drops:[{m:'hide',c:.3},{m:'scrap',c:.2},{m:'cinder',c:.3}] },
  fireimp:  { name:'ファイアインプ',  hp:70,  dmg:18, speed:24,   r:12, tier:2, env:'land', move:'chase', ranged:{range:230,cd:2.4,pspeed:66}, coin:7, sprite:'en_fireimp', drops:[{m:'magic',c:.35},{m:'scale',c:.2},{m:'cinder',c:.4}] },
  magmagolem:{name:'マグマゴーレム',  hp:300, dmg:34, speed:8,    r:20, tier:3, env:'land', move:'chase', armor:.4, coin:15, sprite:'en_magmagolem',drops:[{m:'scrap',c:.55},{m:'scale',c:.35},{m:'relic',c:.3}] },
  scarab:   { name:'スカラベ',        hp:38,  dmg:10, speed:16,   r:12, tier:1, env:'land', move:'chase', armor:.25, coin:4, sprite:'en_scarab', drops:[{m:'crystal',c:.35},{m:'bone',c:.3},{m:'sunstone',c:.35}] },
  mummy:    { name:'マミー',          hp:95,  dmg:19, speed:11,   r:15, tier:2, env:'land', move:'chase', coin:7, sprite:'en_mummy',   drops:[{m:'bone',c:.5},{m:'hide',c:.3},{m:'soulshard',c:.35},{m:'sunstone',c:.3}] },
  sandwurm: { name:'サンドワーム',    hp:280, dmg:34, speed:19,   r:20, tier:3, env:'land', move:'chase', coin:14, sprite:'en_sandwurm',drops:[{m:'bone',c:.4},{m:'scale',c:.3},{m:'sunstone',c:.45}] },
  shade:    { name:'シェイド',        hp:70,  dmg:16, speed:28,   r:12, tier:2, env:'both', move:'chase', coin:6, sprite:'en_shade',   drops:[{m:'magic',c:.4},{m:'soulshard',c:.35},{m:'duskveil',c:.3}] },
  voidwisp: { name:'ヴォイドウィスプ',hp:200, dmg:28, speed:30,   r:12, tier:3, env:'both', move:'chase', coin:16, sprite:'en_voidwisp',drops:[{m:'magic',c:.5},{m:'abyss',c:.2},{m:'stardust',c:.35}] },
  hornedimp:{ name:'ホーンドデーモン',hp:320, dmg:40, speed:21,   r:18, tier:3, env:'land', move:'chase', coin:16, sprite:'en_hornedimp',drops:[{m:'magic',c:.45},{m:'abyss',c:.25},{m:'obsidshard',c:.35}] },
  stormwisp:{ name:'ストームウィスプ',hp:66,  dmg:15, speed:32,   r:10, tier:2, env:'both', move:'chase', ranged:{range:250,cd:2.6,pspeed:76}, coin:6, sprite:'en_stormwisp',drops:[{m:'scrap',c:.4},{m:'star',c:.15},{m:'stardust',c:.35}] },
  galehound:{ name:'ゲイルハウンド',  hp:78,  dmg:18, speed:30,   r:13, tier:2, env:'land', move:'chase', coin:6, sprite:'en_galehound',drops:[{m:'hide',c:.4},{m:'star',c:.12},{m:'beastfang',c:.35}] },
};

// バイオームごとの陸の敵プール(場所ごとに顔ぶれが変わる)。海は別プール。
// 各プールは低ティア〜高ティアを含み、その場所の allowedTier で絞られる。
DATA.BIOME_FAUNA = {
  grass:   ['slime','bat','skeleton','wolf','goblin','boar','orc','mush','kingslime'],   // bat=序盤(ティア0)の毛皮源
  jungle:  ['slime','wolf','boar','mush','lizard','orc','ogre','kingslime'],
  mist:    ['bat','wisp','galehound','stormwisp','wolf','shade'],
  chalk:   ['skeleton','scarab','crab','mummy','knight'],
  bones:   ['skeleton','mummy','orc','scarab','sandwurm','knight'],
  desert:  ['skeleton','scarab','mummy','lizard','sandwurm'],
  storm:   ['bat','stormwisp','galehound','wisp','knight','voidwisp'],
  frost:   ['iceslime','frostwolf','icewisp','wolf','yeti','frostgiant'],
  moon:    ['icewisp','wisp','shade','stormwisp','voidwisp','frostgiant'],
  twilight:['wisp','shade','shaman','necro','voidwisp'],
  obsidian:['skeleton','knight','shade','golem','hornedimp'],
  volcano: ['lavaslime','emberbat','fireimp','lizard','whelp','magmatitan'],
  magma:   ['lavaslime','fireimp','emberbat','magmagolem','demon','magmatitan'],
  makai:   ['shade','necro','fireimp','hornedimp','demon'],
  void:    ['voidwisp','shade','hornedimp','demon','abysslord','voidtitan'],
  end:     ['hornedimp','voidwisp','demon','dragon','abysslord','voidtitan'],
};
DATA.SEA_FAUNA = ['jellyfish','crab','shark','siren','icewisp','serpent','shade','whelp','abysslord'];

// ---- 海域バイオーム: 海もバイオドームと同じ区画で環境が変わる ----
// (同じセル割りを使うので、陸のバイオドームと同様に約1分ごとに海域も移り変わる)
DATA.SEA_BIOMES = {
  coral: { name:'珊瑚の海',   c1:'#1a4a72', c2:'#1c507c', d1:'#123458', d2:'#143a60', mm:[26,74,114],
           fauna:['jellyfish','crab','siren','shark'] },
  open:  { name:'蒼海',       c1:'#173a66', c2:'#194070', d1:'#0e2647', d2:'#102a4e', mm:[22,50,92],
           fauna:['shark','jellyfish','serpent','whelp'] },
  ice:   { name:'凍てつく海', c1:'#2a5578', c2:'#2d5b80', d1:'#1c3c58', d2:'#1e4260', mm:[42,74,110],
           fauna:['icewisp','shark','serpent','stormwisp'] },
  storm: { name:'嵐の海',     c1:'#20455c', c2:'#224a62', d1:'#142e40', d2:'#163246', mm:[32,58,84],
           fauna:['stormwisp','serpent','shark','whelp'] },
  abyss: { name:'深淵の海',   c1:'#1b2352', c2:'#1d265a', d1:'#101538', d2:'#12183e', mm:[20,26,64],
           fauna:['shade','abysslord','serpent','voidwisp'] },
};
// バイオドームの陸バイオーム → 対応する海域
DATA.SEA_OF = {
  grass:'coral', jungle:'coral', desert:'coral', chalk:'coral',
  mist:'open', bones:'open', twilight:'open', volcano:'open',
  frost:'ice', moon:'ice', storm:'storm',
  obsidian:'abyss', magma:'abyss', makai:'abyss', void:'abyss', end:'abyss',
};

// ボス: minute = 出現時刻(分)
DATA.BOSSES = [
  { at:5,  base:'golem',   name:'巨壁のゴーレム',   hpMul:14, dmgMul:1.6, coin:80,  sprite:'boss_golem' },
  { at:10, base:'wolf',    name:'牙王フェンリル',   hpMul:90, dmgMul:2.2, coin:150, sprite:'boss_fenrir' },
  { at:15, base:'necro',   name:'冥府公リッチ',     hpMul:45, dmgMul:2.5, coin:250, sprite:'boss_lich' },
  { at:20, base:'serpent', name:'海淵のリヴァイア', hpMul:40, dmgMul:2.5, coin:350, sprite:'boss_levia' },
  { at:25, base:'demon',   name:'魔王グリモワール', hpMul:35, dmgMul:2.8, coin:500, sprite:'boss_demon' },
];

// ---------------- 世界 ----------------
// 多重リング構造: 初期大陸 → 第1環(~10,000) → 中間の小島(~17,000)
//   → 第2環(~26,000) → 第3環(~52,000) → 最果て(~80,000)
// 遠環は死に戻り強化(健脚・帆・ワープゲート)を重ねないと到達できない距離
// biome=見た目, lobes=岬の数, amp=海岸線の凹凸, sx/sy=伸縮(多様な形)
// 陸地は大小さまざま。大きな大陸には複数の拠点があり、
// 一つしか拠点のない陸地(小島・遠環の特別な地)は例外的な存在。
// バイオドーム(約1分ごとの環境変化)と危険度(距離リング)は大陸と独立に保たれる。
// 実際の大陸のパターンを模す: 輪郭はなだらか+質量の偏り(taper)+小スケールの凹凸。
// 大陸間の海は狭め(短い航海で渡れる)、海路の途中には無人の小島が浮かぶ。
// 始まりの大陸は大陸群の南西寄り ― 世界はそこから北東へ広がっていく。
DATA.CONTINENTS = [
  // 南に泉の入り江、北西に岬を持つ島
  { id:'main',  x:0, y:0, r:26000, seed:11, name:'始まりの大陸', biome:'grass', lobes:5, amp:0.15, sx:1.15, sy:0.95,
    taper:{ a:1.7, d:0.08 },
    coast:[{ a:1.72, w:0.4, d:-0.24 }, { a:-2.2, w:0.35, d:0.2 }] },
  // --- 大きな大陸(拠点が複数ある。複数の板の合成で、円盤ではない形になる) ---
  // 竜骨: 東の隣人。西の広い頭から、北東へ弓なりに細る竜の背
  { id:'east', x:160000, y:-15000, seed:23, name:'竜骨の大陸', biome:'volcano', lobes:6, amp:0.15, r:66000,
    parts:[
      { dx:-58000, dy:20000,  r:37000, sx:1.2,  sy:0.9,  rot:-0.2,  lobes:5, amp:0.15 },
      { dx:-4000,  dy:-4000,  r:33000, sx:1.25, sy:0.85, rot:-0.35, lobes:6, amp:0.15 },
      { dx:44000,  dy:-26000, r:27000, sx:1.25, sy:0.8,  rot:-0.45, lobes:6, amp:0.16 },
      { dx:82000,  dy:-46000, r:20000, sx:1.3,  sy:0.7,  rot:-0.5,  lobes:4, amp:0.17 },
    ] },
  // 黄昏: 西の隣人。北の湾を抱く三日月の弧
  { id:'west', x:-95000, y:95000, seed:37, name:'黄昏の大陸', biome:'twilight', lobes:6, amp:0.16, r:54000,
    parts:[
      { dx:35000,  dy:-8000,  r:29000, sx:1.0,  sy:1.0,  rot:0.3,  lobes:5, amp:0.16 },
      { dx:5000,   dy:22000,  r:32000, sx:1.2,  sy:0.85, rot:0.15, lobes:6, amp:0.15 },
      { dx:-40000, dy:12000,  r:29000, sx:1.05, sy:0.95, rot:0.4,  lobes:7, amp:0.16 },
      { dx:-66000, dy:-10000, r:23000, sx:0.95, sy:1.05, rot:0.45, lobes:5, amp:0.17 },
    ] },
  // 星嵐: 北の隣人。南北二つの膨らみを細いくびれが繋ぐ
  { id:'north', x:150000, y:-160000, seed:41, name:'星嵐の大陸', biome:'frost', lobes:6, amp:0.16, r:58000,
    parts:[
      { dx:-12000, dy:52000,  r:28000, sx:1.1,  sy:0.9,  rot:0.1,  lobes:5, amp:0.16 },
      { dx:1000,   dy:6000,   r:24000, sx:0.95, sy:1.15, rot:0.05, lobes:6, amp:0.16 },
      { dx:15000,  dy:-48000, r:30000, sx:1.05, sy:1.05, rot:0.2,  lobes:6, amp:0.15 },
    ] },
  // 深緑: 南の隣人。広い胴から南西へ垂れる房と、東へ突き出す岬
  { id:'south', x:55000, y:90000, seed:53, name:'深緑の大陸', biome:'jungle', lobes:7, amp:0.15, r:54000,
    parts:[
      { dx:-8000,  dy:-32000, r:26000, sx:1.15, sy:0.9,  rot:-0.1, lobes:6, amp:0.15 },
      { dx:-25000, dy:15000,  r:33000, sx:1.15, sy:1.0,  rot:-0.3, lobes:7, amp:0.15 },
      { dx:-38000, dy:48000,  r:26000, sx:1.05, sy:0.95, rot:-0.2, lobes:5, amp:0.16 },
      { dx:24000,  dy:6000,   r:18000, sx:1.2,  sy:0.8,  rot:0.2,  lobes:4, amp:0.17 },
    ] },
  // --- 拠点のある小島(一拠点だけの特別な土地。小さいぶん海岸はごつごつ) ---
  { id:'i_mist',  x:95000, y:-60000, r:9500,  seed:83,  name:'霧の小島',       biome:'mist',    lobes:3, amp:0.3, sx:1.25, sy:0.75, rot:0.6 },
  { id:'i_ember', x:105000, y:115000,  r:10000, seed:97,  name:'燃えさしの小島', biome:'volcano', lobes:6, amp:0.2,
    coast:[{ a:1.5, w:0.4, d:0.3 }] },   // 南へ溶岩流の舌
  { id:'i_frost', x:45000, y:-170000, r:8500,  seed:101, name:'霜の小島',       biome:'frost',   lobes:5, amp:0.3, sx:0.55, sy:1.5, rot:-0.5 },
  // --- 遠環の大陸(一つの拠点だけが立つ、特別な地) ---
  // 太陽: 東西二枚の板が繋がった、横に広い平らな砂の大地
  { id:'r3_sun', x:330000, y:-115000, seed:127, name:'太陽の大陸', biome:'desert', lobes:3, amp:0.12, r:36000,
    parts:[
      { dx:-28000, dy:5000,  r:25000, sx:1.5, sy:0.6,  lobes:3, amp:0.12 },
      { dx:24000,  dy:-8000, r:23000, sx:1.4, sy:0.65, rot:0.1, lobes:4, amp:0.13 },
    ] },
  // 虚無: 対角の二枚がかろうじて繋がる、砕けかけた形
  { id:'r3_void', x:-230000, y:130000, seed:131, name:'虚無の大陸', biome:'void', lobes:8, amp:0.25, r:30000,
    parts:[
      { dx:-9000,  dy:-10000, r:20000, sx:0.95, sy:1.15, rot:0.8, lobes:8, amp:0.22 },
      { dx:10000,  dy:12000,  r:18000, sx:1.05, sy:0.95, rot:0.6, lobes:7, amp:0.22 },
    ] },
  // 最果て: 牙のような板が寄り集まった禍々しい群島大陸
  { id:'r4_end', x:95000, y:-380000, seed:137, name:'最果ての大陸', biome:'end', lobes:9, amp:0.28, r:30000,
    parts:[
      { dx:-13000, dy:4000,   r:20000, lobes:8, amp:0.22 },
      { dx:10000,  dy:-10000, r:22000, lobes:9, amp:0.22 },
      { dx:15000,  dy:12000,  r:17000, lobes:7, amp:0.24 },
    ] },
  // --- 無人の小島(海路の景色。拠点はない) ---
  { id:'sk1', x:52000,   y:-30000,  r:4500, seed:141, name:'岩礁の小島', biome:'grass',  lobes:4, amp:0.35 },
  { id:'sk2', x:-32000,  y:56000,   r:5000, seed:143, name:'風待ちの小島', biome:'grass', lobes:5, amp:0.3 },
  { id:'sk3', x:268000,  y:-92000,  r:5500, seed:149, name:'陽炎の小島', biome:'desert', lobes:4, amp:0.35 },
  { id:'sk4', x:-186000, y:112000,  r:5000, seed:151, name:'宵の小島',   biome:'twilight', lobes:4, amp:0.3 },
  { id:'sk5', x:120000,  y:-280000, r:5000, seed:157, name:'白夜の小島', biome:'frost',  lobes:5, amp:0.35 },
  { id:'sk6', x:10000,   y:-92000,  r:4500, seed:163, name:'黄昏れの岩礁', biome:'bones', lobes:4, amp:0.4 },
  // --- 夕凪の群島(北西の海。人は住まないが、魔物と素材の獲れる漁場) ---
  { id:'nw1', x:-85000,  y:-65000,  r:12000, seed:167, name:'夕凪の島',   biome:'grass',    lobes:5, amp:0.2, sx:1.25, sy:0.85, rot:0.4 },
  { id:'nw2', x:-130000, y:-105000, r:7000,  seed:173, name:'夕凪の小島', biome:'mist',     lobes:4, amp:0.3 },
  { id:'nw3', x:-55000,  y:-115000, r:5000,  seed:179, name:'茜の岩礁',   biome:'chalk',    lobes:4, amp:0.35 },
  { id:'nw4', x:-165000, y:-55000,  r:6000,  seed:181, name:'残照の小島', biome:'twilight', lobes:5, amp:0.3 },
  // --- 環礁(海底都市「沈み都」の入り口が立つ、海のただ中の小さな輪) ---
  { id:'i_sea', x:-95000, y:-180000, r:4200, seed:191, name:'沈み都の環礁', biome:'chalk', lobes:6, amp:0.22 },
];

// バイオーム: エリアごとのフィールドの見た目(地面2色/砂浜2色/装飾色/ミニマップ色)
DATA.BIOMES = {
  grass:   { mats:['jelly','wood'], g1:'#274d33', g2:'#2a5237', s1:'#8a7a50', s2:'#93835a', deco:['#3fb950','#f0883e','#e6edf3'], mm:[46,100,60],   name:'草原' },
  volcano: { mats:['scale','hide'], g1:'#3a2018', g2:'#41251b', s1:'#5c3a28', s2:'#64412e', deco:['#f85149','#ffa657','#484f58'], mm:[90,45,35],    name:'灼熱地帯' },
  magma:   { mats:['scrap','scale'], g1:'#451510', g2:'#4d1a12', s1:'#6b2c1a', s2:'#733220', deco:['#ff6b35','#fde047','#8b1e24'], mm:[110,40,25],   name:'溶岩地帯' },
  desert:  { mats:['bone','crystal'], g1:'#8a6d35', g2:'#93763c', s1:'#a8894a', s2:'#b09252', deco:['#d29922','#57ab5a','#e6edf3'], mm:[150,120,70],  name:'砂漠' },
  makai:   { mats:['magic','bone'], g1:'#2a1a3d', g2:'#2f1f44', s1:'#463059', s2:'#4d3661', deco:['#c084fc','#f85149','#6e40c9'], mm:[60,40,90],    name:'魔界' },
  void:    { mats:['abyss','magic'], g1:'#1a1028', g2:'#1f142e', s1:'#33244a', s2:'#3a2a52', deco:['#a78bfa','#76e3ea','#0d1117'], mm:[40,28,64],    name:'虚無' },
  twilight:{ mats:['magic','crystal'], g1:'#3d2f42', g2:'#443548', s1:'#5c4a5e', s2:'#645166', deco:['#f778ba','#d2a8ff','#8b949e'], mm:[85,68,92],    name:'黄昏' },
  jungle:  { mats:['wood','hide'], g1:'#1a3d22', g2:'#1e4527', s1:'#6b6b35', s2:'#73733c', deco:['#7ee787','#ff8fa3','#2ea043'], mm:[30,85,42],    name:'密林' },
  frost:   { mats:['crystal','star'], g1:'#5a7585', g2:'#617d8e', s1:'#8fa8b5', s2:'#97b0bd', deco:['#e6edf3','#a5d8ff','#76e3ea'], mm:[130,165,180], name:'氷原' },
  chalk:   { mats:['bone','shell'], g1:'#8f8a78', g2:'#979282', s1:'#b0a890', s2:'#b8b098', deco:['#e6edf3','#d29922','#8b949e'], mm:[170,165,150], name:'白亜' },
  obsidian:{ mats:['scrap','magic'], g1:'#1c2126', g2:'#20262c', s1:'#333c44', s2:'#3a434c', deco:['#2dd4bf','#484f58','#76e3ea'], mm:[38,45,52],    name:'黒曜' },
  mist:    { mats:['crystal','jelly'], g1:'#4a5548', g2:'#515d4f', s1:'#6e7a6a', s2:'#758271', deco:['#8b949e','#a5d8ff','#57ab5a'], mm:[95,108,95],   name:'霧' },
  bones:   { mats:['bone','hide'], g1:'#6e6656', g2:'#766e5d', s1:'#8f8570', s2:'#978d78', deco:['#e6edf3','#b08968','#8b949e'], mm:[130,122,105], name:'骨の荒野' },
  moon:    { mats:['star','crystal'], g1:'#1e2645', g2:'#232c4e', s1:'#3a4468', s2:'#414b70', deco:['#a5d8ff','#f1f5f9','#58a6ff'], mm:[45,55,95],    name:'月影' },
  storm:   { mats:['scrap','star'], g1:'#37413a', g2:'#3d4840', s1:'#5a655c', s2:'#616c63', deco:['#fde047','#8b949e','#76e3ea'], mm:[75,88,80],    name:'嵐の平原' },
  end:     { mats:['abyss','star'], g1:'#2d0f14', g2:'#331217', s1:'#4d1f26', s2:'#54242c', deco:['#f85149','#0d1117','#ffd766'], mm:[75,25,32],    name:'終焉' },
};

// 基地: unlock条件=8秒チャネリング。解放するとワープ出撃+専用強化が開く
DATA.BASES = [
  // 始まりの大陸(最初の目標。足が遅いうちはここまでも命がけ)
  { id:'b_north', name:'北の砦',     x:400,    y:-8500,  cont:'main', kind:'砦の村', spr:'base_fort', danger:0 },
  { id:'b_east',  name:'東の遺跡',   x:10500,  y:5200,   cont:'main', kind:'学術都市', spr:'base_academy', danger:1 },
  { id:'b_south', name:'南の泉',     x:-2200,  y:12500,  cont:'main', kind:'巡礼の村', spr:'base_spring', danger:1 },
  { id:'b_west',  name:'西の炉',     x:-14500, y:-3000,  cont:'main', kind:'鍛冶の街', spr:'base_forge', danger:2 },
  // 竜骨の大陸(東北東の大きな大陸): 西岸→北岸→東端へと危険度が上がる
  { id:'b_dragon',name:'竜骨の前哨', x:102000,  y:5000,   cont:'east', kind:'狩人の集落', spr:'base_lodge', danger:4 },
  { id:'b_white', name:'白亜の灯台', x:206000,  y:-43000, cont:'east', kind:'港街', spr:'base_port', danger:6 },
  { id:'b_forge', name:'鍛冶神の工房', x:240000, y:-60000,  cont:'east', kind:'工房都市', spr:'base_factory', danger:8 },
  // 黄昏の大陸(西南西の大きな大陸): 東岸から奥地へ4つの拠点が連なる
  { id:'b_dusk',  name:'黄昏の前哨', x:-60000,  y:87000,  cont:'west', kind:'詩人の隠れ里', spr:'base_poet', danger:4 },
  { id:'b_black', name:'黒曜の祠',   x:-90000,  y:117000, cont:'west', kind:'祠の村', spr:'base_shrine', danger:6 },
  { id:'b_bones', name:'骨の祭場',   x:-135000, y:107000, cont:'west', kind:'野営地', spr:'base_camp', danger:7 },
  { id:'b_moon',  name:'月影の社',   x:-161000, y:85000,  cont:'west', kind:'月の修道院', spr:'base_abbey', danger:8 },
  // 星嵐の大陸(北北東の縦長の大陸): 南岸の星見の村から北端の嵐の塔まで
  { id:'b_star',  name:'星降りの祭壇', x:138000, y:-108000, cont:'north', kind:'星見の村', spr:'base_star', danger:5 },
  { id:'b_storm', name:'嵐の塔',     x:165000,  y:-206000, cont:'north', kind:'塔の街', spr:'base_tower', danger:9 },
  // 深緑の大陸(南南西の縦長の大陸): 北岸の社から南端の弔いの村まで
  { id:'b_green', name:'深緑の社',   x:47000,   y:58000,  cont:'south', kind:'森の集落', spr:'base_grove', danger:3 },
  { id:'b_grave', name:'墓標の祭壇', x:17000,   y:138000, cont:'south', kind:'弔いの村', spr:'base_grave', danger:7 },
  // 小島(一拠点だけの特別な土地)
  { id:'b_mist',  name:'霧の観測所', x:95000,   y:-60000, cont:'i_mist', kind:'観測の村', spr:'base_mist', danger:5 },
  { id:'b_ember', name:'燃えさしの炉', x:105000, y:115000, cont:'i_ember', kind:'火の民の村', spr:'base_ember', danger:5 },
  { id:'b_frost', name:'霜の祠',     x:45000,   y:-170000, cont:'i_frost', kind:'氷の隠れ里', spr:'base_frost', danger:7 },
  // 遠環の特別な地(一拠点のみ)
  { id:'b_sun',   name:'太陽の神殿', x:305000,  y:-110000, cont:'r3_sun', kind:'神殿都市', spr:'base_temple', danger:10 },
  { id:'b_void',  name:'虚無の門',   x:-239000, y:120000, cont:'r3_void', kind:'隠者の庵', spr:'base_hermit', danger:10 },
  // 海のただ中(環礁の下に沈んだ都)
  { id:'b_sea',   name:'沈み都',     x:-95000,  y:-180000, cont:'i_sea', kind:'海底都市', spr:'base_sunken', danger:8 },
  // 最果て
  { id:'b_end',   name:'最果ての碑', x:85000,   y:-378000, cont:'r4_end', kind:'最果ての城', spr:'base_castle', danger:12 },
];

// 港: 始まりの大陸の沿岸8方位。ship修理条件は港ごとに異なる
DATA.PORTS = [
  { id:'p_e',  name:'東の港町',   angle:0,           repair:{ coins:150,  mats:{wood:15, scrap:8} } },
  { id:'p_ne', name:'北東の港町', angle:-Math.PI/4,  repair:{ coins:300,  mats:{wood:20, scrap:12, shell:6} } },
  { id:'p_n',  name:'北の港町',   angle:-Math.PI/2,  repair:{ coins:500,  mats:{wood:25, crystal:10, shell:10} } },
  { id:'p_nw', name:'北西の港町', angle:-Math.PI*3/4,repair:{ coins:800,  mats:{wood:30, scrap:20, magic:5} } },
  { id:'p_w',  name:'西の港町',   angle:Math.PI,     repair:{ coins:1200, mats:{wood:35, crystal:15, magic:8} } },
  { id:'p_sw', name:'南西の港町', angle:Math.PI*3/4, repair:{ coins:1800, mats:{wood:40, shell:20, coral:6} } },
  { id:'p_s',  name:'南の港町',   angle:Math.PI/2,   repair:{ coins:2500, mats:{wood:50, coral:10, scale:3} } },
  { id:'p_se', name:'南東の港町', angle:Math.PI/4,   repair:{ coins:4000, mats:{wood:60, scale:6, star:3} } },
];

// ---------------- 魂の広場(死後フィールド)の恒久強化 ----------------
// cost(lv): 次のレベルの金額 (lv=現在Lv, 0開始)
function gcost(base, growth){ return (lv)=>Math.floor(base*Math.pow(growth,lv)); }

DATA.META = {
  // --- 強化の祭壇(戦闘) ---
  altar_hp:     { st:'altar', name:'生命力',       desc:'最大HP +20(Lv15で「死線の護り」: 周回1回、致死をHP1で耐える)',            max:40, cost:gcost(15,1.32),  },
  altar_atk:    { st:'altar', name:'攻撃力',       desc:'全ダメージ +8%',        max:40, cost:gcost(20,1.34),  },
  altar_speed:  { st:'altar', name:'健脚',         desc:'移動速度 +4%', max:25, cost:gcost(30,1.42), },
  altar_regen:  { st:'altar', name:'自然治癒',     desc:'HP自動回復 +0.5/秒',    max:20, cost:gcost(40,1.42),  },
  altar_armor:  { st:'altar', name:'鉄の皮膚',     desc:'被ダメージ -2%(最大60%)', max:30, cost:gcost(35,1.4) },
  altar_crit:   { st:'altar', name:'会心の心得',   desc:'クリティカル率 +2%(2倍ダメージ)', max:25, cost:gcost(50,1.42) },
  altar_range:  { st:'altar', name:'眼力',         desc:'攻撃の射程 +4%',        max:20, cost:gcost(40,1.4) },
  altar_revive: { st:'altar', name:'不死鳥の羽',   desc:'周回中に1回復活(HP50%)', max:3,  cost:gcost(3000,6) },
  // --- 素材研究所(経済) ---
  lab_drop:     { st:'lab', name:'採集の心得',     desc:'素材ドロップ率 +10%',   max:30, cost:gcost(25,1.36) },
  lab_coin:     { st:'lab', name:'金運',           desc:'コイン獲得量 +10%',     max:30, cost:gcost(25,1.36) },
  lab_magnet:   { st:'lab', name:'磁力',           desc:'アイテム回収範囲 +12%', max:15, cost:gcost(20,1.45) },
  lab_luck:     { st:'lab', name:'幸運',           desc:'素材が2個落ちる確率 +4%', max:20, cost:gcost(60,1.4) },
  lab_starter:  { st:'lab', name:'出撃支度',       desc:'開始時に基本素材を+2ずつ所持', max:10, cost:gcost(100,1.6) },
  lab_sail:     { st:'lab', name:'帆の改良',       desc:'船の速度 +8%', max:15, cost:gcost(200,1.42) },
  lab_mat_magic:{ st:'lab', name:'【解放】魔石',   desc:'新素材「魔石」が世界に出現する', max:1, cost:gcost(400,1) },
  lab_mat_coral:{ st:'lab', name:'【解放】珊瑚',   desc:'新素材「珊瑚」が海域に出現する', max:1, cost:gcost(1500,1) },
  lab_mat_scale:{ st:'lab', name:'【解放】竜のうろこ', desc:'新素材「竜のうろこ」が出現する', max:1, cost:gcost(6000,1) },
  lab_mat_star: { st:'lab', name:'【解放】星のかけら', desc:'新素材「星のかけら」が出現する', max:1, cost:gcost(15000,1) },
  lab_mat_abyss:{ st:'lab', name:'【解放】深淵の核', desc:'新素材「深淵の核」が出現する', max:1, cost:gcost(50000,1) },
  // --- 仲間の宿舎 ---
  camp_recruit: { st:'camp', name:'カリスマ',      desc:'敵が仲間になる確率 +0.2%(基本20%)', max:20, cost:gcost(40,1.38) },
  camp_fury:    { st:'camp', name:'鬨の声',        desc:'仲間の攻撃間隔 -3%', max:15, cost:gcost(80,1.5) },
  camp_hp:      { st:'camp', name:'仲間の生命',    desc:'仲間HP +1.5%',          max:30, cost:gcost(30,1.35) },
  camp_atk:     { st:'camp', name:'仲間の闘志',    desc:'仲間攻撃力 +1.2%(Lv15で「士気」: 仲間10体以上で攻撃+10%)',      max:30, cost:gcost(30,1.35) },
  camp_heal:    { st:'camp', name:'仲間介抱',      desc:'仲間HP自動回復 +1%/秒', max:10, cost:gcost(120,1.6) },
  camp_swift:   { st:'camp', name:'仲間の俊足',    desc:'仲間の移動速度 +5%', max:15, cost:gcost(80,1.45) },
  camp_revive:  { st:'camp', name:'魂の絆',        desc:'倒れた仲間が30%で踏みとどまる(HP1)', max:5, cost:gcost(500,2.2) },
  // --- スキル書庫 ---
  lib_sk_sands: { st:'lib', name:'【解放】時の砂', desc:'スキル「時の砂」を習得できるようになる', max:1, cost:gcost(20000,1) },
  lib_sk_confuse:{ st:'lib', name:'【解放】混沌の瘴気', desc:'スキル「混沌の瘴気」を習得できるようになる', max:1, cost:gcost(1200,1) },
  lib_sk_curse: { st:'lib', name:'【解放】衰弱の呪印', desc:'スキル「衰弱の呪印」を習得できるようになる', max:1, cost:gcost(3500,1) },
  lib_cap:      { st:'lib', name:'スキル上限解放', desc:'全スキルの最大レベル +1(基本5)', max:5, cost:gcost(1000,3.2) },
  lib_cdr:      { st:'lib', name:'速撃術',         desc:'武器の攻撃間隔 -2%(最大40%)', max:20, cost:gcost(80,1.42) },
  // --- 基地専用強化(基地を解放すると、その基地のマップの施設で買える) ---
  // fac: war=武練場(攻撃) / life=生命の祠(生存) / lore=秘宝の蔵(経済・仲間・特殊)
  // effAdd/effMul はデータ定義だけでステータスに反映される汎用効果
  // 北の砦: 武練場(反撃/会心) / 生命の祠(城壁/最大HP) / 秘宝の蔵(兵站/仲間俊足)
  g_north_thorn: { st:'b_north', fac:'war',  name:'茨の鎧',    desc:'接触してきた敵に反撃ダメージ +5', max:20, cost:gcost(150,1.4) },
  g_north_edge:  { st:'b_north', fac:'war',  name:'砦の刃',    desc:'全ダメージ +2%', max:20, cost:gcost(160,1.4), effMul:{atk:.02} },
  g_north_wall:  { st:'b_north', fac:'life', name:'城壁の加護',desc:'HPが30%以下の時、被ダメージ -3%', max:15, cost:gcost(200,1.45) },
  g_north_keep:  { st:'b_north', fac:'life', name:'砦の備え',  desc:'最大HP +12', max:20, cost:gcost(170,1.4), effAdd:{maxHp:12} },
  g_north_supply:{ st:'b_north', fac:'lore', name:'兵站術',    desc:'素材ドロップ量 +3%', max:15, cost:gcost(180,1.42), effMul:{dropMul:.03} },
  g_north_march: { st:'b_north', fac:'lore', name:'行軍の号令',desc:'仲間の移動速度 +3%', max:15, cost:gcost(200,1.42), effMul:{allySpeed:.03} },
  g_north_fear:  { st:'b_north', fac:'war',  name:'威圧の号令', desc:'「威圧のオーラ」の効果量 +4%', max:15, cost:gcost(220,1.45) },
  // 東の遺跡: 武練場(範囲/射程) / 生命の祠(結界/回避) / 秘宝の蔵(叡智/仲間全能力)
  g_east_area:   { st:'b_east', fac:'war',  name:'魔力増幅',   desc:'スキルの効果範囲 +4%',  max:20, cost:gcost(180,1.42) },
  g_east_reach:  { st:'b_east', fac:'war',  name:'遠見の術',   desc:'攻撃の射程 +2%', max:15, cost:gcost(200,1.42), effMul:{range:.02} },
  g_east_ward:   { st:'b_east', fac:'life', name:'遺跡の結界', desc:'被ダメージ -1%', max:10, cost:gcost(220,1.45), effAdd:{armor:.01} },
  g_east_evade:  { st:'b_east', fac:'life', name:'残像歩法',   desc:'回避率 +0.6%', max:12, cost:gcost(240,1.46), effAdd:{dodge:.006} },
  g_east_cdr:    { st:'b_east', fac:'lore', name:'古代の叡智', desc:'武器の攻撃間隔 -1.5%(書庫と加算)', max:20, cost:gcost(180,1.42) },
  g_east_muster: { st:'b_east', fac:'lore', name:'遺跡の共鳴', desc:'仲間の攻撃力 +3%', max:15, cost:gcost(210,1.44), effMul:{allyAtk:.03} },
  g_east_sk:     { st:'b_east', fac:'lore', name:'【解放】遺跡の脈動', desc:'スキル「遺跡の脈動」を習得可能に(素材「遺物のかけら」も出現)', max:1, cost:gcost(2500,1) },
  // 南の泉: 武練場(浄化/会心) / 生命の祠(治癒/自然回復) / 秘宝の蔵(霊薬/仲間回復)
  g_south_bless: { st:'b_south', fac:'war',  name:'清めの刃',  desc:'全ダメージ +3%', max:15, cost:gcost(200,1.42), effMul:{atk:.03} },
  g_south_focus: { st:'b_south', fac:'war',  name:'澄んだ心',  desc:'会心率 +1%', max:12, cost:gcost(230,1.44), effAdd:{crit:.01} },
  g_south_heal:  { st:'b_south', fac:'life', name:'癒しの水',  desc:'HP自動回復 +1/秒',      max:15, cost:gcost(220,1.45) },
  g_south_spring:{ st:'b_south', fac:'life', name:'泉の恵み',  desc:'最大HP +10', max:15, cost:gcost(200,1.42), effAdd:{maxHp:10} },
  g_south_potion:{ st:'b_south', fac:'lore', name:'霊薬精製',  desc:'敵が回復ポーション(HP20%)を落とす確率 +0.4%', max:10, cost:gcost(300,1.5) },
  g_south_care:  { st:'b_south', fac:'lore', name:'泉の看護',  desc:'仲間HP自動回復 +0.6%/秒', max:12, cost:gcost(260,1.46), effAdd:{allyRegen:.006} },
  g_south_sanct: { st:'b_south', fac:'life', name:'聖域の祝福', desc:'「サンクチュアリ」の効果量 +4%', max:15, cost:gcost(240,1.45) },
  g_south_sk:    { st:'b_south', fac:'lore', name:'【解放】命の泉水', desc:'スキル「命の泉水」を習得可能に(素材「命の雫」も出現)', max:1, cost:gcost(2500,1) },
  // 西の炉: 武練場(業火/巨人殺し) / 生命の祠(鎧下/棘) / 秘宝の蔵(精錬/仲間HP)
  g_west_fire:   { st:'b_west', fac:'war',  name:'業火の刻印', desc:'全ダメージ +5%(祭壇と加算)', max:25, cost:gcost(250,1.4) },
  g_west_boss:   { st:'b_west', fac:'war',  name:'巨人殺し',   desc:'ボスへのダメージ +8%',  max:20, cost:gcost(300,1.42) },
  g_west_mail:   { st:'b_west', fac:'life', name:'鋼の鎧下',   desc:'最大HP +15', max:15, cost:gcost(250,1.42), effAdd:{maxHp:15} },
  g_west_forge:  { st:'b_west', fac:'life', name:'炉の頑健',   desc:'被ダメージ -1%', max:12, cost:gcost(280,1.46), effAdd:{armor:.01} },
  g_west_smelt:  { st:'b_west', fac:'lore', name:'精錬の目利き', desc:'コイン獲得量 +4%', max:15, cost:gcost(280,1.45), effMul:{coinMul:.04} },
  g_west_temper: { st:'b_west', fac:'lore', name:'鍛えの絆',   desc:'仲間の最大HP +3%', max:15, cost:gcost(260,1.45), effMul:{allyHp:.03} },
  g_west_shield: { st:'b_west', fac:'life', name:'盾の鍛錬',   desc:'「ガーディアンシールド」の爆発威力 +5%', max:15, cost:gcost(280,1.45) },
  g_west_sk:     { st:'b_west', fac:'lore', name:'【解放】鍛冶の心火', desc:'スキル「鍛冶の心火」を習得可能に', max:1, cost:gcost(2500,1) },
  // --- 第1環 ---
  g_dragon_fang: { st:'b_dragon', fac:'war',  name:'竜牙の刃',  desc:'ボスへのダメージ +5%', max:15, cost:gcost(1800,1.45), effMul:{bossDmg:.05} },
  g_dragon_res:  { st:'b_dragon', fac:'life', name:'竜鱗の守り', desc:'リーパーからの被ダメージ -6%(最大90%)', max:15, cost:gcost(2000,1.5) },
  g_dragon_craft:{ st:'b_dragon', fac:'lore', name:'竜骨細工',  desc:'素材ドロップ量 +4%', max:15, cost:gcost(1900,1.45), effMul:{dropMul:.04} },
  g_dragon_kokoroe:{ st:'b_dragon', fac:'lore', name:'竜の教練', desc:'全ての心得の効果 +4%', max:15, cost:gcost(2100,1.45) },
  g_dragon_sk:   { st:'b_dragon', fac:'war', name:'【解放】竜鱗の陣', desc:'スキル「竜鱗の陣」を習得可能に', max:1, cost:gcost(3500,1) },
  g_dusk_slay:   { st:'b_dusk', fac:'war',  name:'終焉狩り',   desc:'リーパーへのダメージ +15%', max:20, cost:gcost(2000,1.5) },
  g_dusk_veil:   { st:'b_dusk', fac:'life', name:'黄昏の帳',   desc:'回避率 +0.8%', max:10, cost:gcost(2200,1.5), effAdd:{dodge:.008} },
  g_dusk_poem:   { st:'b_dusk', fac:'lore', name:'詩人の囁き', desc:'仲間になる確率 +0.05%', max:10, cost:gcost(2400,1.5), effAdd:{recruit:.0005} },
  g_dusk_sk:     { st:'b_dusk', fac:'lore', name:'【解放】黄昏の帳', desc:'スキル「黄昏の帳」を習得可能に(素材「宵の紗」も出現)', max:1, cost:gcost(3500,1) },
  g_star_meteor: { st:'b_star', fac:'war',  name:'流星の火',   desc:'会心率 +1.5%', max:10, cost:gcost(2800,1.5), effAdd:{crit:.015} },
  g_star_time:   { st:'b_star', fac:'life', name:'星読みの加護', desc:'強い色違いの敵の出現を3%緩和(最大45%)', max:15, cost:gcost(3000,1.55) },
  g_star_chart:  { st:'b_star', fac:'lore', name:'星図の導き', desc:'移動速度 +1.5%', max:15, cost:gcost(2600,1.5), effMul:{speed:.015} },
  g_star_sands:  { st:'b_star', fac:'lore', name:'刻の砂時計', desc:'「時の砂」の効果量 +4%', max:15, cost:gcost(2800,1.5) },
  g_star_sk:     { st:'b_star', fac:'war',  name:'【解放】星の吉兆', desc:'スキル「星の吉兆」を習得可能に(素材「星屑」も出現)', max:1, cost:gcost(3500,1) },
  g_green_hunt:  { st:'b_green', fac:'war',  name:'森の狩人',  desc:'全ダメージ +3%', max:15, cost:gcost(2400,1.48), effMul:{atk:.03} },
  g_green_rest:  { st:'b_green', fac:'life', name:'森の寝床',  desc:'HP自動回復 +0.8/秒', max:10, cost:gcost(2600,1.5), effAdd:{regen:.8} },
  g_green_ally:  { st:'b_green', fac:'lore', name:'森の恵み',  desc:'仲間の全能力 +8%',      max:15, cost:gcost(2500,1.5) },
  g_green_charisma:{ st:'b_green', fac:'lore', name:'森の歌声', desc:'「カリスマの歌」の効果量 +4%', max:15, cost:gcost(2600,1.5) },
  g_green_sk:    { st:'b_green', fac:'war', name:'【解放】野生の呼び声', desc:'スキル「野生の呼び声」を習得可能に(素材「獣牙」も出現)', max:1, cost:gcost(3500,1) },
  g_white_snipe: { st:'b_white', fac:'war',  name:'灯火の狙撃', desc:'攻撃射程 +2%', max:10, cost:gcost(2800,1.5), effMul:{range:.02} },
  g_white_shell: { st:'b_white', fac:'life', name:'白亜の盾',  desc:'被ダメージ -1%', max:10, cost:gcost(3200,1.5), effAdd:{armor:.01} },
  g_white_gold:  { st:'b_white', fac:'lore', name:'白亜の商才', desc:'コイン獲得量 +15%(金運と加算)', max:15, cost:gcost(3000,1.5) },
  g_white_magnet:{ st:'b_white', fac:'lore', name:'白亜の磁鉄', desc:'「マグネットフィールド」の効果量 +4%', max:15, cost:gcost(2900,1.5) },
  g_white_sk:    { st:'b_white', fac:'war', name:'【解放】白亜の灯', desc:'スキル「白亜の灯」を習得可能に', max:1, cost:gcost(3500,1) },
  g_black_dark:  { st:'b_black', fac:'war',  name:'黒曜の契約', desc:'全ダメージ+10% / 最大HP+40', max:15, cost:gcost(4000,1.55) },
  g_black_skin:  { st:'b_black', fac:'life', name:'黒曜の皮膚', desc:'最大HP +20', max:15, cost:gcost(3800,1.5), effAdd:{maxHp:20} },
  g_black_pact:  { st:'b_black', fac:'lore', name:'契約の対価', desc:'コイン獲得量 +4%', max:15, cost:gcost(4200,1.55), effMul:{coinMul:.04} },
  g_black_vamp:  { st:'b_black', fac:'war',  name:'血の契約',   desc:'「吸血の刻印」の効果量 +4%', max:15, cost:gcost(4000,1.5) },
  g_black_sk:    { st:'b_black', fac:'lore', name:'【解放】対価の契約', desc:'スキル「対価の契約」を習得可能に(素材「黒曜のかけら」も出現)', max:1, cost:gcost(4500,1) },
  // --- 中間の小島 ---
  g_mist_blade:  { st:'b_mist',  fac:'war',  name:'霧の刃',    desc:'会心率 +1.5%', max:10, cost:gcost(1400,1.45), effAdd:{crit:.015} },
  g_mist_dodge:  { st:'b_mist',  fac:'life', name:'霧隠れ',     desc:'回避率 +1%(攻撃を完全に避ける)', max:15, cost:gcost(1500,1.45) },
  g_mist_gather: { st:'b_mist',  fac:'lore', name:'霧の収集家', desc:'アイテム回収範囲 +6%', max:10, cost:gcost(1300,1.45), effMul:{magnet:.06} },
  g_mist_confuse:{ st:'b_mist',  fac:'lore', name:'幻惑の霧',   desc:'「混沌の瘴気」の効果量 +4%', max:15, cost:gcost(1500,1.45) },
  g_mist_sk:     { st:'b_mist', fac:'war',  name:'【解放】霧渡り', desc:'スキル「霧渡り」を習得可能に', max:1, cost:gcost(2000,1) },
  g_bones_spike: { st:'b_bones', fac:'war',  name:'骨の棘',    desc:'接触してきた敵に反撃ダメージ +4', max:15, cost:gcost(1500,1.45), effAdd:{thorns:4} },
  g_bones_broth: { st:'b_bones', fac:'life', name:'骨髄の薬',  desc:'HP自動回復 +0.8/秒', max:10, cost:gcost(1700,1.5), effAdd:{regen:.8} },
  g_bones_army:  { st:'b_bones', fac:'lore', name:'骸骨の軍勢', desc:'周回開始時に骸骨の仲間を連れて出撃(2Lvごとに+1体)', max:10, cost:gcost(1800,1.5) },
  g_bones_sk:    { st:'b_bones', fac:'war',  name:'【解放】骨の呼び声', desc:'スキル「骨の呼び声」を習得できるようになる', max:1, cost:gcost(2500,1) },
  g_bones_mat:   { st:'b_bones', fac:'lore', name:'【解放】魂片', desc:'新素材「魂片」が死霊系の魔物から出る', max:1, cost:gcost(1200,1) },
  g_ember_burn:  { st:'b_ember', fac:'war',  name:'燃えさしの祝福', desc:'全攻撃に4%で炎上を付与', max:10, cost:gcost(1600,1.5) },
  g_ember_warm:  { st:'b_ember', fac:'life', name:'残り火の温もり', desc:'最大HP +15', max:15, cost:gcost(1500,1.45), effAdd:{maxHp:15} },
  g_ember_trade: { st:'b_ember', fac:'lore', name:'火の子の商い', desc:'コイン獲得量 +4%', max:15, cost:gcost(1700,1.5), effMul:{coinMul:.04} },
  g_ember_sk:    { st:'b_ember', fac:'war',  name:'【解放】火の粉', desc:'スキル「火の粉」を習得できるようになる', max:1, cost:gcost(2500,1) },
  g_ember_mat:   { st:'b_ember', fac:'lore', name:'【解放】燃え殻', desc:'新素材「燃え殻」が灼熱系の魔物から出る', max:1, cost:gcost(1200,1) },
  g_frost_slow:  { st:'b_frost', fac:'war',  name:'霜の吐息',   desc:'全攻撃に3%で氷結(減速)を付与', max:10, cost:gcost(1600,1.5) },
  g_frost_armor: { st:'b_frost', fac:'life', name:'氷の鎧',    desc:'被ダメージ -1.2%', max:10, cost:gcost(1700,1.5), effAdd:{armor:.012} },
  g_frost_store: { st:'b_frost', fac:'lore', name:'氷室の保存', desc:'素材ドロップ量 +4%', max:15, cost:gcost(1500,1.45), effMul:{dropMul:.04} },
  g_frost_sk:    { st:'b_frost', fac:'war',  name:'【解放】霜のオーラ', desc:'スキル「霜のオーラ」を習得できるようになる', max:1, cost:gcost(2500,1) },
  g_frost_mat:   { st:'b_frost', fac:'lore', name:'【解放】氷晶', desc:'新素材「氷晶」が氷雪系の魔物から出る', max:1, cost:gcost(1200,1) },
  // --- 第2環 ---
  g_forge_gear:  { st:'b_forge', fac:'war',  name:'神鉄の装備', desc:'全ダメージ+6% / 最大HP+10', max:25, cost:gcost(8000,1.4) },
  g_forge_helm:  { st:'b_forge', fac:'life', name:'神鉄の兜',  desc:'最大HP +25', max:15, cost:gcost(7500,1.45), effAdd:{maxHp:25} },
  g_forge_arms:  { st:'b_forge', fac:'lore', name:'神鉄の武具(仲間用)', desc:'仲間の攻撃力 +4%', max:15, cost:gcost(8500,1.45), effMul:{allyAtk:.04} },
  g_forge_banner:{ st:'b_forge', fac:'war',  name:'軍旗の鍛造', desc:'「ウォーバナー」の効果量 +4%', max:15, cost:gcost(8700,1.45) },
  g_forge_sk:    { st:'b_forge', fac:'life', name:'【解放】神鉄の壁', desc:'スキル「神鉄の壁」を習得可能に', max:1, cost:gcost(9000,1) },
  g_moon_blade:  { st:'b_moon',  fac:'war',  name:'月光の刃',  desc:'会心率 +2%', max:10, cost:gcost(8500,1.5), effAdd:{crit:.02} },
  g_moon_shadow: { st:'b_moon',  fac:'life', name:'影歩き',     desc:'被弾後の無敵時間 +0.06秒', max:10, cost:gcost(9000,1.5) },
  g_moon_luck:   { st:'b_moon',  fac:'lore', name:'月の吉兆',  desc:'レア素材の出やすさ +3%', max:10, cost:gcost(9500,1.5), effAdd:{luck2:.03} },
  g_moon_sk:     { st:'b_moon', fac:'war',  name:'【解放】月光の疾走', desc:'スキル「月光の疾走」を習得可能に', max:1, cost:gcost(9000,1) },
  g_storm_bolt:  { st:'b_storm', fac:'war',  name:'嵐の加護',   desc:'9秒ごとに自動で落雷が敵を撃つ(威力+20/Lv)', max:15, cost:gcost(8500,1.45) },
  g_storm_ward:  { st:'b_storm', fac:'life', name:'避雷の護符', desc:'被ダメージ -1.2%', max:10, cost:gcost(9000,1.5), effAdd:{armor:.012} },
  g_storm_wind:  { st:'b_storm', fac:'lore', name:'風の運び手', desc:'移動速度 +2%', max:10, cost:gcost(8800,1.5), effMul:{speed:.02} },
  g_storm_boots: { st:'b_storm', fac:'lore', name:'追い風',     desc:'「ヘルメスの靴」の効果量 +3%', max:10, cost:gcost(9000,1.5) },
  g_storm_sk:    { st:'b_storm', fac:'war', name:'【解放】雷雲の呼び声', desc:'スキル「雷雲の呼び声」を習得可能に', max:1, cost:gcost(9000,1) },
  g_grave_blast: { st:'b_grave', fac:'war',  name:'弔いの爆炎', desc:'仲間が倒れた時に爆発(威力+30/Lv)', max:15, cost:gcost(8000,1.45) },
  g_grave_pray:  { st:'b_grave', fac:'life', name:'墓守の祈り', desc:'仲間のHP +5%', max:15, cost:gcost(8200,1.45), effMul:{allyHp:.05} },
  g_grave_gift:  { st:'b_grave', fac:'lore', name:'死者の貢物', desc:'コイン獲得量 +5%', max:15, cost:gcost(8600,1.5), effMul:{coinMul:.05} },
  g_grave_curse: { st:'b_grave', fac:'war',  name:'墓標の呪詛', desc:'「衰弱の呪印」の効果量 +4%', max:15, cost:gcost(8400,1.5) },
  g_grave_sk:    { st:'b_grave', fac:'life', name:'【解放】墓守の加護', desc:'スキル「墓守の加護」を習得可能に', max:1, cost:gcost(9000,1) },
  // --- 第3環 ---
  g_sun_wrath:   { st:'b_sun',   fac:'war',  name:'太陽の憤怒', desc:'全ダメージ +4%', max:20, cost:gcost(38000,1.5), effMul:{atk:.04} },
  g_sun_life:    { st:'b_sun',   fac:'life', name:'太陽の生命', desc:'HP自動回復 +1/秒', max:15, cost:gcost(36000,1.5), effAdd:{regen:1} },
  g_sun_grace:   { st:'b_sun',   fac:'lore', name:'太陽の恩寵', desc:'攻撃・HP・移動速度 +2%', max:20, cost:gcost(40000,1.5) },
  g_sun_sk:      { st:'b_sun',  fac:'war',  name:'【解放】太陽の熱波', desc:'スキル「太陽の熱波」を習得可能に(素材「太陽石」も出現)', max:1, cost:gcost(42000,1) },
  g_void_edge:   { st:'b_void',  fac:'war',  name:'虚無の刃',  desc:'リーパーへのダメージ +6%', max:15, cost:gcost(42000,1.5), effMul:{reaperDmg:.06} },
  g_void_null:   { st:'b_void',  fac:'life', name:'虚無の帳',   desc:'リーパー耐性+2% / リーパー特効+5%', max:15, cost:gcost(45000,1.5) },
  g_void_calm:   { st:'b_void',  fac:'lore', name:'無の悟り',  desc:'武器の攻撃間隔 -1%', max:10, cost:gcost(48000,1.55), effAdd:{cdr:.01} },
  g_void_sk:     { st:'b_void', fac:'war',  name:'【解放】虚無の引力', desc:'スキル「虚無の引力」を習得可能に', max:1, cost:gcost(46000,1) },
  // --- 実績で解放される強化項目 ---
  m_war:       { st:'altar', name:'戦意',     desc:'全ダメージ +2%',            max:10, cost:gcost(500,1.4),   unlockAch:'ach_kill1' },
  m_ashura:    { st:'altar', name:'修羅',     desc:'クリティカル率 +1.5%',      max:10, cost:gcost(5000,1.45), unlockAch:'ach_kill2' },
  m_grit:      { st:'altar', name:'不屈',     desc:'HP自動回復 +1/秒',          max:10, cost:gcost(800,1.45),  unlockAch:'ach_time1' },
  m_pioneer:   { st:'altar', name:'開拓魂',   desc:'移動速度 +2%',              max:5,  cost:gcost(3000,1.5),  unlockAch:'ach_bases' },
  m_deathlearn:{ st:'altar', name:'死中の活', desc:'力尽きた時の持ち帰りコイン +10%', max:10, cost:gcost(1000,1.45), unlockAch:'ach_die10' },
  m_bond2:     { st:'camp',  name:'友の絆',   desc:'仲間HP +6%',                max:10, cost:gcost(600,1.4),   unlockAch:'ach_recruit1' },
  m_legion:    { st:'camp',  name:'軍団旗',   desc:'仲間攻撃力 +6%',            max:10, cost:gcost(2000,1.45), unlockAch:'ach_allies20' },
  m_bosslore:  { st:'lib',   name:'弱点研究', desc:'ボスへのダメージ +5%',      max:10, cost:gcost(1500,1.45), unlockAch:'ach_boss1' },
  m_satori:    { st:'lib',   name:'悟り',     desc:'武器の攻撃間隔 -1%',        max:10, cost:gcost(2500,1.5),  unlockAch:'ach_skills' },
  m_endbook:   { st:'lib',   name:'終焉の書', desc:'リーパー被ダメ -2%',        max:10, cost:gcost(8000,1.5),  unlockAch:'ach_time2' },
  m_reaplore:  { st:'lab',   name:'終焉の知識', desc:'リーパーへのダメージ +4%', max:10, cost:gcost(3000,1.45), unlockAch:'ach_reaper1' },
  m_cartography:{ st:'lab',  name:'地図学',   desc:'探索でマップに記録される範囲が広がる', max:4, cost:gcost(1500,1.8), unlockAch:'ach_dist1' },
  m_preserve:  { st:'lab',   name:'保存術',   desc:'開始時の所持素材 +1ずつ',   max:5,  cost:gcost(1200,1.6),  unlockAch:'ach_mats1' },
  m_salvage:   { st:'lab',   name:'解体術',   desc:'オブジェクトが追加素材を落とす確率 +8%', max:10, cost:gcost(900,1.45), unlockAch:'ach_obj1' },
  m_shipwright:{ st:'lab',   name:'造船学',   desc:'船の速度 +5%',              max:10, cost:gcost(2000,1.45), unlockAch:'ach_ports' },
  m_invest:    { st:'lab',   name:'投資',     desc:'コイン獲得 +8%',            max:10, cost:gcost(5000,1.5),  unlockAch:'ach_coins' },
  m_stash:     { st:'lab',   name:'保管庫',   desc:'周回終了時、高ティアの素材から4個/Lvまで次の周回へ持ち越す', max:8, cost:gcost(800,1.6) },
  // --- 最果て ---
  g_end_beyond:  { st:'b_end',   fac:'war',  name:'終焉超越',   desc:'色違いの敵の出現をさらに2%緩和 / 全ダメージ+8%', max:20, cost:gcost(150000,1.55) },
  g_end_vessel:  { st:'b_end',   fac:'life', name:'終焉の器',   desc:'最大HP +4%', max:15, cost:gcost(140000,1.55), effMul:{maxHp:.04} },
  g_end_relic:   { st:'b_end',   fac:'lore', name:'彼方の遺物', desc:'素材ドロップ量 +5%', max:15, cost:gcost(130000,1.55), effMul:{dropMul:.05} },
  g_end_sk:      { st:'b_end',  fac:'war',  name:'【解放】終焉の誓い', desc:'スキル「終焉の誓い」を習得可能に', max:1, cost:gcost(150000,1) },
  // --- 沈み都(海底都市) ---
  g_sea_tide:    { st:'b_sea', fac:'war',  name:'潮流の型',     desc:'クリティカル率 +1%',  max:10, cost:gcost(2800,1.45), effMul:{critAdd:.01} },
  g_sea_breath:  { st:'b_sea', fac:'life', name:'潮の息継ぎ',   desc:'自然回復 +0.2/秒',    max:10, cost:gcost(2600,1.45), effMul:{regenAdd:.2} },
  g_sea_pearl:   { st:'b_sea', fac:'lore', name:'真珠の目利き', desc:'コイン獲得 +4%',      max:15, cost:gcost(2400,1.45), effMul:{coinMul:.04} },
  g_sea_sk:      { st:'b_sea', fac:'war',  name:'【解放】潮汐の恵み', desc:'スキル「潮汐の恵み」を習得可能に', max:1, cost:gcost(2600,1) },
};

// 基地マップの施設(基地ごとの特別強化は3種類の施設に分かれている)
DATA.BASE_FACS = {
  war:  { name:'武練場',   sprite:'st_war',  short:'武練', desc:'攻撃系の特別強化' },
  life: { name:'生命の祠', sprite:'st_life', short:'祠',   desc:'生存系の特別強化' },
  lore: { name:'秘宝の蔵', sprite:'st_lore', short:'蔵',   desc:'経済・仲間・特殊な特別強化' },
};

// ---------------- 実績 ----------------
// cond(save) が true になると解放。報酬は unlockAch 付きのメタ強化/スキルが解放される
DATA.ACHIEVEMENTS = [
  { id:'ach_kill1',   name:'討伐者',       desc:'累計1,000体撃破',        cond:s=>s.stats.kills>=1000,        reward:'祭壇に「戦意」が追加' },
  { id:'ach_kill2',   name:'殲滅者',       desc:'累計10,000体撃破',       cond:s=>s.stats.kills>=10000,       reward:'祭壇に「修羅」が追加' },
  { id:'ach_recruit1',name:'人望家',       desc:'累計100体を仲間にする',  cond:s=>s.stats.recruits>=100,      reward:'宿舎に「友の絆」が追加' },
  { id:'ach_allies20',name:'軍団長',       desc:'同時に仲間20体',         cond:s=>(s.stats.maxAlliesEver||0)>=20, reward:'宿舎に「軍団旗」が追加' },
  { id:'ach_boss1',   name:'ボスハンター', desc:'ボスを10体討伐',         cond:s=>s.stats.bossKills>=10,      reward:'書庫に「弱点研究」が追加' },
  { id:'ach_reaper1', name:'死神殺し',     desc:'リーパーを1体討伐',      cond:s=>s.stats.reaperKills>=1,     reward:'研究所に「終焉の知識」が追加' },
  { id:'ach_dist1',   name:'冒険者',       desc:'距離10,000に到達',       cond:s=>s.stats.maxDist>=10000,     reward:'研究所に「地図学」が追加' },
  { id:'ach_time1',   name:'生存者',       desc:'20分間生き延びる',       cond:s=>s.stats.bestTime>=1200,     reward:'祭壇に「不屈」が追加' },
  { id:'ach_time2',   name:'終焉を見た者', desc:'終焉の刻(30分)に到達',   cond:s=>s.stats.bestTime>=1800,     reward:'書庫に「終焉の書」が追加' },
  { id:'ach_mats1',   name:'収集家',       desc:'素材を累計500個収集',    cond:s=>(s.stats.matsCollected||0)>=500, reward:'研究所に「保存術」が追加' },
  { id:'ach_obj1',    name:'解体屋',       desc:'オブジェクトを500個破壊',cond:s=>(s.stats.objectsDestroyed||0)>=500, reward:'研究所に「解体術」が追加' },
  { id:'ach_ports',   name:'大航海',       desc:'港を3つ修理する',        cond:s=>Object.keys(s.ports).length>=3, reward:'研究所に「造船学」が追加' },
  { id:'ach_bases',   name:'開拓者',       desc:'基地を5つ解放する',      cond:s=>Object.keys(s.bases).length>=5, reward:'祭壇に「開拓魂」が追加' },
  { id:'ach_coins',   name:'大富豪',       desc:'累計100,000コイン獲得',  cond:s=>s.stats.totalCoins>=100000, reward:'研究所に「投資」が追加' },
  { id:'ach_skills',  name:'求道者',       desc:'スキルを累計50回取得',   cond:s=>(s.stats.skillsAcquired||0)>=50, reward:'書庫に「悟り」が追加' },
  { id:'ach_die10',   name:'不屈の魂',     desc:'10回力尽きる',           cond:s=>(s.stats.deaths||0)>=10,    reward:'祭壇に「死中の活」が追加' },
  { id:'ach_rare',    name:'幻を見た者',   desc:'レインボースライムを討伐', cond:s=>(s.stats.rareKills||0)>=1, reward:'武器庫に攻撃手段「虹の奔流」が追加' },
];

// ---------------- クエスト(基地・港の解放条件) ----------------
// 未解放の基地/未修理の船に近づくと専用マップに転移し、NPCのクエストをこなすと解放される
// type: hunt=討伐 / fetch=収集(お使い) / survive=防衛 / delivery=素材納品
// ---------------- サイドクエスト: 基地の住民たちの依頼 ----------------
// 基地は村や街として人が暮らしており、複数の住民が依頼を持つ。
// requiresStory: このストーリーフラグが立つまで受けられない(lockedLineでお預け)。
// reward.hintBase / hintPort: 達成すると場所がマップに載る(ストーリーで場所が分かる)。
// type 'visit': 目的地を訪ねる依頼。目的地の近くに未発見の拠点があれば自然と見つかる。
DATA.SIDEQUESTS = {
  // 魂の広場(初期基地): ストーリーが進むと住民が移り住んでくる
  main: [
    { id:'sq_toto2', npc:'npc_mapper', npcName:'地図職人トト', type:'delivery', need:{ mats:{ wood:12 } },
      appearStory:'toto_map',   // 東の丘の測量後、魂の広場に工房を開く
      intro:['おお、お前さんか!ワシは魂の広場に工房を移したんじゃ。','完成版の地図を作りたい。板材に写すから木材12、頼めるか。'],
      done:['…できた!ワシの生涯最高の地図じゃ。お前さんの探索の記録がぐっと広く残るぞ。','(パワーアップ「地図学」が上がった)'],
      reward:{ coins:150, metaLv:{ m_cartography:1 }, story:'toto_guild' } },
    { id:'sq_kalci', npc:'en_skel', npcName:'骸骨兵カルシ', type:'hunt', enemy:'shade', count:8,
      appearStory:'bones_rite',   // 骨の民の儀式で友好化した骸骨が広場に現れる
      intro:['カタカタ…(骨の民の儀式のおかげで、我は正気を保っておる)','(だがシェイドが同胞を操る…8体、頼めるか)'],
      done:['カタカタ…!(恩に着る。我が同胞たちを、お前の軍勢に加えよう)','(パワーアップ「骸骨の軍勢」が上がった)'],
      reward:{ coins:200, metaLv:{ g_bones_army:1 }, story:'kalci_join' } },
    { id:'sq_yone', npc:'npc_girl', npcName:'巡礼者ヨネ', type:'visit', visit:{ x:-3800, y:-5600, label:'荒野の墓標' },
      appearStory:'south_inn',   // 宿屋の女将の口伝てで広場へ巡礼に来る
      intro:['あなたが…「死に戻り」の御方ですね。巡礼者のヨネと申します。','息子は兵士でした。北の荒野で死に…そして、還りませんでした。','普通の魂は還らない。だからこそ人は、還るあなたを畏れ、あるいは崇めるのです。','荒野に息子の墓標があります。この祈り石を、供えてきていただけませんか。'],
      done:['…ありがとうございます。これであの子の魂も、一度は広場に還れた気がします。','あなたが死んで、歩いて戻ってくるたび…それだけで救われる者がいること、忘れないでくださいね。'],
      doneChoice:{ text:'ヨネに何と伝える?', options:[
        { label:'「息子さんは、確かに還っていましたよ」', line:'…そう。そうですか。…優しい嘘でも、嬉しいものですね。' },
        { label:'(黙って頷く)', line:'…ふふ。あなたのその静けさ、あの子に少し似ています。' },
      ] },
      reward:{ coins:120, story:'yone_prayer' } },
    { id:'sq_hoshi', npc:'npc_miko', npcName:'星詠みの弟子ホシ', type:'delivery', need:{ mats:{ crystal:8 } },
      appearStory:'star_sign',   // 星見の村の導きで魂の広場に来た
      intro:['星見の村から参りました。あなたの噂は星に聞いています。','瘴気の書を写したいのです。…月の修道院は「禁書」と呼ぶ書物ですが、知は使う者の心次第。','水晶を8つ、貸していただけますか。'],
      done:['写本ができました。「混沌の瘴気」の知識をあなたに。','(書庫の解放「混沌の瘴気」が手に入った)'],
      reward:{ coins:100, metaLv:{ lib_sk_confuse:1 }, story:'hoshi_book' } },
  ],
  b_north: [
    { id:'sq_hanna', npc:'npc_girl', npcName:'村娘ハンナ', type:'hunt', enemy:'slime', count:8,
      intro:['あっ、旅の人!この砦の村ではみんなで畑をやってるの。','でもスライムが作物を食べちゃって…8体だけ、退治してくれない?'],
      done:['すごい!これで冬を越せるわ。','…あなたの後ろの魔物さんたち、最初は怖かったけど。ゲートの光は悪いものを寄せつけないのに、素通りしてくるんだもの。悪い子たちじゃないのね。','…そういえば地図職人のトトさんが、あなたみたいな人を探してたわよ。'],
      reward:{ coins:60, story:'north_peace' } },
    { id:'sq_toto', npc:'npc_mapper', npcName:'地図職人トト', type:'visit', visit:{ x:10200, y:5000, label:'東の丘の測量点' },
      leaveStory:'toto_map',   // 依頼を果たすと魂の広場へ工房を移す
      requiresStory:'north_peace', lockedLine:'今は測量の計算中でな…村の手伝いでもしてきてくれ。',
      intro:['ワシは地図職人のトト。東の丘に測量点を打ったんじゃが、','護衛がおらんで回収に行けん。代わりに測量点を調べてきてくれ。','東へまっすぐ…丘を越えた先じゃ。'],
      done:['おお、戻ったか!…なに?丘の向こうに古い遺跡と街があった?','それは「東の遺跡」…学術都市じゃよ。地図に描いておこう。'],
      reward:{ coins:80, hintBase:'b_east', story:'toto_map' } },
  ],
  b_east: [
    { id:'sq_kilo', npc:'npc_boy', npcName:'見習い研究員キロ', type:'hunt', enemy:'goblin', count:10,
      intro:['ぼく、リナ先生の弟子なんだ。','ゴブリンが研究資料を持っていっちゃう!10体やっつけて!'],
      done:['資料が戻ってきた!ありがとう!','この天文資料…北東の空の下にある「星降りの祭壇」の記述だ。地図に写しておくね。'],
      reward:{ coins:80, mats:{ crystal:3 }, hintBase:'b_star', story:'east_astro' } },
    { id:'sq_pino', npc:'npc_girl', npcName:'助手ピノ', type:'delivery', need:{ mats:{ crystal:6 } },
      requiresStory:'toto_map', lockedLine:'装置の解析中です。トトさんの地図が届いたら分かるかも…',
      intro:['トトさんの地図のおかげで分かったんです。この装置、東の大陸と共鳴してる!','水晶6つあれば共鳴先を特定できます。お願いできますか?'],
      done:['…見えた!共鳴先は東の大海の向こう、竜骨の大陸の「竜骨の前哨」。','狩人の集落があるはずです。地図に印を付けますね。'],
      reward:{ coins:100, hintBase:'b_dragon', story:'east_engine' } },
    { id:'sq_tetsu', npc:'npc_sailor', npcName:'行商のテツ', type:'visit', visit:{ x:-2000, y:11600, label:'南の泉のほとり' },
      intro:['俺は行商でな。ここの学者先生たちに紙とインクを卸してる。','仕入れ先は南西の泉のほとりにある巡礼の村なんだが、道中の魔物が増えて隊商が出せねえ。','様子を見てきてくれないか?泉が見えたら、そのほとりだ。'],
      done:['おお、村は無事だったか!泉の巫女様のいる「南の泉」だ。','地図に描いておこう。これでまた商売に行ける。恩に着るぜ。'],
      reward:{ coins:90, hintBase:'b_south', story:'east_road' } },
  ],
  b_south: [
    { id:'sq_tome', npc:'npc_girl', npcName:'巡礼のトメ婆', type:'escort', ehp:280, escortSpr:'npc_girl',
      dest:{ x:-500, y:14400, label:'泉の奥の祈り場' },
      intro:['ばあはね、足を悪くしてから祈り場まで行けとらんのよ。','泉の奥までいっしょに歩いてくれんかね。ゆっくりでええから。','(トメ婆を祈り場まで護衛する。婆が倒れたら失敗だ)'],
      done:['ありがとうねえ…何十年ぶりかの祈り場じゃったよ。','祈り場から西の空に、煙が立っとったろう?あれは「西の炉」…鍛冶の街の炉の煙よ。','ばあの息子があそこで炭鉱夫をしとる。地図に描いてあげよう。訪ねてやってな。','あんたの旅路にも、ようけ祝福がありますように。'],
      reward:{ coins:90, hintBase:'b_west', story:'tome_walk' } },
    { id:'sq_mama', npc:'npc_girl', npcName:'宿屋の女将マーサ', type:'hunt', enemy:'mush', count:8,
      intro:['あら旅の人、うちは巡礼さん相手の宿屋なの。','巡礼さんはみんな魂の広場を目指すのよ。死んだ家族の魂が、一時あそこに還ると信じてね。','裏の森のマイコニドが食料庫を荒らして困ってるの。8体お願い!'],
      done:['助かったわ〜。そうだ、南東の海の向こうに「深緑の社」があるの。','巡礼さんたちのもう一つの目的地よ。地図に描いてあげる。','…あなた、もしかして「還る人」?なら広場で、ヨネさんって巡礼さんを気にかけてあげて。'],
      reward:{ coins:70, hintBase:'b_green', story:'south_inn' } },
    { id:'sq_riku', npc:'npc_boy', npcName:'泉守の少年リク', type:'visit', visit:{ port:'p_e', label:'東の砂浜' },
      intro:['ねえねえ、東の砂浜にすごく大きな船が打ち上がってるんだ!','ぼく一人じゃ怖くて…見てきてくれない?'],
      done:['やっぱり船だった?船大工のおじさんが直したがってたやつだ!','港の場所、地図に描いておくね。'],
      reward:{ coins:60, hintPort:'p_e', story:'south_sea' } },
  ],
  b_west: [
    { id:'sq_bud', npc:'npc_miner', npcName:'炭鉱夫バド', type:'delivery', need:{ mats:{ scrap:10 } },
      intro:['この街の鉱脈も昔ほど出なくなっちまった。','鉄クズ10個ありゃ、坑道の支柱が直せるんだが。'],
      done:['恩に着るぜ。これで街の炉も回り続ける。','そういや南西の海の向こう、黄昏の大陸に「黄昏の前哨」ってのがある。詩人の隠れ里だ。地図に描いといてやる。'],
      reward:{ coins:120, story:'west_fire', hintBase:'b_dusk' } },
    { id:'sq_goldo', npc:'npc_scholar', npcName:'豪商ゴルド', type:'delivery', need:{ coins:300, mats:{ hide:15 } },
      requiresStory:'west_fire', lockedLine:'ワシは忙しい。…ふむ、炭鉱のバドを助けてやったら、また顔を見せなさい。働き者は嫌いじゃない。',
      intro:['ワシは西方交易の豪商ゴルド。お前さんの働きぶり、聞いておるよ。','隊商の冬支度に毛皮が15枚要る。それと商談の手付に🪙300。','なに、悪いようにはせん。ワシは払いのいい相手が好きでな。'],
      done:['よし、確かに受け取った。…ときにお前さん、西の海の向こうへ渡りたいんだろう?','南西の港町の船大工に、修理代を全額払っておいた。ワシの船だと思って使うといい。','黄昏の大陸への航路はワシの庭よ。…また良い取引をしよう。'],
      reward:{ coins:200, port:'p_sw', story:'goldo_ship' } },
  ],
  b_dragon: [
    { id:'sq_gai2', npc:'npc_miner', npcName:'狩人ガイ', type:'mark', enemy:'lizard', rank:2,
      markName:'紅鱗の主', mark:{ x:103500, y:6300 }, escortSpr:null,
      requiresStory:'gai_code', lockedLine:'…まずは色付き狩りの腕を見せてもらってからだ。',
      intro:['…見つけたんだ。相棒を殺った「紅鱗の主」を。','集落の南東の谷に潜んでる。マップに印を付けた。','掟には「紅は退け」とある。だがあいつだけは、退くわけにいかねえ。頼む。'],
      done:['……終わったか。','これで相棒も眠れる。…お前は、掟の外を生きる狩人だ。','主の牙だ。持っていけ。'],
      doneChoice:{ text:'ガイに何と声をかける?', options:[
        { label:'「相棒の仇、取ったぞ」', line:'…ああ。ああ、そうだな。……すまねえ、少し黙らせてくれ。' },
        { label:'(黙って牙を受け取る)', line:'…口の重い奴は嫌いじゃねえ。またいつでも来い。' },
      ] },
      reward:{ coins:400, mats:{ beastfang:6 }, story:'gai_avenge' } },
    { id:'sq_ryu', npc:'npc_sage', npcName:'語り部リュウ', type:'hunt', enemy:'lizard', count:8,
      requiresStory:'east_engine', lockedLine:'…よそ者に語る話はない。東の遺跡のゲートに導かれて来たのなら、話は別じゃがな。',
      intro:['東の遺跡のゲートが、この大陸を指し示したのじゃろう?ならば語ろう…この大陸の竜は、霧の彼方から来た。','だがリザードマンどもが語りの場を荒らす。8体、鎮めてくれ。'],
      done:['静けさが戻った…では約束の続きを。竜が来た「霧の彼方」――','北の海に霧に包まれた小島がある。「霧の観測所」という村があると聞く。地図に記そう。'],
      reward:{ coins:150, hintBase:'b_mist', story:'dragon_tale' } },
    { id:'sq_gai', npc:'npc_miner', npcName:'狩人ガイ', type:'hunt', enemy:'lizard', count:3, minRank:1,
      intro:['狩人の掟を教えてやる。「金は挑め、紅は退け、紫は語るな」。','長く生きて土地の力を吸った魔物は色を変える。姿は同じでも、中身は別物だ。相棒は紅鱗にやられた。','だが集落を守るにゃ、誰かが狩らなきゃならん。色付きのリザードマンを3体だ。','言っとくが、普通の鱗は数に入らんぞ。色を変えた奴だけだ。'],
      done:['…色付きを3体、本当に狩りやがった。','掟に一つ書き加えておく。「死に戻りには道を空けろ」ってな。','こいつは色付きの牙だ。奴らの力が宿ってる。持っていけ。'],
      reward:{ coins:250, mats:{ beastfang:5 }, story:'gai_code' } },
  ],
  b_mist: [
    { id:'sq_mio', npc:'npc_scholar', npcName:'観測手ミオ', type:'hunt', enemy:'wisp', count:10,
      requiresStory:'dragon_tale', lockedLine:'…霧が濃くてね。竜の伝承を知る人にしか、観測結果は渡せない決まりなの。',
      intro:['ここは霧を観測する村。最近、霧の向こうに光が見えるの。','でもウィスプが観測器に群がって…10体お願い。'],
      done:['観測できた!東に見えるあの灯り…「白亜の灯台」。竜骨の大陸の港街の灯りよ。','地図に描いておくわね。'],
      reward:{ coins:180, hintBase:'b_white', story:'mist_light' } },
  ],
  b_white: [
    { id:'sq_jiji', npc:'npc_sailor', npcName:'灯台守ジジ', type:'delivery', need:{ mats:{ shell:8 } },
      requiresStory:'mist_light', lockedLine:'灯りを見たって?…ふん、観測の村の紹介がなけりゃ話すことはねえ。',
      intro:['この港街の灯台はワシが守っとる。レンズ磨きに貝殻の粉がいるんじゃ。','貝殻8つ、持ってきてくれんか。'],
      done:['よし、灯りが強くなった。沖の果てまで照らせるぞ。','…見えるか?東の地平に赤く揺れる明かり。ありゃ「鍛冶神の工房都市」の炉の火じゃ。','この大陸の東の果てにある。地図に記す。'],
      reward:{ coins:460, hintBase:'b_forge', story:'white_beam' } },
    { id:'sq_umi', npc:'npc_sailor', npcName:'潜り漁師ウミ', type:'delivery', need:{ mats:{ shell:12, coral:4 } },
      requiresStory:'white_beam', lockedLine:'今は時化でな…灯台の灯りが強くなったら、沖の話をしてやるよ。',
      intro:['あたしは素潜りのウミ。この街で一番深く潜る女さ。','潜り装束を繕いたい。貝殻12と珊瑚4、都合してくれないかい。','礼に、この海で一番の秘密を教えてやるよ。'],
      done:['ありがとよ。…じゃあ約束の話だ。西の沖はるか、環礁がぽつんと浮かんでる。','あの下にはね、「沈み都」…海の底の都が今も生きて沈んでるんだ。環礁に巫女様がいる。地図に描いとくよ。'],
      reward:{ coins:300, hintBase:'b_sea', story:'umi_dive' } },
  ],
  b_dusk: [
    { id:'sq_sora', npc:'npc_girl', npcName:'吟遊詩人ソラ', type:'hunt', enemy:'bat', count:10,
      intro:['この里は詩人の隠れ里。でもコウモリがうるさくて歌えないの。','10体しずめて。歌でお礼するから。'],
      done:['ありがとう。お礼に、歌をひとつ。「南西の岬の黒曜の祠は、扉を開く詩を待つ」…','祠の扉を開ける合言葉の詩よ。祠の場所、地図に描いておくね。'],
      reward:{ coins:150, hintBase:'b_black', story:'dusk_song' } },
  ],
  b_black: [
    { id:'sq_kage', npc:'npc_sage', npcName:'祠守カゲ', type:'delivery', need:{ mats:{ scrap:12 } },
      requiresStory:'dusk_song', lockedLine:'…扉を開く詩を知らぬ者に、祠は開かれぬ。黄昏の里の詩人なら、知っておろうがな。',
      intro:['詩を聞いてきたか。ならば手伝え。祠を守る魔物よけの囲い…結界が破れておる。','芯に使う鉄クズを12、持ってきてくれ。'],
      done:['結界は戻った。礼に祠の記録を見せよう。','…ここから西へ、荒野を越えた先の「骨の祭場」。死者の民が集う野営地だ。地図に記した。'],
      reward:{ coins:200, hintBase:'b_bones', story:'black_rite' } },
  ],
  b_bones: [
    { id:'sq_garga', npc:'npc_miner', npcName:'族長ガルガ', type:'hunt', enemy:'skeleton', count:12,
      requiresStory:'black_rite', lockedLine:'よそ者に骨の掟は語らん。黒曜の祠の結界を直した者なら、別だがな。',
      intro:['ここは骨の民の野営地。だが最近、掟を破った骸骨どもが暴れる。','12体、眠らせてやってくれ。'],
      done:['これで祖霊も静かになる。礼だ、北西の空を見ろ。','…月だ。あの月の真下に「月影の社」…月の修道院がある。地図に描いた。'],
      reward:{ coins:280, hintBase:'b_moon', story:'bones_rite' } },
  ],
  b_green: [
    { id:'sq_kodama', npc:'npc_miko', npcName:'社守コダマ', type:'hunt', enemy:'boar', count:8,
      intro:['この社は森と共に生きる集落。でもイノシシが苗木を掘り返すの。','8頭、森へ帰して(倒して)ちょうだい。'],
      done:['苗木が守られたわ。お礼に社の言い伝えを。','「南東の海に火の島あり。火の民、燃えさしの炉を守りて暮らす」…地図に描くわね。'],
      reward:{ coins:180, hintBase:'b_ember', story:'green_seed' } },
  ],
  b_ember: [
    { id:'sq_popo', npc:'npc_boy', npcName:'火の子ポポ', type:'hunt', enemy:'lavaslime', count:8,
      requiresStory:'green_seed', lockedLine:'よそのひとには話しちゃだめって長老が言ってた。森の社のひとならいいけど…',
      intro:['ぼくたち火の民!でもラヴァスライムが炉に飛び込んで火が汚れるの。','8体おねがい!'],
      done:['やった〜!長老がね、南西の大陸の「墓標の祭壇」の話をしてたよ。','深緑の大陸のいちばん南にある、弔いの村なんだって。地図にかいてあげる!'],
      reward:{ coins:220, hintBase:'b_grave', story:'ember_flame' } },
  ],
  b_star: [
    { id:'sq_nono', npc:'npc_boy', npcName:'星見の子ノノ', type:'hunt', enemy:'wisp', count:8,
      requiresStory:'east_astro', lockedLine:'星の話は、学術都市の天文資料を読んだ人としかしないんだ。',
      intro:['星がきれいでしょ、ここは星見の村。','でもウィスプの光が邪魔で星が見えない…8体消して?'],
      done:['星が戻った!見て、あの北西の沖に光る白い星…あれは空の星じゃなくて、','「霜の祠」の氷の輝きなんだ。小島の氷の隠れ里だよ。地図にかくね。'],
      reward:{ coins:400, hintBase:'b_frost', story:'star_sign' } },
  ],
  b_frost: [
    { id:'sq_fuyu', npc:'npc_elder', npcName:'長老フユ', type:'hunt', enemy:'iceslime', count:10,
      requiresStory:'star_sign', lockedLine:'…氷の里は星の導きで来た者だけを客と認める。',
      intro:['星の導きで来たか。ならば頼みがある。氷が汚れておっての。','アイススライムを10体、清めてくれ。'],
      done:['氷が澄んだ…礼に古い言い伝えを。「北東の海の雷鳴は嵐の塔の鐘の音」。','星嵐の大陸の北の果てに、塔の街がある。地図に記そう。'],
      reward:{ coins:260, hintBase:'b_storm', story:'frost_gate' } },
  ],
  b_forge: [
    { id:'sq_hagane', npc:'npc_smith', npcName:'弟子ハガネ', type:'delivery', need:{ mats:{ scrap:20 } },
      requiresStory:'white_beam', lockedLine:'親方の炉は一見さんお断りだ。灯台の光を辿って来た証でもあれば別だがよ。',
      intro:['灯台の光を辿って来たのか!なら手伝ってくれ。','親方の大炉に鉄クズ20。神鉄を打つんだ。'],
      done:['いい火だ…!これで神鉄が打てる。','親方が言ってた。「昔、死んでも生き返る旅人の得物を打った。あいつは果ての城へ向かった」…あんたと同じ人だろ?','親方からの伝言だ。「腕を磨いて、また来い」。'],
      reward:{ coins:400, mats:{ scale:2 }, story:'forge_hammer' } },
  ],
  b_moon: [
    { id:'sq_luna', npc:'npc_miko', npcName:'修道女ルナ', type:'hunt', enemy:'shade', count:10,
      requiresStory:'bones_rite', lockedLine:'…骨の民の祈りを知らぬ方に、月の祈りは届きません。',
      intro:['ここは月の修道院。夜ごとシェイドが祈りを乱すのです。','10体、鎮めていただけますか。'],
      done:['月光が戻りました…祈りの中で視えたのです。','遥か南東の「墓標の祭壇」に、大きな悲しみが集っている、と。','…それと、これは修道院からの忠告です。書庫の写本の中には、私たちが「禁じ手」と呼ぶ危うい術も混ざっています。','力を求めすぎた魂は、色が変わってしまう。長く生きて色を変えた魔物と、同じように。','使うなとは申しません。ただ…呑まれませぬよう。'],
      reward:{ coins:350, story:'moon_prayer' } },
  ],
  b_storm: [
    { id:'sq_rai', npc:'npc_smith', npcName:'塔守ライ', type:'delivery', need:{ mats:{ scrap:15 } },
      requiresStory:'frost_gate', lockedLine:'嵐の塔は氷の里の客人しか入れん決まりだ。',
      intro:['この塔は嵐を鎮める鐘楼だ。避雷針が折れちまってな。','鉄クズ15、頼めるか。'],
      done:['鐘が鳴る…嵐が晴れるぞ。晴れた空の東、遥か彼方に見えるだろう。','「太陽の神殿都市」だ。地図に記す。'],
      reward:{ coins:500, hintBase:'b_sun', story:'storm_key' } },
  ],
  b_grave: [
    { id:'sq_tomu', npc:'npc_sage', npcName:'墓守トム', type:'hunt', enemy:'shade', count:8,
      requiresStory:'ember_flame', lockedLine:'…弔いの村に用があるなら、火の民の紹介を持ってきな。',
      intro:['ここは弔いの村。死者が安らかに眠る場所さ。','だがシェイドが墓を暴く。8体、送ってやってくれ。'],
      done:['墓が静かになった…礼に、墓碑に刻まれた言葉を教えよう。','「全ての魂は虚無の門を通る」。西の海の果て、「隠者の庵」だ。地図に記した。'],
      reward:{ coins:450, hintBase:'b_void', story:'grave_watch' } },
  ],
  b_sun: [
    { id:'sq_ra', npc:'npc_elder', npcName:'神官ラー', type:'hunt', enemy:'scarab', count:10,
      requiresStory:'storm_key', lockedLine:'太陽の都は、嵐を越えた者だけを迎える。',
      intro:['よくぞ嵐を越えた。この神殿都市は太陽を祀る。','聖域にスカラベが巣食っておる。10体、頼む。'],
      done:['聖域が清まった。太陽の祝福を受けるがいい。','…最果てに何があるかは、虚無の隠者に聞くことだ。'],
      reward:{ coins:800, mats:{ sunstone:3 }, story:'sun_rite' } },
    { id:'sq_solda', npc:'npc_sage', npcName:'太陽王ソルダ', type:'delivery', need:{ mats:{ sunstone:4 } },
      requiresStory:'sun_rite', lockedLine:'(衛兵に止められた)「王への謁見は、神官ラーの認めた者だけだ。」',
      intro:['余は太陽王ソルダ。この神殿都市の主である。','聖域を清めた者と聞く。ならば頼みがある。王冠の日輪石が欠けてしもうた。','太陽石を4つ、献上せよ。王の頼みを聞ける者など、そうはおらぬぞ?'],
      done:['うむ、見事な石だ。王冠が再び陽を宿した。…褒美を取らせよう。','南東の港町に、王家の船を一隻届けさせた。','南東の沖は流れが速く、並の船では渡れぬ海よ。王家の船で行くがいい。'],
      reward:{ coins:500, port:'p_se', story:'solda_ship' } },
  ],
  b_void: [
    { id:'sq_muu', npc:'npc_sage', npcName:'隠者ムウ', type:'hunt', enemy:'voidwisp', count:8,
      requiresStory:'grave_watch', lockedLine:'……(隠者は目を開かない。弔いの村の言葉を知らぬ者に語る舌はないようだ)',
      intro:['…墓碑の言葉を持つ者よ。虚無は全てを呑むが、庵の静寂だけは守りたい。','ヴォイドウィスプを8体、還してくれ。'],
      done:['静寂が戻った…最後に教えよう。北の果ての海、城の前に「最果ての碑」が立っている。','この世界の終わりと始まりを見届ける場所だ。地図に記す。…良い旅を。'],
      reward:{ coins:1000, hintBase:'b_end', story:'void_call' } },
  ],
  b_sea: [
    { id:'sq_shell', npc:'npc_boy', npcName:'貝の童シェル', type:'hunt', enemy:'crab', count:8,
      intro:['ぼく、都のみんなの貝を集める係なんだ。','でも環礁の外にアイアンクラブがいっぱいで、潜れないよ…8匹お願い!'],
      done:['わーい!これでいっぱい潜れる!','お礼にとっておきの貝、あげるね。'],
      reward:{ coins:450, mats:{ shell:6 }, story:'shell_kid' } },
  ],
  b_end: [
    { id:'sq_ou', npc:'npc_sage', npcName:'城主オウ', type:'hunt', enemy:'hornedimp', count:10,
      requiresStory:'void_call', lockedLine:'……(城主は玉座から動かない。隠者の言葉なくして謁見は叶わない)',
      intro:['隠者の導きで来たか。余はこの最果ての城の主。','…その目。懐かしいものを見た。','城内にデーモンどもが巣食った。10体、討ち払え。話はそれからだ。'],
      done:['見事だ。…では約束通り、余の話をしよう。','余の名はオウ。かつて――お前と同じ「死に戻り」であった。','幾百の生を重ね、広場に祭壇を築き、写本を残し、この果てまで辿り着いた。','だが終焉の刻の、その先へは…行けなんだ。だから余はここで、次の魂を待っておった。','砦の老兵が見た旅人も、遺跡の装置を調整した者も、鍛冶神に得物を打たせた者も…全て余だ。','余が越えられなかった終焉の刻を、超えてみせよ。その先で、また会おう。'],
      reward:{ coins:2000, story:'end_throne' } },
  ],
};
DATA.QUESTS = {
  // ゲート解放クエスト: どの依頼も「その土地のゲートがなぜ使えないか」を解決する話にする。
  // --- 始まりの大陸 ---
  b_north: { npc:'npc_elder', npcName:'老兵ガルド', type:'hunt', enemy:'skeleton', count:4,
    intro:['…おお、生きた人間か。ワシはこの砦の最後の守り兵じゃ。','砦の奥にはな、魂の広場へ通じる古いゲートが眠っておる。じゃが夜な夜な骸骨どもが湧いて、火を灯す暇もない。','奴らを4体、討ち払ってくれんか。ゲートの前だけでも静けさを取り戻したい。'],
    done:['見事じゃ…!これでゲートに火を灯せる。','…お前さん、「死に戻り」の魂じゃな。死んでも魂があの広場に還って、そこで鍛えた力ごと戻ってくる――そういう魂よ。ワシら年寄りには分かる。','昔もう一人だけ、同じ魂を見た。魂の広場の祭壇を築いた御仁じゃ。','その御仁は「果ての城を目指す」と言い残して、消えた。…お前さんは二人目じゃよ。','見ろ、ゲートが灯った。お前さんの魂の広場と、この砦が繋がったんじゃ。いつでも戻ってこい。'] },
  b_east: { npc:'npc_scholar', npcName:'考古学者リナ', type:'hunt', enemy:'goblin', count:4,
    intro:['きゃっ!?…な、なんだ人間か。私はこの遺跡を調べてる研究者。','この遺跡の正体はね、大昔の転送ゲート。魂の広場に繋がる装置なの。','なのにゴブリンたちがいじり回して…壊れちゃう前に4体追い払って!'],
    done:['助かった〜!…ほら、ゲートが目を覚ました。','これで魂の広場から直接ここへ来られるわよ。研究の成果、期待してて。'] },
  b_south: { npc:'npc_miko', npcName:'泉の巫女スズ', type:'survive', enemy:'slime', time:18,
    intro:['旅の方…この泉の底には、魂の広場へ通じる古いゲートが沈んでいるのです。','ですが泉が穢れて、ゲートの光が届かなくなってしまいました。','今から浄化の祈りを捧げます。18秒間、私を守ってください。'],
    done:['…祈りが届きました。泉が澄んで、底のゲートが光を取り戻しています。','この泉の加護、あなたの魂に結びました。いつでもお戻りください。'] },
  b_west: { npc:'npc_smith', npcName:'鍛冶師ドバン', type:'delivery', need:{ coins:20, mats:{wood:5, scrap:3} },
    intro:['おう、客か?街のゲートなら期待するな。火が落ちて、ただの鉄くれよ。','ありゃ炉の火を分けて灯す仕組みでな。まず炉に火を入れ直さにゃならん。','木材5・鉄クズ3、それと手間賃 🪙20。払ってくれりゃ、ゲートも灯してやるぜ。'],
    done:['よぉし、火が入った!見ろ、ゲートまで赤々と灯ってやがる。','この炉の音が聞こえる限り、ここはお前の家だ。'] },
  // --- 第1環 ---
  b_dragon: { npc:'npc_elder', npcName:'竜骨の番人', type:'hunt', enemy:'lizard', count:4,
    intro:['この集落のゲートはな、竜の骨を組んで建てられておる。','骨には今も竜の力が流れ、それがゲートを灯す。じゃがリザードマンどもが骨を喰らい、灯りが細る一方じゃ。','4体討て。さすればゲートは息を吹き返す。'],
    done:['骨をかじる音が止んだ…見よ、ゲートに竜の力が満ちていく。','竜はお前を認めたようじゃ。'] },
  b_dusk: { npc:'npc_sage', npcName:'黄昏の詩人ヨル', type:'survive', enemy:'bat', time:21,
    intro:['ようこそ、夕暮れがずっと続く国へ。私は光を集めて詩を書く者。','この里のゲートは変わり者でね。正しい詩を聞かせてやらないと、目を覚まさないんだ。','今から目覚めの詩を詠む。詠み終わるまでの21秒、闇の獣から守っておくれ。'],
    done:['ああ…詩が届いた。ほら、ゲートが薄明かりの中で輝いてる。','君の旅路に、黄昏の祝福を。'] },
  b_star: { npc:'npc_miko', npcName:'星読みのミラ', type:'survive', enemy:'wisp', time:24,
    intro:['この祭壇のゲートは、星の光を集めて灯る仕組みなのです。','ですが星の光を喰らう精霊たちが集まって、灯りが点きません。','今から星灯りをゲートへ導く儀式を行います。24秒、私を守ってください。'],
    done:['…灯りました。星の光がゲートに届いています。','あなたの星は、とても強く輝いていますよ。'] },
  b_green: { npc:'npc_elder', npcName:'森の長オルガ', type:'delivery', need:{ coins:200, mats:{wood:20, hide:10} },
    intro:['この森は生きておる。よそ者の使うゲートなど、木の根で覆って封じてしもうた。','…だが、森への捧げ物があれば根も解けよう。','木材20・毛皮10・🪙200。森の掟じゃよ。'],
    done:['よかろう。…ほれ、根がゲートから離れていく。','森はお前を「友」と認めた。'] },
  b_white: { npc:'npc_sailor', npcName:'灯台守ハク', type:'hunt', enemy:'crab', count:4,
    intro:['この灯台の光はな、沖の船だけでなく、麓の広場のゲートも灯しておるんじゃ。','なのにアイアンクラブどもが土台を齧って、光が揺れる揺れる。','4匹叩き落としてくれ。灯りが消えりゃ、ゲートも眠っちまう。'],
    done:['…見ろ、この光だ!まっすぐ伸びて、ゲートまで届いとる。','海の果てまで照らしてやるわい。ありがとうな。'] },
  b_black: { npc:'npc_sage', npcName:'黒曜の修行僧', type:'hunt', enemy:'wisp', count:5,
    requiresStory:'dusk_song',
    lockedLine:'…(修行僧は目を閉じたまま、動かない)「扉を開く詩を知らぬ者に、語る言葉はない」…黄昏の前哨の詩人なら、その詩を知っていそうだ。',
    intro:['…この祠のゲートは、静まりかえった心にしか開かれぬ。','だが彷徨える光魂(ウィスプ)が5つ、祠の静けさを乱しておる。','斬れ。それがお前の修行であり、ゲートを開く鍵だ。'],
    done:['…見事な太刀筋。祠は静けさを取り戻し、ゲートが開いた。','この祠はお前の心の拠り所となろう。'] },
  // --- 中間の小島 ---
  b_mist:  { npc:'npc_sage', npcName:'霧の番人', type:'survive', enemy:'bat', time:21,
    intro:['霧は全てを隠す…この村のゲートさえもな。','観測所の鏡で霧の切れ目を読めば、ゲートまで光を通せる。じゃが、その観測所が壊れておっての。','今から直しに行く。21秒間、霧の獣から守ってくれ。'],
    done:['直った…見ろ、霧が割れてゲートが姿を現した。','お前には、この島の全てが見えるだろう。'] },
  b_bones: { npc:'npc_smith', npcName:'骨商人ザリ', type:'delivery', need:{ coins:500, mats:{bone:18, hide:8} },
    intro:['へっへっへ…こんな荒野に客とは珍しい。','ここのゲートを見たか?骨組みが半分崩れて、ありゃ灯らねえよ。','ワシは骨を商う者。骨18・毛皮8、手間賃🪙500で、ゲートの骨組みを組み直してやろう。'],
    done:['まいどあり!ほれ、見事な骨組みだろう。ゲートも灯った。','ここはアンタの取引所だ。'] },
  b_ember: { npc:'npc_smith', npcName:'火の子エン', type:'hunt', enemy:'orc', count:4,
    intro:['この島のゲートはね、おばあちゃんの形見の火で灯ってるんだ。','でもオークたちがその火を消そうとしてる!火が消えたら、ゲートも消えちゃう!','4体やっつけて!お願い!'],
    done:['やったー!火が守られた!ゲートの灯りも、ほら、あんなに明るい!','あんた、かっこいいね!'] },
  b_frost: { npc:'npc_miko', npcName:'氷の隠者フユ', type:'survive', enemy:'wisp', time:21,
    intro:['…寒いでしょう。ここは時が凍る島。ゲートも厚い氷の中で眠っています。','これから氷を解かす祈りを捧げます。','21秒…氷の精霊たちから、私を守ってくださいな。'],
    done:['…ありがとう。ほら、氷が解けて、ゲートが息をしています。','この祠の氷は、もうあなたを拒みません。'] },
  // --- 第2環 ---
  b_forge: { npc:'npc_smith', npcName:'鍛冶神の弟子ゴウ', type:'delivery', need:{ coins:3000, mats:{scrap:25, magic:5} },
    requiresStory:'white_beam',
    lockedLine:'「うちは一見さんお断りだ。白亜の灯台の光を辿って来た証もねえ奴に、神の金床は触らせられん」…まずは灯台の街で信を得る必要がありそうだ。',
    intro:['ここは鍛冶神の工房…師匠は溶岩の底で眠っている。','この都市のゲートは骨組みが焼け割れてな。直すには、神の金床で打ち直すしかねえ。','工房を動かすぞ。鉄クズ25・魔石5・🪙3000。それでゲートも打ち直してやる。'],
    done:['聞こえるか?金床が歌ってる。ゲートの骨組みも打ち直した。','神の工房はお前を歓迎している!'] },
  b_moon:  { npc:'npc_sage', npcName:'月の使者ツクヨ', type:'hunt', enemy:'knight', count:4,
    intro:['この社のゲートは、月の光を浴びて灯る。','だが月影に巣食う闇の騎士どもが、その光を喰らっておるのだ。','4体、斬ってくれ。月光が戻れば、ゲートも目を覚ます。'],
    done:['月光が戻った…ゲートが青白く灯っておる。','社はお前に開かれた。'] },
  b_storm: { npc:'npc_scholar', npcName:'嵐の観測士ライ', type:'survive', enemy:'wisp', time:25,
    intro:['来たか!ちょうどいい!この塔のゲートは、雷が落ちるたびに壊れちまう。','今から避雷針をゲートの上に立て直す!雷雲の芯が通り過ぎる25秒間、機材を守ってくれ!','死ぬなよ!'],
    done:['付いたぞ!もうゲートに雷は落ちん!','世紀の大工事だ!塔はお前にも開放する!'] },
  b_grave: { npc:'npc_sage', npcName:'墓守グレイ', type:'hunt', enemy:'necro', count:3,
    intro:['ここは魔界との境…死者が安らかに眠るべき村さ。','だがネクロマンサーどもが死者を弄び、その澱んだ気配がゲートの光を塞いでいる。','3体でいい。奴らは逃げ足が速いぞ。'],
    done:['澱みが晴れて、ゲートの光が戻った。','…終焉の刻が来るたび、荒野はリーパーの大群に呑まれる。呑まれた亡骸は、光の残るこの村へ運ばれてくるのさ。','ここはそういう村…死者を弔う、世界の受け皿だ。','死者たちも感謝している。この村はお前の味方だ。'] },
  // --- 第3環 ---
  b_sun:  { npc:'npc_miko', npcName:'太陽の神官サナ', type:'hunt', enemy:'lizard', count:5,
    intro:['ようこそ、灼けつく神殿へ。この都のゲートは、日輪の鏡が集めた陽の光で灯ります。','ですがリザードマンが鏡の間に巣食い、光を遮っているのです。','5体討つこと。それが入信の儀式です。太陽はすべてを見ていますよ。'],
    done:['光が通りました。ご覧なさい、ゲートが黄金に輝いています。','太陽はあなたを祝福しました。神殿の力をお使いなさい。'] },
  b_void: { npc:'npc_sage', npcName:'虚無の囁き', type:'hunt', enemy:'demon', count:5,
    intro:['……来たか。ここは在って無い場所。','この庵のゲートは、完全な静けさの中でだけ開く。だがデーモンが5体、騒がしくてかなわん。','排せ。さすれば道は開く。'],
    done:['……良い。静けさが戻り、ゲートが開いた。','虚無はお前を通す。'] },
  b_sea: { npc:'npc_miko', npcName:'海の巫女ルカ', type:'survive', enemy:'siren', time:20,
    requiresStory:'umi_dive',
    lockedLine:'「…あなた、どうやってここへ?」巫女は警戒して歌おうとしない。白亜の灯台の潜り手の紹介が要るようだ。',
    intro:['ようこそ、波の上の環礁へ。この足元に、私たちの都が沈んでいます。','都と魂の広場を繋ぐゲートは、この環礁の祭壇から潮の歌で灯すのです。','今から歌います。歌い終わるまでの20秒、海の魔物から私を守ってください。'],
    done:['…歌が届きました。ご覧なさい、海の底からゲートの光が昇ってきます。','沈み都は、あなたを客人として迎えます。'] },
  b_end:  { npc:'npc_elder', npcName:'最果ての賢者', type:'survive', enemy:'reaper', time:25,
    requiresStory:'void_call',
    lockedLine:'「…去れ。虚無の隠者の導きなくして、この碑には触れられぬ」…西の果ての隠者に会わねばならない。',
    intro:['ついに…ここまで来る者が現れたか。','この碑は、最果ての城の前に立つ最後のゲート。じゃが城に近すぎるゆえ、終焉の使者リーパーが絶えず群がってくる。','最後の試練だ。碑のそばで25秒、生き延びてみせよ。碑がお前の魂を覚える。'],
    done:['…見届けた。碑がお前を覚え、ゲートが繋がった。','30分――それがこの世界の限界じゃ。刻が満ちれば、世界の縁からリーパーの大群が押し寄せ、全てを刈り取っていく。','人里がゲートの光の下にしか残っておらんのは、そのせいよ。','…かつて一人、お前と同じ目をした者がこの碑を越え、城へ入った。戻っては来なんだ。','その先に何があったかは、城の主に聞くがいい。お前こそ、終焉に抗う者じゃ。'] },
};
// 港のクエスト(船大工に素材とお金を届けて修理してもらう)
const PORT_FLAVOR = {
  p_e:'東の海流は穏やかだ。初めての航海にゃちょうどいい。', p_ne:'北東の海にはクラゲが多くてな…気をつけな。',
  p_n:'北の海は冷てぇぞ。装備はしっかりな。', p_nw:'北西は霧が出る。方角を見失うなよ。',
  p_w:'西の沖にゃ夕凪の群島が浮かんどる。人は住まんが、夕日と漁場は絶品だ。', p_sw:'南西の海の向こうにゃ、黄昏の大陸が見えるって話だ。',
  p_s:'南の海は嵐が名物だ。腕が鳴るね。', p_se:'南東の沖は流れが速い。腕のいい船乗り向けさ。',
};
// 船大工は港ごとに別人。口ぶりも直す船への思い入れも、それぞれ違う
const PORT_SMITH = {
  p_e:  { open:'おう、あの船かい?嵐で浜に打ち上がってたのを、俺が引き取ったんだ。', close:'初めての航海にゃもってこいの船に仕上げたぜ。良い風を!' },
  p_ne: { open:'ん?あの船が気になるか。持ち主は嵐の晩に消えちまってな…俺が預かってる。', close:'これでどこへでも行ける。あいつの分まで、遠くへ乗ってやってくれ。' },
  p_n:  { open:'寒いだろう。まず焚き火にあたってきな…と言いたいが、あの船の話か?', close:'北の海仕様に締め直した。氷を割って進め!' },
  p_nw: { open:'霧の港へようこそ。あの船は霧で座礁したのさ。骨組みは無事だがね。', close:'霧笛も付けといた。迷ったら音を頼りにな。' },
  p_w:  { open:'夕日が綺麗だろう、ここは。あの船は親父の形見でな…直す金がなかったんだ。', close:'親父の船がまた海に出るとはな。あんたのおかげだ。' },
  p_sw: { open:'船を探してるんだって?ちょうどいい、直し手のない船が一隻あるんだ。', close:'黄昏の大陸まで保証付きだ。行ってきな!' },
  p_s:  { open:'嵐の海を渡りたいってのか?物好きだねえ。なら船も嵐仕様に直さんとな。', close:'嵐で軋んでも壊れやしない。自慢の仕事だ。' },
  p_se: { open:'速い潮を乗りこなす船が要るんだろう?任せな、腕は南東一だ。', close:'流れに乗れば矢のように走る。振り落とされるなよ!' },
};
for (const p of DATA.PORTS) {
  const sm = PORT_SMITH[p.id] || { open:'おう、あの船か?ありゃあ嵐にやられちまってな。', close:'いつでも出航できる。良い風を!' };
  DATA.QUESTS[p.id] = {
    npc:'npc_sailor', npcName:'船大工', type:'delivery', need:p.repair,
    intro:[sm.open, PORT_FLAVOR[p.id] || '海はいいぞぉ。',
      '直してほしけりゃ材料と手間賃を持ってきな。話はそれからだ。'],
    done:['…よし、直ったぜ!マストも帆も新品同様だ。', sm.close] };
}

// 2段階目クエスト(基地解放後、NPCに再度話すと受けられる追加依頼。報酬つき)
DATA.QUESTS2 = {
  b_north: { npcName:'老兵ガルド', offer:'実はな…砦の周りにウルフの群れが居着いてしもうた。狩ってくれんか?',
    type:'hunt', enemy:'wolf', count:8,
    intro:['すまんな、何度も。ウルフどもが物資を狙っておる。','8頭。頼んだぞ。'],
    done:['助かった!これで安心して眠れるわい。','…戦いの中で、倒した魔物が付いてくるのを見たか?あれは「魂の共鳴」。澄んだ魂は、お前の魂と響き合って仲間になるんじゃ。','体を借り直しただけで中身は同じ魂。じゃから同じ種類なら、敵であれ仲間であれ強さも同じよ。','礼にワシの戦術を授けよう。仲間を率いる「誓い」の技じゃ。','(新スキル「老兵の誓い」が素材で取得できるようになった!)','武具庫の錆も落としておいたぞ。(この基地のパワーアップ施設が使えるようになった!)'],
    reward:{ coins:150, mats:{bone:10} } },
  b_east: { npcName:'考古学者リナ', offer:'遺跡の最深部を調査したいの。護衛、お願いできない?',
    type:'survive', enemy:'goblin', time:40,
    intro:['最深部の封印を解析するわ。40秒だけ集中させて。','その間、ゴブリンたちを近づけないで!'],
    done:['解析完了!…すごいわ、これ身体能力を強化する術式よ。あなたにも使えるはず。','いい?素材は魔物の力のかたまり。それを組み合わせて身に宿すのが「スキル」。','ただし宿せるのは旅の間だけ。死ねば力は抜けてしまう。でも宿し方のコツは魂に残るわ。各地の書庫の写本は、それを磨くためのもの。','…それとね、この装置、誰かが先に調整した跡があったの。あなたと同じ、死んでも還ってくる魂の跡が。','あなたには先人がいるのよ。この写本の何冊かも、その人が残したものかもしれない。','最深部の装置も動き出したわ。(この基地のパワーアップ施設が使えるようになった!)'],
    reward:{ mats:{crystal:8, magic:3} } },
  b_south: { npcName:'泉の巫女スズ', offer:'月に一度の大浄化の儀の時期です。また守っていただけますか?',
    type:'survive', enemy:'wolf', time:40,
    intro:['今回の儀式は長丁場です。40秒、お願いします。'],
    done:['…完璧な浄化です。泉が喜んでいます。','ご存知ですか?体は死んでも、魂に刻まれたものは消えません。','広場や各地の施設が鍛えているのは、その魂そのもの。だから死んで戻っても、力は失われないのです。','祭壇は体の記憶を、研究所は知恵を、宿舎は絆を。この泉のような土地の施設は、土地の力を魂に分け与えます。','これは泉の恵み。お持ちください。(この基地のパワーアップ施設が使えるようになった!)'],
    reward:{ coins:200, mats:{jelly:10, crystal:5} } },
  b_west: { npcName:'鍛冶師ドバン', offer:'デカい仕事が入ってな。材料を都合してくれりゃ分け前をやるぜ。',
    type:'delivery', need:{ coins:100, mats:{scrap:12, wood:12} },
    intro:['王都からの発注だ。納期がやべえ。','鉄クズ12・木材12・つなぎの🪙100。頼む!'],
    done:['っしゃあ!間に合った!ほらよ、分け前だ。','(報酬を受け取った!)','ついでにお前さん用の炉も火を入れといた。(この基地のパワーアップ施設が使えるようになった!)'],
    reward:{ coins:500, mats:{magic:4} } },
};

// 手書きのユニーク施設クエスト(主要基地): 施設が使えない「原因そのもの」を討つ
DATA.QUESTS2 = DATA.QUESTS2 || {};
Object.assign(DATA.QUESTS2, {
  b_dragon: { npcName:'竜骨の番人', type:'mark', enemy:'lizard', rank:1,
    markName:'祭具喰らいのリザード', mark:{ x:102700, y:4300 },
    offer:'祭具を呑んだ奴の居所が分かった。取り返してくれんか。',
    intro:['祭具を呑んだ金鱗のリザードが、集落の北東の岩場に居着いておる。','マップに印を付けた。腹の中の祭具ごと、取り返してくれ。'],
    done:['祭具が戻った…!竜の力が集落に流れ出す。','(この基地のパワーアップ施設が使えるようになった!)'],
    reward:{ coins:300 } },
  b_star: { npcName:'星読みのミラ', type:'mark', enemy:'wisp', rank:1,
    markName:'星喰いの長', mark:{ x:138600, y:-108900 },
    offer:'星水晶を吸っているのは、ただのウィスプではありません。長がいます。',
    intro:['祭壇の光を吸い続ける「星喰いの長」…金色に肥え太ったウィスプです。','丘の上に現れます。マップに印を。どうか、討ってください。'],
    done:['星水晶が輝きを取り戻した…祭壇が星の力を注いでくれます。','(この基地のパワーアップ施設が使えるようになった!)'],
    reward:{ coins:350 } },
  b_forge: { npcName:'鍛冶神の弟子ゴウ', type:'mark', enemy:'golem', rank:1,
    markName:'暴走した大炉のゴーレム', mark:{ x:239300, y:-59500 },
    offer:'大炉を占拠してる馬鹿デカいゴーレム、あれを止めてくれ。',
    intro:['大炉の番をさせてたゴーレムが、熱にやられて暴走しちまった。','壊すしかねえ…親方が打った奴だ、せめて一撃で楽にしてやってくれ。マップに印を付けた。'],
    done:['…すまなかったな。大炉は戻った。神鉄の火がお前の力になる。','(この基地のパワーアップ施設が使えるようになった!)'],
    reward:{ coins:500 } },
  b_moon: { npcName:'月の使者ツクヨ', type:'mark', enemy:'shade', rank:1,
    markName:'聖句喰らいのシェイド', mark:{ x:-162400, y:83900 },
    offer:'聖句を喰らう影の正体が知れた。斬ってくれ。',
    intro:['月光の聖句を喰らっていたのは、一体の肥えたシェイドだ。','月の出る丘に現れる。マップに印を付けた。聖句が食い尽くされる前に。'],
    done:['聖句が守られた…月の祈りが修道院に降りる。','(この基地のパワーアップ施設が使えるようになった!)'],
    reward:{ coins:450 } },
  b_sun: { npcName:'太陽の神官サナ', type:'mark', enemy:'scarab', rank:2,
    markName:'日蝕の女王', mark:{ x:305800, y:-110800 },
    offer:'日輪の間に巣を張った群れには、女王がいます。',
    intro:['スカラベの群れの奥に、紅く輝く女王がいます。','女王を討たねば、巣は何度でも戻る。マップに印を。太陽の名のもとに。'],
    done:['日輪が輝きを取り戻しました。太陽の力が都に満ちる。','(この基地のパワーアップ施設が使えるようになった!)'],
    reward:{ coins:600 } },
  b_void: { npcName:'虚無の囁き', type:'survive', enemy:'voidwisp', time:25,
    offer:'……庵の静けさを、一度だけ完全に満たしたい。',
    intro:['……今から庵の心臓で「無」を編み直す。','25秒。何者にも邪魔をさせるな。'],
    done:['……戻った。この庵の力を、お前にも分けよう。','(この基地のパワーアップ施設が使えるようになった!)'],
    reward:{ coins:550 } },
});

// ---- 施設解放クエスト(全基地): ゲート解放後に村のNPCから受けられる。 ----
// 達成するとその基地のパワーアップ施設が目を覚ます(未達成の間、施設は眠っている)。
// 各基地の背景設定に沿ったテンプレートで、未定義の基地ぶんを生成する。
{
  const FACQ = {
    b_dusk:['bat',7,'里の歌碑がコウモリの巣にされてしまったの。','歌碑が響きを取り戻したわ。詩の力が里に満ちていく。'],
    b_green:['boar',6,'社の御神木の根をイノシシが荒らすの。','御神木が安らいだ…森の恵みが社に巡り始める。'],
    b_white:['crab',6,'灯台の基部にアイアンクラブが張り付いて光が歪む。','光が真っ直ぐ伸びた。灯りの力が街を照らす。'],
    b_black:['shade',6,'祠の御神体の黒曜石に、シェイドが取り憑いてしまった。','御神体が静まった…黒曜の力が祠に戻る。'],
    b_mist:['wisp',7,'観測レンズが霧の精に曇らされてな。','レンズが澄んだ。観測の知が村の力になる。'],
    b_bones:['skeleton',8,'掟破りの骸骨が祭場を荒らす。','祭場が清まった。祖霊の加護が野営地に宿る。'],
    b_ember:['lavaslime',6,'御神火にラヴァスライムが飛び込んで火が濁った。','御神火が澄んだ…火の民の力がお前にも分けられる。'],
    b_frost:['iceslime',7,'氷の祭壇がスライムの粘りで汚れてしまった。','祭壇の氷が透き通った。霜の加護が里に満ちる。'],
    b_storm:['stormwisp',6,'鐘楼にストームウィスプが巣食って鐘が鳴らせん。','鐘が鳴った!嵐の力が塔に満ちる。'],
    b_grave:['mummy',6,'安置所のマミーが目を覚ましてしまった。','死者が再び眠った…弔いの加護が村に宿る。'],
    b_end:['hornedimp',8,'玉座の間にデーモンが居座っている。','玉座が清められた。最果ての力がお前に開かれる。'],
    b_sea:['crab',7,'都へ空気を送る泉に、アイアンクラブが挟まって詰まってしもうた。','泉が息を吹き返した…都の力が、お前にも流れ込む。'],
  };
  for (const b of DATA.BASES) {
    if (DATA.QUESTS2[b.id] || !DATA.QUESTS[b.id]) continue;
    const f = FACQ[b.id] || ['slime', 6, 'この土地の施設が魔物に荒らされている。', '施設が静けさを取り戻した。'];
    DATA.QUESTS2[b.id] = {
      npcName: DATA.QUESTS[b.id].npcName,
      offer: f[2].split('。')[0] + '。どうか力を貸してほしい。',
      type: 'hunt', enemy: f[0], count: f[1],
      intro: ['相手は' + DATA.ENEMIES[f[0]].name + '。' + f[1] + '体、頼みたい。',
              '片付けば、施設も目を覚ますはずだ。'],
      done: [f[3], '(この基地のパワーアップ施設が使えるようになった!)'],
      reward: { coins: 200, mats: {} },
    };
  }
}


// エピローグ: 城主オウの物語を見届けた後、各地のNPCの第一声が変わる
DATA.EPILOGUE = {
  b_north: '…果ての城の主の話、聞いたぞ。先代の御仁も、ようやく肩の荷を下ろせたんじゃろうな。',
  b_east:  'あなた、本当に世界の果てまで行ったのね…!私の研究、百年ぶんは進むわ。',
  b_south: '果ての城まで辿り着いた魂…泉の水が、今日はひときわ澄んでいます。',
  b_west:  '王家の発注より、お前さんの得物を打つ方が名誉ってもんだぜ。',
  b_dragon:'竜も、果てに辿り着いた魂の話をしておる。誇るがよい。',
  b_sun:   '太陽は全てを見ていました。あなたが果てで交わした約束も。',
  b_void:  '……見てきたか。ならば、もう語る言葉は要らぬ。',
  b_end:   'お前が来てから、碑の光が優しくなった。…また、その先へ行くのだろう?',
};

// NPCの豆知識(再会話で1つ話してくれる)
// 依頼を持たないふつうの住民。基地ごとに2人が住んでいて、世間話と豆知識をくれる
DATA.VILLAGERS = [
  { spr:'npc_boy',    name:'村の子',     line:'ゲートが灯ってから、夜もこわくないんだ。とうさんが「あの光は魔物よけだ」って。' },
  { spr:'npc_girl',   name:'洗濯娘',     line:'あなたの軍勢、最初はびっくりしたけど…礼儀正しい魔物さんたちね。' },
  { spr:'npc_elder',  name:'ご隠居',     line:'わしが若い頃は、ゲートの外へ出る者などおらんかった。時代は変わるものよ。' },
  { spr:'npc_miner',  name:'荷運び',     line:'行商人が街道を歩けるのも、あんたが魔物を減らしてくれてるおかげさ。' },
  { spr:'npc_sailor', name:'渡りの漁師', line:'海にも魔物の縄張りがある。海域が変われば、獲れるもんも変わるのさ。' },
  { spr:'npc_scholar',name:'書生',       line:'「死に戻り」の研究をしてるんです。魂が広場に還る仕組み…いつか解き明かしたい。' },
  { spr:'npc_miko',   name:'祈り手',     line:'還らぬ魂のために、毎朝祈っています。あなたのような方は…どうか、御無事で。' },
  { spr:'npc_smith',  name:'鍛冶見習い', line:'親方が言ってました。「いい武器より、いい仲間だ」って。あなたを見てると分かります。' },
];

DATA.NPC_TIPS = [
  'ヒーラー系の魔物と共鳴できれば、今度はお前と軍勢を回復してくれる。狙う価値があるぞ。',
  'バイオドームごとに住む魔物が違う。欲しい素材は、それを落とす魔物の土地で狩るんだ。',
  '虹色に光るスライムを見たら追え。「虹のかけら」は奴しか落とさん。',
  '金色に輝く古木や真珠貝…レアなオブジェクトには専用素材が眠っている。',
  '30分経つと「終焉の刻」…世界の縁からリーパーの大群が押し寄せてくる。備えなしでは生き残れんぞ。',
  '危険度の数字が高い土地ほど敵は強いが、コインも素材も美味い。',
  '船の速度は研究所の「帆の改良」で上がる。遠海に行くなら必須だ。',
  '仲間が増えると視界が広がる。軍勢の合戦は壮観だぞ。',
  '攻撃手段やスキルには前提があるものも。前のものを鍛えると次の道が開ける。',
  '色違いの魔物は同じ種類でも段違いに強い。金より紅、紅より紫だ。',
  '長く生きた魔物は土地の力を吸って体の色が変わる。姿は同じでも中身は別物…だが仲間にすれば、その力ごとお前のものだ。',
  '倒した魔物が仲間になることがあるだろう?魂どうしが響き合う「共鳴」って現象だ。澄んだ魂ほど起きやすい。',
  '村の施設が調子を悪くしていたら、村人に話を聞いてみることだ。大抵、困りごとと繋がっているものさ。',
  'お前さんみたいに死んでも還ってくる魂を「死に戻り」と呼ぶ。災いの前触れと恐れる村もあるが、気にするな。',
  '終焉の刻が来るたび、荒野はリーパーの大群に呑まれる。ゲートの光が守る村しか、人里は残らなかったのさ。',
  '仲間の魔物を連れて村に入っても心配ない。ゲートの光が弾くのは、敵意のあるものだけだ。',
  '狩人の掟「金は挑め、紅は退け、紫は語るな」。色違いに出会ったら思い出せ。',
  '北西の海に人の住まん「夕凪の群島」がある。魔物と素材の宝庫だ。船があるなら行ってみな。',
  '海にも土地と同じで「海域」がある。珊瑚の海と深淵の海じゃ、出る魔物も獲れる素材もまるで違う。',
  '港の貿易商と、村はずれの小道を歩く行商人は素材とコインを取引してくれる。相場は日々変わるぞ。',
  '村の依頼板には周回ごとに新しい依頼が貼り出される。ちょっとした小遣い稼ぎにな。',
];

DATA.STATIONS = {
  altar: { name:'強化の祭壇',   sprite:'st_altar', desc:'かつての死に戻りが築いた祭壇。魂に刻んだ戦いの記憶を研ぎ直す(基礎能力)' },
  lab:   { name:'素材研究所',   sprite:'st_lab',   desc:'魔物の素材に宿る力を解き明かす(素材と経済)' },
  camp:  { name:'仲間の宿舎',   sprite:'st_camp',  desc:'仲間になった魂たちが暮らす場所(仲間の強化)' },
  lib:   { name:'スキル書庫',   sprite:'st_lib',   desc:'先人の残した写本の書庫。スキルを身に宿すコツを伝える(スキル)' },
};

// ---- 眠っている施設の「見た目の状態」 ----
// 施設解放クエスト未達成の間、調べるとこの観察文が出る。
// 説明書きではなく、その施設がなぜ使えないかが自然と分かる描写にする。
DATA.FAC_STATE = {
  b_north: { tag:'武具庫が錆びついている', look:['武具庫の扉は錆びつき、固く閉ざされている。','隙間から見える武具は、どれも埃をかぶったままだ…'] },
  b_east:  { tag:'装置が沈黙している',     look:['遺跡の装置は沈黙し、紋様に光はない。','中心の水晶が、力なく濁っている…'] },
  b_south: { tag:'泉が濁っている',         look:['泉の水は淀み、癒しの気配は感じられない。','水面に映る自分の顔さえ、ぼやけて見える…'] },
  b_west:  { tag:'炉が冷えている',         look:['大きな炉だが、火の気がまるでない。','灰は冷え切って、鉄の匂いだけが残っている…'] },
  b_dragon:{ tag:'祭具が失われている',     look:['竜骨の祭壇…だが、在るべき祭具が見当たらない。','骨の台座だけが、ぽつんと残されている…'] },
  b_dusk:  { tag:'歌碑が汚れている',       look:['里の歌碑は汚れ、刻まれた詩が読めなくなっている。','歌声の代わりに、コウモリの羽音だけが響いている…'] },
  b_star:  { tag:'星水晶が曇っている',     look:['祭壇の星水晶は曇り、瞬きひとつしない。','頭上の星々だけが、悲しげに瞬いている…'] },
  b_green: { tag:'御神木が弱っている',     look:['御神木の根元は無残に掘り返され、葉が力なく垂れている。','木肌に触れても、恵みの気配は返ってこない…'] },
  b_white: { tag:'灯りが歪んでいる',       look:['灯台の光がゆらゆらと歪み、まともに沖を照らせていない。','基部から、何かが金属を齧る音がする…'] },
  b_black: { tag:'御神体が憑かれている',   look:['祠の御神体…黒曜石の塊が、黒い靄にまとわりつかれている。','近づくと、ひやりとした悪意が肌を撫でた…'] },
  b_mist:  { tag:'レンズが曇っている',     look:['観測所のレンズは白く曇り、何も映さない。','拭っても拭っても、霧が内側から滲んでくる…'] },
  b_bones: { tag:'祭場が荒れている',       look:['祖霊の祭場は骨が散乱し、めちゃくちゃに荒らされている。','これでは祖霊も安らげまい…'] },
  b_ember: { tag:'御神火が濁っている',     look:['御神火の炎がどす黒く濁り、嫌な煙を上げている。','これでは火の民の力も借りられそうにない…'] },
  b_frost: { tag:'祭壇が汚れている',       look:['氷の祭壇がぬめった粘液に覆われている。','澄んでいたはずの氷が、これでは台無しだ…'] },
  b_forge: { tag:'大炉が占拠されている',   look:['大炉の前に、巨大なゴーレムが仁王立ちしている。','とても近づける状態ではない…'] },
  b_moon:  { tag:'聖句が蝕まれている',     look:['月光の聖句が黒い影に蝕まれ、文字が欠けていく。','祈りの言葉が、途切れ途切れにしか読めない…'] },
  b_storm: { tag:'鐘が鳴らない',           look:['鐘楼の鐘に光の渦が巣食い、綱を引いても鳴らない。','バチバチと、雷の精の唸る音だけがする…'] },
  b_grave: { tag:'死者が眠れずにいる',     look:['安置所の中から、包帯を引きずる音がする。','死者が安らかに眠れていない…'] },
  b_sun:   { tag:'日輪が曇っている',       look:['日輪の間は虫の巣で覆われ、黄金の輝きがくすんでいる。','カサカサと、無数の羽音がする…'] },
  b_void:  { tag:'静けさが失われている',   look:['庵の静けさが乱れ、空間がわずかに軋んでいる。','心を鎮める修行の場だというのに、これではとても集中できない…'] },
  b_end:   { tag:'玉座が穢れている',       look:['玉座の間は瘴気に満ち、禍々しい気配が渦巻いている。','デーモンの哄笑が、どこからか聞こえる…'] },
  b_sea:   { tag:'空気の泉が詰まっている', look:['環礁の祭壇の脇、都へ空気を送る泉がごぼごぼと苦しげに詰まっている。','海の底の都の灯りが、心なしか暗い…'] },
};

// 敵の強さは種類+色違いランクで固定(時間による個体強化は廃止)
DATA.DIST_RING = 2600;         // 距離リング幅(px)。バイオドーム(約1分=2600px)を1つ越えるごとに危険度+1
DATA.REAPER_AT = 1800;         // 終焉の刻(秒)
DATA.WORLD_EXTENT = 860000;    // 世界の半径(ミニマップ用)
