// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

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

test.describe('Channel attribute editing', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify a text value can be changed from Channel Info and commits on Enter.
     */
    test('edits a text attribute inline and commits on Enter', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
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
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, note, 'first draft');

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // # Replace the existing value and commit with Enter
            const info = await channelsPage.openChannelInfo();
            await expect(info.attributes.chip(note.name)).toHaveText('first draft');
            await info.attributes.setText(note.name, 'second draft', 'enter');

            // * The new value replaces the old one, in the panel and in the store
            await expect(info.attributes.chip(note.name)).toHaveText('second draft');
            await expect.poll(async () => {
                return valueFor(await readChannelValues(adminClient, channel.id), note);
            }).toBe('second draft');
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

        const {adminClient, user, team} = await pw.initSetup();
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
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, note, 'original');

            const {channelsPage} = await pw.testBrowser.login(user);
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
            await expect.poll(async () => {
                return valueFor(await readChannelValues(adminClient, channel.id), note);
            }).toBe('blurred');
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

        const {adminClient, user, team} = await pw.initSetup();
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
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, caveats, [optionId(caveats, 'NOFORN')]);

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const info = await channelsPage.openChannelInfo();

            // # Add a second option to the existing one
            await info.attributes.select(caveats.name, 'ORCON');

            // * Both options are stored, in the order they were picked
            await expect.poll(async () => {
                return valueFor(await readChannelValues(adminClient, channel.id), caveats);
            }).toEqual([optionId(caveats, 'NOFORN'), optionId(caveats, 'ORCON')]);

            // # Remove the first one from the still-open editor
            await info.attributes.deselect(caveats.name, 'NOFORN');

            // * Only the remaining option survives, and the header agrees
            await expect.poll(async () => {
                return valueFor(await readChannelValues(adminClient, channel.id), caveats);
            }).toEqual([optionId(caveats, 'ORCON')]);
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

        const {adminClient, user, team} = await pw.initSetup();
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
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, note, 'kept');

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            await page.route('**/api/v4/properties/groups/access_control/channel/values/**', (route) => {
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
            await expect.poll(async () => {
                return valueFor(await readChannelValues(adminClient, channel.id), note);
            }).toBe('never saved');
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

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            // The lock bites only once a value exists, so an empty one is still fillable.
            const marking = await createAttribute(adminClient, attributeName('locked_once', suffix), {
                options: ['FINAL'],
                actions: [DISPLAY_LABEL_INFO],
                editable: false,
                required: true,
            });
            created.push(marking);

            const channel = await createChannelForAttributes(adminClient, team, `edit-lock-${suffix}`);
            await adminClient.addToChannel(user.id, channel.id);

            const {channelsPage} = await pw.testBrowser.login(user);
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
            const channelAdmin = await pw.createNewUserProfile(adminClient, {prefix: 'chanadmin'});
            await adminClient.addToTeam(team.id, channelAdmin.id);
            await adminClient.addToChannel(channelAdmin.id, channel.id);
            await adminClient.updateChannelMemberSchemeRoles(channel.id, channelAdmin.id, true, true);
            await adminClient.addToChannel(user.id, channel.id);

            // # Look at it as the channel admin
            const asAdmin = await pw.testBrowser.login(channelAdmin);
            await asAdmin.channelsPage.goto(team.name, channel.name);
            await asAdmin.channelsPage.toBeVisible();
            const adminInfo = await asAdmin.channelsPage.openChannelInfo();

            // * The channel admin clears the admin tier, so the attribute is offered
            // * for adding and can be set. An unset optional attribute has no row of
            // * its own until it has a value.
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
