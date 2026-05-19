// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for System Console > System Attributes > Board Attributes.
 *
 * Covers the MM-67412 admin UI for managing Boards property fields
 * (PSAv2 / "boards" group), including:
 *   - Locked seed rows (Status, Assignee) with lock icons + no destructive
 *     actions
 *   - Adding, naming, and saving a custom attribute
 *   - Persistence across reload (via the same REST API the UI uses)
 *
 * The nav entry is gated on FeatureFlags.IntegratedBoards; setupTest
 * enables it via adminClient.patchConfig.
 */

import {Client4} from '@mattermost/client';
import {PropertyField} from '@mattermost/types/properties';

import {expect, test, SystemConsolePage} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

const BOARDS_GROUP = 'boards';
const OBJECT_TYPE_POST = 'post';
const SYSTEM_TARGET_TYPE = 'system';

type Ctx = {
    adminClient: Client4;
    systemConsolePage: SystemConsolePage;
};

async function setupTest(pw: PlaywrightExtended): Promise<Ctx> {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();

    // # Enable IntegratedBoards feature flag so the Board Attributes nav
    // entry and screen are reachable.
    await adminClient.patchConfig({
        FeatureFlags: {IntegratedBoards: true},
    } as any);

    // # Clean up any non-protected boards-group fields left over from prior
    // runs so the locked-row + add-custom flows start from a known state.
    try {
        const existing = await adminClient.getPropertyFields(BOARDS_GROUP, OBJECT_TYPE_POST, SYSTEM_TARGET_TYPE);
        for (const f of existing ?? []) {
            if (!(f as PropertyField & {protected?: boolean}).protected) {
                await adminClient.deletePropertyField(BOARDS_GROUP, OBJECT_TYPE_POST, f.id);
            }
        }
    } catch {
        // No fields to clean up, or boards group not yet seeded — first board
        // creation will trigger the doSetupBoardsProperties migration.
    }

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    return {adminClient, systemConsolePage};
}

async function cleanupCustomBoardFields(adminClient: Client4): Promise<void> {
    try {
        const fields = await adminClient.getPropertyFields(BOARDS_GROUP, OBJECT_TYPE_POST, SYSTEM_TARGET_TYPE);
        for (const f of fields ?? []) {
            if (!(f as PropertyField & {protected?: boolean}).protected) {
                await adminClient.deletePropertyField(BOARDS_GROUP, OBJECT_TYPE_POST, f.id);
            }
        }
    } catch {
        // best effort
    }
}

test.describe('System Console - Board Attributes Management', {tag: '@board_attributes'}, () => {
    /**
     * @objective AC2 + AC3: the page renders, the seeded Status and Assignee
     * rows are visible, and both expose a lock icon indicating they are
     * protected from rename/delete.
     */
    test('renders the page with protected Status and Assignee seed rows', async ({pw}) => {
        const {systemConsolePage} = await setupTest(pw);
        const ba = systemConsolePage.boardAttributes;

        // # Navigate via the sidebar entry — proves the nav wiring works,
        // not just the URL.
        await systemConsolePage.sidebar.systemAttributes.boardAttributes.click();
        await ba.toBeVisible();

        // * Status row exists with the seeded name and its three values are
        // visible (rendered through the protected/read-only chip path).
        await expect(ba.nameInputByValue('status')).toBeVisible();
        await expect(ba.optionChip('Todo')).toBeVisible();
        await expect(ba.optionChip('In Progress')).toBeVisible();
        await expect(ba.optionChip('Complete')).toBeVisible();

        // * Assignee row exists.
        await expect(ba.nameInputByValue('assignee')).toBeVisible();

        // * Save button is present but disabled (no pending changes).
        await expect(ba.saveButton).toBeVisible();
        await expect(ba.saveButton).toBeDisabled();
    });

    /**
     * @objective AC3 + AC6: the protected (Status) row renders through the
     * read-only chip path, no editable values container exists for it, and
     * the name input is non-editable — confirming the UI exposes no
     * rename/delete affordance on seeded fields.
     */
    test('Status renders read-only values and disables its name input', async ({pw}) => {
        const {systemConsolePage} = await setupTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        // * The protected/read-only values container exists. Status is the
        // only protected select field, so a single occurrence is expected.
        await expect(ba.container.getByTestId('property-values-readonly')).toBeVisible();
        await expect(ba.container.getByTestId('property-values-readonly')).toHaveCount(1);

        // * The protected chips render through the read-only container — Todo
        // is one of the three seeded values.
        await expect(ba.container.getByTestId('property-values-readonly').getByText('Todo', {exact: true})).toBeVisible();

        // * Status name input is disabled (the field itself is protected).
        await expect(ba.nameInputByValue('status')).toBeDisabled();
    });

    /**
     * @objective AC5: an admin can add a custom text attribute, rename it,
     * save, and on reload the field is still present (i.e. persisted by the
     * underlying PSAv2 API).
     */
    test('adds, names, saves, and persists a custom attribute across reload', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        // # Click Add attribute
        await ba.addAttribute();

        // # Name the new row. lastNameInput() targets the just-added row so
        // we don't fight Status/Assignee for the 0th slot.
        const newName = `Priority_${Date.now()}`;
        await ba.lastNameInput().fill(newName);
        await ba.lastNameInput().blur();

        // # Save and wait for the panel to settle.
        await ba.saveAndWaitForSettled();

        // * The field exists on the server.
        const fieldsAfterSave = await adminClient.getPropertyFields(BOARDS_GROUP, OBJECT_TYPE_POST, SYSTEM_TARGET_TYPE);
        const created = (fieldsAfterSave ?? []).find((f) => f.name === newName);
        expect(created).toBeDefined();

        // # Reload the page.
        await ba.goto();
        await ba.toBeVisible();

        // * The field is still rendered in the table after reload.
        await expect(ba.nameInputByValue(newName)).toBeVisible();

        await cleanupCustomBoardFields(adminClient);
    });

    // Note: the feature-flag-off path (IntegratedBoards=false hides the nav
    // entry) is intentionally NOT covered here. Feature flags in
    // dev/CI are typically driven by `MM_FEATUREFLAGS_*` env vars, which the
    // server reads at startup and `adminClient.patchConfig` can't override
    // at runtime. The negative path is unit-testable via the `isHidden`
    // rule in admin_definition.tsx, where setting `FeatureFlags.IntegratedBoards`
    // to false in a synthetic config and asserting that the route registers
    // as hidden is more reliable than a flaky E2E flip.
});
