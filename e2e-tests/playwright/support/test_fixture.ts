import {test as base, Browser} from '@playwright/test';

import {TestBrowser} from './browser_context';
import {shouldHaveCallsEnabled, shouldHaveFeatureFlag, shouldSkipInSmallScreen, shouldRunInLinux} from './flag';
import {initSetup, getAdminClient} from './server';
import {hideDynamicChannelsContent, waitForAnimationEnd, waitUntil} from './test_action';
import {pages} from './ui/pages';
import {matchSnapshot} from './visual';

export {expect} from '@playwright/test';

type ExtendedFixtures = {
    pw: PlaywrightExtended;
    pages: typeof pages;
};

export const test = base.extend<ExtendedFixtures>({
    pw: async ({browser}, use) => {
        const pw = new PlaywrightExtended(browser);
        await use(pw);
        await pw.testBrowser.close();
    },
    // eslint-disable-next-line no-empty-pattern
    pages: async ({}, use) => {
        await use(pages);
    },
});

class PlaywrightExtended {
    // ./browser_context
    readonly testBrowser: TestBrowser;

    // ./flag
    readonly shouldHaveCallsEnabled;
    readonly shouldHaveFeatureFlag;
    readonly shouldSkipInSmallScreen;
    readonly shouldRunInLinux;

    // ./server
    readonly getAdminClient;
    readonly initSetup;

    // ./test_action
    readonly hideDynamicChannelsContent;
    readonly waitForAnimationEnd;
    readonly waitUntil;

    // ./ui/pages
    readonly pages;

    // ./visual
    readonly matchSnapshot;

    constructor(browser: Browser) {
        // ./browser_context
        this.testBrowser = new TestBrowser(browser);

        // ./flag
        this.shouldHaveCallsEnabled = shouldHaveCallsEnabled;
        this.shouldHaveFeatureFlag = shouldHaveFeatureFlag;
        this.shouldSkipInSmallScreen = shouldSkipInSmallScreen;
        this.shouldRunInLinux = shouldRunInLinux;

        // ./server
        this.initSetup = initSetup;
        this.getAdminClient = getAdminClient;

        // ./test_action
        this.hideDynamicChannelsContent = hideDynamicChannelsContent;
        this.waitForAnimationEnd = waitForAnimationEnd;
        this.waitUntil = waitUntil;

        // ./ui/pages
        this.pages = pages;

        // ./visual
        this.matchSnapshot = matchSnapshot;
    }
}
