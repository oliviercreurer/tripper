/**
 * ProgressPill — A scroll-driven day-progress indicator
 *
 * A pill-shaped component with a gradient stroke that fills as the user
 * scrolls through a day section, plus an animated dot that tracks position.
 * Four color bands (orange → yellow → blue → purple) transition at 25/50/75%
 * with smoothstep interpolation.
 *
 * Props:
 *   dayNumber  — current day (1-based integer)
 *   distance   — display string, e.g. "152.7km"
 *   progress   — 0 → 1 representing scroll depth within the current day
 *
 * Usage:
 *   <ProgressPill dayNumber={1} distance="152.7km" progress={0.42} />
 */

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

// ─── Design tokens ──────────────────────────────────────────────
const BG     = "#fffdf6";
const BORDER = "#DAD8CE";
const SUBTLE = "#6f6e69";

// Gradient segment colors: track (stroke/ring) and bg (dot fill)
const TRACK_RGB = [
  [249, 174, 119], // #F9AE77  orange
  [236, 203,  96], // #ECCB60  yellow
  [146, 191, 219], // #92BFDB  blue
  [196, 185, 224], // #C4B9E0  purple
];
const BG_RGB = [
  [255, 231, 206], // #FFE7CE
  [250, 238, 198], // #FAEEC6
  [225, 236, 235], // #E1ECEB
  [240, 234, 236], // #F0EAEC
];

// ─── Color interpolation ────────────────────────────────────────
// Smoothstep-blended transition between 4 color bands at 25/50/75%
function lerpColors(palette, t) {
  const boundaries = [0.25, 0.5, 0.75];
  const halfTrans  = 0.035;
  let c = palette[0];
  for (let b = 0; b < boundaries.length; b++) {
    const bd = boundaries[b];
    if (t > bd + halfTrans) {
      c = palette[b + 1];
    } else if (t > bd - halfTrans) {
      const f = (t - (bd - halfTrans)) / (2 * halfTrans);
      const s = f * f * (3 - 2 * f); // smoothstep
      c = palette[b].map((v, k) => Math.round(v + (palette[b + 1][k] - v) * s));
    }
  }
  return c;
}

function rgb(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ─── Pill geometry ──────────────────────────────────────────────
const PW = 230;  // pill width
const PH = 48;   // pill height
const SW = 4;    // stroke width
const INSET = SW / 2;
const PR = (PH - SW) / 2; // pill radius

function pillD() {
  const i = INSET, w = PW - SW, h = PH - SW, r = PR;
  const cx = PW / 2;
  return [
    `M ${cx} ${i}`,          // start top-center
    `L ${i+w-r} ${i}`,       // top edge →
    `A ${r} ${r} 0 0 1 ${i+w} ${i+r}`,       // top-right arc
    `A ${r} ${r} 0 0 1 ${i+w-r} ${i+h}`,     // bottom-right arc
    `L ${i+r} ${i+h}`,       // bottom edge ←
    `A ${r} ${r} 0 0 1 ${i} ${i+r}`,         // bottom-left arc
    `A ${r} ${r} 0 0 1 ${i+r} ${i}`,         // top-left arc
    `L ${cx} ${i}`,          // close back to top-center
  ].join(" ");
}

const PILL_D = pillD();

// ─── Component ──────────────────────────────────────────────────
export default function ProgressPill({ dayNumber, distance, progress }) {
  const canvasRef  = useRef(null);
  const ctxRef     = useRef(null);
  const pathRef    = useRef(null);
  const pointsRef  = useRef([]);
  const dotRef     = useRef(null);
  const displayRef = useRef(0);
  const targetRef  = useRef(0);
  const rafRef     = useRef(null);
  const [ready, setReady] = useState(false);
  const hasStartedRef = useRef(false);
  if (progress > 0.01) hasStartedRef.current = true;

  // ── Day-backward detection ──
  // When scrolling from Day N back to Day N-1, the progress value jumps
  // from ~0.05 to ~0.95 (a positive diff that would animate forward and
  // loop the dot around the track). Instead we snap the dot position and
  // crossfade the track/dot colors over ~400ms.
  const prevDayNumRef = useRef(dayNumber);
  const dayTransitionRef = useRef(null); // { fromColor, fade: 0..1 }

  useEffect(() => {
    if (dayNumber !== prevDayNumRef.current) {
      const wentBack = dayNumber < prevDayNumRef.current;
      if (wentBack) {
        displayRef.current = progress;
        targetRef.current = progress;
        dayTransitionRef.current = {
          fromColor: lerpColors(TRACK_RGB, 0.0),
          fade: 0,
        };
      }
      prevDayNumRef.current = dayNumber;
    }
  }, [dayNumber, progress]);

  targetRef.current = progress;

  // ── Canvas + path sampling setup ──
  useEffect(() => {
    const cvs = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    cvs.width  = PW * dpr;
    cvs.height = PH * dpr;
    cvs.style.width  = PW + "px";
    cvs.style.height = PH + "px";
    const ctx = cvs.getContext("2d");
    ctx.scale(dpr, dpr);
    ctxRef.current = ctx;

    const path = pathRef.current;
    const totalLen = path.getTotalLength();
    const step = 1.4; // sample every 1.4px for uniform segments
    const n = Math.ceil(totalLen / step);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const pt = path.getPointAtLength(t * totalLen);
      pts.push({ x: pt.x, y: pt.y, t });
    }
    pointsRef.current = pts;
    setReady(true);
  }, []);

  // ── Draw track stroke ──
  useLayoutEffect(() => {
    const ctx = ctxRef.current;
    const pts = pointsRef.current;
    if (!ctx || pts.length === 0) return;

    ctx.clearRect(0, 0, PW, PH);
    if (progress < 0.003) return;

    ctx.lineWidth = SW;
    ctx.lineCap   = "butt";

    const visibleIdx = Math.floor(Math.min(progress, 0.998) * (pts.length - 1));

    // During a day-backward crossfade, blend colors
    const trans = dayTransitionRef.current;
    let trackColor;
    if (trans && trans.fade < 1) {
      const targetColor = lerpColors(TRACK_RGB, Math.min(progress, 0.998));
      const f = trans.fade;
      trackColor = rgb([
        Math.round(trans.fromColor[0] * (1 - f) + targetColor[0] * f),
        Math.round(trans.fromColor[1] * (1 - f) + targetColor[1] * f),
        Math.round(trans.fromColor[2] * (1 - f) + targetColor[2] * f),
      ]);
    } else {
      trackColor = rgb(lerpColors(TRACK_RGB, Math.min(progress, 0.998)));
    }
    ctx.strokeStyle = trackColor;

    for (let i = 0; i < visibleIdx; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (!p2) break;
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      const ov = segLen > 0 ? 0.3 / segLen : 0;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x + dx * ov, p2.y + dy * ov);
      ctx.stroke();
    }
  }, [progress, ready]);

  // ── Animated dot (rAF loop) ──
  useEffect(() => {
    if (!ready) return;
    let lastTime = 0;
    const EASE = 12;

    function tick(now) {
      rafRef.current = requestAnimationFrame(tick);
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
      lastTime = now;

      // Advance crossfade if active
      const trans = dayTransitionRef.current;
      if (trans && trans.fade < 1) {
        trans.fade = Math.min(trans.fade + dt * 2.5, 1); // ~400ms
        if (trans.fade >= 1) dayTransitionRef.current = null;
      }

      const target  = targetRef.current;
      const current = displayRef.current;
      const diff    = target - current;

      // Snap if large backward jump within same day
      if (diff < -0.3) {
        displayRef.current = target;
      } else {
        const step = 1 - Math.exp(-EASE * dt);
        displayRef.current = current + diff * step;
        if (Math.abs(diff) < 0.001) displayRef.current = target;
      }

      const dot = dotRef.current;
      const pts = pointsRef.current;
      if (!dot || pts.length === 0 || !hasStartedRef.current) return;

      const p   = Math.min(Math.max(displayRef.current, 0), 0.998);
      const idx = Math.min(Math.floor(p * (pts.length - 1)), pts.length - 1);
      const pt  = pts[idx];
      dot.setAttribute("cx", pt.x);
      dot.setAttribute("cy", pt.y);

      // Crossfade dot colors during day transition
      if (trans && trans.fade < 1) {
        const f = trans.fade;
        const targetBg     = lerpColors(BG_RGB, pt.t);
        const targetStroke = lerpColors(TRACK_RGB, pt.t);
        const fromBg       = lerpColors(BG_RGB, 0.0);
        const fromStroke   = trans.fromColor;
        dot.setAttribute("fill", rgb([
          Math.round(fromBg[0] * (1 - f) + targetBg[0] * f),
          Math.round(fromBg[1] * (1 - f) + targetBg[1] * f),
          Math.round(fromBg[2] * (1 - f) + targetBg[2] * f),
        ]));
        dot.setAttribute("stroke", rgb([
          Math.round(fromStroke[0] * (1 - f) + targetStroke[0] * f),
          Math.round(fromStroke[1] * (1 - f) + targetStroke[1] * f),
          Math.round(fromStroke[2] * (1 - f) + targetStroke[2] * f),
        ]));
      } else {
        dot.setAttribute("fill",   rgb(lerpColors(BG_RGB,    pt.t)));
        dot.setAttribute("stroke", rgb(lerpColors(TRACK_RGB, pt.t)));
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ready]);

  // ── Text transition state machine ──
  // "idle" → "exiting" (240ms fade-up) → "entering" (280ms fade-down) → "idle"
  const labelColor = "#100F0F";
  const [textPhase, setTextPhase]   = useState("idle");
  const [displayDay, setDisplayDay] = useState(dayNumber);
  const [displayDist, setDisplayDist] = useState(distance);
  const prevDayRef = useRef(dayNumber);

  useEffect(() => {
    if (dayNumber === prevDayRef.current) return;
    prevDayRef.current = dayNumber;
    setTextPhase("exiting");
    const exitTimer = setTimeout(() => {
      setDisplayDay(dayNumber);
      setDisplayDist(distance);
      setTextPhase("entering");
      const enterTimer = setTimeout(() => { setTextPhase("idle"); }, 280);
      return () => clearTimeout(enterTimer);
    }, 240);
    return () => clearTimeout(exitTimer);
  }, [dayNumber, distance]);

  useEffect(() => {
    if (textPhase === "idle" && dayNumber === displayDay) {
      setDisplayDist(distance);
    }
  }, [distance, textPhase, dayNumber, displayDay]);

  const textStyle = (() => {
    switch (textPhase) {
      case "exiting":
        return { opacity: 0, transform: "translateY(-10px)", transition: "opacity .24s ease-in, transform .24s ease-in" };
      case "entering":
        return { opacity: 1, transform: "translateY(0px)", transition: "opacity .28s ease-out, transform .28s ease-out" };
      default:
        return { opacity: 1, transform: "translateY(0px)", transition: "none" };
    }
  })();

  const textEnterRef = useRef(null);
  useLayoutEffect(() => {
    if (textPhase === "entering" && textEnterRef.current) {
      const el = textEnterRef.current;
      el.style.transition = "none";
      el.style.opacity = "0";
      el.style.transform = "translateY(10px)";
      el.getBoundingClientRect(); // force reflow
      el.style.transition = "opacity .28s ease-out, transform .28s ease-out";
      el.style.opacity = "1";
      el.style.transform = "translateY(0px)";
    }
  }, [textPhase]);

  const initX = PW / 2;
  const initY = INSET;

  return (
    <div style={{ position: "relative", width: PW, height: PH }}>
      {/* Base pill shape: fill + border */}
      <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}
           style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}>
        <rect x={INSET} y={INSET} width={PW - SW} height={PH - SW}
              rx={PR} ry={PR} fill={BG} stroke={BORDER} strokeWidth={SW} />
        <path ref={pathRef} d={PILL_D} fill="none" stroke="none" />
      </svg>

      {/* Canvas: gradient track stroke */}
      <canvas ref={canvasRef}
              style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} />

      {/* Animated dot */}
      {hasStartedRef.current && (
        <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}
             style={{ position: "absolute", top: 0, left: 0, overflow: "visible", pointerEvents: "none" }}>
          <circle ref={dotRef} cx={initX} cy={initY} r={5.5}
                  fill={rgb(BG_RGB[0])} stroke={rgb(TRACK_RGB[0])} strokeWidth={2.5}
                  style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.12))" }} />
        </svg>
      )}

      {/* Day label + distance */}
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        <div ref={textEnterRef} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          ...textStyle,
        }}>
          <span style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 16,
            color: labelColor, fontFeatureSettings: "'lnum' 1, 'tnum' 1",
          }}>Day {displayDay}</span>
          <svg width="1" height="16" style={{ flexShrink: 0 }}>
            <line x1=".5" y1="0" x2=".5" y2="16" stroke={BORDER} />
          </svg>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: SUBTLE,
          }}>{displayDist}</span>
        </div>
      </div>
    </div>
  );
}
