// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setWysiwygUserPreference, test} from '@mattermost/playwright-lib';

/**
 * @objective Clicking a user at-mention in the composer preview opens the profile popover
 * and does not post the draft.
 *
 * @precondition Two users on the same team. The markdown composer preview is available
 * (WYSIWYG editor preference is off).
 */
test(
    'MM-67123 clicking a user mention in composer preview opens the profile popover',
    {tag: '@mentions'},
    async ({pw}) => {
        // # Create two users on the same team and disable the WYSIWYG editor so preview is available
        const {adminClient, user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, false);

        const mentionedUser = await adminClient.createUser(await pw.random.user('mentioned'), '', '');
        await adminClient.addToTeam(team.id, mentionedUser.id);
        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        await adminClient.addToChannel(mentionedUser.id, townSquare.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const unique = `preview-mention-${pw.random.id()}`;
        const {postCreate} = channelsPage.centerView;

        // # Type a draft that mentions the other user via autocomplete so the mention resolves
        await postCreate.writeMessage(`@${mentionedUser.username}`);
        await expect(postCreate.suggestionList).toBeVisible();
        await postCreate.suggestionOptions.first().click();
        await postCreate.input.pressSequentially(` ${unique}`);
        const draft = await postCreate.getInputValue();

        // # Show the composer markdown preview
        await postCreate.togglePreview();
        await expect(postCreate.previewArea).toBeVisible();
        await expect(postCreate.previewArea).toContainText(`@${mentionedUser.username}`);
        await expect(postCreate.previewArea).toContainText(unique);

        // # Click the rendered mention in the preview
        await postCreate.clickMentionInPreview();

        // * The mentioned user's profile popover opens
        await expect(channelsPage.userProfilePopover.container).toBeVisible();
        await expect(channelsPage.userProfilePopover.container).toContainText(`@${mentionedUser.username}`);

        // * The draft remains in the composer and is not posted
        await expect(postCreate.input).toHaveValue(draft);
        await expect(postCreate.previewArea).toContainText(unique);

        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.container).not.toContainText(unique);
    },
);
