import {test as base, Browser, Page, ViewportSize} from '@playwright/test';
import {AxeResults} from 'axe-core';
import AxeBuilder from '@axe-core/playwright';

import {TestBrowser} from './browser_context';
import {shouldHaveCallsEnabled, shouldHaveFeatureFlag, shouldSkipInSmallScreen, shouldRunInLinux} from './flag';
import {initSetup, getAdminClient} from './server';
import {isSmallScreen} from './util';
import {hideDynamicChannelsContent, waitForAnimationEnd, waitUntil} from './test_action';
import {pages} from './ui/pages';
import {matchSnapshot} from './visual';

export {expect} from '@playwright/test';

type ExtendedFixtures = {
    axe: AxeBuilderExtended;
    pw: PlaywrightExtended;
    pages: typeof pages;
};

export const test = base.extend<ExtendedFixtures>({
    axe: async ({page}, use) => {
        const ab = new AxeBuilderExtended(page);
        await use(ab);
    },
    pw: async ({browser, viewport}, use) => {
        const pw = new PlaywrightExtended(browser, viewport);
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

    // ./util
    readonly isSmallScreen;

    // ./visual
    readonly matchSnapshot;

    constructor(browser: Browser, viewport: ViewportSize | null) {
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

        // ./util
        this.isSmallScreen = () => isSmallScreen(viewport);

        // ./visual
        this.matchSnapshot = matchSnapshot;
    }
}

class AxeBuilderExtended {
    /**
     * Each page should have its own Axe Builder to specifically list known issues
     * which are to be excluded from being scanned until issues are fixed.
     * Excluded element should have a corresponding ticket.
     */

    // '<site_url>/login'
    readonly loginPage: () => AxeBuilder;

    // See https://github.com/dequelabs/axe-core/blob/master/doc/API.md#axe-core-tags
    readonly tags: string[] = ['wcag2a', 'wcag2aa'];

    // See https://github.com/dequelabs/axe-core/blob/master/doc/rule-descriptions.md#wcag-20-level-a--aa-rules
    readonly disabledRules: string[] = [];

    constructor(page: Page) {
        this.loginPage = () => {
            return (
                new AxeBuilder({page})
                    .withTags(this.tags)
                    .disableRules(this.disabledRules)

                    // MM-52645
                    .exclude('meta[name="viewport"]')
                    .exclude('.header-logo-link')
                    .exclude('#input_loginId')
                    .exclude('#password_toggle')
            );
        };
    }

    violationFingerprints(accessibilityScanResults: AxeResults) {
        const fingerprints = accessibilityScanResults.violations.map((violation) => ({
            rule: violation.id,
            description: violation.description,
            helpUrl: violation.helpUrl,
            targets: violation.nodes.map((node) => {
                return {target: node.target, impact: node.impact, html: node.html};
            }),
        }));

        return JSON.stringify(fingerprints, null, 2);
    }
}
