// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for graph hierarchy operators in the Membership Policy editor.
 *
 * When the selected attribute is of type `graph`, the simple-mode operator
 * dropdown replaces the standard set with the four hierarchy predicates (covers
 * all of, covers any of, is within all of, is within any of) followed by the two
 * exact-membership operators (has any of, has all of), which ignore the hierarchy.
 *
 * The two right-hand-side shapes a predicate accepts are both authored here,
 * because they are different code paths and only one of them is the driving use
 * case:
 *  - a list of option names, picked from the hierarchy the attribute draws on;
 *  - another channel attribute drawing on the same hierarchy, which is the
 *    "does the user cover what this channel discusses" rule the feature exists for.
 *
 * Each is saved and reopened, so the assertion covers the whole round trip: the
 * editor's emitted CEL, the server's desugaring of it into storage, the
 * rehydration back to the author form, and the editor re-parsing that form into
 * the same operator and value it started from.
 */

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

import {
    createLinkedGraphHierarchy,
    deleteLinkedFieldTrio,
    openPolicyEditor,
    skipIfNoGraphFields,
    type GraphHierarchy,
} from '../resource_attributes/helpers';

const airProgram = 'Air Program';
const fighterJetProgram = 'Fighter Jet Program';
const f18Program = 'F-18 Program';

test.describe('System Console - Membership Policy graph operators', () => {
    let adminClient: Client4;
    let adminUser: UserProfile;
    let hierarchy: GraphHierarchy | undefined;

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const clientInfo = await pw.getAdminClient();
        adminClient = clientInfo.adminClient;
        adminUser = clientInfo.adminUser!;
        await skipIfNoGraphFields(adminClient);

        // # Create a hierarchy of programs, plus the user and channel fields that
        //   serve it. Both fields link to the template, so they draw on one option
        //   pool — which is what lets the channel field be the target of a
        //   predicate on the user field.
        hierarchy = await createLinkedGraphHierarchy(adminClient, `programs${getRandomId()}`, [
            {name: airProgram},
            {name: fighterJetProgram, parents: [airProgram]},
            {name: f18Program, parents: [fighterJetProgram]},
        ]);

        // # Make sure ABAC stays enabled (a concurrent initSetup can reset config)
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as any);
    });

    test.afterEach(async () => {
        if (hierarchy) {
            await deleteLinkedFieldTrio(adminClient, hierarchy);
            hierarchy = undefined;
        }
    });

    /**
     * Open the new-policy editor with one attribute row on the graph user field,
     * and return the row's operator button. Mirrors the ranked-operator spec's
     * opening: the "Add attribute" button stays disabled until the editor has
     * loaded the attribute list, and one reload is the established way to wait it
     * out on a server other specs are also writing fields to.
     */
    async function openPolicyEditorOnGraphAttribute(page: any, policyName: string) {
        await page.goto('/admin_console/system_attributes/membership_policies');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', {name: 'Add policy'}).click();
        await page.waitForLoadState('networkidle');
        const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
        await nameInput.waitFor({state: 'visible', timeout: 10000});
        await nameInput.fill(policyName);

        const addAttributeButton = page.getByRole('button', {name: /add attribute/i});
        await addAttributeButton.waitFor({state: 'visible', timeout: 10000});
        if (await addAttributeButton.isDisabled()) {
            await page.reload();
            await page.waitForLoadState('networkidle');
            await nameInput.fill(policyName);
            await expect(addAttributeButton).toBeEnabled({timeout: 15000});
        }
        await addAttributeButton.click();

        // # Select the graph attribute by field id, scoped to the open menu. The
        //   row's menu opens itself when the row is added; the click has to wait for
        //   the menu's backdrop to stop covering the item, so it is not forced —
        //   a forced click lands on the backdrop, which closes the menu having
        //   selected nothing and leaves the row on its default text operator.
        const attributeMenu = page.locator('[id^="attribute-selector-menu"]');
        if (!(await attributeMenu.isVisible({timeout: 5000}).catch(() => false))) {
            await page.locator('[data-testid="attributeSelectorMenuButton"]').first().click();
        }
        await attributeMenu.locator(`#attribute-${hierarchy!.userFieldId}`).click();

        // # Let the attribute menu and its backdrop close before the next menu opens
        await expect(attributeMenu).toBeHidden();

        // * The row is on the graph attribute, which is what every caller assumes:
        //   a graph row defaults to the strictest hierarchy predicate
        const operatorButton = page.locator('[data-testid="operatorSelectorMenuButton"]').first();
        await expect(operatorButton).toContainText('covers all of');

        return operatorButton;
    }

    /**
     * Resolve a policy by its exact name over the API. Only an exact match counts:
     * a near-match would let a failed save read as a successful one and send every
     * assertion below at some other spec's policy.
     */
    async function policyIdByExactName(policyName: string): Promise<string> {
        let policyId: string | undefined;
        await expect
            .poll(
                async () => {
                    const result: any = await (adminClient as any).doFetch(
                        `${adminClient.getBaseRoute()}/access_control_policies/search`,
                        {method: 'POST', body: JSON.stringify({term: policyName})},
                    );
                    const policies: any[] = result?.policies ?? [];
                    policyId = policies.find((p) => p.name === policyName)?.id;
                    return Boolean(policyId);
                },
                {timeout: 15_000, message: `policy "${policyName}" was never saved`},
            )
            .toBe(true);
        return policyId!;
    }

    /**
     * Save the open policy, assert the rule the server serves back for it, then
     * reopen it in simple mode. Returns the policy id so the caller can delete it.
     *
     * The expression assertion is what makes the round trip more than a check that
     * the browser remembers its own state: a graph predicate is not stored as
     * written. It is desugared at save into a marker over group and field ids —
     * `_graph_covers_all(user.id_<group>.id_<field>, ["F-18 Program"], "<field>")` —
     * so the author form coming back out is the server resolving that marker's ids
     * to names again, not an echo of what was submitted.
     *
     * Reopened by id rather than by finding its row in the policy list: the list
     * pages, so on a server other specs are also writing policies to a new one can
     * sit off the first page, which looks exactly like a save that failed.
     *
     * Existing policies open in Advanced mode; the "Switch to Simple Mode" toggle is
     * enabled only when the stored expression is one the table editor can parse, so
     * clicking it is a second, independent check on the same rehydration.
     */
    async function saveAndReopenInSimpleMode(
        page: any,
        policyName: string,
        expectedExpression: string,
    ): Promise<string> {
        await page.getByRole('button', {name: 'Save'}).last().click();
        await page.waitForLoadState('networkidle');

        const policyId = await policyIdByExactName(policyName);

        const saved: any = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/access_control_policies/${policyId}`,
            {method: 'GET'},
        );
        expect((saved?.rules ?? []).map((r: any) => r.expression)).toEqual([expectedExpression]);

        await openPolicyEditor(page, policyId);

        const toSimpleMode = page.getByRole('button', {name: 'Switch to Simple Mode'});
        if (await toSimpleMode.isVisible({timeout: 5000}).catch(() => false)) {
            await expect(toSimpleMode).toBeEnabled();
            await toSimpleMode.click();
        }

        return policyId;
    }

    /**
     * @objective Selecting a graph attribute in the policy editor surfaces the
     * hierarchy predicates and the exact-membership operators, and removes the
     * equality/string/ordinal ones; the row defaults to "covers all of".
     *
     * @precondition
     * A graph user field serving an Air → Fighter Jet → F-18 hierarchy exists.
     */
    test('shows hierarchy operators for a graph attribute', {tag: '@abac'}, async ({pw}) => {
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;

        const operatorButton = await openPolicyEditorOnGraphAttribute(page, `Graph Policy ${getRandomId()}`);

        // * The row defaults to the strictest hierarchy predicate, "covers all of"
        await expect(operatorButton).toContainText('covers all of');

        // # Open the operator dropdown
        await operatorButton.click();

        // * The four hierarchy predicates and the two membership operators are offered
        for (const label of [
            'covers all of',
            'covers any of',
            'is within all of',
            'is within any of',
            'has any of',
            'has all of',
        ]) {
            await expect(page.getByRole('menuitemradio', {name: label, exact: true})).toBeVisible();
        }

        // * Nothing that would compare a name against an option identifier, or
        //   order a hierarchy, is offered
        for (const label of ['is', 'is not', 'in', 'starts with', 'ends with', 'contains', 'is at least']) {
            await expect(page.getByRole('menuitemradio', {name: label, exact: true})).toHaveCount(0);
        }
    });

    /**
     * @objective A "covers all of <option names>" rule built in the editor survives
     * a save/reopen round-trip: the stored marker form rehydrates to the predicate
     * form and the table editor re-renders the same operator and option names.
     *
     * @precondition
     * A graph user field serving an Air → Fighter Jet → F-18 hierarchy exists.
     */
    test('round-trips a "covers all of" rule over option names', {tag: '@abac'}, async ({pw}) => {
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyName = `Graph Names RT ${getRandomId()}`;
        let policyId: string | undefined;

        try {
            await openPolicyEditorOnGraphAttribute(page, policyName);

            // # Pick an option out of the hierarchy the attribute draws on. The
            //   option list stays open on select (it is a multi-value picker), so
            //   close it before saving.
            const valueButton = page.locator('[data-testid="valueSelectorMenuButton"]').first();
            await valueButton.click();
            const valueMenu = page.locator('[id^="value-selector-menu"]');
            await valueMenu.waitFor({state: 'visible', timeout: 10000});
            await valueMenu.getByRole('menuitemcheckbox', {name: f18Program, exact: true}).click();
            await expect(valueButton).toContainText(f18Program);
            await page.keyboard.press('Escape');

            policyId = await saveAndReopenInSimpleMode(
                page,
                policyName,
                `user.attributes.${hierarchy!.userFieldName}.coversAll(["${f18Program}"])`,
            );

            // * Same operator and the same option name, by name — the stored form
            //   holds an option identifier, and surfacing that instead would be the
            //   visible symptom of a resolution that did not round-trip
            await expect(page.locator('[data-testid="operatorSelectorMenuButton"]').first()).toContainText(
                'covers all of',
            );
            await expect(page.locator('[data-testid="valueSelectorMenuButton"]').first()).toContainText(f18Program);
        } finally {
            if (policyId) {
                await adminClient.deleteAccessControlPolicy(policyId).catch(() => {});
            }
        }
    });

    /**
     * @objective The driving use case authored through the editor: a rule comparing
     * the user's programs against the channel's, which is a member call with a
     * channel-attribute argument rather than a literal list. It round-trips through
     * save and reopen the same way.
     *
     * @precondition
     * A graph user field and a graph channel field linked to the same template
     * exist, so the channel field is offered as a comparison target.
     */
    test('round-trips a "covers all of" rule against a channel attribute', {tag: '@abac'}, async ({pw}) => {
        // Only this test in the file needs the flag: comparing against the accessed
        // channel's attribute is what it gates, and saving such a rule is rejected
        // while it is off. The two tests above name option names literally.
        await pw.skipIfFeatureFlagNotSet('ResourceAttributesInPolicies', true);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyName = `Graph Channel RT ${getRandomId()}`;
        let policyId: string | undefined;

        try {
            await openPolicyEditorOnGraphAttribute(page, policyName);

            // # Choose the channel attribute as the comparison target instead of
            //   literal values. Both fields link to one template, which is the
            //   condition on the target being offered at all. Scoped to the open
            //   menu and unforced for the same reason as the attribute pick: a
            //   forced click can be spent on the menu's backdrop, which closes the
            //   menu having selected nothing.
            const valueButton = page.locator('[data-testid="valueSelectorMenuButton"]').first();
            await valueButton.click();
            const valueMenu = page.locator('[id^="value-selector-menu"]');
            await valueMenu.waitFor({state: 'visible', timeout: 10000});
            await valueMenu.locator(`#channel-attr-${hierarchy!.channelFieldId}`).click();
            await expect(valueButton).toContainText(`Channel: ${hierarchy!.channelFieldName}`);

            policyId = await saveAndReopenInSimpleMode(
                page,
                policyName,
                `user.attributes.${hierarchy!.userFieldName}.coversAll(resource.attributes.${hierarchy!.channelFieldName})`,
            );

            // * The reopened row is the same rule: the predicate, and the channel
            //   attribute as its target rather than a list of values
            await expect(page.locator('[data-testid="operatorSelectorMenuButton"]').first()).toContainText(
                'covers all of',
            );
            await expect(page.locator('[data-testid="valueSelectorMenuButton"]').first()).toContainText(
                `Channel: ${hierarchy!.channelFieldName}`,
            );
        } finally {
            if (policyId) {
                await adminClient.deleteAccessControlPolicy(policyId).catch(() => {});
            }
        }
    });
});
