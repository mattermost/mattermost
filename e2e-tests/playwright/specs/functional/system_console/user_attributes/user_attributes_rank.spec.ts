// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for ranked Custom Profile Attributes on the System Console
 * User Attributes page.
 *
 * Covers the schema-authoring surface: the "Ranked" attribute type, the
 * rank-numbered value chips, the per-chip popover, and the "Edit ranking"
 * modal (numeric rank editing with inline duplicate rejection).
 *
 * Field names must be valid CEL identifiers (^[A-Za-z_][A-Za-z0-9_]*$).
 */

import type {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended, SystemConsolePage} from '@mattermost/playwright-lib';

import {deleteCustomProfileAttributes} from '../../channels/custom_profile_attributes/helpers';

type FieldsMap = Record<string, UserPropertyField>;

interface TestContext {
    adminClient: Client4;
    systemConsolePage: SystemConsolePage;
}

async function setupTest(pw: PlaywrightExtended): Promise<TestContext> {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();

    // The PropertyFieldRank feature flag is enabled at the server level — via the
    // MM_FEATUREFLAGS_PROPERTYFIELDRANK env var in CI (e2e-tests/.ci/server.generate.sh)
    // and the server config locally. It cannot be toggled here: without a SplitKey the
    // config store marks FeatureFlags read-only, so a patchConfig of FeatureFlags is a
    // no-op (and a string value would fail JSON decode with a 400).

    // # Start from a clean slate so chip/row indices are predictable
    try {
        const existing = await adminClient.getCustomProfileAttributeFields();
        if (existing?.length) {
            const map: FieldsMap = {};
            for (const f of existing) {
                map[f.id] = f;
            }
            await deleteCustomProfileAttributes(adminClient, {...map, __ownedIds: new Set(Object.keys(map))} as any);
        }
    } catch {
        // nothing to clean up
    }

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    return {adminClient, systemConsolePage};
}

/** Creates a ranked CPA field via API. Options are {name, rank} pairs. */
async function createRankField(
    adminClient: Client4,
    name: string,
    options: Array<{name: string; rank: number}>,
): Promise<UserPropertyField> {
    return adminClient.createCustomProfileAttributeField({
        name,
        type: 'rank',
        attrs: {sort_order: 0, options},
    } as any);
}

async function getFieldsMap(client: Client4): Promise<FieldsMap> {
    const fields: UserPropertyField[] = await client.getCustomProfileAttributeFields();
    const map: FieldsMap = {};
    for (const field of fields) {
        map[field.id] = field;
    }
    return map;
}

async function cleanup(client: Client4): Promise<void> {
    const map = await getFieldsMap(client);
    await deleteCustomProfileAttributes(client, {...map, __ownedIds: new Set(Object.keys(map))} as any);
}

test.describe('System Console - Ranked User Attributes', () => {
    /**
     * @objective Creating a Ranked attribute and adding values auto-assigns
     * ascending ranks, renders numbered chips in ascending order, and persists
     * the field as type `rank` with sequential rank integers.
     */
    test('creates a ranked attribute with auto-assigned ranks and saves', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;
        const name = `clearance_${Date.now()}`;

        try {
            // # Navigate to User Attributes
            await sp.goto();

            // # Add a new attribute and name it
            await sp.addAttribute();
            const nameInput = sp.lastNameInput();
            await nameInput.fill(name);
            await nameInput.blur();

            // # Change the type to Ranked
            await sp.selectLastType('Rank');

            // # Add three values — each auto-assigns the next rank (1, 2, 3)
            await sp.addRankValuesToLast(['Unclassified', 'Secret', 'TopSecret']);

            // * Chips render left→right in ascending rank order
            await expect(sp.rankChips()).toHaveCount(3);
            expect(await sp.rankChipLabels()).toEqual(['Unclassified', 'Secret', 'TopSecret']);

            // * Each chip carries its rank badge (1, 2, 3)
            await expect(sp.rankBadge('Unclassified')).toHaveText('1');
            await expect(sp.rankBadge('Secret')).toHaveText('2');
            await expect(sp.rankBadge('TopSecret')).toHaveText('3');

            await sp.saveAndWaitForSettled();

            // * Verify the field persisted as a ranked field with sequential ranks
            const created = Object.values(await getFieldsMap(adminClient)).find((f) => f.name === name);
            expect(created).toBeDefined();
            expect(created!.type).toBe('rank');
            const byName = Object.fromEntries((created!.attrs.options ?? []).map((o) => [o.name, o.rank]));
            expect(byName).toMatchObject({Unclassified: 1, Secret: 2, TopSecret: 3});
        } finally {
            await cleanup(adminClient);
        }
    });

    /**
     * @objective The Edit ranking modal's add-value inline input rejects a label
     * already used by another option: a "Values must be unique." error appears and
     * the duplicate cannot be committed until the label is changed.
     *
     * The modal uses drag-and-drop ordering (rank = position), so duplicate ranks
     * are impossible by construction; this test covers the duplicate-label guard on
     * the add-value input instead.
     *
     * @precondition
     * A ranked attribute with options Unclassified(1), Secret(2), TopSecret(3) exists.
     */
    test('rejects a duplicate label in the Edit ranking modal add input', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;
        const name = `clearance_${Date.now()}`;

        try {
            const field = await createRankField(adminClient, name, [
                {name: 'Unclassified', rank: 1},
                {name: 'Secret', rank: 2},
                {name: 'TopSecret', rank: 3},
            ]);

            // # Navigate to User Attributes and open the Edit ranking modal
            await sp.goto();
            await sp.openEditRanking(field.id);

            // * Modal shows one row per option
            await expect(sp.rankedModalRows()).toHaveCount(3);

            // # Open the add-value input and type a label already in use
            await sp.addRankedModalValue();
            const addInput = sp.rankedModal().locator('.ranked-schema-modal__add-input');
            await addInput.fill('Secret');

            // * Duplicate-label error appears
            await expect(sp.rankedModal().getByText('Values must be unique.')).toBeVisible();

            // * Save is still enabled (duplicate prevents commit, not save of existing rows)
            await expect(sp.rankedModalSaveButton()).toBeEnabled();

            // # Correct the label — duplicate error disappears
            await addInput.fill('Confidential');
            await expect(sp.rankedModal().getByText('Values must be unique.')).not.toBeVisible();
        } finally {
            await cleanup(adminClient);
        }
    });

    /**
     * @objective Renaming an option through the per-chip popover persists the new
     * label while preserving its rank.
     *
     * @precondition
     * A ranked attribute with options Unclassified(1), Secret(2), TopSecret(3) exists.
     */
    test('renames a ranked option via the per-chip popover', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;
        const name = `clearance_${Date.now()}`;

        try {
            await createRankField(adminClient, name, [
                {name: 'Unclassified', rank: 1},
                {name: 'Secret', rank: 2},
                {name: 'TopSecret', rank: 3},
            ]);

            await sp.goto();

            // # Open the Secret chip's popover and rename it
            await sp.openRankChipPopover('Secret');
            const labelInput = sp.rankPopoverLabelInput();
            await expect(labelInput).toHaveValue('Secret');
            await labelInput.fill('Classified');
            await labelInput.press('Enter');
            await sp.dismissMenu();

            // * The chip now shows the new label, still at rank 2
            await expect(sp.rankChip('Classified')).toBeVisible();
            await expect(sp.rankBadge('Classified')).toHaveText('2');

            await sp.saveAndWaitForSettled();

            // * The option rename persisted with its rank unchanged
            const updated = Object.values(await getFieldsMap(adminClient)).find((f) => f.name === name);
            const renamed = updated!.attrs.options?.find((o) => o.name === 'Classified');
            expect(renamed).toBeDefined();
            expect(renamed!.rank).toBe(2);
            expect(updated!.attrs.options?.some((o) => o.name === 'Secret')).toBe(false);
        } finally {
            await cleanup(adminClient);
        }
    });

    /**
     * @objective Adding a value in the Edit ranking modal persists it with the next
     * sequential rank.
     *
     * The add-value affordance shows an inline text input; blurring the input
     * commits the new label as the highest-ranked option.
     *
     * @precondition
     * A ranked attribute with options Unclassified(1), Secret(2) exists.
     */
    test('adds a value via the Edit ranking modal', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;
        const name = `clearance_${Date.now()}`;

        try {
            const field = await createRankField(adminClient, name, [
                {name: 'Unclassified', rank: 1},
                {name: 'Secret', rank: 2},
            ]);

            await sp.goto();
            await sp.openEditRanking(field.id);
            await expect(sp.rankedModalRows()).toHaveCount(2);

            // # Click "Add value" — shows the inline add input (counted as a row)
            await sp.addRankedModalValue();
            await expect(sp.rankedModalRows()).toHaveCount(3);

            // * Save is available (the inline input is not yet a committed row)
            await expect(sp.rankedModalSaveButton()).toBeEnabled();

            // # Type the new label and commit it by blurring
            const addInput = sp.rankedModal().locator('.ranked-schema-modal__add-input');
            await addInput.fill('TopSecret');
            await addInput.blur();

            // * Three committed rows; save remains available
            await expect(sp.rankedModalRows()).toHaveCount(3);
            await expect(sp.rankedModalSaveButton()).toBeEnabled();
            await sp.saveRankedModal();
            await sp.saveAndWaitForSettled();

            // * The new option persisted at rank 3
            const updated = Object.values(await getFieldsMap(adminClient)).find((f) => f.name === name);
            const added = updated!.attrs.options?.find((o) => o.name === 'TopSecret');
            expect(added).toBeDefined();
            expect(added!.rank).toBe(3);
        } finally {
            await cleanup(adminClient);
        }
    });
});
