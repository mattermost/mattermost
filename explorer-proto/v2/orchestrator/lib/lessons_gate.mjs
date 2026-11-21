// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Decides whether a lesson may be applied. A lesson that would change a gate, a rules file or a threshold needs a
// human approval recorded in the lesson itself (status approved plus an approver). This file only decides; applying a
// lesson is an ordinary reviewed change made by a person, and no pipeline code edits a protected file.
import path from 'node:path';

import {isHumanApprover} from '../../gates/common.mjs';
import {guardLesson, isProtectedPath as guardProtects} from '../../gates/lessons_guard.mjs';

const PROTECTED_PATHS = [
    /^explorer-proto\/v2\/orchestrator\/(?:gates|lib|schemas|config)\//,
    /^explorer-proto\/v2\/orchestrator\/(?:pilot|selftest)\.mjs$/,
    /^explorer-proto\/v2\/gates\//,
    /^explorer-proto\/v2\/schemas\//,
    /^explorer-proto\/v2\/bakeoff\//,
    /^explorer-proto\/v2\/index\/(?:similarity|fingerprint|coverage-check)\.mjs$/,
    /^explorer-proto\/v2\/oracles\/(?:lib\/|allowlist\.json|benign-hints\.json)/,
    /^explorer-proto\/infra\/scripts\/leak_scan\.mjs$/,
    /^explorer-proto\/src\//,
    /(?:^|\/)rules\.json$/,
    /(?:^|\/)allowlist\.json$/,
    /(?:^|\/)deny_labels\.json$/,
];

// These kinds change gate logic or thresholds by definition, whatever file they name.
const PROTECTED_KINDS = new Set(['gate_threshold', 'leakage_rule', 'lint_rule', 'oracle']);

export function isProtectedPath(file) {
    const normal = path.posix.normalize(String(file));
    return PROTECTED_PATHS.some((re) => re.test(normal)) || guardProtects(file);
}

export function assessLesson(lesson) {
    const target = lesson.proposed_check.target_file;
    const guard = guardLesson(lesson);
    const protectedTarget =
        PROTECTED_KINDS.has(lesson.proposed_check.kind) ||
        (target ? isProtectedPath(target) : false) ||
        guard.protected;
    const approved = lesson.status === 'approved' && isHumanApprover(lesson.approver);
    if (!protectedTarget && guard.status === 'pass') {
        return {protectedTarget, decision: 'eligible', reason: 'does not touch a gate, a rules file or a threshold'};
    }
    if (protectedTarget && approved && guard.status === 'pass') {
        return {
            protectedTarget,
            decision: 'eligible_approved',
            reason: `human approval recorded by ${lesson.approver}`,
        };
    }
    let reason = `lessons_guard refused it (${guard.evidence.map((e) => e.rule).join(', ')})`;
    if (protectedTarget) {
        reason = 'touches a gate, a rules file or a threshold and has no recorded human approval';
    }
    return {protectedTarget, decision: 'refused_needs_human_approval', reason};
}
