import {test as base, Browser} from '@playwright/test';

import {TestBrowser} from './browser_context';
import {shouldHaveBoardsEnabled, shouldHaveFeatureFlag, shouldSkipInSmallScreen, shouldRunInLinux} from './flag';
import {initSetup, getAdminClient} from './server';
import {hideDynamicChannelsContent, waitForAnimationEnd} from './test_action';
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
    readonly shouldHaveBoardsEnabled: typeof shouldHaveBoardsEnabled;
    readonly shouldHaveFeatureFlag: typeof shouldHaveFeatureFlag;
    readonly shouldSkipInSmallScreen: typeof shouldSkipInSmallScreen;
    readonly shouldRunInLinux: typeof shouldRunInLinux;

    // ./server
    readonly getAdminClient: typeof getAdminClient;
    readonly initSetup: typeof initSetup;

    // ./test_action
    readonly hideDynamicChannelsContent: typeof hideDynamicChannelsContent;
    readonly waitForAnimationEnd: typeof waitForAnimationEnd;

    // ./ui/pages
    readonly pages: typeof pages;

    // ./visual
    readonly matchSnapshot: typeof matchSnapshot;

    constructor(browser: Browser) {
        // ./browser_context
        this.testBrowser = new TestBrowser(browser);

        // ./flag
        this.shouldHaveBoardsEnabled = shouldHaveBoardsEnabled;
        this.shouldHaveFeatureFlag = shouldHaveFeatureFlag;
        this.shouldSkipInSmallScreen = shouldSkipInSmallScreen;
        this.shouldRunInLinux = shouldRunInLinux;

        // ./server
        this.initSetup = initSetup;
        this.getAdminClient = getAdminClient;

        // ./test_action
        this.hideDynamicChannelsContent = hideDynamicChannelsContent;
        this.waitForAnimationEnd = waitForAnimationEnd;

        // ./ui/pages
        this.pages = pages;

        // ./visual
        this.matchSnapshot = matchSnapshot;
    }
}
