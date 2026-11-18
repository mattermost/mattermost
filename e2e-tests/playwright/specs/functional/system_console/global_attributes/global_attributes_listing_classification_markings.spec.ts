// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Msg} from '@mattermost/playwright-lib';

import {
    CLASSIFICATION_MARKINGS_ADMIN_PATH,
    deleteClassificationMarkingsFieldIfExists,
} from '../site_configuration/classification_markings_helpers';

import {
    createGlobalAttributeField,
    deleteGlobalAttributeFieldIfExists,
    openAttributeManagement,
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
                const classification = await createGlobalAttributeField(adminClient, 'classification', {
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
                const unrelated = await createGlobalAttributeField(adminClient, unrelatedRankName, {
                    type: 'rank',
                    attrs: {
                        display_name: unrelatedRankDisplayName,
                        options: [
                            {id: '', name: 'Low', rank: 1},
                            {id: '', name: 'High', rank: 2},
                        ],
                    },
                });

                const {app} = await pw.testBrowser.login(adminUser);
                let attributes = await openAttributeManagement(app);
                await expect(attributes.row(classification.id).nameText).toHaveText(classificationDisplayName);

                // * The read-only subtitle renders under the attribute name
                await expect(attributes.row(classification.id).classificationSubtitleText).toContainText(/read-only/i);

                // * The Source column identifies this row's true source, not the generic
                // "Managed here" every other native field gets
                await expect(attributes.row(classification.id).sourceText).toContainMessage(
                    Msg.admin.global_attributes.table.source.classification_markings,
                );

                // * The rightmost cell carries only an open-in-new link to the
                // Classification Markings admin page — no Edit/More-actions menu
                const openInNewLink = attributes.row(classification.id).classificationLinkLink;
                await expect(openInNewLink).toBeVisible();
                await expect(openInNewLink).toHaveHrefPath(CLASSIFICATION_MARKINGS_ADMIN_PATH);
                await expect(attributes.row(classification.id).actionsButton).toHaveCount(0);

                // # Clicking the link actually navigates to the Classification Markings page
                await openInNewLink.click();
                // * Navigation lands on the Classification Markings admin page
                await expect(app.page).toHavePath(
                    `${app.adminConsolePage.pathFor()}/site_config/classification_markings`,
                );

                attributes = await openAttributeManagement(app);

                // * An unrelated 'rank'-type field is unaffected: ordinary dot-menu, no subtitle
                await expect(attributes.row(unrelated.id).nameText).toHaveText(unrelatedRankDisplayName);
                await expect(attributes.row(unrelated.id).actionsButton).toBeVisible();
                await expect(attributes.row(unrelated.id).classificationSubtitleText).toHaveCount(0);
                await expect(attributes.row(unrelated.id).classificationLinkLink).toHaveCount(0);
                await expect(attributes.row(unrelated.id).sourceText).toContainMessage(
                    Msg.admin.global_attributes.table.source.managed,
                );

                // * Classification's name renders at the same contrast as any other row's:
                // a definition that lives on another page must not read as a disabled
                // attribute. Compared against the sibling row rather than a literal colour
                // so it holds under every theme.
                const unrelatedNameColor = await attributes
                    .row(unrelated.id)
                    .nameText.locator.evaluate((el) => getComputedStyle(el).color);
                await expect(attributes.row(classification.id).nameText).toHaveCSS('color', unrelatedNameColor);
            } finally {
                await deleteClassificationMarkingsFieldIfExists(adminClient);
                await deleteGlobalAttributeFieldIfExists(adminClient, unrelatedRankName);
            }
        },
    );
});
