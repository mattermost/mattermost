// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — applying an attribute to channels.
 *
 * The Channels resource row writes the channel keys onto a linked channel field,
 * and the channel surfaces honour them. Every test here configures through the
 * console UI and then checks what a user sees, with no API seeding in between.
 */

import {
    Api,
    settle,
    attributeRow,
    attributeValue,
    expect,
    labelChip,
    labelChips,
    openAttributeControl,
    openChannel,
    openChannelInfo,
    openNewChannelModal,
    pickListOption,
    test,
    type App,
    DefaultChannel,
} from '@mattermost/playwright-lib';

import {
    channelFieldNamed,
    configureChannelAttribute,
    deleteChannelFieldIfExists,
    findChannelField,
} from './applies_to_helpers';
import {
    createGlobalAttributeField,
    createLinkedDependentField,
    deleteGlobalAttributeFieldIfExists,
    deleteLinkedDependentField,
    requireGlobalAttributesEnabled,
} from './global_attributes_helpers';

/** Creates a channel from the open new-channel dialog, picking `option` for the attribute; waits for it to close. */
async function createChannel(
    app: App,
    modal: App['newChannelModal'],
    field: {id: string},
    displayName: string,
    option: string,
) {
    await modal.name.container.fill(displayName);
    await expect(modal.name.container).toHaveValue(displayName);
    await openAttributeControl(modal, field);
    await pickListOption(app, option);
    await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
    await expect(modal).not.toBeVisible();
    await expect(modal.name.container).not.toBeVisible();
}

test.describe(
    'System Console - applying an attribute to channels',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        test.describe.configure({mode: 'serial'});

        /**
         * @objective Ensure the Channels row writes every channel key onto a linked channel field.
         */
        test('creates a linked channel field carrying the configured keys', async ({pw}) => {
            // The Required toggle this test flips only renders in the System Console
            // while this kill switch is on (model.IsChannelAttributesRequiredEnabled).
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            const displayName = `Program ${suffix}`;
            let name = '';

            try {
                const {app: admin} = await pw.testBrowser.login(adminUser);

                // # Apply it to channels, required, shown in the header and the banner
                name = await configureChannelAttribute(
                    admin,
                    {
                        displayName,
                        required: true,
                        displayLocations: ['display_label_header', 'display_banner_top'],
                    },
                    adminClient,
                );

                // * The linked channel field carries every configured key
                const channelField = await findChannelField(adminClient, name);
                expect(channelField).toBeDefined();
                expect(channelField?.linked_field_id).toBeTruthy();
                expect(channelField?.object_type).toBe('channel');

                // The console has no control for this, so the payload has to pin it: the
                // server would otherwise default a channel field to any member.
                expect(channelField?.permission_values).toBe('admin');
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
        test('an attribute configured here is required when creating a channel and shown in its header', async ({
            pw,
        }) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            let name = '';

            try {
                const {app: admin} = await pw.testBrowser.login(adminUser);

                name = await configureChannelAttribute(
                    admin,
                    {
                        displayName: `Caveat ${suffix}`,
                        type: 'select',
                        options: ['NOFORN'],
                        required: true,
                        displayLocations: ['display_label_header'],
                    },
                    adminClient,
                );

                // # Create a channel as the same admin, who is a member of a team
                const {team} = await pw.initSetup();
                const app = await openChannel(pw, adminUser, {team, channel: {name: DefaultChannel.TownSquare}});

                const field = await channelFieldNamed(adminClient, name);
                const modal = await openNewChannelModal(app);

                // * The attribute is asked for, because it was marked required here
                await expect(modal.attributes.attribute(field)).toBeVisible();

                await createChannel(app, modal, field, `Attr Console ${suffix}`, 'NOFORN');

                // * The value renders as a header chip, because it was designated here
                await expect(await labelChip(app.channelHeader.attributes, 'NOFORN')).toBeVisible();
            } finally {
                await deleteChannelFieldIfExists(adminClient, name);
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure the Banner display location renders a banner and nothing else.
         */
        test('renders a Banner-only attribute as a banner, with no chip', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            let name = '';

            try {
                const {app: admin} = await pw.testBrowser.login(adminUser);

                name = await configureChannelAttribute(
                    admin,
                    {
                        displayName: `Marking ${suffix}`,
                        type: 'select',
                        options: ['RESTRICTED'],
                        required: true,
                        displayLocations: ['display_banner_top'],
                    },
                    adminClient,
                );

                const {team} = await pw.initSetup();
                const app = await openChannel(pw, adminUser, {team, channel: {name: DefaultChannel.TownSquare}});

                const field = await channelFieldNamed(adminClient, name);
                const modal = await openNewChannelModal(app);
                await createChannel(app, modal, field, `Attr Banner ${suffix}`, 'RESTRICTED');

                // * The value drives the banner and stays out of the header
                await expect(app.center.channelBanner.textText).toContainText('RESTRICTED');
                await expect(labelChips(app.channelHeader.attributes, 'RESTRICTED')).toHaveCount(0);
            } finally {
                await deleteChannelFieldIfExists(adminClient, name);
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure an attribute with no display location is stored and shown nowhere.
         */
        test('stores a value for an attribute with no display location and renders it nowhere', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            let name = '';

            try {
                const {app: admin} = await pw.testBrowser.login(adminUser);

                name = await configureChannelAttribute(
                    admin,
                    {
                        displayName: `Quiet ${suffix}`,
                        type: 'select',
                        options: ['QUIET'],
                        required: true,
                    },
                    adminClient,
                );

                const {team} = await pw.initSetup();
                const app = await openChannel(pw, adminUser, {team, channel: {name: DefaultChannel.TownSquare}});

                const displayName = `Attr Quiet ${suffix}`;
                const field = await channelFieldNamed(adminClient, name);
                const modal = await openNewChannelModal(app);
                await createChannel(app, modal, field, displayName, 'QUIET');

                // * The value reached the store
                const channel = await adminClient.getChannelByName(
                    team.id,
                    displayName.toLowerCase().replace(/\s+/g, '-'),
                );
                const values = await adminClient.getPropertyValues('access_control', 'channel', channel.id);
                expect(values?.length).toBeGreaterThan(0);

                // * And is rendered on no display surface
                await expect(labelChips(app.channelHeader.attributes, 'QUIET')).toHaveCount(0);
                await expect(app.center.channelBanner).toHaveCount(0);

                // * Channel Info still lists it: the display locations govern the
                // header and banner, never whether an admin can reach a value
                const info = await openChannelInfo(app);
                await expect(await attributeValue(info, field)).toHaveText('QUIET');
                await expect(attributeRow(info, field).editButton).toBeVisible();
            } finally {
                await deleteChannelFieldIfExists(adminClient, name);
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure "Cannot be changed once set" locks the value in Channel Info.
         */
        test('locks the value in Channel Info when the change policy forbids changes', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            let name = '';

            try {
                const {app: admin} = await pw.testBrowser.login(adminUser);

                name = await configureChannelAttribute(
                    admin,
                    {
                        displayName: `Locked ${suffix}`,
                        type: 'select',
                        options: ['FINAL'],
                        required: true,
                        changePolicy: 'never',
                    },
                    adminClient,
                );

                // * The console wrote both keys: change_policy, and the editable key the
                // * channel UI still reads
                const channelField = await findChannelField(adminClient, name);
                expect(channelField?.attrs?.change_policy).toBe('never');
                expect(channelField?.attrs?.editable).toBe(false);

                const {team} = await pw.initSetup();
                const app = await openChannel(pw, adminUser, {team, channel: {name: DefaultChannel.TownSquare}});

                const field = await channelFieldNamed(adminClient, name);
                const modal = await openNewChannelModal(app);
                await createChannel(app, modal, field, `Attr Locked ${suffix}`, 'FINAL');

                // * Once set at creation the value is read-only, even to a system admin
                const info = await openChannelInfo(app);
                await expect(attributeRow(info, field).locked).toBeVisible();
                await expect(attributeRow(info, field).editButton).toHaveCount(0);
            } finally {
                await deleteChannelFieldIfExists(adminClient, name);
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure the channel-admin tier the console pins reaches the channel
         * field, so an attribute configured here is not editable by an ordinary member.
         *
         * There is no control for this, which is what makes the assertion worth keeping:
         * the tier is only correct as long as the payload keeps pinning it.
         */
        test('keeps a console-configured attribute out of a plain member reach', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            let name = '';

            try {
                const {app: admin} = await pw.testBrowser.login(adminUser);

                name = await configureChannelAttribute(
                    admin,
                    {
                        displayName: `Restricted ${suffix}`,
                        type: 'select',
                        options: ['SET'],
                        required: true,
                    },
                    adminClient,
                );

                const channelField = await findChannelField(adminClient, name);
                expect(channelField?.permission_values).toBe('admin');

                const {team, user} = await pw.initSetup();
                const app = await openChannel(pw, adminUser, {team, channel: {name: DefaultChannel.TownSquare}});

                const channelDisplayName = `Attr Restricted ${suffix}`;
                const field = await channelFieldNamed(adminClient, name);
                const modal = await openNewChannelModal(app);
                await createChannel(app, modal, field, channelDisplayName, 'SET');

                const channel = await adminClient.getChannelByName(
                    team.id,
                    channelDisplayName.toLowerCase().replace(/\s+/g, '-'),
                );
                await adminClient.addToChannel(user.id, channel.id);

                // # Look at the same attribute as an ordinary member
                const asMember = await openChannel(pw, user, {team, channel});

                // * The member reads the value but is offered no way to change it
                const info = await openChannelInfo(asMember);
                await expect(await attributeValue(info, field)).toHaveText('SET');
                await expect(attributeRow(info, field).editButton).toHaveCount(0);
            } finally {
                await deleteChannelFieldIfExists(adminClient, name);
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });
        /**
         * @objective Regression for MM-70890: a template with ldap/saml sync attrs applied to
         * a channel must NOT copy those attrs onto the channel-linked field. Without the fix,
         * checkSyncLock blocks all writes to the channel field with 403 because the field
         * carries attrs.ldap/attrs.saml even though SAML/LDAP sync never writes channel values.
         */
        test('channel-linked field does not inherit ldap/saml sync attrs from the template', async ({pw}) => {
            const {adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            const name = `sync_attr_regression_${suffix}`;
            let templateId = '';
            let channelFieldId = '';

            try {
                // # Create a template with ldap and saml attrs via API
                const template = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {ldap: 'sAMAccountName', saml: 'employeeID'},
                });
                templateId = template.id;

                // # Link a channel field to that template
                const channelField = await createLinkedDependentField(
                    adminClient,
                    name,
                    template.id,
                    'text',
                    'channel',
                );
                channelFieldId = channelField.id;

                // * The channel field must not carry ldap or saml attrs
                expect(channelField.attrs?.ldap).toBeUndefined();
                expect(channelField.attrs?.saml).toBeUndefined();
            } finally {
                if (channelFieldId) {
                    await deleteLinkedDependentField(adminClient, channelFieldId, 'channel');
                }
                if (templateId) {
                    await deleteGlobalAttributeFieldIfExists(adminClient, name);
                }
            }
        });
    },
);
