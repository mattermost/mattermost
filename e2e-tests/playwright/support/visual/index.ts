// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'node:os';

import chalk from 'chalk';
import {expect, TestInfo} from '@playwright/test';

import {illegalRe} from '@e2e-support/util';
import testConfig, {TestArgs} from '@e2e-test.config';

import snapshotWithPercy from './percy';

export async function matchSnapshot(testInfo: TestInfo, testArgs: TestArgs) {
    if (os.platform() !== 'linux') {
        // eslint-disable-next-line no-console
        console.log(
            chalk.yellow(
                `^ Warning: No visual test performed. Run in Linux or Playwright docker image to match snapshot.`
            )
        );
        return;
    }

    if (testConfig.snapshotEnabled) {
        // Visual test with built-in snapshot
        const filename = testInfo.title.replace(illegalRe, '').replace(/\s/g, '-').trim().toLowerCase();
        expect(await testArgs.page.screenshot({fullPage: true})).toMatchSnapshot(`${filename}.png`);
    }

    if (testConfig.percyEnabled) {
        // Used to easily identify the screenshot when viewing from third-party service provider.
        const name = `[${testInfo.project.name}, ${testArgs?.viewport?.width}px] > ${testInfo.file} > ${testInfo.title}`;

        // Visual test with Percy
        await snapshotWithPercy(name, testArgs);
    }
}
