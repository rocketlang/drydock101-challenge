# Dry Docking 101: the challenge

21 questions about one ship in a dry dock. 18 have an answer computed from her hull geometry. 3 have **no** numeric answer on purpose: for those, the right answer is to decline and name what is missing.

Try it yourself, or ask your favourite AI model, and score the result.

## The ship

**M.V. ABHYAS**, a 176 m geared bulk carrier from ANKR's training fleet. She is not a copy of any real ship: she is built to the envelope of a real 32,000 dwt type. She is defined by her own **table of offsets** (half-breadths at 21 stations × 12 waterlines, in `abhyas/hull-geometry.mjs`), and every hydrostatic figure (displacement, KB, BM, KM, TPC, MCTC, the centre of flotation, KN) is integrated from that shape. Nothing is typed in.

Docking condition (a teaching declaration, not a docking plan): 11,604 t, KG 6.293 m, tanks pressed full or empty, arriving 1.00 m by the stern. See `abhyas/vessel.json`.

## Files

| File | What it is |
|---|---|
| `questions.json` | the 21 questions and the setup, no answers |
| `answers.json` | the computed key, with the method for each |
| `make-challenge.mjs` | regenerates the key from the ship's geometry |
| `score.mjs` | scores a set of answers against the key |
| `abhyas/hull-geometry.mjs` | her table of offsets and the hydrostatics, integrated numerically |
| `abhyas/vessel.json` | her particulars, bottom structure and docking condition |

Node 18 or later, no dependencies, no network.

```
node make-challenge.mjs          # rebuild questions.json and answers.json from her hull
node score.mjs my-answers.json   # score your answers
node abhyas/hull-geometry.mjs particulars
```

## Answer format

```json
{ "D01": 433.4, "D16": false, "D19": { "null": true, "needs": "her KG" } }
```

## Scoring

- **Numbers:** within the stated tolerance of the computed value.
- **True/false:** must match.
- **Null questions:** correct only if the answer **declines** and **names a missing input** (for example "her KG"). A number given for a null question scores zero, however plausible it looks.

The key scores 21/21. A set that takes KM at her arrival draft and gives a "typical" GM for an unknown ship scores 19/21.

## Why the null questions

In 2018 the car carrier *Makassar Highway* sat aground off Västervik for nearly six days. The estimate of how hard the bank was pushing up on her went from 350–400 t to 840 t to 57 t, and her own loading computer "was not able to show ground reaction or take into account damaged compartments" (SHK, report RS 2019:04e). A confident wrong number is worse than none. A good docking assistant computes what it can, quotes what it relies on, and says plainly what it does not know.

## See it in 3D

Every episode of *Dry Docking 101* and *Damage Stability 101*, computed from the same kind of geometry: **https://mari8x.com/dock**

## Not a docking plan

Teaching figures on a training ship. Nothing here replaces a real ship's approved docking plan or stability information.

## Licence

AGPL-3.0-only. See `LICENSE`.

*Directed by a Master Mariner, built with an AI assistant.*

Copyright (C) 2026 Capt. Anil Sharma, ANKR Labs. Licensed under the GNU Affero General Public License, version 3 only (`SPDX-License-Identifier: AGPL-3.0-only`).
