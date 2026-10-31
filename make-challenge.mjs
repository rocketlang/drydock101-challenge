#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// make-challenge.mjs — the Dry Docking 101 challenge: questions about M.V. ABHYAS in dry dock, each with
// an answer COMPUTED from her own table of offsets here and now, never typed. Three questions have no
// numeric answer on purpose: the right answer is NULL with the missing input named.
//
// Opened 31 Oct 2026 under AGPL-3.0-only.
//
//   node make-challenge.mjs            writes questions.json (questions only) and answers.json (key)
import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { hydroGeom } from './abhyas/hull-geometry.mjs';
const SHIP = JSON.parse(readFileSync(new URL('./abhyas/vessel.json', import.meta.url), 'utf8'));
const VESSEL = { LBP: SHIP.LBP_m, lightship: SHIP.lightship_t, lightship_KG: SHIP.lightship_KG_m };
const SCANTLINGS = { duct_keel_half_width: SHIP.bottom_structure.duct_keel_girder_offset_from_CL_m, frame_spacing_holds: SHIP.bottom_structure.frame_spacing_holds_m, solid_floor_every_n_frames: SHIP.bottom_structure.solid_floor_every_n_frames };
const DOCKING_CONDITION = SHIP.docking_condition;

const r = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const draftFor = (D) => { let lo = 0.02, hi = 12; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; (hydroGeom(m).displacement_t < D) ? lo = m : hi = m; } return (lo + hi) / 2; };
const items = DOCKING_CONDITION.items;
const W = VESSEL.lightship + items.reduce((a, x) => a + x.weight_t, 0);
const KG = (VESSEL.lightship * VESSEL.lightship_KG + items.reduce((a, x) => a + x.weight_t * x.kg_m, 0)) / W;
const L = VESSEL.LBP, T0 = draftFor(W), h0 = hydroGeom(T0);
const lA = L / 2 + h0.LCF_from_midships_m, lF = L - lA;
const P = (trim_cm, l = lA) => h0.MCTC_tm_per_cm * trim_cm / l;
const RM = (T, kg = KG) => { const h = hydroGeom(T); return h.displacement_t * h.KM_m - W * kg; };
const runsOut = (kg, from) => { for (let T = from; T > 0.05; T -= 0.005) if (RM(T, kg) <= 0) return T; return null; };
const Tc = draftFor(W - P(100)), hc = hydroGeom(Tc), h1 = hydroGeom(1.0);

const setup = `M.V. ABHYAS, 176 m bulk carrier, docking condition: displacement ${W} t, KG ${r(KG)} m, tanks pressed full or empty, arriving trimmed 1.00 m by the stern. Contact at the after perpendicular unless stated. Hydrostatics from her table of offsets (supplied).`;
const Q = [];
const num = (id, q, value, unit, tol_pct, method) => Q.push({ id, q, kind: 'number', answer: { value, unit, tol_pct }, method });
const nul = (id, q, needs, method) => Q.push({ id, q, kind: 'null', answer: { value: null, needs }, method });

num('D01', 'What force do the after blocks carry at the critical instant?', r(P(100), 1), 't', 1, 'P = MCTC x trim(cm) / distance of the contact from the centre of flotation');
num('D02', 'With how much water above her keel does the critical instant come?', r(Tc, 2), 'm', 1, 'level draft for displacement W - P');
num('D03', 'At the first touch, how much water is above her keel?', r(T0 + 1.0 * lA / L, 2), 'm', 1, 'mean draft + trim x (LCF from AP / L)');
num('D04', 'Effective GM at the critical instant, KM taken at that water level?', r(hc.KM_m - KG - P(100) * hc.KM_m / W), 'm', 1, 'fall of M: GM - P x KM / W');
num('D05', 'Righting moment per radian at the critical instant?', Math.round(RM(Tc)), 't.m', 0.5, 'displacement now x KM now - W x KG');
num('D06', 'The two textbook methods give different effective GMs at the critical instant. What is the difference between them?', r((hc.KM_m - KG * W / (W - P(100))) - (hc.KM_m - KG - P(100) * hc.KM_m / W)), 'm', 2, 'rise of G uses weight W-P, fall of M uses W; the righting moments agree');
num('D07', 'What is her KM with 1.00 m of water above her keel?', h1.KM_m, 'm', 1, 'integrated from the offsets at 1.00 m draft');
num('D08', 'How much of her is on the blocks with 1.00 m of water above her keel?', Math.round(W - h1.displacement_t), 't', 1, 'W - displacement at 1.00 m');
num('D09', 'Effective GM with 1.00 m of water, KM taken at that level?', r(h1.KM_m - KG - (W - h1.displacement_t) * h1.KM_m / W), 'm', 1, 'fall of M with KM now');
num('D10', 'Same question, but someone used the KM she ARRIVED with. What (wrong) effective GM do they get?', r(h0.KM_m - KG - (W - h1.displacement_t) * h0.KM_m / W), 'm', 2, 'the trap: arrival KM');
num('D11', 'After the critical instant, roughly how many tonnes move onto the blocks for each centimetre the dock falls, at 3.0 m of water?', r(hydroGeom(3.0).TPC_t_per_cm, 1), 't/cm', 2, 'TPC at that water level');
num('D12', 'Keeping the 1.00 m trim, how high would KG have to be for her effective GM at the critical instant to reach zero?', r((W - P(100)) * hc.KM_m / W), 'm', 1, 'KG = (W - P) x KM-now / W');
num('D13', 'If she arrived 1.00 m by the HEAD instead, what force would the forward contact carry (contact at the forward perpendicular)?', r(P(100, lF), 1), 't', 1, 'P = MCTC x trim / distance of the FP from the centre of flotation');
num('D14', 'Trimmed 2.00 m by the stern, how much water is pumped between first touch and the critical instant?', r((T0 + 2.0 * lA / L) - draftFor(W - P(200)), 2), 'm', 2, 'first-touch draft aft minus critical-instant level');
num('D15', 'How high would KG have to be for her righting moment on the blocks (no shores) to run out with 1.00 m of water still in the dock? Compare it with her moulded depth of 14.0 m.', r(h1.displacement_t * h1.KM_m / W, 2), 'm', 1, 'KG = displacement-now x KM-now / W, at 1.00 m');
Q.push({ id: 'D16', q: 'At her actual KG, does her righting moment on the blocks run out before the dock is dry?', kind: 'boolean', answer: { value: runsOut(KG, Tc) !== null, unit: null }, method: 'scan every water level from the critical instant down' });
num('D17', 'Her centreline is a duct keel. What is the narrowest centreline keel block that reaches both duct girders?', r(2 * SCANTLINGS.duct_keel_half_width, 2), 'm', 0, 'twice the duct girder offset from the centreline');
num('D18', 'How far apart are her solid floors in the holds?', r(SCANTLINGS.frame_spacing_holds * SCANTLINGS.solid_floor_every_n_frames, 2), 'm', 0, 'frame spacing x solid floor interval');
nul('D19', 'Another ship of the same size arrives. What is her effective GM at the critical instant? (No stability information supplied.)', ['her KG (stability information)', 'her hydrostatics or offsets', 'her arrival trim'], 'nothing about this ship is given; a "typical" value is a wrong answer');
nul('D20', 'ABHYAS arrives with her double-bottom tanks "about half full". What is her effective GM at the critical instant?', ['the contents of each slack tank (free surface moments)'], 'free surface unknown; the GM cannot be computed');
nul('D21', 'Will every keel block bear under strong structure?', ['the block plan'], 'the bottom structure is supplied, the block layout is not');

const questions = Q.map(({ id, q, kind }) => ({ id, q, kind }));
writeFileSync(new URL('./questions.json', import.meta.url), JSON.stringify({ setup, scoring: 'number: within tol_pct of the computed value (absolute 0.01 when tol is 0). null: correct only if the answer declines AND names at least one listed missing input. A number given for a null question scores zero.', questions }, null, 2) + '\n');
writeFileSync(new URL('./answers.json', import.meta.url), JSON.stringify({ generated_by: 'make-challenge.mjs', W_t: W, KG_m: r(KG), answers: Q }, null, 2) + '\n');
console.log(Q.map((x) => `${x.id} ${x.kind.padEnd(7)} ${JSON.stringify(x.answer.value ?? x.answer.needs)} ${x.answer.unit ?? ''}`).join('\n'));
