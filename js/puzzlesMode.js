/**
 * Clickpazzles - Puzzles Mode Controller
 * Handles sliding puzzle rendering, logic, shuffles, timer, moves counter,
 * and level progression (3x3, 4x4, 5x5).
 */

import { state, saveState } from './state.js';
import { showScreen, showToast } from './ui.js';
import { startConfetti } from './confetti.js';

// Level configurations
export const PUZZLES_LEVELS = {
  1: { level: 1, gridSize: 3, image: 'Pazzles/Pazzle1.jpg', name: 'Легкий (3x3)' },
  2: { level: 2, gridSize: 4, image: 'Pazzles/Pazzle2.jpg', name: 'Средний (4x4)' },
  3: { level: 3, gridSize: 5, image: 'Pazzles/Pazzle3.jpg', name: 'Сложный (5x5)' }
};

let currentLevel = 1;
let gridSize = 3;
let imageSrc = '';
let pieces = [];
let emptyCell = null;
let moves = 0;
let secondsElapsed = 0;
let timerInterval = null;
let isGameActive = false;
let boardWidth = 400;
let boardHeight = 400;

// DOM references cache
const elements = {
  board: null,
  movesCounter: null,
  timer: null,
  difficultyText: null,
  referenceImage: null,
  backBtn: null,
  resetBtn: null,
  levelButtons: []
};

let puzzlesInitialized = false;

/**
 * Initializes the Puzzles mode elements and event handlers.
 */
export function initPuzzles() {
  // Cache DOM elements
  elements.board = document.getElementById('puzzle-board');
  elements.movesCounter = document.getElementById('puzzle-moves-counter');
  elements.timer = document.getElementById('puzzle-timer');
  elements.difficultyText = document.getElementById('puzzle-difficulty-text');
  elements.referenceImage = document.getElementById('puzzle-reference-image');
  
  elements.backBtn = document.getElementById('btn-puzzles-back');
  elements.resetBtn = document.getElementById('btn-puzzles-reset');
  
  elements.levelButtons = Array.from(document.querySelectorAll('.btn-level-select'));

  // Only bind events once
  if (!puzzlesInitialized) {
    // Bind controls
    if (elements.backBtn) {
      elements.backBtn.addEventListener('click', exitToSelectionScreen);
    }
    
    if (elements.resetBtn) {
      elements.resetBtn.addEventListener('click', () => {
        startPuzzleLevel(currentLevel, true); // force scramble play on reset
      });
    }

    const btnSlidingNext = document.getElementById('btn-sliding-next');
    if (btnSlidingNext) {
      btnSlidingNext.addEventListener('click', nextLevel);
    }

    // Level selector buttons
    elements.levelButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lvl = parseInt(btn.dataset.level);
        if (lvl <= (state.highestPuzzleLevel || 1)) {
          startPuzzleLevel(lvl);
        } else {
          showToast('Этот уровень заблокирован! Пройдите предыдущие уровни.', '🔒');
        }
      });
    });

    puzzlesInitialized = true;
  }

  // Start with the player's highest unlocked level (up to 3)
  const initialLevel = Math.min(state.highestPuzzleLevel || 1, 3);
  startPuzzleLevel(initialLevel);
}

/**
 * Loads and starts a specific puzzle level.
 * @param {number} levelNum Level index (1-3)
 */
export function startPuzzleLevel(levelNum, forcePlay = false) {
  currentLevel = levelNum;
  const config = PUZZLES_LEVELS[levelNum] || PUZZLES_LEVELS[1];
  gridSize = config.gridSize;
  imageSrc = config.image;
  moves = 0;
  isGameActive = false;
  
  stopTimer();
  secondsElapsed = 0;
  if (elements.timer) elements.timer.innerText = '0:00';
  if (elements.movesCounter) elements.movesCounter.innerText = '0';

  // Hide inline victory panel
  const victoryInline = document.getElementById('sliding-victory-inline');
  if (victoryInline) {
    victoryInline.classList.add('hidden');
  }
  
  // Highlight active level button and update locks
  updateLevelSelectorButtons();

  if (elements.difficultyText) {
    elements.difficultyText.innerText = config.name;
  }
  if (elements.referenceImage) {
    elements.referenceImage.src = config.image;
  }

  // Solved Gallery Mode: show solved if level is already completed, unless forcePlay is true
  const solvedGallery = levelNum < (state.highestPuzzleLevel || 1) && !forcePlay;

  // Pre-load image to get natural aspect ratio for board sizing
  const img = new Image();
  img.onload = () => {
    setupBoardSize(img.naturalWidth, img.naturalHeight);
    generatePuzzlePieces();
    if (!solvedGallery) {
      shuffleBoard();
      isGameActive = true;
      startTimer();
    }
    initBoard();
  };
  img.src = imageSrc;
}

/**
 * Sizes the puzzle board container to match the aspect ratio of the image.
 */
function setupBoardSize(imgWidth, imgHeight) {
  const maxBoardSize = 420; // maximum width or height in px
  
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
 * Generates the piece objects based on grid size.
 */
function generatePuzzlePieces() {
  pieces = [];
  const totalPieces = gridSize * gridSize;
  
  for (let i = 0; i < totalPieces; i++) {
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    
    const piece = {
      id: i,
      row: row,
      col: col,
      targetRow: row,
      targetCol: col,
      isEmpty: i === totalPieces - 1 // Last piece is the empty cell
    };
    
    pieces.push(piece);
    if (piece.isEmpty) {
      emptyCell = piece;
    }
  }
}

/**
 * Gets pieces adjacent to the empty cell.
 */
function getAdjacentPieces() {
  const emptyRow = emptyCell.row;
  const emptyCol = emptyCell.col;
  
  return pieces.filter(p => {
    if (p.isEmpty) return false;
    const dRow = Math.abs(p.row - emptyRow);
    const dCol = Math.abs(p.col - emptyCol);
    return (dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1);
  });
}

/**
 * Shuffles the puzzle board by making random valid moves.
 * This guarantees the resulting puzzle is solvable.
 */
function shuffleBoard() {
  let prevPiece = null;
  // Shuffling steps relative to grid size for thorough scramble
  const scrambleSteps = gridSize * 150;
  
  for (let i = 0; i < scrambleSteps; i++) {
    const adjacent = getAdjacentPieces();
    // Exclude the recently moved piece if possible to avoid redundant back-and-forth
    const candidates = adjacent.filter(p => p !== prevPiece);
    const chosen = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : adjacent[Math.floor(Math.random() * adjacent.length)];
      
    // Swap grid coordinates
    const tempRow = chosen.row;
    const tempCol = chosen.col;
    
    chosen.row = emptyCell.row;
    chosen.col = emptyCell.col;
    
    emptyCell.row = tempRow;
    emptyCell.col = tempCol;
    
    prevPiece = chosen;
  }
}

/**
 * Clears and draws the puzzle board pieces initially.
 */
function initBoard() {
  if (!elements.board) return;
  elements.board.innerHTML = '';

  const pieceWidth = boardWidth / gridSize;
  const pieceHeight = boardHeight / gridSize;

  // Check if we are drawing the solved gallery
  const isSolvedGallery = !isGameActive && checkWinState();

  pieces.forEach(p => {
    const pieceDiv = document.createElement('div');
    pieceDiv.className = 'puzzle-piece';
    if (p.isEmpty && !isSolvedGallery) {
      pieceDiv.classList.add('empty-cell');
    }
    
    // Size and absolute placement inside board
    pieceDiv.style.width = `${pieceWidth}px`;
    pieceDiv.style.height = `${pieceHeight}px`;
    pieceDiv.style.left = `${p.col * pieceWidth}px`;
    pieceDiv.style.top = `${p.row * pieceHeight}px`;
    
    p.element = pieceDiv;

    // Background image segment
    if (!p.isEmpty || isSolvedGallery) {
      pieceDiv.style.backgroundImage = `url(${imageSrc})`;
      pieceDiv.style.backgroundSize = `${boardWidth}px ${boardHeight}px`;
      pieceDiv.style.backgroundPosition = `-${p.targetCol * pieceWidth}px -${p.targetRow * pieceHeight}px`;
      
      if (!isSolvedGallery) {
        // Make clickable
        pieceDiv.addEventListener('click', () => {
          handlePieceClick(p);
        });

        // Make draggable
        pieceDiv.draggable = true;
        pieceDiv.addEventListener('dragstart', (e) => {
          if (!isGameActive) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData('text/plain', p.id);
          setTimeout(() => pieceDiv.style.opacity = '0.5', 0);
        });
        pieceDiv.addEventListener('dragend', () => {
          pieceDiv.style.opacity = '1';
        });
      }
    } else {
      // Empty cell is the drop target
      pieceDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      pieceDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!isGameActive) return;
        const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
        const draggedPiece = pieces.find(x => x.id === draggedId);
        if (draggedPiece) {
          handlePieceClick(draggedPiece);
        }
      });
    }

    elements.board.appendChild(pieceDiv);
  });
}

/**
 * Updates the coordinates of existing pieces to trigger CSS transitions smoothly.
 */
function updateBoard() {
  const pieceWidth = boardWidth / gridSize;
  const pieceHeight = boardHeight / gridSize;

  pieces.forEach(p => {
    if (p.element) {
      p.element.style.left = `${p.col * pieceWidth}px`;
      p.element.style.top = `${p.row * pieceHeight}px`;
    }
  });
}

/**
 * Handles sliding click action on a piece.
 * @param {Object} clickedPiece 
 */
function handlePieceClick(clickedPiece) {
  if (!isGameActive) return;

  const emptyRow = emptyCell.row;
  const emptyCol = emptyCell.col;
  const dRow = Math.abs(clickedPiece.row - emptyRow);
  const dCol = Math.abs(clickedPiece.col - emptyCol);

  // Check if adjacent (exactly 1 unit away orthogonally)
  if ((dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1)) {
    // Swap positions
    const tempRow = clickedPiece.row;
    const tempCol = clickedPiece.col;

    clickedPiece.row = emptyRow;
    clickedPiece.col = emptyCol;

    emptyCell.row = tempRow;
    emptyCell.col = tempCol;

    moves++;
    if (elements.movesCounter) {
      elements.movesCounter.innerText = moves;
    }

    // Redraw using smooth CSS transitions
    updateBoard();

    // Verify victory
    if (checkWinState()) {
      handleVictory();
    }
  }
}

/**
 * Checks if every piece is at its target row and column.
 */
function checkWinState() {
  return pieces.every(p => p.row === p.targetRow && p.col === p.targetCol);
}

/**
 * Executes operations on level completion.
 */
function handleVictory() {
  isGameActive = false;
  stopTimer();
  playWinBeeps();
  startConfetti();

  // Highlight board with victory flash and show full image
  if (elements.board) {
    elements.board.classList.add('puzzle-complete');
  }

  // Reveal the hidden final tile to form the complete picture
  const emptyDiv = document.querySelector('.empty-cell');
  if (emptyDiv) {
    const pieceWidth = boardWidth / gridSize;
    const pieceHeight = boardHeight / gridSize;
    emptyDiv.style.backgroundImage = `url(${imageSrc})`;
    emptyDiv.style.backgroundSize = `${boardWidth}px ${boardHeight}px`;
    emptyDiv.style.backgroundPosition = `-${emptyCell.targetCol * pieceWidth}px -${emptyCell.targetRow * pieceHeight}px`;
    emptyDiv.classList.remove('empty-cell');
  }

  // Update persistent state progression
  const nextLvl = currentLevel + 1;
  if (nextLvl <= 3) {
    state.highestPuzzleLevel = Math.max(state.highestPuzzleLevel || 1, nextLvl);
    saveState();
  }

  // Update inline victory panel action
  const btnSlidingNext = document.getElementById('btn-sliding-next');
  if (btnSlidingNext) {
    if (currentLevel < 3) {
      btnSlidingNext.innerText = 'Далее';
    } else {
      btnSlidingNext.innerText = 'Пройти сначала 🔄';
    }
  }

  const victoryInline = document.getElementById('sliding-victory-inline');
  if (victoryInline) {
    victoryInline.classList.remove('hidden');
  }
}

/**
 * Updates CSS classes on level selector buttons.
 */
function updateLevelSelectorButtons() {
  elements.levelButtons.forEach(btn => {
    const lvl = parseInt(btn.dataset.level);
    
    // Reset classes
    btn.classList.remove('active', 'btn-primary');
    btn.classList.add('btn-secondary');
    
    // Add locked label if not unlocked yet
    const label = lvl === 1 ? '1 уровень (3x3)' : (lvl === 2 ? '2 уровень (4x4)' : '3 уровень (5x5)');
    if (lvl > (state.highestPuzzleLevel || 1)) {
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
 * Resets timers and redirects to main menu.
 */
export function exitToMainMenu() {
  stopTimer();
  
  // Return music widget to main menu
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

/**
 * Resets timers and redirects to the puzzle mode selection screen.
 */
export function exitToSelectionScreen() {
  stopTimer();
  
  // Return music widget to selection screen menu-container
  const menuContainerNode = document.querySelector('#screen-puzzle-mode-select .menu-container');
  const playerWidgetNode = document.querySelector('.music-player-widget');
  if (menuContainerNode && playerWidgetNode) {
    menuContainerNode.appendChild(playerWidgetNode);
  }

  showScreen('screen-puzzle-mode-select');
}

/**
 * Advances to next level.
 */
export function nextLevel() {
  if (currentLevel < 3) {
    startPuzzleLevel(currentLevel + 1);
  } else {
    startPuzzleLevel(1);
  }
}

/**
 * Starts the stopwatch timer.
 */
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    secondsElapsed++;
    updateTimerUI();
  }, 1000);
}

/**
 * Stops the stopwatch timer.
 */
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
 * Synth slide sound effect
 */
function playTick() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {
    console.warn('Audio tick failed:', e);
  }
}

/**
 * Synth victory chord beeps
 */
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
