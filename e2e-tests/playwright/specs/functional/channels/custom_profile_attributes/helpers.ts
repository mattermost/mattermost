// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {FieldType} from '@mattermost/types/properties';
import type {UserPropertyField, UserPropertyFieldPatch} from '@mattermost/types/properties_user';

import {expect, ignoreMissing, type App, duration, Api, settle} from '@mattermost/playwright-lib';

// Common test data constants
export const TEST_PHONE = '555-123-4567';
export const TEST_UPDATED_PHONE = '555-987-6543';
export const TEST_URL = 'https://example.com';
export const TEST_UPDATED_URL = 'https://mattermost.com';
export const TEST_INVALID_URL = 'ftp://invalid-url';
export const TEST_VALID_URL = 'https://example2.com';
export const TEST_DEPARTMENT = 'Engineering';
export const TEST_UPDATED_DEPARTMENT = 'Product';
export const TEST_LOCATION = 'Remote';
export const TEST_UPDATED_LOCATION = 'Office';
export const TEST_TITLE = 'Software Engineer';
export const TEST_CHANGED_VALUE = 'Changed Value';
export const TEST_MESSAGE = 'Hello from the test user';
export const TEST_MESSAGE_OTHER = 'Hello from the other user';

export const TEST_LOCATION_OPTIONS = [
    {name: 'Remote', color: '#00FFFF'},
    {name: 'Office', color: '#FF00FF'},
    {name: 'Hybrid', color: '#FFFF00'},
];

export const TEST_SKILLS_OPTIONS = [
    {name: 'JavaScript', color: '#F0DB4F'},
    {name: 'React', color: '#61DAFB'},
    {name: 'Node.js', color: '#68A063'},
    {name: 'Python', color: '#3776AB'},
];

/**
 * Represents a custom profile attribute definition
 */
export type CustomProfileAttribute = {
    name: string;
    value?: string;
    type: string;
    options?: Array<{name: string; color: string; sort_order?: number}>;
    attrs?: {
        value_type?: string;
        visibility?: string;
        managed?: string;
        options?: Array<{name: string; color: string}>;
        display_name?: string;
    };
};

/** Like Record<string, UserPropertyField> but tracks which field IDs this call created (vs reused). */
export type CpaFieldsMap = Record<string, UserPropertyField> & {
    ownedIds: Set<string>;
};

// Custom attribute definitions for user settings tests (with select/multiselect attributes)
export const userSettingsAttributes: CustomProfileAttribute[] = [
    {
        name: 'Department',
        value: TEST_DEPARTMENT,
        type: 'text',
    },
    {
        name: 'Location',
        type: 'select',
        options: TEST_LOCATION_OPTIONS,
    },
    {
        name: 'Skills',
        type: 'multiselect',
        options: TEST_SKILLS_OPTIONS,
    },
    {
        name: 'Phone',
        value: TEST_PHONE,
        type: 'text',
        attrs: {
            value_type: 'phone',
        },
    },
    {
        name: 'Website',
        value: TEST_URL,
        type: 'text',
        attrs: {
            value_type: 'url',
        },
    },
];

// Custom attribute definitions for custom attributes tests (with text attributes and Title)
export const customAttributesTestData: CustomProfileAttribute[] = [
    {
        name: 'Department',
        value: TEST_DEPARTMENT,
        type: 'text',
    },
    {
        name: 'Location',
        value: TEST_LOCATION,
        type: 'text',
    },
    {
        name: 'Title',
        value: TEST_TITLE,
        type: 'text',
    },
    {
        name: 'Phone',
        value: TEST_PHONE,
        type: 'text',
        attrs: {
            value_type: 'phone',
        },
    },
    {
        name: 'Website',
        value: TEST_URL,
        type: 'text',
        attrs: {
            value_type: 'url',
        },
    },
];

/**
 * Helper function to get field ID by name
 * @param {Object} fieldsMap - Map of field IDs to field objects
 * @param {string} name - The name of the field to find
 * @returns {string} - The field ID
 */
export function getFieldIdByName(fieldsMap: Record<string, UserPropertyField>, name: string): string {
    for (const [id, field] of Object.entries(fieldsMap)) {
        if (field.name === name) {
            return id;
        }
    }
    throw new Error(`Could not find field ID for attribute: ${name}`);
}

/** The Profile settings section keyed by the custom attribute's id. */
export function attributeSection(
    app: App,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
): ReturnType<App['settings']['customAttribute']> {
    return app.settings.customAttribute(getFieldIdByName(fieldsMap, attributeName));
}

/** Saves an open attribute section and waits for it to collapse (the Edit button returns only once the save is done). */
async function saveSection(section: ReturnType<typeof attributeSection>) {
    await settle(section.saveButton, {wait: Api.PatchCPAValuesForUser}).click();
    await expect(section.editButton).toBeVisible();
}

/** Picks options of a select attribute by index, in Profile settings. */
async function pickOptions(
    section: ReturnType<typeof attributeSection>,
    field: UserPropertyField,
    optionIndices: number[],
) {
    const options = (field.attrs?.options ?? []) as Array<{id: string}>;
    const keepsMenuOpen = field.type === 'multiselect';
    for (const index of optionIndices) {
        // ArrowDown opens a closed menu and only moves the highlight in an open one, so each pick starts the same way
        // whether the menu closed after the last pick or not.
        await section.valueChoiceCombobox.press('ArrowDown');
        await expect(section.valueChoiceCombobox).toHaveAttribute('aria-expanded', 'true');
        await section.choice({id: options[index].id}).container.select();
        if (keepsMenuOpen) {
            // Compass renders selected labels as chips inside the generated attribute section; a chip is built by
            // the Compass combobox and takes no test id.
            const chips = section.container.locator
                // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the chip is rendered by the Compass combobox and cannot take a test id
                .locator('[data-chip]')
                .filter({hasText: (field.attrs?.options ?? [])[index].name});
            await expect(chips).toBeVisible();
        } else {
            await expect(section.valueChoiceCombobox).toHaveValue((field.attrs?.options ?? [])[index].name);
        }
    }
}

/**
 * Edits a text attribute in Profile settings: Edit, replace the value, Save.
 * @param newValue - The new value to set (empty clears it)
 */
export async function editTextAttribute(
    app: App,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    newValue: string,
): Promise<void> {
    const section = attributeSection(app, fieldsMap, attributeName);
    await section.editButton.click();
    await expect(section.value.container).toBeVisible();
    await section.value.container.clear();
    if (newValue) {
        await section.value.container.fill(newValue);
    }
    await expect(section.value.container).toHaveValue(newValue);
    await saveSection(section);
}

/**
 * Edits a select attribute in Profile settings, picking the option at `optionIndex`, counted over all
 * options in definition order (the Combobox keeps the selected row in the list).
 */
export async function editSelectAttribute(
    app: App,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    optionIndex: number,
): Promise<void> {
    const section = attributeSection(app, fieldsMap, attributeName);
    await section.editButton.click();
    await expect(section.valueChoiceCombobox).toBeVisible();
    await pickOptions(section, fieldsMap[getFieldIdByName(fieldsMap, attributeName)], [optionIndex]);
    await saveSection(section);
}

/**
 * Edits a multiselect attribute in Profile settings, adding the options at `optionIndices`, counted over all
 * options in definition order. Selected rows stay in the list and clicking one deselects it, so each index
 * must point at a row that isn't already selected.
 */
export async function editMultiselectAttribute(
    app: App,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    optionIndices: number[],
): Promise<void> {
    const section = attributeSection(app, fieldsMap, attributeName);
    await section.editButton.click();
    await expect(section.valueChoiceCombobox).toBeVisible();
    await pickOptions(section, fieldsMap[getFieldIdByName(fieldsMap, attributeName)], optionIndices);
    await saveSection(section);
}

/** Verifies each attribute has its section in Profile settings, labelled with its name. */
export async function verifyAttributesExistInSettings(
    app: App,
    fieldsMap: Record<string, UserPropertyField>,
    attributes: CustomProfileAttribute[],
): Promise<void> {
    for (const attribute of attributes) {
        // fields are fetched after the settings open, hence the longer wait
        await expect(attributeSection(app, fieldsMap, attribute.name).titleText).toContainText(attribute.name, {
            timeout: duration.half_min,
        });
    }
}

/** Verifies an attribute shows in the open profile popover with its name and value. */
export async function verifyAttributeInPopover(
    app: App,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    attributeValue: string,
): Promise<void> {
    const field = fieldsMap[getFieldIdByName(fieldsMap, attributeName)];
    const shown = app.profilePopover.attribute(field).locator;

    // the popover labels a field with its display name when it has one
    await expect(shown).toContainText((field.attrs?.display_name as string | undefined) || attributeName);
    await expect(shown).toContainText(attributeValue);
}

/** Verifies an attribute isn't in the open profile popover (the popover itself has loaded: its username shows). */
export async function verifyAttributeNotInPopover(
    app: App,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
): Promise<void> {
    await expect(app.profilePopover.usernameText).toBeVisible();
    await expect(app.profilePopover.attribute({id: getFieldIdByName(fieldsMap, attributeName)})).toHaveCount(0);
}

/** Posts a message from the composer, opens the author's profile popover from it, and returns the post id. */
export async function openOwnPopover(app: App, message: string) {
    await app.center.postCreate.message.container.fill(message);
    await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    let id = '';
    await expect
        .poll(async () => {
            id = (await app.center.postList.postList.keys()).at(-1) ?? '';
            return id ? app.center.postList.post({id}).message.container.text() : '';
        })
        .toBe(message);
    // ProfilePicture exposes a role-free container, so the popover trigger has no click driver.
    await app.center.postList.post({id}).avatar.container.click();
    await expect(app.profilePopover).toBeVisible();
    return id;
}

/**
 * Updates the visibility property of a custom profile attribute field
 * @param {Client4} adminClient - Admin API client
 * @param {Object} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to update
 * @param {string} visibility - The visibility value to set ('when_set', 'hidden', or 'always')
 */
export async function updateCustomProfileAttributeVisibility(
    adminClient: Client4,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    visibility: 'when_set' | 'hidden' | 'always',
): Promise<void> {
    const fieldID = getFieldIdByName(fieldsMap, attributeName);

    try {
        // Update the visibility property
        const updatedField = await adminClient.patchCustomProfileAttributeField(fieldID, {
            // @ts-expect-error The type definition requires more properties than we need to set
            attrs: {
                visibility,
            },
        });

        // Update the fieldsMap with the updated field
        fieldsMap[updatedField.id] = updatedField;
    } catch (error) {
        // eslint-disable-next-line no-console
        console.log(`Failed to update visibility for attribute ${attributeName}:`, error);
    }
}

/**
 * Sets up custom profile attributes fields
 * @param {Client4} adminClient - Admin API client
 * @param {Array} attributes - Array of attribute objects with name and value
 * @returns {Promise<Object>} - A promise that resolves to a map of field IDs to field objects
 */
export async function setupCustomProfileAttributeFields(
    adminClient: Client4,
    attributes: CustomProfileAttribute[],
): Promise<CpaFieldsMap> {
    const fieldsMap: Record<string, UserPropertyField> = {};
    const ownedIds = new Set<string>();

    // Create the attribute fields array
    const attributeFields: UserPropertyFieldPatch[] = attributes.map((attr, index) => {
        // Start with basic field properties
        const field: UserPropertyFieldPatch = {
            name: attr.name,
            type: (attr.type as FieldType) || 'text',
            // @ts-expect-error @mattermost/types needs to be updated
            attrs: {
                sort_order: index,
            },
        };

        // Add options for select and multiselect fields
        if ((attr.type === 'select' || attr.type === 'multiselect') && attr.options) {
            // @ts-expect-error @mattermost/types needs to be updated
            field.attrs.options = attr.options;
        }

        // Add any additional attributes if provided
        if (attr.attrs) {
            // @ts-expect-error @mattermost/types needs to be updated
            field.attrs = {
                ...field.attrs,
                ...attr.attrs,
            };
        }

        return field;
    });

    // Build a name -> existing field map so we can reuse fields that already
    // exist (e.g. a 'Department' field created by global test setup) and only
    // create the ones that are genuinely missing.
    const existingByName: Record<string, UserPropertyField> = {};
    const existingFields = await adminClient.getCustomProfileAttributeFields();
    for (const field of existingFields) {
        existingByName[field.name] = field;
    }

    // Create fields sequentially, reusing any that already exist by name AND type.
    // If a same-name field exists with a different type, delete it first then recreate.
    for (const field of attributeFields) {
        const existing = field.name ? existingByName[field.name] : undefined;

        if (existing && existing.type === field.type) {
            // Name and type both match — safe to reuse without touching ownedIds.
            fieldsMap[existing.id] = existing;
            continue;
        }

        if (existing) {
            // Same name but wrong type (e.g. a previous spec created 'Location' as 'text'
            // while this spec needs it as 'select'). Delete the stale field and recreate.
            await ignoreMissing(() => adminClient.deleteCustomProfileAttributeField(existing.id));
        }

        const createdField = await adminClient.createCustomProfileAttributeField(field);
        fieldsMap[createdField.id] = createdField;
        ownedIds.add(createdField.id);
    }

    // Non-enumerable so Object.keys/values/entries/JSON.stringify skip it.
    Object.defineProperty(fieldsMap, 'ownedIds', {
        value: ownedIds,
        enumerable: false,
        configurable: true,
        writable: true,
    });
    return fieldsMap as CpaFieldsMap;
}

/**
 * Sets up custom profile attribute values for the current user
 * @param {Client4} userClient - User client object
 * @param {Array} attributes - Array of attribute objects with name and value
 * @param {Object} fields - Map of field IDs to field objects
 */
export async function setupCustomProfileAttributeValues(
    userClient: Client4,
    attributes: CustomProfileAttribute[],
    fields: Record<string, UserPropertyField>,
): Promise<void> {
    // Create a map of attribute values by field ID
    const valuesByFieldId: Record<string, string | string[]> = {};

    for (const attr of attributes) {
        let fieldID = '';

        // Find the field ID for this attribute name
        for (const [id, field] of Object.entries(fields)) {
            if (field.name === attr.name) {
                fieldID = id;
                break;
            }
        }

        // If we found a matching field, add it to our values object
        if (fieldID && attr.value) {
            valuesByFieldId[fieldID] = attr.value;
        }
    }

    // Only make the API call if we have values to set
    if (Object.keys(valuesByFieldId).length > 0) {
        try {
            await userClient.updateCustomProfileAttributeValues(valuesByFieldId);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log('Failed to set attribute values:', error);
        }
    }
}

/**
 * Sets up custom profile attribute values for a specific user (admin function)
 * @param {Client4} adminClient - Admin client object
 * @param {Array} attributes - Array of attribute objects with name and value
 * @param {Object} fields - Map of field IDs to field objects
 * @param {string} targetUserId - ID of the user to set values for
 */
export async function setupCustomProfileAttributeValuesForUser(
    adminClient: Client4,
    attributes: CustomProfileAttribute[],
    fields: Record<string, UserPropertyField>,
    targetUserId: string,
): Promise<void> {
    // Create a map of attribute values by field ID
    const valuesByFieldId: Record<string, string | string[]> = {};

    for (const attr of attributes) {
        let fieldID = '';

        // Find the field ID for this attribute name
        for (const [id, field] of Object.entries(fields)) {
            if (field.name === attr.name) {
                fieldID = id;
                break;
            }
        }

        // If we found a matching field, add it to our values object
        if (fieldID && attr.value) {
            valuesByFieldId[fieldID] = attr.value;
        }
    }

    // Only make the API call if we have values to set
    if (Object.keys(valuesByFieldId).length > 0) {
        try {
            // Use the admin client method for updating other user's values
            await adminClient.updateUserCustomProfileAttributesValues(targetUserId, valuesByFieldId);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log('Failed to set attribute values for user:', error);
        }
    }
}

/**
 * Deletes all custom profile attributes
 * @param {Client4} adminClient - Admin API client
 * @param {Object} attributes - Map of field IDs to field objects
 */
export async function deleteCustomProfileAttributes(
    adminClient: Client4,
    attributes: Record<string, UserPropertyField>,
): Promise<void> {
    // Only delete owned fields when ownedIds is supplied; otherwise delete every returned key.
    const ownedIds: Set<string> =
        'ownedIds' in attributes ? (attributes as CpaFieldsMap).ownedIds : new Set(Object.keys(attributes));

    for (const id of ownedIds) {
        try {
            await adminClient.deleteCustomProfileAttributeField(id);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(`Failed to delete field ${id}:`, error);
        }
    }

    // Verify only owned fields were deleted (concurrent tests may still have their own fields).
    if (ownedIds.size === 0) {
        return;
    }
    try {
        const remaining = await adminClient.getCustomProfileAttributeFields();
        const leakedFields = remaining.filter((f: {id: string}) => ownedIds.has(f.id));
        if (leakedFields.length > 0) {
            // eslint-disable-next-line no-console
            console.log(
                `Warning: ${leakedFields.length} field(s) were not deleted:`,
                leakedFields.map((f: {id: string; name: string}) => f.name).join(', '),
            );
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.log('Error verifying field deletion:', error);
    }
}
