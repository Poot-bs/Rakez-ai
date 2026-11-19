import React from 'react';
import { motion } from 'framer-motion';

export function FlowGauge({ score = 0, isDistracted = false, active = false }) {
  const safeScore = Math.max(0, Math.min(1, Number(score) || 0));
  const percentage = Math.round(safeScore * 100);

  // SVG parameters
  const size = 160;
  const strokeWidth = 10;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - safeScore * circumference;

  let colorGrad = ['#10b981', '#34d399']; // Emerald
  let glowColor = 'rgba(16, 185, 129, 0.4)';
  let label = 'PEAK FLOW';

  if (!active) {
    colorGrad = ['#64748b', '#94a3b8'];
    glowColor = 'rgba(148, 163, 184, 0.2)';
    label = 'STANDBY';
  } else if (isDistracted || safeScore < 0.35) {
    colorGrad = ['#ef4444', '#f87171'];
    glowColor = 'rgba(239, 68, 68, 0.45)';
    label = 'DISTRACTED';
  } else if (safeScore < 0.6) {
    colorGrad = ['#f59e0b', '#fbbf24'];
    glowColor = 'rgba(245, 158, 11, 0.4)';
    label = 'RE-CENTERING';
  } else if (safeScore < 0.75) {
    colorGrad = ['#06b6d4', '#38bdf8'];
    glowColor = 'rgba(6, 182, 212, 0.4)';
    label = 'IN FOCUS';
  }

  return (
    <div className="flowGaugeWrapper">
      <div className="gaugeSvgContainer">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colorGrad[0]} />
              <stop offset="100%" stopColor={colorGrad[1]} />
            </linearGradient>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track background */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
          />

          {/* Animated Value Arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            filter="url(#gaugeGlow)"
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </svg>

        <div className="gaugeCenterText">
          <div className="gaugeNumber" style={{ color: colorGrad[1] }}>
            {active ? percentage : 0}
            <span className="gaugePercent">%</span>
          </div>
          <div className="gaugeLabel" style={{ color: colorGrad[0] }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
