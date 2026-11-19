function isLikelyLearningContent(title = '', metadata = '') {
  const text = `${title} ${metadata}`.toLowerCase();
  const allowKeywords = ['tutorial', 'docs', 'guide', 'course', 'reference', 'api'];
  return allowKeywords.some((kw) => text.includes(kw));
}

class BlockingEngine {
  shouldBlock({ focusMode, lockActive, title, metadata }) {
    if (!focusMode && !lockActive) return { block: false, reason: 'focus-off' };
    if (lockActive) return { block: true, reason: 'lock-active', immediate: true };
    if (isLikelyLearningContent(title, metadata)) return { block: false, reason: 'learning-context' };
    return { block: true, reason: 'distracting-context', immediate: false };
  }
}

module.exports = { BlockingEngine, isLikelyLearningContent };