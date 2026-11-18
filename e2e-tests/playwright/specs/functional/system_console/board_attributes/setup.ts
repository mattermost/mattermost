// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import {
    Api,
    App,
    expect,
    Msg,
    type PlaywrightExtended,
    duration,
    settle,
    systemConsolePath,
} from '@mattermost/playwright-lib';

/**
 * System Console > Board Attributes on the generated page objects: the table's rows keyed by field id (name, type
 * button and menu, option chips and their menu keyed by option id, the actions menu and its delete dialog), the Add
 * attribute button and the save panel. Saved rows and options are found by their server ids.
 */

export const BOARDS_GROUP = 'boards';
export const OBJECT_TYPE_POST = 'post';
export const SYSTEM_TARGET_TYPE = 'system';

/** The label each type shows on its row's type button. */
export const TYPE_LABEL = {
    text: 'Text',
    select: 'Select',
    multiselect: 'Multi-select',
    date: 'Date',
    user: 'User',
} as const;

type BoardOption = {id: string; name: string; color?: string};

export type BoardAttributes = App['admin']['boardAttributes'];
export type BoardRow = ReturnType<App['admin']['boardAttributes']['row']>;

export type BoardAttributesTestContext = {
    adminClient: Client4;
    app: App;
};

let cachedAdminClient: Client4 | null = null;

/** Logs an admin in, with the integrated boards flag on and no custom fields left. */
export async function setupBoardAttributesTest(pw: PlaywrightExtended): Promise<BoardAttributesTestContext> {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    // Feature flags are read at server start from MM_FEATUREFLAGS_* env,
    // not from runtime config patches — CI sets it in server.generate.sh;
    // locally, export it before running the server.
    await pw.ensureFeatureFlag('IntegratedBoards', true);

    const {adminUser, adminClient} = await pw.initSetup();
    cachedAdminClient = adminClient;

    await deleteNonProtectedFields(adminClient);

    const {app} = await pw.testBrowser.login(adminUser);
    return {adminClient, app};
}

/** Opens (or reloads) System Console > Board Attributes, waiting for its rows. */
export async function openBoardAttributes(app: App): Promise<BoardAttributes> {
    await app.page.goto(systemConsolePath('system_attributes/board_attributes'));
    const ba = app.admin.boardAttributes;

    // the protected, seeded fields are always there
    await expect.poll(async () => (await ba.rowList.keys()).length).toBeGreaterThan(0);
    return ba;
}

/** The saved board field named `name`. */
export async function fieldByName(adminClient: Client4, name: string): Promise<PropertyField> {
    const fields = await adminClient.getPropertyFields(BOARDS_GROUP, OBJECT_TYPE_POST, {
        targetType: SYSTEM_TARGET_TYPE,
    });
    const field = (fields ?? []).find((f) => f.name === name);
    if (!field) {
        throw new Error(`board field ${name} not found`);
    }
    return field;
}

/** The options of a saved select field. */
export function optionsOf(field: PropertyField): BoardOption[] {
    return (field.attrs as {options?: BoardOption[]} | undefined)?.options ?? [];
}

/** The option of a saved select field named `name`. */
export function optionByName(field: PropertyField, name: string): BoardOption {
    const option = optionsOf(field).find((o) => o.name === name);
    if (!option) {
        throw new Error(`option ${name} of ${field.name} not found`);
    }
    return option;
}

/** The row of the saved field named `name`. */
export async function rowByName(ba: BoardAttributes, adminClient: Client4, name: string): Promise<BoardRow> {
    return ba.row((await fieldByName(adminClient, name)).id);
}

/** The key that `after` has and `before` did not: the row or option a click just added. */
export function addedKey(before: string[], after: string[]): string {
    const key = after.find((candidate) => !before.includes(candidate));
    if (key === undefined) {
        throw new Error('No row or option was added');
    }
    return key;
}

/** Clicks Add attribute and names the row it adds (an empty name still blurs, which is what validates it). */
export async function addAttribute(ba: BoardAttributes, name: string): Promise<BoardRow> {
    const before = await ba.rowList.keys();
    await ba.addAttributeButton.click();
    await expect(ba.rowList).toHaveKeyCount(before.length + 1);
    const row = ba.row(addedKey(before, await ba.rowList.keys()));
    await row.nameTextbox.fill(name);
    await row.nameTextbox.blur();
    await expect(row.nameTextbox).toHaveValue(name.trim());
    if (!name.trim()) {
        await expect(row.nameErrorText).toHaveMessage(Msg.admin.board_attributes.table.validation.name_required);
    }
    return row;
}

/** Picks a row's type from its type menu, waiting for the type button to show it. */
export async function changeType(row: BoardRow, type: keyof typeof TYPE_LABEL) {
    // The menu opens outside its row, so it is found from the page rather than from the row.
    const typeMenu = new App(row.page).boardAttributeTypeMenu;
    await row.typeButton.click();
    await expect(typeMenu.type(type)).toBeVisible();
    await typeMenu.type(type).click();
    await expect(row.typeButton).toContainText(TYPE_LABEL[type]);
}

/** Closes the open option menu with Escape from one of its items (the name box handles Escape itself, reverting). */
export async function closeOptionMenu(row: BoardRow) {
    // The menu opens outside its row, so it is found from the page rather than from the row.
    const optionMenu = new App(row.page).boardAttributeOptionMenu;
    await optionMenu.color('default').press('Escape');
    await expect(optionMenu.nameTextbox).toBeHidden();
}

/** Adds a value to a select row and names it from its menu; returns the new option's id. */
export async function addOption(row: BoardRow, name: string, opts: {duplicate?: boolean} = {}) {
    const before = await row.optionList.keys();
    await row.addValueButton.click();
    await expect(row.optionList).toHaveKeyCount(before.length + 1);
    const id = addedKey(before, await row.optionList.keys());
    await renameOption(row, id, name, opts);
    return id;
}

/**
 * Renames an option from its menu (Enter commits the name; Escape in the box would revert it). Committing a name the
 * select already has (`duplicate`) re-renders the chips, which closes the menu on its own.
 */
export async function renameOption(row: BoardRow, id: string, name: string, {duplicate = false} = {}) {
    const optionMenu = new App(row.page).boardAttributeOptionMenu;
    await row.option({id}).editButton.click();
    await expect(optionMenu.nameTextbox).toBeVisible();
    await optionMenu.nameTextbox.fill(name);
    await optionMenu.nameTextbox.press('Enter');
    await expect(row.option({id})).toHaveText(name);
    if (duplicate) {
        await expect(optionMenu.nameTextbox).toBeHidden();
    } else {
        await closeOptionMenu(row);
    }
    await expect(row.option({id})).toHaveText(name);
}

/** Saves the pending changes, waiting for the server write and for the save button to settle. */
export async function save(
    ba: BoardAttributes,
    wait:
        | typeof Api.CreatePropertyField
        | typeof Api.UpdatePropertyField
        | typeof Api.DeletePropertyField = Api.UpdatePropertyField,
) {
    const {saveButton} = ba.savePanel;
    await expect(saveButton).toBeEnabled();

    await settle(saveButton, {wait, params: {group_name: BOARDS_GROUP}}).click();
    await expect(saveButton).toBeSaved({timeout: duration.half_min});
}

/** Creates a text field through the API. */
export async function createTextField(adminClient: Client4, name: string, sortOrder: number) {
    return adminClient.createPropertyField(BOARDS_GROUP, OBJECT_TYPE_POST, {
        name,
        type: 'text',
        attrs: {sort_order: sortOrder},
        target_type: SYSTEM_TARGET_TYPE,
        target_id: '',
    } as Parameters<typeof adminClient.createPropertyField>[2]);
}

/**
 * Teardown for custom (non-protected) board fields.
 *
 * Pass `nameFilter` (recommended) to scope cleanup to fields this spec
 * created — important when multiple board_attributes specs share the same
 * server. Without a filter, all non-protected fields in the system group
 * are removed.
 */
export async function cleanupCustomBoardFields(nameFilter?: (name: string) => boolean): Promise<void> {
    if (!cachedAdminClient) {
        return;
    }
    await deleteNonProtectedFields(cachedAdminClient, nameFilter);
}

async function deleteNonProtectedFields(adminClient: Client4, nameFilter?: (name: string) => boolean): Promise<void> {
    try {
        const fields = await adminClient.getPropertyFields(BOARDS_GROUP, OBJECT_TYPE_POST, {
            targetType: SYSTEM_TARGET_TYPE,
        });
        for (const field of fields ?? []) {
            if (field.protected) {
                continue;
            }
            if (nameFilter && !nameFilter(field.name)) {
                continue;
            }
            await adminClient.deletePropertyField(BOARDS_GROUP, OBJECT_TYPE_POST, field.id);
        }
    } catch (error: unknown) {
        const statusCode =
            typeof error === 'object' && error !== null && 'status_code' in error
                ? (error as {status_code?: number}).status_code
                : undefined;
        if (statusCode === 404) {
            // Boards group not yet seeded — first board creation will trigger
            // doSetupBoardsProperties.
            return;
        }
        throw error;
    }
}
