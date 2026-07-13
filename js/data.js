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
  // レア源限定素材(特定のレアモンスター/レアオブジェクトしか落とさない)
  prism:   { name:'虹のかけら',     color:'#e879f9', tier:4 },
  amber:   { name:'太古の琥珀',     color:'#f59e0b', tier:3 },
  pearl:   { name:'真珠',           color:'#f1f5f9', tier:3 },
};

// コスト生成ヘルパ: lv(1〜)に応じて素材要求が増え、高レベルで上位素材が混ざる
function matCost(lv, base, extras){
  // base: {mat: qty} lv1時 / extras: [{from: lv, mat, qty}]
  const c = {};
  const mul = 1 + (lv - 1) * 0.8;
  for (const m in base) c[m] = Math.ceil(base[m] * mul);
  if (extras) for (const e of extras) {
    if (lv >= e.from) c[e.mat] = Math.ceil(e.qty * (1 + (lv - e.from) * 0.5));
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
    cost:(lv)=>matCost(lv,{bone:5,crystal:3},[{from:3,mat:'shell',qty:3},{from:6,mat:'scale',qty:1}]),
    lvText:['再展開が早くなる','バリア展開時に周囲を弾き飛ばす','ストック+1','再展開がさらに早く','割れた時に爆発ダメージ','ストック+1'],
    stats:(lv)=>({ stocks:1+(lv>=4?1:0)+(lv>=7?1:0), cd:14*(lv>=2?0.75:1)*(lv>=5?0.7:1),
      knock:(lv>=3), burst:(lv>=6?60:0) }),
  },
  sanctuary: {
    name:'サンクチュアリ', cat:'sup', icon:'sk_sanct',
    desc:'自分と仲間のHPを徐々に回復するオーラ。',
    cost:(lv)=>matCost(lv,{jelly:6,shell:2},[{from:3,mat:'magic',qty:2},{from:6,mat:'coral',qty:3}]),
    lvText:['回復量+60%','範囲拡大(仲間に届きやすく)','回復量+60%','オーラ内の敵を微減速','回復量+80%・範囲拡大'],
    stats:(lv)=>({ hps:1.5*Math.pow(1.6,(lv>=2?1:0)+(lv>=4?1:0))*(lv>=6?1.8:1),
      radius:110+(lv>=3?50:0)+(lv>=6?50:0), slow:(lv>=5?0.15:0) }),
  },
  magnetSk: {
    name:'マグネットフィールド', cat:'sup', icon:'sk_magnet',
    desc:'アイテムの回収範囲が広がる。',
    cost:(lv)=>matCost(lv,{scrap:3,jelly:3}),
    lvText:['回収範囲+40%','たまに全画面吸引(30秒毎)','回収範囲+50%','全画面吸引の間隔-10秒'],
    stats:(lv)=>({ mult:1.5+(lv>=2?0.4:0)+(lv>=4?0.5:0), vacuum:(lv>=3), vacuumCd:(lv>=5?20:30) }),
  },
  boots: {
    name:'ヘルメスの靴', cat:'sup', icon:'sk_boots',
    desc:'移動速度が上がる。逃げる敵(ヒーラー等)を追うのに必須級。',
    cost:(lv)=>matCost(lv,{hide:4,bone:3}),
    lvText:['移動速度+8%','ダッシュの残像が敵にダメージ','移動速度+10%','移動速度+12%'],
    stats:(lv)=>({ mult:1.1+(lv>=2?0.08:0)+(lv>=4?0.10:0)+(lv>=5?0.12:0), trail:(lv>=3?5:0) }),
  },
  warbanner: {
    name:'ウォーバナー', cat:'ally', icon:'sk_banner',
    desc:'仲間の攻撃力とHPを強化する軍旗。仲間主体の戦術に。',
    cost:(lv)=>matCost(lv,{hide:5,wood:5},[{from:3,mat:'magic',qty:2}]),
    lvText:['仲間攻撃+20%','仲間HP+30%','仲間攻撃+25%','仲間の移動速度+20%','仲間攻撃+35%・HP+35%'],
    stats:(lv)=>({ atk:1.2+(lv>=2?0.2:0)+(lv>=4?0.25:0)+(lv>=6?0.35:0),
      hp:1+(lv>=3?0.3:0)+(lv>=6?0.35:0), spd:(lv>=5?1.2:1) }),
  },
  // ---- 多角スキル: 仲間・敵・武器・経済 ----
  charisma: {
    name:'カリスマの歌', cat:'ally', icon:'sk_charisma',
    desc:'【仲間】歌声で敵の心を掴む。敵が仲間になる確率が上がる(仲間数に上限なし)。',
    cost:(lv)=>matCost(lv,{jelly:4,hide:4},[{from:4,mat:'crystal',qty:3},{from:7,mat:'star',qty:1}]),
    lvText:['勧誘確率+3%','仲間の全能力+8%','勧誘確率+4%','仲間の全能力+8%','勧誘確率+5%','全能力+8%・確率+6%'],
    stats:(lv)=>({ recruit:0.03+(lv>=2?0.03:0)+(lv>=4?0.04:0)+(lv>=6?0.05:0)+(lv>=7?0.06:0),
      allyMul:Math.pow(1.08,(lv>=3?1:0)+(lv>=5?1:0)+(lv>=7?1:0)) }),
  },
  bond: {
    name:'魂の共鳴', cat:'ally', icon:'sk_bond',
    desc:'【仲間】絆が力になる。仲間1体につき自分の攻撃力が上がる。',
    cost:(lv)=>matCost(lv,{bone:4,jelly:4},[{from:3,mat:'magic',qty:2},{from:6,mat:'star',qty:1}]),
    lvText:['攻撃+4%/体に強化','仲間1体につき被ダメ-1%','攻撃+5%/体に強化','仲間になった敵のHP+20%','攻撃+7%/体に強化'],
    stats:(lv)=>({ atkPerAlly:0.03+(lv>=2?0.01:0)+(lv>=4?0.01:0)+(lv>=6?0.02:0),
      defPerAlly:(lv>=3?0.01:0), allyHp:1+(lv>=5?0.2:0) }),
  },
  fear: {
    name:'威圧のオーラ', cat:'foe', icon:'sk_fear',
    desc:'【敵弱体】周囲の敵が怯み、攻撃力が下がる。',
    cost:(lv)=>matCost(lv,{bone:5,hide:4},[{from:3,mat:'magic',qty:2},{from:6,mat:'scale',qty:1}]),
    lvText:['弱体化+10%','オーラ範囲拡大','弱体化+5%','弱体化+10%','オーラ範囲拡大','瀕死の敵が逃げ出す'],
    stats:(lv)=>({ radius:150+(lv>=3?45:0)+(lv>=6?65:0),
      reduce:Math.min(0.6, 0.15+(lv>=2?0.10:0)+(lv>=4?0.05:0)+(lv>=5?0.10:0)), flee:(lv>=7) }),
  },
  sharpen: {
    name:'武器研磨', cat:'sup', icon:'sk_sharpen',
    desc:'【武器】装備中の攻撃手段の威力が大きく上がる。周回内の火力成長の柱。',
    cost:(lv)=>matCost(lv,{scrap:4,wood:3},[{from:4,mat:'crystal',qty:3},{from:7,mat:'scale',qty:1}]),
    lvText:['威力+14%','威力+14%','会心率+5%・威力+14%','威力+14%','会心率+7%・威力+14%','威力+14%','威力+14%','威力+14%','威力+14%'],
    stats:(lv)=>({ mult:Math.pow(1.14, lv),
      crit:(lv>=4?0.05:0)+(lv>=6?0.07:0) }),
  },
  focus: {
    name:'速撃の構え', cat:'sup', icon:'sk_focus',
    desc:'【武器】攻撃の間隔が短くなり、手数が増える。',
    cost:(lv)=>matCost(lv,{crystal:3,bone:4},[{from:4,mat:'magic',qty:3},{from:6,mat:'star',qty:1}]),
    lvText:['攻撃間隔-5%','効果範囲+10%','攻撃間隔-5%','効果範囲+10%','攻撃間隔-6%','攻撃間隔-4%','攻撃間隔-4%'],
    stats:(lv)=>({ cdr:0.06+(lv>=2?0.05:0)+(lv>=4?0.05:0)+(lv>=6?0.06:0)+(lv>=7?0.04:0)+(lv>=8?0.04:0),
      area:(lv>=3?1.1:1)*(lv>=5?1.1:1) }),
  },
  vampire: {
    name:'吸血の刻印', cat:'sup', icon:'sk_vampire',
    desc:'【主人公】敵を倒すとHPを吸収する。',
    cost:(lv)=>matCost(lv,{hide:5,jelly:4},[{from:3,mat:'magic',qty:2},{from:6,mat:'abyss',qty:1}]),
    lvText:['吸収量+2','与ダメージの1%を回復','吸収量+3','与ダメ回復2%に強化','吸収量+5','与ダメ回復3%に強化'],
    stats:(lv)=>({ killHeal:3+(lv>=2?2:0)+(lv>=4?3:0)+(lv>=6?5:0),
      lifesteal:(lv>=3?0.01:0)+(lv>=5?0.01:0)+(lv>=7?0.01:0) }),
  },
  treasure: {
    name:'トレジャーハント', cat:'sup', icon:'sk_treasure',
    desc:'【経済】コインと素材のドロップが増える。',
    cost:(lv)=>matCost(lv,{wood:4,scrap:4},[{from:4,mat:'shell',qty:4},{from:6,mat:'star',qty:1}]),
    lvText:['素材ドロップ+15%','コイン+15%','素材が2個落ちる確率+5%','素材ドロップ+20%','素材2個の確率+8%'],
    stats:(lv)=>({ coin:1.15*(lv>=3?1.15:1), drop:1.15*(lv>=2?1.15:1)*(lv>=5?1.2:1),
      luck:(lv>=4?0.05:0)+(lv>=6?0.08:0) }),
  },
  confuse: {
    name:'混沌の瘴気', cat:'foe', icon:'sk_confuse', unlock:'lib_sk_confuse',
    desc:'【敵操作】周期的に敵を混乱させ、同士討ちさせる。【要解放】',
    cost:(lv)=>matCost(lv,{magic:3,crystal:5},[{from:4,mat:'star',qty:2}]),
    lvText:['混乱数+1','混乱時間+50%','混乱数+2','再発動-25%','混乱数+2・時間さらに+'],
    stats:(lv)=>({ count:2+(lv>=2?1:0)+(lv>=4?2:0)+(lv>=6?2:0),
      dur:3*(lv>=3?1.5:1)*(lv>=6?1.4:1), cd:8*(lv>=5?0.75:1), radius:340 }),
  },
  curse: {
    name:'衰弱の呪印', cat:'foe', icon:'sk_curse', unlock:'lib_sk_curse',
    desc:'【敵弱体】周期的に周囲の敵を呪い、受けるダメージを増やして減速させる。【要解放】',
    cost:(lv)=>matCost(lv,{magic:4,bone:6},[{from:3,mat:'star',qty:1},{from:5,mat:'abyss',qty:1}]),
    lvText:['被ダメ増+10%','減速強化','再発動-25%','被ダメ増+15%','範囲拡大'],
    stats:(lv)=>({ radius:260+(lv>=6?100:0), shred:0.2+(lv>=2?0.1:0)+(lv>=5?0.15:0),
      slow:0.1+(lv>=3?0.15:0), dur:4, cd:6*(lv>=4?0.75:1) }),
  },
  // ---- 魂の広場で解放するスキル ----
  sands: {
    name:'時の砂', cat:'foe', icon:'sk_sands', unlock:'lib_sk_sands',
    desc:'周期的に周囲の敵の時を遅らせる。終焉の刻の切り札。【要解放】',
    cost:(lv)=>matCost(lv,{star:2,magic:6},[{from:3,mat:'abyss',qty:1}]),
    lvText:['減速率アップ','効果時間+50%','範囲拡大','再発動-25%','ほぼ静止級の減速'],
    stats:(lv)=>({ slow:0.4+(lv>=2?0.15:0)+(lv>=6?0.25:0), dur:3*(lv>=3?1.5:1),
      radius:220+(lv>=4?120:0), cd:12*(lv>=5?0.75:1) }),
  },
  oath: {
    name:'老兵の誓い', icon:'sk_oath', cat:'ally', unlockQuest:'b_north',
    desc:'【クエスト報酬】歴戦の戦術。仲間の攻撃力が上がる。',
    cost:(lv)=>matCost(lv,{bone:6,hide:4}),
    lvText:Array.from({length:9},(_,i)=>`仲間の攻撃力+5%(累計${(i+2)*5}%)`),
    stats:(lv)=>({ passive:{ key:'allyAtkMul', value:0.05*lv } }),
  },
  relic: {
    name:'遺跡の加護', icon:'sk_relic', cat:'kokoroe', unlockQuest:'b_east',
    desc:'【クエスト報酬】古代の術式が全能力(攻撃/HP/速度)を高める。',
    cost:(lv)=>matCost(lv,{crystal:6,magic:2}),
    lvText:Array.from({length:9},(_,i)=>`全能力+1.5%(累計${((i+2)*1.5).toFixed(1)}%)`),
    stats:(lv)=>({ passive:{ key:'allMul', value:0.015*lv } }),
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
    lvText:['威力+50%','2連射になる','連射間隔-20%','威力+60%','3連射になる','貫通+1','連射間隔-25%','威力+80%','4連射・弾速アップ'],
    stats:(lv)=>({ dmg:10*Math.pow(1.5,Math.min(lv-1,3))*(lv>=8?1.8:1)*(lv>=5?1.6:1),
      count:1+(lv>=2?1:0)+(lv>=5?1:0)+(lv>=9?1:0),
      cd:0.9*(lv>=3?0.8:1)*(lv>=7?0.75:1), pierce:(lv>=6?1:0), speed:420*(lv>=9?1.3:1) }),
  },
  axe: {
    name:'ブーメランアクス', icon:'sk_axe', buy:150, up:wcost(60),
    desc:'投げた斧が戻ってくる。往復で2回当たる。',
    lvText:['同時投擲+1','威力+65%','飛距離アップ','同時投擲+1','威力+80%','巨大な斧になる(範囲+)'],
    stats:(lv)=>({ dmg:20*Math.pow(1.65,(lv>=3?1:0)+(lv>=6?1:0)), count:1+(lv>=2?1:0)+(lv>=5?1:0),
      cd:2.0, range:260+(lv>=4?90:0), size:14*(lv>=7?1.7:1) }),
  },
  homing: {
    name:'追尾ミサイル', icon:'sk_homing', buy:250, up:wcost(70),
    desc:'敵を追尾する魔法ミサイルを放つ。',
    lvText:['同時発射+1','威力+70%','同時発射+1','追尾性能・弾速アップ','威力+80%','同時発射+2','爆発するようになる'],
    stats:(lv)=>({ dmg:14*Math.pow(1.75,(lv>=3?1:0)+(lv>=6?1:0)), count:1+(lv>=2?1:0)+(lv>=4?1:0)+(lv>=7?2:0),
      cd:1.6, turn:(lv>=5?7:3.5), speed:300*(lv>=5?1.3:1), blast:(lv>=8?70:0) }),
  },
  orbit: {
    name:'オービットオーブ', icon:'sk_orbit', buy:300, up:wcost(75),
    desc:'自分の周囲を回るオーブ。触れた敵にダメージ。',
    lvText:['オーブ+1','回転速度アップ','威力+75%','オーブ+1','範囲(半径)拡大','威力+80%','オーブ+2・巨大化'],
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
    lvText:['連鎖+2','威力+60%','連鎖+2','攻撃間隔-25%','威力+80%','連鎖+3・射程アップ'],
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
  ['p_shepherd','庇護の心得',     '仲間の最大HP',         'allyHpMul',  .08,  '+8%',    'jelly',8,'wood',7, 'ally'],
  ['p_vanguard','先陣の心得',     '仲間の攻撃力',         'allyAtkMul', .06,  '+6%',    'wood',7,'hide',6,  'ally'],
  ['p_warcry',  '鬨の心得',       '仲間の攻撃間隔短縮',   'allyAtkSpdAdd',.03, '+3%',   'hide',7,'bone',6,  'ally'],
  ['p_mend',    '軍医の心得',     '仲間のHP自動回復',     'allyRegenAdd',.008, '+0.8%/秒','jelly',7,'hide',5,'ally'],
  ['p_stand',   '不倒の心得',     '仲間が倒れても踏みとどまる確率', 'allyReviveAdd', .05, '+5%', 'bone',7,'crystal',5, 'ally'],
  ['p_recruit', '同胞の心得',     '敵が仲間になる確率',   'recruitAdd', .006, '+0.6%',  'hide',6,'jelly',6, 'ally'],
  ['p_swift',   '俊足の心得',     '仲間の移動速度',       'allySpeedMul',.04, '+4%',    'hide',6,'wood',6,  'ally'],
  // 主人公・共通の心得
  ['p_vital',   '生命の心得',     '最大HP',               'maxHpAdd',   15,   '+15',    'jelly',8,'bone',5],
  ['p_guard',   '守りの心得',     '被ダメージ軽減',       'armorAdd',   .02,  '+2%',    'bone',8,'scrap',7],
  ['p_hunter',  '狩人の心得',     'ボスへのダメージ',     'bossMul',    .05,  '+5%',    'hide',10,'scale',4],
  ['p_slayer',  '死神狩りの心得', 'リーパーへのダメージ', 'reaperMul',  .06,  '+6%',    'star',6,'abyss',4],
  ['p_warder',  '終焉守りの心得', 'リーパー被ダメ軽減',   'reaperResAdd',.02, '+2%',    'scale',6,'abyss',4],
  ['p_thorn',   '棘の心得',       '接触反撃ダメージ',     'thornsAdd',  4,    '+4',     'wood',8,'scrap',7],
  ['p_sea',     '海神の心得',     '船の速度',             'boatMul',    .06,  '+6%',    'shell',8,'coral',4],
  ['p_scholar', '学者の心得',     '素材2個ドロップ確率',  'luckAdd',    .03,  '+3%',    'crystal',7,'shell',5],
  ['p_flame',   '火門の心得',     '攻撃の炎上付与確率',   'burnAdd',    .03,  '+3%',    'magic',6,'scale',4],
  ['p_ice',     '氷門の心得',     '攻撃の氷結付与確率',   'slowAdd',    .025, '+2.5%',  'crystal',8,'coral',4],
  ['p_storm',   '雷門の心得',     '自動落雷の威力',       'stormAdd',   12,   '+12',    'magic',7,'star',4],
  ['p_veil',    '霞の心得',       '回避率',               'dodgeAdd',   .01,  '+1%',    'coral',6,'star',4],
  ['p_epoch',   '刻の心得',       '敵の時間強化を緩和',   'mitigAdd',   .015, '+1.5%',  'star',6,'abyss',4],
  ['p_phantom', '幻影の心得',     '被弾後の無敵時間',     'invulnAdd',  .04,  '+0.04秒','magic',7,'coral',4],
  ['p_amber',   '琥珀の心得',     '全能力(攻撃/HP/速度)', 'allMul',     .01,  '+1%',    'amber',6,'wood',10],
  ['p_pearl',   '真珠の心得',     '最大HP',               'hpPctMul',   .03,  '+3%',    'pearl',6,'shell',8],
];
// レベルが上がると必要素材の種類も変化する。序盤は解放不要の素材だけを使う(陸で採れるものを優先)
const FLUX = ['scrap', 'crystal', 'hide', 'wood', 'bone', 'jelly', 'shell'];
PASSIVE_DEFS.forEach(([id, name, effDesc, key, per, unit, ma, qa, mb, qb, cat], idx) => {
  const avail = FLUX.filter(m => m !== ma && m !== mb);   // 基本素材と重複しないもの
  const flux1 = avail[idx % avail.length];               // lv4から加わる新素材
  const flux2 = avail[(idx + 3) % avail.length];         // lv7からさらに別の素材
  DATA.SKILLS[id] = {
    name, icon: 'sk_' + id, cat: cat || 'kokoroe',
    desc: `【心得】${effDesc} ${unit}/Lv。レベルが上がると必要な素材の種類も少しずつ変わる。`,
    cost: (lv) => {
      const c = matCost(lv, { [ma]: qa, [mb]: qb });
      if (lv >= 4) c[flux1] = (c[flux1] || 0) + Math.ceil(1 + (lv - 4) * 0.5);
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
  slime:    { name:'スライム',        hp:12,  dmg:6,  speed:10.8,  r:12, tier:0, env:'land', move:'chase', coin:1, sprite:'en_slime',  drops:[{m:'jelly',c:.4}] },
  bat:      { name:'コウモリ',        hp:8,   dmg:5,  speed:18,  r:10, tier:0, env:'both', move:'chase', coin:1, sprite:'en_bat',    drops:[{m:'hide',c:.3}] },
  skeleton: { name:'スケルトン',      hp:20,  dmg:9,  speed:12,  r:13, tier:0, env:'land', move:'chase', coin:2, sprite:'en_skel',   drops:[{m:'bone',c:.45}] },
  wolf:     { name:'ウルフ',          hp:26,  dmg:11, speed:22.8,  r:13, tier:1, env:'land', move:'chase', coin:3, sprite:'en_wolf',   drops:[{m:'hide',c:.45}] },
  goblin:   { name:'ゴブリン弓兵',    hp:22,  dmg:8,  speed:13.6,  r:12, tier:1, env:'land', move:'chase', ranged:{range:260,cd:2.2,pspeed:60}, coin:3, sprite:'en_goblin', drops:[{m:'wood',c:.35},{m:'scrap',c:.2}] },
  shaman:   { name:'回復シャーマン',  hp:34,  dmg:5,  speed:36, r:13, tier:1, env:'land', move:'kite',  heal:{radius:220,hps:6}, coin:8, sprite:'en_shaman', drops:[{m:'crystal',c:.5},{m:'magic',c:.25}] },
  crab:     { name:'アイアンクラブ',  hp:40,  dmg:10, speed:10,  r:14, tier:1, env:'both', move:'chase', armor:.3, coin:4, sprite:'en_crab',  drops:[{m:'shell',c:.5}] },
  orc:      { name:'オーク',          hp:60,  dmg:16, speed:14.4,  r:16, tier:2, env:'land', move:'chase', coin:5, sprite:'en_orc',    drops:[{m:'hide',c:.4},{m:'scrap',c:.3}] },
  golem:    { name:'ストーンゴーレム',hp:150, dmg:24, speed:8,  r:20, tier:2, env:'land', move:'chase', armor:.4, coin:9, sprite:'en_golem', drops:[{m:'scrap',c:.5},{m:'crystal',c:.3}] },
  wisp:     { name:'ウィスプ',        hp:30,  dmg:13, speed:27.6,  r:10, tier:2, env:'both', move:'chase', coin:5, sprite:'en_wisp',   drops:[{m:'crystal',c:.4},{m:'magic',c:.2}] },
  jellyfish:{ name:'クラゲ',          hp:30,  dmg:12, speed:12.8,  r:13, tier:1, env:'sea',  move:'chase', coin:4, sprite:'en_jelly',  drops:[{m:'shell',c:.4},{m:'jelly',c:.3}] },
  shark:    { name:'シャーク',        hp:80,  dmg:20, speed:25.6,  r:16, tier:2, env:'sea',  move:'chase', coin:7, sprite:'en_shark',  drops:[{m:'hide',c:.4},{m:'coral',c:.3}] },
  siren:    { name:'セイレーン',      hp:60,  dmg:8,  speed:37.6, r:13, tier:2, env:'sea',  move:'kite',  heal:{radius:240,hps:12}, coin:14, sprite:'en_siren', drops:[{m:'coral',c:.5},{m:'star',c:.15}] },
  lizard:   { name:'リザードマン',    hp:90,  dmg:20, speed:18,  r:15, tier:2, env:'both', move:'chase', coin:7, sprite:'en_lizard', drops:[{m:'scale',c:.3},{m:'hide',c:.3}] },
  ogre:     { name:'オーガ',          hp:220, dmg:32, speed:12.8,  r:20, tier:3, env:'land', move:'chase', coin:12, sprite:'en_ogre',  drops:[{m:'hide',c:.5},{m:'magic',c:.3}] },
  knight:   { name:'ダークナイト',    hp:280, dmg:36, speed:16,  r:16, tier:3, env:'land', move:'chase', armor:.35, coin:15, sprite:'en_knight', drops:[{m:'scrap',c:.6},{m:'magic',c:.35}] },
  necro:    { name:'ネクロマンサー',  hp:180, dmg:12, speed:38.4, r:14, tier:3, env:'land', move:'kite', heal:{radius:260,hps:25}, coin:25, sprite:'en_necro', drops:[{m:'magic',c:.6},{m:'star',c:.2}] },
  serpent:  { name:'シーサーペント',  hp:320, dmg:38, speed:20.8,  r:20, tier:3, env:'sea',  move:'chase', coin:16, sprite:'en_serpent', drops:[{m:'coral',c:.5},{m:'scale',c:.35}] },
  whelp:    { name:'ドラゴンチャイルド', hp:260, dmg:30, speed:20, r:15, tier:3, env:'both', move:'chase', ranged:{range:240,cd:2.5,pspeed:72}, coin:18, sprite:'en_whelp', drops:[{m:'scale',c:.5},{m:'star',c:.2}] },
  dragon:   { name:'エンシェントドラゴン', hp:900, dmg:55, speed:17.6, r:24, tier:4, env:'both', move:'chase', ranged:{range:300,cd:2.2,pspeed:84}, coin:45, sprite:'en_dragon', drops:[{m:'scale',c:.7},{m:'abyss',c:.25}] },
  demon:    { name:'デーモン',        hp:700, dmg:60, speed:20.8,  r:20, tier:4, env:'land', move:'chase', coin:40, sprite:'en_demon', drops:[{m:'magic',c:.6},{m:'abyss',c:.25}] },
  abysslord:{ name:'アビスロード',    hp:1200,dmg:70, speed:18,  r:24, tier:4, env:'sea',  move:'chase', armor:.3, coin:60, sprite:'en_abyss', drops:[{m:'abyss',c:.5},{m:'star',c:.4}] },
  rainbow:  { name:'レインボースライム', hp:40, dmg:0, speed:46.4, r:12, tier:1, env:'both', move:'kite', rare:true, coin:120, sprite:'en_rainbow', drops:[{m:'prism',c:1}] },
  reaper:   { name:'終焉のリーパー',  hp:45000, dmg:160, speed:28.4, r:24, tier:9, env:'both', move:'chase', coin:250, sprite:'en_reaper', isReaper:true, drops:[{m:'abyss',c:.8},{m:'star',c:.8}] },
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
DATA.CONTINENTS = [
  { id:'main',  x:0,       y:0,       r:26000, seed:11,  name:'始まりの大陸', biome:'grass',  lobes:5, amp:0.22, sx:1.15, sy:0.95 },
  // --- 第1環 ---
  { id:'east',  x:105000,  y:8000,    r:21000, seed:23,  name:'竜骨の大陸',   biome:'volcano', lobes:7, amp:0.30, sx:1.5,  sy:0.75 },
  { id:'west',  x:-102000, y:-9000,   r:21000, seed:37,  name:'黄昏の大陸',   biome:'twilight',lobes:4, amp:0.28, sx:0.8,  sy:1.35 },
  { id:'north', x:9000,    y:-106000, r:20000, seed:41,  name:'星降りの大陸', biome:'frost',   lobes:6, amp:0.33, sx:1.2,  sy:1.0 },
  { id:'south', x:-7000,   y:104000,  r:20000, seed:53,  name:'深緑の大陸',   biome:'jungle',  lobes:8, amp:0.26, sx:1.0,  sy:1.25 },
  { id:'ne',    x:78000,   y:-76000,  r:15000, seed:67,  name:'白亜の島',     biome:'chalk',   lobes:3, amp:0.35, sx:1.3,  sy:0.8 },
  { id:'sw',    x:-75000,  y:79000,   r:15000, seed:71,  name:'黒曜の島',     biome:'obsidian',lobes:5, amp:0.38, sx:0.85, sy:1.2 },
  // --- 中間の小島(航海の中継地) ---
  { id:'i_mist',  x:170000,  y:-52000,  r:10000, seed:83,  name:'霧の小島',       biome:'mist',   lobes:4, amp:0.3 },
  { id:'i_bones', x:-166000, y:63000,   r:10000, seed:89,  name:'骨の小島',       biome:'bones',  lobes:6, amp:0.35 },
  { id:'i_ember', x:56000,   y:174000,  r:10000, seed:97,  name:'燃えさしの小島', biome:'volcano',lobes:5, amp:0.32 },
  { id:'i_frost', x:-61000,  y:-168000, r:10000, seed:101, name:'霜の小島',       biome:'frost',  lobes:4, amp:0.3 },
  // --- 第2環(初期大陸から2つ離れた大陸) ---
  { id:'r2_forge', x:265000,  y:40000,   r:24000, seed:103, name:'鍛冶神の大陸', biome:'magma',  lobes:9, amp:0.34, sx:1.4, sy:0.85 },
  { id:'r2_moon',  x:-258000, y:-50000,  r:24000, seed:107, name:'月影の大陸',   biome:'moon',   lobes:5, amp:0.3,  sx:0.9, sy:1.3 },
  { id:'r2_storm', x:46000,   y:-266000, r:23000, seed:109, name:'嵐の大陸',     biome:'storm',  lobes:7, amp:0.36, sx:1.25, sy:0.9 },
  { id:'r2_grave', x:-42000,  y:262000,  r:23000, seed:113, name:'墓標の大陸',   biome:'makai',  lobes:6, amp:0.33, sx:1.1, sy:1.1 },
  // --- 第3環 ---
  { id:'r3_sun',  x:525000,  y:-80000, r:28000, seed:127, name:'太陽の大陸', biome:'desert', lobes:4, amp:0.3, sx:1.6, sy:0.8 },
  { id:'r3_void', x:-516000, y:90000,  r:28000, seed:131, name:'虚無の大陸', biome:'void',   lobes:8, amp:0.4, sx:0.9, sy:1.4 },
  // --- 最果て ---
  { id:'r4_end',  x:2000, y:-805000, r:32000, seed:137, name:'最果ての大陸', biome:'end', lobes:10, amp:0.42, sx:1.2, sy:1.0 },
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
  // 初期大陸(最初の目標。足が遅いうちはここまでも命がけ)
  { id:'b_north', name:'北の砦',     x:400,    y:-8500,  cont:'main' },
  { id:'b_east',  name:'東の遺跡',   x:10500,  y:5200,   cont:'main' },
  { id:'b_south', name:'南の泉',     x:-2200,  y:12500,  cont:'main' },
  { id:'b_west',  name:'西の炉',     x:-14500, y:-3000,  cont:'main' },
  // 第1環
  { id:'b_dragon',name:'竜骨の前哨', x:105000,  y:8000,    cont:'east' },
  { id:'b_dusk',  name:'黄昏の前哨', x:-102000, y:-9000,   cont:'west' },
  { id:'b_star',  name:'星降りの祭壇', x:9000,  y:-106000, cont:'north' },
  { id:'b_green', name:'深緑の社',   x:-7000,   y:104000,  cont:'south' },
  { id:'b_white', name:'白亜の灯台', x:78000,   y:-76000,  cont:'ne' },
  { id:'b_black', name:'黒曜の祠',   x:-75000,  y:79000,   cont:'sw' },
  // 中間の小島
  { id:'b_mist',  name:'霧の観測所', x:170000,  y:-52000,  cont:'i_mist' },
  { id:'b_bones', name:'骨の祭場',   x:-166000, y:63000,   cont:'i_bones' },
  { id:'b_ember', name:'燃えさしの炉', x:56000, y:174000,  cont:'i_ember' },
  { id:'b_frost', name:'霜の祠',     x:-61000,  y:-168000, cont:'i_frost' },
  // 第2環
  { id:'b_forge', name:'鍛冶神の工房', x:265000,  y:40000,   cont:'r2_forge' },
  { id:'b_moon',  name:'月影の社',   x:-258000, y:-50000,  cont:'r2_moon' },
  { id:'b_storm', name:'嵐の塔',     x:46000,   y:-266000, cont:'r2_storm' },
  { id:'b_grave', name:'墓標の祭壇', x:-42000,  y:262000,  cont:'r2_grave' },
  // 第3環
  { id:'b_sun',   name:'太陽の神殿', x:525000,  y:-80000,  cont:'r3_sun' },
  { id:'b_void',  name:'虚無の門',   x:-516000, y:90000,   cont:'r3_void' },
  // 最果て
  { id:'b_end',   name:'最果ての碑', x:2000,    y:-805000, cont:'r4_end' },
];

// 港: 始まりの大陸の沿岸8方位。ship修理条件は港ごとに異なる
DATA.PORTS = [
  { id:'p_e',  name:'東の港',   angle:0,           repair:{ coins:150,  mats:{wood:15, scrap:8} } },
  { id:'p_ne', name:'北東の港', angle:-Math.PI/4,  repair:{ coins:300,  mats:{wood:20, scrap:12, shell:6} } },
  { id:'p_n',  name:'北の港',   angle:-Math.PI/2,  repair:{ coins:500,  mats:{wood:25, crystal:10, shell:10} } },
  { id:'p_nw', name:'北西の港', angle:-Math.PI*3/4,repair:{ coins:800,  mats:{wood:30, scrap:20, magic:5} } },
  { id:'p_w',  name:'西の港',   angle:Math.PI,     repair:{ coins:1200, mats:{wood:35, crystal:15, magic:8} } },
  { id:'p_sw', name:'南西の港', angle:Math.PI*3/4, repair:{ coins:1800, mats:{wood:40, shell:20, coral:6} } },
  { id:'p_s',  name:'南の港',   angle:Math.PI/2,   repair:{ coins:2500, mats:{wood:50, coral:10, scale:3} } },
  { id:'p_se', name:'南東の港', angle:Math.PI/4,   repair:{ coins:4000, mats:{wood:60, scale:6, star:3} } },
];

// ---------------- 魂の広場(死後フィールド)の恒久強化 ----------------
// cost(lv): 次のレベルの金額 (lv=現在Lv, 0開始)
function gcost(base, growth){ return (lv)=>Math.floor(base*Math.pow(growth,lv)); }

DATA.META = {
  // --- 強化の祭壇(戦闘) ---
  altar_hp:     { st:'altar', name:'生命力',       desc:'最大HP +20',            max:40, cost:gcost(15,1.32),  },
  altar_atk:    { st:'altar', name:'攻撃力',       desc:'全ダメージ +8%',        max:40, cost:gcost(20,1.34),  },
  altar_speed:  { st:'altar', name:'健脚',         desc:'移動速度 +4%(広大な世界の探索に必須)', max:25, cost:gcost(30,1.42), },
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
  lab_sail:     { st:'lab', name:'帆の改良',       desc:'船の速度 +8%(遠海の大陸へ)', max:15, cost:gcost(200,1.42) },
  lab_mat_magic:{ st:'lab', name:'【解放】魔石',   desc:'新素材「魔石」が世界に出現する', max:1, cost:gcost(400,1) },
  lab_mat_coral:{ st:'lab', name:'【解放】珊瑚',   desc:'新素材「珊瑚」が海域に出現する', max:1, cost:gcost(1500,1) },
  lab_mat_scale:{ st:'lab', name:'【解放】竜のうろこ', desc:'新素材「竜のうろこ」が出現する', max:1, cost:gcost(6000,1) },
  lab_mat_star: { st:'lab', name:'【解放】星のかけら', desc:'新素材「星のかけら」が出現する', max:1, cost:gcost(15000,1) },
  lab_mat_abyss:{ st:'lab', name:'【解放】深淵の核', desc:'新素材「深淵の核」が出現する', max:1, cost:gcost(50000,1) },
  // --- 仲間の宿舎 ---
  camp_recruit: { st:'camp', name:'カリスマ',      desc:'敵が仲間になる確率 +0.2%(基本20%)', max:20, cost:gcost(40,1.38) },
  camp_fury:    { st:'camp', name:'鬨の声',        desc:'仲間の攻撃間隔 -3%', max:15, cost:gcost(80,1.5) },
  camp_hp:      { st:'camp', name:'仲間の生命',    desc:'仲間HP +15%',           max:30, cost:gcost(30,1.35) },
  camp_atk:     { st:'camp', name:'仲間の闘志',    desc:'仲間攻撃力 +12%',       max:30, cost:gcost(30,1.35) },
  camp_heal:    { st:'camp', name:'仲間介抱',      desc:'仲間HP自動回復 +1%/秒', max:10, cost:gcost(120,1.6) },
  camp_swift:   { st:'camp', name:'仲間の俊足',    desc:'仲間の移動速度 +5%(はぐれず前線を押し上げる)', max:15, cost:gcost(80,1.45) },
  camp_revive:  { st:'camp', name:'魂の絆',        desc:'倒れた仲間が30%で踏みとどまる(HP1)', max:5, cost:gcost(500,2.2) },
  // --- スキル書庫 ---
  lib_map:      { st:'lib', name:'地図の作成',    desc:'周回中にマップ(周辺図/全体図)が使えるようになる', max:1, cost:gcost(120,1) },
  lib_sk_sands: { st:'lib', name:'【解放】時の砂', desc:'スキル「時の砂」が出現候補になる', max:1, cost:gcost(20000,1) },
  lib_sk_confuse:{ st:'lib', name:'【解放】混沌の瘴気', desc:'敵を同士討ちさせるスキルが出現候補になる', max:1, cost:gcost(1200,1) },
  lib_sk_curse: { st:'lib', name:'【解放】衰弱の呪印', desc:'敵を弱体化させるスキルが出現候補になる', max:1, cost:gcost(3500,1) },
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
  // 東の遺跡: 武練場(範囲/射程) / 生命の祠(結界/回避) / 秘宝の蔵(叡智/仲間全能力)
  g_east_area:   { st:'b_east', fac:'war',  name:'魔力増幅',   desc:'スキルの効果範囲 +4%',  max:20, cost:gcost(180,1.42) },
  g_east_reach:  { st:'b_east', fac:'war',  name:'遠見の術',   desc:'攻撃の射程 +2%', max:15, cost:gcost(200,1.42), effMul:{range:.02} },
  g_east_ward:   { st:'b_east', fac:'life', name:'遺跡の結界', desc:'被ダメージ -1%', max:10, cost:gcost(220,1.45), effAdd:{armor:.01} },
  g_east_evade:  { st:'b_east', fac:'life', name:'残像歩法',   desc:'回避率 +0.6%', max:12, cost:gcost(240,1.46), effAdd:{dodge:.006} },
  g_east_cdr:    { st:'b_east', fac:'lore', name:'古代の叡智', desc:'武器の攻撃間隔 -1.5%(書庫と加算)', max:20, cost:gcost(180,1.42) },
  g_east_muster: { st:'b_east', fac:'lore', name:'遺跡の共鳴', desc:'仲間の攻撃力 +3%', max:15, cost:gcost(210,1.44), effMul:{allyAtk:.03} },
  // 南の泉: 武練場(浄化/会心) / 生命の祠(治癒/自然回復) / 秘宝の蔵(霊薬/仲間回復)
  g_south_bless: { st:'b_south', fac:'war',  name:'清めの刃',  desc:'全ダメージ +3%', max:15, cost:gcost(200,1.42), effMul:{atk:.03} },
  g_south_focus: { st:'b_south', fac:'war',  name:'澄んだ心',  desc:'会心率 +1%', max:12, cost:gcost(230,1.44), effAdd:{crit:.01} },
  g_south_heal:  { st:'b_south', fac:'life', name:'癒しの水',  desc:'HP自動回復 +1/秒',      max:15, cost:gcost(220,1.45) },
  g_south_spring:{ st:'b_south', fac:'life', name:'泉の恵み',  desc:'最大HP +10', max:15, cost:gcost(200,1.42), effAdd:{maxHp:10} },
  g_south_potion:{ st:'b_south', fac:'lore', name:'霊薬精製',  desc:'敵が回復ポーション(HP20%)を落とす確率 +0.4%', max:10, cost:gcost(300,1.5) },
  g_south_care:  { st:'b_south', fac:'lore', name:'泉の看護',  desc:'仲間HP自動回復 +0.6%/秒', max:12, cost:gcost(260,1.46), effAdd:{allyRegen:.006} },
  // 西の炉: 武練場(業火/巨人殺し) / 生命の祠(鎧下/棘) / 秘宝の蔵(精錬/仲間HP)
  g_west_fire:   { st:'b_west', fac:'war',  name:'業火の刻印', desc:'全ダメージ +5%(祭壇と加算)', max:25, cost:gcost(250,1.4) },
  g_west_boss:   { st:'b_west', fac:'war',  name:'巨人殺し',   desc:'ボスへのダメージ +8%',  max:20, cost:gcost(300,1.42) },
  g_west_mail:   { st:'b_west', fac:'life', name:'鋼の鎧下',   desc:'最大HP +15', max:15, cost:gcost(250,1.42), effAdd:{maxHp:15} },
  g_west_forge:  { st:'b_west', fac:'life', name:'炉の頑健',   desc:'被ダメージ -1%', max:12, cost:gcost(280,1.46), effAdd:{armor:.01} },
  g_west_smelt:  { st:'b_west', fac:'lore', name:'精錬の目利き', desc:'コイン獲得量 +4%', max:15, cost:gcost(280,1.45), effMul:{coinMul:.04} },
  g_west_temper: { st:'b_west', fac:'lore', name:'鍛えの絆',   desc:'仲間の最大HP +3%', max:15, cost:gcost(260,1.45), effMul:{allyHp:.03} },
  // --- 第1環 ---
  g_dragon_fang: { st:'b_dragon', fac:'war',  name:'竜牙の刃',  desc:'ボスへのダメージ +5%', max:15, cost:gcost(1800,1.45), effMul:{bossDmg:.05} },
  g_dragon_res:  { st:'b_dragon', fac:'life', name:'竜鱗の守り', desc:'リーパーからの被ダメージ -6%(最大90%)', max:15, cost:gcost(2000,1.5) },
  g_dragon_craft:{ st:'b_dragon', fac:'lore', name:'竜骨細工',  desc:'素材ドロップ量 +4%', max:15, cost:gcost(1900,1.45), effMul:{dropMul:.04} },
  g_dusk_slay:   { st:'b_dusk', fac:'war',  name:'終焉狩り',   desc:'リーパーへのダメージ +15%', max:20, cost:gcost(2000,1.5) },
  g_dusk_veil:   { st:'b_dusk', fac:'life', name:'黄昏の帳',   desc:'回避率 +0.8%', max:10, cost:gcost(2200,1.5), effAdd:{dodge:.008} },
  g_dusk_poem:   { st:'b_dusk', fac:'lore', name:'詩人の囁き', desc:'仲間になる確率 +0.05%', max:10, cost:gcost(2400,1.5), effAdd:{recruit:.0005} },
  g_star_meteor: { st:'b_star', fac:'war',  name:'流星の火',   desc:'会心率 +1.5%', max:10, cost:gcost(2800,1.5), effAdd:{crit:.015} },
  g_star_time:   { st:'b_star', fac:'life', name:'星読みの加護', desc:'敵の時間経過による強化を3%緩和(最大45%)', max:15, cost:gcost(3000,1.55) },
  g_star_chart:  { st:'b_star', fac:'lore', name:'星図の導き', desc:'移動速度 +1.5%', max:15, cost:gcost(2600,1.5), effMul:{speed:.015} },
  g_green_hunt:  { st:'b_green', fac:'war',  name:'森の狩人',  desc:'全ダメージ +3%', max:15, cost:gcost(2400,1.48), effMul:{atk:.03} },
  g_green_rest:  { st:'b_green', fac:'life', name:'森の寝床',  desc:'HP自動回復 +0.8/秒', max:10, cost:gcost(2600,1.5), effAdd:{regen:.8} },
  g_green_ally:  { st:'b_green', fac:'lore', name:'森の恵み',  desc:'仲間の全能力 +8%',      max:15, cost:gcost(2500,1.5) },
  g_white_snipe: { st:'b_white', fac:'war',  name:'灯火の狙撃', desc:'攻撃射程 +2%', max:10, cost:gcost(2800,1.5), effMul:{range:.02} },
  g_white_shell: { st:'b_white', fac:'life', name:'白亜の盾',  desc:'被ダメージ -1%', max:10, cost:gcost(3200,1.5), effAdd:{armor:.01} },
  g_white_gold:  { st:'b_white', fac:'lore', name:'白亜の商才', desc:'コイン獲得量 +15%(金運と加算)', max:15, cost:gcost(3000,1.5) },
  g_black_dark:  { st:'b_black', fac:'war',  name:'黒曜の契約', desc:'全ダメージ+10% / 最大HP+40', max:15, cost:gcost(4000,1.55) },
  g_black_skin:  { st:'b_black', fac:'life', name:'黒曜の皮膚', desc:'最大HP +20', max:15, cost:gcost(3800,1.5), effAdd:{maxHp:20} },
  g_black_pact:  { st:'b_black', fac:'lore', name:'契約の対価', desc:'コイン獲得量 +4%', max:15, cost:gcost(4200,1.55), effMul:{coinMul:.04} },
  // --- 中間の小島 ---
  g_mist_blade:  { st:'b_mist',  fac:'war',  name:'霧の刃',    desc:'会心率 +1.5%', max:10, cost:gcost(1400,1.45), effAdd:{crit:.015} },
  g_mist_dodge:  { st:'b_mist',  fac:'life', name:'霧隠れ',     desc:'回避率 +1%(攻撃を完全に避ける)', max:15, cost:gcost(1500,1.45) },
  g_mist_gather: { st:'b_mist',  fac:'lore', name:'霧の収集家', desc:'アイテム回収範囲 +6%', max:10, cost:gcost(1300,1.45), effMul:{magnet:.06} },
  g_bones_spike: { st:'b_bones', fac:'war',  name:'骨の棘',    desc:'接触してきた敵に反撃ダメージ +4', max:15, cost:gcost(1500,1.45), effAdd:{thorns:4} },
  g_bones_broth: { st:'b_bones', fac:'life', name:'骨髄の薬',  desc:'HP自動回復 +0.8/秒', max:10, cost:gcost(1700,1.5), effAdd:{regen:.8} },
  g_bones_army:  { st:'b_bones', fac:'lore', name:'骸骨の軍勢', desc:'周回開始時に骸骨の仲間を連れて出撃(2Lvごとに+1体)', max:10, cost:gcost(1800,1.5) },
  g_ember_burn:  { st:'b_ember', fac:'war',  name:'燃えさしの祝福', desc:'全攻撃に4%で炎上を付与', max:10, cost:gcost(1600,1.5) },
  g_ember_warm:  { st:'b_ember', fac:'life', name:'残り火の温もり', desc:'最大HP +15', max:15, cost:gcost(1500,1.45), effAdd:{maxHp:15} },
  g_ember_trade: { st:'b_ember', fac:'lore', name:'火の子の商い', desc:'コイン獲得量 +4%', max:15, cost:gcost(1700,1.5), effMul:{coinMul:.04} },
  g_frost_slow:  { st:'b_frost', fac:'war',  name:'霜の吐息',   desc:'全攻撃に3%で氷結(減速)を付与', max:10, cost:gcost(1600,1.5) },
  g_frost_armor: { st:'b_frost', fac:'life', name:'氷の鎧',    desc:'被ダメージ -1.2%', max:10, cost:gcost(1700,1.5), effAdd:{armor:.012} },
  g_frost_store: { st:'b_frost', fac:'lore', name:'氷室の保存', desc:'素材ドロップ量 +4%', max:15, cost:gcost(1500,1.45), effMul:{dropMul:.04} },
  // --- 第2環 ---
  g_forge_gear:  { st:'b_forge', fac:'war',  name:'神鉄の装備', desc:'全ダメージ+6% / 最大HP+10', max:25, cost:gcost(8000,1.4) },
  g_forge_helm:  { st:'b_forge', fac:'life', name:'神鉄の兜',  desc:'最大HP +25', max:15, cost:gcost(7500,1.45), effAdd:{maxHp:25} },
  g_forge_arms:  { st:'b_forge', fac:'lore', name:'神鉄の武具(仲間用)', desc:'仲間の攻撃力 +4%', max:15, cost:gcost(8500,1.45), effMul:{allyAtk:.04} },
  g_moon_blade:  { st:'b_moon',  fac:'war',  name:'月光の刃',  desc:'会心率 +2%', max:10, cost:gcost(8500,1.5), effAdd:{crit:.02} },
  g_moon_shadow: { st:'b_moon',  fac:'life', name:'影歩き',     desc:'被弾後の無敵時間 +0.06秒', max:10, cost:gcost(9000,1.5) },
  g_moon_luck:   { st:'b_moon',  fac:'lore', name:'月の吉兆',  desc:'レア素材の出やすさ +3%', max:10, cost:gcost(9500,1.5), effAdd:{luck2:.03} },
  g_storm_bolt:  { st:'b_storm', fac:'war',  name:'嵐の加護',   desc:'9秒ごとに自動で落雷が敵を撃つ(威力+20/Lv)', max:15, cost:gcost(8500,1.45) },
  g_storm_ward:  { st:'b_storm', fac:'life', name:'避雷の護符', desc:'被ダメージ -1.2%', max:10, cost:gcost(9000,1.5), effAdd:{armor:.012} },
  g_storm_wind:  { st:'b_storm', fac:'lore', name:'風の運び手', desc:'移動速度 +2%', max:10, cost:gcost(8800,1.5), effMul:{speed:.02} },
  g_grave_blast: { st:'b_grave', fac:'war',  name:'弔いの爆炎', desc:'仲間が倒れた時に爆発(威力+30/Lv)', max:15, cost:gcost(8000,1.45) },
  g_grave_pray:  { st:'b_grave', fac:'life', name:'墓守の祈り', desc:'仲間のHP +5%', max:15, cost:gcost(8200,1.45), effMul:{allyHp:.05} },
  g_grave_gift:  { st:'b_grave', fac:'lore', name:'死者の貢物', desc:'コイン獲得量 +5%', max:15, cost:gcost(8600,1.5), effMul:{coinMul:.05} },
  // --- 第3環 ---
  g_sun_wrath:   { st:'b_sun',   fac:'war',  name:'太陽の憤怒', desc:'全ダメージ +4%', max:20, cost:gcost(38000,1.5), effMul:{atk:.04} },
  g_sun_life:    { st:'b_sun',   fac:'life', name:'太陽の生命', desc:'HP自動回復 +1/秒', max:15, cost:gcost(36000,1.5), effAdd:{regen:1} },
  g_sun_grace:   { st:'b_sun',   fac:'lore', name:'太陽の恩寵', desc:'攻撃・HP・移動速度 +2%', max:20, cost:gcost(40000,1.5) },
  g_void_edge:   { st:'b_void',  fac:'war',  name:'虚無の刃',  desc:'リーパーへのダメージ +6%', max:15, cost:gcost(42000,1.5), effMul:{reaperDmg:.06} },
  g_void_null:   { st:'b_void',  fac:'life', name:'虚無の帳',   desc:'リーパー耐性+2% / リーパー特効+5%', max:15, cost:gcost(45000,1.5) },
  g_void_calm:   { st:'b_void',  fac:'lore', name:'無の悟り',  desc:'武器の攻撃間隔 -1%', max:10, cost:gcost(48000,1.55), effAdd:{cdr:.01} },
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
  // --- 最果て ---
  g_end_beyond:  { st:'b_end',   fac:'war',  name:'終焉超越',   desc:'敵の時間強化をさらに2%緩和 / 全ダメージ+8%', max:20, cost:gcost(150000,1.55) },
  g_end_vessel:  { st:'b_end',   fac:'life', name:'終焉の器',   desc:'最大HP +4%', max:15, cost:gcost(140000,1.55), effMul:{maxHp:.04} },
  g_end_relic:   { st:'b_end',   fac:'lore', name:'彼方の遺物', desc:'素材ドロップ量 +5%', max:15, cost:gcost(130000,1.55), effMul:{dropMul:.05} },
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
  { id:'ach_rare',    name:'幻を見た者',   desc:'レインボースライムを討伐', cond:s=>(s.stats.rareKills||0)>=1, reward:'新スキル「虹の奔流」が解放' },
];

// ---------------- クエスト(基地・港の解放条件) ----------------
// 未解放の基地/未修理の船に近づくと専用マップに転移し、NPCのクエストをこなすと解放される
// type: hunt=討伐 / fetch=収集(お使い) / survive=防衛 / delivery=素材納品
DATA.QUESTS = {
  // --- 始まりの大陸 ---
  b_north: { npc:'npc_elder', npcName:'老兵ガルド', type:'hunt', enemy:'skeleton', count:6,
    intro:['…おお、生きた人間か。ワシはこの砦の最後の守り兵じゃ。','夜な夜な骸骨どもが湧いて、砦を奪われてしもうた。','奴らを6体、討ち払ってくれんか。この旗はまだ死んでおらん!'],
    done:['見事じゃ…!砦の狼煙を上げるぞ。','お前さんの魂の広場と、この砦が繋がった。いつでも戻ってこい。'] },
  b_east: { npc:'npc_scholar', npcName:'考古学者リナ', type:'hunt', enemy:'goblin', count:6,
    intro:['きゃっ!?…な、なんだ人間か。私はこの遺跡を調べてる研究者。','ゴブリンたちが遺跡のワープ装置を勝手にいじって困ってるの。','6体追い払って!装置が壊れちゃう前に!'],
    done:['助かった〜!…ほら、装置が目を覚ました。','これで魂の広場から直接来られるわよ。研究の成果、期待してて。'] },
  b_south: { npc:'npc_miko', npcName:'泉の巫女スズ', type:'survive', enemy:'slime', time:30,
    intro:['旅の方…この泉は癒しの力を持つのですが、穢れに狙われています。','今から浄化の祈りを捧げます。30秒間、私を守ってください。'],
    done:['…祈りが届きました。泉は清められました。','この泉の加護、あなたの魂に結びました。'] },
  b_west: { npc:'npc_smith', npcName:'鍛冶師ドバン', type:'delivery', need:{ coins:30, mats:{wood:8, scrap:5} },
    intro:['おう、客か?見ての通り炉が冷え切っちまってな。','火を入れ直すのに 木材8・鉄クズ5、それと手間賃 🪙30 が要る。','払ってくれりゃあ、ここをお前さんの拠点にしてやるぜ。'],
    done:['よぉし、火が入った!この炉の音が聞こえる限り、ここはお前の家だ。'] },
  // --- 第1環 ---
  b_dragon: { npc:'npc_elder', npcName:'竜骨の番人', type:'hunt', enemy:'lizard', count:7,
    intro:['この大陸は竜の骨の上に築かれておる。','だがリザードマンどもが骨を喰らい、地脈を乱しておる。','7体討て。さすれば竜の加護を分けてやろう。'],
    done:['地脈が静まった…竜はお前を認めたようじゃ。'] },
  b_dusk: { npc:'npc_sage', npcName:'黄昏の詩人ヨル', type:'survive', enemy:'bat', time:35,
    intro:['ようこそ、日の沈まぬ国へ。私は光を集めて詩を書く者。','今から黄昏の詩を詠む。詠唱の間、闇の獣から守っておくれ。35秒だ。'],
    done:['ああ…これで詩が完成する。君の旅路に、黄昏の祝福を。'] },
  b_star: { npc:'npc_miko', npcName:'星読みのミラ', type:'survive', enemy:'wisp', time:40,
    intro:['星が落ちる夜、ここには星喰いの精霊が集まるのです。','観測の儀を行います。40秒、星灯りを守ってください。'],
    done:['観測完了…あなたの星は、とても強く輝いていますよ。'] },
  b_green: { npc:'npc_elder', npcName:'森の長オルガ', type:'delivery', need:{ coins:200, mats:{wood:20, hide:10} },
    intro:['この森は生きておる。勝手な出入りは許さん。','…だが、森への捧げ物があれば話は別じゃ。','木材20・毛皮10・🪙200。森の掟じゃよ。'],
    done:['よかろう。森はお前を「友」と認めた。'] },
  b_white: { npc:'npc_sailor', npcName:'灯台守ハク', type:'hunt', enemy:'crab', count:7,
    intro:['この灯台、何百年も海を照らしてきたんだがな…','アイアンクラブどもが土台を齧りやがる。','7匹叩き落としてくれ。灯りを絶やすわけにはいかん。'],
    done:['…見ろ、この光だ!海の果てまで届くぞ。ありがとうな。'] },
  b_black: { npc:'npc_sage', npcName:'黒曜の修行僧', type:'hunt', enemy:'wisp', count:8,
    intro:['…この島の闇は、心を映す鏡。','彷徨える光魂(ウィスプ)が8つ、闇を乱している。','斬れ。それがお前の修行だ。'],
    done:['…見事な太刀筋。この祠はお前の心の拠り所となろう。'] },
  // --- 中間の小島 ---
  b_mist:  { npc:'npc_sage', npcName:'霧の番人', type:'survive', enemy:'bat', time:35,
    intro:['霧は全てを隠す…宝も、危険も。','観測所を直したい。35秒間、霧の獣から守ってくれ。'],
    done:['霧が晴れた…お前には、この島の全てが見えるだろう。'] },
  b_bones: { npc:'npc_smith', npcName:'骨商人ザリ', type:'delivery', need:{ coins:500, mats:{bone:18, hide:8} },
    intro:['へっへっへ…こんな荒野に客とは珍しい。','ワシは骨を売り買いする商人。店を開くのに元手が要る。','骨18・毛皮8・🪙500。悪い話じゃないだろ?'],
    done:['まいどあり!ここはアンタの取引所だ。'] },
  b_ember: { npc:'npc_smith', npcName:'火の子エン', type:'hunt', enemy:'orc', count:7,
    intro:['この島の火は、あたしのおばあちゃんの形見なんだ。','でもオークたちが火を消そうとしてる!','7体やっつけて!お願い!'],
    done:['やったー!火が守られた!あんた、かっこいいね!'] },
  b_frost: { npc:'npc_miko', npcName:'氷の隠者フユ', type:'survive', enemy:'wisp', time:35,
    intro:['…寒いでしょう。ここは時が凍る島。','これから氷の下の花に祈りを込めます。','35秒…氷の精霊たちから、私を守ってくださいな。'],
    done:['…ありがとう。この祠の氷は、もうあなたを拒みません。'] },
  // --- 第2環 ---
  b_forge: { npc:'npc_smith', npcName:'鍛冶神の弟子ゴウ', type:'delivery', need:{ coins:3000, mats:{scrap:25, magic:5} },
    intro:['ここは鍛冶神の工房…師匠は溶岩の底で眠っている。','工房を再稼働させたい。鉄クズ25・魔石5・🪙3000。','神の金床を、お前も使えるようにしてやる。'],
    done:['聞こえるか?金床が歌ってる。神の工房はお前を歓迎している!'] },
  b_moon:  { npc:'npc_sage', npcName:'月の使者ツクヨ', type:'hunt', enemy:'knight', count:6,
    intro:['月影に、闇の騎士どもが巣食っている。','奴らは月の光を喰らう。6体、斬ってくれ。','報酬は…月の社の鍵だ。'],
    done:['月光が戻った…社はお前に開かれた。'] },
  b_storm: { npc:'npc_scholar', npcName:'嵐の観測士ライ', type:'survive', enemy:'wisp', time:45,
    intro:['来たか!ちょうどいい、今から雷雲の芯を観測する!','機材を守ってくれ!45秒だ!死ぬなよ!'],
    done:['取れた!世紀の観測データだ!塔はお前にも開放する!'] },
  b_grave: { npc:'npc_sage', npcName:'墓守グレイ', type:'hunt', enemy:'necro', count:3,
    intro:['ここは魔界との境…死者が安らかに眠るべき場所。','だがネクロマンサーどもが死者を弄んでいる。','3体で良い。奴らは逃げ足が速いぞ。'],
    done:['死者たちが感謝している…この祭壇はお前の味方だ。'] },
  // --- 第3環 ---
  b_sun:  { npc:'npc_miko', npcName:'太陽の神官サナ', type:'hunt', enemy:'lizard', count:8,
    intro:['ようこそ、灼けつく神殿へ。','神殿を狙うリザードマンを8体討つこと。それが入信の儀式です。','太陽はすべてを見ています。ごまかしはききませんよ。'],
    done:['太陽はあなたを祝福しました。神殿の力をお使いなさい。'] },
  b_void: { npc:'npc_sage', npcName:'虚無の囁き', type:'hunt', enemy:'demon', count:8,
    intro:['……来たか。ここは在って無い場所。','デーモンが8。虚無を喰い荒らす。','排せ。さすれば「無」がお前に道を開く。'],
    done:['……良い。虚無はお前を通す。'] },
  b_end:  { npc:'npc_elder', npcName:'最果ての賢者', type:'survive', enemy:'reaper', time:45,
    intro:['ついに…ここまで来る者が現れたか。','この碑は世界の終わりを見届けるためのもの。','最後の試練だ。45秒、終焉の使者から生き延びよ。'],
    done:['…見届けた。お前こそ、終焉に抗う者。全てを解き放とう。'] },
};
// 港のクエスト(船大工に素材とお金を届けて修理してもらう)
const PORT_FLAVOR = {
  p_e:'東の海流は穏やかだ。初めての航海にゃちょうどいい。', p_ne:'北東の海にはクラゲが多くてな…気をつけな。',
  p_n:'北の海は冷てぇぞ。装備はしっかりな。', p_nw:'北西は霧が出る。方角を見失うなよ。',
  p_w:'西の海の向こうにゃ、黄昏の大陸が見えるって話だ。', p_sw:'南西の海は珊瑚が綺麗だが、サメも多い。',
  p_s:'南の海は嵐が名物だ。腕が鳴るね。', p_se:'南東は竜の通り道…行くなら覚悟しな。',
};
for (const p of DATA.PORTS) {
  DATA.QUESTS[p.id] = {
    npc:'npc_sailor', npcName:'船大工', type:'delivery', need:p.repair,
    intro:['おう、あの船か?ありゃあ嵐にやられちまってな。', PORT_FLAVOR[p.id] || '海はいいぞぉ。',
      '直してほしけりゃ材料と手間賃を持ってきな。話はそれからだ。'],
    done:['…よし、直ったぜ!マストも帆も新品同様だ。','いつでも出航できる。良い風を!'] };
}

// 2段階目クエスト(基地解放後、NPCに再度話すと受けられる追加依頼。報酬つき)
DATA.QUESTS2 = {
  b_north: { npcName:'老兵ガルド', offer:'実はな…砦の周りにウルフの群れが居着いてしもうた。狩ってくれんか?',
    type:'hunt', enemy:'wolf', count:8,
    intro:['すまんな、何度も。ウルフどもが物資を狙っておる。','8頭。頼んだぞ。'],
    done:['助かった!これで安心して眠れるわい。','礼にワシの戦術を授けよう。仲間を率いる「誓い」の技じゃ。','(新スキル「老兵の誓い」が素材で取得できるようになった!)'],
    reward:{ coins:150, mats:{bone:10} } },
  b_east: { npcName:'考古学者リナ', offer:'遺跡の最深部を調査したいの。護衛、お願いできない?',
    type:'survive', enemy:'goblin', time:40,
    intro:['最深部の封印を解析するわ。40秒だけ集中させて。','その間、ゴブリンたちを近づけないで!'],
    done:['解析完了!…すごいわ、これ身体能力を強化する術式よ。あなたにも使えるはず。','(新スキル「遺跡の加護」が素材で取得できるようになった!)'],
    reward:{ mats:{crystal:8, magic:3} } },
  b_south: { npcName:'泉の巫女スズ', offer:'月に一度の大浄化の儀の時期です。また守っていただけますか?',
    type:'survive', enemy:'wolf', time:40,
    intro:['今回の儀式は長丁場です。40秒、お願いします。'],
    done:['…完璧な浄化です。泉が喜んでいます。','これは泉の恵み。お持ちください。'],
    reward:{ coins:200, mats:{jelly:10, crystal:5} } },
  b_west: { npcName:'鍛冶師ドバン', offer:'デカい仕事が入ってな。材料を都合してくれりゃ分け前をやるぜ。',
    type:'delivery', need:{ coins:100, mats:{scrap:12, wood:12} },
    intro:['王都からの発注だ。納期がやべえ。','鉄クズ12・木材12・つなぎの🪙100。頼む!'],
    done:['っしゃあ!間に合った!ほらよ、分け前だ。','(報酬を受け取った!)'],
    reward:{ coins:500, mats:{magic:4} } },
};

// NPCの豆知識(再会話で1つ話してくれる)
DATA.NPC_TIPS = [
  'ヒーラー系の敵は倒すと仲間になって、今度はお前を回復してくれるぞ。',
  'エリアごとに採れやすい素材が違う。欲しい素材の土地へ遠征するんだ。',
  '虹色に光るスライムを見たら追え。「虹のかけら」は奴しか落とさん。',
  '金色に輝く古木や真珠貝…レアなオブジェクトには専用素材が眠っている。',
  '30分を過ぎると終焉の刻が来る。備えなしでは生き残れんぞ。',
  '危険度の数字が高い土地ほど敵は強いが、コインも素材も美味い。',
  '船の速度は研究所の「帆の改良」で上がる。遠海に行くなら必須だ。',
  '仲間が増えると視界が広がる。軍勢の合戦は壮観だぞ。',
  'スキルには前提があるものも。ボルトを鍛えるとレーザーの道が開ける、とかな。',
  '魂の広場の書庫では、もう知っているスキルを非表示にできるらしい。',
];

DATA.STATIONS = {
  altar: { name:'強化の祭壇',   sprite:'st_altar', desc:'基礎能力を鍛える' },
  lab:   { name:'素材研究所',   sprite:'st_lab',   desc:'素材と経済の研究' },
  camp:  { name:'仲間の宿舎',   sprite:'st_camp',  desc:'仲間を強くする' },
  lib:   { name:'スキル書庫',   sprite:'st_lib',   desc:'スキルの解放と上限' },
};

// 時間による敵強化(分あたり)。星読みで緩和可能
DATA.TIME_HP_GROWTH = 1.128;   // HP: ×1.128^分 (30分で約37倍)
DATA.TIME_DMG_GROWTH = 1.062;  // ダメージ: 30分で約6倍
DATA.DIST_RING = 6500;         // 距離リング幅(px) 遠くほど敵が強い(危険度)
DATA.REAPER_AT = 1800;         // 終焉の刻(秒)
DATA.WORLD_EXTENT = 860000;    // 世界の半径(ミニマップ用)
