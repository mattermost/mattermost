// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestBrowser, testConfig} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import type {UserProfile} from '@mattermost/types/users';

import {GuardLedger, closeWithGuard, foreignPageOrigins, guardedBrowser} from './guard.ts';
import type {GuardMode} from './guard.ts';
import {allowedOrigin, seededUser} from './manifest.ts';

type Session = Awaited<ReturnType<TestBrowser['login']>> & {ledger: GuardLedger; origin: string};

const open: Array<{testBrowser: TestBrowser; session: Session}> = [];

/**
 * Signs the given user in through the framework's TestBrowser.login (loginByAPI writes the storage
 * state) on a Browser wrapper that creates the context with serviceWorkers 'block' and the network
 * guard already installed. login() itself opens a page but never navigates. With no user, the seeded
 * pilot member is used.
 */
export async function openGuardedSessionAs(
    pw: PlaywrightExtended,
    user: {id: string; username: string; password: string; email?: string; roles?: string},
    mode: GuardMode = 'replay',
): Promise<Session> {
    const origin = allowedOrigin();
    if (new URL(testConfig.baseURL).origin !== origin || testConfig.internalBaseURL !== testConfig.baseURL) {
        throw new Error('testConfig.baseURL must equal the seed manifest base URL (set PW_BASE_URL).');
    }
    if (testConfig.useTestContainers) {
        throw new Error('PW_USE_TESTCONTAINERS must stay unset for the explorer pilot.');
    }

    const ledger = new GuardLedger(mode);
    const testBrowser = new TestBrowser(guardedBrowser(pw.testBrowser.browser, origin, ledger));
    const login = await testBrowser.login(user as unknown as UserProfile);
    if (login.page.url() !== 'about:blank') {
        throw new Error('A page navigated before the guarded session was handed out.');
    }

    const session = {...login, ledger, origin};
    open.push({testBrowser, session});
    return session;
}

export async function openGuardedSession(pw: PlaywrightExtended, mode: GuardMode = 'replay'): Promise<Session> {
    return openGuardedSessionAs(pw, seededUser(), mode);
}

/** Closes one session; fails if anything reached another origin or a page ended up off-origin. */
export async function closeGuardedSession(session: Session) {
    const index = open.findIndex((entry) => entry.session === session);
    const [entry] = index >= 0 ? open.splice(index, 1) : [];
    const foreign = foreignPageOrigins(session.context, session.origin);
    await closeWithGuard(session.ledger, async () => {
        await entry?.testBrowser.close();
    });
    const problems = [...session.ledger.violations, ...foreign.map((t) => `final page URL is ${t}`)];
    if (problems.length > 0) {
        throw new Error(`Network guard violations: ${problems.join('; ')}`);
    }
}

export async function closeGuardedSessions() {
    const sessions = open.map((entry) => entry.session);
    const errors: string[] = [];
    for (const session of sessions) {
        try {
            await closeGuardedSession(session);
        } catch (error) {
            errors.push(String(error));
        }
    }
    if (errors.length > 0) {
        throw new Error(errors.join('\n'));
    }
}
