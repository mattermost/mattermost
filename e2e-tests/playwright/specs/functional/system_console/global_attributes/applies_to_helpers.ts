// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import {Api, expect, settle, type App} from '@mattermost/playwright-lib';

import {backfillAndRequireChannelAttribute} from '../../channels/channel_attributes/helpers';

import {addChannelResource, attributesPath, ignoreNotFound, openNewAttribute} from './global_attributes_helpers';

const PROPERTY_GROUP = 'access_control';
type ChannelSettings = App['admin']['attribute']['appliesTo']['channel']['settings'];
type DisplayLocation = Parameters<ChannelSettings['location']>[0];
type ChangePolicy = Parameters<ChannelSettings['changePolicyMenu']['policy']>[0];

export type ChannelAttributeConfig = {
    displayName: string;

    // The type menu's option ids
    type?: 'select' | 'multiselect' | 'text';
    options?: string[];
    required?: boolean;

    // Left alone the row keeps its default, 'any' (can be changed at any time).
    changePolicy?: ChangePolicy;
    displayLocations?: DisplayLocation[];
};

/**
 * Mirrors slugifyForCEL in webapp utils/properties.ts, which is what the console
 * derives the unique name from as the display name is typed.
 */
export function derivedAttributeName(displayName: string): string {
    let slug = displayName
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_');
    if (/^[0-9]/.test(slug)) {
        slug = '_' + slug;
    }
    return slug.replace(/_+/g, '_').replace(/_+$/, '') || '_copy';
}

/**
 * Creates an attribute and its Channels resource entirely through the System
 * Console UI, and returns the name the console derived for it.
 */
export async function configureChannelAttribute(
    app: App,
    {displayName, type, options = [], required = false, changePolicy, displayLocations = []}: ChannelAttributeConfig,
    adminClient?: Client4,
): Promise<string> {
    const form = await openNewAttribute(app);
    await form.displayName.container.fill(displayName);
    await expect(form.displayName.container).toHaveValue(displayName);
    if (type && type !== 'text') {
        await form.type.container.click();
        await expect(form.type.option(type)).toBeVisible();
        await form.type.option(type).click();
        await expect(form.type.option(type)).not.toBeVisible();
    }
    for (const option of options) {
        const count = (await form.values.optionList.keys()).length;
        await form.values.addTextbox.fill(option);
        await form.values.addTextbox.press('Enter');
        await expect(form.values.optionList).toHaveKeyCount(count + 1);
        await expect(form.values.optionList.locator).toContainText([option]);
    }

    const settings = await addChannelResource(form);
    if (!required) {
        await settings.requiredSwitch.set(false);
        await expect(settings.requiredSwitch).not.toBeOn();
    }
    if (changePolicy) {
        await settings.changePolicyButton.click();
        await expect(settings.changePolicyMenu.policy(changePolicy)).toBeVisible();
        await settings.changePolicyMenu.policy(changePolicy).click();
        await expect(settings.changePolicyMenu.policy(changePolicy)).not.toBeVisible();
    }
    for (const location of displayLocations) {
        await settings.location(location).check();
        await expect(settings.location(location)).toBeChecked();
    }

    // Saving a new attribute returns to the list
    await settle(app.admin.saveButton, {
        wait: Api.CreatePropertyField,
        params: {group_name: PROPERTY_GROUP, object_type: 'channel'},
    }).click();
    await expect(app.page).toHavePath(attributesPath(app));

    const name = derivedAttributeName(displayName);
    if (required) {
        if (!adminClient) {
            throw new Error('adminClient is required to backfill a required channel attribute');
        }
        const field = await findChannelField(adminClient, name);
        if (!field) {
            throw new Error(`channel property field ${name} not found`);
        }
        const fieldOptions = (field.attrs?.options ?? []) as Array<{id: string}>;
        let backfillValue: unknown = 'e2e backfill';
        if (field.type === 'select') {
            backfillValue = fieldOptions[0].id;
        } else if (field.type === 'multiselect') {
            backfillValue = [fieldOptions[0].id];
        }
        await backfillAndRequireChannelAttribute(adminClient, field, backfillValue);
    }

    return name;
}

export async function findChannelField(adminClient: Client4, name: string): Promise<PropertyField | undefined> {
    const fields = await adminClient.getPropertyFields(PROPERTY_GROUP, 'channel', {targetType: 'system', perPage: 200});
    return fields.find((field) => field.name === name && field.delete_at === 0);
}

/** The channel field a console-configured attribute created (its id keys the attribute's testids). */
export async function channelFieldNamed(adminClient: Client4, name: string): Promise<PropertyField> {
    const field = await findChannelField(adminClient, name);
    if (!field) {
        throw new Error(`No channel field named "${name}"`);
    }
    return field;
}

export async function deleteChannelFieldIfExists(adminClient: Client4, name: string) {
    const field = await findChannelField(adminClient, name);
    if (field) {
        await ignoreNotFound(() => adminClient.deletePropertyField(PROPERTY_GROUP, 'channel', field.id));
    }
}
