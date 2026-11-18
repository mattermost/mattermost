// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export declare const VERBS: readonly [
    'click',
    'clickTo',
    'press',
    'pressTo',
    'select',
    'choose',
    'set',
    'check',
    'uncheck',
    'setPressed',
    'toggle',
    'chooseFiles',
    'blur',
    'dragTo',
    'fill',
    'clear',
    'type',
    'hover',
    'focus',
];

export type Verb = (typeof VERBS)[number];

export declare const PREPARING_VERBS: readonly ['fill', 'clear', 'type', 'hover', 'focus'];

export declare const OBSERVING_VERBS: readonly ['clickTo', 'pressTo'];

/** The verbs `settle(driver, {wait})` offers: every action except the ones that already wait for a destination. */
export type SettleVerb = Exclude<Verb, (typeof OBSERVING_VERBS)[number]>;

export declare const RETRYING_MATCHERS: readonly [
    'toBeOn',
    'toBePressed',
    'toBeSelected',
    'toBeExpanded',
    'toBeSaved',
    'toHavePath',
    'toHaveKeys',
    'toContainKeys',
    'toHaveKeyCount',
    'toContainMessage',
    'toHaveMessage',
];
