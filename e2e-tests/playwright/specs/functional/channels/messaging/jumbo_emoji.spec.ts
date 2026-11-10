// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

async function emojiHeight(post: {emoticon: {boundingBox: () => Promise<{height: number} | null>}}): Promise<number> {
    const box = await post.emoticon.boundingBox();
    if (!box) {
        throw new Error('Expected the emoji to have a bounding box');
    }
    return box.height;
}

/**
 * @objective Verify an emoji-only message renders as a jumbo (large) emoji, and that leading/trailing
 * whitespace around the emoji does not stop it from rendering jumbo.
 */
test(
    'MM-T2179 renders emoji-only messages as jumbo even when surrounded by whitespace',
    {tag: '@messaging'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        // # Post an emoji inline with text (renders at the normal inline size)
        await channelsPage.postMessage('jumbo test :taco:');
        const inlineHeight = await emojiHeight(await channelsPage.getLastPost());

        // # Post the same emoji on its own surrounded by whitespace
        await channelsPage.postMessage(' :taco: ');
        const jumboHeight = await emojiHeight(await channelsPage.getLastPost());

        // * Verify the whitespace-surrounded emoji-only message renders larger (jumbo) than the inline emoji
        expect(jumboHeight).toBeGreaterThan(inlineHeight);
    },
);
