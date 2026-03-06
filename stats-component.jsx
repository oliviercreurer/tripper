import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  ResponsiveContainer, CartesianGrid,
  ReferenceLine, ReferenceDot,
} from "recharts";

/* =========================================================
   DESIGN TOKENS (from tokens.json — light mode)
   ========================================================= */
const T = {
  bgPrimary:      "#FFFDF6",
  bgSecondary:    "#F7F6ED",
  bgInputDefault: "#F7F6ED",
  borderDefault:  "#DAD8CE",
  textDefault:    "#100F0F",
  textSubtle:     "#6F6E69",
  textSubtlest:   "#B7B5AC",
  textDanger:     "#AF3029",
  textWarning:    "#AD8301",
  textTeal:       "#24837B",
  lineRed:        "#F89A8A",
  lineYellow:     "#ECCB60",
  lineTeal:       "#87D3C3",
  lineMuted:      "#E6E4D9",   // muted line color when another metric is highlighted
  fontBody:       "'Outfit', system-ui, sans-serif",
  fontTechnical:  "'JetBrains Mono', monospace",
};

/* =========================================================
   DEMO DATA
   ========================================================= */
// Seeded PRNG for reproducible but varied data
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateDailyData(days, metrics, seed = 1) {
  const data = [];
  const rng = seededRandom(seed * 31 + 7);

  // Impressions: 30–80, Views: 15–45, Clicks: 3–18
  const ranges = [
    { min: 30, max: 80 },   // impressions — always highest
    { min: 15, max: 45 },   // views — middle
    { min: 3,  max: 18 },   // clicks — always lowest
  ];

  // Generate a wandering baseline per metric for organic feel
  const baselines = metrics.map((_, i) => {
    const mid = (ranges[i].min + ranges[i].max) / 2;
    let val = mid;
    const points = [];
    for (let d = 0; d < days; d++) {
      val += (rng() - 0.48) * (ranges[i].max - ranges[i].min) * 0.3;
      val = Math.max(ranges[i].min, Math.min(ranges[i].max, val));
      points.push(val);
    }
    return points;
  });

  for (let d = 0; d < days; d++) {
    const row = { day: d + 1 };
    metrics.forEach((m, i) => {
      const jitter = (rng() - 0.5) * (ranges[i].max - ranges[i].min) * 0.25;
      row[m.key] = Math.max(ranges[i].min, Math.round(baselines[i][d] + jitter));
    });
    data.push(row);
  }
  return data;
}

function generateOperatorData(operators, metrics, seed = 1) {
  const rng = seededRandom(seed * 17 + 3);

  // Per-operator totals: impressions 80–220, views 30–90, clicks 5–30
  const ranges = [
    { min: 80,  max: 220 },
    { min: 30,  max: 90  },
    { min: 5,   max: 30  },
  ];

  return operators.map((op) => {
    const row = { name: op };
    metrics.forEach((m, i) => {
      const range = ranges[i];
      row[m.key] = Math.round(range.min + rng() * (range.max - range.min));
    });
    return row;
  });
}

const METRICS = [
  { key: "impressions", label: "Impressions", lineColor: T.lineRed,    textColor: T.textDanger  },
  { key: "views",       label: "Views",       lineColor: T.lineYellow, textColor: T.textWarning },
  { key: "clicks",      label: "Clicks",      lineColor: T.lineTeal,   textColor: T.textTeal    },
];

const OPERATORS = [
  "Fairfield Bakery", "Mariposa Café", "Lot 49",
  "Pomeroy Hotel", "The Juiced Moose", "Stanton Bar",
];

const SOURCES = [
  { value: "all", label: "All widgets" },
  { value: "culinary", label: "Sipping Tour: Culinary Page Embed" },
  { value: "whereabouts", label: "Sipping Tour: Whereabouts Webpage" },
];

const TIMEFRAMES = [
  { value: "month", label: "This month", days: 31 },
  { value: "week",  label: "This week",  days: 7  },
  { value: "year",  label: "This year",  days: 12 },
];

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SEEDS = { all: 1, culinary: 2, whereabouts: 3 };
const TF_SEEDS = { month: 0, week: 10, year: 20 };

/* =========================================================
   ANIMATED NUMBER
   ========================================================= */
function AnimatedNumber({ value, duration = 600 }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    const start = performance.now();
    let raf;
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    prevRef.current = value;
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

/* =========================================================
   DROPDOWN
   ========================================================= */
function Dropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ flex: 1, minWidth: 0 }}>
      <p style={{
        fontFamily: T.fontBody, fontSize: 14, fontWeight: 500,
        color: T.textSubtle, marginBottom: 4,
      }}>{label}</p>
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            width: "100%", padding: "10px 36px 10px 12px",
            fontFamily: T.fontBody, fontSize: 16, fontWeight: 400,
            color: T.textDefault, background: T.bgInputDefault,
            border: `1px solid ${T.borderDefault}`, borderRadius: 8,
            textAlign: "left", cursor: "pointer", outline: "none",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {selected?.label}
          <span style={{
            position: "absolute", right: 12, top: "50%",
            transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
            transition: "transform 200ms", fontSize: 11, color: T.textSubtle,
          }}>▼</span>
        </button>
        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "#fff", border: `1px solid ${T.borderDefault}`,
            borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            zIndex: 10, overflow: "hidden",
          }}>
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  width: "100%", padding: "10px 12px",
                  fontFamily: T.fontBody, fontSize: 14,
                  fontWeight: opt.value === value ? 600 : 400,
                  color: T.textDefault,
                  background: opt.value === value ? T.bgSecondary : "transparent",
                  border: "none", textAlign: "left", cursor: "pointer",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >{opt.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   CUSTOM X-AXIS TICK (vertical line + label, matching Figma)
   ========================================================= */
/* =========================================================
   CHART
   ========================================================= */
function StatsChart({ data, metrics, highlightedMetric, activeIndex, onActiveIndexChange }) {
  // Custom tick as a closure so it can access onActiveIndexChange
  const TickComponent = useCallback(({ x, y, payload, index }) => (
    <g
      transform={`translate(${x},${y})`}
      onMouseEnter={() => onActiveIndexChange(index)}
      onMouseLeave={() => onActiveIndexChange(null)}
      style={{ cursor: "pointer" }}
    >
      {/* Invisible hit area for comfortable hovering */}
      <rect x={-14} y={-4} width={28} height={36} fill="transparent" />
      {/* Vertical tick line going upward */}
      <line
        x1={0} y1={0}
        x2={0} y2={-16}
        stroke={T.borderDefault}
        strokeWidth={1}
      />
      {/* Label below */}
      <text
        x={0} y={16}
        textAnchor="middle"
        fill={activeIndex === index ? T.textSubtle : T.textSubtlest}
        fontFamily={T.fontTechnical}
        fontSize={12}
        fontWeight={500}
        style={{ transition: "fill 150ms ease" }}
      >
        {payload.value}
      </text>
    </g>
  ), [onActiveIndexChange, activeIndex]);

  return (
    <div style={{ width: "100%", height: 340 }}>
      <ResponsiveContainer>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 8, bottom: 18, left: 8 }}
        >
          {/* Gradient + dot-matrix pattern definitions */}
          <defs>
            {metrics.map((m) => (
              <linearGradient key={`grad-${m.key}`} id={`gradient-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={m.lineColor} stopOpacity={0.28} />
                <stop offset="100%" stopColor={m.lineColor} stopOpacity={0.02} />
              </linearGradient>
            ))}
            {metrics.map((m) => (
              <pattern key={`pat-${m.key}`} id={`dots-${m.key}`} x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
                <circle cx="2.5" cy="2.5" r="1" fill={m.lineColor} opacity="0.35" />
              </pattern>
            ))}
          </defs>

          <CartesianGrid
            horizontal={false}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={<TickComponent />}
            axisLine={false}
            tickLine={false}
            interval={0}
            padding={{ left: 4, right: 4 }}
          />
          <YAxis hide={true} domain={[0, "auto"]} />

          {/* Vertical dotted reference line at hovered x-axis point */}
          {activeIndex !== null && (
            <ReferenceLine
              x={data[activeIndex]?.label}
              stroke={T.borderDefault}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}

          {/* Gradient + dot-matrix area fill — only for the highlighted metric */}
          {highlightedMetric && metrics.map((m) => {
            if (m.key !== highlightedMetric) return null;
            return [
              <Area
                key={`area-grad-${m.key}`}
                type="linear"
                dataKey={m.key}
                fill={`url(#gradient-${m.key})`}
                stroke="none"
                isAnimationActive={false}
              />,
              <Area
                key={`area-dots-${m.key}`}
                type="linear"
                dataKey={m.key}
                fill={`url(#dots-${m.key})`}
                stroke="none"
                isAnimationActive={false}
              />,
            ];
          })}

          {metrics.map((m) => {
            const isHighlighted = highlightedMetric === m.key;
            const isMuted = highlightedMetric && highlightedMetric !== m.key;
            const strokeColor = isMuted ? T.lineMuted : m.lineColor;

            return (
              <Line
                key={m.key}
                type="linear"
                dataKey={m.key}
                stroke={strokeColor}
                strokeWidth={isHighlighted ? 3.5 : isMuted ? 2 : 3}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                style={{ transition: "stroke 200ms ease, stroke-width 200ms ease" }}
              />
            );
          })}

          {/* Dots on each line at the hovered index */}
          {activeIndex !== null && metrics.map((m) => (
            <ReferenceDot
              key={`dot-${m.key}`}
              x={data[activeIndex]?.label}
              y={data[activeIndex]?.[m.key]}
              r={5}
              fill={m.lineColor}
              stroke={T.bgPrimary}
              strokeWidth={2}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* =========================================================
   METRIC TABS
   ========================================================= */
function MetricTabs({ metrics, totals, pointValues, highlightedMetric, isChartHovered, onHover, onLeave }) {
  return (
    <div
      onMouseLeave={onLeave}
      style={{
        display: "flex",
        background: T.bgSecondary,
        border: `1px solid ${T.borderDefault}`,
        borderRadius: 8,
        overflow: "hidden",
        cursor: "default",
      }}
    >
      {metrics.map((m, i) => {
        const isHighlighted = highlightedMetric === m.key;
        const pointVal = pointValues[m.key];
        const showingPoint = isChartHovered && pointVal !== undefined;

        return (
          <div
            key={m.key}
            onMouseEnter={() => onHover(m.key)}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderLeft: i > 0 ? `1px solid ${T.borderDefault}` : "none",
              background: isHighlighted ? T.bgPrimary : "transparent",
              transition: "background 200ms ease",
              position: "relative",
            }}
          >
            {/* Colored top accent bar */}
            <div style={{
              position: "absolute",
              top: 0, left: 0, right: 0,
              height: isHighlighted ? 2 : 0,
              background: m.lineColor,
              transition: "height 200ms ease",
            }} />
            <p style={{
              fontFamily: T.fontTechnical, fontSize: 16, fontWeight: 500,
              color: m.textColor, margin: 0,
            }}>
              {showingPoint ? pointVal.toLocaleString() : <AnimatedNumber value={totals[m.key]} />}
            </p>
            <p style={{
              fontFamily: T.fontBody, fontSize: 12, fontWeight: 500,
              color: T.textSubtle, margin: "2px 0 0 0",
            }}>{m.label}</p>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   OPERATOR TABLE
   ========================================================= */
function OperatorTable({ operators, metrics }) {
  return (
    <div>
      <h3 style={{
        fontFamily: T.fontBody, fontSize: 16, fontWeight: 600,
        color: T.textDefault, margin: "0 0 4px 0",
      }}>Stats by operator</h3>
      <p style={{
        fontFamily: T.fontBody, fontSize: 14, fontWeight: 400,
        color: T.textSubtle, margin: "0 0 16px 0",
      }}>A breakdown of stats for operator featured in this itinerary.</p>

      <div style={{ overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", background: T.bgSecondary }}>
          <div style={{
            flex: 2, padding: "10px 16px",
            fontFamily: T.fontBody, fontSize: 14, fontWeight: 600,
            color: T.textSubtlest,
          }}>Name</div>
          {metrics.map((m) => (
            <div key={m.key} style={{
              flex: 1, padding: "10px 16px",
              fontFamily: T.fontBody, fontSize: 14, fontWeight: 600,
              color: T.textSubtlest,
            }}>{m.label}</div>
          ))}
        </div>

        {/* Rows */}
        {operators.map((op) => (
          <div key={op.name} style={{
            display: "flex", background: T.bgSecondary,
            borderTop: `1px solid ${T.borderDefault}`,
            transition: "background 120ms",
            cursor: "default",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#EDECD9"}
            onMouseLeave={(e) => e.currentTarget.style.background = T.bgSecondary}
          >
            <div style={{
              flex: 2, padding: "12px 16px",
              fontFamily: T.fontBody, fontSize: 14, fontWeight: 500,
              color: T.textDefault,
            }}>{op.name}</div>
            {metrics.map((m) => (
              <div key={m.key} style={{
                flex: 1, padding: "12px 16px",
                fontFamily: T.fontTechnical, fontSize: 12, fontWeight: 500,
                color: T.textDefault,
              }}>{op[m.key].toLocaleString()}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   MAIN
   ========================================================= */
export default function StatsComponent() {
  const [source, setSource] = useState("all");
  const [timeframe, setTimeframe] = useState("month");
  const [highlightedMetric, setHighlightedMetric] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);

  const tf = TIMEFRAMES.find((t) => t.value === timeframe);
  const seed = SEEDS[source] + TF_SEEDS[timeframe];

  const dailyData = useMemo(
    () => generateDailyData(tf.days, METRICS, seed),
    [source, timeframe]
  );

  const operatorData = useMemo(
    () => generateOperatorData(OPERATORS, METRICS, seed),
    [source, timeframe]
  );

  const totals = useMemo(() => {
    const t = {};
    METRICS.forEach((m) => {
      t[m.key] = operatorData.reduce((sum, op) => sum + op[m.key], 0);
    });
    return t;
  }, [operatorData]);

  // Chart data with formatted labels
  const chartData = useMemo(() =>
    dailyData.map((d) => ({
      ...d,
      label: timeframe === "year" ? MONTH_LABELS[d.day - 1] : String(d.day),
    })),
    [dailyData, timeframe]
  );


  return (
    <div style={{
      fontFamily: T.fontBody, background: T.bgPrimary,
      minHeight: "100vh", display: "flex", justifyContent: "center",
      padding: "40px 20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
      `}</style>
      <div style={{
        width: "100%", maxWidth: 720, background: T.bgPrimary,
        border: `1px solid ${T.borderDefault}`, borderRadius: 12,
        padding: 20, display: "flex", flexDirection: "column", gap: 24,
      }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 12 }}>
          <Dropdown label="Source(s)" options={SOURCES} value={source} onChange={setSource} />
          <Dropdown
            label="Timeframe"
            options={TIMEFRAMES.map((t) => ({ value: t.value, label: t.label }))}
            value={timeframe} onChange={setTimeframe}
          />
        </div>

        {/* Chart */}
        <StatsChart
          data={chartData} metrics={METRICS}
          highlightedMetric={highlightedMetric}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
        />

        {/* Metric Tabs */}
        <MetricTabs
          metrics={METRICS}
          totals={totals}
          pointValues={activeIndex !== null
            ? Object.fromEntries(METRICS.map(m => [m.key, chartData[activeIndex]?.[m.key]]))
            : {}}
          highlightedMetric={highlightedMetric}
          isChartHovered={activeIndex !== null}
          onHover={setHighlightedMetric}
          onLeave={() => setHighlightedMetric(null)}
        />

        {/* Operator Table */}
        <OperatorTable operators={operatorData} metrics={METRICS} />
      </div>
    </div>
  );
}
