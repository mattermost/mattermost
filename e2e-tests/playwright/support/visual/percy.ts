// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import percySnapshot from '@percy/playwright';

import testConfig from '@e2e-test.config';
import {TestArgs} from '@e2e-types';

export default async function snapshotWithPercy(name: string, testArgs: TestArgs) {
    if (testArgs.browserName === 'chromium' && testConfig.percyEnabled && testArgs.viewport) {
        const {page, viewport} = testArgs;

        // Ignore since percy is using Playwright.Page
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        try {
            await percySnapshot(page, name, {widths: [viewport.width], minHeight: viewport.height});
        } catch (error) {
            console.error('Check if token is properly set by "export PERCY_TOKEN=<change_me>"');
            console.error(error);
        }
    }
}
