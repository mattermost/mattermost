// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for graph hierarchy operators in the Membership Policy editor.
 *
 * When the selected attribute is of type `graph`, the simple-mode operator
 * dropdown replaces the standard set with the four hierarchy predicates, grouped
 * by the direction in the hierarchy they look ("has each of or a parent of" and
 * "has any of or a parent of"; "is entirely within" and "has any of or a child
 * of"), followed by the two exact-membership operators (has any of, has all of),
 * which ignore the hierarchy. Each carries a line of help text, so an item's
 * accessible name is its label followed by that description.
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

import {Api, expect, getRandomId, settle, test, type App, Msg} from '@mattermost/playwright-lib';

import {
    createLinkedGraphHierarchy,
    deleteLinkedFieldTrio,
    skipIfNoGraphFields,
    type GraphHierarchy,
} from '../resource_attributes/helpers';
import {openMembershipPolicies, openPolicy, policyIdByName} from '../surface';

const airProgram = 'Air Program';
const fighterJetProgram = 'Fighter Jet Program';
const f18Program = 'F-18 Program';

const coversAllLabel = 'has each of or a parent of';

// The graph operator menu, group titles and all, in the order it renders. Each
// operator's description closes with the policy-expression function it maps to,
// which is what connects the menu to a hand-written expression.
// Group titles are given in the casing they are written in; the menu uppercases
// them in CSS, which text assertions do not see.
const graphOperatorMenu = [
    {group: 'Parents (any level)'},
    {label: coversAllLabel, description: 'The user has each selected value, or a parent of it. (Covers All)'},
    {
        label: 'has any of or a parent of',
        description: 'The user has at least one selected value, or a parent of it. (Covers Any)',
    },
    {group: 'Children (any level)'},
    {
        label: 'is entirely within',
        description: 'The user has at least one value, and each is a selected value or a child of one. (Within All)',
    },
    {
        label: 'has any of or a child of',
        description: 'At least one value the user has is a selected value, or a child of one. (Within Any)',
    },
    {group: 'Exact match'},
    {
        label: 'has any of',
        description: 'The user has at least one selected value. A parent or a child is not enough. (Has Any Of)',
    },
    {
        label: 'has all of',
        description: 'The user has every selected value. A parent or a child is not enough. (Has All Of)',
    },
];

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
        await skipIfNoGraphFields(pw);

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
    async function openPolicyEditorOnGraphAttribute(app: App, policyName: string) {
        const policies = await openMembershipPolicies(app);
        await policies.addButton.click();
        const {policy} = app.admin.accessControl;
        await expect(policy.editPolicy.name.valueTextbox).toBeVisible();
        await policy.editPolicy.name.valueTextbox.fill(policyName);

        // # Add a rule on the graph attribute; the row's attribute menu opens itself
        const row = policy.rules.row(0);
        await policy.rules.addButton.click();
        const attribute = row.attributeMenu.attribute({id: hierarchy!.userFieldId});
        await expect(attribute).toBeVisible();
        await attribute.click();

        // # Let the attribute menu and its backdrop close before the next menu opens
        await expect(attribute).not.toBeVisible();

        // * The row is on the graph attribute, which is what every caller assumes:
        //   a graph row defaults to the strictest hierarchy predicate
        await expect(row.operatorButton).toHaveText(coversAllLabel);
        return row;
    }

    /**
     * Save the open policy, assert the rule the server serves back for it, then
     * reopen it in simple mode. Returns the reopened rule; the policy id goes to
     * onPolicyId as soon as it exists, so the caller can delete it.
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
        app: App,
        policyName: string,
        expectedExpression: string,
        onPolicyId?: (id: string) => void,
    ) {
        await settle(app.admin.saveButton, {wait: Api.CreateAccessControlPolicy}).click();
        const policyId = await policyIdByName(adminClient, policyName);
        onPolicyId?.(policyId);

        const saved = await adminClient.getAccessControlPolicy(policyId);
        expect((saved?.rules ?? []).map((r) => r.expression)).toEqual([expectedExpression]);

        const policy = await openPolicy(app, policyId);
        await expect(policy.switchModeButton).toBeEnabled();
        if (await policy.cel.input.isVisible()) {
            await policy.switchModeButton.click();
        }
        await expect(policy.rules.row(0).attributeButton).toBeVisible();
        return policy.rules.row(0);
    }

    /**
     * @objective Selecting a graph attribute in the policy editor surfaces the
     * hierarchy predicates and the exact-membership operators, grouped by the
     * direction in the hierarchy they look and each explained by a line of help
     * text, and removes the equality/string/ordinal ones; the row defaults to
     * "has each of or a parent of".
     *
     * @precondition
     * A graph user field serving an Air → Fighter Jet → F-18 hierarchy exists.
     */
    test('shows hierarchy operators for a graph attribute', {tag: '@abac'}, async ({pw}) => {
        const {app} = await pw.testBrowser.login(adminUser);

        const row = await openPolicyEditorOnGraphAttribute(app, `Graph Policy ${getRandomId()}`);

        // * The row defaults to the strictest hierarchy predicate, and the closed
        //   control carries its label alone — not the help text that goes with it
        await expect(row.operatorButton).toHaveText(coversAllLabel);

        // # Open the operator dropdown
        await row.operatorButton.click();
        const menu = app.policyRuleOperatorMenu;
        await expect(menu.operator('coversAll')).toBeVisible();

        // * The four hierarchy predicates and the two membership operators are offered, in this order
        await expect
            .poll(() => menu.operatorList.keys())
            .toEqual(['coversAll', 'coversAny', 'withinAll', 'withinAny', 'has any of', 'has all of']);

        // * Three titled groups, with their operators and the help text that says
        //   which direction in the hierarchy counts and what "all" applies to.
        //   Asserted against the menu's own children in order, so a title landing
        //   over the wrong operators fails here. Every item in this menu has a
        //   description, so its label column always holds two elements.
        // Relative group order and label layout require inspecting the menu's rendered children.
        await expect
            .poll(() =>
                menu.operatorList.locator.first().evaluate((item) =>
                    Array.from(item.parentElement!.children)
                        .filter((child) => child.tagName === 'H4' || child.getAttribute('role') === 'menuitemradio')
                        .map((child) => {
                            if (child.tagName === 'H4') {
                                return {group: child.textContent};
                            }
                            return {
                                label: child.querySelector('.label-elements > :first-child')?.textContent,
                                description: child.querySelector('.label-elements > :last-child')?.textContent,
                            };
                        }),
                ),
            )
            .toEqual(graphOperatorMenu);

        // * The function name is set below the rest of the description, and every
        //   description wraps inside the menu rather than running past its edge.
        //   Neither is visible to the jsdom tests: both come from rules the menu
        //   has to out-specify on the shared menu item, which sets its labels to
        //   neither wrap nor shrink.
        await expect(menu.operator('coversAll').functionNameText).toHaveCSS('opacity', '0.75');

        // One synchronous read, and each description measured against its own
        // item: the menu animates open, so boxes taken from separate calls are
        // scaled differently and a few pixels of skew would read as overflow.
        const clipped = await menu.operatorList.locator.first().evaluate((first) =>
            Array.from(first.parentElement!.children)
                .filter((item) => item.getAttribute('role') === 'menuitemradio')
                .filter((item) => {
                    const description = item.querySelector('.label-elements > :last-child')!;
                    return description.getBoundingClientRect().right > item.getBoundingClientRect().right;
                })
                .map((item) => item.textContent),
        );
        expect(clipped).toEqual([]);

        // * Nothing that would compare a name against an option identifier, or
        //   order a hierarchy, is offered
        for (const operator of ['is', 'is not', 'in', 'starts with', 'ends with', 'contains', 'is at least'] as const) {
            await expect(menu.operator(operator)).toHaveCount(0);
        }
    });

    /**
     * @objective The labels are presentation only: picking the operator labelled
     * "is entirely within" saves the rule as withinAll, the function its help text
     * names, and reopening the policy puts the row back on that operator.
     *
     * @precondition
     * A graph user field serving an Air → Fighter Jet → F-18 hierarchy exists.
     */
    test('saves withinAll when the label that stands for it is picked', {tag: '@abac'}, async ({pw}) => {
        const {app} = await pw.testBrowser.login(adminUser);
        const policyName = `Graph Within RT ${getRandomId()}`;
        let policyId: string | undefined;

        try {
            const row = await openPolicyEditorOnGraphAttribute(app, policyName);

            // # Move the row off its default onto the operator labelled "is
            //   entirely within", whose description ends "(Within All)"
            await row.operatorButton.click();
            const withinAll = app.policyRuleOperatorMenu.operator('withinAll');
            await expect(withinAll).toContainMessage(Msg.admin.access_control.table_editor.operator.within_all._);
            await withinAll.container.click();
            await expect(row.operatorButton).toHaveMessage(Msg.admin.access_control.table_editor.operator.within_all._);

            await row.value.container.clickTo(app.policyRuleValueMenu.search.container);
            await app.policyRuleValueMenu.search.container.fill('F-18');
            await (await app.policyRuleValueMenu.nodeList.itemWith({text: f18Program})).click();
            await expect(row.value.container).toContainText(f18Program);
            await app.page.keyboard.press('Escape');
            await expect(app.policyRuleValueMenu.search.container).not.toBeVisible();

            // * The label says nothing about a function; the saved expression is
            //   withinAll, the one the item's description names
            const reopened = await saveAndReopenInSimpleMode(
                app,
                policyName,
                `user.attributes.${hierarchy!.userFieldName}.withinAll(["${f18Program}"])`,
                (id) => {
                    policyId = id;
                },
            );

            // * Reopened on the same operator: the stored identifiers are
            //   independent of the labels, so the saved policy resolves back to
            //   this row
            await expect(reopened.operatorButton).toHaveMessage(
                Msg.admin.access_control.table_editor.operator.within_all._,
            );
            await expect(reopened.value.container).toContainText(f18Program);
        } finally {
            if (policyId) {
                await adminClient.deleteAccessControlPolicy(policyId).catch(() => {});
            }
        }
    });

    /**
     * @objective A "has each of or a parent of" (coversAll) rule over option names,
     * built in the editor, survives a save/reopen round-trip: the stored marker form
     * rehydrates to the predicate form and the table editor re-renders the same
     * operator and option names.
     *
     * @precondition
     * A graph user field serving an Air → Fighter Jet → F-18 hierarchy exists.
     */
    test('round-trips a coversAll rule over option names', {tag: '@abac'}, async ({pw}) => {
        const {app} = await pw.testBrowser.login(adminUser);
        const policyName = `Graph Names RT ${getRandomId()}`;
        let policyId: string | undefined;

        try {
            const row = await openPolicyEditorOnGraphAttribute(app, policyName);

            // # Pick an option out of the hierarchy the attribute draws on. F-18 Program
            //   sits three levels down and a fresh row has nothing selected, so nothing
            //   is expanded and the option is not rendered yet: search for it, which
            //   replaces the tree with a flat list of label matches. The option list
            //   stays open on select (it is a multi-value picker), so close it before saving.
            await row.value.container.clickTo(app.policyRuleValueMenu.search.container);
            await app.policyRuleValueMenu.search.container.fill('F-18');
            await (await app.policyRuleValueMenu.nodeList.itemWith({text: f18Program})).click();
            await expect(row.value.container).toContainText(f18Program);
            await app.page.keyboard.press('Escape');
            await expect(app.policyRuleValueMenu.search.container).not.toBeVisible();

            const reopened = await saveAndReopenInSimpleMode(
                app,
                policyName,
                `user.attributes.${hierarchy!.userFieldName}.coversAll(["${f18Program}"])`,
                (id) => {
                    policyId = id;
                },
            );

            // * Same operator and the same option name, by name — the stored form
            //   holds an option identifier, and surfacing that instead would be the
            //   visible symptom of a resolution that did not round-trip
            await expect(reopened.operatorButton).toHaveText(coversAllLabel);
            await expect(reopened.value.container).toContainText(f18Program);
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
    test('round-trips a coversAll rule against a channel attribute', {tag: '@abac'}, async ({pw}) => {
        // Only this test in the file needs the flag: comparing against the accessed
        // channel's attribute is what it gates, and saving such a rule is rejected
        // while it is off. The two tests above name option names literally.
        await pw.ensureFeatureFlag('ResourceAttributesInPolicies', true);

        // May have just restarted the server, leaving the describe-scoped adminClient
        // (from beforeEach) stale. Refresh it for this test's cleanup and afterEach's.
        adminClient = (await pw.getAdminClient()).adminClient;

        const {app} = await pw.testBrowser.login(adminUser);
        const policyName = `Graph Channel RT ${getRandomId()}`;
        let policyId: string | undefined;

        try {
            const row = await openPolicyEditorOnGraphAttribute(app, policyName);

            // # Choose the channel attribute as the comparison target instead of
            //   literal values. Both fields link to one template, which is the
            //   condition on the target being offered at all.
            await row.value.container.clickTo(
                app.policyRuleValueMenu.channelAttribute({id: hierarchy!.channelFieldId}),
            );
            await app.policyRuleValueMenu.channelAttribute({id: hierarchy!.channelFieldId}).click();
            await expect(row.value.container).toContainText(`Channel: ${hierarchy!.channelFieldName}`);

            const reopened = await saveAndReopenInSimpleMode(
                app,
                policyName,
                `user.attributes.${hierarchy!.userFieldName}.coversAll(resource.attributes.${hierarchy!.channelFieldName})`,
                (id) => {
                    policyId = id;
                },
            );

            // * The reopened row is the same rule: the predicate, and the channel
            //   attribute as its target rather than a list of values
            await expect(reopened.operatorButton).toHaveText(coversAllLabel);
            await expect(reopened.value.container).toContainText(`Channel: ${hierarchy!.channelFieldName}`);
        } finally {
            if (policyId) {
                await adminClient.deleteAccessControlPolicy(policyId).catch(() => {});
            }
        }
    });
});
