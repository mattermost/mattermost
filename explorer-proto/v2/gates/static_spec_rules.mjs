// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Rule catalogue and constants for static_spec_check.mjs.
import path from 'node:path';

import {REPO_ROOT} from './common.mjs';

export const TS_DIR = path.join(REPO_ROOT, 'e2e-tests/playwright/node_modules/typescript');
export const DEFAULT_CONFIG = path.join(REPO_ROOT, 'e2e-tests/playwright/playwright.config.ts');
export const FALLBACK_TIMEOUTS = {testTimeoutMs: 60000, expectTimeoutMs: 10000};
export const DURATIONS = {
    half_sec: 500,
    one_sec: 1000,
    two_sec: 2000,
    four_sec: 4000,
    ten_sec: 10000,
    half_min: 30000,
    one_min: 60000,
    two_min: 120000,
    four_min: 240000,
    ten_min: 600000,
};

export const RULES = {
    'parse-error': 'The spec does not parse.',
    'no-tests': 'The file declares no test.',
    'sleep-wait': 'page.waitForTimeout / setTimeout / sleep style waits (lesson 2: timing, not state).',
    'soft-declared': 'expect.soft without a `// soft-ok: <reason>` marker (lessons 2 and 7).',
    'soft-consecutive': 'More consecutive soft assertions than the cap (default 3).',
    'timeout-risk': 'Worst-case soft count x expect timeout exceeds the test timeout (lesson 2).',
    'css-xpath-locator': 'locator()/$()/querySelector with a CSS or XPath string; only getByRole and getByTestId.',
    'get-by-text-presence': 'getByText with a non-exact string in a presence assertion.',
    'regex-presence': 'Regex name or text in a presence assertion.',
    'presence-name-not-exact': 'Presence name match without exact: true.',
    'action-not-role': 'UI action through a locator that is not role-based.',
    'action-name-not-exact': 'UI action through a role name that is not exact.',
    'absence-exact-name': 'Absence assertion on an exact name without `// absence-verified: <probe id>` (lesson 1).',
    'unread-suffix': 'Exact sidebar link name in a spec that creates posts (lesson 3), without `// unread-ok:`.',
    'skip-fixme': 'test.skip / test.fixme / skipIf* anywhere (lesson 7).',
    'test-only': 'test.only / describe.only.',
    'retries-config': 'A retries setting inside the spec.',
    'describe-parallel': 'test.describe.configure with mode parallel (one worker per server).',
    'raw-url': 'An origin, loopback host, IP address or port in a string or comment.',
    'server-id': 'A 26-character server id in a string or comment.',
    'password-literal': 'A password, token or secret literal.',
    'random-data': 'Random-suffix helpers where the charter fixes the text, without `// random-ok:`.',
    'missing-objective': 'A test without an @objective comment.',
    'no-trailing-assertion': 'A test with no assertion after its last UI action.',
    'label-missing': 'An assertion line without `// declared (...)` or `// smoke: ...`.',
    'unawaited-assertion': 'A web-first assertion that is not awaited (it can never fail the test).',
};

export const ASYNC_MATCHERS = new Set([
    'toBeAttached',
    'toBeChecked',
    'toBeDisabled',
    'toBeEditable',
    'toBeEmpty',
    'toBeEnabled',
    'toBeFocused',
    'toBeHidden',
    'toBeInViewport',
    'toBeVisible',
    'toContainClass',
    'toContainText',
    'toHaveAccessibleDescription',
    'toHaveAccessibleName',
    'toHaveAttribute',
    'toHaveClass',
    'toHaveCount',
    'toHaveCSS',
    'toHaveId',
    'toHaveJSProperty',
    'toHaveRole',
    'toHaveText',
    'toHaveTitle',
    'toHaveURL',
    'toHaveValue',
    'toHaveValues',
    'toMatchAriaSnapshot',
    'toPass',
]);
export const ELEMENT_EXISTENCE = new Set([
    'toBeVisible',
    'toBeAttached',
    'toBeHidden',
    'toBeDetached',
    'toBeInViewport',
]);
export const ACTIONS = new Set([
    'click',
    'dblclick',
    'fill',
    'press',
    'pressSequentially',
    'type',
    'check',
    'uncheck',
    'setChecked',
    'selectOption',
    'hover',
    'tap',
    'focus',
    'blur',
    'dragTo',
    'clear',
    'setInputFiles',
]);
export const NAVIGATION = new Set(['goto', 'reload', 'goBack', 'goForward']);
export const TEXT_FACTORIES = new Set([
    'getByRole',
    'getByText',
    'getByLabel',
    'getByPlaceholder',
    'getByAltText',
    'getByTitle',
]);
export const LOCATOR_FACTORIES = new Set([...TEXT_FACTORIES, 'getByTestId', 'locator']);
export const SELECTOR_CALLS = new Set([
    'locator',
    'frameLocator',
    '$',
    '$$',
    '$eval',
    '$$eval',
    'querySelector',
    'querySelectorAll',
]);
export const SLEEP_CALLS = new Set(['waitForTimeout', 'setTimeout', 'setInterval', 'sleep', 'delay']);
export const POST_CALLS = /^(createPost|createPosts|postMessage|sendMessage|postReply|createReply|postThread)$/i;
export const RANDOM_SEGMENT = /random|^uuid|^nanoid$|^faker$|^initSetup$/i;
export const LEAK_PATTERNS = [
    /[a-z][a-z0-9+.-]*:\/\//i,
    /\b127\.0\.0\.1\b/,
    /\blocalhost\b/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    /\[::1\]/,
    /\bhost\.docker\.internal\b/i,
];
// Sidebar channel link names end like this ("<name> public channel"); other links never carry the unread suffix.
export const SIDEBAR_LINK_NAME = /(?:public|private|archived) channel(?: unread)?$|direct message$|group message$/i;
export const SERVER_ID = /\b(?=[a-z0-9]*\d)[a-z0-9]{26}\b/;
export const SECRET_KEY = /^(pass(word|wd)?|pwd|secret|token|api[-_]?key|authorization|auth[-_]?token)$/i;
export const SECRET_TEXT = /\bpassword\s*[:=]|\bBearer\s|MMAUTHTOKEN|MMCSRF/i;
