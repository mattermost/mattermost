// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';
import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import {expect, test} from '@mattermost/playwright-lib';

import {
    DISPLAY_LABEL_HEADER,
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
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify a text value can be changed from Channel Info and commits on Enter.
     */
    test('edits a text attribute inline and commits on Enter', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const note = await createAttribute(adminClient, attributeName('note', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(note);

            const channel = await createChannelForAttributes(adminClient, team, `edit-text-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-note-${suffix}`,
            );
            await setChannelValue(adminClient, channel.id, note, 'first draft');

            const {channelsPage} = await pw.testBrowser.login(channelAdmin);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // # Replace the existing value and commit with Enter
            const info = await channelsPage.openChannelInfo();
            await expect(info.attributes.chip(note.name)).toHaveText('first draft');
            await info.attributes.setText(note.name, 'second draft', 'enter');

            // * The new value replaces the old one, in the panel and in the store
            await expect(info.attributes.chip(note.name)).toHaveText('second draft');
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), note);
                })
                .toBe('second draft');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a text edit commits on blur but is abandoned on Escape.
     */
    test('commits a text edit on blur and abandons it on Escape', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const note = await createAttribute(adminClient, attributeName('commit', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(note);

            const channel = await createChannelForAttributes(adminClient, team, `edit-commit-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-commit-${suffix}`,
            );
            await setChannelValue(adminClient, channel.id, note, 'original');

            const {channelsPage} = await pw.testBrowser.login(channelAdmin);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const info = await channelsPage.openChannelInfo();

            // # Type a new value and click away
            await info.attributes.setText(note.name, 'blurred', 'blur');
            await expect(info.attributes.chip(note.name)).toHaveText('blurred');

            // # Type again, then abandon with Escape
            await info.attributes.setText(note.name, 'discarded', 'escape');

            // * Escape leaves the committed value untouched
            await expect(info.attributes.chip(note.name)).toHaveText('blurred');
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), note);
                })
                .toBe('blurred');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a multiselect value can gain and lose options after it is first set.
     */
    test('adds and removes a multiselect option, and the header chips follow', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const caveats = await createAttribute(adminClient, attributeName('caveats', suffix), {
                type: 'multiselect',
                options: ['NOFORN', 'ORCON'],
                actions: [DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO],
            });
            created.push(caveats);

            const channel = await createChannelForAttributes(adminClient, team, `edit-multi-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-caveats-${suffix}`,
            );
            await setChannelValue(adminClient, channel.id, caveats, [optionId(caveats, 'NOFORN')]);

            const {channelsPage} = await pw.testBrowser.login(channelAdmin);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const info = await channelsPage.openChannelInfo();

            // # Add a second option to the existing one
            await info.attributes.select(caveats.name, 'ORCON');

            // * Both options are stored, in the order they were picked
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), caveats);
                })
                .toEqual([optionId(caveats, 'NOFORN'), optionId(caveats, 'ORCON')]);

            // # Remove the first one from the still-open editor
            await info.attributes.deselect(caveats.name, 'NOFORN');

            // * Only the remaining option survives, and the header agrees
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), caveats);
                })
                .toEqual([optionId(caveats, 'ORCON')]);
            await expect(channelsPage.centerView.header.attributes.chip('ORCON')).toBeVisible();
            await expect(channelsPage.centerView.header.attributes.chip('NOFORN')).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a failed value write is reported in the row and does not discard the stored value.
     */
    test('surfaces an inline error when the value write fails and keeps the previous value', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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

    /**
     * @objective Verify Channel Info management (unset required rows, Add Attribute,
     * and the pencil) is available to a channel admin regardless of an attribute's
     * own setter tier.
     */
    test('shows a channel admin every attribute, including unset ones, and lets them add or edit', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
