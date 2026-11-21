// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Api,
    closeChannelSettings,
    createChannelFromModal,
    expect,
    openChannelSettingsInfoTab,
    settle,
    test,
} from '@mattermost/playwright-lib';

/**
 * @objective Verify a multi-line channel header is truncated in the header bar, that hovering it opens a
 * popover with the full header, that a markdown link in the header points to the correct URL, and that the
 * popover closes.
 */
test(
    'MM-T879 opens and closes the channel header popover with a working link',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();
        const channel = await adminClient.createPublicChannel(team.id, `Header ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, channel.id);

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        // # Set a multi-line channel header that contains a markdown link, via Channel Settings
        const header = ['Header text line one', '', '- Two', '- [Google](https://google.com/)', '- Four'].join('\n');
        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
        const infoSettings = await openChannelSettingsInfoTab(channelSettings);
        await infoSettings.header.container.fill(header);
        await settle(channelSettings.savePanel.saveButton, {wait: Api.PatchChannel}).click();
        await closeChannelSettings(channelSettings);

        // * Verify the header bar shows the first line of the header
        const headerText = app.channelHeader.description;
        await expect(headerText).toContainText('Header text line one');

        // # Hover the header text to open the popover. Force the hover because opening the popover mounts a
        // full-screen floating overlay that would otherwise be reported as intercepting the pointer.
        await headerText.locator.hover({force: true});

        // * Verify the popover opens with the full header and a link to the correct URL
        const popover = app.channelHeader.descriptionPopover;
        await expect(popover).toBeVisible();
        await expect(popover).toContainText('Four');

        // the link is rendered from the header's markdown inside the popover, without a testid of its own
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the link is markdown the user wrote, rendered inside the popover; it has no element of ours to give a test id
        const link = popover.locator.getByRole('link', {name: 'Google'});
        await expect(link).toHaveAttribute('href', 'https://google.com/');

        // # Move the pointer away from the header to dismiss the popover
        await page.mouse.move(400, 500);
        await app.center.postCreate.message.container.locator.hover({force: true});

        // * Verify the popover closes
        await expect(popover).not.toBeVisible();
    },
);

/**
 * @objective Verify a channel header can be added from the "Set header" link in a new channel's intro,
 * that cancelling the modal makes no change, and that the saved header appears in the channel info.
 */
test('MM-T880 adds a channel header from the intro Set header link', {tag: '@channel_settings'}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Make sure the channel intro offers its action buttons instead of only the invite button
    await pw.ensureChannelIntroActions(adminClient);

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Create a new public channel so its intro (with the "Set header" link) is shown
    const channelName = `channel header ${pw.random.id()}`;
    await createChannelFromModal(app, channelName, 'O');
    await expect(app.channelHeader.openMenuButton).toContainText(channelName);

    // # Open the Edit Header modal from the intro and cancel without entering text
    await app.center.postList.channelIntro.setHeaderButton.clickTo(app.editChannelHeaderModal);
    await app.editChannelHeaderModal.cancelButton.click();
    await expect(app.editChannelHeaderModal).not.toBeVisible();

    // # Reopen the Edit Header modal and save a header
    const header = 'this is the channel header';
    await app.center.postList.channelIntro.setHeaderButton.clickTo(app.editChannelHeaderModal);
    await app.editChannelHeaderModal.header.container.fill(header);
    await app.editChannelHeaderModal.saveButton.click();
    await expect(app.editChannelHeaderModal).not.toBeVisible();

    // * Verify the header-change system message is posted
    const headerChange = await app.center.postList.postList.itemWith({
        text: `updated the channel header to: ${header}`,
    });
    await expect(headerChange.container).toBeVisible();

    // # Open the channel info panel from the channel header menu
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.toggleInfoMenuItem);
    const info = await app.channelHeader.menu.toggleInfoMenuItem.clickTo(app.rhs.channelInfo);

    // * Verify the saved header appears in the channel info panel
    await expect(info.about.header.container).toContainText(header);
});
