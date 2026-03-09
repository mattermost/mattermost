// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, initSetup, requireWebhookServer} from '@mattermost/playwright-lib';
import {postToWebhook} from '@utils/webhook';

const manyOptions = [
    {text: 'Afghanistan', value: 'AF'},
    {text: 'Åland Islands', value: 'AX'},
    {text: 'Albania', value: 'AL'},
    {text: 'Algeria', value: 'DZ'},
    {text: 'American Samoa', value: 'AS'},
    {text: 'AndorrA', value: 'AD'},
    {text: 'Angola', value: 'AO'},
    {text: 'Anguilla', value: 'AI'},
    {text: 'Antarctica', value: 'AQ'},
    {text: 'Antigua and Barbuda', value: 'AG'},
    {text: 'Argentina', value: 'AR'},
    {text: 'Armenia', value: 'AM'},
    {text: 'Aruba', value: 'AW'},
    {text: 'Australia', value: 'AU'},
    {text: 'Austria', value: 'AT'},
    {text: 'Azerbaijan', value: 'AZ'},
    {text: 'Bahamas', value: 'BS'},
    {text: 'Bahrain', value: 'BH'},
    {text: 'Bangladesh', value: 'BD'},
    {text: 'Barbados', value: 'BB'},
    {text: 'Belarus', value: 'BY'},
    {text: 'Belgium', value: 'BE'},
    {text: 'Belize', value: 'BZ'},
    {text: 'Benin', value: 'BJ'},
    {text: 'Bermuda', value: 'BM'},
    {text: 'Bhutan', value: 'BT'},
    {text: 'Bolivia', value: 'BO'},
    {text: 'Brazil', value: 'BR'},
    {text: 'Bulgaria', value: 'BG'},
    {text: 'Czech Republic', value: 'CZ'},
];

/**
 * @objective Verify that a long dropdown list is scrollable and items at top/bottom are accessible
 *
 * @precondition
 * Webhook test server must be running to handle the /message-menus callback
 */
test('MM-T1741 scrolls through long list of menu options', {tag: '@interactive_menu'}, async ({pw}) => {
    // # Set up
    const webhookBaseUrl = await requireWebhookServer();
    const {adminClient, user, team} = await initSetup();

    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((c) => c.name === 'town-square')!;

    const hook = await adminClient.createIncomingWebhook({
        channel_id: townSquare.id,
        channel_locked: true,
        display_name: 'Scroll Test',
    });

    const payload = {
        attachments: [
            {
                pretext: 'Scroll test pretext',
                text: 'Scroll test text',
                actions: [
                    {
                        name: 'Select an option...',
                        integration: {url: `${webhookBaseUrl}/message-menus`, context: {action: 'do_something'}},
                        type: 'select',
                        options: manyOptions,
                    },
                ],
            },
        ],
    };

    // # Log in and post webhook
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    await postToWebhook(hook.id, payload);

    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.container).toContainText('Scroll test pretext', {timeout: pw.duration.two_sec});

    // # Open the dropdown
    await lastPost.container.getByPlaceholder('Select an option...').click();

    const suggestionList = lastPost.container.locator('#suggestionList');
    await expect(suggestionList).toBeVisible();
    await expect(suggestionList.locator('> *')).toHaveCount(manyOptions.length);

    // # Scroll to bottom
    await suggestionList.evaluate((el: Element) => el.scrollTo(0, el.scrollHeight));

    // * Verify last option is visible
    const lastOption = manyOptions[manyOptions.length - 1];
    await expect(suggestionList.getByText(lastOption.text)).toBeVisible();

    // # Scroll back to top
    await suggestionList.evaluate((el: Element) => el.scrollTo(0, 0));

    // * Verify first option is visible
    await expect(suggestionList.getByText(manyOptions[0].text)).toBeVisible();
});
