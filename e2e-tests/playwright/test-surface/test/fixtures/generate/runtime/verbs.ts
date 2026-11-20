// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The action verbs, as data. Owned by the runtime (`e2e-tests/playwright/lib/src/aria/verbs.ts`); the spec lint rules
 * read it. The scanner never does: it records no behaviour, so there is no verb -> events table any more.
 */

/**
 * Every driver method that acts on the page. A driver method that is not here is a query (`isOn`, `value`, `text`) or
 * moves nothing (`scrollIntoView`). The lint rules treat a call of one of these as an ACTION when its receiver's type
 * is a runtime driver or Playwright's `Locator`, `Page`, `Keyboard` or `Mouse`.
 */
export const VERBS = [
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
] as const;

export type Verb = (typeof VERBS)[number];

/**
 * Actions that may be followed by another action without an observation in between: filling fields, or hovering a row
 * to reach its button, and then clicking is one step. After any other action the next action needs an observation: a
 * retrying `expect`, a `settle`, or a `clickTo`/`pressTo`. There is no other exception. The class says nothing about requests. `blur` is not in it.
 */
export const PREPARING_VERBS = ['fill', 'clear', 'type', 'hover', 'focus'] as const satisfies readonly Verb[];

/** Actions that observe themselves: they wait for a destination they were given. */
export const OBSERVING_VERBS = ['clickTo', 'pressTo'] as const satisfies readonly Verb[];

/** The verbs `settle(driver, {wait})` offers: every action except the ones that already wait for a destination. */
export type SettleVerb = Exclude<Verb, (typeof OBSERVING_VERBS)[number]>;

/**
 * The runtime's own matchers that retry until they hold. With Playwright's web-first matchers (`toBeVisible`,
 * `toHaveText`, ...) they are the matchers an `await expect(x).m()` must use to count as an observation. A matcher
 * that reads a value once (`toBe`, `toEqual`) never observes.
 */
export const RETRYING_MATCHERS = [
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
] as const;

/** Methods earlier runtimes had that are second spellings and are removed: `turnOn`/`turnOff` (`set(true)`), `commit`, `submit`. */
