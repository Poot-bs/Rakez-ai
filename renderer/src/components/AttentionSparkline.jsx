import React from 'react';
import { motion } from 'framer-motion';

export function AttentionSparkline({ history = [] }) {
  const points = history.length > 0 ? history : [0.6, 0.7, 0.65, 0.8, 0.75, 0.85, 0.9, 0.88];
  const width = 360;
  const height = 75;
  const padding = 8;

  const dx = (width - padding * 2) / Math.max(1, points.length - 1);
  const minVal = 0.2;
  const maxVal = 1.0;

  const coords = points.map((val, idx) => {
    const x = padding + idx * dx;
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    const norm = (clamped - minVal) / (maxVal - minVal);
    const y = height - padding - norm * (height - padding * 2);
    return { x, y };
  });

  const pathD = coords.reduce((acc, pt, idx, arr) => {
    if (idx === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[idx - 1];
    const cx1 = prev.x + (pt.x - prev.x) / 2;
    const cy1 = prev.y;
    const cx2 = cx1;
    const cy2 = pt.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
  }, '');

  const areaD = coords.length > 0
    ? `${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`
    : '';

  const lastCoord = coords[coords.length - 1] || { x: width - padding, y: height / 2 };
  const lastScore = Math.round((points[points.length - 1] || 0) * 100);

  return (
    <div className="sparklineContainer">
      <div className="sparklineHeader">
        <span className="sparklineTitle">Attention Waveform (Live 60s)</span>
        <span className="sparklineLatest">{lastScore}% Flow</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="sparklineSvg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="waveAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="waveLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <filter id="waveGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Reference guide lines */}
        <line x1="0" y1={height * 0.3} x2={width} y2={height * 0.3} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
        <line x1="0" y1={height * 0.7} x2={width} y2={height * 0.7} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

        {/* Area fill */}
        {areaD && <path d={areaD} fill="url(#waveAreaGrad)" />}

        {/* Line stroke */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="url(#waveLineGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#waveGlow)"
          />
        )}

        {/* Pulsing head point */}
        <circle cx={lastCoord.x} cy={lastCoord.y} r="4" fill="#34d399" />
        <motion.circle
          cx={lastCoord.x}
          cy={lastCoord.y}
          r="8"
          fill="none"
          stroke="#34d399"
          strokeWidth="1.5"
          animate={{ r: [4, 10, 4], opacity: [0.8, 0.1, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </svg>
    </div>
  );
}
