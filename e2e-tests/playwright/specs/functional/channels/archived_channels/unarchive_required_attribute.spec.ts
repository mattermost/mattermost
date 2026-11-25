// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Unarchiving a channel that lacks a value for a required channel attribute.
 * The dialog asks for the values the person can set and the server refuses the
 * restore without them; when the person can't set them, the channel is restored
 * and flagged for its channel admins.
 *
 * Each channel is archived before its field becomes Required, so it stays
 * outside the population the Required gate checks.
 */

import type {PropertyField} from '@mattermost/types/properties';

import {expect, getAdminClient, test} from '@mattermost/playwright-lib';

import {
    attributeName,
    createAttribute,
    createChannelForAttributes,
    deleteAttributes,
    optionId,
    purgeAttributes,
    readChannelValues,
    valueFor,
} from '../channel_attributes/helpers';
import {
    REQUIRED_FIELD_TEST_TIMEOUT,
    expectMissingRequiredRefusal,
} from '../channel_attributes/missing_required_helpers';

const OPTIONS = ['AURORA', 'ZEPHYR'];

async function adminOrThrow() {
    const {adminUser, adminClient} = await getAdminClient();
    if (!adminUser || !adminClient) {
        throw new Error('Admin user/client not available');
    }
    return {adminUser, adminClient};
}

test.describe('Unarchive - required channel attributes', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify unarchiving a channel that lacks a required value shows the field, keeps "Set and
     * unarchive" disabled until it is filled, offers no "Unarchive anyway", and restores the channel with
     * the value.
     */
    test('asks for the missing value and restores the channel with it', async ({pw}) => {
        test.setTimeout(REQUIRED_FIELD_TEST_TIMEOUT);
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await adminOrThrow();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {team} = await pw.initSetup();
            const channel = await createChannelForAttributes(adminClient, team, `unarchive-${suffix}`);
            await adminClient.deleteChannel(channel.id);

            const field = await createAttribute(adminClient, attributeName('unarchive', suffix), {
                type: 'select',
                options: OPTIONS,
                required: true,
                permissionValues: 'admin',
            });
            created.push(field);

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await expect(channelsPage.archivedChannelMessage).toBeVisible();

            const modal = await channelsPage.openUnarchiveChannelModal();

            // * The dialog asks for the field, with no way around it
            await expect(modal.requiredAttributes).toBeVisible();
            await expect(modal.attributes.row(field.name)).toBeVisible();
            await expect(modal.container.getByText('Unarchive anyway')).toHaveCount(0);
            await expect(modal.confirmButton).toHaveText('Set and unarchive');
            await expect(modal.confirmButton).toBeDisabled();

            // # Pick a value
            await modal.attributes.select(field.name, 'AURORA');
            await expect(modal.confirmButton).toBeEnabled();
            await modal.confirm();

            // * The channel is restored with the value
            await expect(channelsPage.archivedChannelMessage).toHaveCount(0);
            expect((await adminClient.getChannel(channel.id)).delete_at).toBe(0);
            expect(valueFor(await readChannelValues(adminClient, channel.id), field)).toBe(optionId(field, 'AURORA'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify restoring an archived channel through the API without the required value is refused
     * with a 400 and leaves the channel archived.
     */
    test('refuses an API restore without the required value', async ({pw}) => {
        test.setTimeout(REQUIRED_FIELD_TEST_TIMEOUT);
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient} = await adminOrThrow();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {team} = await pw.initSetup();
            const channel = await createChannelForAttributes(adminClient, team, `unarchive-api-${suffix}`);
            await adminClient.deleteChannel(channel.id);

            created.push(
                await createAttribute(adminClient, attributeName('unarchive_api', suffix), {
                    type: 'select',
                    options: OPTIONS,
                    required: true,
                    permissionValues: 'admin',
                }),
            );

            // * The server refuses the restore without a value
            await expectMissingRequiredRefusal(() => adminClient.unarchiveChannel(channel.id));

            // * The channel is still archived
            expect((await adminClient.getChannel(channel.id)).delete_at).toBeGreaterThan(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify the dialog is the plain "Unarchive" one when the channel already has the required
     * value, and that restoring it leaves the value in place.
     */
    test('shows the plain dialog when the channel already has the value', async ({pw}) => {
        test.setTimeout(REQUIRED_FIELD_TEST_TIMEOUT);
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await adminOrThrow();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {team} = await pw.initSetup();
            const field = await createAttribute(adminClient, attributeName('unarchive_ok', suffix), {
                type: 'select',
                options: OPTIONS,
                required: true,
                permissionValues: 'admin',
            });
            created.push(field);

            // The field is already Required, so the channel is created with its value.
            const channel = await createChannelForAttributes(adminClient, team, `unarchive-ok-${suffix}`, undefined, [
                {field_id: field.id, value: optionId(field, 'ZEPHYR')},
            ]);
            await adminClient.deleteChannel(channel.id);

            const {channelsPage, page} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await expect(channelsPage.archivedChannelMessage).toBeVisible();

            const modal = await channelsPage.openUnarchiveChannelModal();

            // Let the dialog's attribute lookup settle before asserting absence.
            await page.waitForLoadState('networkidle');

            // * Nothing is asked and nothing is flagged
            await expect(modal.requiredAttributes).toHaveCount(0);
            await expect(modal.flaggedNotice).toHaveCount(0);
            await expect(modal.confirmButton).toHaveText('Unarchive');

            await modal.confirm();
            await expect(channelsPage.archivedChannelMessage).toHaveCount(0);
            expect(valueFor(await readChannelValues(adminClient, channel.id), field)).toBe(optionId(field, 'ZEPHYR'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a channel and team admin whose scheme strips manage_channel_roles cannot set an
     * admin-level required value, sees the flagged notice instead of the field, and can still unarchive.
     */
    test('flags the channel for a team admin who cannot set the value and restores it', async ({pw}) => {
        test.setTimeout(REQUIRED_FIELD_TEST_TIMEOUT);
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient} = await adminOrThrow();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];
        let schemeId: string | undefined;

        try {
            await purgeAttributes(adminClient);

            // The creator of a team is its team admin and the admin of its channels.
            const creator = await pw.createNewUserProfile(adminClient, {prefix: `unarchive-admin-${suffix}`});
            const {client: creatorClient} = await pw.makeClient(creator);
            const team = await creatorClient.createTeam(await pw.random.team());
            const channel = await createChannelForAttributes(creatorClient, team, `unarchive-flag-${suffix}`);
            await creatorClient.deleteChannel(channel.id);

            // The admin tier is checked as manage_channel_roles, which both admin roles
            // carry by default. A team scheme without it leaves the creator, a member who
            // can read the values, unable to set this one.
            await pw.ensurePhase2MigrationCompleted();
            const scheme = await adminClient.createScheme({
                display_name: `Unarchive flag ${suffix}`,
                scope: 'team',
            });
            schemeId = scheme.id;
            for (const roleName of [scheme.default_team_admin_role, scheme.default_channel_admin_role]) {
                const role = await adminClient.getRoleByName(roleName);
                await adminClient.patchRole(role.id, {
                    permissions: role.permissions.filter((permission) => permission !== 'manage_channel_roles'),
                });
            }
            await adminClient.updateTeamScheme(team.id, scheme.id);

            created.push(
                await createAttribute(adminClient, attributeName('unarchive_flag', suffix), {
                    type: 'select',
                    options: OPTIONS,
                    required: true,
                    permissionValues: 'admin',
                }),
            );

            const {channelsPage} = await pw.testBrowser.login(creator);
            await channelsPage.goto(team.name, channel.name);
            await expect(channelsPage.archivedChannelMessage).toBeVisible();

            const modal = await channelsPage.openUnarchiveChannelModal();

            // * The field is not asked for; the dialog only explains it is flagged
            await expect(modal.flaggedNotice).toBeVisible();
            await expect(modal.requiredAttributes).toHaveCount(0);
            await expect(modal.confirmButton).toHaveText('Unarchive');
            await expect(modal.confirmButton).toBeEnabled();

            // # Unarchive
            await modal.confirm();

            // * The channel is restored even though it still lacks the value
            await expect(channelsPage.archivedChannelMessage).toHaveCount(0);
            expect((await adminClient.getChannel(channel.id)).delete_at).toBe(0);
        } finally {
            await deleteAttributes(adminClient, created);
            if (schemeId) {
                await adminClient.deleteScheme(schemeId);
            }
        }
    });
});
