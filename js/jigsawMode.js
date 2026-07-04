/**
 * Clickpazzles - Jigsaw Mode Controller
 * Handles assembly from scratch puzzle rendering, logic, tray randomizations, timer,
 * placed counter, custom mouse & touch hold-to-drag, click-to-place, and level unlocks (3x3, 4x4, 5x5).
 */

import { state, saveState } from './state.js';
import { showScreen, showToast } from './ui.js';
import { startConfetti } from './confetti.js';

// Level configurations (Images from Pazzles folder)
export const JIGSAW_LEVELS = {
  1: { level: 1, gridSize: 3, image: 'Pazzles/Pazzle1.jpg', name: 'Легкий (3x3)' },
  2: { level: 2, gridSize: 4, image: 'Pazzles/Pazzle2.jpg', name: 'Средний (4x4)' },
  3: { level: 3, gridSize: 5, image: 'Pazzles/Pazzle3.jpg', name: 'Сложный (5x5)' }
};

let currentLevel = 1;
let gridSize = 3;
let imageSrc = '';
let pieces = [];
let secondsElapsed = 0;
let timerInterval = null;
let isGameActive = false;
let boardWidth = 400;
let boardHeight = 400;
let selectedPieceId = null;

// DOM references cache
const elements = {
  board: null,
  tray: null,
  placedCounter: null,
  timer: null,
  difficultyText: null,
  referenceImage: null,
  backBtn: null,
  resetBtn: null,
  levelButtons: []
};

let jigsawInitialized = false;

/**
 * Initializes Jigsaw mode.
 */
export function initJigsaw() {
  // Cache DOM references
  elements.board = document.getElementById('jigsaw-board');
  elements.tray = document.getElementById('jigsaw-tray');
  elements.placedCounter = document.getElementById('jigsaw-placed-counter');
  elements.timer = document.getElementById('jigsaw-timer');
  elements.difficultyText = document.getElementById('jigsaw-difficulty-text');
  elements.referenceImage = document.getElementById('jigsaw-reference-image');
  
  elements.backBtn = document.getElementById('btn-jigsaw-back');
  elements.resetBtn = document.getElementById('btn-jigsaw-reset');
  
  elements.levelButtons = Array.from(document.querySelectorAll('.btn-jigsaw-level-select'));

  // Bind controls once
  if (!jigsawInitialized) {
    if (elements.backBtn) {
      elements.backBtn.addEventListener('click', exitToSelectionScreen);
    }
    
    if (elements.resetBtn) {
      elements.resetBtn.addEventListener('click', () => {
        startJigsawLevel(currentLevel, true); // force scrambled play on reset
      });
    }

    const btnJigsawNext = document.getElementById('btn-jigsaw-next');
    if (btnJigsawNext) {
      btnJigsawNext.addEventListener('click', nextLevel);
    }

    // Level selector buttons
    elements.levelButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const lvl = parseInt(btn.dataset.level);
        if (lvl <= (state.highestJigsawLevel || 1)) {
          startJigsawLevel(lvl);
        } else {
          showToast('Этот уровень заблокирован! Пройдите предыдущие уровни.', '🔒');
        }
      });
    });

    jigsawInitialized = true;
  }

  // Load from persistent highest jigsaw level
  const initialLevel = Math.min(state.highestJigsawLevel || 1, 3);
  startJigsawLevel(initialLevel);
}

/**
 * Starts a specific jigsaw level.
 * @param {number} levelNum Level index (1-3)
 */
export function startJigsawLevel(levelNum, forcePlay = false) {
  currentLevel = levelNum;
  const config = JIGSAW_LEVELS[levelNum] || JIGSAW_LEVELS[1];
  gridSize = config.gridSize;
  imageSrc = config.image;
  selectedPieceId = null;
  isGameActive = false;
  
  stopTimer();
  secondsElapsed = 0;
  if (elements.timer) elements.timer.innerText = '0:00';
  if (elements.placedCounter) elements.placedCounter.innerText = `0 / ${gridSize * gridSize}`;
  
  updateLevelSelectorButtons();

  if (elements.difficultyText) {
    elements.difficultyText.innerText = config.name;
  }
  if (elements.referenceImage) {
    elements.referenceImage.src = config.image;
  }

  // Hide inline victory panel on level load
  const victoryInline = document.getElementById('jigsaw-victory-inline');
  if (victoryInline) {
    victoryInline.classList.add('hidden');
  }

  // Reset instruction & tray display styles
  const instruction = document.querySelector('.jigsaw-instruction');
  if (instruction) instruction.style.display = '';
  if (elements.tray) elements.tray.style.display = '';

  const solvedGallery = levelNum < (state.highestJigsawLevel || 1) && !forcePlay;

  // If viewing completed in gallery, hide instruction & tray
  if (solvedGallery) {
    if (instruction) instruction.style.display = 'none';
    if (elements.tray) elements.tray.style.display = 'none';
  }

  // Pre-load image to get natural aspect ratio for sizing
  const img = new Image();
  img.onload = () => {
    setupBoardSize(img.naturalWidth, img.naturalHeight);
    generateAndScramblePieces(solvedGallery);
    
    if (!solvedGallery) {
      isGameActive = true;
      startTimer();
    }
  };
  img.src = imageSrc;
}

/**
 * Sizes the jigsaw board container based on aspect ratio.
 */
function setupBoardSize(imgWidth, imgHeight) {
  const maxBoardSize = 420;
  if (imgWidth >= imgHeight) {
    boardWidth = maxBoardSize;
    boardHeight = maxBoardSize * (imgHeight / imgWidth);
  } else {
    boardHeight = maxBoardSize;
    boardWidth = maxBoardSize * (imgWidth / imgHeight);
  }

  if (elements.board) {
    elements.board.style.width = `${boardWidth}px`;
    elements.board.style.height = `${boardHeight}px`;
  }
}

/**
 * Generates grid slot targets on the board and shuffles pieces into the tray.
 * Sets up the hold-to-drag mouse and touch mechanics.
 */
function generateAndScramblePieces(solvedGallery) {
  if (!elements.board || !elements.tray) return;
  
  elements.board.innerHTML = '';
  elements.tray.innerHTML = '';
  elements.board.classList.remove('puzzle-complete');

  const pieceWidth = boardWidth / gridSize;
  const pieceHeight = boardHeight / gridSize;
  const totalPieces = gridSize * gridSize;

  pieces = [];

  // 1. Create target slot cells on the board
  const cells = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement('div');
      cell.className = 'jigsaw-grid-cell';
      cell.style.width = `${pieceWidth}px`;
      cell.style.height = `${pieceHeight}px`;
      cell.style.left = `${c * pieceWidth}px`;
      cell.style.top = `${r * pieceHeight}px`;
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Click cell to place selected piece
      cell.addEventListener('click', () => {
        if (!isGameActive) return;
        if (selectedPieceId !== null) {
          const selectedPiece = pieces.find(x => x.id === selectedPieceId);
          if (selectedPiece) {
            placePieceInCell(selectedPiece, r, c, cell);
          }
        }
      });

      elements.board.appendChild(cell);
      cells.push(cell);
    }
  }

  // 2. Generate piece objects
  for (let i = 0; i < totalPieces; i++) {
    const r = Math.floor(i / gridSize);
    const c = i % gridSize;

    const pieceDiv = document.createElement('div');
    pieceDiv.className = 'puzzle-piece';
    pieceDiv.style.width = `${pieceWidth}px`;
    pieceDiv.style.height = `${pieceHeight}px`;
    pieceDiv.style.backgroundImage = `url(${imageSrc})`;
    pieceDiv.style.backgroundSize = `${boardWidth}px ${boardHeight}px`;
    pieceDiv.style.backgroundPosition = `-${c * pieceWidth}px -${r * pieceHeight}px`;

    const piece = {
      id: i,
      row: r,
      col: c,
      placed: solvedGallery,
      placedRow: solvedGallery ? r : null,
      placedCol: solvedGallery ? c : null,
      element: pieceDiv
    };

    if (solvedGallery) {
      // Place directly in target cell
      pieceDiv.style.position = 'absolute';
      pieceDiv.style.left = '0';
      pieceDiv.style.top = '0';
      pieceDiv.style.margin = '0';
      pieceDiv.style.cursor = 'default';
      
      const targetCell = cells.find(cell => parseInt(cell.dataset.row) === r && parseInt(cell.dataset.col) === c);
      if (targetCell) {
        targetCell.appendChild(pieceDiv);
      }
    } else {
      // Unified mouse/touch hold-to-drag handlers
      const onStartDrag = (e) => {
        if (!isGameActive) return;
        
        // If mouse event, verify it is left click
        if (e.type === 'mousedown' && e.button !== 0) return;
        
        const isTouch = e.type === 'touchstart';
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;
        
        const startX = clientX;
        const startY = clientY;
        const rect = pieceDiv.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;
        
        let dragged = false;

        // Make piece absolute fixed so it drags across the whole page smoothly
        pieceDiv.style.transition = 'none';
        pieceDiv.style.pointerEvents = 'none';
        pieceDiv.style.position = 'fixed';
        pieceDiv.style.width = `${rect.width}px`;
        pieceDiv.style.height = `${rect.height}px`;
        pieceDiv.style.left = `${rect.left}px`;
        pieceDiv.style.top = `${rect.top}px`;
        pieceDiv.style.zIndex = '999999';
        document.body.appendChild(pieceDiv);

        const onMoveDrag = (moveEvent) => {
          if (moveEvent.type === 'touchmove') {
            moveEvent.preventDefault(); // Stop window scroll
          }
          
          const moveX = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientX : moveEvent.clientX;
          const moveY = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientY : moveEvent.clientY;
          
          const dx = moveX - startX;
          const dy = moveY - startY;
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            dragged = true;
          }

          pieceDiv.style.left = `${moveX - offsetX}px`;
          pieceDiv.style.top = `${moveY - offsetY}px`;
        };

        const onEndDrag = (endEvent) => {
          document.removeEventListener('mousemove', onMoveDrag);
          document.removeEventListener('mouseup', onEndDrag);
          document.removeEventListener('touchmove', onMoveDrag, { passive: false });
          document.removeEventListener('touchend', onEndDrag);

          const endX = endEvent.type === 'touchend' 
            ? (endEvent.changedTouches ? endEvent.changedTouches[0].clientX : clientX)
            : endEvent.clientX;
          const endY = endEvent.type === 'touchend' 
            ? (endEvent.changedTouches ? endEvent.changedTouches[0].clientY : clientY)
            : endEvent.clientY;

          // Query target under cursor BEFORE resetting pointer-events to auto
          const dropTarget = document.elementFromPoint(endX, endY);

          pieceDiv.style.pointerEvents = 'auto';
          pieceDiv.style.zIndex = '';
          pieceDiv.style.transition = ''; // Restore transition for smooth snapping/returning

          if (!dragged) {
            // It was a simple click!
            if (piece.placed) {
              // Placed on board -> Click to return back to tray!
              returnToTray(piece);
              updatePlacedCounter();
            } else {
              // In the tray -> Click selection
              togglePieceSelection(piece);
            }
            return;
          }

          // Check if dropped back into the scattered tray area
          const inTray = dropTarget ? dropTarget.closest('#jigsaw-tray') || dropTarget.closest('.jigsaw-tray-container') : false;

          if (inTray) {
            if (piece.placed) {
              returnToTray(piece);
              updatePlacedCounter();
              playSnapSound();
            } else {
              returnToTray(piece); // Reset styles
            }
            return;
          }

          // Drag Drop Placement logic
          let cellElement = null;
          if (dropTarget) {
            cellElement = dropTarget.closest('.jigsaw-grid-cell');
          }

          if (cellElement) {
            const targetR = parseInt(cellElement.dataset.row);
            const targetC = parseInt(cellElement.dataset.col);
            placePieceInCell(piece, targetR, targetC, cellElement);
          } else {
            // Dropped outside grid -> Return back to its starting state
            if (piece.placed) {
              const cell = elements.board.querySelector(`.jigsaw-grid-cell[data-row="${piece.placedRow}"][data-col="${piece.placedCol}"]`);
              if (cell) {
                pieceDiv.style.position = 'absolute';
                pieceDiv.style.left = '0';
                pieceDiv.style.top = '0';
                cell.appendChild(pieceDiv);
              } else {
                returnToTray(piece);
                updatePlacedCounter();
              }
            } else {
              returnToTray(piece);
            }
          }
        };

        document.addEventListener('mousemove', onMoveDrag);
        document.addEventListener('mouseup', onEndDrag);
        document.addEventListener('touchmove', onMoveDrag, { passive: false });
        document.addEventListener('touchend', onEndDrag);
      };

      pieceDiv.addEventListener('mousedown', onStartDrag);
      pieceDiv.addEventListener('touchstart', onStartDrag, { passive: true });
    }

    pieces.push(piece);
  }

  if (solvedGallery) {
    if (elements.placedCounter) {
      elements.placedCounter.innerText = `${totalPieces} / ${totalPieces}`;
    }
  } else {
    // 3. Shuffle piece objects and append to the tray
    const shuffledPieces = [...pieces];
    for (let i = shuffledPieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPieces[i], shuffledPieces[j]] = [shuffledPieces[j], shuffledPieces[i]];
    }

    shuffledPieces.forEach(p => {
      elements.tray.appendChild(p.element);
    });

    if (elements.placedCounter) {
      elements.placedCounter.innerText = `0 / ${totalPieces}`;
    }
  }
}

/**
 * Toggles piece selection style in the tray for click-to-place action.
 */
function togglePieceSelection(piece) {
  if (selectedPieceId === piece.id) {
    piece.element.classList.remove('selected');
    selectedPieceId = null;
  } else {
    const prevSelected = elements.tray.querySelector('.puzzle-piece.selected');
    if (prevSelected) {
      prevSelected.classList.remove('selected');
    }
    piece.element.classList.add('selected');
    selectedPieceId = piece.id;
  }
}

/**
 * Places a piece into a specific grid cell on the board.
 * Returns the existing occupant of that cell to the tray if present.
 */
function placePieceInCell(piece, targetRow, targetCol, cellElement) {
  // 1. Check if another piece is already in this slot
  const existingPiece = pieces.find(p => p.placed && p.placedRow === targetRow && p.placedCol === targetCol);
  if (existingPiece && existingPiece !== piece) {
    returnToTray(existingPiece);
  }

  // 2. Set placement coordinates
  piece.placed = true;
  piece.placedRow = targetRow;
  piece.placedCol = targetCol;

  // 3. Update styling
  const pieceDiv = piece.element;
  pieceDiv.style.position = 'absolute';
  pieceDiv.style.left = '0';
  pieceDiv.style.top = '0';
  pieceDiv.style.margin = '0';
  pieceDiv.classList.remove('selected');

  // Move DOM node directly to cellElement (keeps event listeners intact)
  cellElement.appendChild(pieceDiv);

  selectedPieceId = null;
  playSnapSound();
  updatePlacedCounter();

  // 4. Check victory condition
  if (checkWinState()) {
    handleVictory();
  }
}

/**
 * Returns a placed piece back to the scattered tray.
 */
function returnToTray(piece) {
  piece.placed = false;
  piece.placedRow = null;
  piece.placedCol = null;

  const pieceDiv = piece.element;
  pieceDiv.style.position = 'relative';
  pieceDiv.style.left = 'auto';
  pieceDiv.style.top = 'auto';
  pieceDiv.style.margin = '0';
  pieceDiv.classList.remove('selected');
  pieceDiv.style.cursor = 'pointer';

  elements.tray.appendChild(pieceDiv);
}

/**
 * Updates the counter showing how many pieces have been placed.
 */
function updatePlacedCounter() {
  const count = pieces.filter(p => p.placed).length;
  if (elements.placedCounter) {
    elements.placedCounter.innerText = `${count} / ${pieces.length}`;
  }
}

/**
 * Checks if the board state is winning.
 * Wins if all pieces are placed and are in their correct target cells.
 */
function checkWinState() {
  const allPlaced = pieces.every(p => p.placed);
  if (!allPlaced) return false;

  const allCorrect = pieces.every(p => p.placedRow === p.row && p.placedCol === p.col);
  return allCorrect;
}

/**
 * Triggers victory sequence.
 */
function handleVictory() {
  isGameActive = false;
  stopTimer();
  playWinBeeps();
  startConfetti();

  if (elements.board) {
    elements.board.classList.add('puzzle-complete');
  }

  // Update persistent jigsaw progression state
  const nextLvl = currentLevel + 1;
  if (nextLvl <= 3) {
    state.highestJigsawLevel = Math.max(state.highestJigsawLevel || 1, nextLvl);
    saveState();
  }

  // Update inline victory panel action
  const btnJigsawNext = document.getElementById('btn-jigsaw-next');
  if (btnJigsawNext) {
    if (currentLevel < 3) {
      btnJigsawNext.innerText = 'Далее';
    } else {
      btnJigsawNext.innerText = 'Пройти сначала 🔄';
    }
  }

  // Hide instructions and tray when puzzle is completed, to make room for inline victory panel
  const instruction = document.querySelector('.jigsaw-instruction');
  if (instruction) instruction.style.display = 'none';
  if (elements.tray) elements.tray.style.display = 'none';

  const victoryInline = document.getElementById('jigsaw-victory-inline');
  if (victoryInline) {
    victoryInline.classList.remove('hidden');
  }
}

/**
 * Exit routines.
 */
export function exitToMainMenu() {
  stopTimer();

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
}

export function exitToSelectionScreen() {
  stopTimer();

  const menuContainerNode = document.querySelector('#screen-puzzle-mode-select .menu-container');
  const playerWidgetNode = document.querySelector('.music-player-widget');
  if (menuContainerNode && playerWidgetNode) {
    menuContainerNode.appendChild(playerWidgetNode);
  }

  showScreen('screen-puzzle-mode-select');
}

export function nextLevel() {
  if (currentLevel < 3) {
    startJigsawLevel(currentLevel + 1);
  } else {
    startJigsawLevel(1);
  }
}

/**
 * Updates UI level selection locks and active classes.
 */
function updateLevelSelectorButtons() {
  elements.levelButtons.forEach(btn => {
    const lvl = parseInt(btn.dataset.level);
    btn.classList.remove('active', 'btn-primary');
    btn.classList.add('btn-secondary');
    
    const label = lvl === 1 ? '1 уровень (3x3)' : (lvl === 2 ? '2 уровень (4x4)' : '3 уровень (5x5)');
    if (lvl > (state.highestJigsawLevel || 1)) {
      btn.innerText = `🔒 ${label}`;
      btn.style.opacity = '0.6';
    } else {
      btn.innerText = label;
      btn.style.opacity = '1.0';
    }

    if (lvl === currentLevel) {
      btn.classList.add('active');
      btn.classList.remove('btn-secondary');
    }
  });
}

/**
 * Stopwatch timer routines.
 */
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    secondsElapsed++;
    updateTimerUI();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/**
 * Updates stopwatch DOM content.
 */
function updateTimerUI() {
  const minutes = Math.floor(secondsElapsed / 60);
  const seconds = secondsElapsed % 60;
  const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  if (elements.timer) {
    elements.timer.innerText = timeStr;
  }
}

/**
 * Audio synthesizers.
 */
function playSnapSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {
    console.warn('Audio click failed:', e);
  }
}

function playWinBeeps() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playNote = (freq, delay, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    };
    
    playNote(392.00, 0.0, 0.25); // G4
    playNote(523.25, 0.1, 0.25); // C5
    playNote(659.25, 0.2, 0.25); // E5
    playNote(783.99, 0.3, 0.5);  // G5
  } catch (e) {
    console.warn('Audio win beeps failed:', e);
  }
}
