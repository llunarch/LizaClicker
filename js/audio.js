/**
 * Clickpazzles - Audio Manager
 * Controls playlist playback (Plaki -> BamBam1 -> Daleko -> BamBam2 -> Loop),
 * volume configuration, mute states, and user interaction triggers.
 */

import { state, saveState } from './state.js';

// The updated track sequence representing all files in Music/
const PLAYLIST = [
  { name: 'Cirno Fumo', path: 'Music/Cirno Fumo.mp3' },
  { name: 'TOLY SUMMER - Цените жизнь', path: 'Music/TOLY SUMMER - Цените жизнь.mp3' },
  { name: 'Бэм Бэм Бэм 1', path: 'Music/Бэм Бэм Бэм 1.mp3' },
  { name: 'Бэм Бэм Бэм 2', path: 'Music/Бэм Бэм Бэм 2.mp3' },
  { name: 'Кира Бурундук - Почему', path: 'Music/Кира Бурундук - Почему.mp3' },
  { name: 'Кис-кис мяу-мяу', path: 'Music/Кис-кис мяу-мяу.mp3' },
  { name: 'Милана Хаметова - ЛП', path: 'Music/Милана Хаметова - ЛП.mp3' },
  { name: 'Плаки-плаки 2', path: 'Music/Плаки-плаки 2.mp3' },
  { name: 'Плаки-плаки', path: 'Music/Плаки-плаки.mp3' },
  { name: 'Саня хуй соси', path: 'Music/Саня хуй соси.mp3' },
  { name: '往事只能回味', path: 'Music/往事只能回味.mp3' }
];

let currentTrackIndex = 0;
let audioElement = null;
let isInitialized = false;

// Shuffle Order State
let shuffledIndices = [];
let shuffledPosition = -1;

// Event listeners list for track changes
let onTrackChangeCallback = null;
let onPlayStateChangeCallback = null;
let onTimeUpdateCallback = null;

/**
 * Generates a new random shuffle order of all tracks in the playlist.
 */
function generateNewShuffle() {
  const indices = Array.from({ length: PLAYLIST.length }, (_, i) => i);
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  shuffledIndices = indices;
  shuffledPosition = 0;
}

/**
 * Initializes the Audio element and settings.
 */
export function initAudio() {
  if (isInitialized) return;

  audioElement = new Audio();
  
  // Set initial settings from state
  audioElement.volume = state.musicMuted ? 0 : state.musicVolume;
  
  // Hook up ended event to play next track
  audioElement.addEventListener('ended', playNext);
  
  // Hook up timeupdate and loadedmetadata events
  audioElement.addEventListener('timeupdate', () => {
    if (onTimeUpdateCallback) {
      onTimeUpdateCallback(audioElement.currentTime, audioElement.duration);
    }
  });
  
  audioElement.addEventListener('loadedmetadata', () => {
    if (onTimeUpdateCallback) {
      onTimeUpdateCallback(audioElement.currentTime, audioElement.duration);
    }
  });
  
  // Generate random order and load first track
  generateNewShuffle();
  loadTrack(shuffledIndices[shuffledPosition]);

  isInitialized = true;
}

/**
 * Loads a track from the playlist by index.
 */
function loadTrack(index) {
  if (index < 0 || index >= PLAYLIST.length) return;
  currentTrackIndex = index;
  audioElement.src = PLAYLIST[index].path;
  
  // Trigger callback if defined (to update UI song title)
  if (onTrackChangeCallback) {
    onTrackChangeCallback(PLAYLIST[index].name, currentTrackIndex);
  }
}

/**
 * Starts audio playback. Returns a Promise.
 */
export function play() {
  initAudio();
  
  // Handle autoplay rules gracefully
  return audioElement.play()
    .then(() => {
      if (onPlayStateChangeCallback) onPlayStateChangeCallback(true);
    })
    .catch(e => {
      console.warn('Playback blocked by browser policy. Will play on first click.', e);
      if (onPlayStateChangeCallback) onPlayStateChangeCallback(false);
    });
}

/**
 * Pauses audio playback.
 */
export function pause() {
  if (!audioElement) return;
  audioElement.pause();
  if (onPlayStateChangeCallback) onPlayStateChangeCallback(false);
}

/**
 * Toggles playback between Play and Pause.
 */
export function togglePlay() {
  if (!audioElement) {
    play();
    return;
  }
  if (audioElement.paused) {
    play();
  } else {
    pause();
  }
}

/**
 * Plays the next song in the shuffled sequence. Reshuffles when exhausted.
 */
export function playNext() {
  initAudio();
  
  shuffledPosition++;
  if (shuffledPosition >= shuffledIndices.length) {
    // Generate new random shuffle order when all tracks played
    generateNewShuffle();
  }
  
  loadTrack(shuffledIndices[shuffledPosition]);
  play();
}

/**
 * Plays the previous song in the current shuffled sequence. Loops to last if at start.
 */
export function playPrev() {
  initAudio();
  
  if (shuffledPosition > 0) {
    shuffledPosition--;
    loadTrack(shuffledIndices[shuffledPosition]);
    play();
  } else {
    // Loop back to the end of the current shuffled sequence
    shuffledPosition = shuffledIndices.length - 1;
    loadTrack(shuffledIndices[shuffledPosition]);
    play();
  }
}

/**
 * Sets the master volume of the background music.
 * @param {number} vol Volume float between 0 and 1.
 */
export function setVolume(vol) {
  initAudio();
  // Constrain volume between 0 and 1
  const volume = Math.max(0, Math.min(1, vol));
  state.musicVolume = volume;
  saveState();

  if (!state.musicMuted) {
    audioElement.volume = volume;
  }
}

/**
 * Toggles the Muted state of the audio.
 */
export function toggleMute() {
  initAudio();
  state.musicMuted = !state.musicMuted;
  saveState();

  audioElement.volume = state.musicMuted ? 0 : state.musicVolume;
  return state.musicMuted;
}

/**
 * Checks if the player is currently playing music.
 */
export function isPlaying() {
  return audioElement && !audioElement.paused;
}

/**
 * Returns currently playing track index.
 */
export function getCurrentTrackIndex() {
  return currentTrackIndex;
}

/**
 * Returns current playlist array.
 */
export function getPlaylist() {
  return PLAYLIST;
}

/**
 * Registers callbacks for track change, play state, and playback time updates.
 */
export function registerCallbacks(onTrackChange, onPlayStateChange, onTimeUpdate) {
  onTrackChangeCallback = onTrackChange;
  onPlayStateChangeCallback = onPlayStateChange;
  onTimeUpdateCallback = onTimeUpdate;
}

/**
 * Seeks playback position to the given percentage.
 */
export function seek(percent) {
  if (!audioElement || !audioElement.duration) return;
  audioElement.currentTime = (percent / 100) * audioElement.duration;
}
