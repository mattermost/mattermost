// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Observed full-file duration: ~1.9m end-to-end (close to the 2-minute mark) —
// worth knowing if a CI or local retest budget assumes this file is fast.

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
    /**
     * @objective Verify a text value can be changed from Channel Info and commits on Enter.
     */
    test('edits a text attribute inline and commits on Enter', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

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
        await pw.ensureFeatureFlag('ChannelAttributes', true);

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
        await pw.ensureFeatureFlag('ChannelAttributes', true);

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
});
