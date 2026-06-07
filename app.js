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
    },
    town_hall: {
        name: 'タウンホール',
        description: '街の中心部にある町役場。アップグレードはできませんが、最大人口上限を増やします。',
        cost: { gold: 0, wood: 0, mana: 0 },
        popMaxAdd: 5,
        production: { gold: 0, wood: 0, mana: 0 },
        asset: 'assets/town_hall.png',
        upgradeCostMultiplier: 0.0
    },
    world_tree: {
        name: '世界樹の種',
        description: '伝説の世界樹。大輪のマナの花を咲かせてゲームクリアを目指しましょう。',
        cost: { gold: 1000, wood: 500, mana: 300 },
        popMaxAdd: 0,
        production: { gold: 0, wood: 0, mana: 0 },
        asset: 'assets/town_hall.png',
        upgradeCostMultiplier: 1.0
    }
};

// スペル設定
const SPELLS = {
    rain: { name: '成長の雨', cost: { mana: 20, gold: 0 }, duration: 40 }, 
    surge: { name: 'マナの奔流', cost: { mana: 0, gold: 50 }, instant: true }, 
    slime: { name: 'スライム召喚', cost: { mana: 10, gold: 0 }, instant: true }, 
    cleanse: { name: '浄化の光', cost: { mana: 15, gold: 0 }, target: true } 
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
        rain: 0 
    },
    factions: {
        royal: { name: '王宮', rep: 50, quest: null, bonusUnlocked: false },
        guild: { name: '冒険者ギルド', rep: 50, quest: null, bonusUnlocked: false },
        archive: { name: '大魔導書院', rep: 50, quest: null, bonusUnlocked: false }
    },
    selectedTool: null, 
    selectedCell: null, 
    audio: {
        ctx: null,
        soundEnabled: false,
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
        startTime: 0,
        slimesKilled: 0,
        gameCleared: false
    },
    assetsProcessed: {} 
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
    game_logo: 'assets/game_logo.png',
    town_hall: 'assets/town_hall.png'
};

// ==========================================
// 1. 画像アセット透過 ＆ 自動余白クロップ処理
// ==========================================

const ASSET_VERSION = 19;

function cropAndMakeTransparent(imgSrc) {
    const cacheBustedSrc = imgSrc + "?v=" + ASSET_VERSION;
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
                
                let minX = canvas.width;
                let minY = canvas.height;
                let maxX = 0;
                let maxY = 0;
                
                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const idx = (y * canvas.width + x) * 4;
                        const r = data[idx];
                        const g = data[idx+1];
                        const b = data[idx+2];
                        
                        if (r > 230 && g > 230 && b > 230) {
                            data[idx+3] = 0; // 透明化
                        } else {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                }
                
                if (maxX < minX || maxY < minY) {
                    ctx.putImageData(imgData, 0, 0);
                    resolve(canvas.toDataURL());
                    return;
                }
                
                const cropWidth = (maxX - minX) + 1;
                const cropHeight = (maxY - minY) + 1;
                
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cropWidth;
                cropCanvas.height = cropHeight;
                const cropCtx = cropCanvas.getContext('2d');
                
                ctx.putImageData(imgData, 0, 0);
                cropCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                
                resolve(cropCanvas.toDataURL());
            } catch (e) {
                console.warn("CORS error in crop. Active local-fallback-mode for offline play.");
                document.body.classList.add('local-fallback-mode');
                resolve(cacheBustedSrc);
            }
        };
        img.onerror = () => {
            resolve(cacheBustedSrc);
        };
        img.src = cacheBustedSrc;
    });
}

async function preloadAndProcessAssets() {
    showToast("魔法の素材をロード中...", "info");
    const keys = Object.keys(ASSET_FILES);
    for (const key of keys) {
        const transparentCroppedSrc = await cropAndMakeTransparent(ASSET_FILES[key]);
        state.assetsProcessed[key] = transparentCroppedSrc;
    }
    showToast("ロード完了！", "success");
    document.getElementById('btn-start').disabled = false;
}

// ==========================================
// 2. Web Audio API サウンド ＆ 可愛く明るいBGM ＆ キャラ音声合成
// ==========================================

function initAudio() {
    if (!state.audio.ctx) {
        state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    state.audio.soundEnabled = true;
    
    // ブラウザのオートプレイ制限により suspended になっている場合は resume する
    if (state.audio.ctx.state === 'suspended') {
        state.audio.ctx.resume();
    }
    
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

function playSynthSound(freqs, duration, type = 'sine', volume = 0.1, delay = 0) {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    const ctx = state.audio.ctx;
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    const now = ctx.currentTime + delay;
    
    freqs.forEach((freq) => {
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

function playChibiVoice(voiceType) {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    const ctx = state.audio.ctx;
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    const now = ctx.currentTime;
    
    if (voiceType === 'spawn') {
        // ちびボイス：「ヤッタ！」のような明るい挨拶音
        // 2つのオシレータによるコーラス感＋すばやい音程変化
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(783.99, now); // G5
        osc1.frequency.linearRampToValueAtTime(1046.50, now + 0.05); // C6
        osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(788.99, now); // 微小デチューン
        osc2.frequency.linearRampToValueAtTime(1051.50, now + 0.05);
        osc2.frequency.exponentialRampToValueAtTime(885.00, now + 0.15);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.02); // 音量をアップ
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.2);
        osc2.stop(now + 0.2);
    } 
    else if (voiceType === 'attack') {
        // ちびボイス：「ヤッ！」と鋭く叫ぶ攻撃音
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.12);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.20, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.15);
    } 
    else if (voiceType === 'hurt') {
        // ちびボイス：「キュッ！」としぼりだす被弾音
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(550, now);
        osc.frequency.linearRampToValueAtTime(1300, now + 0.06);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.12);
    } 
    else if (voiceType === 'click') {
        // ちびボイス：「はーい！」のようなピコッとした可愛らしいお返事音
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(987.77, now); // B5
        osc1.frequency.setValueAtTime(1318.51, now + 0.05); // E6
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(992.77, now);
        osc2.frequency.setValueAtTime(1323.51, now + 0.05);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
        gain.gain.setValueAtTime(0.15, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.15);
        osc2.stop(now + 0.15);
    }
}

function playBuildSound() {
    const baseFreq = 261.63;
    const dur = 0.12;
    playSynthSound([baseFreq], dur, 'triangle', 0.1, 0);
    playSynthSound([baseFreq * 1.25], dur, 'triangle', 0.1, 0.06);
    playSynthSound([baseFreq * 1.5], dur, 'triangle', 0.1, 0.12);
    playSynthSound([baseFreq * 2.0], dur, 'triangle', 0.12, 0.18);
}

function playClickSound() {
    playSynthSound([659.25], 0.06, 'sine', 0.12);
}

// スライム死亡音
function playSlimeDeathSound() {
    playSynthSound([392.00], 0.08, 'sine', 0.1, 0);
    playSynthSound([523.25], 0.12, 'sine', 0.1, 0.06);
}

// クエスト完了チャイム
function playQuestClearSound() {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    
    const ctx = state.audio.ctx;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    
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

function playMagicCastSound() {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    const ctx = state.audio.ctx;
    const now = ctx.currentTime;
    
    for (let i = 0; i < 8; i++) {
        const delay = i * 0.05;
        const freq = 600 + (i * 200);
        playSynthSound([freq], 0.2, 'sine', 0.04, delay);
    }
}

// 金管楽器（ブラス）のような音色を合成するヘルパー関数
function playBrassNote(freq, duration, delay = 0) {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    const ctx = state.audio.ctx;
    const now = ctx.currentTime + delay;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator(); // 豊かさを加えるサブオシレーター
    
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    // メインのノコギリ波オシレーター
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);
    
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.006, now); // デチューン
    
    // サブオシレーター（温かみと深みを与えるため、1オクターブ下または同オクターブの三角波）
    if (freq > 150) {
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(freq * 0.5, now);
    } else {
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(freq, now);
    }
    
    // 金管楽器のフィルターエンベロープ（アタックで開き、リリースに向けて徐々に閉じる）
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.08);
    filter.frequency.linearRampToValueAtTime(900, now + duration);
    
    // 音量エンベロープ
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.04, now + 0.08); // アタック
    gainNode.gain.setValueAtTime(0.04, now + duration - 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration); // リリース
    
    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    
    // ステレオパンニング（対応している場合）で広がりを持たせる
    if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        const panValue = Math.sin(freq) * 0.3; // 周波数に基づくデタミニスティックなパン
        panner.pan.setValueAtTime(panValue, now);
        filter.connect(panner);
        panner.connect(gainNode);
    } else {
        filter.connect(gainNode);
    }
    
    gainNode.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    
    osc1.stop(now + duration + 0.1);
    osc2.stop(now + duration + 0.1);
    osc3.stop(now + duration + 0.1);
}

// 荘厳なティンパニ（ケトルドラム）の音色を合成するヘルパー関数
function playTimpani(freq, duration, delay = 0) {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    const ctx = state.audio.ctx;
    const now = ctx.currentTime + delay;
    
    // マレットのアタック音（バンドパスフィルタを通したホワイトノイズ）
    const noiseBufferSize = ctx.sampleRate * 0.05;
    const noiseBuffer = ctx.createBuffer(1, noiseBufferSize, ctx.sampleRate);
    const noiseOutput = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBufferSize; i++) {
        noiseOutput[i] = Math.random() * 2 - 1;
    }
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(150, now);
    noiseFilter.Q.setValueAtTime(2.0, now);
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    
    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    // ドラム胴体音（ピッチスイープ付き三角波）
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.08); // ピッチの減衰
    
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.01); // 鋭いアタック
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    
    // こもりつつ太い低音にするローパスフィルター
    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(300, now);
    lpFilter.frequency.exponentialRampToValueAtTime(80, now + duration);
    
    osc.connect(lpFilter);
    lpFilter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    noiseNode.start(now);
    osc.start(now);
    osc.stop(now + duration + 0.1);
}

// シンバルのクラッシュ音を合成するヘルパー関数
function playCymbalCrash(duration, delay = 0) {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    const ctx = state.audio.ctx;
    const now = ctx.currentTime + delay;
    
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.linearRampToValueAtTime(6000, now + duration);
    
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    source.start(now);
    source.stop(now + duration + 0.1);
}

// 荘厳でかっこいい王宮風のファンファーレ
function playVictoryFanfare() {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    const ctx = state.audio.ctx;
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    
    // 正確な音階周波数定義
    const N = {
        C2: 65.41, D2: 73.42, Eb2: 77.78, E2: 82.41, F2: 87.31, G2: 98.00, Ab2: 103.83, A2: 110.00, Bb2: 116.54, B2: 123.47,
        C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
        C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
        C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, G5: 783.99, Ab5: 830.61, A5: 880.00, Bb5: 932.33, B5: 987.77,
        C6: 1046.50
    };

    const beatDur = 0.4; // 150 BPM
    
    const playChord = (chordNotes, bassNotes, beat, duration) => {
        const delay = beat * beatDur;
        chordNotes.forEach(freq => {
            playBrassNote(freq, duration * beatDur, delay);
        });
        bassNotes.forEach(freq => {
            playBrassNote(freq, duration * beatDur, delay);
        });
    };
    
    const playDrum = (freq, beat, duration) => {
        playTimpani(freq, duration * beatDur, beat * beatDur);
    };

    // --- 第1フレーズ：勇壮な立ち上がり ---
    // Beat 0: C Major
    playChord([N.C4, N.E4, N.G4, N.C5], [N.C2, N.C3], 0.0, 0.45);
    playDrum(80, 0.0, 0.5);
    
    // Beat 0.5: C Major short
    playChord([N.C4, N.E4, N.G4, N.C5], [N.C2, N.C3], 0.5, 0.2);
    
    // Beat 0.75: C Major short
    playChord([N.C4, N.E4, N.G4, N.C5], [N.C2, N.C3], 0.75, 0.2);
    
    // Beat 1.0: F Major (サブドミナント)
    playChord([N.F4, N.A4, N.C5, N.F5], [N.F2, N.F3], 1.0, 0.9);
    playDrum(87, 1.0, 0.8);
    
    // Beat 2.0: F Major
    playChord([N.F4, N.A4, N.C5, N.F5], [N.F2, N.F3], 2.0, 0.45);
    playDrum(87, 2.0, 0.5);
    
    // Beat 2.5: F Major short
    playChord([N.F4, N.A4, N.C5, N.F5], [N.F2, N.F3], 2.5, 0.2);
    
    // Beat 2.75: F Major short
    playChord([N.F4, N.A4, N.C5, N.F5], [N.F2, N.F3], 2.75, 0.2);
    
    // Beat 3.0: G Major (ドミナント)
    playChord([N.G4, N.B4, N.D5, N.G5], [N.G2, N.G3], 3.0, 0.9);
    playDrum(98, 3.0, 0.8);
    
    // Beat 4.0: C Major (一時解決)
    playChord([N.E4, N.G4, N.C5], [N.C2, N.C3], 4.0, 0.7);
    playDrum(80, 4.0, 0.7);
    
    // Beat 4.75: D Minor short
    playChord([N.F4, N.A4, N.D5], [N.D2, N.D3], 4.75, 0.2);
    
    // Beat 5.0: G Major
    playChord([N.G4, N.B4, N.D5, N.G5], [N.G2, N.G3], 5.0, 0.9);
    playDrum(98, 5.0, 0.8);
    
    // Beat 6.0: A Minor
    playChord([N.A4, N.C5, N.E5, N.A5], [N.A2, N.A3], 6.0, 0.7);
    playDrum(110, 6.0, 0.7);
    
    // Beat 6.75: F Major short
    playChord([N.F4, N.A4, N.C5, N.F5], [N.F2, N.F3], 6.75, 0.2);
    
    // Beat 7.0: G Major
    playChord([N.G4, N.B4, N.D5, N.G5], [N.G2, N.G3], 7.0, 0.9);
    playDrum(98, 7.0, 0.8);
    
    // --- 第2フレーズ：高揚感と更なる展開 ---
    // Beat 8.0: C Major
    playChord([N.C4, N.E4, N.G4, N.C5], [N.C2, N.C3], 8.0, 0.45);
    playDrum(80, 8.0, 0.5);
    
    // Beat 8.5: C Major short
    playChord([N.C4, N.E4, N.G4, N.C5], [N.C2, N.C3], 8.5, 0.2);
    
    // Beat 8.75: C Major short
    playChord([N.C4, N.E4, N.G4, N.C5], [N.C2, N.C3], 8.75, 0.2);
    
    // Beat 9.0: F Major
    playChord([N.F4, N.A4, N.C5, N.F5], [N.F2, N.F3], 9.0, 0.9);
    playDrum(87, 9.0, 0.8);
    
    // Beat 10.0: G Major
    playChord([N.G4, N.B4, N.D5, N.G5], [N.G2, N.G3], 10.0, 0.7);
    playDrum(98, 10.0, 0.7);
    
    // Beat 10.75: A Minor short
    playChord([N.A4, N.C5, N.E5, N.A5], [N.A2, N.A3], 10.75, 0.2);
    
    // Beat 11.0: Bb Major (平坦VII度の映画音楽風で英雄的な和音！)
    playChord([N.Bb4, N.D5, N.F5, N.Bb5], [N.Bb2, N.Bb3], 11.0, 0.9);
    playDrum(116, 11.0, 0.8);
    
    // Beat 12.0: C Major
    playChord([N.C4, N.E4, N.G4, N.C5], [N.C2, N.C3], 12.0, 0.7);
    playDrum(80, 12.0, 0.7);
    
    // Beat 12.75: D Major (ダブルドミナント) short
    playChord([N.D4, N.Fsharp4, N.A4, N.D5], [N.D2, N.D3], 12.75, 0.2);
    
    // Beat 13.0: G Major
    playChord([N.G4, N.B4, N.D5, N.G5], [N.G2, N.G3], 13.0, 0.9);
    playDrum(98, 13.0, 0.8);
    
    // --- 第3フレーズ：クライマックスへの架け橋と終止 ---
    // Beat 14.0: Ab Major (平坦VI度 - ドラマチックな緊張)
    playChord([N.Ab4, N.C5, N.Eb5, N.Ab5], [N.Ab2, N.Ab3], 14.0, 1.1);
    playDrum(104, 14.0, 1.0);
    
    // Beat 15.2: Bb Major (平坦VII度 - 解決への最後の加速)
    playChord([N.Bb4, N.D5, N.F5, N.Bb5], [N.Bb2, N.Bb3], 15.2, 1.1);
    playDrum(116, 15.2, 1.0);
    
    // クライマックス直前の緊迫したティンパニロール (15.2拍から16.4拍まで連打)
    for (let r = 0; r < 7; r++) {
        const rollBeat = 15.2 + (r * 0.2);
        playTimpani(116 - (r * 4), 0.18 * beatDur, rollBeat * beatDur);
    }
    
    // Beat 16.5: 最後の圧倒的かつ壮大な C Major 解決和音！
    const finalChord = [N.C3, N.G3, N.C4, N.E4, N.G4, N.C5, N.E5, N.G5, N.C6];
    const finalBass = [N.C2, N.G2];
    playChord(finalChord, finalBass, 16.5, 5.0);
    
    // ティンパニの大音量アタックとシンバルクラッシュの重なり
    playDrum(80, 16.5, 1.5);
    playCymbalCrash(4.5, 16.5 * beatDur);
}

function startBGM() {
    if (!state.audio.soundEnabled || !state.audio.ctx) return;
    
    // 重複再生を防止するため、既存のタイマーがあればクリアする
    if (state.audio.bgmInterval) {
        clearInterval(state.audio.bgmInterval);
    }
    
    const ctx = state.audio.ctx;
    const progressions = [
        [261.63, 329.63, 392.00, 523.25], // C Major
        [349.23, 440.00, 523.25, 698.46], // F Major
        [392.00, 493.88, 587.33, 783.99], // G Major
        [261.63, 329.63, 392.00, 523.25]  // C Major
    ];
    
    // 可愛く明るい64ステップの長めのメロディパターン（フレーズを大幅に拡張）
    const melodyPattern = [
        659.25, 783.99, 1046.50, 0,      1174.66, 1318.51, 1046.50, 0,       // Measure 1 (C)
        698.46, 880.00, 1046.50, 0,      1174.66, 1046.50, 880.00,  0,       // Measure 2 (F)
        783.99, 987.77, 1174.66, 0,      1318.51, 1174.66, 987.77,  1174.66, // Measure 3 (G)
        1046.50, 0,      783.99,  659.25, 523.25,  0,       0,       0,       // Measure 4 (C)
        
        1318.51, 1174.66, 1046.50, 783.99,  880.00,  1046.50, 783.99,  0,       // Measure 5 (C)
        880.00,  1046.50, 1396.91, 1318.51, 1174.66, 1046.50, 880.00,  0,       // Measure 6 (F)
        987.77,  1174.66, 1567.98, 1479.98, 1318.51, 1174.66, 987.77,  1174.66, // Measure 7 (G)
        1046.50, 1567.98, 1318.51, 1046.50, 783.99,  659.25,  523.25,  0        // Measure 8 (C)
    ];
    
    let step = 0;
    
    state.audio.bgmInterval = setInterval(() => {
        if (!state.audio.soundEnabled) return;
        
        const now = ctx.currentTime;
        const measure = Math.floor(step / 8);
        const beat = step % 8;
        const chordIdx = measure % progressions.length;
        const chord = progressions[chordIdx];
        
        if (beat === 0) {
            chord.forEach((freq) => {
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                const filter = ctx.createBiquadFilter();
                
                osc.type = 'triangle'; 
                osc.frequency.setValueAtTime(freq, now);
                
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1200, now); 
                
                gainNode.gain.setValueAtTime(0, now);
                gainNode.gain.linearRampToValueAtTime(0.012, now + 0.8); 
                gainNode.gain.setValueAtTime(0.012, now + 2.0);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 2.9);
                
                osc.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(ctx.destination);
                
                osc.start(now);
                osc.stop(now + 3.0);
            });
            
            const bassOsc = ctx.createOscillator();
            const bassGain = ctx.createGain();
            
            bassOsc.type = 'sine';
            bassOsc.frequency.setValueAtTime(chord[0] / 2, now); 
            
            bassGain.gain.setValueAtTime(0, now);
            bassGain.gain.linearRampToValueAtTime(0.02, now + 0.4);
            bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
            
            bassOsc.connect(bassGain);
            bassGain.connect(ctx.destination);
            
            bassOsc.start(now);
            bassOsc.stop(now + 3.0);
        }
        
        if (beat === 2 || beat === 6) {
            try {
                const bufferSize = ctx.sampleRate * 0.05;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                
                const noiseNode = ctx.createBufferSource();
                noiseNode.buffer = buffer;
                
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 1600; 
                
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.005, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
                
                noiseNode.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                
                noiseNode.start(now);
            } catch (e) {}
        }
        
        const noteFreq = melodyPattern[step % melodyPattern.length];
        if (noteFreq > 0) {
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            
            osc.type = 'triangle'; // やわらかい響き
            osc.frequency.setValueAtTime(noteFreq, now);
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1500, now); // 温かみのあるオルゴールトーン
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.015, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35); 
            
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.45);
        }
        
        step++;
    }, 350); 
}

// ==========================================
// 3. クォータービューのグリッド＆初期化
// ==========================================

function initGame() {
    const tilesLayer = document.getElementById('tiles-layer');
    const objectsLayer = document.getElementById('objects-layer');
    
    tilesLayer.innerHTML = '';
    objectsLayer.innerHTML = '';
    
    state.grid = [];
    state.characters = [];
    state.nextCharId = 1;
    state.stats.startTime = Date.now();
    state.stats.gameCleared = false;
    
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
    
    // 最初からレンガの道路（街路）を配置する (十字路デザイン - 全幅拡張)
    const initialRoads = [];
    for (let i = 0; i < GRID_SIZE; i++) {
        initialRoads.push({c: i, r: 3});
        if (i !== 3) {
            initialRoads.push({c: 3, r: i});
        }
    }
    initialRoads.forEach(coord => {
        const cell = state.grid[coord.r][coord.c];
        cell.tileType = 'dirt';
        
        const tile = document.getElementById(`tile-${coord.c}-${coord.r}`);
        if (tile) {
            tile.style.backgroundImage = `url('${state.assetsProcessed.dirt}')`;
            tile.dataset.tip = `🧱 <b>レンガ道 (${coord.c}, ${coord.r})</b><br>街の道路です。<br>・歩くスピードが <b>1.45倍</b> になります。`;
        }
    });
    
    // 障害物の初期配置 (道路の上は避ける)
    let obstacleCount = 0;
    while (obstacleCount < 6) {
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * GRID_SIZE);
        
        const isRoad = initialRoads.some(coord => coord.c === c && coord.r === r);
        if (isRoad) continue;
        
        // 初期建物予定地を避ける
        const isInitialBuilding = (c === 2 && r === 2) || (c === 2 && r === 4) || (c === 4 && r === 2) || (c === 4 && r === 4);
        if (isInitialBuilding) continue;
        if (state.grid[r][c].obstacle) continue;
        
        const types = ['tree', 'rock', 'ruin'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        state.grid[r][c].obstacle = { type: type };
        createObstacleDOM(c, r, type);
        obstacleCount++;
    }
    
    // 最初から建物をいくつか配置して町らしくしておく
    placeBuildingAt(2, 2, 'town_hall', true);  // タウンホール
    placeBuildingAt(2, 4, 'house', true);      // 民家
    placeBuildingAt(4, 2, 'lumberjack', true); // 木こり小屋
    placeBuildingAt(4, 4, 'tavern', true);     // 冒険者の酒場 (魔導士が召喚される)
    
    updateHUD();
    
    // クエスト発行
    generateNewQuest('royal');
    generateNewQuest('guild');
    generateNewQuest('archive');
    
    // スライム出現タイマー
    if (!state.slimeTimer) {
        state.slimeTimer = setInterval(() => {
            if (state.stats.gameCleared) return;
            if (Math.random() < 0.6) {
                spawnSlime();
            }
        }, 15000);
    }
    
    // メインループ
    if (!state.gameLoopTimer) {
        state.gameLoopTimer = setInterval(gameTick, 100);
    }
}

function getIsoCoords(col, row) {
    const offset_x = 600 - (BASE_TILE_WIDTH / 2);
    const offset_y = 200;
    
    const x = (col - row) * (BASE_TILE_WIDTH / 2) + offset_x;
    const y = (col + row) * (BASE_TILE_HEIGHT / 2) + offset_y;
    return { x, y };
}

function createTileDOM(col, row) {
    const tilesLayer = document.getElementById('tiles-layer');
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
    tile.dataset.tip = `🌿 <b>草原タイル (${col}, ${row})</b><br>建物を建設できる平らな草地です。`;
    
    tile.addEventListener('click', () => handleTileClick(col, row));
    
    tileContainer.appendChild(tile);
    tilesLayer.appendChild(tileContainer);
}

function createObstacleDOM(col, row, type) {
    const objectsLayer = document.getElementById('objects-layer');
    const { x, y } = getIsoCoords(col, row);
    
    const sprite = document.createElement('div');
    if (type === 'ruin') {
        sprite.className = `building-sprite obstacle-ruin`;
        sprite.style.backgroundImage = `url('${state.assetsProcessed.house}')`;
        sprite.style.left = `${x}px`;
        sprite.style.top = `${y - 35}px`;
        sprite.style.width = '120px';
        sprite.style.height = '120px';
    } else {
        sprite.className = `obstacle-sprite`;
        sprite.textContent = type === 'tree' ? '🪵' : '🪨';
        sprite.style.left = `${x + BASE_TILE_WIDTH / 2}px`;
        sprite.style.top = `${y + BASE_TILE_HEIGHT / 2}px`;
        sprite.style.transform = 'translate(-50%, -65%)';
    }
    sprite.id = `obstacle-sprite-${col}-${row}`;
    sprite.style.zIndex = (col + row) * 10 + 2; 
    
    sprite.style.pointerEvents = 'auto';
    sprite.addEventListener('click', (e) => {
        e.stopPropagation();
        handleTileClick(col, row);
    });
    
    objectsLayer.appendChild(sprite);
    
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (tile) {
        if (type === 'tree') {
            tile.dataset.tip = `🪵 <b>枯れ木</b><br>土地を塞ぐ枯れ木です。<br>・クリックして開拓 (🪙20) -> 🪵+30`;
        } else if (type === 'rock') {
            tile.dataset.tip = `🪨 <b>魔力岩</b><br>マナを含んだ硬い岩です。<br>・クリックして開拓 (🪙30) -> ✨+15`;
        } else if (type === 'ruin') {
            tile.dataset.tip = `🏚️ <b>古代の廃墟</b><br>コケに覆われた古い建物です。<br>・クリックして浄化 (✨20) -> 🪙+60`;
        }
    }
}

// ==========================================
// 4. 建築・整地・開拓ロジック
// ==========================================

function handleTileClick(col, row) {
    const cell = state.grid[row][col];
    
    if (cell.obstacle || cell.building) {
        playChibiVoice('click');
    } else {
        playClickSound();
    }
    
    if (state.selectedTool && state.selectedTool.startsWith('spell_')) {
        castTargetSpell(col, row, state.selectedTool.replace('spell_', ''));
        return;
    }
    
    if (cell.obstacle) {
        selectCell(col, row);
        return;
    }
    
    if (state.selectedTool) {
        if (state.selectedTool.startsWith('road_')) {
            layRoad(col, row, state.selectedTool.replace('road_', ''));
        } else {
            placeBuildingAt(col, row, state.selectedTool);
        }
        return;
    }
    
    selectCell(col, row);
}

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

function showDetailsPanel(cell) {
    const panel = document.getElementById('details-panel');
    const title = document.getElementById('details-title');
    const desc = document.getElementById('details-desc');
    const level = document.getElementById('details-level');
    const prod = document.getElementById('details-production');
    const btnUpgrade = document.getElementById('btn-upgrade');
    const btnDemolish = document.getElementById('btn-demolish');
    
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
            desc.textContent = "マナが結晶化した岩です。砕くことでマナを回収できます。";
            level.textContent = "なし";
            prod.textContent = "開拓報酬: ✨+15";
            btnDemolish.textContent = "砕く (🪙30)";
            btnDemolish.className = "btn btn-primary";
            btnDemolish.onclick = () => clearObstacle(cell.col, cell.row, { gold: 30 }, { mana: 15 });
        } else if (type === 'ruin') {
            title.textContent = "古代の廃墟 🏚️";
            desc.textContent = "古代魔法都市의遺物です。マナを使って浄化するとゴールドが手に入ります。";
            level.textContent = "なし";
            prod.textContent = "浄化報酬: 🪙+60";
            btnDemolish.textContent = "浄化する (✨20)";
            btnDemolish.className = "btn btn-primary";
            btnDemolish.onclick = () => clearObstacle(cell.col, cell.row, { mana: 20 }, { gold: 60 });
        }
        return;
    }
    
    if (!cell.building) {
        panel.classList.add('hidden');
        return;
    }
    
    panel.classList.remove('hidden');
    
    const buildType = cell.building.type;
    const config = BUILDING_TYPES[buildType];
    
    title.textContent = `${config.name} (Lv.${cell.building.level})`;
    desc.textContent = config.description;
    
    if (buildType === 'town_hall') {
        level.textContent = "なし";
        prod.textContent = "最大人口上限を+5増やしています。🏛️";
        btnUpgrade.classList.add('hidden');
        btnDemolish.classList.add('hidden');
        return;
    }
    
    if (buildType === 'world_tree') {
        level.textContent = "MAX";
        prod.textContent = "マナの花が咲き誇っています 🌳✨";
        btnUpgrade.classList.add('hidden');
        btnDemolish.classList.add('hidden');
        return;
    }
    
    btnUpgrade.classList.remove('hidden');
    btnDemolish.classList.remove('hidden');
    btnDemolish.className = "btn btn-danger";
    btnDemolish.textContent = "撤去";
    level.textContent = cell.building.level;
    
    let prodText = [];
    const multi = cell.building.level * (state.activeEffects.rain > 0 ? 2 : 1);
    const happinessMultiplier = state.resources.happiness / 100.0;
    
    if (config.production.gold > 0) prodText.push(`🪙 +${(config.production.gold * multi * happinessMultiplier).toFixed(1)}/s`);
    if (config.production.wood > 0) prodText.push(`🪵 +${(config.production.wood * multi).toFixed(1)}/s`);
    if (config.production.mana > 0) prodText.push(`✨ +${(config.production.mana * multi).toFixed(1)}/s`);
    prod.textContent = prodText.length > 0 ? prodText.join(' / ') : 'なし';
    
    const upCost = Math.round(config.cost.gold * Math.pow(config.upgradeCostMultiplier, cell.building.level - 1));
    btnUpgrade.textContent = `レベルアップ (🪙${upCost})`;
    btnUpgrade.onclick = () => upgradeBuilding(cell.col, cell.row, upCost);
    
    btnDemolish.onclick = () => demolishBuilding(cell.col, cell.row);
}

function clearObstacle(col, row, cost, reward) {
    const cell = state.grid[row][col];
    if (!cell.obstacle) return;
    
    if (cost.gold && state.resources.gold < cost.gold) {
        showToast("ゴールドが足りません！", "warning");
        return;
    }
    if (cost.mana && state.resources.mana < cost.mana) {
        showToast("マナが足りません！", "warning");
        return;
    }
    
    if (cost.gold) state.resources.gold -= cost.gold;
    if (cost.mana) state.resources.mana -= cost.mana;
    
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
    
    const sprite = document.getElementById(`obstacle-sprite-${col}-${row}`);
    if (sprite) sprite.remove();
    
    cell.obstacle = null;
    
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (tile) {
        tile.dataset.tip = `🌿 <b>草原タイル (${col}, ${row})</b><br>建物を建設できる平らな草地です。`;
    }
    
    playBuildSound();
    showToast("土地を開拓しました！", "success");
    
    document.getElementById('details-panel').classList.add('hidden');
    if (state.selectedCell) {
        const t = document.getElementById(`tile-${state.selectedCell.col}-${state.selectedCell.row}`);
        if (t) t.classList.remove('selected');
        state.selectedCell = null;
    }
    
    updateHUD();
}

function placeBuildingAt(col, row, type, free = false) {
    const cell = state.grid[row][col];
    
    if (cell.building || cell.obstacle) {
        showToast("この場所には建設できません！", "warning");
        return;
    }
    
    if (type === 'world_tree' && !free) {
        const canBuildTree = state.factions.royal.rep >= 80 && 
                             state.factions.guild.rep >= 80 && 
                             state.factions.archive.rep >= 80;
        if (!canBuildTree) {
            showToast("世界樹を植えるには、3大勢力すべての友好度を80以上(同盟関係)にする必要があります！", "danger");
            return;
        }
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
    
    const objectsLayer = document.getElementById('objects-layer');
    const { x, y } = getIsoCoords(col, row);
    
    const sprite = document.createElement('div');
    sprite.id = `building-sprite-${col}-${row}`;
    sprite.style.zIndex = (col + row) * 10 + 2;
    sprite.style.pointerEvents = 'auto';
    
    sprite.addEventListener('click', (e) => {
        e.stopPropagation();
        handleTileClick(col, row);
    });
    
    if (type === 'world_tree') {
        sprite.className = `building-sprite world-tree-seed`;
        sprite.textContent = '🌱';
        sprite.style.fontSize = '3.0rem';
        sprite.style.display = 'flex';
        sprite.style.alignItems = 'center';
        sprite.style.justifyContent = 'center';
        sprite.style.left = `${x + BASE_TILE_WIDTH/2}px`;
        sprite.style.top = `${y + BASE_TILE_HEIGHT/2}px`;
        sprite.style.transform = 'translate(-50%, -65%)';
        objectsLayer.appendChild(sprite);
        
        playMagicCastSound();
        showToast("世界樹の種を植えました。魔力を注いでいます...", "info");
        
        setTimeout(() => {
            sprite.textContent = '🌳';
            sprite.style.fontSize = '4.5rem';
            sprite.style.animation = 'logoFloat 3s ease-in-out infinite';
            createFloatingText(col, row, "開花！🌳✨", "mana");
            triggerGameClear();
        }, 3000);
    } else {
        sprite.className = `building-sprite building-${type}`;
        sprite.style.backgroundImage = `url('${state.assetsProcessed[type]}')`;
        sprite.style.left = `${x}px`;
        sprite.style.top = `${y - 35}px`;
        sprite.style.width = '120px';
        sprite.style.height = '120px';
        objectsLayer.appendChild(sprite);
    }
    
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (tile) {
        if (type === 'town_hall') {
            tile.dataset.tip = `🏛️ <b>${config.name}</b><br>${config.description}<br>・街のシンボルです。`;
        } else {
            tile.dataset.tip = `🏡 <b>${config.name} (Lv.1)</b><br>${config.description}<br>・クリックして操作`;
        }
    }
    
    playBuildSound();
    createFloatingText(col, row, `-${config.cost.gold}🪙`, 'gold');
    
    updateQuestProgress('build_houses');
    
    if (type === 'tavern' || type === 'barracks') {
        spawnAdventurer(type === 'tavern' ? 'mage' : 'knight');
    }
    
    updateHUD();
    clearSelectedTool();
}

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
    
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (tile) {
        tile.dataset.tip = `🏡 <b>${config.name} (Lv.${cell.building.level})</b><br>${config.description}<br>・クリックして操作`;
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

function demolishBuilding(col, row) {
    const cell = state.grid[row][col];
    if (!cell.building) return;
    
    const config = BUILDING_TYPES[cell.building.type];
    state.resources.popMax = Math.max(0, state.resources.popMax - config.popMaxAdd * cell.building.level);
    
    const sprite = document.getElementById(`building-sprite-${col}-${row}`);
    if (sprite) sprite.remove();
    
    cell.building = null;
    
    const tile = document.getElementById(`tile-${col}-${row}`);
    if (tile) {
        tile.dataset.tip = `🌿 <b>草原タイル (${col}, ${row})</b><br>建物を建設できる平らな草地です。`;
    }
    
    playBuildSound();
    document.getElementById('details-panel').classList.add('hidden');
    updateHUD();
}

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
        tile.dataset.tip = `🧱 <b>レンガ道 (${col}, ${row})</b><br>レンガ舗装された道です。<br>・移動速度が <b>1.45倍</b> にアップします。`;
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
    const happinessMultiplier = state.resources.happiness / 100.0;
    
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = state.grid[r][c];
            if (cell.building) {
                const config = BUILDING_TYPES[cell.building.type];
                const mult = cell.building.level * productionMultiplier;
                
                if (config.production.gold > 0) {
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
    
    const slimeCount = state.characters.filter(c => c.type === 'slime').length;
    if (slimeCount > 0) {
        state.resources.happiness = Math.max(50, state.resources.happiness - (slimeCount * 0.05));
    } else {
        state.resources.happiness = Math.min(100, state.resources.happiness + 0.1);
    }
    
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
        
        let canAfford = state.resources.gold >= config.cost.gold &&
                        state.resources.wood >= config.cost.wood &&
                        state.resources.mana >= config.cost.mana;
        
        // 世界樹の種は友好度80以上同盟が必須
        if (bType === 'world_tree') {
            const hasAlliance = state.factions.royal.rep >= 80 && 
                                state.factions.guild.rep >= 80 && 
                                state.factions.archive.rep >= 80;
            if (!hasAlliance) canAfford = false;
        }
        
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
        const slimeIdx = state.characters.findIndex(c => c.type === 'slime' && Math.round(c.x) === col && Math.round(c.y) === row);
        
        if (slimeIdx !== -1) {
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
        speed: profession === 'knight' ? 0.05 : 0.04,
        path: []
    };
    
    state.characters.push(adventurer);
    createCharacterDOM(adventurer);
    playChibiVoice('spawn'); 
    showToast(`新米の${profession === 'knight' ? '騎士' : '魔導士'}(${gender === 'boy' ? '男の子' : '女の子'})が到着しました！`, "success");
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
        speed: 0.02,
        path: []
    };
    
    state.characters.push(slime);
    createCharacterDOM(slime);
    showToast("野生のスライムが侵入してきました！", "warning");
}

function spawnCitizen() {
    const gender = Math.random() < 0.5 ? 'boy' : 'girl';
    const subType = gender === 'boy' ? 'knight_boy' : 'mage_girl';
    
    const id = state.nextCharId++;
    // 最初は道路の適当なポイントに住民を出現させる
    const roadTile = getRandomRoadCell();
    const citizen = {
        id: id,
        type: 'citizen',
        subType: subType,
        x: roadTile ? roadTile.col : 3,
        y: roadTile ? roadTile.row : 3,
        targetX: roadTile ? roadTile.col : 3,
        targetY: roadTile ? roadTile.row : 3,
        state: 'wander',
        speed: 0.03,
        path: []
    };
    
    state.characters.push(citizen);
    createCharacterDOM(citizen);
}

// 道路セルをランダムに1個取得する
function getRandomRoadCell() {
    const roads = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (state.grid[r][c].tileType === 'dirt' && !state.grid[r][c].building) {
                roads.push(state.grid[r][c]);
            }
        }
    }
    return roads.length > 0 ? roads[Math.floor(Math.random() * roads.length)] : null;
}

function createCharacterDOM(char) {
    const objectsLayer = document.getElementById('objects-layer');
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
    el.style.zIndex = Math.floor(char.x + char.y) * 10 + 5; 
    
    el.style.pointerEvents = 'auto';
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        playChibiVoice('click');
        createEmoteBubble(char.id, '💬');
    });
    
    if (char.type === 'adventurer') {
        el.dataset.tip = `⚔️ <b>冒険者 (${char.profession === 'knight' ? '騎士' : '魔導士'})</b><br>Lv.${char.level}<br>・スライムを見つけると自動で退治します。`;
    } else if (char.type === 'slime') {
        el.dataset.tip = `💧 <b>スライム</b><br>・放置すると街の幸福度が下がります。<br>・倒すとゴールドを獲得できます。`;
    } else {
        el.dataset.tip = `👥 <b>住民</b><br>・街を散歩しています。`;
    }
    
    objectsLayer.appendChild(el);
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
        
        let speedMod = 1.0;
        const currentTileR = Math.min(GRID_SIZE - 1, Math.max(0, Math.round(char.y)));
        const currentTileC = Math.min(GRID_SIZE - 1, Math.max(0, Math.round(char.x)));
        if (state.grid[currentTileR][currentTileC].tileType === 'dirt') {
            speedMod = 1.45; 
        }
        
        if (dist > 0.05) {
            const step = Math.min(char.speed * speedMod || 0.03, dist);
            char.x += (dx / dist) * step;
            char.y += (dy / dist) * step;
            
            // 体の方向（左右）および歩行クラスの設定
            // 画面空間上での移動方向 (dx - dy) に応じて反転する
            const screenDx = dx - dy;
            dom.style.setProperty('--scale-x', screenDx >= 0 ? '1' : '-1');
            dom.classList.add('walking');
        } else {
            char.x = char.targetX;
            char.y = char.targetY;
            dom.classList.remove('walking');
            
            // もし復帰パスが残っているなら次のセルへ進む
            if (char.path && char.path.length > 0) {
                const nextNode = char.path.shift();
                char.targetX = nextNode.x;
                char.targetY = nextNode.y;
            } else {
                if (char.state === 'walk_to_road') {
                    char.state = 'wander';
                }
                if (char.state === 'walk_to_target' || char.state === 'wander') {
                    setRandomTarget(char);
                }
            }
        }
        
        const pix = getIsoCoords(char.x, char.y);
        dom.style.left = `${pix.x + BASE_TILE_WIDTH / 2}px`;
        dom.style.top = `${pix.y + BASE_TILE_HEIGHT / 3}px`;
        dom.style.zIndex = Math.floor(char.x + char.y) * 10 + 5; 
    });
}

// 最寄りの道路セルまでの最短経路をBFSで探索する
function findPathToRoad(startCol, startRow) {
    const queue = [[{x: startCol, y: startRow}]];
    const visited = new Set();
    visited.add(`${startCol},${startRow}`);
    
    while (queue.length > 0) {
        const path = queue.shift();
        const curr = path[path.length - 1];
        
        // もしこのセルが道路なら、これが目的地
        if (state.grid[curr.y][curr.x].tileType === 'dirt') {
            return path;
        }
        
        // 上下左右の4方向を探索
        const dirs = [
            {dx: 0, dy: -1},
            {dx: 0, dy: 1},
            {dx: -1, dy: 0},
            {dx: 1, dy: 0}
        ];
        
        for (const dir of dirs) {
            const nx = curr.x + dir.dx;
            const ny = curr.y + dir.dy;
            
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                const cell = state.grid[ny][nx];
                // 建物や障害物は通れない
                if (!cell.building && !cell.obstacle) {
                    const key = `${nx},${ny}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        queue.push([...path, {x: nx, y: ny}]);
                    }
                }
            }
        }
    }
    return null;
}

// キャラクターが道路（レンガ道）のみを歩くように目標を設定するAI
function setRandomTarget(char) {
    const currentX = Math.round(char.x);
    const currentY = Math.round(char.y);
    
    // もし市民や冒険者が道路の上にいない場合、最寄りの道路への復帰経路を探す
    if (char.type !== 'slime' && state.grid[currentY][currentX].tileType !== 'dirt') {
        const roadPath = findPathToRoad(currentX, currentY);
        if (roadPath && roadPath.length > 1) {
            char.path = roadPath.slice(1);
            const nextNode = char.path.shift();
            char.targetX = nextNode.x;
            char.targetY = nextNode.y;
            char.state = 'walk_to_road';
            return;
        }
    }
    
    const neighbors = [];
    // 直交4方向
    const dirs = [
        {dx: 0, dy: -1},
        {dx: 0, dy: 1},
        {dx: -1, dy: 0},
        {dx: 1, dy: 0}
    ];
    for (const dir of dirs) {
        const nx = currentX + dir.dx;
        const ny = currentY + dir.dy;
        
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            const cell = state.grid[ny][nx];
            
            // スライムはモンスターなので、道路以外の草地も自由に歩ける
            if (char.type === 'slime') {
                if (!cell.building && !cell.obstacle) {
                    neighbors.push({x: nx, y: ny});
                }
            } else {
                // 市民と冒険者はレンガ舗装された「道」だけを歩く！ (建物や障害物は避ける)
                if (cell.tileType === 'dirt' && !cell.building && !cell.obstacle) {
                    neighbors.push({x: nx, y: ny});
                }
            }
        }
    }
    
    if (neighbors.length > 0) {
        const choice = neighbors[Math.floor(Math.random() * neighbors.length)];
        char.targetX = choice.x;
        char.targetY = choice.y;
    } else {
        // 周辺に動ける道路が無い場合の脱出フォールバック（隣接する空きセル）
        const fallbackNeighbors = [];
        for (const dir of dirs) {
            const nx = Math.max(0, Math.min(GRID_SIZE - 1, currentX + dir.dx));
            const ny = Math.max(0, Math.min(GRID_SIZE - 1, currentY + dir.dy));
            const cell = state.grid[ny][nx];
            if (!cell.building && !cell.obstacle) {
                fallbackNeighbors.push({x: nx, y: ny});
            }
        }
        if (fallbackNeighbors.length > 0) {
            const choice = fallbackNeighbors[Math.floor(Math.random() * fallbackNeighbors.length)];
            char.targetX = choice.x;
            char.targetY = choice.y;
        } else {
            char.targetX = char.x;
            char.targetY = char.y;
        }
    }
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
            // スライム討伐のために追いかける際は、草地の上も移動可能にする
            char.targetX = enemy.x;
            char.targetY = enemy.y;
            char.state = 'walk_to_target';
            char.path = []; // 追いかけ中は復帰パスをクリア
        }
        return;
    }
    
    // スライムの索敵 (索敵時のみ草地へ侵入する)
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
        char.path = []; // ターゲット検知時も復帰パスをクリア
        createEmoteBubble(char.id, '⚔️');
    }
}

function attackEnemy(attacker, defender) {
    const dmg = Math.round(attacker.atk * (0.8 + Math.random() * 0.4));
    defender.hp -= dmg;
    
    createFloatingText(defender.x, defender.y, `-${dmg}`, 'damage');
    playChibiVoice('attack'); 
    playChibiVoice('hurt'); 
    
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
    if (rep >= 80) return '同盟結成';
    if (rep >= 65) return '友好';
    if (rep >= 45) return '中立';
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
            showToast("👑 王宮と同盟締結！民家のゴールド回収効率が+30%上昇しました。", "success");
            BUILDING_TYPES.house.production.gold *= 1.30;
            BUILDING_TYPES.tavern.production.gold *= 1.30;
        } else if (factionKey === 'guild') {
            showToast("⚔️ 冒険者ギルドと同盟締結！精鋭の「魔導士」が追加召喚されました！", "success");
            spawnAdventurer('mage');
        } else if (factionKey === 'archive') {
            showToast("🔮 大魔導書院と同盟締結！「成長の雨」のコストがマナ10に半減しました！", "success");
            SPELLS.rain.cost.mana = 10;
            document.getElementById('spell-rain').querySelector('.spell-cost').textContent = "✨10";
            document.getElementById('spell-rain').dataset.tip = `🌧️ <b>成長の雨 (消費マナ: 10)</b><br>40秒間、全施設の資源生産速度が <b>2倍</b> になります。`;
        }
    }
}

// ==========================================
// 9. ビューポート操作 (ドラッグ＆ホイールスクロールパン・ボタンズーム)
// ==========================================

function initViewportControls() {
    const viewport = document.getElementById('viewport');
    
    const viewWidth = viewport.clientWidth;
    const viewHeight = viewport.clientHeight;
    state.viewport.x = (viewWidth - 1200) / 2;
    state.viewport.y = 80;
    updateViewportTransform();
    
    // マウスドラッグ移動
    viewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('#hud, #spell-book, #faction-panel, #shop, #details-panel, #zoom-controls, #help-modal, #clear-modal, .btn, .btn-toggle-panel, .btn-toggle-shop')) return;
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
    
    // タッチ操作移動（スマホ対応ドラッグ ＆ ピンチズーム）
    viewport.addEventListener('touchstart', (e) => {
        if (e.target.closest('#hud, #spell-book, #faction-panel, #shop, #details-panel, #zoom-controls, #help-modal, #clear-modal, .btn, .btn-toggle-panel, .btn-toggle-shop')) return;
        
        if (e.touches.length === 1) {
            state.viewport.isDragging = true;
            const touch = e.touches[0];
            state.viewport.startX = touch.clientX - state.viewport.x;
            state.viewport.startY = touch.clientY - state.viewport.y;
        } else if (e.touches.length === 2) {
            state.viewport.isDragging = false;
            state.viewport.isPinching = true;
            state.viewport.initialTouchDist = Math.sqrt(
                (e.touches[0].clientX - e.touches[1].clientX) ** 2 +
                (e.touches[0].clientY - e.touches[1].clientY) ** 2
            );
            state.viewport.initialScale = state.viewport.scale;
        }
    }, { passive: true });
    
    window.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && state.viewport.isDragging) {
            const touch = e.touches[0];
            state.viewport.x = touch.clientX - state.viewport.startX;
            state.viewport.y = touch.clientY - state.viewport.startY;
            updateViewportTransform();
        } else if (e.touches.length === 2 && state.viewport.isPinching) {
            const dist = Math.sqrt(
                (e.touches[0].clientX - e.touches[1].clientX) ** 2 +
                (e.touches[0].clientY - e.touches[1].clientY) ** 2
            );
            if (state.viewport.initialTouchDist > 0) {
                const scaleFactor = dist / state.viewport.initialTouchDist;
                state.viewport.scale = Math.min(1.5, Math.max(0.6, state.viewport.initialScale * scaleFactor));
                updateViewportTransform();
            }
        }
    }, { passive: true });
    
    window.addEventListener('touchend', () => {
        state.viewport.isDragging = false;
        state.viewport.isPinching = false;
    });
    
    // マウスホイール・ピンチホイール
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        if (e.ctrlKey) {
            const zoomStep = 0.05;
            if (e.deltaY < 0) {
                state.viewport.scale = Math.min(1.5, state.viewport.scale + zoomStep);
            } else {
                state.viewport.scale = Math.max(0.6, state.viewport.scale - zoomStep);
            }
        } else {
            state.viewport.x -= e.deltaX;
            state.viewport.y -= e.deltaY;
        }
        updateViewportTransform();
    });
    
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
// 10. UI開閉システム & ツールチップ
// ==========================================

function initTooltip() {
    const tooltip = document.getElementById('tooltip');
    
    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tip]');
        if (target) {
            tooltip.innerHTML = target.getAttribute('data-tip');
            tooltip.classList.remove('hidden');
            tooltip.style.opacity = 1;
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!tooltip.classList.contains('hidden')) {
            let x = e.clientX + 15;
            let y = e.clientY + 15;
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
    
    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tip]');
        if (target) {
            tooltip.classList.add('hidden');
            tooltip.style.opacity = 0;
        }
    });
}

function initPanelCollapsible() {
    const spellPanel = document.getElementById('spell-book');
    const toggleSpellBtn = document.getElementById('btn-toggle-spell');
    const factionPanel = document.getElementById('faction-panel');
    const toggleFactionBtn = document.getElementById('btn-toggle-faction');
    
    toggleSpellBtn.addEventListener('click', () => {
        playClickSound();
        const isCollapsed = spellPanel.classList.toggle('collapsed');
        toggleSpellBtn.textContent = isCollapsed ? '▶' : '◀';
        
        // モバイルで画面幅が狭い場合、反対側のパネルを自動的に閉じる
        if (!isCollapsed && window.innerWidth < 768) {
            factionPanel.classList.add('collapsed');
            toggleFactionBtn.textContent = '◀';
        }
    });
    
    toggleFactionBtn.addEventListener('click', () => {
        playClickSound();
        const isCollapsed = factionPanel.classList.toggle('collapsed');
        toggleFactionBtn.textContent = isCollapsed ? '◀' : '▶';
        
        // モバイルで画面幅が狭い場合、反対側のパネルを自動的に閉じる
        if (!isCollapsed && window.innerWidth < 768) {
            spellPanel.classList.add('collapsed');
            toggleSpellBtn.textContent = '▶';
        }
    });
    
    const shopPanel = document.getElementById('shop');
    const toggleShopBtn = document.getElementById('btn-toggle-shop');
    toggleShopBtn.addEventListener('click', () => {
        playClickSound();
        const isCollapsed = shopPanel.classList.toggle('collapsed');
        toggleShopBtn.textContent = isCollapsed ? '▲' : '▼';
    });
}

// ==========================================
// 11. ゲームクリア ＆ リスタート処理
// ==========================================

function triggerGameClear() {
    state.stats.gameCleared = true;
    
    if (state.audio.bgmInterval) {
        clearInterval(state.audio.bgmInterval);
    }
    
    playVictoryFanfare();
    
    const elapsedMs = Date.now() - state.stats.startTime;
    const minutes = Math.floor(elapsedMs / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);
    const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    
    document.getElementById('clear-time').textContent = timeStr;
    document.getElementById('clear-slimes').textContent = state.stats.slimesKilled;
    
    document.getElementById('clear-modal').classList.remove('hidden');
}

function restartGame() {
    playClickSound();
    
    state.resources = {
        gold: 150,
        wood: 80,
        mana: 40,
        pop: 0,
        popMax: 5,
        happiness: 100
    };
    state.activeEffects.rain = 0;
    state.stats.slimesKilled = 0;
    state.stats.gameCleared = false;
    
    state.factions.royal.rep = 50;
    state.factions.royal.bonusUnlocked = false;
    state.factions.guild.rep = 50;
    state.factions.guild.bonusUnlocked = false;
    state.factions.archive.rep = 50;
    state.factions.archive.bonusUnlocked = false;
    
    BUILDING_TYPES.house.production.gold = 1.5;
    BUILDING_TYPES.tavern.production.gold = 0.8;
    SPELLS.rain.cost.mana = 20;
    document.getElementById('spell-rain').querySelector('.spell-cost').textContent = "✨20";
    document.getElementById('spell-rain').dataset.tip = `🌧️ <b>成長の雨 (消費マナ: 20)</b><br>40秒間、全施設の資源生産速度が <b>2倍</b> になります。`;
    
    document.getElementById('clear-modal').classList.add('hidden');
    
    initAudio();
    initGame();
    showToast("新しくゲームを開始しました！", "success");
}

// ==========================================
// 12. アプリケーション開始
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    preloadAndProcessAssets();
    initTooltip();
    initPanelCollapsible();
    
    document.getElementById('btn-start').addEventListener('click', () => {
        playClickSound();
        initAudio();
        
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        
        initViewportControls();
        initGame();
        
        document.getElementById('help-modal').classList.remove('hidden');
    });
    
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
    
    document.getElementById('btn-restart').addEventListener('click', restartGame);
    
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
    
    document.querySelectorAll('.shop-item').forEach(item => {
        item.addEventListener('click', () => {
            playClickSound();
            const isSelected = item.classList.contains('selected');
            clearSelectedTool();
            
            if (!isSelected) {
                item.classList.add('selected');
                state.selectedTool = item.dataset.build;
                showToast("マップをクリックして配置してください", "info");
            }
        });
    });
    
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
    
    document.getElementById('spell-rain').addEventListener('click', startRainSpell);
    document.getElementById('spell-surge').addEventListener('click', () => selectSpell('surge'));
    document.getElementById('spell-slime').addEventListener('click', () => selectSpell('slime'));
    document.getElementById('spell-cleanse').addEventListener('click', () => selectSpell('cleanse'));
    
    document.getElementById('btn-sound').addEventListener('click', toggleSound);
    
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
