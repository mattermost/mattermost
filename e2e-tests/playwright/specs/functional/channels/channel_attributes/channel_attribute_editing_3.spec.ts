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
     * @objective Verify Channel Info management (unset required rows, Add Attribute,
     * and the pencil) is available to a channel admin regardless of an attribute's
     * own setter tier.
     */
    test('shows a channel admin every attribute, including unset ones, and lets them add or edit', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);
        await pw.ensureFeatureFlag('ChannelAttributesRequired', true);

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            // Member-tier on purpose: management stays admin-only in Channel Info
            // even for an attribute a plain member is otherwise allowed to set.
            const required = await createAttribute(adminClient, attributeName('req', suffix), {
                actions: [DISPLAY_LABEL_INFO],
                options: ['DRAFT'],
                required: true,
            });
            created.push(required);
            const optional = await createAttribute(adminClient, attributeName('opt', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(optional);

            const channel = await createChannelForAttributes(
                adminClient,
                team,
                `edit-admin-lists-${suffix}`,
                undefined,
                [{field_id: required.id, value: optionId(required, 'DRAFT')}],
            );
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-lists-${suffix}`,
            );

            const {channelsPage} = await pw.testBrowser.login(channelAdmin);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();
            const info = await channelsPage.openChannelInfo();

            // * A required attribute that already has a value is listed and editable
            await expect(info.attributes.chip(required.name)).toHaveText('DRAFT');
            await expect(info.attributes.editButton(required.name)).toBeVisible();

            // * An unset optional attribute is reachable through Add Attribute, and
            // * becomes editable once added
            await expect(info.attributes.row(optional.name)).toHaveCount(0);
            await info.attributes.add(optional.name);
            await info.attributes.editor(optional.name).fill('drafted');
            await info.attributes.editor(optional.name).press('Enter');
            await expect(info.attributes.chip(optional.name)).toHaveText('drafted');
            await expect(info.attributes.editButton(optional.name)).toBeVisible();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a plain member only sees attributes that already carry a
     * value, always read-only, with no Add Attribute affordance.
     */
    test('shows a plain member only what is already set, read-only, with no way to manage attributes', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);
        await pw.ensureFeatureFlag('ChannelAttributesRequired', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const required = await createAttribute(adminClient, attributeName('req', suffix), {
                actions: [DISPLAY_LABEL_INFO],
                options: ['DRAFT'],
                required: true,
            });
            created.push(required);
            const optional = await createAttribute(adminClient, attributeName('opt', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(optional);

            const channel = await createChannelForAttributes(
                adminClient,
                team,
                `edit-member-hides-${suffix}`,
                undefined,
                [{field_id: required.id, value: optionId(required, 'DRAFT')}],
            );
            await adminClient.addToChannel(user.id, channel.id);

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();
            const info = await channelsPage.openChannelInfo();

            // * The required attribute's value is visible, but there is no pencil
            await expect(info.attributes.chip(required.name)).toHaveText('DRAFT');
            await expect(info.attributes.editButton(required.name)).toHaveCount(0);

            // * The unset optional attribute has no row, and there is no way to add one
            await expect(info.attributes.row(optional.name)).toHaveCount(0);
            await expect(info.attributes.addButton).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
