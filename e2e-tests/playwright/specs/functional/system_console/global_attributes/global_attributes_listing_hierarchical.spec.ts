// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Msg} from '@mattermost/playwright-lib';

import {
    createGlobalAttributeField,
    deleteGlobalAttributeFieldIfExists,
    requireHierarchicalAttributesEnabled,
    openAttributeManagement,
} from './global_attributes_helpers';

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
                const field = await createGlobalAttributeField(adminClient, name, {
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
                const attributes = await openAttributeManagement(app);

                await expect(attributes.row(field.id).nameText).toHaveText(displayName);
                await expect(attributes.row(field.id).typeText).toContainMessage(
                    Msg.admin.global_attributes.table.type.graph,
                );
                await expect(attributes.row(field.id).typeIcon).toBeVisible();
                await expect(attributes.row(field.id).sourceText).toContainMessage(
                    Msg.admin.global_attributes.table.source.managed,
                );
                await expect(attributes.row(field.id).optionsText).toContainText('2 options');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });
    });
});
