// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Msg, expect, getAdminClient, test} from '@mattermost/playwright-lib';

import {deleteAttributes, optionId, purgeAttributes, readChannelValues, setChannelValue, valueFor} from './helpers';
import {
    expectMissingIndicators,
    expectNoMissingIndicators,
    setUpTeamMissingRequiredValue,
} from './missing_required_helpers';
import {openChannel, openChannelInfo, pickOption, row} from './surface';

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

            const app = await openChannel(pw, creator, team, offTopic);

            // * Off-Topic shows the notice, the red Info button and the "Set <attribute>" chip
            await expectMissingIndicators(app, field);
            await expect(app.channelHeader.attributes.missing(field)).toContainMessage(
                Msg.channel_attributes.labels.set_value,
                {label: field.name},
            );

            // # Select Add values
            await app.center.postList.missingAttributes.addValuesButton.click();

            // * Channel Info opens with the field's editor open and its row highlighted
            const info = app.rhs.channelInfo.about.attributes;
            await expect(row(info, field).missingText).toBeVisible();
            const editMenu = app.channelAttributeEditMenu;
            await expect(editMenu.optionList).not.toHaveKeyCount(0);

            // * Focus moves into the open option menu, not back onto the trigger behind it
            await expect
                .poll(() =>
                    editMenu.optionList.locator.evaluateAll((items) =>
                        items.some((item) => item.closest('[role="menu"]')?.contains(document.activeElement) ?? false),
                    ),
                )
                .toBe(true);

            // # Pick a value
            await pickOption(info, field, 'AURORA');

            // * Every indicator disappears without a reload and the value is stored
            await expectNoMissingIndicators(app, field);
            await expect(row(info, field).missingText).toHaveCount(0);
            await expect
                .poll(async () => valueFor(await readChannelValues(adminClient, offTopic.id), field))
                .toBe(optionId(field, 'AURORA'));

            // # Switch to Town Square
            await app.lhs.channelList.channel(townSquare).container.click();
            await expect(app.channelHeader.openMenuButton).toContainText('Town Square');

            // * Town Square still lacks its own value, so the indicators show for it
            await expectMissingIndicators(app, field);
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

            const {app, page} = await pw.testBrowser.login(member);

            // The hook reports nothing while loading, so wait for this channel's values to arrive
            // before asserting anything is hidden
            const valuesLoaded = page.waitForResponse(
                (response) =>
                    response.request().method() === 'GET' &&
                    response.url().includes(`/values/${offTopic.id}`) &&
                    response.ok(),
            );
            await app.channelsPage.goto({team, channel: offTopic});
            await valuesLoaded;
            await expect(app.channelHeader.openMenuButton).toContainText('Off-Topic');

            // * No indicator is shown
            await expectNoMissingIndicators(app, field);

            // * Channel Info offers no way to set the value
            const info = await openChannelInfo(app);
            await expect(row(info, field).missingText).toHaveCount(0);
            await expect(row(info, field).editButton).toHaveCount(0);
            await expectNoMissingIndicators(app, field);
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

            const app = await openChannel(pw, adminUser, team, townSquare);

            // * The system admin sees the indicators
            await expectMissingIndicators(app, field);

            // # Set the value from outside the open session
            await setChannelValue(adminClient, townSquare.id, field, optionId(field, 'ZEPHYR'));

            // * The indicators disappear on the websocket event, with no reload
            await expectNoMissingIndicators(app, field);
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

            const app = await openChannel(pw, creator, team, offTopic);
            const info = await openChannelInfo(app);

            // * The set select value shows without a remove control
            const value = await row(info, field).chipList.itemWith({text: 'AURORA'});
            await expect(value).toContainText('AURORA');
            await expect(value.removeButton).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
