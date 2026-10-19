// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {FieldType} from '@mattermost/types/properties';
import type {UserPropertyField, UserPropertyFieldPatch} from '@mattermost/types/properties_user';

import type {ChannelsPage} from '@mattermost/playwright-lib';
import {expect} from '@mattermost/playwright-lib';

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

/**
 * Helper function to edit a text attribute
 * @param {Page} page - The Playwright page object
 * @param {Object} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to edit
 * @param {string} newValue - The new value to set
 */
export async function editTextAttribute(
    page: Page,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    newValue: string,
): Promise<void> {
    const fieldId = getFieldIdByName(fieldsMap, attributeName);
    await page.locator(`text=${attributeName}`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).click();
    await page.locator(`#customAttribute_${fieldId}`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}`).clear();
    if (newValue) {
        await page.locator(`#customAttribute_${fieldId}`).fill(newValue);
    }
    await page.locator('button:has-text("Save")').click();
    // Wait for the Edit button to reappear — it is only visible when the section is in
    // display mode (not editing). It returns to display mode only after the save API call
    // resolves and the component calls updateSection(''). Without this wait, the next
    // Edit click fires updateSection() while the save is still in-flight, which closes
    // the active section and disrupts subsequent saves.
    await page.locator(`#customAttribute_${fieldId}Edit`).waitFor({state: 'visible'});
}

/**
 * Helper function to edit a select attribute
 * @param {Page} page - The Playwright page object
 * @param {Object} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to edit
 * @param {number} optionIndex - The index of the option to select
 */
export async function editSelectAttribute(
    page: Page,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    optionIndex: number,
): Promise<void> {
    const fieldId = getFieldIdByName(fieldsMap, attributeName);
    await page.locator(`text=${attributeName}`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).click();

    // Open the dropdown — the control div carries the field-scoped id
    const selectControl = page.locator(`#customProfileAttribute_${fieldId}`);
    await selectControl.scrollIntoViewIfNeeded();
    await selectControl.click();

    // Pick the option by index inside this specific dropdown's open menu.
    // Scoping to the react-select container avoids fragile global react-select-N-option-M IDs.
    const selectContainer = page.locator(`#customProfileAttribute_${fieldId}`).locator('..');
    const option = selectContainer.locator('.react-select__option').nth(optionIndex);
    await option.waitFor({state: 'visible'});
    await option.click();

    await page.locator('button:has-text("Save")').click();
    // Wait for the Edit button to reappear — same reasoning as editTextAttribute.
    await page.locator(`#customAttribute_${fieldId}Edit`).waitFor({state: 'visible'});
}

/**
 * Helper function to edit a multiselect attribute
 * @param {Page} page - The Playwright page object
 * @param {Object} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to edit
 * @param {Array<number>} optionIndices - The indices of the options to select
 */
export async function editMultiselectAttribute(
    page: Page,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    optionIndices: number[],
): Promise<void> {
    const fieldId = getFieldIdByName(fieldsMap, attributeName);
    await page.locator(`text=${attributeName}`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).click();

    // The react-select container wraps the control; scope option lookups to it
    // to avoid relying on fragile global react-select-N-option-M IDs.
    const selectContainer = page.locator(`#customProfileAttribute_${fieldId}`).locator('..');

    for (const index of optionIndices) {
        // Open the dropdown for each selection (it closes after each pick)
        const selectControl = page.locator(`#customProfileAttribute_${fieldId}`);
        await selectControl.scrollIntoViewIfNeeded();
        await selectControl.click();

        // Wait for menu to appear and click the nth option
        const option = selectContainer.locator('.react-select__option').nth(index);
        await option.waitFor({state: 'visible'});
        await option.click();
    }

    await page.locator('button:has-text("Save")').click();
    // Wait for the Edit button to reappear — same reasoning as editTextAttribute.
    await page.locator(`#customAttribute_${fieldId}Edit`).waitFor({state: 'visible'});
}

/**
 * Helper function to verify an attribute exists in the profile settings
 * @param {Page} page - The Playwright page object
 * @param {Array} attributes - Array of attribute objects with name
 */
export async function verifyAttributesExistInSettings(page: Page, attributes: CustomProfileAttribute[]): Promise<void> {
    for (const attribute of attributes) {
        // Wait for the attribute label to appear — custom profile attribute fields are
        // fetched asynchronously after the settings modal opens, so we need an explicit
        // wait before asserting visibility.
        const label = page.locator('.user-settings').getByText(attribute.name, {exact: false});
        await label.waitFor({state: 'visible', timeout: 15000});
        await label.scrollIntoViewIfNeeded();
    }
}

/**
 * Helper function to verify an attribute is displayed in the profile popover
 * @param {ChannelsPage} channelsPage - The Playwright channels page object
 * @param {string} attributeName - The name of the attribute to verify
 * @param {string} attributeValue - The value of the attribute to verify
 */
export async function verifyAttributeInPopover(
    channelsPage: ChannelsPage,
    attributeName: string,
    attributeValue: string,
): Promise<void> {
    const popover = channelsPage.userProfilePopover.container;

    // Check for the attribute name
    const nameElement = popover.getByText(attributeName, {exact: false});
    await expect(nameElement).toBeVisible();

    // Check for the attribute value
    const valueElement = popover.getByText(attributeValue, {exact: false});
    await expect(valueElement).toBeVisible();
}

/**
 * Helper function to verify an attribute is not displayed in the profile popover
 * @param {ChannelsPage} channelsPage - The Playwright channels page object
 * @param {string} attributeName - The name of the attribute to verify
 */
export async function verifyAttributeNotInPopover(channelsPage: ChannelsPage, attributeName: string): Promise<void> {
    const popover = channelsPage.userProfilePopover.container;

    // Check that the attribute name is not present
    const nameElement = popover.getByText(attributeName, {exact: false});
    await expect(nameElement).not.toBeVisible();
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
    try {
        const existingFields = await adminClient.getCustomProfileAttributeFields();
        for (const field of existingFields) {
            existingByName[field.name] = field;
        }
    } catch (error) {
        // If request fails, continue to create new fields
        // eslint-disable-next-line no-console
        console.log('Error getting existing custom profile fields, will create new ones', error);
    }

    // Create fields sequentially, reusing any that already exist by name AND type.
    // If a same-name field exists with a different type, delete it first then recreate.
    for (const field of attributeFields) {
        const existing = field.name ? existingByName[field.name] : undefined;

        if (existing && existing.type === field.type) {
            // Name and type both match — safe to reuse without touching ownedIds.
            fieldsMap[existing.id] = existing;
        } else if (existing && existing.type !== field.type) {
            // Same name but wrong type (e.g. a previous spec created 'Location' as 'text'
            // while this spec needs it as 'select'). Delete the stale field and recreate.
            try {
                await adminClient.deleteCustomProfileAttributeField(existing.id);
            } catch {
                // Ignore delete errors — the field may already be gone.
            }
            try {
                const createdField = await adminClient.createCustomProfileAttributeField(field);
                fieldsMap[createdField.id] = createdField;
                ownedIds.add(createdField.id);
            } catch {
                // Race: another worker recreated it first — borrow it (not owned).
                try {
                    const currentFields = await adminClient.getCustomProfileAttributeFields();
                    const raceCreated = currentFields.find((f) => f.name === field.name);
                    if (raceCreated) {
                        fieldsMap[raceCreated.id] = raceCreated;
                    }
                } catch {
                    // ignore — missing field surfaces via getFieldIdByName()
                }
            }
        } else {
            // Field does not exist at all — create it.
            try {
                const createdField = await adminClient.createCustomProfileAttributeField(field);
                fieldsMap[createdField.id] = createdField;
                ownedIds.add(createdField.id);
            } catch {
                // Race: another shard created the field first — re-fetch and borrow it (not owned).
                try {
                    const currentFields = await adminClient.getCustomProfileAttributeFields();
                    const raceCreated = currentFields.find((f) => f.name === field.name);
                    if (raceCreated) {
                        fieldsMap[raceCreated.id] = raceCreated;
                    }
                } catch {
                    // ignore — missing field surfaces via getFieldIdByName()
                }
            }
        }
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
    // Only delete owned fields; fall back to all keys for legacy callers without ownedIds.
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
