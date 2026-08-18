// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — applying an attribute to channels.
 *
 * The Channels resource row writes the channel keys onto a linked channel field,
 * and the channel surfaces honour them. Every test here configures through the
 * console UI and then checks what a user sees, with no API seeding in between.
 */

import {expect, test, getAdminClient} from '@mattermost/playwright-lib';

import {
    configureChannelAttribute,
    deleteChannelFieldIfExists,
    findChannelField,
} from './applies_to_helpers';
import {
    deleteGlobalAttributeFieldIfExists,
    requireGlobalAttributesEnabled,
    setGlobalAttributesFeatureFlag,
} from './global_attributes_helpers';

test.describe('System Console - applying an attribute to channels', {tag: ['@system_console', '@channel_attributes']}, () => {
    // Shares the server-wide GlobalAttributes flag with the sibling spec.
    test.describe.configure({mode: 'serial'});

    let originalFlagValue: boolean | undefined;

    test.beforeAll(async () => {
        const {adminClient} = await getAdminClient();
        const {FeatureFlags} = await adminClient.getConfig();
        originalFlagValue = FeatureFlags.GlobalAttributes === true;
    });

    test.afterAll(async () => {
        const {adminClient} = await getAdminClient();
        if (adminClient && originalFlagValue !== undefined) {
            await setGlobalAttributesFeatureFlag(adminClient, originalFlagValue);
        }
    });

    /**
     * @objective Ensure the Channels row writes every channel key onto a linked channel field.
     */
    test('creates a linked channel field carrying the configured keys', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const suffix = pw.random.id();
        const displayName = `Program ${suffix}`;
        let name = '';

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);

            // # Apply it to channels, required, shown in the header and the banner,
            // # settable by any member rather than the default channel admin
            name = await configureChannelAttribute(systemConsolePage, {
                displayName,
                required: true,
                displayLocations: ['display_label_header', 'display_banner_top'],
                setter: 'Any member',
            });

            // * The linked channel field carries every configured key
            const channelField = await findChannelField(adminClient, name);
            expect(channelField).toBeDefined();
            expect(channelField?.linked_field_id).toBeTruthy();
            expect(channelField?.object_type).toBe('channel');
            expect(channelField?.permission_values).toBe('member');
            expect(channelField?.attrs?.required).toBe(true);
            expect(channelField?.attrs?.actions).toEqual(['display_label_header', 'display_banner_top']);

            // * Options stay on the template; a linked field never carries its own
            expect(channelField?.attrs?.options).toBeUndefined();
        } finally {
            await deleteChannelFieldIfExists(adminClient, name);
            await deleteGlobalAttributeFieldIfExists(adminClient, name);
        }
    });

    /**
     * @objective Ensure an attribute configured through the System Console is asked for at
     * channel creation and rendered afterwards, with no API seeding anywhere in the path.
     */
    test('an attribute configured here is required when creating a channel and shown in its header', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const suffix = pw.random.id();
        let name = '';

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);

            name = await configureChannelAttribute(systemConsolePage, {
                displayName: `Caveat ${suffix}`,
                type: 'Select',
                options: ['NOFORN'],
                required: true,
                displayLocations: ['display_label_header'],
            });

            // # Create a channel as the same admin, who is a member of a team
            const {team} = await pw.initSetup();
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();

            // * The attribute is asked for, because it was marked required here
            await expect(channelsPage.page.getByTestId(`channelAttributeRow-${name}`)).toBeVisible();

            await modal.fillDisplayName(`Attr Console ${suffix}`);
            await channelsPage.page.getByTestId(`channelAttribute-${name}`).click();
            await channelsPage.page.getByText('NOFORN', {exact: true}).click();
            await modal.create();
            await expect(modal.container).not.toBeVisible();

            // * The value renders as a header chip, because it was designated here
            await expect(channelsPage.centerView.header.attributes.chip('NOFORN')).toBeVisible();
        } finally {
            await deleteChannelFieldIfExists(adminClient, name);
            await deleteGlobalAttributeFieldIfExists(adminClient, name);
        }
    });

    /**
     * @objective Ensure the Sidebar display location puts the attribute in Channel Info only.
     */
    test('shows a Sidebar-only attribute in Channel Info and not in the header', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const suffix = pw.random.id();
        let name = '';

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);

            name = await configureChannelAttribute(systemConsolePage, {
                displayName: `Sidebar ${suffix}`,
                type: 'Select',
                options: ['INTERNAL'],
                required: true,
                displayLocations: ['display_label_info'],
            });

            const {team} = await pw.initSetup();
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            await modal.fillDisplayName(`Attr Sidebar ${suffix}`);
            await channelsPage.page.getByTestId(`channelAttribute-${name}`).click();
            await channelsPage.page.getByText('INTERNAL', {exact: true}).click();
            await modal.create();
            await expect(modal.container).not.toBeVisible();

            // * Channel Info carries it; the header does not
            const info = await channelsPage.openChannelInfo();
            await expect(info.attributes.chip(name)).toHaveText('INTERNAL');
            await expect(channelsPage.centerView.header.attributes.chip('INTERNAL')).toHaveCount(0);
        } finally {
            await deleteChannelFieldIfExists(adminClient, name);
            await deleteGlobalAttributeFieldIfExists(adminClient, name);
        }
    });

    /**
     * @objective Ensure the Banner display location renders a banner and nothing else.
     */
    test('renders a Banner-only attribute as a banner, with no chip', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const suffix = pw.random.id();
        let name = '';

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);

            name = await configureChannelAttribute(systemConsolePage, {
                displayName: `Marking ${suffix}`,
                type: 'Select',
                options: ['RESTRICTED'],
                required: true,
                displayLocations: ['display_banner_top'],
            });

            const {team} = await pw.initSetup();
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            await modal.fillDisplayName(`Attr Banner ${suffix}`);
            await channelsPage.page.getByTestId(`channelAttribute-${name}`).click();
            await channelsPage.page.getByText('RESTRICTED', {exact: true}).click();
            await modal.create();
            await expect(modal.container).not.toBeVisible();

            // * The value drives the banner and stays out of the header
            await expect(channelsPage.page.getByTestId('channel_banner_text')).toContainText('RESTRICTED');
            await expect(channelsPage.centerView.header.attributes.chip('RESTRICTED')).toHaveCount(0);
        } finally {
            await deleteChannelFieldIfExists(adminClient, name);
            await deleteGlobalAttributeFieldIfExists(adminClient, name);
        }
    });

    /**
     * @objective Ensure an attribute with no display location is stored and shown nowhere.
     */
    test('stores a value for an attribute with no display location and renders it nowhere', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const suffix = pw.random.id();
        let name = '';

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);

            name = await configureChannelAttribute(systemConsolePage, {
                displayName: `Quiet ${suffix}`,
                type: 'Select',
                options: ['QUIET'],
                required: true,
            });

            const {team} = await pw.initSetup();
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const displayName = `Attr Quiet ${suffix}`;
            const modal = await channelsPage.openNewChannelModal();
            await modal.fillDisplayName(displayName);
            await channelsPage.page.getByTestId(`channelAttribute-${name}`).click();
            await channelsPage.page.getByText('QUIET', {exact: true}).click();
            await modal.create();
            await expect(modal.container).not.toBeVisible();

            // * The value reached the store
            const channel = await adminClient.getChannelByName(
                team.id,
                displayName.toLowerCase().replace(/\s+/g, '-'),
            );
            const values = await adminClient.getPropertyValues('access_control', 'channel', channel.id);
            expect(values?.length).toBeGreaterThan(0);

            // * And is rendered on no surface at all
            await expect(channelsPage.centerView.header.attributes.chip('QUIET')).toHaveCount(0);
            await expect(channelsPage.page.getByTestId('channel_banner_container')).toHaveCount(0);

            const info = await channelsPage.openChannelInfo();
            await expect(info.attributes.row(name)).toHaveCount(0);
        } finally {
            await deleteChannelFieldIfExists(adminClient, name);
            await deleteGlobalAttributeFieldIfExists(adminClient, name);
        }
    });

    /**
     * @objective Ensure "Cannot be changed once set" locks the value in Channel Info.
     */
    test('locks the value in Channel Info when the change policy forbids changes', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const suffix = pw.random.id();
        let name = '';

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);

            name = await configureChannelAttribute(systemConsolePage, {
                displayName: `Locked ${suffix}`,
                type: 'Select',
                options: ['FINAL'],
                required: true,
                changePolicy: 'Cannot be changed once set',
                displayLocations: ['display_label_info'],
            });

            // * The console wrote both keys: change_policy, and the editable key the
            // * channel UI still reads
            const channelField = await findChannelField(adminClient, name);
            expect(channelField?.attrs?.change_policy).toBe('never');
            expect(channelField?.attrs?.editable).toBe(false);

            const {team} = await pw.initSetup();
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            await modal.fillDisplayName(`Attr Locked ${suffix}`);
            await channelsPage.page.getByTestId(`channelAttribute-${name}`).click();
            await channelsPage.page.getByText('FINAL', {exact: true}).click();
            await modal.create();
            await expect(modal.container).not.toBeVisible();

            // * Once set at creation the value is read-only, even to a system admin
            const info = await channelsPage.openChannelInfo();
            await expect(info.attributes.lock(name)).toBeVisible();
            await expect(info.attributes.editButton(name)).toHaveCount(0);
        } finally {
            await deleteChannelFieldIfExists(adminClient, name);
            await deleteGlobalAttributeFieldIfExists(adminClient, name);
        }
    });

    /**
     * @objective Ensure the configured setter tier reaches the channel field, so a
     * "Channel admin" attribute is not editable by an ordinary member.
     */
    test('keeps a Channel admin setter out of a plain member reach', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const suffix = pw.random.id();
        let name = '';

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);

            name = await configureChannelAttribute(systemConsolePage, {
                displayName: `Restricted ${suffix}`,
                type: 'Select',
                options: ['SET'],
                required: true,
                displayLocations: ['display_label_info'],
                setter: 'Channel admin',
            });

            // The linked field used to inherit the template's sysadmin tier and
            // silently discard this pin.
            const channelField = await findChannelField(adminClient, name);
            expect(channelField?.permission_values).toBe('admin');

            const {team, user} = await pw.initSetup();
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const channelDisplayName = `Attr Restricted ${suffix}`;
            const modal = await channelsPage.openNewChannelModal();
            await modal.fillDisplayName(channelDisplayName);
            await channelsPage.page.getByTestId(`channelAttribute-${name}`).click();
            await channelsPage.page.getByText('SET', {exact: true}).click();
            await modal.create();
            await expect(modal.container).not.toBeVisible();

            const channel = await adminClient.getChannelByName(
                team.id,
                channelDisplayName.toLowerCase().replace(/\s+/g, '-'),
            );
            await adminClient.addToChannel(user.id, channel.id);

            // # Look at the same attribute as an ordinary member
            const asMember = await pw.testBrowser.login(user);
            await asMember.channelsPage.goto(team.name, channel.name);
            await asMember.channelsPage.toBeVisible();

            // * The member reads the value but is offered no way to change it
            const info = await asMember.channelsPage.openChannelInfo();
            await expect(info.attributes.chip(name)).toHaveText('SET');
            await expect(info.attributes.editButton(name)).toHaveCount(0);
        } finally {
            await deleteChannelFieldIfExists(adminClient, name);
            await deleteGlobalAttributeFieldIfExists(adminClient, name);
        }
    });
});
