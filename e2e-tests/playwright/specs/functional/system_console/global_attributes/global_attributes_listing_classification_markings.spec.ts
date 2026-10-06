// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    CLASSIFICATION_MARKINGS_ADMIN_PATH,
    deleteClassificationMarkingsFieldIfExists,
    setClassificationMarkingsFeatureFlag,
} from '../site_configuration/classification_markings_helpers';

import {
    GLOBAL_ATTRIBUTES_ADMIN_PATH,
    createGlobalAttributeField,
    deleteGlobalAttributeFieldIfExists,
    requireGlobalAttributesEnabled,
} from './global_attributes_helpers';

test.describe('System Console - Global Attributes listing (Classification Markings)', {tag: '@system_console'}, () => {
    /**
     * @objective Ensure a real Classification Markings field (name/object_type/group_id
     * matching production's saveCreateField) renders the read-only subtitle and an
     * open-in-new link to its own admin page instead of the ordinary dot-menu, that its name
     * still renders at the same contrast as any other row's, and that an unrelated field —
     * including one that shares the same 'rank' type — is entirely unaffected.
     */
    test(
        'renders the Classification Markings row as a read-only open-in-new link, leaving an unrelated rank field unaffected',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            // # The link's destination page is gated by its own independent feature flag
            // (ClassificationMarkings) — it must be on for the link to render.
            // Tagged @classification_markings like every other spec that touches this same
            // shared server-wide field/flag (classification_markings.spec.ts,
            // global_classification_banner.spec.ts) — those specs are NOT otherwise
            // concurrency-guarded against each other; the tag is this suite's existing
            // (if informal) convention for grouping tests that share this exact resource.

            // Must run before requireGlobalAttributesEnabled: it restarts the server, which
            // would leave an adminClient obtained earlier pointing at a removed container.
            await pw.ensureFeatureFlag('ClassificationMarkings', true);
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await setClassificationMarkingsFeatureFlag(adminClient, true);

            const timestamp = Date.now();
            const classificationDisplayName = `E2E Classification Attribute ${timestamp}`;
            const unrelatedRankName = `e2e_unrelated_rank_${timestamp}`;
            const unrelatedRankDisplayName = `E2E Unrelated Ranked Attribute ${timestamp}`;

            try {
                // # Clean slate first via the classification-aware helper (not the generic
                // deleteGlobalAttributeFieldIfExists): it also removes any linked system/channel
                // field first, avoiding server-side deletion-protection errors that leave a
                // stale template field behind if another classification spec ran previously.
                await deleteClassificationMarkingsFieldIfExists(adminClient);

                // # Seed the real classification field: name 'classification', type 'rank',
                // matching classification_markings/utils/index.ts's saveCreateField exactly —
                // not the select-based shape some older, test-only e2e helpers use.
                await createGlobalAttributeField(adminClient, 'classification', {
                    type: 'rank',
                    attrs: {
                        display_name: classificationDisplayName,
                        options: [
                            {id: '', name: 'Unclassified', rank: 1},
                            {id: '', name: 'Secret', rank: 2},
                        ],
                    },
                });

                // # Seed an unrelated field that shares the same 'rank' type, to prove the
                // predicate keys on name/object_type/group_id, not on type.
                await createGlobalAttributeField(adminClient, unrelatedRankName, {
                    type: 'rank',
                    attrs: {
                        display_name: unrelatedRankDisplayName,
                        options: [
                            {id: '', name: 'Low', rank: 1},
                            {id: '', name: 'High', rank: 2},
                        ],
                    },
                });

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                const classificationRow = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page
                        .getByTestId('global-attribute-name')
                        .filter({hasText: classificationDisplayName}),
                });
                await classificationRow.waitFor();

                // * The read-only subtitle renders under the attribute name
                await expect(classificationRow.getByText('Read-only')).toBeVisible();

                // * The Source column identifies this row's true source, not the generic
                // "Managed here" every other native field gets
                await expect(classificationRow.getByTestId('global-attribute-source')).toContainText(
                    'Classification Markings',
                );

                // * The rightmost cell carries only an open-in-new link to the
                // Classification Markings admin page — no Edit/More-actions menu
                const openInNewLink = classificationRow.getByRole('link', {name: 'Open Classification Markings'});
                await expect(openInNewLink).toBeVisible();
                await expect(openInNewLink).toHaveAttribute('href', CLASSIFICATION_MARKINGS_ADMIN_PATH);
                await expect(classificationRow.getByRole('button', {name: 'More actions'})).toHaveCount(0);

                // # Clicking the link actually navigates to the Classification Markings page
                await openInNewLink.click();
                // * Navigation lands on the Classification Markings admin page
                await expect(systemConsolePage.page).toHaveURL(new RegExp(CLASSIFICATION_MARKINGS_ADMIN_PATH));

                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                // * An unrelated 'rank'-type field is unaffected: ordinary dot-menu, no subtitle
                const unrelatedRow = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page
                        .getByTestId('global-attribute-name')
                        .filter({hasText: unrelatedRankDisplayName}),
                });
                await unrelatedRow.waitFor();
                await expect(unrelatedRow.getByRole('button', {name: 'More actions'})).toBeVisible();
                await expect(unrelatedRow.getByText('Read-only')).toHaveCount(0);
                await expect(unrelatedRow.getByRole('link', {name: 'Open Classification Markings'})).toHaveCount(0);
                await expect(unrelatedRow.getByTestId('global-attribute-source')).toContainText('Managed here');

                // * Classification's name renders at the same contrast as any other row's:
                // a definition that lives on another page must not read as a disabled
                // attribute. Compared against the sibling row rather than a literal colour
                // so it holds under every theme.
                const unrelatedNameColor = await unrelatedRow
                    .getByTestId('global-attribute-name')
                    .evaluate((el) => getComputedStyle(el).color);
                await expect(classificationRow.getByTestId('global-attribute-name')).toHaveCSS(
                    'color',
                    unrelatedNameColor,
                );
            } finally {
                await deleteClassificationMarkingsFieldIfExists(adminClient);
                await deleteGlobalAttributeFieldIfExists(adminClient, unrelatedRankName);
            }
        },
    );
});
