// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * A channel attribute can't be Required while channel creators can't set its
 * value: new channels would be created without it, so the server refuses the
 * save and the System Console shows why.
 */

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    GROUP,
    attributeName,
    backfillChannelAttribute,
    createAttribute,
    deleteAttributes,
    optionId,
    purgeAttributes,
} from '../../channels/channel_attributes/helpers';

import {requireGlobalAttributesEnabled} from './global_attributes_helpers';
import {
    ATTRIBUTE_DETAILS_PATH,
    createChannelAttributeField,
    deleteChannelAttributeField,
    fieldName,
    getChannelPropertyField,
    optionId as templateOptionId,
    purgeRequiredGateFields,
} from './required_gate_helpers';

const UNFILLABLE_ERROR_ID = 'app.property_field.required_unfillable.app_error';
const UNFILLABLE_MESSAGE = "Channel creators can't set this attribute, so it can't be required.";

type ClientErrorLike = {status_code?: number; server_error_id?: string};

async function expectRefusal(request: Promise<unknown>, status: number, errorId: string) {
    const error = (await request.then(
        () => {
            throw new Error(`expected the server to refuse with ${errorId}`);
        },
        (e: unknown) => e,
    )) as ClientErrorLike;
    expect(error.status_code).toBe(status);
    expect(error.server_error_id).toBe(errorId);
}

test.describe(
    'System Console - required attributes channel creators cannot set',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        /**
         * @objective Verify the API refuses a Required channel attribute whose value
         * channel creators can't set, and accepts one they can.
         */
        test('refuses Required on a field channel creators cannot set, through the API', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeAttributes(adminClient);
            await pw.initSetup();

            const fields: PropertyField[] = [];
            try {
                // # Mark a sysadmin-level field Required
                const sysadminField = await createAttribute(adminClient, attributeName('sysadmin', suffix), {
                    type: 'select',
                    options: ['Value A'],
                    permissionValues: 'sysadmin',
                });
                fields.push(sysadminField);
                await backfillChannelAttribute(adminClient, sysadminField, optionId(sysadminField, 'Value A'));

                // * Refused before any channel scan, and the field stays optional
                await expectRefusal(
                    adminClient.patchPropertyField(GROUP, 'channel', sysadminField.id, {
                        attrs: {...sysadminField.attrs, required: true},
                    }),
                    400,
                    UNFILLABLE_ERROR_ID,
                );
                const reloaded = await getChannelPropertyField(adminClient, sysadminField.id);
                expect(reloaded.attrs?.required).not.toBe(true);

                // # Create a none-level field already Required
                // * Refused
                await expectRefusal(
                    adminClient.createPropertyField(GROUP, 'channel', {
                        name: attributeName('none', suffix),
                        type: 'text',
                        target_type: 'system',
                        target_id: '',
                        permission_field: 'admin',
                        permission_values: 'none',
                        permission_options: 'admin',
                        attrs: {required: true},
                    } as Parameters<typeof adminClient.createPropertyField>[2]),
                    400,
                    UNFILLABLE_ERROR_ID,
                );

                // # Mark an admin-level field Required once every channel has a value
                const adminField = await createAttribute(adminClient, attributeName('admin', suffix), {
                    type: 'select',
                    options: ['Value A'],
                    permissionValues: 'admin',
                });
                fields.push(adminField);
                await backfillChannelAttribute(adminClient, adminField, optionId(adminField, 'Value A'));
                const required = await adminClient.patchPropertyField(GROUP, 'channel', adminField.id, {
                    attrs: {...adminField.attrs, required: true},
                });

                // * Accepted
                expect(required.attrs?.required).toBe(true);
            } finally {
                await deleteAttributes(adminClient, fields);
            }
        });

        /**
         * @objective Verify the System Console shows the refusal inline when Required is
         * turned on for a field channel creators can't set, and nothing is saved.
         */
        test('shows an error and keeps Required off when channel creators cannot set the field', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);
            await pw.initSetup();

            // The console edits the template; its linked channel field holds the values.
            const pair = await createChannelAttributeField(adminClient, fieldName('unfillable', suffix), {
                options: ['Value A'],
                displayName: `Unfillable ${suffix}`,
                permissionValues: 'sysadmin',
            });

            try {
                // Every channel has a value, so the missing-values gate doesn't stop the click.
                await backfillChannelAttribute(
                    adminClient,
                    pair.channelField,
                    templateOptionId(pair.templateField, 'Value A'),
                );

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page, globalAttributes} = systemConsolePage;
                const {attributeAppliesToChannels} = globalAttributes;

                await page.goto(`${ATTRIBUTE_DETAILS_PATH}/${pair.templateField.id}`);
                await expect(globalAttributes.displayNameInput).toBeVisible();
                await attributeAppliesToChannels.expand();
                await expect(attributeAppliesToChannels.missingValuesBanner).toBeHidden();

                // # Turn Required on and save
                await attributeAppliesToChannels.setRequired(true);
                await globalAttributes.saveButton.click();

                // * The refusal shows inline and the toggle goes back off
                const saveError = globalAttributes.saveError;
                await expect(saveError).toBeVisible();
                await expect(saveError).toContainText(UNFILLABLE_MESSAGE);
                await expect(attributeAppliesToChannels.requiredToggle).not.toBeChecked();

                // * Nothing was saved: after a reload Required is still off
                await page.reload();
                await expect(globalAttributes.displayNameInput).toBeVisible();
                await attributeAppliesToChannels.expand();
                await expect(attributeAppliesToChannels.requiredToggle).not.toBeChecked();

                const reloaded = await getChannelPropertyField(adminClient, pair.channelField.id);
                expect(reloaded.attrs?.required).not.toBe(true);
            } finally {
                await deleteChannelAttributeField(adminClient, pair);
            }
        });
    },
);
