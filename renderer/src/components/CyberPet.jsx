import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function CyberPet({
  focusMode,
  score,
  fatigued,
  distracted,
  fatigueIndex = 0,
  latestAlert = ''
}) {
  let mood = 'Standby';
  let moodTag = 'READY';
  let tip = 'Start a focus session to power up your flow companion.';
  let stateKey = 'standby';
  let eyeColor = '#38bdf8'; // sky blue
  let auraGlow = 'rgba(56, 189, 248, 0.25)';

  if (!focusMode) {
    mood = 'Hibernating';
    moodTag = 'PAUSED';
    tip = 'Press "Start Focus Session" when you are ready to enter flow.';
    stateKey = 'idle';
    eyeColor = '#94a3b8';
    auraGlow = 'rgba(148, 163, 184, 0.15)';
  } else if (distracted) {
    mood = 'Distraction Detected';
    moodTag = 'WARNING';
    tip = latestAlert || 'Gaze drift detected! Re-center your eyes on your active task.';
    stateKey = 'distracted';
    eyeColor = '#ef4444'; // red
    auraGlow = 'rgba(239, 68, 68, 0.4)';
  } else if (fatigued) {
    mood = 'Cognitive Fatigue';
    moodTag = 'REST NUDGE';
    tip = 'High blink / yawn rate detected. Practice the 20-20-20 rule (look 20ft away for 20s).';
    stateKey = 'fatigued';
    eyeColor = '#fbbf24'; // amber
    auraGlow = 'rgba(251, 191, 36, 0.35)';
  } else if (score >= 0.75) {
    mood = 'Deep Flow State';
    moodTag = 'OPTIMAL';
    tip = 'Unstoppable momentum! Your neural flow score is peaking.';
    stateKey = 'flow';
    eyeColor = '#10b981'; // emerald
    auraGlow = 'rgba(16, 185, 129, 0.4)';
  } else if (score >= 0.5) {
    mood = 'Building Momentum';
    moodTag = 'IN FOCUS';
    tip = 'Solid focus detected. Stay locked into your current workflow.';
    stateKey = 'steady';
    eyeColor = '#06b6d4'; // cyan
    auraGlow = 'rgba(6, 182, 212, 0.3)';
  } else {
    mood = 'Attention Slipping';
    moodTag = 'CAUTION';
    tip = 'Attention is oscillating. Break your work into one immediate 2-minute step.';
    stateKey = 'low';
    eyeColor = '#f97316'; // orange
    auraGlow = 'rgba(249, 115, 22, 0.35)';
  }

  return (
    <div className="cyberPetCard">
      <div className="cardHeaderRow">
        <div className="cardHeaderTitle">
          <span className="dot" style={{ background: eyeColor, boxShadow: `0 0 10px ${eyeColor}` }} />
          <span>Rakez Flow Companion</span>
        </div>
        <span className={`petStatusBadge status-${stateKey}`}>
          {moodTag}
        </span>
      </div>

      <div className="petStage">
        {/* Ambient Aura Halo */}
        <motion.div
          className="petAura"
          animate={{
            scale: stateKey === 'flow' ? [1, 1.15, 1] : [1, 1.05, 1],
            opacity: [0.5, 0.85, 0.5]
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: auraGlow }}
        />

        {/* Floating Robotic Avatar */}
        <motion.div
          className="petAvatar"
          animate={
            stateKey === 'distracted'
              ? { y: [0, -3, 3, 0], x: [-2, 2, -1, 1, 0] }
              : { y: [0, -9, 0] }
          }
          transition={
            stateKey === 'distracted'
              ? { duration: 0.3, repeat: 3 }
              : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <svg viewBox="0 0 160 140" className="petSvg" fill="none">
            <defs>
              <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#090d16" />
              </linearGradient>
              <linearGradient id="visorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={eyeColor} stopOpacity="0.8" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
              </linearGradient>
              <filter id="glowFilter" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Neural Antenna Fins */}
            <motion.path
              d="M 32 46 L 16 32 L 24 56 Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1.5"
              animate={{ rotate: stateKey === 'flow' ? [-4, 4, -4] : [0, 0, 0] }}
              style={{ originX: '32px', originY: '46px' }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <motion.path
              d="M 128 46 L 144 32 L 136 56 Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1.5"
              animate={{ rotate: stateKey === 'flow' ? [4, -4, 4] : [0, 0, 0] }}
              style={{ originX: '128px', originY: '46px' }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />

            {/* Head Chasis */}
            <rect
              x="28"
              y="22"
              width="104"
              height="84"
              rx="42"
              fill="url(#bodyGrad)"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1.8"
            />

            {/* Glowing Accent Ring */}
            <rect
              x="32"
              y="26"
              width="96"
              height="76"
              rx="38"
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="1.5"
            />

            {/* Visor Screen */}
            <rect
              x="40"
              y="38"
              width="80"
              height="52"
              rx="24"
              fill="url(#visorGrad)"
              stroke="#1e293b"
              strokeWidth="1.5"
            />

            {/* Eyes rendering depending on state */}
            {stateKey === 'flow' ? (
              // Joyful flow arcs (^ ^)
              <g filter="url(#glowFilter)" stroke={eyeColor} strokeWidth="4" strokeLinecap="round" fill="none">
                <path d="M 54 66 Q 64 54 72 66" />
                <path d="M 88 66 Q 96 54 106 66" />
              </g>
            ) : stateKey === 'distracted' ? (
              // Distracted wide eyes (! !)
              <g filter="url(#glowFilter)">
                <ellipse cx="62" cy="64" rx="8" ry="10" fill={eyeColor} />
                <ellipse cx="98" cy="64" rx="8" ry="10" fill={eyeColor} />
                <ellipse cx="60" cy="62" rx="3" ry="3" fill="#ffffff" />
                <ellipse cx="96" cy="62" rx="3" ry="3" fill="#ffffff" />
              </g>
            ) : stateKey === 'fatigued' ? (
              // Sleepy drooping eyes (- -)
              <g filter="url(#glowFilter)" stroke={eyeColor} strokeWidth="3.5" strokeLinecap="round">
                <line x1="53" y1="65" x2="71" y2="67" />
                <line x1="89" y1="67" x2="107" y2="65" />
              </g>
            ) : stateKey === 'idle' ? (
              // Resting sleepy dots (o o)
              <g filter="url(#glowFilter)">
                <circle cx="62" cy="64" r="5" fill={eyeColor} />
                <circle cx="98" cy="64" r="5" fill={eyeColor} />
              </g>
            ) : (
              // Normal attentive eyes
              <g filter="url(#glowFilter)">
                <ellipse cx="62" cy="64" rx="6.5" ry="8" fill={eyeColor} />
                <ellipse cx="98" cy="64" rx="6.5" ry="8" fill={eyeColor} />
                <circle cx="60" cy="61" r="2.5" fill="#ffffff" />
                <circle cx="96" cy="61" r="2.5" fill="#ffffff" />
              </g>
            )}

            {/* Cute Cheek Blush (in flow state) */}
            {stateKey === 'flow' && (
              <g fill="#10b981" opacity="0.45" filter="url(#glowFilter)">
                <circle cx="48" cy="74" r="5" />
                <circle cx="112" cy="74" r="5" />
              </g>
            )}

            {/* Base Thruster / Floating Pod */}
            <ellipse cx="80" cy="116" rx="20" ry="5" fill="#1e293b" />
            <motion.ellipse
              cx="80"
              cy="120"
              rx="12"
              ry="3"
              fill={eyeColor}
              filter="url(#glowFilter)"
              animate={{ opacity: [0.4, 0.9, 0.4], rx: [10, 14, 10] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
          </svg>
        </motion.div>
      </div>

      <div className="petSpeechBubble">
        <div className="petMoodLine">
          <strong>Mood:</strong> {mood}
        </div>
        <p className="petTipText">{tip}</p>
      </div>

      <div className="fatigueSection">
        <div className="fatigueLabelRow">
          <span>Eye & Cognitive Strain</span>
          <span>{Math.round(fatigueIndex)}%</span>
        </div>
        <div className="fatigueTrack">
          <motion.div
            className="fatigueFill"
            animate={{ width: `${Math.max(4, Math.min(100, Math.round(fatigueIndex)))}%` }}
            transition={{ duration: 0.3 }}
            style={{
              background:
                fatigueIndex >= 70
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : fatigueIndex >= 40
                  ? 'linear-gradient(90deg, #10b981, #f59e0b)'
                  : 'linear-gradient(90deg, #06b6d4, #10b981)'
            }}
          />
        </div>
      </div>
    </div>
  );
}
