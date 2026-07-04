/**
 * Clickpazzles - Main Bootstrapper
 * Orchestrates module loading, view routing event hooks, and initialization.
 */

import { loadState, resetState, saveState, state } from './state.js';
import { showScreen, showToast } from './ui.js';
import { initClicker, destroyClicker, updateUI } from './clickerMode.js';
import { 
  initPuzzles, 
  nextLevel as nextSlidingLevel, 
  exitToMainMenu as exitSlidingToMainMenu 
} from './puzzlesMode.js';
import { 
  initJigsaw, 
  nextLevel as nextJigsawLevel, 
  exitToMainMenu as exitJigsawToMainMenu 
} from './jigsawMode.js';
import { 
  initAudio, 
  play, 
  togglePlay, 
  playNext, 
  playPrev, 
  setVolume, 
  toggleMute, 
  registerCallbacks,
  seek
} from './audio.js';

// Setup screen routing and control event hooks
document.addEventListener('DOMContentLoaded', () => {
  // 1. Load player state from Storage
  loadState();

  // Cache DOM references for player widget
  const playerBtnPlay = document.getElementById('player-btn-play');
  const playerVolumeSlider = document.getElementById('player-volume');
  const playerWidget = document.querySelector('.music-player-widget');

  const playerTrackName = document.getElementById('player-track-name');

  const playerProgress = document.getElementById('player-progress');
  const playerTimeCurrent = document.getElementById('player-time-current');
  const playerTimeDuration = document.getElementById('player-time-duration');

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === Infinity || secs < 0) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Register audio event callbacks to update player UI
  registerCallbacks(
    // onTrackChange — update current track title
    (trackName) => {
      if (playerTrackName) playerTrackName.innerText = trackName;
    },
    // onPlayStateChange
    (playing) => {
      if (playerBtnPlay) playerBtnPlay.innerText = playing ? '⏸' : '▶';
      if (playerWidget) {
        if (playing) {
          playerWidget.classList.add('music-playing');
        } else {
          playerWidget.classList.remove('music-playing');
        }
      }
    },
    // onTimeUpdate — update progress bar and timer labels
    (currentTime, duration) => {
      if (playerProgress && duration && !playerProgress.dataset.userSeeking) {
        playerProgress.value = (currentTime / duration) * 100;
      }
      if (playerTimeCurrent) {
        playerTimeCurrent.innerText = formatTime(currentTime);
      }
      if (playerTimeDuration) {
        playerTimeDuration.innerText = formatTime(duration || 0);
      }
    }
  );

  // Bind Seek bar input controls
  if (playerProgress) {
    playerProgress.addEventListener('mousedown', () => {
      playerProgress.dataset.userSeeking = "true";
    });
    playerProgress.addEventListener('mouseup', () => {
      delete playerProgress.dataset.userSeeking;
    });
    playerProgress.addEventListener('change', (e) => {
      const pct = parseFloat(e.target.value);
      seek(pct);
    });
    playerProgress.addEventListener('input', (e) => {
      // Smoothly update current time label while dragging
      if (playerTimeCurrent && playerProgress.dataset.userSeeking) {
        // Can estimate time visually if duration is loaded
        const pct = parseFloat(e.target.value);
        // We can't query duration directly here easily, but it's fine
      }
    });
  }

  // 2. Initialize Audio Manager (callback is now registered, so it will update initial song title)
  initAudio();

  // Apply initial volume/mute settings to UI elements
  if (playerVolumeSlider) {
    playerVolumeSlider.value = state.musicVolume;
  }

  // Bind Music controls
  if (playerBtnPlay) playerBtnPlay.addEventListener('click', togglePlay);

  const playerBtnPrev = document.getElementById('player-btn-prev');
  if (playerBtnPrev) {
    playerBtnPrev.addEventListener('click', () => {
      playPrev();
    });
  }
  
  const playerBtnNext = document.getElementById('player-btn-next');
  if (playerBtnNext) {
    playerBtnNext.addEventListener('click', () => {
      playNext();
    });
  }

  if (playerVolumeSlider) {
    playerVolumeSlider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      setVolume(vol);
    });
  }

  // Try to play immediately (some browsers may allow if cached or low volume)
  play();

  // Attempt to play on first user interaction to bypass browser autoplay blocks
  const startAudioOnInteraction = () => {
    play();
    document.body.removeEventListener('click', startAudioOnInteraction);
  };
  document.body.addEventListener('click', startAudioOnInteraction);

  // 3. Main Menu Mode Buttons
  const modeClickerBtn = document.getElementById('mode-clicker-btn');
  if (modeClickerBtn) {
    modeClickerBtn.addEventListener('click', () => {
      // Move music player under upgrades panel
      const upgradesColumn = document.getElementById('upgrades-column');
      const playerWidgetNode = document.querySelector('.music-player-widget');
      if (upgradesColumn && playerWidgetNode) {
        upgradesColumn.appendChild(playerWidgetNode);
      }

      // Transition to clicker screen
      showScreen('screen-clicker');
      // Spin up clicker tick loops and renders
      initClicker();
      // Welcome toast
      showToast('Добро пожаловать в кликер!', '❤️');
    });
  }

  // Puzzles Mode click handler - opens the selection menu
  const modePuzzlesBtn = document.getElementById('mode-puzzles-btn');
  if (modePuzzlesBtn) {
    modePuzzlesBtn.addEventListener('click', () => {
      // Move music player to mode select screen container
      const selectMenuContainer = document.querySelector('#screen-puzzle-mode-select .menu-container');
      const playerWidgetNode = document.querySelector('.music-player-widget');
      if (selectMenuContainer && playerWidgetNode) {
        selectMenuContainer.appendChild(playerWidgetNode);
      }

      // Transition to selection screen
      showScreen('screen-puzzle-mode-select');
      showToast('Выберите режим пазлов!', '🧩');
    });
  }

  // Back button on selection menu
  const btnModeSelectBack = document.getElementById('btn-mode-select-back');
  if (btnModeSelectBack) {
    btnModeSelectBack.addEventListener('click', () => {
      // Move music player back to main menu
      const menuContainerNode = document.querySelector('#screen-menu .menu-container');
      const playerWidgetNode = document.querySelector('.music-player-widget');
      if (menuContainerNode && playerWidgetNode) {
        const footerNode = document.querySelector('.menu-footer');
        if (footerNode) {
          menuContainerNode.insertBefore(playerWidgetNode, footerNode);
        } else {
          menuContainerNode.appendChild(playerWidgetNode);
        }
      }

      showScreen('screen-menu');
    });
  }

  // Play Sliding Puzzle button
  const puzzleModeSlidingBtn = document.getElementById('puzzle-mode-sliding-btn');
  if (puzzleModeSlidingBtn) {
    puzzleModeSlidingBtn.addEventListener('click', () => {
      // Move music player under sliding puzzle info panel
      const infoPanel = document.querySelector('.puzzle-info-panel');
      const playerWidgetNode = document.querySelector('.music-player-widget');
      if (infoPanel && playerWidgetNode) {
        infoPanel.appendChild(playerWidgetNode);
      }

      showScreen('screen-puzzles');
      initPuzzles();
      showToast('Играем в Пятнашки!', '🧩');
    });
  }

  // Play Jigsaw Puzzle button
  const puzzleModeJigsawBtn = document.getElementById('puzzle-mode-jigsaw-btn');
  if (puzzleModeJigsawBtn) {
    puzzleModeJigsawBtn.addEventListener('click', () => {
      // Move music player under jigsaw puzzle info panel
      const infoPanel = document.querySelector('#screen-jigsaw .puzzle-info-panel');
      const playerWidgetNode = document.querySelector('.music-player-widget');
      if (infoPanel && playerWidgetNode) {
        infoPanel.appendChild(playerWidgetNode);
      }

      showScreen('screen-jigsaw');
      initJigsaw();
      showToast('Собираем в рамку!', '🧩');
    });
  }



  // 4. Back to Main Menu Action
  const backMenuBtn = document.getElementById('btn-back-menu');
  if (backMenuBtn) {
    backMenuBtn.addEventListener('click', () => {
      // Move music player back to main menu
      const menuContainerNode = document.querySelector('.menu-container');
      const playerWidgetNode = document.querySelector('.music-player-widget');
      if (menuContainerNode && playerWidgetNode) {
        const footerNode = document.querySelector('.menu-footer');
        if (footerNode) {
          menuContainerNode.insertBefore(playerWidgetNode, footerNode);
        } else {
          menuContainerNode.appendChild(playerWidgetNode);
        }
      }

      // Clear ticker loops to save memory/processing
      destroyClicker();
      // Force state save
      saveState();
      // Route back
      showScreen('screen-menu');
    });
  }

  // 5. Hard Reset Progress button
  const resetGameBtn = document.getElementById('btn-reset-game');
  if (resetGameBtn) {
    resetGameBtn.addEventListener('click', () => {
      const confirmReset = confirm('Вы уверены, что хотите сбросить весь прогресс? Это действие невозможно отменить.');
      if (confirmReset) {
        // Halt clicks and reset in-memory / storage models
        destroyClicker();
        resetState();
        
        // Re-initialize running clicker values on active panel
        initClicker();
        updateUI();
        
        showToast('Прогресс успешно сброшен!', '💖');
      }
    });
  }

  // Setup theme toggle based on system settings initially (or default light)
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // Optionally enable dark mode variable styling:
    // document.documentElement.setAttribute('data-theme', 'dark');
  }

  console.log('Clickpazzles initialized successfully.');
});
