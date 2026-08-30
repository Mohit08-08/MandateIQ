import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

/**
 * Secondary evidence for the headline lift number: retries used per
 * mandate, agent vs baseline. This is the "efficiency" story from the
 * project's Day 6 analysis — the agent recovers MORE while using FEWER
 * retries, which is a more interesting technical point than the raw
 * recovery rate alone.
 */
export default function ComparisonChart({ agent, baseline }) {
  const data = [
    { name: "Agent", retries: agent.avg_retries, fill: "var(--color-recovery)" },
    { name: "Baseline", retries: baseline.avg_retries, fill: "var(--color-baseline)" },
  ];

  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6">
      <h3 className="font-display text-sm uppercase tracking-widest text-text-faint mb-4">
        Avg. retries per mandate
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" hide domain={[0, "dataMax + 0.3"]} />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={70}
            tick={{ fill: "#8891A8", fontFamily: "Inter", fontSize: 13 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{
              background: "#131B2E",
              border: "1px solid #253150",
              borderRadius: 8,
              fontFamily: "JetBrains Mono",
              fontSize: 12,
            }}
            formatter={(value) => [value.toFixed(2), "avg retries"]}
          />
          <Bar dataKey="retries" radius={[0, 6, 6, 0]} barSize={28}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-text-muted">
        Fewer retries with a higher recovery rate means the agent isn't just
        trying harder — it's succeeding more while using fewer of the
        NPCI-capped retry attempts.
      </p>
    </div>
  );
}
