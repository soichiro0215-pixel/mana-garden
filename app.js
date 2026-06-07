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
    cleanse: { name: '浄化の光', cost: { mana: 15, gold: 0 }, target: true } // 指定タイルのスライムや障害物を除去
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
                // 白色に近いピクセル (R, G, B すべて230以上) を透明にする
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
            resolve(imgSrc);
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
// 2. Web Audio API サウンドシステム (改良版)
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
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, idx) => {
        const noteDelay = idx * 0.08;
        const noteTime = now + noteDelay;
        
        const carrier = ctx.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(freq, noteTime);
        
        const modulator = ctx.createOscillator();
        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(freq * 2.01, noteTime);
        
        const modGain = ctx.createGain();
        modGain.gain.setValueAtTime(freq * 1.8, noteTime);
        modGain.gain.exponentialRampToValueAtTime(0.01, noteTime + 1.5);
        
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.0, noteTime);
        gainNode.gain.linearRampToValueAtTime(0.1, noteTime + 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, noteTime + 2.8);
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, noteTime);
        filter.frequency.exponentialRampToValueAtTime(700, noteTime + 2.2);
        
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        
        carrier.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        modulator.start(noteTime);
        carrier.start(noteTime);
        
        modulator.stop(noteTime + 3.5);
        carrier.stop(noteTime + 3.5);
    });
}

// 魔法発動音：キラキラした高音スイープ
function playMagicCastSound() {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    const ctx = state.audio.ctx;
    const now = ctx.currentTime;
    
    for (let i = 0; i < 8; i++) {
        const delay = i * 0.05;
        const freq = 500 + (i * 200);
        playSynthSound([freq], 0.22, 'sine', 0.04, delay);
    }
}

// 改良版自動BGM再生：和音パッド、ノイズドラム、ランダムペンタトニックメロディによる複数パート構成
function startBGM() {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    
    const ctx = state.audio.ctx;
    
    // コード進行：Cmaj7 -> Am7 -> Fmaj7 -> G7 (メジャーキー)
    const progressions = [
        [130.81, 164.81, 196.00, 246.94], // C3, E3, G3, B3 (Cmaj7)
        [110.00, 130.81, 164.81, 196.00], // A2, C3, E3, G3 (Am7)
        [87.31, 110.00, 130.81, 174.61],  // F2, A2, C3, F3 (Fmaj7)
        [98.00, 123.47, 146.83, 174.61]   // G2, B2, D3, F3 (G7)
    ];
    
    // ペンタトニックスケール (C4, D4, E4, G4, A4, C5, D5, E5, G5, A5)
    const melodyScale = [
        261.63, 293.66, 329.63, 392.00, 440.00,
        523.25, 587.33, 659.25, 783.99, 880.00
    ];
    
    let step = 0;
    
    state.audio.bgmInterval = setInterval(() => {
        if (!state.audio.soundEnabled) return;
        
        const now = ctx.currentTime;
        const measure = Math.floor(step / 8);
        const beat = step % 8;
        const chordIdx = measure % progressions.length;
        const chord = progressions[chordIdx];
        
        // ------------------------------------
        // 1. コードパッド (白玉) & ベース (小節の頭で演奏)
        // ------------------------------------
        if (beat === 0) {
            // パッド音 (三角波にローパスフィルターをかけて温かく)
            chord.forEach((freq) => {
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                const filter = ctx.createBiquadFilter();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);
                
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(700, now);
                
                // ふんわりとしたボリューム変化 (アタックに1.2秒、リリースに0.8秒)
                gainNode.gain.setValueAtTime(0, now);
                gainNode.gain.linearRampToValueAtTime(0.015, now + 1.2);
                gainNode.gain.setValueAtTime(0.015, now + 2.2);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 3.1);
                
                osc.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(ctx.destination);
                
                osc.start(now);
                osc.stop(now + 3.2);
            });
            
            // ディープベース音 (正弦波で低域をしっかり出す)
            const bassOsc = ctx.createOscillator();
            const bassGain = ctx.createGain();
            const bassFilter = ctx.createBiquadFilter();
            
            bassOsc.type = 'sine';
            bassOsc.frequency.setValueAtTime(chord[0] / 2, now); // ルートの1オクターブ下
            
            bassFilter.type = 'lowpass';
            bassFilter.frequency.setValueAtTime(150, now);
            
            bassGain.gain.setValueAtTime(0, now);
            bassGain.gain.linearRampToValueAtTime(0.025, now + 0.6);
            bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
            
            bassOsc.connect(bassFilter);
            bassFilter.connect(bassGain);
            bassGain.connect(ctx.destination);
            
            bassOsc.start(now);
            bassOsc.stop(now + 3.2);
        }
        
        // ------------------------------------
        // 2. ノイズドラム (2拍・6拍目、ブラシスネア風)
        // ------------------------------------
        if (beat === 2 || beat === 6) {
            try {
                const bufferSize = ctx.sampleRate * 0.08; // 80msのノイズ
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                
                const noiseNode = ctx.createBufferSource();
                noiseNode.buffer = buffer;
                
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 1200;
                
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.006, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
                
                noiseNode.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                
                noiseNode.start(now);
            } catch (e) {
                // フォールバック
            }
        }
        
        // ------------------------------------
        // 3. ランダムペンタトニックメロディ (ハープ風)
        // ------------------------------------
        // 35%の確率で、現在のコードと調和した美しい主旋律を即興演奏
        if (Math.random() < 0.35 && beat !== 4 && beat !== 7) {
            const noteFreq = melodyScale[Math.floor(Math.random() * melodyScale.length)];
            
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(noteFreq, now);
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2000, now);
            
            // アタックは速く、リリースはゆるやかに響かせる
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.015, now + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
            
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.7);
        }
        
        step++;
    }, 400); // 400ms間隔
}

// ==========================================
// 3. クォータービューのグリッド＆初期化
// ==========================================

function initGame() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    
    // 浮遊島ベース（3D崖・影のレイヤー）をDOMに追加
    const baseShadow = document.createElement('div');
    baseShadow.id = 'island-base';
    board.appendChild(baseShadow);
    
    state.grid = [];
    state.characters = [];
    state.nextCharId = 1;
    
    // 8x8のグリッドを生成
    for (let r = 0; r < GRID_SIZE; r++) {
        state.grid[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            state.grid[r][c] = {
                col: c,
                row: r,
                tileType: 'grass',
                building: null,
                obstacle: null
            };
            
            createTileDOM(c, r);
        }
    }
    
    // 障害物の初期配置 (枯れ木、魔力岩、古代の廃墟をランダムに計6個配置)
    let obstacleCount = 0;
    while (obstacleCount < 6) {
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * GRID_SIZE);
        
        // 中央(3,3),(4,4)は初期建物用なので避ける
        if ((r === 3 && c === 3) || (r === 4 && c === 4)) continue;
        if (state.grid[r][c].obstacle) continue;
        
        const types = ['tree', 'rock', 'ruin'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        state.grid[r][c].obstacle = { type: type };
        createObstacleDOM(c, r, type);
        obstacleCount++;
    }
    
    // 初期建物の配置
    placeBuildingAt(3, 3, 'house', true); // 初期コテージ
    placeBuildingAt(4, 4, 'lumberjack', true); // 初期木こり小屋
    
    // 資源の表示更新
    updateHUD();
    
    // クエスト発行
    generateNewQuest('royal');
    generateNewQuest('guild');
    generateNewQuest('archive');
    
    // スライム出現タイマー
    setInterval(() => {
        if (Math.random() < 0.6) {
            spawnSlime();
        }
    }, 15000);
    
    // メインループ
    setInterval(gameTick, 100);
}

// セル座標をアイソメトリックピクセル座標に変換
function getIsoCoords(col, row) {
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
    tileContainer.style.zIndex = col + row;
    tileContainer.dataset.col = col;
    tileContainer.dataset.row = row;
    
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.id = `tile-${col}-${row}`;
    tile.style.backgroundImage = `url('${state.assetsProcessed.grass}')`;
    
    // 初期ホバーツールチップの設定
    tile.dataset.tip = `🌿 <b>草原タイル (${col}, ${row})</b><br>建物を建設できる平らな草地です。`;
    
    // クリックイベント
    tile.addEventListener('click', () => handleTileClick(col, row));
    
    tileContainer.appendChild(tile);
    board.appendChild(tileContainer);
}

// 障害物DOMの作成
function createObstacleDOM(col, row, type) {
    const tileContainer = document.querySelector(`.tile-container[data-col="${col}"][data-row="${row}"]`);
    if (!tileContainer) return;
    
    const sprite = document.createElement('div');
    if (type === 'ruin') {
        sprite.className = `building-sprite obstacle-ruin`;
        sprite.style.backgroundImage = `url('${state.assetsProcessed.house}')`;
    } else {
        sprite.className = `obstacle-sprite`;
        sprite.textContent = type === 'tree' ? '🪵' : '🪨';
    }
    sprite.id = `obstacle-sprite-${col}-${row}`;
    tileContainer.appendChild(sprite);
    
    // タイルのツールチップを障害物用に変更
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (tile) {
        if (type === 'tree') {
            tile.dataset.tip = `🪵 <b>枯れ木</b><br>土地を塞ぐ枯れ木です。<br>・クリックして開拓 (🪙20) -> 🪵+30`;
        } else if (type === 'rock') {
            tile.dataset.tip = `🪨 <b>魔力岩</b><br>マナを含んだ硬い岩です。<br>・クリックして開拓 (🪙30) -> ✨+15`;
        } else if (type === 'ruin') {
            tile.dataset.tip = `🏚️ <b>古代の廃墟</b><br>苔むした昔の建物の跡です。<br>・クリックして浄化 (✨20) -> 🪙+60`;
        }
    }
}

// ==========================================
// 4. 建築・整地・開拓ロジック
// ==========================================

function handleTileClick(col, row) {
    playClickSound();
    
    const cell = state.grid[row][col];
    
    // 魔法の発動ターゲット選択中の場合
    if (state.selectedTool && state.selectedTool.startsWith('spell_')) {
        castTargetSpell(col, row, state.selectedTool.replace('spell_', ''));
        return;
    }
    
    // 障害物がある場合は詳細（開拓）パネルを開く
    if (cell.obstacle) {
        selectCell(col, row);
        return;
    }
    
    // 建築ツール選択中の場合
    if (state.selectedTool) {
        if (state.selectedTool.startsWith('road_')) {
            layRoad(col, row, state.selectedTool.replace('road_', ''));
        } else {
            placeBuildingAt(col, row, state.selectedTool);
        }
        return;
    }
    
    // 通常のクリック：詳細表示
    selectCell(col, row);
}

// セル選択表示
function selectCell(col, row) {
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
    
    // 1. 障害物セルの場合
    if (cell.obstacle) {
        panel.classList.remove('hidden');
        btnUpgrade.classList.add('hidden');
        btnDemolish.classList.remove('hidden');
        
        const type = cell.obstacle.type;
        if (type === 'tree') {
            title.textContent = "枯れ木 🪵";
            desc.textContent = "邪魔な枯れ木です。開拓して土地をすっきりさせ、木材を獲得しましょう。";
            level.textContent = "なし";
            prod.textContent = "開拓報酬: 🪵+30";
            btnDemolish.textContent = "開拓する (🪙20)";
            btnDemolish.className = "btn btn-primary";
            btnDemolish.onclick = () => clearObstacle(cell.col, cell.row, { gold: 20 }, { wood: 30 });
        } else if (type === 'rock') {
            title.textContent = "魔力岩 🪨";
            desc.textContent = "マナが結晶化した神秘的な岩です。砕くことでマナを回収できます。";
            level.textContent = "なし";
            prod.textContent = "開拓報酬: ✨+15";
            btnDemolish.textContent = "砕く (🪙30)";
            btnDemolish.className = "btn btn-primary";
            btnDemolish.onclick = () => clearObstacle(cell.col, cell.row, { gold: 30 }, { mana: 15 });
        } else if (type === 'ruin') {
            title.textContent = "古代の廃墟 🏚️";
            desc.textContent = "古代魔法都市の遺物です。マナを使って浄化すると、埋もれていたゴールドが手に入ります。";
            level.textContent = "なし";
            prod.textContent = "浄化報酬: 🪙+60";
            btnDemolish.textContent = "浄化する (✨20)";
            btnDemolish.className = "btn btn-primary";
            btnDemolish.onclick = () => clearObstacle(cell.col, cell.row, { mana: 20 }, { gold: 60 });
        }
        return;
    }
    
    // 2. 建物がない場合
    if (!cell.building) {
        panel.classList.add('hidden');
        return;
    }
    
    // 3. 建物がある場合
    panel.classList.remove('hidden');
    btnUpgrade.classList.remove('hidden');
    btnDemolish.className = "btn btn-danger";
    btnDemolish.textContent = "撤去";
    
    const buildType = cell.building.type;
    const config = BUILDING_TYPES[buildType];
    
    title.textContent = `${config.name} (Lv.${cell.building.level})`;
    desc.textContent = config.description;
    level.textContent = cell.building.level;
    
    let prodText = [];
    const multi = cell.building.level * (state.activeEffects.rain > 0 ? 2 : 1);
    if (config.production.gold > 0) prodText.push(`🪙 +${(config.production.gold * multi).toFixed(1)}/s`);
    if (config.production.wood > 0) prodText.push(`🪵 +${(config.production.wood * multi).toFixed(1)}/s`);
    if (config.production.mana > 0) prodText.push(`✨ +${(config.production.mana * multi).toFixed(1)}/s`);
    prod.textContent = prodText.length > 0 ? prodText.join(' / ') : 'なし';
    
    const upCost = Math.round(config.cost.gold * Math.pow(config.upgradeCostMultiplier, cell.building.level - 1));
    btnUpgrade.textContent = `レベルアップ (🪙${upCost})`;
    btnUpgrade.onclick = () => upgradeBuilding(cell.col, cell.row, upCost);
    
    btnDemolish.onclick = () => demolishBuilding(cell.col, cell.row);
}

// 障害物の開拓実行
function clearObstacle(col, row, cost, reward) {
    const cell = state.grid[row][col];
    if (!cell.obstacle) return;
    
    // 資源コストチェック
    if (cost.gold && state.resources.gold < cost.gold) {
        showToast("ゴールドが足りません！", "warning");
        return;
    }
    if (cost.mana && state.resources.mana < cost.mana) {
        showToast("マナが足りません！", "warning");
        return;
    }
    
    // 消費
    if (cost.gold) state.resources.gold -= cost.gold;
    if (cost.mana) state.resources.mana -= cost.mana;
    
    // 報酬獲得
    if (reward.gold) {
        state.resources.gold += reward.gold;
        createFloatingText(col, row, `+${reward.gold}🪙`, 'gold');
    }
    if (reward.wood) {
        state.resources.wood += reward.wood;
        createFloatingText(col, row, `+${reward.wood}🪵`, 'wood');
    }
    if (reward.mana) {
        state.resources.mana += reward.mana;
        createFloatingText(col, row, `+${reward.mana}✨`, 'mana');
    }
    
    // DOM要素の削除
    const sprite = document.getElementById(`obstacle-sprite-${col}-${row}`);
    if (sprite) sprite.remove();
    
    cell.obstacle = null;
    
    // タイルのツールチップを空地にリセット
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (tile) {
        tile.dataset.tip = `🌿 <b>草原タイル (${col}, ${row})</b><br>建物を建設できる平らな草地です。`;
    }
    
    playBuildSound();
    showToast("土地を開拓しました！", "success");
    
    // 詳細パネルと選択解除
    document.getElementById('details-panel').classList.add('hidden');
    if (state.selectedCell) {
        const t = document.getElementById(`tile-${state.selectedCell.col}-${state.selectedCell.row}`);
        if (t) t.classList.remove('selected');
        state.selectedCell = null;
    }
    
    updateHUD();
}

// 建物を配置する
function placeBuildingAt(col, row, type, free = false) {
    const cell = state.grid[row][col];
    
    if (cell.building || cell.obstacle) {
        showToast("この場所には建設できません！", "warning");
        return;
    }
    
    const config = BUILDING_TYPES[type];
    if (!config) return;
    
    // コスト消費
    if (!free) {
        if (state.resources.gold < config.cost.gold || 
            state.resources.wood < config.cost.wood || 
            state.resources.mana < config.cost.mana) {
            showToast("資源が足りません！", "warning");
            return;
        }
        state.resources.gold -= config.cost.gold;
        state.resources.wood -= config.cost.wood;
        state.resources.mana -= config.cost.mana;
    }
    
    state.resources.popMax += config.popMaxAdd;
    
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
    sprite.style.backgroundImage = `url('${state.assetsProcessed[type]}')`;
    tileContainer.appendChild(sprite);
    
    // タイルのホバーツールチップを建物情報にアップデート
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (tile) {
        tile.dataset.tip = `🏡 <b>${config.name} (Lv.1)</b><br>${config.description}<br>・クリックしてアップグレード/撤去`;
    }
    
    playBuildSound();
    createFloatingText(col, row, `-${config.cost.gold}🪙`, 'gold');
    
    updateQuestProgress('build_houses');
    
    // 酒場・兵舎配置時の冒険者召喚
    if (type === 'tavern' || type === 'barracks') {
        spawnAdventurer(type === 'tavern' ? 'mage' : 'knight');
    }
    
    updateHUD();
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
    
    const config = BUILDING_TYPES[cell.building.type];
    state.resources.popMax += config.popMaxAdd;
    
    // ツールチップアップデート
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (tile) {
        tile.dataset.tip = `🏡 <b>${config.name} (Lv.${cell.building.level})</b><br>${config.description}<br>・クリックしてアップグレード/撤去`;
    }
    
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
    state.resources.popMax = Math.max(0, state.resources.popMax - config.popMaxAdd * cell.building.level);
    
    const sprite = document.getElementById(`building-sprite-${col}-${row}`);
    if (sprite) sprite.remove();
    
    cell.building = null;
    
    // ツールチップリセット
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (tile) {
        tile.dataset.tip = `🌿 <b>草原タイル (${col}, ${row})</b><br>建物を建設できる平らな草地です。`;
    }
    
    playBuildSound();
    
    document.getElementById('details-panel').classList.add('hidden');
    updateHUD();
}

// 道路舗装
function layRoad(col, row, type) {
    const cell = state.grid[row][col];
    if (cell.building || cell.obstacle) {
        showToast("この場所には道路を敷けません", "warning");
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
        tile.dataset.tip = `🧱 <b>レンガ道 (${col}, ${row})</b><br>レンガ舗装された道です。<br>・住民や冒険者の歩行速度がアップします。`;
        playBuildSound();
    } else {
        if (cell.tileType === 'grass') return;
        cell.tileType = 'grass';
        tile.style.backgroundImage = `url('${state.assetsProcessed.grass}')`;
        tile.dataset.tip = `🌿 <b>草原タイル (${col}, ${row})</b><br>建物を建設できる平らな草地です。`;
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
// 5. 資源生産 ＆ HUD・UI更新
// ==========================================

function gameTick() {
    let goldRate = 0;
    let woodRate = 0;
    let manaRate = 0;
    
    const rainActive = state.activeEffects.rain > 0;
    if (rainActive) {
        state.activeEffects.rain = Math.max(0, state.activeEffects.rain - 0.1);
        updateActiveEffectsUI();
    }
    
    const productionMultiplier = rainActive ? 2.0 : 1.0;
    
    // 幸福度による生産補正算出 (幸福度100%で1.0倍、120%で1.2倍、70%で0.7倍)
    const happinessMultiplier = state.resources.happiness / 100.0;
    
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = state.grid[r][c];
            if (cell.building) {
                const config = BUILDING_TYPES[cell.building.type];
                const mult = cell.building.level * productionMultiplier;
                
                if (config.production.gold > 0) {
                    // ゴールドのみ幸福度の影響を受ける
                    const add = (config.production.gold * mult * happinessMultiplier) * 0.1;
                    state.resources.gold += add;
                    goldRate += config.production.gold * mult * happinessMultiplier;
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
    
    // スライム侵入による幸福度の自然降下
    const slimeCount = state.characters.filter(c => c.type === 'slime').length;
    if (slimeCount > 0) {
        state.resources.happiness = Math.max(50, state.resources.happiness - (slimeCount * 0.05));
    } else {
        // スライムがいない場合はゆっくり100%まで自然回復
        state.resources.happiness = Math.min(100, state.resources.happiness + 0.1);
    }
    
    // 自然な市民訪問
    const targetPop = Math.min(state.resources.popMax, Math.floor(state.resources.popMax));
    if (state.resources.pop < targetPop && Math.random() < 0.05) {
        state.resources.pop++;
        spawnCitizen();
    } else if (state.resources.pop > state.resources.popMax) {
        state.resources.pop = state.resources.popMax;
    }
    
    updateCharacters();
    
    updateQuestProgress('gather_mana');
    updateQuestProgress('gold_target');
    
    updateHUD(goldRate, woodRate, manaRate);
}

function updateHUD(goldRate = 0, woodRate = 0, manaRate = 0) {
    document.querySelector('#hud-gold .hud-value').textContent = Math.floor(state.resources.gold);
    document.getElementById('gold-change').textContent = `+${goldRate.toFixed(1)}/s`;
    
    document.querySelector('#hud-wood .hud-value').textContent = Math.floor(state.resources.wood);
    document.getElementById('wood-change').textContent = `+${woodRate.toFixed(1)}/s`;
    
    document.querySelector('#hud-mana .hud-value').textContent = Math.floor(state.resources.mana);
    document.getElementById('mana-change').textContent = `+${manaRate.toFixed(1)}/s`;
    
    document.querySelector('#hud-pop .hud-value').textContent = `${state.resources.pop} / ${state.resources.popMax}`;
    document.querySelector('#hud-happy .hud-value').textContent = `${Math.floor(state.resources.happiness)}%`;
    
    updateShopInteraction();
    updateSpellInteraction();
}

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

function showToast(msg, type = "info") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function createFloatingText(col, row, text, type = '') {
    const board = document.getElementById('game-board');
    const { x, y } = getIsoCoords(col, row);
    
    const el = document.createElement('div');
    el.className = `floating-text ${type}`;
    el.textContent = text;
    el.style.left = `${x + BASE_TILE_WIDTH / 2}px`;
    el.style.top = `${y + BASE_TILE_HEIGHT / 4}px`;
    
    board.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

// ==========================================
// 6. 魔法・スペルシステム
// ==========================================

function selectSpell(spellType) {
    playClickSound();
    
    const config = SPELLS[spellType];
    if (!config) return;
    
    if (config.instant) {
        castInstantSpell(spellType);
        return;
    }
    
    state.selectedTool = `spell_${spellType}`;
    document.querySelectorAll('.shop-item, .shop-item-road, .spell-btn').forEach(btn => btn.classList.remove('selected', 'active'));
    document.getElementById(`spell-${spellType}`).classList.add('active');
    showToast("対象のタイルを選択してください", "info");
}

function castInstantSpell(spellType) {
    const config = SPELLS[spellType];
    
    if (state.resources.gold < (config.cost.gold || 0) || state.resources.mana < (config.cost.mana || 0)) {
        showToast("発動コストが足りません！", "warning");
        return;
    }
    
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

function castTargetSpell(col, row, spellType) {
    const config = SPELLS[spellType];
    
    if (state.resources.gold < (config.cost.gold || 0) || state.resources.mana < (config.cost.mana || 0)) {
        showToast("発動コストが足りません！", "warning");
        clearSelectedTool();
        return;
    }
    
    if (spellType === 'cleanse') {
        const cell = state.grid[row][col];
        
        // 1. スライムを検索
        const slimeIdx = state.characters.findIndex(c => c.type === 'slime' && Math.round(c.x) === col && Math.round(c.y) === row);
        
        if (slimeIdx !== -1) {
            // スライムの消滅
            state.resources.gold -= (config.cost.gold || 0);
            state.resources.mana -= (config.cost.mana || 0);
            playMagicCastSound();
            
            const slime = state.characters[slimeIdx];
            const dom = document.getElementById(`char-${slime.id}`);
            if (dom) dom.remove();
            state.characters.splice(slimeIdx, 1);
            
            playSlimeDeathSound();
            createFloatingText(col, row, "浄化！☀️", "mana");
            showToast("浄化の光でスライムを消滅させました！", "success");
            
            state.stats.slimesKilled++;
            updateQuestProgress('kill_slimes');
        } 
        // 2. 障害物を検索
        else if (cell.obstacle) {
            state.resources.gold -= (config.cost.gold || 0);
            state.resources.mana -= (config.cost.mana || 0);
            playMagicCastSound();
            
            const sprite = document.getElementById(`obstacle-sprite-${col}-${row}`);
            if (sprite) sprite.remove();
            cell.obstacle = null;
            
            const tile = document.getElementById(`tile-${col}-${row}`);
            if (tile) {
                tile.dataset.tip = `🌿 <b>草原タイル (${col}, ${row})</b><br>建物を建設できる平らな草地です。`;
            }
            
            playBuildSound();
            createFloatingText(col, row, "浄化！☀️", "mana");
            showToast("浄化の光で障害物を消滅させました！", "success");
        } else {
            showToast("対象のセルにスライムや障害物がありません", "warning");
        }
    }
    
    clearSelectedTool();
    updateHUD();
}

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

function spawnAdventurer(profession) {
    const gender = Math.random() < 0.5 ? 'boy' : 'girl';
    const subType = `${profession}_${gender}`;
    
    const id = state.nextCharId++;
    const adventurer = {
        id: id,
        type: 'adventurer',
        subType: subType,
        profession: profession,
        gender: gender,
        x: 3,
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

function spawnSlime() {
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

function spawnCitizen() {
    const gender = Math.random() < 0.5 ? 'boy' : 'girl';
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

function createCharacterDOM(char) {
    const board = document.getElementById('game-board');
    const el = document.createElement('div');
    el.className = `character-sprite ${char.type === 'slime' ? 'slime active-slime' : char.subType.replace('_', '-')}`;
    el.id = `char-${char.id}`;
    
    let assetKey = char.subType;
    if (char.type === 'slime') assetKey = 'slime';
    else if (char.subType.includes('knight_boy')) assetKey = 'knight_boy';
    else if (char.subType.includes('knight_girl')) assetKey = 'knight_girl';
    else if (char.subType.includes('mage_boy')) assetKey = 'mage_boy';
    else if (char.subType.includes('mage_girl')) assetKey = 'mage_girl';
    
    el.style.backgroundImage = `url('${state.assetsProcessed[assetKey]}')`;
    
    const pix = getIsoCoords(char.x, char.y);
    el.style.left = `${pix.x + BASE_TILE_WIDTH / 2}px`;
    el.style.top = `${pix.y + BASE_TILE_HEIGHT / 3}px`;
    el.style.zIndex = Math.floor(char.x + char.y) + 2;
    
    // キャラクターのホバーツールチップ設定
    if (char.type === 'adventurer') {
        el.dataset.tip = `⚔️ <b>冒険者 (${char.profession === 'knight' ? '騎士' : '魔導士'})</b><br>Lv.${char.level}<br>・自動的にスライムを探して退治します。`;
    } else if (char.type === 'slime') {
        el.dataset.tip = `💧 <b>スライム (魔物)</b><br>・放置すると街の幸福度が低下します。<br>・倒すとゴールドを獲得できます。`;
    } else {
        el.dataset.tip = `👥 <b>街の住民</b><br>街の中を楽しそうに散歩しています。`;
    }
    
    board.appendChild(el);
}

function updateCharacters() {
    state.characters.forEach(char => {
        const dom = document.getElementById(`char-${char.id}`);
        if (!dom) return;
        
        if (char.type === 'adventurer') {
            adventurerAI(char);
        } else if (char.type === 'slime') {
            slimeAI(char);
        } else if (char.type === 'citizen') {
            citizenAI(char);
        }
        
        const dx = char.targetX - char.x;
        const dy = char.targetY - char.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // 移動速度に道路（レンガ道）の補正を適用
        let speedMod = 1.0;
        const currentTileR = Math.min(GRID_SIZE - 1, Math.max(0, Math.round(char.y)));
        const currentTileC = Math.min(GRID_SIZE - 1, Math.max(0, Math.round(char.x)));
        if (state.grid[currentTileR][currentTileC].tileType === 'dirt') {
            speedMod = 1.45; // 道路の上では1.45倍速く移動
        }
        
        if (dist > 0.05) {
            const step = Math.min(char.speed * speedMod || 0.03, dist);
            char.x += (dx / dist) * step;
            char.y += (dy / dist) * step;
            
            if (dx > 0) {
                dom.style.transform = "translate(-50%, -50%) scaleX(1)";
            } else if (dx < 0) {
                dom.style.transform = "translate(-50%, -50%) scaleX(-1)";
            }
        } else {
            char.x = char.targetX;
            char.y = char.targetY;
            if (char.state === 'walk_to_target' || char.state === 'wander') {
                setRandomTarget(char);
            }
        }
        
        const pix = getIsoCoords(char.x, char.y);
        dom.style.left = `${pix.x + BASE_TILE_WIDTH / 2}px`;
        dom.style.top = `${pix.y + BASE_TILE_HEIGHT / 3}px`;
        dom.style.zIndex = Math.floor(char.x + char.y) + 2;
    });
}

function setRandomTarget(char) {
    let randX = char.x + (Math.random() * 4 - 2);
    let randY = char.y + (Math.random() * 4 - 2);
    
    randX = Math.max(0, Math.min(GRID_SIZE - 1, randX));
    randY = Math.max(0, Math.min(GRID_SIZE - 1, randY));
    
    char.targetX = Math.round(randX);
    char.targetY = Math.round(randY);
    char.state = 'wander';
}

function citizenAI(char) {}
function slimeAI(char) {}

function adventurerAI(char) {
    if (char.targetEnemy) {
        const enemy = state.characters.find(c => c.id === char.targetEnemy.id);
        if (!enemy) {
            char.targetEnemy = null;
            char.state = 'wander';
            return;
        }
        
        const dx = enemy.x - char.x;
        const dy = enemy.y - char.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist <= 0.8) {
            char.targetX = char.x;
            char.targetY = char.y;
            char.state = 'combat';
            
            if (!char.lastAttackTime || Date.now() - char.lastAttackTime > 1000) {
                char.lastAttackTime = Date.now();
                attackEnemy(char, enemy);
            }
        } else {
            char.targetX = enemy.x;
            char.targetY = enemy.y;
            char.state = 'walk_to_target';
        }
        return;
    }
    
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

function attackEnemy(attacker, defender) {
    const dmg = Math.round(attacker.atk * (0.8 + Math.random() * 0.4));
    defender.hp -= dmg;
    
    createFloatingText(defender.x, defender.y, `-${dmg}`, 'damage');
    
    const dom = document.getElementById(`char-${attacker.id}`);
    if (dom) {
        dom.style.transform += " translateY(-5px)";
        setTimeout(() => {
            dom.style.transform = dom.style.transform.replace(" translateY(-5px)", "");
        }, 150);
    }
    
    if (defender.hp <= 0) {
        const index = state.characters.findIndex(c => c.id === defender.id);
        if (index !== -1) {
            const defDom = document.getElementById(`char-${defender.id}`);
            if (defDom) defDom.remove();
            state.characters.splice(index, 1);
            
            playSlimeDeathSound();
            
            const goldReward = 15;
            state.resources.gold += goldReward;
            createFloatingText(defender.x, defender.y, `+${goldReward}🪙`, 'gold');
            
            attacker.exp += 40;
            createFloatingText(attacker.x, attacker.y, `+40 EXP`, 'exp');
            
            if (attacker.exp >= 100) {
                attacker.level++;
                attacker.exp -= 100;
                attacker.atk += 2;
                playSynthSound([523.25, 659.25, 783.99, 1046.50], 0.6, 'sine', 0.12);
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

function createEmoteBubble(charId, emoji) {
    const dom = document.getElementById(`char-${charId}`);
    if (!dom) return;
    
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
    setTimeout(() => bubble.remove(), 2500);
}

// ==========================================
// 8. 政治・勢力・クエストシステム
// ==========================================

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

function generateNewQuest(factionKey) {
    const list = QUEST_TEMPLATES[factionKey];
    const quest = {...list[Math.floor(Math.random() * list.length)]};
    quest.current = 0;
    
    if (quest.type === 'kill_slimes') {
        quest.startVal = state.stats.slimesKilled;
    }
    
    state.factions[factionKey].quest = quest;
    renderFactionQuestUI(factionKey);
}

function renderFactionQuestUI(factionKey) {
    const faction = state.factions[factionKey];
    const quest = faction.quest;
    
    const panel = document.getElementById(`faction-${factionKey}`);
    if (!panel) return;
    
    const repBar = panel.querySelector('.rep-bar');
    const repText = panel.querySelector('.rep-text');
    repBar.style.width = `${Math.min(100, faction.rep)}%`;
    repText.textContent = `友好度: ${getRepName(faction.rep)} (${faction.rep})`;
    
    const qDesc = document.getElementById(`quest-${factionKey}`).querySelector('.quest-desc');
    const qBtn = document.getElementById(`btn-quest-${factionKey}`);
    
    if (quest) {
        qDesc.textContent = `${quest.desc} (${quest.current} / ${quest.target})`;
        const isComplete = quest.current >= quest.target;
        qBtn.disabled = !isComplete;
        qBtn.onclick = () => completeQuest(factionKey);
    } else {
        qDesc.textContent = '進行中のクエストはありません';
        qBtn.disabled = true;
    }
}

function getRepName(rep) {
    if (rep >= 90) return '同盟結成';
    if (rep >= 75) return '非常に友好';
    if (rep >= 60) return '好意';
    if (rep >= 40) return '中立';
    return '冷淡';
}

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

function completeQuest(factionKey) {
    const faction = state.factions[factionKey];
    const quest = faction.quest;
    if (!quest || quest.current < quest.target) return;
    
    playQuestClearSound();
    
    faction.rep += quest.repReward;
    
    if (quest.goldReward > 0) state.resources.gold += quest.goldReward;
    if (quest.woodReward > 0) state.resources.wood += quest.woodReward;
    
    showToast(`${faction.name}のクエスト達成！友好度+${quest.repReward}！`, "success");
    checkFactionBonuses(factionKey);
    generateNewQuest(factionKey);
    updateHUD();
}

function checkFactionBonuses(factionKey) {
    const faction = state.factions[factionKey];
    if (faction.rep >= 80 && !faction.bonusUnlocked) {
        faction.bonusUnlocked = true;
        
        if (factionKey === 'royal') {
            showToast("👑 王宮のボーナスアンロック！民家のゴールド回収が+30%上昇しました。", "success");
            BUILDING_TYPES.house.production.gold *= 1.30;
            BUILDING_TYPES.tavern.production.gold *= 1.30;
        } else if (factionKey === 'guild') {
            showToast("⚔️ 冒険者ギルドのボーナスアンロック！精鋭「魔導士」が追加召喚されました！", "success");
            spawnAdventurer('mage');
        } else if (factionKey === 'archive') {
            showToast("🔮 大魔導書院のボーナスアンロック！スペル「成長の雨」のコストがマナ10に半減しました！", "success");
            SPELLS.rain.cost.mana = 10;
            document.getElementById('spell-rain').querySelector('.spell-cost').textContent = "✨10";
            // ツールチップも更新
            document.getElementById('spell-rain').dataset.tip = `🌧️ <b>成長の雨 (消費マナ: 10)</b><br>40秒間、全施設の資源生産速度が <b>2倍</b> になります。`;
        }
    }
}

// ==========================================
// 9. ビューポート操作 (ドラッグ＆改良版スクロールパン・ボタンズーム)
// ==========================================

function initViewportControls() {
    const viewport = document.getElementById('viewport');
    const board = document.getElementById('game-board');
    
    // 初期位置 (中央寄せ)
    const viewWidth = viewport.clientWidth;
    const viewHeight = viewport.clientHeight;
    state.viewport.x = (viewWidth - 1200) / 2;
    state.viewport.y = 80;
    updateViewportTransform();
    
    // ドラッグ移動 (パン)
    viewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('#hud, #spell-book, #faction-panel, #shop, #details-panel, #zoom-controls, #help-modal, .btn, .btn-toggle-panel')) return;
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
    
    // 通常スクロールは移動（パン）、Ctrl+スクロールは拡大縮小（ズーム）
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        if (e.ctrlKey) {
            // ズーム
            const zoomStep = 0.05;
            if (e.deltaY < 0) {
                state.viewport.scale = Math.min(1.5, state.viewport.scale + zoomStep);
            } else {
                state.viewport.scale = Math.max(0.6, state.viewport.scale - zoomStep);
            }
        } else {
            // スクロール移動 (トラックパッドやホイールで直感的にスクロール可能)
            state.viewport.x -= e.deltaX;
            state.viewport.y -= e.deltaY;
        }
        updateViewportTransform();
    });
    
    // ズームボタンの設定
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
        playClickSound();
        state.viewport.scale = Math.min(1.5, state.viewport.scale + 0.1);
        updateViewportTransform();
    });
    
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
        playClickSound();
        state.viewport.scale = Math.max(0.6, state.viewport.scale - 0.1);
        updateViewportTransform();
    });
    
    document.getElementById('btn-zoom-reset').addEventListener('click', () => {
        playClickSound();
        const vW = viewport.clientWidth;
        const vH = viewport.clientHeight;
        state.viewport.x = (vW - 1200) / 2;
        state.viewport.y = 80;
        state.viewport.scale = 1.0;
        updateViewportTransform();
        showToast("マップ位置を中央に戻しました", "info");
    });
}

function updateViewportTransform() {
    const board = document.getElementById('game-board');
    board.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
}

// ==========================================
// 10. 動的ツールチップ & UI開閉システム
// ==========================================

function initTooltip() {
    const tooltip = document.getElementById('tooltip');
    
    // マウスホバーでツールチップ表示
    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tip]');
        if (target) {
            tooltip.innerHTML = target.getAttribute('data-tip');
            tooltip.classList.remove('hidden');
            tooltip.style.opacity = 1;
        }
    });
    
    // マウス移動で位置追従
    document.addEventListener('mousemove', (e) => {
        if (!tooltip.classList.contains('hidden')) {
            let x = e.clientX + 15;
            let y = e.clientY + 15;
            
            // 画面外はみ出し防止
            const w = tooltip.offsetWidth;
            const h = tooltip.offsetHeight;
            if (x + w > window.innerWidth) {
                x = e.clientX - w - 15;
            }
            if (y + h > window.innerHeight) {
                y = e.clientY - h - 15;
            }
            
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        }
    });
    
    // マウス離脱で非表示
    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tip]');
        if (target) {
            tooltip.classList.add('hidden');
            tooltip.style.opacity = 0;
        }
    });
}

// パネル開閉コントロールの初期化
function initPanelCollapsible() {
    const spellPanel = document.getElementById('spell-book');
    const toggleSpellBtn = document.getElementById('btn-toggle-spell');
    
    toggleSpellBtn.addEventListener('click', () => {
        playClickSound();
        const isCollapsed = spellPanel.classList.toggle('collapsed');
        toggleSpellBtn.textContent = isCollapsed ? '▶' : '◀';
    });
    
    const factionPanel = document.getElementById('faction-panel');
    const toggleFactionBtn = document.getElementById('btn-toggle-faction');
    
    toggleFactionBtn.addEventListener('click', () => {
        playClickSound();
        const isCollapsed = factionPanel.classList.toggle('collapsed');
        toggleFactionBtn.textContent = isCollapsed ? '◀' : '▶';
    });
}

// ==========================================
// 11. アプリケーション開始・イベントハンドリング
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    preloadAndProcessAssets();
    initTooltip();
    initPanelCollapsible();
    
    // スタートボタン
    document.getElementById('btn-start').addEventListener('click', () => {
        playClickSound();
        initAudio();
        
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        
        initViewportControls();
        initGame();
        
        // 初期開始時に自動でヘルプモーダルを開く
        document.getElementById('help-modal').classList.remove('hidden');
    });
    
    // ヘルプモーダルのイベント
    document.getElementById('btn-help').addEventListener('click', () => {
        playClickSound();
        document.getElementById('help-modal').classList.remove('hidden');
    });
    
    document.getElementById('btn-close-help').addEventListener('click', () => {
        playClickSound();
        document.getElementById('help-modal').classList.add('hidden');
    });
    
    document.getElementById('btn-help-ok').addEventListener('click', () => {
        playClickSound();
        document.getElementById('help-modal').classList.add('hidden');
    });
    
    // ショップカテゴリタブ
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
    
    // 建築アイテム
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
    
    // 道路ツール
    document.querySelectorAll('.shop-item-road').forEach(item => {
        item.addEventListener('click', () => {
            playClickSound();
            const isSelected = item.classList.contains('selected');
            clearSelectedTool();
            
            if (!isSelected) {
                item.classList.add('selected');
                state.selectedTool = `road_${item.dataset.road}`;
                showToast("マップをクリックして道路を敷いてください", "info");
            }
        });
    });
    
    // 魔法スペルボタン
    document.getElementById('spell-rain').addEventListener('click', startRainSpell);
    document.getElementById('spell-surge').addEventListener('click', () => selectSpell('surge'));
    document.getElementById('spell-slime').addEventListener('click', () => selectSpell('slime'));
    document.getElementById('spell-cleanse').addEventListener('click', () => selectSpell('cleanse'));
    
    // サウンドトグル
    document.getElementById('btn-sound').addEventListener('click', toggleSound);
    
    // 詳細パネル閉じる
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
