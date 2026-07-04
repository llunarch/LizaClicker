/**
 * Clickpazzles - Confetti Animation Utility
 * A lightweight canvas-based confetti particle system for victory celebrations.
 */

let animationFrameId = null;
let particles = [];
const colors = ['#FFB7C5', '#FF7E9F', '#D94B68', '#E2D4F7', '#FFD700', '#87CEFA', '#98FB98'];

/**
 * Starts the confetti animation.
 */
export function startConfetti() {
  const canvas = document.getElementById('victory-confetti');
  if (!canvas) return;

  canvas.classList.remove('hidden');
  const ctx = canvas.getContext('2d');

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  particles = [];
  const particleCount = 150;

  // Generate confetti particles
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height - 20, // Start above the screen
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedX: Math.random() * 4 - 2,
      speedY: Math.random() * 3 + 2,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 4 - 2,
      oscillation: Math.random() * 0.1 + 0.05,
      oscillationSpeed: Math.random() * 0.03 + 0.01
    });
  }

  const duration = 5000; // Animate for 5 seconds
  const startTime = Date.now();

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const elapsed = Date.now() - startTime;
    if (elapsed > duration) {
      stopConfetti();
      return;
    }

    let active = false;
    particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX + Math.sin(p.y * p.oscillation) * 0.5;
      p.rotation += p.rotationSpeed;

      // Draw particle as a rotating ribbon
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();

      if (p.y < canvas.height) {
        active = true;
      }
    });

    if (active) {
      animationFrameId = requestAnimationFrame(update);
    } else {
      stopConfetti();
    }
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  animationFrameId = requestAnimationFrame(update);
}

/**
 * Stops the confetti animation.
 */
export function stopConfetti() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  const canvas = document.getElementById('victory-confetti');
  if (canvas) {
    canvas.classList.add('hidden');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
