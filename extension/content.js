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

function showOverlay(reason) {
  const overlay = document.createElement('div');
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

const site = window.location.hostname;
const title = document.title || '';
const pageSignal = `${site} ${title}`;
const learningIntent = looksLikeLearningIntent(pageSignal);

chrome.runtime.sendMessage({
  type: 'context_signal',
  site,
  title
});

fetch('http://localhost:8081/status')
  .then((response) => response.json())
  .then((data) => {
    if (data.lockActive) {
      chrome.runtime.sendMessage({ type: 'hit_distraction', site, title });
      showOverlay('Autonomous focus sprint is active. Return to your task.');
      return;
    }

    if (data.focusMode && !learningIntent) {
      chrome.runtime.sendMessage({ type: 'hit_distraction', site, title });
      showOverlay('You are in focus mode. Please return to work.');
    }
  })
  .catch(() => {
    // Desktop app may be off, do nothing.
  });