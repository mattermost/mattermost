// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Msg} from '@mattermost/playwright-lib';
import type {App} from '@mattermost/playwright-lib';

import {
    GLOBAL_ATTRIBUTES_ADMIN_PATH,
    createGlobalAttributeField,
    deleteGlobalAttributeFieldIfExists,
    requireHierarchicalAttributesEnabled,
} from './global_attributes_helpers';

/** Bounds the native listing controls to their Attribute Management panel. */
function attributeListing(app: App) {
    // This panel has no generated scope; its existing root id bounds its rows and search controls.
    return app.page.getByTestId('globalAttributes');
}

test.describe('System Console - Global Attributes listing', {tag: '@system_console'}, () => {
    test.describe('listing', () => {
        /**
         * @objective Ensure a seeded graph field renders as Hierarchical with an options count,
         * not as Free Text or an unknown type.
         */
        test('renders a seeded graph field as Hierarchical with its option count', async ({pw}) => {
            await pw.ensureFeatureFlag('PropertyFieldGraph', true);
            const {adminUser, adminClient} = await requireHierarchicalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_graph_${timestamp}`;
            const displayName = `E2E Hierarchical Attribute ${timestamp}`;

            try {
                await createGlobalAttributeField(adminClient, name, {
                    type: 'graph',
                    attrs: {
                        display_name: displayName,
                        options: [
                            {id: '', name: 'Air', parents: []},
                            {id: '', name: 'Fighter', parents: ['Air']},
                        ],
                    },
                });

                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                // The attributes table declares no parts for its rows: addressed by the legacy global-attribute-name / -type testids.
                const row = attributeListing(app).locator('tr', {
                    has: app.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });

                await expect(row.getByTestId('global-attribute-name')).toHaveText(displayName);
                await expect(row.getByTestId('global-attribute-type')).toContainMessage(
                    Msg.admin.global_attributes.table.type.graph,
                );
                // The type icon has no generated part; inspect the SVG within this attribute type cell.
                await expect(row.getByTestId('global-attribute-type').locator('svg')).toBeVisible();
                await expect(row.getByTestId('global-attribute-source')).toContainMessage(
                    Msg.admin.global_attributes.table.source.managed,
                );
                await expect(row.getByTestId('global-attribute-options')).toContainText('2 options');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });
    });
});
