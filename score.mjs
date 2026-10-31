#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// score.mjs — score a set of answers to the Dry Docking 101 challenge against the computed key.
// Input: a JSON file { "D01": 433.4, "D16": false, "D19": { "null": true, "needs": "her KG" }, ... }
// A number for a null question scores zero; a null for a number question scores zero.
//   node score.mjs my-answers.json
import { readFileSync } from 'node:fs';
const key = JSON.parse(readFileSync(new URL('./answers.json', import.meta.url))).answers;
const mine = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let score = 0;
for (const q of key) {
  const a = mine[q.id]; let ok = false;
  if (q.kind === 'number' && typeof a === 'number') {
    const tol = q.answer.tol_pct ? Math.abs(q.answer.value) * q.answer.tol_pct / 100 : 0.01;
    ok = Math.abs(a - q.answer.value) <= tol;
  } else if (q.kind === 'boolean') ok = a === q.answer.value;
  else if (q.kind === 'null' && a && a.null === true) {
    const said = String(a.needs || '').toLowerCase();
    ok = q.answer.needs.some((n) => n.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3).some((w) => said.includes(w)));
  }
  score += ok; console.log(`${q.id} ${ok ? 'PASS' : 'FAIL'}  expected ${JSON.stringify(q.answer.value ?? { null: true, needs: q.answer.needs })}  got ${JSON.stringify(a ?? 'nothing')}`);
}
console.log(`\n${score} / ${key.length}`);
