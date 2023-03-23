// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import percySnapshot from '@percy/playwright';

import testConfig, {TestArgs} from '@e2e-test.config';

export default async function snapshotWithPercy(name: string, testArgs: TestArgs) {
    if (testArgs.browserName === 'chromium' && testConfig.percyEnabled && testArgs.viewport) {
        if (!testConfig.percyToken) {
            // eslint-disable-next-line no-console
            console.error('Error: Token is missing! Please set using: "export PERCY_TOKEN=<change_me>"');
        }

        const {page, viewport} = testArgs;

        // Ignore since percy is using Playwright.Page
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await percySnapshot(page, name, {widths: [viewport.width], minHeight: viewport.height});
    }
}
