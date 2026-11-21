// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Self-test for lessons_guard.mjs.
import {guardLesson, isProtectedPath} from './lessons_guard.mjs';

const base = (check, extra = {}) => ({
    schema: 'explorer-lesson/v2',
    id: 'les-900',
    observation: 'A synthetic observation about discovery.',
    evidence: [{kind: 'trace', ref: 'trc-900#t1'}],
    proposed_check: {kind: 'oracle', description: 'A synthetic check.', ...check},
    status: 'proposed',
    applied: false,
    ...extra,
});
const approved = (check, approver = 'qa-lead', extra = {}) => base(check, {status: 'approved', approver, ...extra});

const GATES_TARGET = {target_file: 'explorer-proto/v2/gates/static_spec_check.mjs'};

const CASES = [
    {
        name: 'a proposal for an unprotected file is allowed',
        lesson: base({target_file: 'explorer-proto/v2/oracles/example.mjs'}),
        want: 'pass',
        rules: [],
    },
    {
        name: 'an approved unprotected lesson is allowed',
        lesson: approved({target_file: 'explorer-proto/src/example.ts'}),
        want: 'pass',
        rules: [],
    },
    {name: 'a proposal without a target is allowed', lesson: base({}), want: 'pass', rules: []},
    {
        name: 'a proposal touching the gates directory is refused',
        lesson: base(GATES_TARGET),
        want: 'fail',
        rules: ['protected_target', 'approval_missing'],
    },
    {name: 'an approved gates change by a human is allowed', lesson: approved(GATES_TARGET), want: 'pass', rules: []},
    {
        name: 'approval by an agent handle is refused',
        lesson: approved(GATES_TARGET, 'cursor-agent'),
        want: 'fail',
        rules: ['approver_not_human'],
    },
    {
        name: 'approval by a model handle is refused',
        lesson: approved(GATES_TARGET, 'claude'),
        want: 'fail',
        rules: ['approver_not_human'],
    },
    {
        name: 'approval by an orchestrator handle is refused',
        lesson: approved(GATES_TARGET, 'orchestrator-1'),
        want: 'fail',
        rules: ['approver_not_human'],
    },
    {
        name: 'an empty approver is refused (schema)',
        lesson: approved(GATES_TARGET, ''),
        want: 'fail',
        rules: ['schema_invalid'],
    },
    {
        name: 'a whitespace approver is refused (schema)',
        lesson: approved(GATES_TARGET, '  '),
        want: 'fail',
        rules: ['schema_invalid'],
    },
    {
        name: 'the brief field name approved_by is refused (schema)',
        lesson: {...base(GATES_TARGET, {status: 'approved'}), approved_by: 'qa-lead'},
        want: 'fail',
        rules: ['schema_invalid'],
    },
    {
        name: 'a rejected lesson aimed at a gate is refused',
        lesson: base(GATES_TARGET, {status: 'rejected', approver: 'qa-lead'}),
        want: 'fail',
        rules: ['approval_missing'],
    },
    {
        name: 'promotion_policy.json anywhere is protected',
        lesson: base({target_file: 'somewhere/else/promotion_policy.json'}),
        want: 'fail',
        rules: ['protected_target'],
    },
    {
        name: 'bakeoff rules are protected',
        lesson: base({target_file: 'explorer-proto/v2/bakeoff/rules.json'}),
        want: 'fail',
        rules: ['protected_target'],
    },
    {
        name: 'the preregistration is protected',
        lesson: base({target_file: 'explorer-proto/v2/bakeoff/PREREGISTRATION.md'}),
        want: 'fail',
        rules: ['protected_target'],
    },
    {
        name: 'schemas are protected',
        lesson: base({target_file: 'explorer-proto/v2/schemas/verdict.schema.json'}),
        want: 'fail',
        rules: ['protected_target'],
    },
    {
        name: 'a gate_threshold lesson is protected even with no target',
        lesson: base({kind: 'gate_threshold'}),
        want: 'fail',
        rules: ['protected_kind', 'approval_missing'],
    },
    {
        name: 'a lint_rule lesson is protected',
        lesson: base({kind: 'lint_rule', target_file: 'explorer-proto/src/x.ts'}),
        want: 'fail',
        rules: ['protected_kind'],
    },
    {
        name: 'a leakage_rule lesson is protected',
        lesson: base({kind: 'leakage_rule'}),
        want: 'fail',
        rules: ['protected_kind'],
    },
    {
        name: 'prose naming the gates directory with another target is refused',
        lesson: base({
            target_file: 'explorer-proto/src/x.ts',
            description: 'Relax the threshold in explorer-proto/v2/gates/promotion_policy.json.',
        }),
        want: 'fail',
        rules: ['protected_text'],
    },
    {
        name: 'a lesson that claims to be applied is refused',
        lesson: {...base({}), applied: true},
        want: 'fail',
        rules: ['schema_invalid', 'applied_not_false'],
    },
];

const PATHS = [
    ['explorer-proto/v2/gates/x.mjs', true],
    ['./explorer-proto/v2/gates/x.mjs', true],
    ['explorer-proto/v2/./gates/../gates/x.mjs', true],
    ['Explorer-Proto/V2/Gates/X.mjs', true],
    ['explorer-proto\\v2\\gates\\x.mjs', true],
    ['/explorer-proto/v2/gates', true],
    ['explorer-proto/v2/%67ates/x.mjs', true],
    ['explorer-proto/v2/gates-extra/x.mjs', false],
    ['explorer-proto/v2/oracles/x.mjs', false],
    ['explorer-proto/src/x.ts', false],
    ['../outside.mjs', true],
    ['explorer-proto/v2/gates/../oracles/x.mjs', false],
];

export function selftestChecks() {
    const checks = CASES.map((c) => {
        const result = guardLesson(c.lesson);
        const rules = result.evidence.map((e) => e.rule);
        const missing = c.rules.filter((r) => !rules.includes(r));
        const ok = result.status === c.want && missing.length === 0;
        return {
            name: `lessons_guard: ${c.name}`,
            ok,
            detail: ok ? '' : `status ${result.status}; missing ${missing.join(',') || 'none'}; got ${rules.join(',')}`,
        };
    });
    for (const [raw, want] of PATHS) {
        checks.push({
            name: `lessons_guard: path ${JSON.stringify(raw)} protected=${want}`,
            ok: isProtectedPath(raw) === want,
            detail: '',
        });
    }
    const bypass = guardLesson(
        {
            ...approved(GATES_TARGET, 'qa-lead'),
            proposed_check: {kind: 'oracle', description: 'x', target_file: 'explorer-proto/v2/./gates/../gates/x.mjs'},
        },
        {validateSchema: false},
    );
    checks.push({
        name: 'lessons_guard: a traversal path is still recognised when schema validation is off',
        ok: bypass.protected,
        detail: '',
    });
    return checks;
}
