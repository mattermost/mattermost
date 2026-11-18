// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {verifyAddedAttributeRule} from './added_attribute_rule';
import {verifyRemovedAttributeRule} from './removed_attribute_rule';

/**
 * MM-T5791: Editing existing access policy to add another attribute applies access control as specified (with auto-add)
 *
 * Precondition: At least one policy in existence
 *
 * Step 1:
 * 1. Go to ABAC page, click a policy to edit. Ensure Auto-add is TRUE
 * 2. Edit an existing policy rule to add another attribute/value
 * 3. Click Test Access Rule, observe users who satisfy the policy
 * 4. Save the changes
 * 5. User who satisfies NEWLY EDITED policy but not in channel → auto-ADDED
 * 6. User who doesn't satisfy NEWLY EDITED policy and is in channel → auto-REMOVED
 *
 * Expected:
 * - User satisfying new multi-attribute policy IS auto-added
 * - User not satisfying new policy IS auto-removed
 */
test('MM-T5791 Editing policy to add attribute with auto-add enabled', async ({pw}) => {
    await verifyAddedAttributeRule(pw);
});

/**
 * MM-T5792: Editing existing access policy to remove one of the rules applies access control as specified (with auto-add)
 *
 * Precondition: At least one policy with MULTIPLE rules in existence
 *
 * Step 1:
 * 1. Go to ABAC page, click a policy to edit. Ensure Auto-add is TRUE
 * 2. Edit policy to REMOVE one of the rules (attribute/value)
 * 3. Click Test Access Rule, observe users who satisfy the policy
 * 4. Save the changes
 * 5. User who satisfies newly edited (simpler) policy but not in channel → auto-ADDED
 * 6. User who no longer satisfies newly edited policy and is in channel → auto-REMOVED
 *
 * This is the OPPOSITE of MM-T5791:
 * - MM-T5791: ADD rule → policy MORE restrictive
 * - MM-T5792: REMOVE rule → policy LESS restrictive
 */
test('MM-T5792 Editing policy to remove attribute rule with auto-add enabled', async ({pw}) => {
    await verifyRemovedAttributeRule(pw, 'simple');
});
