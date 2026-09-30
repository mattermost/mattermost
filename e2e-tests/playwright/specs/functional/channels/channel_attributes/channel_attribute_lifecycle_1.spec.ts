// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    DISPLAY_LABEL_HEADER,
    DISPLAY_LABEL_INFO,
    assertNoForeignRequiredAttributes,
    attributeName,
    createAttribute,
    deleteAttributes,
    optionId,
    purgeAttributes,
    setChannelValue,
} from './helpers';

test.describe('Channel attribute lifecycle', {tag: ['@channel_attributes']}, () => {
    /**
     * @objective Verify a required attribute is asked for at creation and blocks it until filled.
     */
    test('blocks channel creation until a required attribute is filled', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);
        await pw.ensureFeatureFlag('ChannelAttributesRequired', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const required = await createAttribute(adminClient, attributeName('mandatory', suffix), {
                options: ['ALPHA'],
                actions: [DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO],
                required: true,
            });
            const optional = await createAttribute(adminClient, attributeName('discretionary', suffix), {
                options: ['BETA'],
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(required, optional);

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();

            // Required is asked for; optional is not.
            await expect(page.getByTestId(`channelAttributeRow-${required.name}`)).toBeVisible();
            await expect(page.getByTestId(`channelAttributeRow-${optional.name}`)).toHaveCount(0);

            const displayName = `Attr Required ${suffix}`;
            await modal.fillDisplayName(displayName);

            // The dialog blocks submission so the user finds out here; the server
            // refuses the same create independently.
            await expect(modal.createButton).toBeDisabled();

            await page.getByTestId(`channelAttribute-${required.name}`).click();
            await page.getByText('ALPHA', {exact: true}).click();

            await expect(modal.createButton).toBeEnabled();
            await modal.create();
            await expect(modal.container).not.toBeVisible();

            const channel = await adminClient.getChannelByName(team.id, displayName.toLowerCase().replace(/\s+/g, '-'));
            const values = await adminClient.getPropertyValues('access_control', 'channel', channel.id);
            expect(values?.find((value) => value.field_id === required.id)?.value).toBe(optionId(required, 'ALPHA'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a value changed elsewhere reaches an open session without a reload.
     */
    test('updates an open session when a value changes, and when it is cleared', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('live', suffix), {
                options: ['BEFORE', 'AFTER'],
                actions: [DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO],
            });
            created.push(program);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `attr-live-${suffix}`,
                display_name: `Attr Live ${suffix}`,
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, program, optionId(program, 'BEFORE'));

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const chips = page.getByTestId('attributeChip');
            await expect(chips.filter({hasText: 'BEFORE'}).first()).toBeVisible();

            // Changed elsewhere, this session untouched.
            await setChannelValue(adminClient, channel.id, program, optionId(program, 'AFTER'));

            await expect(chips.filter({hasText: 'AFTER'}).first()).toBeVisible();
            await expect(chips.filter({hasText: 'BEFORE'})).toHaveCount(0);

            // The shape most easily got wrong: a clear returns a null-valued row,
            // not a delete event.
            await setChannelValue(adminClient, channel.id, program, null);

            await expect(page.getByTestId('attributeChip')).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a required attribute left unset after creation is visible and recoverable from Channel Info.
     */
    test('shows a required attribute as unset and lets it be filled from Channel Info', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);
        await pw.ensureFeatureFlag('ChannelAttributesRequired', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            // The channel comes first, because creating one that misses a required
            // attribute is refused now. What remains reachable is an attribute that
            // becomes required after the fact, which is how an existing channel ends up
            // short of its own requirement.
            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `attr-unset-${suffix}`,
                display_name: `Attr Unset ${suffix}`,
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);

            // The unset-required row and its edit path are admin-only in Channel Info,
            // so recovering it needs a channel admin, not a plain member.
            await adminClient.updateChannelMemberSchemeRoles(channel.id, user.id, true, true);

            const required = await createAttribute(adminClient, attributeName('unfilled', suffix), {
                options: ['RECOVERED'],
                actions: [DISPLAY_LABEL_INFO],
                required: true,
            });
            created.push(required);

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();
            await page.locator('#channel-info-btn').click();

            // The empty row is both the signal and the retry path.
            const row = page.getByTestId(`channelInfoAttributeRow-${required.name}`);
            await expect(row).toBeVisible();
            await expect(row).toContainText('Not set');

            // No chip while unset.
            await expect(page.getByTestId('attributeChip')).toHaveCount(0);

            // Opens the menu, then picks the option -- with a single option, the
            // shortcut testid below IS that option, so this already commits the value.
            await page.getByTestId(`channelInfoAttributeEdit-${required.name}`).click();
            await page.getByTestId(`channelAttributeEdit-${required.name}`).click();

            await expect(row).toContainText('RECOVERED');

            await expect
                .poll(async () => {
                    const values = await adminClient.getPropertyValues('access_control', 'channel', channel.id);
                    return values?.find((value) => value.field_id === required.id)?.value;
                })
                .toBe(optionId(required, 'RECOVERED'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
