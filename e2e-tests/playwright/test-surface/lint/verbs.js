// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The action verbs, as data. The spec lint rules read it, and the runtime re-exports it (`lib/src/aria/verbs.ts`). The
// scanner never does: the report records no behaviour.

/**
 * Every driver method that acts on the page. A driver method that is not here is a query (`isOn`, `value`, `text`) or
 * moves nothing (`scrollIntoView`). The lint rules treat a call of one of these as an action when its receiver's type is
 * a runtime driver or Playwright's `Locator`, `Page`, `Keyboard` or `Mouse`.
 */
export const VERBS = Object.freeze([
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
]);

/**
 * Actions that may be followed by another action without an observation in between: filling fields, or hovering a row
 * to reach its button, and then clicking is one step. The class says nothing about requests. `blur` is not in it.
 */
export const PREPARING_VERBS = Object.freeze(['fill', 'clear', 'type', 'hover', 'focus']);

/** Actions that observe themselves: they wait for a destination they were given. */
export const OBSERVING_VERBS = Object.freeze(['clickTo', 'pressTo']);

/**
 * The runtime's own matchers that retry until they hold. With Playwright's web-first matchers they are the matchers an
 * `await expect(x).m()` must use to count as an observation. A matcher that reads a value once (`toBe`) never observes.
 */
export const RETRYING_MATCHERS = Object.freeze([
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
]);
