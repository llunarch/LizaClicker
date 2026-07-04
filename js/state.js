/**
 * Clickpazzles - Game State Manager
 * Handles local state representation, local storage persistence, and serialization.
 */

const SAVE_KEY = 'clickpazzles_save_v1';

const DEFAULT_STATE = {
  hearts: 0,
  totalHearts: 0,
  clickPower: 1,
  heartsPerSec: 0,
  musicVolume: 0.15,
  musicMuted: false,
  bossLevel: 1,
  bossHp: 25,
  upgrades: {
    // Click upgrades
    gentlePat: 0,
    sweetWord: 0,
    warmHug: 0,
    
    // Auto clicker upgrades
    catEars: 0,
    kittens: 0
  },
  wonGifts: [],
  highestPuzzleLevel: 1,
  highestJigsawLevel: 1
};

// The live in-memory state object
export let state = { ...JSON.parse(JSON.stringify(DEFAULT_STATE)) };

/**
 * Merge loaded data with the default structure to handle future additions gracefully.
 */
function mergeDeep(target, source) {
  if (!source) return target;
  for (const key of Object.keys(target)) {
    if (source[key] !== undefined) {
      if (typeof target[key] === 'object' && target[key] !== null) {
        mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  return target;
}

/**
 * Loads the game state from local storage.
 */
export function loadState() {
  try {
    const rawData = localStorage.getItem(SAVE_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData);
      state = mergeDeep(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
    } else {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  } catch (e) {
    console.error('Failed to load game state:', e);
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  return state;
}

/**
 * Saves the current game state to local storage.
 */
export function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save game state:', e);
  }
}

/**
 * Resets the game state back to default values and saves it.
 */
export function resetState() {
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  saveState();
  return state;
}

/**
 * Adds hearts to the player's account.
 * @param {number} amount 
 */
export function addHearts(amount) {
  if (amount <= 0) return;
  state.hearts += amount;
  state.totalHearts += amount;
}

/**
 * Deducts hearts if the player can afford it.
 * @param {number} amount 
 * @returns {boolean} True if successfully spent, false otherwise.
 */
export function spendHearts(amount) {
  if (amount <= 0) return true;
  if (state.hearts >= amount) {
    state.hearts -= amount;
    return true;
  }
  return false;
}

/**
 * Updates the calculated click power and hearts per second based on current upgrades.
 * This function should be called after buying any upgrade.
 * @param {Object} upgradesConfig Configuration data for upgrade stats
 */
export function recalculateStats(upgradesConfig) {
  // Reset stats to baseline
  let baseClickPower = 1;
  let baseHeartsPerSec = 0;

  // Process Click Upgrades
  if (state.upgrades.gentlePat) {
    baseClickPower += state.upgrades.gentlePat * upgradesConfig.click.gentlePat.power;
  }
  if (state.upgrades.sweetWord) {
    baseClickPower += state.upgrades.sweetWord * upgradesConfig.click.sweetWord.power;
  }
  if (state.upgrades.warmHug) {
    baseClickPower += state.upgrades.warmHug * upgradesConfig.click.warmHug.power;
  }

  // Process Auto Upgrades
  if (state.upgrades.catEars) {
    baseHeartsPerSec += state.upgrades.catEars * upgradesConfig.auto.catEars.pps;
  }
  if (state.upgrades.kittens) {
    baseHeartsPerSec += state.upgrades.kittens * upgradesConfig.auto.kittens.pps;
  }

  // Assign back to state
  state.clickPower = baseClickPower;
  state.heartsPerSec = parseFloat(baseHeartsPerSec.toFixed(1));
}
