// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Constants shared by the schemas and the scripts that must agree with them.
// The schema files embed the generated key pattern; selftest.mjs checks that they match.

export const FORBIDDEN_KEY_WORDS = [
    'step',
    'route',
    'sequence',
    'walkthrough',
    'script',
    'procedure',
    'recipe',
    'playbook',
    'itinerary',
    'waypoint',
    'breadcrumb',
    'reachable',
    'click',
    'navigate',
];

function caseInsensitiveWord(word) {
    const first = word[0];
    const rest = word
        .slice(1)
        .split('')
        .map((c) => `[${c}${c.toUpperCase()}]`)
        .join('');
    const left = `(?:(?<![A-Za-z])[${first}${first.toUpperCase()}]|(?<=[a-z])${first.toUpperCase()})`;
    return `${left}${rest}[sS]?(?![a-z])`;
}

// Matches a property name that contains one of the forbidden words as a whole snake_case, kebab-case or camelCase token.
export function forbiddenKeyPattern() {
    return `(?:${FORBIDDEN_KEY_WORDS.map(caseInsensitiveWord).join('|')})`;
}

// Text that must never appear in evidence strings: origins, loopback hosts, session material, 26-character ids.
export const UNSAFE_TEXT_PATTERN =
    '(?:https?://|\\b127\\.0\\.0\\.1\\b|\\blocalhost\\b|MMAUTHTOKEN|MMCSRF|\\bBearer\\s|\\bpassword\\s*[:=]|\\b(?=[a-z0-9]*[0-9])[a-z0-9]{26}\\b)';

export const ORACLE_CLASSES = [
    'console_error',
    'uncaught_exception',
    'failed_request',
    'http_server_error',
    'dead_control',
    'stale_content',
    'state_not_persisted',
    'typed_input_ignored',
    'keyboard_unreachable',
    'focus_lost',
    'accessible_name_missing',
    'layout_overflow',
    'unexpected_dialog',
    'unexpected_reload',
];

export const OUTCOMES = ['emitted_passing', 'rejected_duplicate', 'rejected_unreachable', 'failed', 'blocked'];

export const GATE_NAMES = [
    'schema',
    'guard',
    'licence',
    'duplicate',
    'leakage',
    'discovery',
    'emit',
    'lint',
    'stability',
    'control_sensitivity',
    'secret_scan',
];

export const HELD_OUT_FEATURES = ['F1', 'F2', 'F3', 'F4'];
