// ==========================================
// マナ・ガーデン 〜箱庭魔法都市〜 Core Logic
// ==========================================

// --- ゲーム定数と設定 ---
const GRID_SIZE = 8;
const BASE_TILE_WIDTH = 120;
const BASE_TILE_HEIGHT = 80;

// 建物の設定
const BUILDING_TYPES = {
    house: {
        name: '民家',
        description: '住民が住むかわいい家。一定時間ごとにゴールドを生産します。',
        cost: { gold: 40, wood: 20, mana: 0 },
        popMaxAdd: 2,
        production: { gold: 1.5, wood: 0, mana: 0 },
        asset: 'assets/house.png',
        upgradeCostMultiplier: 1.8
    },
    lumberjack: {
        name: '木こり小屋',
        description: '森から木材を切り出す小屋。一定時間ごとに木材を生産します。',
        cost: { gold: 30, wood: 10, mana: 0 },
        popMaxAdd: 0,
        production: { gold: 0, wood: 1.0, mana: 0 },
        asset: 'assets/lumberjack.png',
        upgradeCostMultiplier: 1.6
    },
    mana_tower: {
        name: '魔力塔',
        description: '大気中のマナを集める神秘的な塔。一定時間ごとにマナを生産します。',
        cost: { gold: 50, wood: 0, mana: 15 },
        popMaxAdd: 0,
        production: { gold: 0, wood: 0, mana: 0.8 },
        asset: 'assets/mana_tower.png',
        upgradeCostMultiplier: 2.0
    },
    tavern: {
        name: '冒険者の酒場',
        description: '冒険者を街に呼び込む酒場。少しのゴールドも生産します。',
        cost: { gold: 80, wood: 50, mana: 0 },
        popMaxAdd: 1,
        production: { gold: 0.8, wood: 0, mana: 0 },
        asset: 'assets/tavern.png',
        upgradeCostMultiplier: 2.2
    },
    barracks: {
        name: '騎士団兵舎',
        description: '街の防衛を担う騎士を配置する兵舎。スライム退治が得意な騎士が召喚されます。',
        cost: { gold: 100, wood: 60, mana: 20 },
        popMaxAdd: 1,
        production: { gold: 0, wood: 0, mana: 0 },
        asset: 'assets/barracks.png',
        upgradeCostMultiplier: 2.5
    }
};

// スペル設定
const SPELLS = {
    rain: { name: '成長の雨', cost: { mana: 20, gold: 0 }, duration: 40 }, // 40秒間生産2倍
    surge: { name: 'マナの奔流', cost: { mana: 0, gold: 50 }, instant: true }, // ゴールド50をマナ50に変換
    slime: { name: 'スライム召喚', cost: { mana: 10, gold: 0 }, instant: true }, // スライム強制湧き
    cleanse: { name: '浄化の光', cost: { mana: 15, gold: 0 }, target: true } // 指定タイルのスライムを消滅
};

// --- ゲーム状態管理 ---
const state = {
    resources: {
        gold: 150,
        wood: 80,
        mana: 40,
        pop: 0,
        popMax: 5,
        happiness: 100
    },
    grid: [],
    characters: [],
    nextCharId: 1,
    activeEffects: {
        rain: 0 // 残り秒数
    },
    factions: {
        royal: { name: '王宮', rep: 50, quest: null, bonusUnlocked: false },
        guild: { name: '冒険者ギルド', rep: 50, quest: null, bonusUnlocked: false },
        archive: { name: '大魔導書院', rep: 50, quest: null, bonusUnlocked: false }
    },
    selectedTool: null, // 建築キー（'house', 'road_dirt'など）
    selectedCell: null, // {col, row}
    audio: {
        ctx: null,
        soundEnabled: false,
        bgmNode: null,
        bgmInterval: null
    },
    viewport: {
        x: 0,
        y: 0,
        scale: 1.0,
        isDragging: false,
        startX: 0,
        startY: 0
    },
    stats: {
        slimesKilled: 0
    },
    assetsProcessed: {} // 透過処理済みのDataURL格納
};

// 画像ファイルのプレロードリスト
const ASSET_FILES = {
    grass: 'assets/grass_tile.png',
    dirt: 'assets/dirt_path.png',
    house: 'assets/house.png',
    lumberjack: 'assets/lumberjack.png',
    mana_tower: 'assets/mana_tower.png',
    tavern: 'assets/tavern.png',
    barracks: 'assets/barracks.png',
    slime: 'assets/slime.png',
    knight_boy: 'assets/character_knight_boy.png',
    knight_girl: 'assets/character_knight_girl.png',
    mage_boy: 'assets/character_mage_boy.png',
    mage_girl: 'assets/character_mage_girl.png',
    game_logo: 'assets/game_logo.png'
};

// ==========================================
// 1. 画像アセット透過処理ユーティリティ
// ==========================================

// 画像の白色背景を透明にするヘルパー
function makeBackgroundTransparent(imgSrc) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            try {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                // 白色に近いピクセル (R, G, B すべて235以上) を透明にする
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    if (r > 230 && g > 230 && b > 230) {
                        data[i+3] = 0; // Alphaを0にする
                    }
                }
                ctx.putImageData(imgData, 0, 0);
                resolve(canvas.toDataURL());
            } catch (e) {
                // ローカル環境でのCORSエラー対策フォールバック
                console.warn("Canvas ImageData error (probably CORS). Using raw image.");
                resolve(imgSrc);
            }
        };
        img.onerror = () => {
            console.error("Failed to load image: " + imgSrc);
            resolve(imgSrc); // エラー時は元のパスを返す
        };
        img.src = imgSrc;
    });
}

// すべてのアセットを一括透過処理
async function preloadAndProcessAssets() {
    showToast("魔法の素材をロード中...", "info");
    const keys = Object.keys(ASSET_FILES);
    for (const key of keys) {
        const transparentSrc = await makeBackgroundTransparent(ASSET_FILES[key]);
        state.assetsProcessed[key] = transparentSrc;
    }
    showToast("ロード完了！", "success");
    document.getElementById('btn-start').disabled = false;
}

// ==========================================
// 2. Web Audio API サウンドシステム
// ==========================================

function initAudio() {
    if (state.audio.ctx) return;
    state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    state.audio.soundEnabled = true;
    startBGM();
}

function toggleSound() {
    if (!state.audio.ctx) {
        initAudio();
        document.getElementById('btn-sound').textContent = "🔊";
        return;
    }
    
    state.audio.soundEnabled = !state.audio.soundEnabled;
    const btn = document.getElementById('btn-sound');
    if (state.audio.soundEnabled) {
        btn.textContent = "🔊";
        if (state.audio.ctx.state === 'suspended') {
            state.audio.ctx.resume();
        }
    } else {
        btn.textContent = "🔇";
    }
}

// 8bit風のシンプルなシンセ音を再生するヘルパー
function playSynthSound(freqs, duration, type = 'sine', volume = 0.1, delay = 0) {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    
    const ctx = state.audio.ctx;
    const now = ctx.currentTime + delay;
    
    freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        
        gainNode.gain.setValueAtTime(volume, now);
        // 音がブツッと切れないように指数減衰させる
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + duration + 0.1);
    });
}

// 通常アクション音：8bit上昇アルペジオ（建築）
function playBuildSound() {
    const baseFreq = 261.63; // C4
    const dur = 0.15;
    playSynthSound([baseFreq], dur, 'triangle', 0.12, 0);
    playSynthSound([baseFreq * 1.25], dur, 'triangle', 0.12, 0.08);
    playSynthSound([baseFreq * 1.5], dur, 'triangle', 0.12, 0.16);
    playSynthSound([baseFreq * 2.0], dur, 'triangle', 0.15, 0.24);
}

// 通常アクション音：短いピコッ（ボタンクリック）
function playClickSound() {
    playSynthSound([523.25], 0.08, 'sine', 0.15);
}

// スライム討伐時のぽわん音
function playSlimeDeathSound() {
    playSynthSound([329.63], 0.1, 'sine', 0.12, 0);
    playSynthSound([440.00], 0.15, 'sine', 0.12, 0.08);
}

// 重要イベント：透き通るようなクリアなベルの和音 (FMシンセサイザー風)
function playQuestClearSound() {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    
    const ctx = state.audio.ctx;
    const now = ctx.currentTime;
    
    // クリアな和音：C5, E5, G5, C6 (ド・ミ・ソ・ドのハーモニー)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    
    // 遅延をかけて幻想的に響かせる
    notes.forEach((freq, idx) => {
        const noteDelay = idx * 0.1;
        const noteTime = now + noteDelay;
        
        // キャリアオシレータ (メインの音)
        const carrier = ctx.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(freq, noteTime);
        
        // モジュレータオシレータ (金属的な倍音を加えるFM変調)
        const modulator = ctx.createOscillator();
        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(freq * 2.01, noteTime); // わずかにずらして響きを豊かに
        
        const modGain = ctx.createGain();
        modGain.gain.setValueAtTime(freq * 1.5, noteTime);
        modGain.gain.exponentialRampToValueAtTime(0.01, noteTime + 1.2);
        
        // メインの音量封筒
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.0, noteTime);
        gainNode.gain.linearRampToValueAtTime(0.08, noteTime + 0.05); // アタックを少し柔らかく
        gainNode.gain.exponentialRampToValueAtTime(0.0001, noteTime + 2.5); // ゆっくり消えていくディケイ
        
        // フィルターをかけて高音のノイズを抑え、まろやかにする
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, noteTime);
        filter.frequency.exponentialRampToValueAtTime(800, noteTime + 2.0);
        
        // 接続
        modulator.connect(modGain);
        modGain.connect(carrier.frequency); // 周波数変調(FM)
        
        carrier.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // 再生開始
        modulator.start(noteTime);
        carrier.start(noteTime);
        
        modulator.stop(noteTime + 3.0);
        carrier.stop(noteTime + 3.0);
    });
}

// 魔法発動音：キラキラした高音スイープ
function playMagicCastSound() {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    const ctx = state.audio.ctx;
    const now = ctx.currentTime;
    
    for (let i = 0; i < 8; i++) {
        const delay = i * 0.06;
        const freq = 600 + (i * 180);
        playSynthSound([freq], 0.2, 'sine', 0.05, delay);
    }
}

// 自動BGM再生：やさしいアルペジオループ
function startBGM() {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    
    const ctx = state.audio.ctx;
    
    // コード進行：Cmaj7 -> Am7 -> Fmaj7 -> G7
    const progressions = [
        [261.63, 329.63, 392.00, 493.88], // C, E, G, B (Cmaj7)
        [220.00, 261.63, 329.63, 392.00], // A, C, E, G (Am7)
        [174.61, 220.00, 261.63, 349.23], // F, A, C, F (Fmaj7)
        [196.00, 246.94, 293.66, 349.23]  // G, B, D, F (G7)
    ];
    
    let progIndex = 0;
    let noteIndex = 0;
    
    // 16分音符の間隔でステップを刻む (BPM=100程度、1拍=600ms, 8分音符=300ms)
    state.audio.bgmInterval = setInterval(() => {
        if (!state.audio.soundEnabled) return;
        
        const now = ctx.currentTime;
        const chord = progressions[progIndex];
        
        // 8分音符ごとにやさしい音を重ねる
        if (noteIndex % 2 === 0) {
            // ベース音 (ルート音をオクターブ下で低くやわらかく)
            const rootNote = chord[0] / 2;
            const bassOsc = ctx.createOscillator();
            const bassGain = ctx.createGain();
            
            bassOsc.type = 'triangle';
            bassOsc.frequency.setValueAtTime(rootNote, now);
            
            bassGain.gain.setValueAtTime(0.03, now);
            bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
            
            bassOsc.connect(bassGain);
            bassGain.connect(ctx.destination);
            
            bassOsc.start(now);
            bassOsc.stop(now + 1.5);
        }
        
        // アルペジオノート (キラキラした高音を小さく)
        const chordNote = chord[noteIndex % chord.length];
        const arpOsc = ctx.createOscillator();
        const arpGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        arpOsc.type = 'sine';
        // 1オクターブ上でアルペジオを奏でる
        arpOsc.frequency.setValueAtTime(chordNote * 2.0, now);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1500, now);
        
        arpGain.gain.setValueAtTime(0.012, now);
        arpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        
        arpOsc.connect(filter);
        filter.connect(arpGain);
        arpGain.connect(ctx.destination);
        
        arpOsc.start(now);
        arpOsc.stop(now + 0.8);
        
        noteIndex++;
        if (noteIndex >= 8) {
            noteIndex = 0;
            progIndex = (progIndex + 1) % progressions.length;
        }
    }, 320); // 320msごとにノートを生成
}

// ==========================================
// 3. クォータービューのグリッド＆初期化
// ==========================================

function initGame() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    
    state.grid = [];
    state.characters = [];
    state.nextCharId = 1;
    
    // 8x8のグリッドを生成
    for (let r = 0; r < GRID_SIZE; r++) {
        state.grid[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            // 初期状態はすべて芝生タイル
            state.grid[r][c] = {
                col: c,
                row: r,
                tileType: 'grass',
                building: null
            };
            
            createTileDOM(c, r);
        }
    }
    
    // 初期建物の配置 (中央付近にギルド本部を配置)
    placeBuildingAt(3, 3, 'house', true); // 初期コテージ
    placeBuildingAt(4, 4, 'lumberjack', true); // 初期木こり小屋
    
    // 資源の表示更新
    updateHUD();
    
    // 初期クエストの発行
    generateNewQuest('royal');
    generateNewQuest('guild');
    generateNewQuest('archive');
    
    // スライムの定期出現タイマー (15秒ごと)
    setInterval(() => {
        if (Math.random() < 0.6) {
            spawnSlime();
        }
    }, 15000);
    
    // メインゲームループの開始 (0.1秒刻み)
    setInterval(gameTick, 100);
}

// グリッドセル座標をアイソメトリックピクセル座標に変換
function getIsoCoords(col, row) {
    // マップの中心基準
    const offset_x = 600 - (BASE_TILE_WIDTH / 2);
    const offset_y = 200;
    
    const x = (col - row) * (BASE_TILE_WIDTH / 2) + offset_x;
    const y = (col + row) * (BASE_TILE_HEIGHT / 2) + offset_y;
    return { x, y };
}

// タイルDOMの作成
function createTileDOM(col, row) {
    const board = document.getElementById('game-board');
    const { x, y } = getIsoCoords(col, row);
    
    const tileContainer = document.createElement('div');
    tileContainer.className = 'tile-container';
    tileContainer.style.left = `${x}px`;
    tileContainer.style.top = `${y}px`;
    tileContainer.style.zIndex = col + row; // 奥のものほどZインデックスを小さく
    tileContainer.dataset.col = col;
    tileContainer.dataset.row = row;
    
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.id = `tile-${col}-${row}`;
    
    // 透過処理された草原アセットを設定
    tile.style.backgroundImage = `url('${state.assetsProcessed.grass}')`;
    
    // クリックイベント
    tile.addEventListener('click', () => handleTileClick(col, row));
    
    tileContainer.appendChild(tile);
    board.appendChild(tileContainer);
}

// ==========================================
// 4. 建築・道路舗装ロジック
// ==========================================

function handleTileClick(col, row) {
    playClickSound();
    
    const cell = state.grid[row][col];
    
    // 魔法の発動ターゲット選択中の場合
    if (state.selectedTool && state.selectedTool.startsWith('spell_')) {
        castTargetSpell(col, row, state.selectedTool.replace('spell_', ''));
        return;
    }
    
    // 建築ツールが選択されている場合
    if (state.selectedTool) {
        if (state.selectedTool.startsWith('road_')) {
            // 道路の舗装
            layRoad(col, row, state.selectedTool.replace('road_', ''));
        } else {
            // 建物の配置
            placeBuildingAt(col, row, state.selectedTool);
        }
        return;
    }
    
    // 通常のクリック：詳細パネル表示
    selectCell(col, row);
}

// セル選択表示
function selectCell(col, row) {
    // 以前の選択解除
    if (state.selectedCell) {
        const prevTile = document.getElementById(`tile-${state.selectedCell.col}-${state.selectedCell.row}`);
        if (prevTile) prevTile.classList.remove('selected');
    }
    
    state.selectedCell = { col, row };
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (tile) tile.classList.add('selected');
    
    const cell = state.grid[row][col];
    showDetailsPanel(cell);
}

// 詳細パネルの表示
function showDetailsPanel(cell) {
    const panel = document.getElementById('details-panel');
    const title = document.getElementById('details-title');
    const desc = document.getElementById('details-desc');
    const level = document.getElementById('details-level');
    const prod = document.getElementById('details-production');
    const btnUpgrade = document.getElementById('btn-upgrade');
    const btnDemolish = document.getElementById('btn-demolish');
    
    if (!cell.building) {
        // 建物がない場合は非表示
        panel.classList.add('hidden');
        return;
    }
    
    panel.classList.remove('hidden');
    
    const buildType = cell.building.type;
    const config = BUILDING_TYPES[buildType];
    
    title.textContent = `${config.name} (Lv.${cell.building.level})`;
    desc.textContent = config.description;
    level.textContent = cell.building.level;
    
    // 生産ステータスの作成
    let prodText = [];
    const multi = cell.building.level * (state.activeEffects.rain > 0 ? 2 : 1);
    if (config.production.gold > 0) prodText.push(`🪙 +${(config.production.gold * multi).toFixed(1)}/s`);
    if (config.production.wood > 0) prodText.push(`🪵 +${(config.production.wood * multi).toFixed(1)}/s`);
    if (config.production.mana > 0) prodText.push(`✨ +${(config.production.mana * multi).toFixed(1)}/s`);
    prod.textContent = prodText.length > 0 ? prodText.join(' / ') : 'なし';
    
    // アップグレードコストの算出
    const upCost = Math.round(config.cost.gold * Math.pow(config.upgradeCostMultiplier, cell.building.level - 1));
    btnUpgrade.textContent = `レベルアップ (🪙${upCost})`;
    btnUpgrade.onclick = () => upgradeBuilding(cell.col, cell.row, upCost);
    
    btnDemolish.onclick = () => demolishBuilding(cell.col, cell.row);
}

// 建物を配置する
function placeBuildingAt(col, row, type, free = false) {
    const cell = state.grid[row][col];
    
    // すでに建物があるか、道路がある場合は配置不可
    if (cell.building) {
        showToast("すでに建物があります！", "warning");
        return;
    }
    
    const config = BUILDING_TYPES[type];
    if (!config) return;
    
    // 資源コストチェック
    if (!free) {
        if (state.resources.gold < config.cost.gold || 
            state.resources.wood < config.cost.wood || 
            state.resources.mana < config.cost.mana) {
            showToast("資源が足りません！", "warning");
            return;
        }
        // 消費
        state.resources.gold -= config.cost.gold;
        state.resources.wood -= config.cost.wood;
        state.resources.mana -= config.cost.mana;
    }
    
    // 住民最大枠の加算
    state.resources.popMax += config.popMaxAdd;
    
    // データ登録
    cell.building = {
        type: type,
        level: 1,
        lastProduceTime: Date.now()
    };
    
    // DOMに追加
    const tileContainer = document.querySelector(`.tile-container[data-col="${col}"][data-row="${row}"]`);
    const sprite = document.createElement('div');
    sprite.className = `building-sprite building-${type}`;
    sprite.id = `building-sprite-${col}-${row}`;
    
    // 透過処理済みの建物アセットを設定
    sprite.style.backgroundImage = `url('${state.assetsProcessed[type]}')`;
    tileContainer.appendChild(sprite);
    
    playBuildSound();
    createFloatingText(col, row, `-${config.cost.gold}🪙`, 'gold');
    
    // クエストの進捗チェック
    updateQuestProgress('build_houses');
    
    // もし酒場か兵舎が建てられた場合、冒険者を召喚
    if (type === 'tavern' || type === 'barracks') {
        spawnAdventurer(type === 'tavern' ? 'mage' : 'knight');
    }
    
    updateHUD();
    
    // 建築後に選択状態をクリア
    clearSelectedTool();
}

// 建物レベルアップ
function upgradeBuilding(col, row, cost) {
    const cell = state.grid[row][col];
    if (!cell.building) return;
    
    if (state.resources.gold < cost) {
        showToast("ゴールドが足りません！", "warning");
        return;
    }
    
    state.resources.gold -= cost;
    cell.building.level += 1;
    
    // 住民枠の追加加算
    const config = BUILDING_TYPES[cell.building.type];
    state.resources.popMax += config.popMaxAdd; // レベルアップごとに加算
    
    // アニメーション適用
    const sprite = document.getElementById(`building-sprite-${col}-${row}`);
    if (sprite) {
        sprite.classList.add('upgraded');
        setTimeout(() => sprite.classList.remove('upgraded'), 600);
    }
    
    playBuildSound();
    createFloatingText(col, row, `LvUP! ✨`, 'mana');
    
    showDetailsPanel(cell);
    updateHUD();
}

// 建物撤去
function demolishBuilding(col, row) {
    const cell = state.grid[row][col];
    if (!cell.building) return;
    
    const config = BUILDING_TYPES[cell.building.type];
    
    // 住民最大枠の減算
    state.resources.popMax = Math.max(0, state.resources.popMax - config.popMaxAdd * cell.building.level);
    
    // DOM削除
    const sprite = document.getElementById(`building-sprite-${col}-${row}`);
    if (sprite) sprite.remove();
    
    cell.building = null;
    
    playBuildSound();
    
    const panel = document.getElementById('details-panel');
    panel.classList.add('hidden');
    
    updateHUD();
}

// 道路舗装
function layRoad(col, row, type) {
    const cell = state.grid[row][col];
    if (cell.building) {
        showToast("建物がある場所には道路を敷けません", "warning");
        return;
    }
    
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (!tile) return;
    
    if (type === 'dirt') {
        if (cell.tileType === 'dirt') return;
        if (state.resources.gold < 5) {
            showToast("ゴールドが足りません", "warning");
            return;
        }
        state.resources.gold -= 5;
        cell.tileType = 'dirt';
        tile.style.backgroundImage = `url('${state.assetsProcessed.dirt}')`;
        playBuildSound();
    } else {
        // 草地に戻す
        if (cell.tileType === 'grass') return;
        cell.tileType = 'grass';
        tile.style.backgroundImage = `url('${state.assetsProcessed.grass}')`;
        playBuildSound();
    }
    
    updateHUD();
}

// ツール選択解除
function clearSelectedTool() {
    state.selectedTool = null;
    document.querySelectorAll('.shop-item, .shop-item-road, .spell-btn').forEach(btn => btn.classList.remove('selected', 'active'));
}

// ==========================================
// 5. 資源生産 ＆ HUD更新
// ==========================================

function gameTick() {
    let goldRate = 0;
    let woodRate = 0;
    let manaRate = 0;
    
    // 1. 各建物の自動生産
    const rainActive = state.activeEffects.rain > 0;
    if (rainActive) {
        state.activeEffects.rain = Math.max(0, state.activeEffects.rain - 0.1);
        updateActiveEffectsUI();
    }
    
    const productionMultiplier = rainActive ? 2.0 : 1.0;
    
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = state.grid[r][c];
            if (cell.building) {
                const config = BUILDING_TYPES[cell.building.type];
                const mult = cell.building.level * productionMultiplier;
                
                // 1秒あたりの生産値を加算 (0.1秒単位のtick)
                if (config.production.gold > 0) {
                    const add = (config.production.gold * mult) * 0.1;
                    state.resources.gold += add;
                    goldRate += config.production.gold * mult;
                }
                if (config.production.wood > 0) {
                    const add = (config.production.wood * mult) * 0.1;
                    state.resources.wood += add;
                    woodRate += config.production.wood * mult;
                }
                if (config.production.mana > 0) {
                    const add = (config.production.mana * mult) * 0.1;
                    state.resources.mana += add;
                    manaRate += config.production.mana * mult;
                }
            }
        }
    }
    
    // 自然に集まる住人の数（民家の数に応じてゆっくりと市民が訪問）
    const targetPop = Math.min(state.resources.popMax, Math.floor(state.resources.popMax));
    if (state.resources.pop < targetPop && Math.random() < 0.05) {
        state.resources.pop++;
        spawnCitizen();
    } else if (state.resources.pop > state.resources.popMax) {
        state.resources.pop = state.resources.popMax;
    }
    
    // キャラクターの移動・AI制御の実行
    updateCharacters();
    
    // クエスト自動チェック
    updateQuestProgress('gather_mana');
    updateQuestProgress('gold_target');
    
    // HUD数値表示更新
    updateHUD(goldRate, woodRate, manaRate);
}

// HUDのUI表示を書き換え
function updateHUD(goldRate = 0, woodRate = 0, manaRate = 0) {
    document.querySelector('#hud-gold .hud-value').textContent = Math.floor(state.resources.gold);
    document.getElementById('gold-change').textContent = `+${goldRate.toFixed(1)}/s`;
    
    document.querySelector('#hud-wood .hud-value').textContent = Math.floor(state.resources.wood);
    document.getElementById('wood-change').textContent = `+${woodRate.toFixed(1)}/s`;
    
    document.querySelector('#hud-mana .hud-value').textContent = Math.floor(state.resources.mana);
    document.getElementById('mana-change').textContent = `+${manaRate.toFixed(1)}/s`;
    
    document.querySelector('#hud-pop .hud-value').textContent = `${state.resources.pop} / ${state.resources.popMax}`;
    
    // ボタン類の購入可能制限をリアルタイム更新
    updateShopInteraction();
    updateSpellInteraction();
}

// 建築ショップのボタン活性状態を更新
function updateShopInteraction() {
    document.querySelectorAll('.shop-item').forEach(btn => {
        const bType = btn.dataset.build;
        const config = BUILDING_TYPES[bType];
        if (!config) return;
        
        const canAfford = state.resources.gold >= config.cost.gold &&
                          state.resources.wood >= config.cost.wood &&
                          state.resources.mana >= config.cost.mana;
        
        btn.disabled = !canAfford;
    });
}

// 魔法ボタンの活性状態を更新
function updateSpellInteraction() {
    document.querySelectorAll('.spell-btn').forEach(btn => {
        const sType = btn.dataset.spell;
        const config = SPELLS[sType];
        if (!config) return;
        
        const canAfford = state.resources.gold >= (config.cost.gold || 0) &&
                          state.resources.mana >= (config.cost.mana || 0);
        
        btn.disabled = !canAfford;
    });
}

// 画面上に通知トーストを出す
function showToast(msg, type = "info") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    
    // アニメーション後に自動削除
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// マップ上に浮遊するテキストエフェクト (+10, Dmgなど) を生成
function createFloatingText(col, row, text, type = '') {
    const board = document.getElementById('game-board');
    const { x, y } = getIsoCoords(col, row);
    
    const el = document.createElement('div');
    el.className = `floating-text ${type}`;
    el.textContent = text;
    
    // セルの中心付近に配置
    el.style.left = `${x + BASE_TILE_WIDTH / 2}px`;
    el.style.top = `${y + BASE_TILE_HEIGHT / 4}px`;
    
    board.appendChild(el);
    
    // アニメーション終了後に削除
    setTimeout(() => el.remove(), 1200);
}

// ==========================================
// 6. 魔法・スペルシステム
// ==========================================

function selectSpell(spellType) {
    playClickSound();
    
    const config = SPELLS[spellType];
    if (!config) return;
    
    // 即時発動スペルの場合
    if (config.instant) {
        castInstantSpell(spellType);
        return;
    }
    
    // 対象指定スペルの場合、カーソルを準備
    state.selectedTool = `spell_${spellType}`;
    document.querySelectorAll('.shop-item, .shop-item-road, .spell-btn').forEach(btn => btn.classList.remove('selected', 'active'));
    document.getElementById(`spell-${spellType}`).classList.add('active');
    showToast("対象のタイルを選択してください", "info");
}

// 即時発動魔法の実行
function castInstantSpell(spellType) {
    const config = SPELLS[spellType];
    
    if (state.resources.gold < (config.cost.gold || 0) || state.resources.mana < (config.cost.mana || 0)) {
        showToast("発動コストが足りません！", "warning");
        return;
    }
    
    // コスト消費
    state.resources.gold -= (config.cost.gold || 0);
    state.resources.mana -= (config.cost.mana || 0);
    
    playMagicCastSound();
    
    if (spellType === 'surge') {
        state.resources.mana += 50;
        showToast("「マナの奔流」発動！マナ+50を獲得しました。", "success");
        createFloatingText(3, 3, "+50✨", "mana");
    } else if (spellType === 'slime') {
        spawnSlime();
        showToast("「スライム召喚」成功！", "success");
    }
    
    updateHUD();
}

// 対象選択型魔法の実行
function castTargetSpell(col, row, spellType) {
    const config = SPELLS[spellType];
    
    if (state.resources.gold < (config.cost.gold || 0) || state.resources.mana < (config.cost.mana || 0)) {
        showToast("発動コストが足りません！", "warning");
        clearSelectedTool();
        return;
    }
    
    // コスト消費
    state.resources.gold -= (config.cost.gold || 0);
    state.resources.mana -= (config.cost.mana || 0);
    
    playMagicCastSound();
    
    if (spellType === 'cleanse') {
        // スライムを検索
        const slimeIdx = state.characters.findIndex(c => c.type === 'slime' && Math.round(c.x) === col && Math.round(c.y) === row);
        if (slimeIdx !== -1) {
            const slime = state.characters[slimeIdx];
            const dom = document.getElementById(`char-${slime.id}`);
            if (dom) dom.remove();
            state.characters.splice(slimeIdx, 1);
            
            playSlimeDeathSound();
            createFloatingText(col, row, "浄化！☀️", "mana");
            showToast("浄化の光でスライムを消滅させました！", "success");
            
            state.stats.slimesKilled++;
            updateQuestProgress('kill_slimes');
        } else {
            showToast("選択したセルにはスライムがいません", "warning");
        }
    }
    
    clearSelectedTool();
    updateHUD();
}

// 成長の雨（持続魔法）の開始
function startRainSpell() {
    const config = SPELLS.rain;
    if (state.resources.mana < config.cost.mana) {
        showToast("マナが足りません！", "warning");
        return;
    }
    
    state.resources.mana -= config.cost.mana;
    state.activeEffects.rain = config.duration;
    
    playMagicCastSound();
    showToast("「成長の雨」が降り始めました！生産速度が2倍になります。", "success");
    
    updateActiveEffectsUI();
    updateHUD();
}

// アクティブ魔法UIの更新
function updateActiveEffectsUI() {
    const container = document.getElementById('active-effects');
    container.innerHTML = '';
    
    if (state.activeEffects.rain > 0) {
        const row = document.createElement('div');
        row.className = 'active-effect-row';
        row.innerHTML = `<span>🌧️ 成長の雨</span> <b>${Math.ceil(state.activeEffects.rain)}s</b>`;
        container.appendChild(row);
    }
}

// ==========================================
// 7. キャラクター（冒険者・スライム・市民）AI
// ==========================================

// 冒険者の召喚
function spawnAdventurer(profession) {
    // 男女をランダムで決定
    const gender = Math.random() < 0.5 ? 'boy' : 'girl';
    const subType = `${profession}_${gender}`; // 'knight_boy', 'knight_girl', 'mage_boy', 'mage_girl'
    
    const id = state.nextCharId++;
    const adventurer = {
        id: id,
        type: 'adventurer',
        subType: subType,
        profession: profession,
        gender: gender,
        x: 3, // 酒場や兵舎ではなく中心付近から出現
        y: 3,
        targetX: 3,
        targetY: 3,
        state: 'wander',
        targetEnemy: null,
        level: 1,
        exp: 0,
        atk: profession === 'knight' ? 3 : 4,
        speed: profession === 'knight' ? 0.05 : 0.04
    };
    
    state.characters.push(adventurer);
    createCharacterDOM(adventurer);
    showToast(`新米の${profession === 'knight' ? '騎士' : '魔導士'}(${gender === 'boy' ? '男の子' : '女の子'})が街に到着しました！`, "success");
}

// スライムの出現
function spawnSlime() {
    // 境界の端っこから出現
    const edgeCoords = [
        {x: 0, y: Math.floor(Math.random() * GRID_SIZE)},
        {x: GRID_SIZE - 1, y: Math.floor(Math.random() * GRID_SIZE)},
        {x: Math.floor(Math.random() * GRID_SIZE), y: 0},
        {x: Math.floor(Math.random() * GRID_SIZE), y: GRID_SIZE - 1}
    ];
    const spawnPoint = edgeCoords[Math.floor(Math.random() * edgeCoords.length)];
    
    const id = state.nextCharId++;
    const slime = {
        id: id,
        type: 'slime',
        subType: 'slime',
        x: spawnPoint.x,
        y: spawnPoint.y,
        targetX: spawnPoint.x,
        targetY: spawnPoint.y,
        state: 'wander',
        hp: 8,
        maxHp: 8,
        speed: 0.02
    };
    
    state.characters.push(slime);
    createCharacterDOM(slime);
    showToast("かわいいスライムが街の境界線から入ってきました！", "warning");
}

// 市民（一般市民）の出現
function spawnCitizen() {
    const gender = Math.random() < 0.5 ? 'boy' : 'girl';
    // 住民はMageかKnightのちびグラフィックを流用
    const subType = gender === 'boy' ? 'knight_boy' : 'mage_girl';
    
    const id = state.nextCharId++;
    const citizen = {
        id: id,
        type: 'citizen',
        subType: subType,
        x: 0,
        y: 0,
        targetX: 3,
        targetY: 3,
        state: 'wander',
        speed: 0.03
    };
    
    state.characters.push(citizen);
    createCharacterDOM(citizen);
}

// キャラクターDOM要素の作成
function createCharacterDOM(char) {
    const board = document.getElementById('game-board');
    const el = document.createElement('div');
    el.className = `character-sprite ${char.type === 'slime' ? 'slime active-slime' : char.subType.replace('_', '-')}`;
    el.id = `char-${char.id}`;
    
    // スタイル画像の設定 (透過処理済みのものを使用)
    let assetKey = char.subType;
    if (char.type === 'slime') assetKey = 'slime';
    else if (char.subType.includes('knight_boy')) assetKey = 'knight_boy';
    else if (char.subType.includes('knight_girl')) assetKey = 'knight_girl';
    else if (char.subType.includes('mage_boy')) assetKey = 'mage_boy';
    else if (char.subType.includes('mage_girl')) assetKey = 'mage_girl';
    
    el.style.backgroundImage = `url('${state.assetsProcessed[assetKey]}')`;
    
    // 初期配置
    const pix = getIsoCoords(char.x, char.y);
    el.style.left = `${pix.x + BASE_TILE_WIDTH / 2}px`;
    el.style.top = `${pix.y + BASE_TILE_HEIGHT / 3}px`;
    el.style.zIndex = Math.floor(char.x + char.y) + 2; // 建物などと同レイヤー
    
    board.appendChild(el);
}

// キャラクター全体のAI処理と移動
function updateCharacters() {
    const listToRemove = [];
    
    state.characters.forEach(char => {
        const dom = document.getElementById(`char-${char.id}`);
        if (!dom) return;
        
        // --- 1. 行動決定AI ---
        if (char.type === 'adventurer') {
            adventurerAI(char);
        } else if (char.type === 'slime') {
            slimeAI(char);
        } else if (char.type === 'citizen') {
            citizenAI(char);
        }
        
        // --- 2. 移動処理 ---
        // 目標座標と現在位置の差分
        const dx = char.targetX - char.x;
        const dy = char.targetY - char.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 0.05) {
            // スピードに合わせて目標へ進む
            const step = Math.min(char.speed, dist);
            char.x += (dx / dist) * step;
            char.y += (dy / dist) * step;
            
            // 向き転換 (左右反転表示)
            if (dx > 0) {
                dom.style.transform = "translate(-50%, -50%) scaleX(1)";
            } else if (dx < 0) {
                dom.style.transform = "translate(-50%, -50%) scaleX(-1)";
            }
        } else {
            // 到着した際の処理
            char.x = char.targetX;
            char.y = char.targetY;
            
            if (char.state === 'walk_to_target' || char.state === 'wander') {
                // 新しいランダムな目標を設定
                setRandomTarget(char);
            }
        }
        
        // --- 3. DOM位置の同期 ---
        const pix = getIsoCoords(char.x, char.y);
        dom.style.left = `${pix.x + BASE_TILE_WIDTH / 2}px`;
        dom.style.top = `${pix.y + BASE_TILE_HEIGHT / 3}px`;
        dom.style.zIndex = Math.floor(char.x + char.y) + 2;
    });
}

// ランダムな移動先セルをセットする
function setRandomTarget(char) {
    let randX = char.x + (Math.random() * 4 - 2);
    let randY = char.y + (Math.random() * 4 - 2);
    
    // グリッド範囲内かつ道路が優先的に選ばれるよう補正
    randX = Math.max(0, Math.min(GRID_SIZE - 1, randX));
    randY = Math.max(0, Math.min(GRID_SIZE - 1, randY));
    
    char.targetX = Math.round(randX);
    char.targetY = Math.round(randY);
    char.state = 'wander';
}

// 市民AI: ただのんびり歩き回る
function citizenAI(char) {
    // 特になし
}

// スライムAI: のんびり歩き回り、たまに近くの生産物を吸い取る（幸福度低下）
function slimeAI(char) {
    if (Math.random() < 0.01) {
        state.resources.happiness = Math.max(50, state.resources.happiness - 1);
    }
}

// 冒険者AI: スライムを探し、見つけたら攻撃する
function adventurerAI(char) {
    // 1. すでに索敵ターゲットがいる場合、戦闘か移動
    if (char.targetEnemy) {
        // 敵が存在するか生存チェック
        const enemy = state.characters.find(c => c.id === char.targetEnemy.id);
        if (!enemy) {
            char.targetEnemy = null;
            char.state = 'wander';
            return;
        }
        
        // 敵との距離計算
        const dx = enemy.x - char.x;
        const dy = enemy.y - char.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist <= 0.8) {
            // 戦闘射程内
            char.targetX = char.x;
            char.targetY = char.y;
            char.state = 'combat';
            
            // クールダウン攻撃
            if (!char.lastAttackTime || Date.now() - char.lastAttackTime > 1000) {
                char.lastAttackTime = Date.now();
                attackEnemy(char, enemy);
            }
        } else {
            // 敵のいる場所を追いかける
            char.targetX = enemy.x;
            char.targetY = enemy.y;
            char.state = 'walk_to_target';
        }
        return;
    }
    
    // 2. 近くのスライムを索敵 (半径4セル以内)
    const slimes = state.characters.filter(c => c.type === 'slime');
    let closestSlime = null;
    let minDist = 999;
    
    slimes.forEach(slime => {
        const dx = slime.x - char.x;
        const dy = slime.y - char.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < minDist && dist < 4) {
            minDist = dist;
            closestSlime = slime;
        }
    });
    
    if (closestSlime) {
        char.targetEnemy = closestSlime;
        char.state = 'walk_to_target';
        createEmoteBubble(char.id, '⚔️');
    }
}

// 攻撃アクション
function attackEnemy(attacker, defender) {
    // ダメージ計算
    const dmg = Math.round(attacker.atk * (0.8 + Math.random() * 0.4));
    defender.hp -= dmg;
    
    // ダメージポップアップ
    createFloatingText(defender.x, defender.y, `-${dmg}`, 'damage');
    
    // 攻撃演出（DOMを少しプルプル動かす）
    const dom = document.getElementById(`char-${attacker.id}`);
    if (dom) {
        dom.style.transform += " translateY(-5px)";
        setTimeout(() => {
            dom.style.transform = dom.style.transform.replace(" translateY(-5px)", "");
        }, 150);
    }
    
    // 死亡チェック
    if (defender.hp <= 0) {
        const index = state.characters.findIndex(c => c.id === defender.id);
        if (index !== -1) {
            // 画面上から削除
            const defDom = document.getElementById(`char-${defender.id}`);
            if (defDom) defDom.remove();
            state.characters.splice(index, 1);
            
            playSlimeDeathSound();
            
            // 報酬獲得
            const goldReward = 15;
            state.resources.gold += goldReward;
            createFloatingText(defender.x, defender.y, `+${goldReward}🪙`, 'gold');
            
            // 経験値加算
            attacker.exp += 40;
            createFloatingText(attacker.x, attacker.y, `+40 EXP`, 'exp');
            
            // レベルアップチェック
            if (attacker.exp >= 100) {
                attacker.level++;
                attacker.exp -= 100;
                attacker.atk += 2;
                playSynthSound([523.25, 659.25, 783.99, 1046.50], 0.6, 'sine', 0.12); // ファンファーレ
                createFloatingText(attacker.x, attacker.y, `LvUP! ✨`, 'mana');
                createEmoteBubble(attacker.id, '👑');
                showToast(`冒険者がレベル${attacker.level}に上がりました！`, "success");
            }
            
            state.stats.slimesKilled++;
            updateQuestProgress('kill_slimes');
            attacker.targetEnemy = null;
            attacker.state = 'wander';
        }
    }
}

// キャラクターの上に吹き出し（絵文字）を一時的に出す
function createEmoteBubble(charId, emoji) {
    const dom = document.getElementById(`char-${charId}`);
    if (!dom) return;
    
    // すでに吹き出しがあれば削除
    const prev = dom.querySelector('.emote-bubble');
    if (prev) prev.remove();
    
    const bubble = document.createElement('div');
    bubble.className = 'emote-bubble';
    bubble.textContent = emoji;
    bubble.style.position = 'absolute';
    bubble.style.top = '-25px';
    bubble.style.left = '50%';
    bubble.style.transform = 'translateX(-50%)';
    bubble.style.background = 'white';
    bubble.style.border = '1px solid black';
    bubble.style.borderRadius = '50%';
    bubble.style.padding = '2px';
    bubble.style.fontSize = '0.8rem';
    bubble.style.zIndex = '999';
    bubble.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
    
    dom.appendChild(bubble);
    
    // 2.5秒後に自動消滅
    setTimeout(() => bubble.remove(), 2500);
}

// ==========================================
// 8. 政治・勢力・クエストシステム
// ==========================================

// クエスト定義リスト
const QUEST_TEMPLATES = {
    royal: [
        { desc: '国庫への貢献：ゴールドを300以上蓄えよう', type: 'gold_target', target: 300, repReward: 15, goldReward: 0, woodReward: 50 },
        { desc: '都市拡大：民家を4軒以上建設しよう', type: 'build_houses', countType: 'house', target: 4, repReward: 20, goldReward: 50, woodReward: 20 }
    ],
    guild: [
        { desc: '魔物退治：スライムを合計5匹退治しよう', type: 'kill_slimes', target: 5, repReward: 20, goldReward: 100, woodReward: 0 },
        { desc: '冒険拠点：酒場を1軒建設しよう', type: 'build_houses', countType: 'tavern', target: 1, repReward: 15, goldReward: 50, woodReward: 30 }
    ],
    archive: [
        { desc: '魔力奉納：マナを200以上蓄えよう', type: 'gather_mana', target: 200, repReward: 15, goldReward: 0, woodReward: 40 },
        { desc: '神秘施設：魔力塔を2基以上建設しよう', type: 'build_houses', countType: 'mana_tower', target: 2, repReward: 20, goldReward: 50, woodReward: 10 }
    ]
};

// クエストをランダム生成して割り当て
function generateNewQuest(factionKey) {
    const list = QUEST_TEMPLATES[factionKey];
    const quest = {...list[Math.floor(Math.random() * list.length)]};
    
    // クエスト進行度リセット
    quest.current = 0;
    
    // 蓄積値タイプは現在の資源量または統計値を設定
    if (quest.type === 'kill_slimes') {
        quest.startVal = state.stats.slimesKilled;
    }
    
    state.factions[factionKey].quest = quest;
    renderFactionQuestUI(factionKey);
}

// 勢力UIの表示更新
function renderFactionQuestUI(factionKey) {
    const faction = state.factions[factionKey];
    const quest = faction.quest;
    
    const panel = document.getElementById(`faction-${factionKey}`);
    if (!panel) return;
    
    // 友好度バーとテキストの更新
    const repBar = panel.querySelector('.rep-bar');
    const repText = panel.querySelector('.rep-text');
    repBar.style.width = `${Math.min(100, faction.rep)}%`;
    repText.textContent = `友好度: ${getRepName(faction.rep)} (${faction.rep})`;
    
    // クエストエリアの更新
    const qDesc = document.getElementById(`quest-${factionKey}`).querySelector('.quest-desc');
    const qBtn = document.getElementById(`btn-quest-${factionKey}`);
    
    if (quest) {
        qDesc.textContent = `${quest.desc} (${quest.current} / ${quest.target})`;
        // 条件達成ならボタン活性化
        const isComplete = quest.current >= quest.target;
        qBtn.disabled = !isComplete;
        qBtn.onclick = () => completeQuest(factionKey);
    } else {
        qDesc.textContent = '進行中のクエストはありません';
        qBtn.disabled = true;
    }
}

// 友好度のランク名取得
function getRepName(rep) {
    if (rep >= 90) return '熱狂的支持 (同盟)';
    if (rep >= 75) return 'とても友好';
    if (rep >= 60) return '好意的';
    if (rep >= 40) return '中立';
    return '冷ややか';
}

// 各種アクション時のクエスト進行度チェック
function updateQuestProgress(actionType) {
    const factionsKeys = Object.keys(state.factions);
    
    factionsKeys.forEach(fKey => {
        const quest = state.factions[fKey].quest;
        if (!quest) return;
        
        let changed = false;
        
        if (quest.type === 'gold_target' && actionType === 'gold_target') {
            quest.current = Math.floor(state.resources.gold);
            changed = true;
        } else if (quest.type === 'gather_mana' && actionType === 'gather_mana') {
            quest.current = Math.floor(state.resources.mana);
            changed = true;
        } else if (quest.type === 'kill_slimes' && actionType === 'kill_slimes') {
            quest.current = state.stats.slimesKilled - quest.startVal;
            changed = true;
        } else if (quest.type === 'build_houses' && actionType === 'build_houses') {
            // 全グリッドを走査して指定建物の数を集計
            let count = 0;
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    const b = state.grid[r][c].building;
                    if (b && b.type === quest.countType) count++;
                }
            }
            quest.current = count;
            changed = true;
        }
        
        if (changed) {
            renderFactionQuestUI(fKey);
        }
    });
}

// クエスト完了処理
function completeQuest(factionKey) {
    const faction = state.factions[factionKey];
    const quest = faction.quest;
    if (!quest || quest.current < quest.target) return;
    
    // 1. 豪華なクリアチャイムを再生 (クリアなFMベル和音)
    playQuestClearSound();
    
    // 2. 友好度アップ
    faction.rep += quest.repReward;
    
    // 3. 資源報酬
    if (quest.goldReward > 0) state.resources.gold += quest.goldReward;
    if (quest.woodReward > 0) state.resources.wood += quest.woodReward;
    
    showToast(`${faction.name}のクエスト完了！ 友好度+${quest.repReward}、報酬を獲得しました！`, "success");
    
    // 特典チェック
    checkFactionBonuses(factionKey);
    
    // 新しいクエスト発行
    generateNewQuest(factionKey);
    updateHUD();
}

// 勢力ごとの友好度ボーナスチェック
function checkFactionBonuses(factionKey) {
    const faction = state.factions[factionKey];
    if (faction.rep >= 80 && !faction.bonusUnlocked) {
        faction.bonusUnlocked = true;
        
        if (factionKey === 'royal') {
            showToast("👑 王宮の強力な支援がアンロックされました！ゴールドの税収効率が+30%上昇しました。", "success");
            // 税金ボーナス加算
            BUILDING_TYPES.house.production.gold *= 1.30;
            BUILDING_TYPES.tavern.production.gold *= 1.30;
        } else if (factionKey === 'guild') {
            showToast("⚔️ 冒険者ギルドとの同盟締結！より強い「エリート魔導士」が追加召喚されます！", "success");
            spawnAdventurer('mage');
        } else if (factionKey === 'archive') {
            showToast("🔮 大魔導書院の最高秘術を伝授！スペル「成長の雨」のコストがマナ10に半減しました！", "success");
            SPELLS.rain.cost.mana = 10;
            document.getElementById('spell-rain').querySelector('.spell-cost').textContent = "✨10";
        }
    }
}

// ==========================================
// 9. ビューポート操作 (ドラッグ＆ズーム)
// ==========================================

function initViewportControls() {
    const viewport = document.getElementById('viewport');
    const board = document.getElementById('game-board');
    
    // 初期位置設定 (中央に配置)
    const viewWidth = viewport.clientWidth;
    const viewHeight = viewport.clientHeight;
    state.viewport.x = (viewWidth - 1200) / 2;
    state.viewport.y = 80;
    updateViewportTransform();
    
    // マウスドラッグ移動
    viewport.addEventListener('mousedown', (e) => {
        // ショップやUIの上でのドラッグを弾く
        if (e.target.closest('#hud, #spell-book, #faction-panel, #shop, #details-panel, .btn')) return;
        
        state.viewport.isDragging = true;
        state.viewport.startX = e.clientX - state.viewport.x;
        state.viewport.startY = e.clientY - state.viewport.y;
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!state.viewport.isDragging) return;
        state.viewport.x = e.clientX - state.viewport.startX;
        state.viewport.y = e.clientY - state.viewport.startY;
        updateViewportTransform();
    });
    
    window.addEventListener('mouseup', () => {
        state.viewport.isDragging = false;
    });
    
    // マウスホイールでのズーム
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // 拡大・縮小率
        const zoomStep = 0.05;
        if (e.deltaY < 0) {
            state.viewport.scale = Math.min(1.5, state.viewport.scale + zoomStep);
        } else {
            state.viewport.scale = Math.max(0.6, state.viewport.scale - zoomStep);
        }
        updateViewportTransform();
    });
}

function updateViewportTransform() {
    const board = document.getElementById('game-board');
    board.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
}

// ==========================================
// 10. アプリケーション開始・イベントハンドリング
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    // 1. 画像プレロードと白背景の自動透過処理
    preloadAndProcessAssets();
    
    // 2. スタートボタン設定
    document.getElementById('btn-start').addEventListener('click', () => {
        playClickSound();
        initAudio(); // 音声コンテキスト起動
        
        // UI切替
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        
        // 初期化実行
        initViewportControls();
        initGame();
    });
    
    // 3. ショップカテゴリタブ切り替え
    document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            playClickSound();
            document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.shop-tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const contentId = `tab-${tab.dataset.tab}`;
            document.getElementById(contentId).classList.add('active');
        });
    });
    
    // 4. 建築アイテム選択
    document.querySelectorAll('.shop-item').forEach(item => {
        item.addEventListener('click', () => {
            playClickSound();
            const isSelected = item.classList.contains('selected');
            clearSelectedTool();
            
            if (!isSelected) {
                item.classList.add('selected');
                state.selectedTool = item.dataset.build;
                showToast("マップをクリックして建物を建ててください", "info");
            }
        });
    });
    
    // 5. 道路ツール選択
    document.querySelectorAll('.shop-item-road').forEach(item => {
        item.addEventListener('click', () => {
            playClickSound();
            const isSelected = item.classList.contains('selected');
            clearSelectedTool();
            
            if (!isSelected) {
                item.classList.add('selected');
                state.selectedTool = `road_${item.dataset.road}`;
                showToast("マップをクリック/ドラッグして道路を敷いてください", "info");
            }
        });
    });
    
    // 6. 魔法スペルボタン選択
    document.getElementById('spell-rain').addEventListener('click', startRainSpell);
    document.getElementById('spell-surge').addEventListener('click', () => selectSpell('surge'));
    document.getElementById('spell-slime').addEventListener('click', () => selectSpell('slime'));
    document.getElementById('spell-cleanse').addEventListener('click', () => selectSpell('cleanse'));
    
    // 7. サウンドトグル設定
    document.getElementById('btn-sound').addEventListener('click', toggleSound);
    
    // 8. 詳細パネル閉じる
    document.getElementById('btn-close-details').addEventListener('click', () => {
        playClickSound();
        document.getElementById('details-panel').classList.add('hidden');
        if (state.selectedCell) {
            const tile = document.getElementById(`tile-${state.selectedCell.col}-${state.selectedCell.row}`);
            if (tile) tile.classList.remove('selected');
            state.selectedCell = null;
        }
    });
});
