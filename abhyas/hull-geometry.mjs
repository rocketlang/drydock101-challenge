#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// hull-geometry.mjs — a real parametric hull for M.V. ABHYAS, integrated numerically.
//
// WHY. The wall-sided relation gave KN honestly but could not reach the angles the IS Code is written
// at: at loaded draft the deck edge immerses near 17 deg, so five of six criteria returned NULL. The
// fix is not a better formula, it is an actual HULL — define the geometry, then integrate it.
//
// This makes the geometry the SINGLE SOURCE OF TRUTH. Cb, Cw, KB, BM, KM, LCF, MCTC and KN are all
// consequences of one shape rather than separately declared coefficients that could drift apart.
//
// METHOD (standard naval architecture, all of it checkable):
//   · each station is a closed POLYGON — flat bottom, radiused bilge, wall side to the deck
//   · a heeled waterline is a half-plane;  y*sin(t) + z*cos(t) <= c
//   · clip the station polygon against that half-plane (Sutherland-Hodgman) -> immersed polygon
//   · polygon area and centroid by the exact shoelace formulae
//   · integrate area and moments along the length (Simpson) -> volume and centre of buoyancy
//   · bisect on c until the immersed volume equals the volume required
//   · KN = y_B * cos(t) + z_B * sin(t)      (exact, in the ship-fixed frame with origin at K)
//
// Nothing here is approximated by a fitted curve, and nothing is tabulated by hand.
//
//   node hull-geometry.mjs validate · kn <disp> <heel> · particulars

export const HULL = {
  LBP: 176.0, B: 28.0, D: 14.0,
  bilge_radius: 2.30,            // m — rounds the turn of bilge
  rise_of_floor: 0.0,            // m — flat bottom, as a bulk carrier has
  // Longitudinal fullness f(x) in [0,1] scaling the half-breadth at each station.
  // Parallel midbody over the middle, fining toward the ends — a bulk carrier's shape.
  parallel_midbody: 0.404,        // fraction of L at full breadth
  entrance_exp: 1.9,            // fineness of the forebody
  run_exp: 1.79,                 // fineness of the afterbody (fuller than the entrance)
  keel_fining: 1.15,             // how much finer the ends are near the keel than at the deck.
                                 // Without this the sections are wall-sided above the bilge, the
                                 // waterplane never changes shape, and Cw comes out CONSTANT with
                                 // draft — which no real hull does. Ships are finer low down at the
                                 // ends, so the waterplane fills out as the ship sinks.
  STATIONS: 81,                  // odd, for Simpson
};

// ── TABLE OF OFFSETS — the primary definition of this hull ──────────────────
// A real hull is defined by its OFFSETS, not by a formula. This table is now the source: half-
// breadths in metres at 21 stations (0 = AP, 10 = midships, 20 = FP) and 12 waterlines from the
// baseline to the deck at 14.0 m. The parametric fair form that generated it has been retired to
// a generator; everything downstream — sections, volume, KB, BM, KM, MCTC, LCF, FWA and the KN
// cross curves — is integrated from these numbers.
//
// TO USE A REAL SHIP: replace this table with her offsets. Nothing else changes.
export const WATERLINES = [0, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 10, 12, 14];
export const OFFSETS = [   // [station, x from midships (m), half-breadths at WATERLINES]
  { st:  0, x:  -88.00, hb: [0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000] },
  { st:  1, x:  -79.20, hb: [0.221, 1.639, 2.161, 2.478, 2.659, 2.882, 3.104, 3.546, 3.980, 4.406, 4.821, 5.226] },
  { st:  2, x:  -70.40, hb: [3.108, 4.740, 5.432, 5.895, 6.221, 6.647, 7.029, 7.741, 8.391, 8.981, 9.514, 9.995] },
  { st:  3, x:  -61.60, hb: [6.295, 7.961, 8.681, 9.166, 9.507, 9.948, 10.327, 10.981, 11.526, 11.975, 12.344, 12.648] },
  { st:  4, x:  -52.80, hb: [9.015, 10.633, 11.302, 11.732, 12.015, 12.333, 12.581, 12.970, 13.256, 13.462, 13.611, 13.720] },
  { st:  5, x:  -44.00, hb: [10.934, 12.444, 13.007, 13.335, 13.520, 13.655, 13.737, 13.845, 13.910, 13.947, 13.969, 13.982] },
  { st:  6, x:  -35.20, hb: [11.700, 13.115, 13.594, 13.849, 13.970, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000] },
  { st:  7, x:  -26.40, hb: [11.700, 13.115, 13.594, 13.849, 13.970, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000] },
  { st:  8, x:  -17.60, hb: [11.700, 13.115, 13.594, 13.849, 13.970, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000] },
  { st:  9, x:   -8.80, hb: [11.700, 13.115, 13.594, 13.849, 13.970, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000] },
  { st: 10, x:    0.00, hb: [11.700, 13.115, 13.594, 13.849, 13.970, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000] },
  { st: 11, x:    8.80, hb: [11.700, 13.115, 13.594, 13.849, 13.970, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000] },
  { st: 12, x:   17.60, hb: [11.700, 13.115, 13.594, 13.849, 13.970, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000] },
  { st: 13, x:   26.40, hb: [11.700, 13.115, 13.594, 13.849, 13.970, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000] },
  { st: 14, x:   35.20, hb: [11.700, 13.115, 13.594, 13.849, 13.970, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000, 14.000] },
  { st: 15, x:   44.00, hb: [11.072, 12.569, 13.121, 13.438, 13.614, 13.731, 13.798, 13.885, 13.935, 13.963, 13.979, 13.988] },
  { st: 16, x:   52.80, hb: [9.315, 10.922, 11.579, 11.998, 12.269, 12.564, 12.791, 13.140, 13.391, 13.569, 13.695, 13.785] },
  { st: 17, x:   61.60, hb: [6.667, 8.331, 9.049, 9.531, 9.869, 10.301, 10.668, 11.298, 11.814, 12.234, 12.574, 12.851] },
  { st: 18, x:   70.40, hb: [3.431, 5.069, 5.768, 6.237, 6.568, 7.003, 7.391, 8.111, 8.763, 9.350, 9.875, 10.347] },
  { st: 19, x:   79.20, hb: [0.238, 1.716, 2.281, 2.626, 2.839, 3.089, 3.324, 3.789, 4.245, 4.690, 5.122, 5.542] },
  { st: 20, x:   88.00, hb: [0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000] },
];

const { LBP: L, B, D } = HULL;

/**
 * Longitudinal fullness at x (from midships) AND height z. Ships are finer near the keel at the ends
 * and fuller at deck level, so fullness is a function of both — that is what makes the waterplane
 * coefficient rise with draft instead of sitting constant.
 *
 * RETIRED FROM THE HULL DEFINITION. The offsets table above is the hull; this remains only as the
 * GENERATOR that fair forms are tabulated from, and as the shape ANKR uses when a new ship needs a
 * first table of offsets before real ones exist.
 */
export function fullness(x, z = D, hull = HULL) {
  const half = hull.LBP / 2, pm = hull.parallel_midbody * half;
  const a = Math.abs(x);
  if (a <= pm) return 1;
  const t = (a - pm) / (half - pm);              // 0 at end of midbody, 1 at the perpendicular
  const base = x >= 0 ? hull.entrance_exp : hull.run_exp;
  const e = base * (1 + hull.keel_fining * Math.min(1, Math.max(0, z / hull.D)));
  const f = Math.max(0, Math.pow(Math.max(0, 1 - Math.pow(t, e)), 1.45));
  // GARBOARD HOLLOW — optional, and ZERO BY DEFAULT so every hull tabulated before it existed is
  // untouched. Added 2026-08-04 because hull-fit measured what the exponents alone could not do: on a
  // full bulk carrier the sections right aft run 0.22 → 1.64 → 2.16 m of half-breadth in the first
  // metre above the keel, and a power-law entrance and run has no term for that steepness — the fit
  // pinned its exponents against their bound trying to make one. The hollow is a CONCAVE cut, deepest
  // at the perpendiculars (t²) and fading upward over its own height, which is what a garboard hollow
  // physically is: the sections come in sharply at the keel and flare above it.
  if (!hull.hollow) return f;
  const zh = Math.max(0.2, hull.hollow_height || 0.15 * hull.D);
  return Math.max(0, f * (1 - hull.hollow * t * t * Math.exp(-Math.max(0, z) / zh)));
}

// ── PURE GEOMETRY — no ship in these ────────────────────────────────────────

/** Clip a polygon to the half-plane  y*sin(t) + z*cos(t) <= c   (Sutherland-Hodgman). */
export function clipBelow(poly, sinT, cosT, c) {
  const inside = (p) => p[0] * sinT + p[1] * cosT <= c;
  const inter = (p, q) => {
    const dp = p[0] * sinT + p[1] * cosT - c, dq = q[0] * sinT + q[1] * cosT - c;
    const t = dp / (dp - dq);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
  };
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i], prv = poly[(i + poly.length - 1) % poly.length];
    const ci = inside(cur), pi = inside(prv);
    if (ci) { if (!pi) out.push(inter(prv, cur)); out.push(cur); }
    else if (pi) out.push(inter(prv, cur));
  }
  return out;
}

/** Exact area and centroid of a simple polygon (shoelace). */
export function areaCentroid(poly) {
  if (!poly || poly.length < 3) return { a: 0, cy: 0, cz: 0 };
  let a = 0, cy = 0, cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [y0, z0] = poly[i], [y1, z1] = poly[(i + 1) % poly.length];
    const cr = y0 * z1 - y1 * z0;
    a += cr; cy += (y0 + y1) * cr; cz += (z0 + z1) * cr;
  }
  a /= 2;
  if (Math.abs(a) < 1e-12) return { a: 0, cy: 0, cz: 0 };
  return { a: Math.abs(a), cy: cy / (6 * a), cz: cz / (6 * a) };
}

/** Simpson weights for n odd stations. */
function simpson(n) {
  const w = new Array(n).fill(0);
  for (let i = 0; i < n; i++) w[i] = i === 0 || i === n - 1 ? 1 : (i % 2 ? 4 : 2);
  return w;
}

/**
 * A HULL FROM A TABLE OF OFFSETS — the engine, with no particular ship in it.
 *
 * Everything above this line describes M.V. ABHYAS; everything below describes how ANY table of
 * offsets is integrated. That split is the whole point: a second ship is a second table, not a
 * second engine. Pass her offsets and her principal dimensions and every hydrostatic, every cross
 * curve and every section polygon follows.
 *
 * @param {object} spec { LBP, B, D, bilge_radius?, STATIONS?, WATERLINES, OFFSETS }
 */
export function makeHull(spec) {
  const { LBP: L, B, D } = spec;
  const WL = spec.WATERLINES, OFF = spec.OFFSETS, NSTATIONS = spec.STATIONS || 81;

  /** Station polygon by interpolating the table — between bracketing stations, and up the waterlines. */
  function stationPolygon(x) {
    const t = OFF;
    let lo = t[0], hi = t[t.length - 1];
    if (x <= t[0].x) { lo = hi = t[0]; }
    else if (x >= t[t.length - 1].x) { lo = hi = t[t.length - 1]; }
    else for (let i = 0; i < t.length - 1; i++) if (x >= t[i].x && x <= t[i + 1].x) { lo = t[i]; hi = t[i + 1]; break; }
    const f = hi.x === lo.x ? 0 : (x - lo.x) / (hi.x - lo.x);
    const hb = lo.hb.map((v, k) => v + (hi.hb[k] - v) * f);
    if (hb[hb.length - 1] <= 1e-6) return null;
    const half = [];
    half.push([0, 0]);
    for (let k = 0; k < WL.length; k++) if (hb[k] > 1e-9 || k === 0) half.push([hb[k], WL[k]]);
    const pts = half.slice();
    for (let i = half.length - 1; i >= 1; i--) pts.push([-half[i][0], half[i][1]]);
    return pts;
  }

  /** Half-breadth at longitudinal x and height z, read straight from the table. */
  function halfBreadth(x, z) {
    const t = OFF;
    let lo = t[0], hi = t[t.length - 1];
    if (x <= t[0].x) lo = hi = t[0];
    else if (x >= t[t.length - 1].x) lo = hi = t[t.length - 1];
    else for (let i = 0; i < t.length - 1; i++) if (x >= t[i].x && x <= t[i + 1].x) { lo = t[i]; hi = t[i + 1]; break; }
    const f = hi.x === lo.x ? 0 : (x - lo.x) / (hi.x - lo.x);
    const row = lo.hb.map((v, k) => v + (hi.hb[k] - v) * f);
    if (z <= WL[0]) return row[0];
    for (let k = 0; k + 1 < WL.length; k++) {
      if (z >= WL[k] && z <= WL[k + 1]) {
        const g = (z - WL[k]) / (WL[k + 1] - WL[k]);
        return row[k] + (row[k + 1] - row[k]) * g;
      }
    }
    return row[row.length - 1];
  }

  /** Immersed volume and centre of buoyancy for a given heel and waterline constant c. */
  function immersed(heelDeg, c) {
    const n = NSTATIONS, w = simpson(n), dx = L / (n - 1);
    const t = heelDeg * Math.PI / 180, sinT = Math.sin(t), cosT = Math.cos(t);
    let V = 0, My = 0, Mz = 0, Mx = 0, Aw = 0, Iy = 0, Mxw = 0, IL = 0;
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + i * dx;
      const poly = stationPolygon(x);
      if (!poly) continue;
      const { a, cy, cz } = areaCentroid(clipBelow(poly, sinT, cosT, c));
      V += w[i] * a; My += w[i] * a * cy; Mz += w[i] * a * cz; Mx += w[i] * a * x;
      if (heelDeg === 0) {                       // upright waterplane, for Cw / I_T / LCF
        let yw = 0;
        for (let q = 0; q < poly.length; q++) {
          const [y0, z0] = poly[q], [y1, z1] = poly[(q + 1) % poly.length];
          if ((z0 - c) * (z1 - c) <= 0 && Math.abs(z1 - z0) > 1e-9) {
            const tt = (c - z0) / (z1 - z0); const yy = y0 + tt * (y1 - y0); if (yy > yw) yw = yy;
          }
        }
        Aw += w[i] * 2 * yw; Iy += w[i] * (2 / 3) * Math.pow(yw, 3);
        Mxw += w[i] * 2 * yw * x; IL += w[i] * 2 * yw * x * x;
      }
    }
    const k = dx / 3;
    V *= k; My *= k; Mz *= k; Mx *= k; Aw *= k; Iy *= k; Mxw *= k; IL *= k;
    const lcf = Aw ? Mxw / Aw : 0;
    const ILc = IL - Aw * lcf * lcf;            // about the centre of flotation (parallel axis)
    return { volume: V, yB: V ? My / V : 0, zB: V ? Mz / V : 0, lcb: V ? Mx / V : 0, Aw, IT: Iy, LCF: lcf, IL: ILc };
  }

  /** Waterline constant c that gives the required volume at this heel — bisection. */
  function solveWaterline(volume, heelDeg) {
    let lo = 0, hi = D * 1.6;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (immersed(heelDeg, mid).volume < volume) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** KN by integration — valid at ANY heel the hull supports, deck edge included. */
  function knExact(volume, heelDeg) {
    if (heelDeg <= 0) return 0;
    const c = solveWaterline(volume, heelDeg);
    const { yB, zB } = immersed(heelDeg, c);
    const t = heelDeg * Math.PI / 180;
    return Math.abs(yB) * Math.cos(t) + zB * Math.sin(t);
  }

  /** Upright hydrostatics straight from the geometry — no declared coefficients. */
  function hydroGeom(T, rho = 1.025) {
    const up = immersed(0, T);
    const V = up.volume, disp = V * rho;
    const Cb = V / (L * B * T), Cw = up.Aw / (L * B);
    const KB = up.zB, BM = up.IT / V, KM = KB + BM;
    const TPC = up.Aw * rho / 100;
    const BML = up.IL / V, MCTC = disp * BML / (100 * L), FWA = disp / (4 * TPC);
    return { draft_m: +T.toFixed(2), volume_m3: +V.toFixed(1), displacement_t: +disp.toFixed(1),
             Cb: +Cb.toFixed(4), Cw: +Cw.toFixed(4), waterplane_area_m2: +up.Aw.toFixed(1),
             TPC_t_per_cm: +TPC.toFixed(3), KB_m: +KB.toFixed(3), BM_m: +BM.toFixed(3),
             KM_m: +KM.toFixed(3), BML_m: +BML.toFixed(1), MCTC_tm_per_cm: +MCTC.toFixed(2),
             LCF_from_midships_m: +up.LCF.toFixed(2), LCB_from_midships_m: +up.lcb.toFixed(2),
             FWA_mm: +FWA.toFixed(1) };
  }

  return { spec, WATERLINES: WL, OFFSETS: OFF, stationPolygon, halfBreadth, immersed, solveWaterline, knExact, hydroGeom };
}

// M.V. ABHYAS, bound to the table above. The named exports below are her instance, so every existing
// caller keeps working unchanged — the factory is additive, not a migration.
export const ABHYAS_HULL = makeHull({ ...HULL, WATERLINES, OFFSETS });
export const stationPolygon = ABHYAS_HULL.stationPolygon;
export const immersed = ABHYAS_HULL.immersed;
export const solveWaterline = ABHYAS_HULL.solveWaterline;
export const knExact = ABHYAS_HULL.knExact;
export const hydroGeom = ABHYAS_HULL.hydroGeom;

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , cmd, a, b] = process.argv;
  if (cmd === 'validate') {
    const rows = [4, 6, 8, 9.95, 11].map((T) => hydroGeom(T));
    console.log(JSON.stringify({ hull: HULL, rows }, null, 2));
  } else if (cmd === 'kn') {
    const vol = +a / 1.025;
    console.log(JSON.stringify({ displacement_t: +a, heel_deg: +b, KN_m: +knExact(vol, +b).toFixed(3) }, null, 2));
  } else console.log(JSON.stringify({ hull: HULL }, null, 2));
}
