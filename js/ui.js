/**
 * Clickpazzles - UI Controller
 * Manages view routing, number formatting, and utility UI triggers like Toast notifications.
 */

/**
 * Changes the active screen with a transition.
 * @param {string} screenId The DOM ID of the screen to show.
 */
export function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    screen.classList.remove('active');
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  } else {
    console.error(`Screen with ID "${screenId}" not found.`);
  }
}

/**
 * Formats a number with comma separators or scientific suffixes (K, M, B) for clean display.
 * @param {number} value
 * @returns {string} Formatted number string
 */
export function formatNumber(value) {
  if (value === null || value === undefined) return '0';
  
  if (value < 1000) {
    // Return integer, or up to 1 decimal if float
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  }
  
  if (value < 1000000) {
    const kVal = value / 1000;
    return (Number.isInteger(kVal) ? kVal.toFixed(0) : kVal.toFixed(1)) + 'K';
  }
  
  if (value < 1000000000) {
    return (value / 1000000).toFixed(2) + 'M';
  }
  
  return (value / 1000000000).toFixed(2) + 'B';
}

/**
 * Spawns a floating cute toast notification at the bottom left.
 * @param {string} message Text to display
 * @param {string} emoji Emoji to display alongside message
 */
export function showToast(message, emoji = '❤️') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${emoji}</span> <span>${message}</span>`;
  
  container.appendChild(toast);

  // Automatically fade out and remove after some time
  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 2700);
}
