// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Route-leakage checks for features and charters, reusing bakeoff/leakage_check.mjs (the frozen rules).
import path from 'node:path';

import {BAKEOFF_DIR} from '../../bakeoff/common.mjs';
import {checkCharter, loadDenyList, ORDERED_PHRASES} from '../../bakeoff/leakage_check.mjs';
import {forbiddenKeyPattern} from '../../schemas/shared.mjs';
import {createValidators} from '../../schemas/validator.mjs';

const CANONICAL_DENY_LIST = 'explorer-proto/v2/bakeoff/deny_labels.json';

// Exemptions an agent-written charter may keep. The free-text ones (**.why, **.source, **.note) are dropped so a
// charter cannot hide ordered-step wording in an explanation field.
const POLICY_EXEMPT = new Set(['fixture', 'fixture_setup', 'negative_controls', 'target_release', 'dedupe']);

const STRICT_RULES = [
    {id: 'L1', kind: 'ordered_phrase'},
    {id: 'L2', kind: 'numbered_steps'},
    {id: 'L3', kind: 'deny_labels', deny_list: CANONICAL_DENY_LIST},
    {id: 'L4', kind: 'unknown_key'},
    {id: 'L5', kind: 'forbidden_key'},
];

let shared;

function tools() {
    shared ??= {
        denyList: loadDenyList(path.join(BAKEOFF_DIR, 'deny_labels.json')),
        validators: createValidators(),
    };
    return shared;
}

function shape(result) {
    return {
        pass: result.pass,
        violations: result.violations.map((v) => ({
            rule: v.rule,
            path: v.path,
            detail: String(v.detail).slice(0, 300),
        })),
    };
}

/** Leakage check of a v2 charter as proposed by an agent. */
export function checkProposedCharter(charter) {
    const copy = structuredClone(charter);
    if (copy.leakage && Array.isArray(copy.leakage.exempt_paths)) {
        copy.leakage.exempt_paths = copy.leakage.exempt_paths.filter((p) => POLICY_EXEMPT.has(p));
    }
    return shape(checkCharter(copy, tools()));
}

function* keysOf(value, at = '') {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            yield* keysOf(value[i], `${at}[${i}]`);
        }
    } else if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            yield {key, at: at ? `${at}.${key}` : key};
            yield* keysOf(value[key], at ? `${at}.${key}` : key);
        }
    }
}

/**
 * Leakage check of a feature file. The charter-shaped fields go through the full five-rule check with no
 * exemptions; the feature's own keys and its title are scanned with the key and phrase rules.
 */
export function checkFeatureLeakage(feature) {
    const projection = {
        schema: 'explorer-charter/v2',
        charter_id: feature.id,
        goal: feature.goal,
        consequence: feature.consequence,
        lane: 'Browser',
        start: feature.start,
        budget: feature.budget,
        action_rules: feature.action_rules,
        oracles: feature.oracles,
        dedupe: {key: feature.id},
        leakage: {rules: STRICT_RULES, exempt_paths: []},
    };
    const result = shape(checkCharter(projection, tools()));
    const forbidden = new RegExp(forbiddenKeyPattern());
    for (const {key, at} of keysOf(feature)) {
        if (forbidden.test(key) || /^[0-9]+$/.test(key)) {
            result.violations.push({rule: 'L5', path: at, detail: `key "${key}" names a route, step or sequence`});
        }
    }
    for (const field of ['title', 'matrix_area']) {
        for (const phrase of ORDERED_PHRASES) {
            if (new RegExp(phrase.pattern, 'iu').test(String(feature[field]))) {
                result.violations.push({rule: 'L1', path: field, detail: `ordered-step wording (${phrase.id})`});
            }
        }
    }
    result.violations.sort((a, b) => `${a.rule}|${a.path}`.localeCompare(`${b.rule}|${b.path}`));
    result.pass = result.violations.length === 0;
    return result;
}
