// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';
import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import {expect, test} from '@mattermost/playwright-lib';

import {
    DISPLAY_LABEL_INFO,
    attributeName,
    createAttribute,
    createChannelForAttributes,
    deleteAttributes,
    optionId,
    purgeAttributes,
    readChannelValues,
    setChannelValue,
    valueFor,
} from './helpers';

// Editing in Channel Info is admin-only, whatever an attribute's own setter tier
// says: useIsChannelAttributeAdmin gates the pencil, canSet only narrows further.
async function promoteToChannelAdmin(
    pw: PlaywrightExtended,
    adminClient: Client4,
    team: Team,
    channelId: string,
    prefix: string,
) {
    const channelAdmin = await pw.createNewUserProfile(adminClient, {prefix});
    await adminClient.addToTeam(team.id, channelAdmin.id);
    await adminClient.addToChannel(channelAdmin.id, channelId);
    await adminClient.updateChannelMemberSchemeRoles(channelId, channelAdmin.id, true, true);
    return channelAdmin;
}

test.describe('Channel attribute editing', {tag: ['@channel_attributes']}, () => {
    /**
     * @objective Verify a failed value write is reported in the row and does not discard the stored value.
     */
    test('surfaces an inline error when the value write fails and keeps the previous value', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const note = await createAttribute(adminClient, attributeName('failing', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(note);

            const channel = await createChannelForAttributes(adminClient, team, `edit-fail-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-fail-${suffix}`,
            );
            await setChannelValue(adminClient, channel.id, note, 'kept');

            const {page, channelsPage} = await pw.testBrowser.login(channelAdmin);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            await page.route('**/api/v4/properties/groups/access_control/channel/values/**', (route) => {
                if (route.request().method() !== 'PATCH') {
                    return route.continue();
                }
                return route.fulfill({status: 500, body: '{"message":"forced failure"}'});
            });

            const info = await channelsPage.openChannelInfo();
            await info.attributes.setText(note.name, 'never saved', 'enter');

            // * The row says the write failed, and keeps the edit open so it can be
            // * retried without retyping
            await expect(info.attributes.error(note.name)).toBeVisible();
            await expect(info.attributes.editor(note.name)).toHaveValue('never saved');

            await page.unroute('**/api/v4/properties/groups/access_control/channel/values/**');

            // * Nothing was stored, so the previous value stands
            expect(valueFor(await readChannelValues(adminClient, channel.id), note)).toBe('kept');

            // # Retry now that the write succeeds
            await info.attributes.editor(note.name).press('Enter');

            await expect(info.attributes.chip(note.name)).toHaveText('never saved');
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), note);
                })
                .toBe('never saved');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a locked attribute can be filled once and is read-only afterwards.
     */
    test('fills a locked attribute once, after which it is read-only', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            // Channel first: the server refuses a channel that misses a required
            // attribute, so the only way to reach a required-but-unset value is for the
            // attribute to become required after the channel exists. That is also how a
            // real server gets there, when an admin marks an attribute required later.
            const channel = await createChannelForAttributes(adminClient, team, `edit-lock-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-lock-${suffix}`,
            );

            // The lock bites only once a value exists, so an empty one is still fillable.
            const marking = await createAttribute(adminClient, attributeName('locked_once', suffix), {
                options: ['FINAL'],
                actions: [DISPLAY_LABEL_INFO],
                editable: false,
                required: true,
            });
            created.push(marking);

            const {channelsPage} = await pw.testBrowser.login(channelAdmin);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const info = await channelsPage.openChannelInfo();

            // * A required attribute with no value shows as unset and is still editable
            await expect(info.attributes.unset(marking.name)).toBeVisible();
            await expect(info.attributes.lock(marking.name)).toHaveCount(0);

            // # Set it for the first time
            await info.attributes.select(marking.name, 'FINAL');
            await expect(info.attributes.chip(marking.name)).toHaveText('FINAL');

            // * Once set, the row is locked: no pencil, and the lock icon appears
            await expect(info.attributes.lock(marking.name)).toBeVisible();
            await expect(info.attributes.editButton(marking.name)).toHaveCount(0);

            expect(valueFor(await readChannelValues(adminClient, channel.id), marking)).toBe(
                optionId(marking, 'FINAL'),
            );
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify the admin setter tier admits a channel admin and excludes a plain member.
     */
    test('lets a channel admin edit an admin-tier attribute that a member cannot', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const adminOnly = await createAttribute(adminClient, attributeName('admin_edit', suffix), {
                options: ['SET'],
                actions: [DISPLAY_LABEL_INFO],
                permissionValues: 'admin',
            });
            created.push(adminOnly);

            const channel = await createChannelForAttributes(adminClient, team, `edit-tier-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-tier-${suffix}`,
            );
            await adminClient.addToChannel(user.id, channel.id);

            // # Look at it as the channel admin
            const asAdmin = await pw.testBrowser.login(channelAdmin);
            await asAdmin.channelsPage.goto(team.name, channel.name);
            await asAdmin.channelsPage.toBeVisible();
            const adminInfo = await asAdmin.channelsPage.openChannelInfo();

            // Added rather than edited: an unset optional attribute has no row until
            // it has a value.
            // * The channel admin clears the admin tier and can set it
            await adminInfo.attributes.add(adminOnly.name, 'SET');
            await expect(adminInfo.attributes.chip(adminOnly.name)).toHaveText('SET');

            // # Look at the same attribute as an ordinary member
            const asMember = await pw.testBrowser.login(user);
            await asMember.channelsPage.goto(team.name, channel.name);
            await asMember.channelsPage.toBeVisible();
            const memberInfo = await asMember.channelsPage.openChannelInfo();

            // * The member sees the value but is offered no way to change it
            await expect(memberInfo.attributes.chip(adminOnly.name)).toHaveText('SET');
            await expect(memberInfo.attributes.editButton(adminOnly.name)).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
