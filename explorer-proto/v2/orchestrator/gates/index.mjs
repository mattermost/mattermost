// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// GATE REGISTRY. Stage 7 runs every module listed here, in this order, once per accepted charter.
//
// A gate module is a file in this directory with a default export of this shape:
//
//   export default {
//       id: 'kebab-case-id',              // unique, appears in the gate results file
//       gate: 'lint',                     // one of the verdict gate names (v2/schemas/shared.mjs GATE_NAMES)
//       description: 'one sentence',
//       liveOnly: false,                  // true: never runs in dry mode, the result is blocked (environment)
//       async run(ctx) {                  // ctx: see lib/stages/stage7_verify.mjs, gateContext()
//           return {result: 'pass' | 'fail' | 'blocked', evidence: [{kind, ref}, ...], counts?, failed_at?, blocked_reason?};
//       },
//   };
//
// Rules for a gate: it decides from files and command exit codes only; it never asks an agent; it returns at least one
// evidence reference (a repo or output-relative path, never prose); it returns "blocked" with a blocked_reason, never
// "pass", when it could not run. To add a gate: create the module, import it below, add it to GATES, add a check to
// selftest.mjs. Agent lessons cannot change this directory: lib/lessons_gate.mjs refuses without a human approval.
import discovery from './discovery.mjs';
import duplicateRan from './duplicate_ran.mjs';
import emitted from './emitted.mjs';
import leakage from './leakage.mjs';
import licence from './licence.mjs';
import mutationControl from './mutation_control.mjs';
import repeatReplay from './repeat_replay.mjs';
import schemaValid from './schema_valid.mjs';
import secretScan from './secret_scan.mjs';
import specStatic from './spec_static.mjs';

export const GATES = [
    schemaValid,
    leakage,
    duplicateRan,
    licence,
    discovery,
    emitted,
    specStatic,
    secretScan,
    repeatReplay,
    mutationControl,
];
