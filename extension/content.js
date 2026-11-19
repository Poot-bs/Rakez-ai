const LEARNING_KEYWORDS = [
  'api',
  'backend',
  'bug',
  'code',
  'debug',
  'docker',
  'express',
  'javascript',
  'langchain',
  'langgraph',
  'llama',
  'node',
  'programming',
  'python',
  'react',
  'software',
  'sql',
  'tutorial',
  'typescript',
  'vscode'
];

function looksLikeLearningIntent(text) {
  const lower = (text || '').toLowerCase();
  let score = 0;
  for (const kw of LEARNING_KEYWORDS) {
    if (lower.includes(kw)) score += 1;
  }
  return score >= 2;
}

const BLOCK_DELAY_SECONDS = 5 * 60;
let countdownTimer = null;
let countdownBanner = null;

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  if (countdownBanner) {
    countdownBanner.remove();
    countdownBanner = null;
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function showOverlay(reason) {
  if (document.getElementById('fg-block-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'fg-block-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
  overlay.style.color = 'white';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '999999';
  overlay.style.fontFamily = 'sans-serif';

  overlay.innerHTML = `
    <h1 style="color: #e94560; font-size: 3rem;">Site Blocked by Rakez Ai</h1>
    <p style="font-size: 1.5rem;">${reason}</p>
  `;

  document.body.appendChild(overlay);
}

function startCountdown() {
  if (countdownTimer || document.getElementById('fg-block-overlay')) return;

  let secondsLeft = BLOCK_DELAY_SECONDS;
  countdownBanner = document.createElement('div');
  countdownBanner.id = 'fg-warning-banner';
  countdownBanner.style.cssText = `
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 999999;
    background: rgba(0, 0, 0, 0.88);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 12px 18px;
    border-radius: 8px;
    border-left: 4px solid #5EEAD4;
    font-size: 14px;
    line-height: 1.6;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  `;

  const updateBanner = () => {
    countdownBanner.innerHTML = `
      ⚠️ <strong style="color:#5EEAD4;">Rakez AI Focus Shield</strong><br/>
      This page will be blocked in
      <strong style="color:#FBBF24; font-size:16px;">${formatTime(secondsLeft)}</strong>
    `;
  };

  updateBanner();
  document.body.appendChild(countdownBanner);

  countdownTimer = setInterval(async () => {
    secondsLeft -= 1;
    updateBanner();

    if (secondsLeft <= 60) {
      countdownBanner.style.borderLeftColor = '#FF8A8A';
    }

    if (secondsLeft <= 0) {
      clearCountdown();

      try {
        const response = await fetch('http://localhost:8081/status', { cache: 'no-store' });
        const status = await response.json();

        if (status.focusMode && !learningIntent) {
          chrome.runtime.sendMessage({ type: 'hit_distraction', site, title });
          showOverlay('You are in focus mode. Please return to work.');
        }
      } catch {
        // Desktop app may be off, do nothing.
      }
    }
  }, 1000);
}

const site = window.location.hostname;
const title = document.title || '';
const pageSignal = `${site} ${title}`;
const learningIntent = looksLikeLearningIntent(pageSignal);

chrome.runtime.sendMessage({
  type: 'context_signal',
  site,
  title
});

fetch('http://localhost:8081/status', { cache: 'no-store' })
  .then((response) => response.json())
  .then((data) => {
    if (data.lockActive) {
      clearCountdown();
      chrome.runtime.sendMessage({ type: 'hit_distraction', site, title });
      showOverlay('Autonomous focus sprint is active. Return to your task.');
      return;
    }

    if (data.focusMode && !learningIntent) {
      startCountdown();
      return;
    }

    clearCountdown();
  })
  .catch(() => {
    clearCountdown();
    // Desktop app may be off, do nothing.
  });
