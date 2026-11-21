#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Route-leakage checker for explorer charters.
//   node leakage_check.mjs [--deny-list <file>] [--fragment <out.json>] [--json] <charter.json>...
// Prints PASS or FAIL per charter and the offending JSON paths. Exit 0 all PASS, 1 any FAIL, 2 usage or load error.
// Rules (ids come from the charter's leakage section; legacy v1 charters get all of them):
//   ordered_phrase  ordered-step wording such as "then click", "click X then Y", "step 2", arrow chains
//   numbered_steps  numbered lists inside prose
//   deny_labels     control labels that belong to OTHER sessions (deny_labels.json)
//   unknown_key     any key the charter schema does not define
//   forbidden_key   any key that names a route, step, sequence, script, ... (and digit-only keys)
import path from 'node:path';

import {forbiddenKeyPattern} from '../schemas/shared.mjs';
import {createValidators} from '../schemas/validator.mjs';

import {BAKEOFF_DIR, canonicalJson, isMain, parseArgs, readJson, writeJson} from './common.mjs';

const VERBS =
    '(?:click|clicks|clicking|press|presses|tap|taps|open|opens|select|selects|choose|chooses|navigate|navigates|go|goes|type|types|enter|enters|expand|expands|toggle|toggles|hit|hits|submit|submits|scroll|scrolls)';

export const ORDERED_PHRASES = [
    {id: 'then_verb', pattern: `\\bthen\\s+(?:to\\s+)?${VERBS}\\b`},
    {
        id: 'verb_then',
        pattern:
            '\\b(?:click|clicks|press|presses|tap|select|selects|choose|navigate|type|types)\\b[^.;:!?\\n]{0,60}?\\bthen\\b',
    },
    {
        id: 'sequence_word_verb',
        pattern: `\\b(?:first|next|after that|afterwards|finally|lastly)\\b[\\s,:-]*${VERBS}\\b`,
    },
    {id: 'step_number', pattern: '\\bstep\\s*(?:[0-9]+|one|two|three|four|five|six)\\b'},
    {id: 'arrow_chain', pattern: '(?:→|->|=>|»)[^→>»\\n]*?(?:→|->|=>|»)'},
];
const NUMBERED_ITEM = /(?:^|[\n;]|\s)\(?[0-9]{1,2}[.)]\s+\S/g;
const NUMBERED_START = /^\s*\(?[0-9]{1,2}[.)]\s/;
const DIGIT_KEY = /^[0-9]+$/;

// Subtrees that may be exempted from the prose rules (the schema enum must match this list).
export const EXEMPTABLE = [
    'fixture',
    'fixture_setup',
    'negative_controls',
    'target_release',
    'dedupe',
    'qualifies_reason',
    '**.source',
    '**.why',
    '**.note',
];
const CANONICAL_DENY_LIST = 'explorer-proto/v2/bakeoff/deny_labels.json';
const LEGACY_RULES = [
    {id: 'L1', kind: 'ordered_phrase'},
    {id: 'L2', kind: 'numbered_steps'},
    {id: 'L3', kind: 'deny_labels', deny_list: CANONICAL_DENY_LIST},
    {id: 'L4', kind: 'unknown_key'},
    {id: 'L5', kind: 'forbidden_key'},
];

function pathOf(parent, key) {
    if (typeof key === 'number') {
        return `${parent}[${key}]`;
    }
    return parent === '' ? key : `${parent}.${key}`;
}

function* walk(value, at = '') {
    if (typeof value === 'string') {
        yield {path: at, value};
    } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            yield* walk(value[i], pathOf(at, i));
        }
    } else if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            yield* walk(value[key], pathOf(at, key));
        }
    }
}

function* walkKeys(value, at = '') {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            yield* walkKeys(value[i], pathOf(at, i));
        }
    } else if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            yield {path: pathOf(at, key), key};
            yield* walkKeys(value[key], pathOf(at, key));
        }
    }
}

function isExempt(at, exemptions) {
    const lastKey = at
        .split('.')
        .pop()
        .replace(/\[[0-9]+\]$/g, '');
    return exemptions.some((rule) => {
        if (rule.startsWith('**.')) {
            return lastKey === rule.slice(3) || at.includes(`.${rule.slice(3)}.`) || at.includes(`.${rule.slice(3)}[`);
        }
        return at === rule || at.startsWith(`${rule}.`) || at.startsWith(`${rule}[`);
    });
}

function snippet(text, index, length) {
    const start = Math.max(0, index - 10);
    return text
        .slice(start, start + Math.min(60, length + 20))
        .replace(/\s+/g, ' ')
        .trim();
}

export function loadDenyList(file) {
    const data = readJson(file);
    if (data.schema !== 'explorer-deny-labels/v1' || !Array.isArray(data.labels)) {
        throw new Error('deny list is not an explorer-deny-labels/v1 file');
    }
    return data;
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ownIdentity(charter, charterPath) {
    const ids = [charter.charter_id, charter.journey_id, charter.feature_id].flat().filter(Boolean);
    const dir = charterPath ? path.basename(path.dirname(path.resolve(charterPath))) : null;
    const labels = (charter.allowed_actions ?? []).map((a) => a.name.toLowerCase());
    return {ids, dir, labels};
}

export function checkCharter(charter, {denyList, validators, charterPath = null} = {}) {
    const violations = [];
    const add = (rule, at, detail) => violations.push({rule, path: at || '/', detail});
    const rules = charter.leakage?.rules ?? LEGACY_RULES;
    const kinds = new Set(rules.map((r) => r.kind));
    const exemptions = charter.leakage ? charter.leakage.exempt_paths : EXEMPTABLE;
    const ruleIdOf = (kind) => rules.find((r) => r.kind === kind)?.id ?? kind;

    for (const kind of ['ordered_phrase', 'numbered_steps', 'deny_labels', 'unknown_key', 'forbidden_key']) {
        if (!kinds.has(kind)) {
            add('rule_set', 'leakage.rules', `mandatory rule kind "${kind}" is missing`);
        }
    }
    if (rules.some((r) => r.kind === 'deny_labels' && r.deny_list !== CANONICAL_DENY_LIST)) {
        add('rule_set', 'leakage.rules', `deny_list must be ${CANONICAL_DENY_LIST}, the frozen list`);
    }
    const prose = [...walk(charter)].filter(
        (s) =>
            !s.path.startsWith('leakage') &&
            !isExempt(s.path, exemptions) &&
            !/^allowed_actions\[[0-9]+\]\.name$/.test(s.path),
    );

    if (kinds.has('ordered_phrase')) {
        const extra = rules.filter((r) => r.kind === 'ordered_phrase').flatMap((r) => r.patterns ?? []);
        const patterns = [...ORDERED_PHRASES.map((p) => p.pattern), ...extra].map((p) => new RegExp(p, 'iu'));
        for (const item of prose) {
            for (const re of patterns) {
                const m = re.exec(item.value);
                if (m) {
                    add(
                        ruleIdOf('ordered_phrase'),
                        item.path,
                        `matched "${snippet(item.value, m.index, m[0].length)}"`,
                    );
                    break;
                }
            }
        }
    }

    if (kinds.has('numbered_steps')) {
        for (const item of prose) {
            const items = item.value.match(NUMBERED_ITEM)?.length ?? 0;
            if (items >= 2 || NUMBERED_START.test(item.value)) {
                add(ruleIdOf('numbered_steps'), item.path, 'numbered list item in prose');
            }
        }
    }

    if (kinds.has('deny_labels') && denyList) {
        const own = ownIdentity(charter, charterPath);
        const active = denyList.labels.filter(
            (e) =>
                e.label.length >= denyList.min_length &&
                !own.labels.includes(e.label.toLowerCase()) &&
                !e.sources.some((s) => s.id === own.dir || own.ids.includes(s.id)),
        );
        for (const entry of active) {
            const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(entry.label)}(?![A-Za-z0-9])`, 'i');
            for (const item of prose) {
                if (re.test(item.value)) {
                    add(ruleIdOf('deny_labels'), item.path, `names control "${entry.label}" of another session`);
                }
            }
        }
    }

    if (kinds.has('forbidden_key')) {
        const forbidden = new RegExp(forbiddenKeyPattern());
        for (const {path: at, key} of walkKeys(charter)) {
            if (forbidden.test(key) || DIGIT_KEY.test(key)) {
                add(ruleIdOf('forbidden_key'), at, `key "${key}" names a route, step or sequence`);
            }
        }
    }

    if (kinds.has('unknown_key')) {
        const validate = validators.get('charter');
        validate(charter);
        const seen = new Set();
        for (const e of validate.errors ?? []) {
            let at = null;
            if (e.keyword === 'additionalProperties') {
                at = `${e.instancePath}/${e.params.additionalProperty}`;
            } else if (e.keyword === 'false schema') {
                at = e.instancePath;
            }
            if (at !== null && !seen.has(at)) {
                seen.add(at);
                add(
                    ruleIdOf('unknown_key'),
                    at
                        .replace(/^\//, '')
                        .replace(/\/([0-9]+)(?=\/|$)/g, '[$1]')
                        .replace(/\//g, '.'),
                    'key is not defined by the charter schema',
                );
            }
        }
    }

    violations.sort((a, b) => `${a.rule}|${a.path}`.localeCompare(`${b.rule}|${b.path}`));
    return {pass: violations.length === 0, violations, namedControls: (charter.allowed_actions ?? []).length};
}

function main(argv) {
    const {flags, positional} = parseArgs(argv, {booleans: ['json']});
    if (positional.length === 0) {
        process.stderr.write(
            'usage: leakage_check.mjs [--deny-list f] [--fragment out.json] [--json] <charter.json>...\n',
        );
        return 2;
    }
    let denyList;
    let validators;
    try {
        denyList = loadDenyList(flags['deny-list'] ?? path.join(BAKEOFF_DIR, 'deny_labels.json'));
        validators = createValidators();
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        return 2;
    }
    let failed = false;
    const reports = [];
    for (const file of positional) {
        let charter;
        try {
            charter = readJson(file);
        } catch {
            process.stderr.write(`cannot read ${file} as JSON\n`);
            return 2;
        }
        const result = checkCharter(charter, {denyList, validators, charterPath: file});
        reports.push({file, ...result});
        failed ||= !result.pass;
    }
    if (flags.json) {
        process.stdout.write(canonicalJson(reports));
    } else {
        for (const r of reports) {
            process.stdout.write(`${r.pass ? 'PASS' : 'FAIL'} ${r.file}\n`);
            for (const v of r.violations) {
                process.stdout.write(`  ${v.rule} ${v.path}: ${v.detail}\n`);
            }
            process.stdout.write(`  info: named_controls=${r.namedControls}\n`);
        }
    }
    if (flags.fragment) {
        writeJson(flags.fragment, {
            charters_checked: reports.length,
            violations: reports.reduce((n, r) => n + r.violations.length, 0),
            named_controls: reports.reduce((n, r) => n + r.namedControls, 0),
        });
    }
    return failed ? 1 : 0;
}

if (isMain(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}
