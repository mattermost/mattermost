// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import type {CDPSession} from '@playwright/test';

// 한글이 잘 입력되는지 테스트
// gksrmfdl wkf dlqfurehlsmswl xptmxm

test('should be able to compose Korean characters properly when typing', async ({pw}, testInfo) => {
    test.skip(testInfo.project.name !== 'chrome', 'This test is only supported on Chrome');

    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    const client = await page.context().newCDPSession(page);



    // await page.goto('https://w3c.github.io/uievents/tools/key-event-viewer.html');
    // await page.locator('input[type="text"]').focus();

    // await typeHangulWithComposition(client, '한글이 잘 '); //이 잘 입력되는지 테스트');

    // await new Promise((resolve) => setTimeout(resolve, 10000));

    // return;


    await channelsPage.goto();
    await channelsPage.toBeVisible();

    const channelSwitchModal = await channelsPage.openChannelSwitchModal(false);
    await channelSwitchModal.input.focus();

    await typeHangulWithComposition(client, '한글이 잘 입력되는지 테스트');

    expect(channelSwitchModal.input).toHaveValue('한글이 잘 입력되는지 테스트');
});

async function typeHangulWithComposition(client: CDPSession, hangul: string) {
    function pause() {
        const delay = 100;
        return new Promise((resolve) => setTimeout(resolve, delay));
    }

    function keyDown(key: string) {
        return client.send('Input.dispatchKeyEvent', {
            type: 'keyDown',
            key,
        });
    }

    function keyUp(key: string) {
        return client.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key,
        });
    }

    function setComposition(current: string) {
        return client.send('Input.imeSetComposition', {
            selectionStart: -1,
            selectionEnd: -1,
            text: current,
        });
    }

    function finishComposition(character: string) {
        return client.send('Input.insertText', {
            text: character,
        });
    }

    const characters = hangul.split('');
    for (let i = 0; i < characters.length; i++) {
        const c = characters[i];

        if (c === ' ') {
            await keyDown(c);

            await finishComposition(characters[i - 1]);
            // await client.send('Input.insertText', {
            //     text: characters[i - 1],
            // });

            await keyUp(c);

            await pause();
        } else {
            const keys = decomposeHangul(c);

            await keyDown(keys[0]);
            if (i > 0) {
                await finishComposition(characters[i - 1]);
            }
            await setComposition(keys[0]);
            await keyUp(keys[0]);

            await pause();

            await keyDown(keys[1]);
            await setComposition(composeHangul(keys[0], keys[1]));
            await keyUp(keys[1]);

            await pause();

            if (keys.length > 2) {
                await keyDown(keys[2]);
                await setComposition(c);
                await keyUp(keys[2]);

                await pause();
            }
        }
    }

    // Technically, this doesn't match how it would behave as you just type, but it behaves fine as long as we don't
    // chain calls to this function
    await finishComposition(characters[characters.length - 1]);
}

function decomposeHangul(input: string) {
    // Math adapted from https://useless-factor.blogspot.com/2007/08/unicode-implementers-guide-part-3.html

    const codePoint = input.charCodeAt(0);

    // codePoint = ((initial-0x1100) * 588) + ((medial-0x1161) * 28) + (final-0x11a7) + 0xac00
    // codePoint = (a * 588) + (b * 28) + (c) + 0xac00
    const n = codePoint - 0xac00;
    const a = (n - (n % 588)) / 588;
    const b = ((n % 588) - ((n % 588) % 28)) / 28;
    const c = n % 28;

    const initial = String.fromCodePoint(a + 0x1100);
    const medial = String.fromCodePoint(b + 0x1161);
    const final = c > 0 ? String.fromCodePoint(c + 0x11a7) : '';

    return final ? [initial, medial, final] : [initial, medial];
}

function composeHangul(initial: string, medial: string) {
    // Adding the final jamo is much harder
    return (initial + medial).normalize('NFKD');
}
