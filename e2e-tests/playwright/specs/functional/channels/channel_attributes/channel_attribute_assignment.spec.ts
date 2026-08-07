// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    attributeName,
    createAttribute,
    deleteAttributes,
    optionId,
    purgeAttributes,
    readChannelValues,
    valueFor,
} from './helpers';

test.describe('Channel attribute assignment', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify every supported attribute control can be assigned while creating a channel.
     */
    test('assigns select, multiselect, and text attribute values at channel creation', async ({pw}) => {
        await pw.skipIfNoLicense();

        // The Properties route gate is evaluated when the API router is built, so
        // the flag has to be in the server config before boot.
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('program', suffix), {
                options: ['AURORA', 'BOREALIS'],
            });
            const caveats = await createAttribute(adminClient, attributeName('caveats', suffix), {
                type: 'multiselect',
                options: ['NOFORN', 'ORCON'],
            });
            const note = await createAttribute(adminClient, attributeName('note', suffix), {type: 'text'});
            const userScoped = await createAttribute(adminClient, attributeName('clearance', suffix), {
                objectType: 'user',
                options: ['SECRET'],
            });
            created.push(program, caveats, note, userScoped);

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();

            // Only the channel-scoped attributes belong here; a user attribute in
            // the same group must not leak into channel creation.
            await expect(page.getByTestId(`channelAttributeRow-${program.name}`)).toBeVisible();
            await expect(page.getByTestId(`channelAttributeRow-${caveats.name}`)).toBeVisible();
            await expect(page.getByTestId(`channelAttributeRow-${note.name}`)).toBeVisible();
            await expect(page.getByTestId(`channelAttributeRow-${userScoped.name}`)).toHaveCount(0);

            const displayName = `Attr Channel ${suffix}`;
            await modal.fillDisplayName(displayName);

            await page.getByTestId(`channelAttribute-${program.name}`).click();
            await page.getByText('AURORA', {exact: true}).click();

            // The menu closes on each pick, so a multiselect needs reopening to
            // add the second value. Two values is what proves the array shape.
            await page.getByTestId(`channelAttribute-${caveats.name}`).click();
            await page.getByText('NOFORN', {exact: true}).click();
            await page.getByTestId(`channelAttribute-${caveats.name}`).click();
            await page.getByText('ORCON', {exact: true}).click();

            await page.getByLabel(note.name, {exact: true}).fill('handle with care');

            await modal.create();

            // The values are written after the channel exists and the modal only
            // closes once that resolves, so this is the signal the write finished.
            // The channel header is already visible from before, so waiting on it
            // races the write.
            await expect(modal.container).not.toBeVisible();

            const channel = await adminClient.getChannelByName(team.id, displayName.toLowerCase().replace(/\s+/g, '-'));
            const values = await readChannelValues(adminClient, channel.id);

            expect(valueFor(values, program)).toBe(optionId(program, 'AURORA'));
            expect(valueFor(values, caveats)).toEqual([optionId(caveats, 'NOFORN'), optionId(caveats, 'ORCON')]);
            expect(valueFor(values, note)).toBe('handle with care');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify attribute assignment works for a private channel, not only a public one.
     */
    test('assigns attribute values when creating a private channel', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('private_program', suffix), {
                options: ['AURORA', 'BOREALIS'],
            });
            created.push(program);

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();

            const displayName = `Attr Private ${suffix}`;
            await modal.fillDisplayName(displayName);
            await modal.privateTypeButton.click();

            await page.getByTestId(`channelAttribute-${program.name}`).click();
            await page.getByText('BOREALIS', {exact: true}).click();

            await modal.create();
            await expect(modal.container).not.toBeVisible();

            const channel = await adminClient.getChannelByName(team.id, displayName.toLowerCase().replace(/\s+/g, '-'));
            expect(channel.type).toBe('P');

            const values = await readChannelValues(adminClient, channel.id);
            expect(valueFor(values, program)).toBe(optionId(program, 'BOREALIS'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a failed value write is surfaced rather than swallowed.
     */
    test('surfaces a value write failure and keeps the channel', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('failing', suffix), {
                options: ['AURORA'],
            });
            created.push(program);

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            // Fail only the value write. Channel creation must still succeed, so
            // this proves the error is reported rather than the channel rolled back.
            await page.route('**/api/v4/properties/groups/access_control/channel/values/**', (route) => {
                if (route.request().method() === 'PATCH') {
                    route.fulfill({status: 500, body: '{"message":"forced failure"}'});
                    return;
                }
                route.continue();
            });

            const modal = await channelsPage.openNewChannelModal();

            const displayName = `Attr Fail ${suffix}`;
            await modal.fillDisplayName(displayName);
            await page.getByTestId(`channelAttribute-${program.name}`).click();
            await page.getByText('AURORA', {exact: true}).click();
            await modal.create();

            // The error names the attribute that was not saved.
            await expect(page.getByText(program.name, {exact: false})).toBeVisible();

            const channel = await adminClient.getChannelByName(team.id, displayName.toLowerCase().replace(/\s+/g, '-'));
            expect(channel.delete_at).toBe(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
