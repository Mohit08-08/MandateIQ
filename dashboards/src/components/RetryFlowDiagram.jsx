import { useTheme } from "../context/ThemeContext";

/**
 * The "how it works" signature graphic: a hand-built SVG showing one
 * illustrative mandate's journey — the agent's path (teal, direct,
 * animated draw-in) reaching recovery in fewer hops than the baseline's
 * path (amber, dashed, more attempts). This is the visual argument for
 * the efficiency story real data supports (1.40 vs 1.55 avg retries) —
 * explicitly labeled illustrative, since real per-mandate journeys are
 * shown with real data in the Mandates drill-down instead.
 */
export default function RetryFlowDiagram() {
  const { theme } = useTheme();
  const nodeFill = theme === "dark" ? "#131B2E" : "#FFFFFF";

  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6 overflow-hidden">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-display text-sm uppercase tracking-widest text-text-faint">
          How a retry decision plays out
        </h3>
        <span className="text-[10px] font-mono text-text-faint">illustrative</span>
      </div>
      <p className="text-xs text-text-muted mb-6">
        One failed mandate, two strategies. The agent skips low-probability
        slots the baseline would have tried anyway.
      </p>

      <svg viewBox="0 0 720 220" className="w-full h-auto" role="img" aria-label="Retry flow diagram">
        <defs>
          <marker id="arrow-recovery" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#2DD4A7" />
          </marker>
        </defs>

        {/* Baseline label */}
        <text x="0" y="30" className="fill-baseline" style={{ font: "500 12px 'JetBrains Mono', monospace" }}>
          BASELINE
        </text>
        {/* Agent label */}
        <text x="0" y="150" className="fill-recovery" style={{ font: "500 12px 'JetBrains Mono', monospace" }}>
          AGENT
        </text>

        {/* Failed origin node, shared */}
        <Node x={70} y={100} r={9} stroke="#E2574C" fill={nodeFill} delay={0} />
        <text x={70} y={135} textAnchor="middle" className="fill-text-faint" style={{ font: "400 10px Inter" }}>
          failed
        </text>

        {/* --- Baseline path: fixed-interval, 3 hops --- */}
        <path
          d="M 79 105 Q 160 45, 240 45 T 400 45 T 560 45"
          fill="none" stroke="#F2A33D" strokeWidth="2" strokeDasharray="4 4"
          className="baseline-path"
        />
        <Node x={240} y={45} r={6} stroke="#F2A33D" fill={nodeFill} delay={0.3} />
        <Node x={400} y={45} r={6} stroke="#F2A33D" fill={nodeFill} delay={0.6} />
        <Node x={560} y={45} r={9} stroke="#F2A33D" fill={nodeFill} delay={0.9} />
        <text x={240} y={28} textAnchor="middle" className="fill-text-faint" style={{ font: "400 9px 'JetBrains Mono'" }}>
          +3d, low prob
        </text>
        <text x={400} y={28} textAnchor="middle" className="fill-text-faint" style={{ font: "400 9px 'JetBrains Mono'" }}>
          +3d, low prob
        </text>
        <text x={560} y={28} textAnchor="middle" className="fill-baseline" style={{ font: "500 9px 'JetBrains Mono'" }}>
          recovered (attempt 4)
        </text>

        {/* --- Agent path: model-timed, 1 hop, direct --- */}
        <path
          d="M 79 100 Q 300 100, 560 165"
          fill="none" stroke="#2DD4A7" strokeWidth="2.5"
          markerEnd="url(#arrow-recovery)"
          className="agent-path"
        />
        <Node x={560} y={165} r={9} stroke="#2DD4A7" fill={nodeFill} glow={theme === "dark"} delay={0.4} />
        <text x={330} y={155} textAnchor="middle" className="fill-recovery" style={{ font: "500 10px 'JetBrains Mono'" }}>
          salary window · predicted 82%
        </text>
        <text x={560} y={190} textAnchor="middle" className="fill-recovery" style={{ font: "600 10px 'JetBrains Mono'" }}>
          recovered (attempt 2)
        </text>
      </svg>

      <style>{`
        .agent-path {
          stroke-dasharray: 700;
          stroke-dashoffset: 700;
          animation: draw-in 1.4s cubic-bezier(0.65, 0, 0.35, 1) 0.2s forwards;
        }
        .baseline-path {
          stroke-dashoffset: 700;
          stroke-dasharray: 4 4, 700;
          animation: draw-in-dashed 1.8s ease-out 0.2s forwards;
        }
        @keyframes draw-in {
          to { stroke-dashoffset: 0; }
        }
        @keyframes draw-in-dashed {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Node({ x, y, r, stroke, fill, glow, delay = 0 }) {
  return (
    <g style={{ animation: `node-in 0.4s ease-out ${delay}s backwards` }}>
      {glow && <circle cx={x} cy={y} r={r + 6} fill={stroke} opacity="0.15" className="glow-pulse" />}
      <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth="2" />
      <style>{`
        @keyframes node-in {
          from { opacity: 0; transform: scale(0.5); transform-origin: ${x}px ${y}px; }
          to { opacity: 1; transform: scale(1); }
        }
        .glow-pulse {
          animation: pulse 2.2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.1; r: ${r + 5}; }
          50% { opacity: 0.25; r: ${r + 9}; }
        }
      `}</style>
    </g>
  );
}
