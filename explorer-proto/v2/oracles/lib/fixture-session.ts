// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {chromium} from '@playwright/test';
import type {Browser, BrowserContext, Page} from '@playwright/test';

import {GuardLedger, closeGuardedContext, foreignPageOrigins, guardedBrowser} from '../../../src/guard.ts';

export type FixtureSession = {
    browser: Browser;
    context: BrowserContext;
    page: Page;
    origin: string;
    ledger: GuardLedger;
};

/** Same launch flag the oracle Playwright config uses (see README: Local Network Access check). */
export function launchBrowser(): Promise<Browser> {
    return chromium.launch({args: ['--disable-features=LocalNetworkAccessChecks']});
}

/** A context created through the pilot's real guard (serviceWorkers blocked), allowed to reach `origin` only. */
export async function openFixtureSession(browser: Browser, origin: string): Promise<FixtureSession> {
    const ledger = new GuardLedger('replay');
    const context = await guardedBrowser(browser, origin, ledger).newContext();
    const page = await context.newPage();
    return {browser, context, page, origin, ledger};
}

export async function closeFixtureSession(session: FixtureSession): Promise<void> {
    const foreign = foreignPageOrigins(session.context, session.origin);
    await closeGuardedContext(session.context, session.ledger);
    const problems = [...session.ledger.violations, ...foreign];
    if (problems.length > 0) {
        throw new Error(`Network guard violations: ${problems.join('; ')}`);
    }
}
