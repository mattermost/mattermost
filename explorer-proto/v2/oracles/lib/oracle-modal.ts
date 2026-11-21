// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserContext, Locator, Page, Request} from '@playwright/test';

import {globToRegExp} from './findings.ts';
import type {FindingSink} from './findings.ts';
import {pagePath} from './oracle-events.ts';

export type ModalTarget = {
    page: Page;
    context: BrowserContext;
    origin: string;
    sink: FindingSink;
    action: number;
    dialog: Locator;
    confirm: Locator;
    field: Locator;
};

export type ModalResult = {
    status: 'pass' | 'fail' | 'precondition-unmet';
    detail: string;
    /** Sanitized method + path of every state-changing request seen during the probe. */
    requests: string[];
    feedback?: 'text' | 'dialog-open' | 'none';
};

const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];
// Background polls that fire on their own schedule and are never the result of a form submit.
const DEFAULT_BACKGROUND = ['/api/v4/users/status/ids'];
const DEFAULT_BASELINE_MS = 400;

export type RequestFilter = {
    methods?: string[];
    /** Globs over the request pathname; when set, only matching requests count as a submit. */
    submitPaths?: string[];
    /** Globs over the request pathname that never count (default: known background polls). */
    ignorePaths?: string[];
};
const DEFAULT_FEEDBACK_SELECTORS = [
    '[role="alert"]',
    '[aria-live="assertive"]',
    '[aria-invalid="true"] ~ [class*="error" i]',
    '[data-testid*="error" i]',
    '[class*="error" i]',
    '.has-error',
];

function recordRequests(context: BrowserContext, origin: string, filter: RequestFilter, sink: FindingSink) {
    const methods = filter.methods ?? MUTATING;
    const ignore = (filter.ignorePaths ?? DEFAULT_BACKGROUND).map(globToRegExp);
    const only = filter.submitPaths?.map(globToRegExp);
    const seen: string[] = [];
    const listener = (request: Request) => {
        const url = new URL(request.url());
        if (url.origin !== origin || !methods.includes(request.method())) {
            return;
        }
        if (ignore.some((re) => re.test(url.pathname)) || (only && !only.some((re) => re.test(url.pathname)))) {
            return;
        }
        seen.push(`${request.method()} ${sink.scrubber.path(url.pathname)}`);
    };
    context.on('request', listener);
    return {seen, stop: () => context.off('request', listener)};
}

/** Requests seen while nothing is being done: their signatures are not attributed to the later keypress. */
async function baselineSignatures(target: ModalTarget, filter: RequestFilter, ms: number): Promise<Set<string>> {
    if (ms <= 0) {
        return new Set();
    }
    const recorder = recordRequests(target.context, target.origin, filter, target.sink);
    await target.page.waitForTimeout(ms);
    recorder.stop();
    return new Set(recorder.seen);
}

/**
 * O-MODAL (a): with the confirm button disabled, Enter in the field must not dispatch a state-changing request.
 * Needs the Enter key; needs typing only if the field must be filled to reach the disabled state.
 */
export async function checkEnterWhileConfirmDisabled(
    target: ModalTarget,
    options: RequestFilter & {settleMs?: number; baselineMs?: number} = {},
): Promise<ModalResult> {
    const {page, context, origin, sink, action, confirm, field} = target;
    const disabled = (await confirm.isDisabled()) || (await confirm.getAttribute('aria-disabled')) === 'true';
    if (!disabled) {
        return {status: 'precondition-unmet', detail: 'confirm button is not disabled', requests: []};
    }
    const baseline = await baselineSignatures(target, options, options.baselineMs ?? DEFAULT_BASELINE_MS);
    const recorder = recordRequests(context, origin, options, sink);
    try {
        await field.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(options.settleMs ?? 600);
    } finally {
        recorder.stop();
    }
    const attributed = recorder.seen.filter((signature) => !baseline.has(signature));
    if (attributed.length > 0) {
        sink.add({
            oracle: 'O-MODAL',
            class: 'enter-submits-while-disabled',
            path: pagePath(page),
            evidence: `Enter in the field dispatched ${attributed.join(', ')} while the confirm button was disabled`,
            action,
        });
        return {status: 'fail', detail: 'request dispatched', requests: attributed};
    }
    return {status: 'pass', detail: 'no request dispatched', requests: []};
}

async function visibleFeedback(scope: Page | Locator, selectors: string[]): Promise<string> {
    for (const selector of selectors) {
        const matches = scope.locator(selector).filter({hasText: /\S/});
        const count = await matches.count();
        for (let i = 0; i < count; i++) {
            if (await matches.nth(i).isVisible()) {
                return (await matches.nth(i).innerText()).trim();
            }
        }
    }
    return '';
}

/**
 * O-MODAL (b): a submit that returns non-2xx must leave visible error text or keep the dialog open.
 * `forceStatus` makes the harness answer the submit request itself (no network); without it the real
 * response decides. Needs typing whenever the form must be filled to enable the confirm button.
 */
export async function checkNonOkSubmitFeedback(
    target: ModalTarget,
    options: {
        submit: 'click' | 'enter';
        forceStatus?: {urlGlob: string; status: number};
        feedbackSelectors?: string[];
        settleMs?: number;
    } & RequestFilter,
): Promise<ModalResult> {
    const {page, context, origin, sink, action, dialog, confirm, field} = target;
    if (await confirm.isDisabled()) {
        return {status: 'precondition-unmet', detail: 'confirm button is disabled', requests: []};
    }
    let routed = false;
    if (options.forceStatus) {
        const {urlGlob, status} = options.forceStatus;
        await page.route(urlGlob, async (route) => {
            if (!MUTATING.includes(route.request().method())) {
                await route.fallback();
                return;
            }
            routed = true;
            await route.fulfill({status, contentType: 'application/json', body: '{"message":"harness-forced status"}'});
        });
    }
    const recorder = recordRequests(context, origin, options, sink);
    try {
        if (options.submit === 'click') {
            await confirm.click();
        } else {
            await field.focus();
            await page.keyboard.press('Enter');
        }
        await page.waitForTimeout(options.settleMs ?? 800);
    } finally {
        recorder.stop();
        if (options.forceStatus) {
            await page.unroute(options.forceStatus.urlGlob);
        }
    }
    if (recorder.seen.length === 0 && !routed) {
        return {status: 'precondition-unmet', detail: 'submit dispatched no request', requests: []};
    }
    const dialogOpen = await dialog.isVisible();
    const selectors = options.feedbackSelectors ?? DEFAULT_FEEDBACK_SELECTORS;
    const text =
        (await visibleFeedback(dialogOpen ? dialog : page, selectors)) ||
        (await visibleFeedback(page, ['[role="alert"]']));
    const forced = options.forceStatus ? `harness-forced ${options.forceStatus.status}` : 'observed non-2xx';
    if (text) {
        return {status: 'pass', detail: `${forced}: error text shown`, requests: recorder.seen, feedback: 'text'};
    }
    if (dialogOpen) {
        return {
            status: 'pass',
            detail: `${forced}: dialog stayed open, no error text`,
            requests: recorder.seen,
            feedback: 'dialog-open',
        };
    }
    sink.add({
        oracle: 'O-MODAL',
        class: 'non-ok-submit-without-feedback',
        path: pagePath(page),
        evidence: `${forced} submit closed the dialog and showed no error text`,
        action,
    });
    return {
        status: 'fail',
        detail: `${forced}: dialog closed, no error text`,
        requests: recorder.seen,
        feedback: 'none',
    };
}
