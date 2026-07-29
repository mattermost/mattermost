// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {enableMaskingFlag} from '../masking/masking_helpers';
import {enableUserManagedAttributes} from '../support';

import {createChannelTextField, createParentPolicyViaAPI} from './helpers';

/**
 * Attribute-value masking on the resource.attributes.* write path.
 *
 * The masked-value sentinel ("--------", model.MaskingTokenValue) is a
 * response-only placeholder the server substitutes for literals a caller can't
 * see. It must never round-trip back into storage: saving a policy whose
 * resource.attributes.* condition still carries the sentinel is rejected. This
 * is the write-path half of the symmetric masking gate, asserted over HTTP.
 *
 * The read-path (caller-relative redaction of resource literals in GET /
 * visual_ast / simulate) reuses the shared-template bridge and protected /
 * shared_only fields, which require direct DB provisioning; that path is covered
 * by the app-layer resolver test (TestAppMaskingResolver_ChannelFieldUsesUserHoldings),
 * the CEL-walker/visual-AST masking tests, and the existing user-attribute
 * masking Playwright suite whose mechanics the resource path shares.
 */
test.describe('ABAC resource.attributes - masking write path', {tag: ['@abac', '@abac_masking']}, () => {
    test('rejects saving a resource.attributes condition carrying the masked sentinel', async ({pw}) => {
        await pw.skipIfNoLicense();

        const {adminClient} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as Parameters<typeof adminClient.patchConfig>[0]);
        await enableMaskingFlag(adminClient);

        const attr = `region${pw.random.id()}`;
        await createChannelTextField(adminClient, attr);

        // The 8-dash sentinel is server-generated and never a real value, so a
        // submitted expression containing it cannot be resolved to a stored
        // value and is rejected.
        let saveFailed = false;
        try {
            await createParentPolicyViaAPI(adminClient, {
                name: `Masked Sentinel ${pw.random.id()}`,
                expression: `resource.attributes.${attr} == "--------"`,
            });
        } catch {
            saveFailed = true;
        }
        expect(saveFailed).toBe(true);
    });
});
