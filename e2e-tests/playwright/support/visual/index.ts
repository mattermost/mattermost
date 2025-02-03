// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'node:os';

import chalk from 'chalk';
import {expect, TestInfo} from '@playwright/test';

import {duration, illegalRe, wait} from '@e2e-support/util';
import testConfig from '@e2e-test.config';
import {ScreenshotOptions, TestArgs} from '@e2e-types';

import snapshotWithPercy from './percy';

export async function matchSnapshot(testInfo: TestInfo, testArgs: TestArgs, options: ScreenshotOptions = {}) {
    if (os.platform() !== 'linux') {
        // eslint-disable-next-line no-console
        console.log(
            chalk.yellow(
                `^ Warning: No visual test performed. Run in Linux or Playwright docker image to match snapshot.`,
            ),
        );
        return;
    }

    if (testConfig.snapshotEnabled || testConfig.percyEnabled) {
        await testArgs.page.waitForLoadState('networkidle');
        await testArgs.page.waitForLoadState('domcontentloaded');
        await wait(duration.half_sec);
    }

    if (testConfig.snapshotEnabled) {
        // Visual test with built-in snapshot
        const filename = testInfo.title.trim().replace(illegalRe, '').replace(/\s/g, '-').trim().toLowerCase();
        await expect(testArgs.page).toHaveScreenshot(`${filename}.png`, {fullPage: true, ...options});
    }

    if (testConfig.percyEnabled) {
        // Used to easily identify the screenshot when viewing from third-party service provider.
        const name = `[${testInfo.project.name}, ${testArgs?.viewport?.width}px] > ${testInfo.file} > ${testInfo.title}`;

        // Visual test with Percy
        await snapshotWithPercy(name, testArgs);
    }
}
