const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

const CODING_KEYWORDS = [
  'api',
  'backend',
  'bug',
  'build',
  'code',
  'commit',
  'debug',
  'deploy',
  'endpoint',
  'express',
  'feature',
  'fix',
  'function',
  'github',
  'issue',
  'javascript',
  'langchain',
  'langgraph',
  'llama',
  'node',
  'npm',
  'python',
  'react',
  'refactor',
  'server',
  'sql',
  'stack overflow',
  'terminal',
  'typescript'
];

let compiledGraph = null;

function scoreKeywords(text = '') {
  const lower = text.toLowerCase();
  if (!lower.trim()) return 0;

  let score = 0;
  for (const keyword of CODING_KEYWORDS) {
    if (lower.includes(keyword)) score += 1;
  }

  return score;
}

function inferAppType(appName = '') {
  const lower = appName.toLowerCase();

  if (lower.includes('code') || lower.includes('cursor') || lower.includes('intellij') || lower.includes('webstorm')) {
    return 'coding';
  }

  if (lower.includes('docs') || lower.includes('word') || lower.includes('notion')) {
    return 'writing';
  }

  if (lower.includes('youtube') || lower.includes('tiktok') || lower.includes('instagram') || lower.includes('facebook') || lower.includes('reddit') || lower.includes('twitter')) {
    return 'media';
  }

  return 'other';
}

function heuristicContextNode(state) {
  const latest = state.latestSignal || {};
  const title = (latest.title || '').trim();
  const appName = (latest.app || '').trim();
  const site = (latest.site || '').trim();
  const keywordScore = scoreKeywords(`${title} ${site}`);
  const appType = inferAppType(appName || site);

  let mode = 'other';
  let confidence = 0.55;

  if (appType === 'coding') {
    mode = 'coding';
    confidence = Math.min(0.9, 0.6 + keywordScore * 0.05);
  } else if (appType === 'writing') {
    mode = 'writing';
    confidence = 0.78;
  } else if (appType === 'media') {
    if (keywordScore >= 2) {
      mode = 'learning';
      confidence = 0.74;
    } else {
      mode = 'distraction';
      confidence = 0.84;
    }
  } else if (keywordScore >= 3) {
    mode = 'coding';
    confidence = 0.68;
  }

  return {
    ...state,
    context: {
      appType,
      confidence,
      keywordScore,
      mode,
      reason: `Heuristic context: app=${appType}, keywordScore=${keywordScore}`
    }
  };
}

async function llmContextRefineNode(state) {
  if (!state.model) return state;

  const latest = state.latestSignal || {};
  const prompt = [
    'Classify user work context.',
    'Return strict JSON only with keys: mode, confidence, reason.',
    'mode must be one of: coding, writing, learning, distraction, other.',
    `App: ${latest.app || 'unknown'}`,
    `Title: ${latest.title || 'unknown'}`,
    `Site: ${latest.site || 'unknown'}`,
    `Recent distract count (10 min): ${state.metrics?.recentDistractions || 0}`,
    `Current mode guess: ${state.context?.mode || 'other'}`
  ].join('\n');

  try {
    const response = await state.model.invoke(prompt);
    const text = response?.content?.toString?.() || '';
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return state;

    const payload = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const mode = ['coding', 'writing', 'learning', 'distraction', 'other'].includes(payload.mode)
      ? payload.mode
      : state.context?.mode || 'other';

    const confidence = Number(payload.confidence);

    return {
      ...state,
      context: {
        ...state.context,
        mode,
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : state.context?.confidence || 0.6,
        reason: payload.reason || state.context?.reason || 'LLM refinement unavailable'
      }
    };
  } catch (error) {
    return {
      ...state,
      context: {
        ...state.context,
        reason: `${state.context?.reason || 'Heuristic decision'} | LLM refine skipped: ${error.message}`
      }
    };
  }
}

async function interventionAgentNode(state) {
  const metrics = state.metrics || {};
  const context = state.context || {};
  const settings = state.settings || {};
  const switchThreshold = settings.switchCountThreshold || 8;
  const defaultLockMins = settings.defaultLockMinutes || 2;

  const prompt = [
    'You are an autonomous intervention agent for productivity.',
    'Return strict JSON only with keys:',
    'action, forceFocus, lockDistractions, lockMinutes, suggestMicroTask, reason, message',
    'Allowed action values: none, nudge, force_focus, block_distraction.',
    `Context mode: ${context.mode || 'other'}`,
    `Context confidence: ${context.confidence || 0.5}`,
    `Tab switches in 5 min: ${metrics.tabSwitches5m || 0}`,
    `Distractions in 10 min: ${metrics.recentDistractions || 0}`,
    `Current focus active: ${metrics.focusActive ? 'true' : 'false'}`,
    `Stuck signals in 10 min: ${metrics.stuckSignals10m || 0}`,
    'Policy hints:',
    '- If user appears stuck (many switches) => nudge or force_focus.',
    '- If clear distraction and confidence high => lockDistractions true.',
    `- lockMinutes should be 2 or 5 at most (default ${defaultLockMins}).`,
    '- suggestMicroTask true when stuck or procrastinating.'
  ].join('\n');

  let decision = {
    action: 'none',
    forceFocus: false,
    lockDistractions: false,
    lockMinutes: 0,
    suggestMicroTask: false,
    reason: context.reason || 'No reason',
    message: 'Stay on your current task.'
  };

  if (state.model) {
    try {
      const response = await state.model.invoke(prompt);
      const text = response?.content?.toString?.() || '';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
        decision = {
          ...decision,
          ...parsed,
          action: ['none', 'nudge', 'force_focus', 'block_distraction'].includes(parsed.action)
            ? parsed.action
            : decision.action,
          lockMinutes: [0, 2, 5].includes(Number(parsed.lockMinutes)) ? Number(parsed.lockMinutes) : decision.lockMinutes,
          forceFocus: Boolean(parsed.forceFocus),
          lockDistractions: Boolean(parsed.lockDistractions),
          suggestMicroTask: Boolean(parsed.suggestMicroTask)
        };
      }
    } catch (error) {
      decision.reason = `${decision.reason} | LLM intervention fallback: ${error.message}`;
    }
  }

  if (metrics.tabSwitches5m >= switchThreshold) {
    decision.action = decision.action === 'none' ? 'force_focus' : decision.action;
    decision.forceFocus = true;
    decision.lockDistractions = true;
    decision.lockMinutes = decision.lockMinutes || defaultLockMins;
    decision.suggestMicroTask = true;
    decision.message = 'You are switching context too often. Entering a short focus sprint.';
    decision.reason = `High tab/app switching (${metrics.tabSwitches5m}) exceeds threshold of ${switchThreshold}.`;
  }

  const confidenceThreshold = settings.confidenceThreshold || 0.75;
  if (context.mode === 'distraction' && context.confidence >= confidenceThreshold) {
    decision.lockDistractions = true;
    decision.lockMinutes = decision.lockMinutes || defaultLockMins;
    if (decision.action === 'none') decision.action = 'block_distraction';
    decision.message = 'Detected non-work browsing. Temporary distraction lock enabled.';
  }

  return {
    ...state,
    intervention: decision
  };
}

async function microTaskNode(state) {
  const intervention = state.intervention || {};
  if (!intervention.suggestMicroTask) {
    return {
      ...state,
      microTasks: []
    };
  }

  const latest = state.latestSignal || {};
  const fallbackTasks = [
    'Define the smallest concrete output for the next 10 minutes.',
    'Open the project file you need and identify one exact edit.',
    'Implement just one verifiable step and run it once.'
  ];

  if (!state.model) {
    return {
      ...state,
      microTasks: fallbackTasks
    };
  }

  const prompt = [
    'You are a micro-task generator that fights procrastination.',
    'Return strict JSON only with keys: task, steps.',
    'steps must be an array of exactly 3 short actionable steps.',
    `Current app: ${latest.app || 'unknown'}`,
    `Window title: ${latest.title || 'unknown'}`,
    `Context mode: ${state.context?.mode || 'other'}`,
    `Intervention reason: ${intervention.reason || 'stuck detected'}`
  ].join('\n');

  try {
    const response = await state.model.invoke(prompt);
    const text = response?.content?.toString?.() || '';
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd <= jsonStart) {
      return { ...state, microTasks: fallbackTasks };
    }

    const payload = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const steps = Array.isArray(payload.steps)
      ? payload.steps.slice(0, 3).map((step) => String(step).trim()).filter(Boolean)
      : fallbackTasks;

    return {
      ...state,
      microTasks: steps.length ? steps : fallbackTasks
    };
  } catch {
    return {
      ...state,
      microTasks: fallbackTasks
    };
  }
}

async function loadGraph() {
  if (compiledGraph) return compiledGraph;

  const { StateGraph, START, END } = await import('@langchain/langgraph');

  const graph = new StateGraph({
    channels: {
      model: {
        value: (_, next) => next,
        default: () => null
      },
      latestSignal: {
        value: (_, next) => next,
        default: () => ({})
      },
      metrics: {
        value: (_, next) => next,
        default: () => ({})
      },
      context: {
        value: (_, next) => next,
        default: () => ({})
      },
      settings: {
        value: (_, next) => next,
        default: () => ({})
      },
      intervention: {
        value: (_, next) => next,
        default: () => ({})
      },
      microTasks: {
        value: (_, next) => next,
        default: () => []
      }
    }
  });

  graph
    .addNode('heuristic_context', heuristicContextNode)
    .addNode('llm_refine_context', llmContextRefineNode)
    .addNode('intervention_agent', interventionAgentNode)
    .addNode('micro_tasks', microTaskNode)
    .addEdge(START, 'heuristic_context')
    .addEdge('heuristic_context', 'llm_refine_context')
    .addEdge('llm_refine_context', 'intervention_agent')
    .addEdge('intervention_agent', 'micro_tasks')
    .addEdge('micro_tasks', END);

  compiledGraph = graph.compile();
  return compiledGraph;
}

async function buildGroqModel() {
  if (!process.env.GROQ_API_KEY) return null;

  const { ChatGroq } = await import('@langchain/groq');
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || DEFAULT_MODEL,
    temperature: 0.1
  });
}

async function runAgenticGraph(input) {
  const graph = await loadGraph();
  const model = await buildGroqModel();

  const result = await graph.invoke({
    model,
    latestSignal: input.latestSignal,
    metrics: input.metrics,
    settings: input.settings || {},
    context: {},
    intervention: {},
    microTasks: []
  });

  return {
    context: result.context || {},
    intervention: result.intervention || {},
    microTasks: Array.isArray(result.microTasks) ? result.microTasks : []
  };
}

module.exports = {
  runAgenticGraph,
  DEFAULT_MODEL
};
