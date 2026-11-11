// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, getAdminClient, test} from '@mattermost/playwright-lib';

import {deleteAttributes, optionId, purgeAttributes, readChannelValues, setChannelValue, valueFor} from './helpers';
import {setUpTeamMissingRequiredValue} from './missing_required_helpers';

test.describe('Missing required channel attribute indicators', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify the creator of a new team sees the notice, the red Info button and the header
     * chip on Off-Topic, that Add values opens the field's editor in Channel Info with focus in it, and
     * that picking a value clears every indicator without a reload and again for Town Square, which
     * has its own state.
     */
    test('shows the indicators to the team creator and clears them once a value is set', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient} = await getAdminClient();
        if (!adminClient) {
            throw new Error('Admin client not available');
        }
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {field, creator, team, townSquare, offTopic} = await setUpTeamMissingRequiredValue(
                pw,
                adminClient,
                suffix,
                created,
            );

            const {channelsPage, page} = await pw.testBrowser.login(creator);
            await channelsPage.goto(team.name, offTopic.name);
            await channelsPage.toBeVisible();

            // * Off-Topic shows the notice, the red Info button and the "Set <attribute>" chip
            const indicators = channelsPage.centerView.missingRequiredAttributes;
            await indicators.toBeVisible(field.name);
            await expect(indicators.headerChip(field.name)).toContainText(`Set ${field.name}`);

            // # Select Add values
            await indicators.addValuesButton.click();

            // * Channel Info opens with the field's editor open and its row highlighted
            const info = channelsPage.sidebarRight.attributes;
            await expect(info.missingValue(field.name)).toBeVisible();
            await expect(info.editor(field.name)).toBeVisible();

            // * Focus moves into the open option menu's popover, not back onto the trigger behind it
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const popover = document.activeElement?.closest('.MuiPopover-paper');
                        return Boolean(popover?.querySelector('[role="menu"]'));
                    }),
                )
                .toBe(true);

            // # Pick a value
            await info.pickOption('AURORA');

            // * Every indicator disappears without a reload and the value is stored
            await indicators.toBeHidden(field.name);
            await expect(info.missingValue(field.name)).toHaveCount(0);
            await expect
                .poll(async () => valueFor(await readChannelValues(adminClient, offTopic.id), field))
                .toBe(optionId(field, 'AURORA'));

            // # Switch to Town Square
            await channelsPage.sidebarLeft.goToItem(townSquare.name);
            await channelsPage.centerView.header.toHaveTitle('Town Square');

            // * Town Square still lacks its own value, so the indicators show for it
            await indicators.toBeVisible(field.name);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a plain channel member sees no notice, red Info button or header chip, no highlighted row
     * and no edit control for the missing attribute.
     */
    test('shows no indicators or edit controls to a plain member', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient} = await getAdminClient();
        if (!adminClient) {
            throw new Error('Admin client not available');
        }
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {field, member, team, offTopic} = await setUpTeamMissingRequiredValue(
                pw,
                adminClient,
                suffix,
                created,
            );

            const {channelsPage, page} = await pw.testBrowser.login(member);

            // The hook reports nothing while loading, so wait for this channel's values to arrive
            // before asserting anything is hidden
            const valuesLoaded = page.waitForResponse(
                (response) =>
                    response.request().method() === 'GET' &&
                    response.url().includes(`/values/${offTopic.id}`) &&
                    response.ok(),
            );
            await channelsPage.goto(team.name, offTopic.name);
            await channelsPage.toBeVisible();
            await valuesLoaded;
            await channelsPage.centerView.header.toHaveTitle('Off-Topic');

            // * No indicator is shown
            await channelsPage.centerView.missingRequiredAttributes.toBeHidden(field.name);

            // * Channel Info offers no way to set the value
            const info = await channelsPage.openChannelInfo();
            await expect(info.attributes.missingValue(field.name)).toHaveCount(0);
            await expect(info.attributes.editButton(field.name)).toHaveCount(0);
            await channelsPage.centerView.missingRequiredAttributes.toBeHidden(field.name);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a system admin sees the indicators on a channel they are not an admin of, and
     * that they disappear live in an open session when another session sets the value.
     */
    test('clears the indicators live in an open session when the value is set elsewhere', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await getAdminClient();
        if (!adminUser || !adminClient) {
            throw new Error('Admin user/client not available');
        }
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {field, team, townSquare} = await setUpTeamMissingRequiredValue(pw, adminClient, suffix, created);
            await adminClient.addToTeam(team.id, adminUser.id);

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, townSquare.name);
            await channelsPage.toBeVisible();

            // * The system admin sees the indicators
            const indicators = channelsPage.centerView.missingRequiredAttributes;
            await indicators.toBeVisible(field.name);

            // # Set the value from outside the open session
            await setChannelValue(adminClient, townSquare.id, field, optionId(field, 'ZEPHYR'));

            // * The indicators disappear on the websocket event, with no reload
            await indicators.toBeHidden(field.name);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a channel admin is not offered a remove control on a set required value.
     */
    test('never offers to clear a required value', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient} = await getAdminClient();
        if (!adminClient) {
            throw new Error('Admin client not available');
        }
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {field, creator, team, offTopic} = await setUpTeamMissingRequiredValue(
                pw,
                adminClient,
                suffix,
                created,
            );

            await setChannelValue(adminClient, offTopic.id, field, optionId(field, 'AURORA'));

            const {channelsPage} = await pw.testBrowser.login(creator);
            await channelsPage.goto(team.name, offTopic.name);
            await channelsPage.toBeVisible();
            const info = (await channelsPage.openChannelInfo()).attributes;

            // * The set select value shows without a remove control
            await expect(info.chip(field.name)).toContainText('AURORA');
            await expect(info.row(field.name).getByRole('button', {name: 'Remove AURORA', exact: true})).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
