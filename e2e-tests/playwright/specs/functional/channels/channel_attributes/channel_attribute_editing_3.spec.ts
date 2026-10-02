// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';
import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import {expect, test} from '@mattermost/playwright-lib';

import {
    DISPLAY_LABEL_INFO,
    assignAttributeOwner,
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
     * @objective Verify Channel Info management (unset required rows, Add Attribute,
     * and the pencil) is available to a channel admin regardless of an attribute's
     * own setter tier.
     */
    test('shows a channel admin every attribute, including unset ones, and lets them add or edit', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});

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
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});

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

    /**
     * @objective Verify an attribute whose values an integration owns is read-only
     * in Channel Info, even for a system admin.
     */
    test('shows an attribute owned by an integration as read-only, even to a system admin', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const owned = await createAttribute(adminClient, attributeName('owned', suffix), {
                options: ['NOFORN', 'RELIDO'],
                actions: [DISPLAY_LABEL_INFO],
            });
            const ordinary = await createAttribute(adminClient, attributeName('ordinary', suffix), {
                options: ['ALPHA'],
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(owned, ordinary);

            const channel = await createChannelForAttributes(adminClient, team, `edit-owned-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);

            // Seed the value while the attribute is still ordinary, the way the
            // owning integration would have written it.
            await setChannelValue(adminClient, channel.id, owned, optionId(owned, 'NOFORN'));
            await assignAttributeOwner(adminClient, owned, 'com.example.markings');

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const info = await channelsPage.openChannelInfo();

            // * The value is shown as a plain chip behind a lock, with nothing to open
            await expect(info.attributes.chip(owned.name)).toHaveText('NOFORN');
            await expect(info.attributes.lock(owned.name)).toBeVisible();
            await expect(info.attributes.lock(owned.name)).toHaveAttribute(
                'aria-label',
                'This attribute is managed by an integration and cannot be changed here',
            );
            await expect(info.attributes.editButton(owned.name)).toHaveCount(0);

            // # Click the chip where the editor's trigger would be
            await info.attributes.chip(owned.name).click();

            // * No option menu opens, so the write the server would refuse is never offered
            await expect(channelsPage.page.getByText('RELIDO', {exact: true})).toHaveCount(0);
            await expect(info.attributes.error(owned.name)).toHaveCount(0);

            // * The ordinary attribute beside it is still offered for adding, so the
            // * lock is scoped to the owned one rather than the whole panel
            await info.attributes.addButton.click();
            await expect(info.attributes.addMenuItem(ordinary.name)).toBeVisible();
            await expect(info.attributes.addMenuItem(owned.name)).toHaveCount(0);

            // * The stored value is untouched
            expect(valueFor(await readChannelValues(adminClient, channel.id), owned)).toBe(optionId(owned, 'NOFORN'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
