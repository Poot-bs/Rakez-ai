import { useEffect, useState } from 'react';

const EMPTY_ANALYTICS = {
  generatedAt: 0,
  topCorrelations: [],
  heatmap: []
};

export function useFocusAnalytics() {
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!window.focusGuardian?.invoke) return;
      const data = await window.focusGuardian.invoke('get-focus-analytics');
      if (mounted && data) {
        setAnalytics(data);
      }
    }

    load();
    const interval = setInterval(load, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { analytics };
}