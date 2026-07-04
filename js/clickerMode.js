/**
 * Clickpazzles - Clicker Mode Controller
 * Handles clicking, particle generation, upgrade shop rendering, auto-click loop,
 * and Boss HP progression (Boss 1 to Final Boss 6).
 */

import { state, addHearts, spendHearts, recalculateStats, saveState } from './state.js';
import { formatNumber, showToast } from './ui.js';

// Configuration for all upgrades (simplified for a short gift game)
export const UPGRADES_CONFIG = {
  click: {
    gentlePat: { name: '+1 Клик', baseCost: 15, multiplier: 1.3, power: 1, emoji: '🖱️', desc: 'Сила клика +1' },
    sweetWord: { name: '+5 Клик', baseCost: 100, multiplier: 1.4, power: 5, emoji: '🖱️', desc: 'Сила клика +5' },
    warmHug: { name: '+10 Клик', baseCost: 400, multiplier: 1.4, power: 10, emoji: '🖱️', desc: 'Сила клика +10' }
  },
  auto: {
    catEars: { name: 'Автоклик +0.5', baseCost: 20, multiplier: 1.2, pps: 0.5, emoji: '🤖', desc: 'Автоклик +0.5/сек' },
    kittens: { name: 'Автоклик +2', baseCost: 150, multiplier: 1.3, pps: 2.0, emoji: '🤖', desc: 'Автоклик +2/сек' }
  }
};

// Max HP for each Boss Stage
export const BOSS_HP_CONFIG = {
  1: 25,
  2: 100,
  3: 250,
  4: 750,
  5: 1500,
  6: 2000
};

// References to DOM elements
let elements = {
  heartsCounter: null,
  heartsPerSec: null,
  heartsPerClick: null,
  clickerTarget: null,
  toastContainer: null,
  bossTitle: null,
  bossHpText: null,
  bossHpBarFill: null,
  finalBossOverlay: null,
  clickerImage: null
};

// Caches for upgrade items DOM bindings to avoid re-rendering layout
const upgradeDOMRefs = {
  click: {},
  auto: {}
};

// Ticker interval references
let tickInterval = null;
let saveTimer = 0;

/**
 * Calculates the current cost for an upgrade based on owned quantity.
 */
export function getUpgradeCost(category, upgradeId) {
  const config = UPGRADES_CONFIG[category][upgradeId];
  const owned = state.upgrades[upgradeId] || 0;
  return Math.floor(config.baseCost * Math.pow(config.multiplier, owned));
}

/**
 * Initializes Clicker Mode components, binds click events, and starts the game loop.
 */
export function initClicker() {
  // Grab DOM elements
  elements.heartsCounter = document.getElementById('hearts-counter');
  elements.heartsPerSec = document.getElementById('hearts-per-sec');
  elements.heartsPerClick = document.getElementById('hearts-per-click');
  elements.clickerTarget = document.getElementById('clicker-target');
  elements.toastContainer = document.getElementById('toast-container');
  
  // Boss UI elements
  elements.bossTitle = document.getElementById('boss-title');
  elements.bossHpText = document.getElementById('boss-hp-text');
  elements.bossHpBarFill = document.getElementById('boss-hp-bar-fill');
  elements.finalBossOverlay = document.getElementById('final-boss-overlay');
  elements.clickerImage = document.getElementById('clicker-image');

  // Set up Tabs switching in upgrades shop
  const tabs = document.querySelectorAll('.upgrades-tabs .tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const paneId = tab.getAttribute('data-tab');
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
      });
      document.getElementById(paneId).classList.add('active');
    });
  });

  // Recalculate baseline stats from loaded save state
  recalculateStats(UPGRADES_CONFIG);

  // Render Shop Items (once)
  renderShop();

  // Load the correct boss image and show overlays
  updateBossImage();

  // Bind Main Click Target
  elements.clickerTarget.addEventListener('mousedown', handleMainClick);

  // Start the tick loop (10 ticks per second for smooth updates)
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(gameTick, 100);

  // Preload gift images to prevent empty frame flashing during roulette
  const giftImages = [
    'Gift/Gift1.jpg',
    'Gift/Gift2.jpg',
    'Gift/Gift3.jpg',
    'Gift/Gift4.jpg',
    'Gift/Gift5.jpg',
    'Gift/Gift6.jpg'
  ];
  giftImages.forEach(src => {
    const img = new Image();
    img.src = src;
  });

  // Initial UI refresh
  updateUI();
}

/**
 * Handles clicks on the main image.
 */
function handleMainClick(e) {
  e.preventDefault();
  
  // Trigger click animation
  elements.clickerTarget.classList.remove('click-active');
  void elements.clickerTarget.offsetWidth; // Trigger reflow to restart css animation
  elements.clickerTarget.classList.add('click-active');

  // Add points
  addHearts(state.clickPower);

  // Deal damage to the active boss
  dealDamage(state.clickPower);

  // Spawn visual particles
  spawnParticles(e);

  // Update UI immediately for responsive feel
  updateUI();
}

/**
 * Deals damage to the active Boss.
 */
function dealDamage(amount) {
  if (state.bossHp <= 0) return; // Already defeated

  state.bossHp -= amount;

  if (state.bossHp <= 0) {
    state.bossHp = 0;
    defeatBoss();
  }
}

/**
 * Handles advancing levels when a boss is defeated.
 */
function defeatBoss() {
  if (state.bossLevel < 6) {
    // Advance Boss Stage
    state.bossLevel += 1;
    const maxHp = BOSS_HP_CONFIG[state.bossLevel];
    state.bossHp = maxHp;
    
    // Save state immediately
    saveState();

    // Trigger visual notification
    showToast(`Босс ${state.bossLevel - 1} побежден! ⚔️`, '🎉');

    // Update clicker target image source and check overlays
    updateBossImage();
  } else {
    // Defeated FINAL BOSS (Click6)
    triggerVictory();
  }
}

/**
 * Sets the correct image path and checks "FINAL BOSS" overlay visibility.
 */
export function updateBossImage() {
  if (elements.clickerImage) {
    elements.clickerImage.src = `Clicker/Click${state.bossLevel}.jpg`;
  }
  if (elements.finalBossOverlay) {
    if (state.bossLevel === 6) {
      elements.finalBossOverlay.classList.remove('hidden');
    } else {
      elements.finalBossOverlay.classList.add('hidden');
    }
  }
}

/**
 * Victory trigger when Boss 6 is defeated.
 */
let victoryListenersBound = false;
let selectedPrizeSrc = '';

/**
 * Play a minor synth beep using Web Audio API
 */
function playBeep(freq = 800, duration = 0.05) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.04, ctx.currentTime); // low volume
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('Web Audio beep failed:', e);
  }
}

/**
 * Play a retro major chord arpeggio for victory
 */
function playWinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playNote = (freq, delay, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    };
    
    playNote(261.63, 0.0, 0.4);  // C4
    playNote(329.63, 0.12, 0.4); // E4
    playNote(392.00, 0.24, 0.4); // G4
    playNote(523.25, 0.36, 0.7); // C5
  } catch (e) {
    console.warn('Web Audio victory sound failed:', e);
  }
}

/**
 * Binds victory modal button clicks once.
 */
function setupVictoryModalListeners() {
  if (victoryListenersBound) return;
  
  const btnPrize = document.getElementById('btn-victory-prize');
  const btnMenu = document.getElementById('btn-victory-menu');
  const btnDownload = document.getElementById('btn-prize-download');
  const btnPrizeMenu = document.getElementById('btn-prize-menu');
  const btnNext = document.getElementById('btn-prize-next');
  
  if (btnPrize) btnPrize.addEventListener('click', startRoulette);
  if (btnMenu) btnMenu.addEventListener('click', resetAndGoToMenu);
  if (btnDownload) btnDownload.addEventListener('click', () => downloadPrize(selectedPrizeSrc));
  if (btnPrizeMenu) btnPrizeMenu.addEventListener('click', resetAndGoToMenu);
  if (btnNext) btnNext.addEventListener('click', continueClicking);
  
  victoryListenersBound = true;
}

/**
 * Closes the victory modal, resets boss stage to 1, but retains upgrades, hearts, pps, click power, etc.
 */
function continueClicking() {
  const modal = document.getElementById('victory-modal');
  if (modal) modal.classList.add('hidden');

  state.bossLevel = 1;
  state.bossHp = BOSS_HP_CONFIG[1];
  
  saveState();
  
  // Update boss visual state and UI counters
  updateBossImage();
  updateUI();
}

/**
 * Resets the clicker progress and programmatically routes back to main menu.
 */
function resetAndGoToMenu() {
  const modal = document.getElementById('victory-modal');
  if (modal) modal.classList.add('hidden');

  // Hard prestige reset
  destroyClicker();
  state.hearts = 0;
  state.totalHearts = 0;
  state.clickPower = 1;
  state.heartsPerSec = 0;
  state.bossLevel = 1;
  state.bossHp = BOSS_HP_CONFIG[1];
  
  // Reset upgrades count
  Object.keys(state.upgrades).forEach(key => {
    state.upgrades[key] = 0;
  });
  
  BOSS_HP_CONFIG[6] = 2000;
  
  saveState();
  
  // Click "back to menu" to trigger navigation
  const backMenuBtn = document.getElementById('btn-back-menu');
  if (backMenuBtn) {
    backMenuBtn.click();
  }
}

/**
 * Triggers the gift roulette spinning.
 */
function startRoulette() {
  const modalInitial = document.getElementById('victory-stage-initial');
  const modalRoulette = document.getElementById('victory-stage-roulette');
  const rouletteImg = document.getElementById('roulette-image');
  
  if (modalInitial) modalInitial.classList.add('hidden');
  if (modalRoulette) modalRoulette.classList.remove('hidden');
  
  const giftImages = [
    'Gift/Gift1.jpg',
    'Gift/Gift2.jpg',
    'Gift/Gift3.jpg',
    'Gift/Gift4.jpg',
    'Gift/Gift5.jpg',
    'Gift/Gift6.jpg'
  ];
  
  const wonGiftsList = state.wonGifts || [];
  const availableGifts = giftImages.filter(g => !wonGiftsList.includes(g));
  
  if (availableGifts.length === 0) {
    resetAndGoToMenu();
    return;
  }
  
  let currentIndex = 0;
  let currentDelay = 60;
  const maxDelay = 500;
  
  function tick() {
    currentIndex = (currentIndex + 1) % giftImages.length;
    if (rouletteImg) {
      rouletteImg.src = giftImages[currentIndex];
    }
    
    playBeep(500 + currentIndex * 60, 0.05);
    
    if (currentDelay < maxDelay) {
      currentDelay += (currentDelay * 0.12);
      setTimeout(tick, currentDelay);
    } else {
      // Pick a random winner from the AVAILABLE gifts
      const winnerIndex = Math.floor(Math.random() * availableGifts.length);
      const winnerSrc = availableGifts[winnerIndex];
      
      if (rouletteImg) {
        rouletteImg.src = winnerSrc;
      }
      
      // Save this gift as won
      if (!state.wonGifts) state.wonGifts = [];
      state.wonGifts.push(winnerSrc);
      saveState();
      
      setTimeout(() => {
        showWinner(winnerSrc);
      }, 600);
    }
  }
  
  setTimeout(tick, currentDelay);
}

/**
 * Displays the winning prize.
 */
function showWinner(winningSrc) {
  selectedPrizeSrc = winningSrc;
  
  const modalRoulette = document.getElementById('victory-stage-roulette');
  const modalResult = document.getElementById('victory-stage-result');
  const resultImg = document.getElementById('prize-result-image');
  
  if (modalRoulette) modalRoulette.classList.add('hidden');
  if (modalResult) modalResult.classList.remove('hidden');
  if (resultImg) {
    resultImg.src = winningSrc;
  }
  
  playWinSound();
}

/**
 * Saves/downloads the prize image.
 */
function downloadPrize(filePath) {
  if (!filePath) return;
  const link = document.createElement('a');
  link.href = filePath;
  link.download = filePath.split('/').pop();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Victory trigger when Boss 6 is defeated.
 */
function triggerVictory() {
  showToast("ФИНАЛЬНЫЙ БОСС ПОВЕРЖЕН! 👑", "🏆");
  
  const modalInitial = document.getElementById('victory-stage-initial');
  const modalRoulette = document.getElementById('victory-stage-roulette');
  const modalResult = document.getElementById('victory-stage-result');
  const modal = document.getElementById('victory-modal');
  
  if (modalInitial) modalInitial.classList.remove('hidden');
  if (modalRoulette) modalRoulette.classList.add('hidden');
  if (modalResult) modalResult.classList.add('hidden');
  
  const giftImages = [
    'Gift/Gift1.jpg',
    'Gift/Gift2.jpg',
    'Gift/Gift3.jpg',
    'Gift/Gift4.jpg',
    'Gift/Gift5.jpg',
    'Gift/Gift6.jpg'
  ];
  
  let wonGiftsList = state.wonGifts || [];
  if (wonGiftsList.length >= giftImages.length) {
    state.wonGifts = [];
    wonGiftsList = [];
    saveState();
    showToast("Вы собрали все призы! Коллекция сброшена, чтобы вы могли собирать их снова. 🎁", "🏆");
  }
  
  const availableGifts = giftImages.filter(g => !wonGiftsList.includes(g));
  
  const btnPrize = document.getElementById('btn-victory-prize');
  if (btnPrize) {
    if (availableGifts.length === 0) {
      btnPrize.classList.add('hidden');
    } else {
      btnPrize.classList.remove('hidden');
    }
  }
  
  setupVictoryModalListeners();
  
  if (modal) {
    modal.classList.remove('hidden');
  }
}

/**
 * Creates flying text '+X' and floating heart particles at mouse cursor.
 */
function spawnParticles(e) {
  const rect = elements.clickerTarget.getBoundingClientRect();
  
  // Mouse position relative to click target container
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 1. Text Particle (+Amount)
  const textParticle = document.createElement('div');
  textParticle.className = 'click-particle';
  textParticle.style.left = `${x}px`;
  textParticle.style.top = `${y}px`;
  textParticle.innerText = `+${formatNumber(state.clickPower)}`;
  elements.clickerTarget.appendChild(textParticle);

  // 2. Heart Particle (drifting icon)
  const heartParticle = document.createElement('div');
  heartParticle.className = 'heart-particle';
  heartParticle.style.left = `${x}px`;
  heartParticle.style.top = `${y}px`;
  heartParticle.innerText = ['❤️', '💖', '💝', '💕', '🌸'][Math.floor(Math.random() * 5)];

  // Random drift vector
  const dx = (Math.random() - 0.5) * 120; // horizontal speed
  const dy = -100 - Math.random() * 60;   // upwards speed
  const rot = (Math.random() - 0.5) * 60; // rotation angle
  heartParticle.style.setProperty('--dx', `${dx}px`);
  heartParticle.style.setProperty('--dy', `${dy}px`);
  heartParticle.style.setProperty('--rot', `${rot}deg`);

  elements.clickerTarget.appendChild(heartParticle);

  // Cleanup DOM elements when animations end
  textParticle.addEventListener('animationend', () => textParticle.remove());
  heartParticle.addEventListener('animationend', () => heartParticle.remove());
}

/**
 * Builds the shop HTML dynamically (run once on init).
 */
function renderShop() {
  const clickList = document.getElementById('click-upgrades-list');
  const autoList = document.getElementById('auto-upgrades-list');
  
  clickList.innerHTML = '';
  autoList.innerHTML = '';

  // Render Click Upgrades
  Object.keys(UPGRADES_CONFIG.click).forEach(id => {
    const item = UPGRADES_CONFIG.click[id];
    const el = createUpgradeDOMItem('click', id, item);
    clickList.appendChild(el);
  });

  // Render Auto Upgrades
  Object.keys(UPGRADES_CONFIG.auto).forEach(id => {
    const item = UPGRADES_CONFIG.auto[id];
    const el = createUpgradeDOMItem('auto', id, item);
    autoList.appendChild(el);
  });
}

/**
 * Creates DOM structure for an upgrade row and caches references to mutable sub-nodes.
 */
function createUpgradeDOMItem(category, id, config) {
  const row = document.createElement('div');
  row.className = 'upgrade-item';
  row.innerHTML = `
    <div class="upgrade-icon-wrapper">${config.emoji}</div>
    <div class="upgrade-details">
      <div class="upgrade-name-row">
        <span class="upgrade-name">${config.name}</span>
        <span class="upgrade-qty" id="qty-${category}-${id}">0</span>
      </div>
      <div class="upgrade-desc" title="${config.desc}">${config.desc}</div>
    </div>
    <button class="btn btn-disabled upgrade-buy-btn" id="btn-${category}-${id}" disabled>
      <span class="buy-lbl">Купить</span>
      <span class="buy-cost"><span id="cost-${category}-${id}">0</span> ❤️</span>
    </button>
  `;

  // Bind click action
  const button = row.querySelector(`#btn-${category}-${id}`);
  button.addEventListener('click', () => triggerPurchase(category, id));

  // Cache DOM references to update them without expensive selector queries
  upgradeDOMRefs[category][id] = {
    qtyLabel: row.querySelector(`#qty-${category}-${id}`),
    costLabel: row.querySelector(`#cost-${category}-${id}`),
    buyButton: button
  };

  return row;
}

/**
 * Handles purchase request for an upgrade item.
 */
function triggerPurchase(category, id) {
  const cost = getUpgradeCost(category, id);
  if (spendHearts(cost)) {
    // Increase quantity in state
    state.upgrades[id] = (state.upgrades[id] || 0) + 1;
    
    // Recalculate totals & rates
    recalculateStats(UPGRADES_CONFIG);
    
    // Save progress immediately on upgrade buy
    saveState();

    // Trigger visual notification
    const config = UPGRADES_CONFIG[category][id];
    showToast(`Куплено: ${config.name}!`, config.emoji);

    // Refresh UI state
    updateUI();
  }
}

/**
 * Fast UI counter-only refresh.
 */
function updateCounterOnly() {
  if (elements.heartsCounter) {
    elements.heartsCounter.innerText = formatNumber(Math.floor(state.hearts));
  }
}

/**
 * Standard complete UI refresh (syncs stats, upgrades affordability, and Boss HP bar).
 */
export function updateUI() {
  // Counters
  updateCounterOnly();
  if (elements.heartsPerSec) {
    elements.heartsPerSec.innerText = formatNumber(state.heartsPerSec);
  }
  if (elements.heartsPerClick) {
    elements.heartsPerClick.innerText = formatNumber(state.clickPower);
  }

  // Update Boss HP Panel Details
  const maxHp = BOSS_HP_CONFIG[state.bossLevel] || 1000000;
  const pct = Math.max(0, Math.min(100, (state.bossHp / maxHp) * 100));

  if (elements.bossTitle) {
    if (state.bossLevel === 6) {
      elements.bossTitle.innerText = "👑 ФИНАЛЬНЫЙ БОСС 👑";
    } else {
      elements.bossTitle.innerText = `БОСС ${state.bossLevel}/6`;
    }
  }

  if (elements.bossHpText) {
    elements.bossHpText.innerText = `${formatNumber(Math.ceil(state.bossHp))} / ${formatNumber(maxHp)} HP`;
  }

  if (elements.bossHpBarFill) {
    elements.bossHpBarFill.style.width = `${pct}%`;
  }

  // Update Buy Buttons Status (affordability)
  ['click', 'auto'].forEach(cat => {
    Object.keys(UPGRADES_CONFIG[cat]).forEach(id => {
      const refs = upgradeDOMRefs[cat][id];
      if (!refs) return;

      const qty = state.upgrades[id] || 0;
      const cost = getUpgradeCost(cat, id);

      // Update values
      refs.qtyLabel.innerText = qty;
      refs.costLabel.innerText = formatNumber(cost);

      // Toggle state
      if (state.hearts >= cost) {
        refs.buyButton.disabled = false;
        refs.buyButton.classList.remove('btn-disabled');
        refs.buyButton.classList.add('btn-primary');
      } else {
        refs.buyButton.disabled = true;
        refs.buyButton.classList.add('btn-disabled');
        refs.buyButton.classList.remove('btn-primary');
      }
    });
  });
}

/**
 * Ticks every 100ms. Processes passive heart earning from auto-clickers and passive Boss damage.
 */
function gameTick() {
  if (state.heartsPerSec > 0) {
    // Add 1/10th of per-second rate
    addHearts(state.heartsPerSec / 10);
    // Deal passive auto-damage to Boss
    dealDamage(state.heartsPerSec / 10);
    updateUI();
  } else {
    // Even if no auto-clickers are active, we must update shop buttons state 
    // since user clicks could make upgrades affordable.
    updateUI();
  }

  // Auto-save progress every 100 ticks (10 seconds)
  saveTimer++;
  if (saveTimer >= 100) {
    saveTimer = 0;
    saveState();
  }
}

/**
 * Stops game loops and cleans up before switching screens.
 */
export function destroyClicker() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}
