// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {UserProfile} from '@mattermost/types/users';

import {Api, App, duration, expect, setCelExpression, settle, systemConsolePath} from '@mattermost/playwright-lib';

import type {CpaFieldsMap} from '../../channels/custom_profile_attributes/helpers';
import {waitForAttributeViewToInclude} from '../../channels/team_settings/helpers';

/**
 * Attribute-based access on the generated page objects: the ABAC setting, the membership policy list (rows by policy
 * id), the policy editor (its name, the rules table with rows by position and their attribute, operator and value
 * menus, the CEL editor, the channels and their auto-add, Save and its apply dialog) and the access test dialog.
 */

const SYSTEM_ATTRIBUTES = systemConsolePath('system_attributes');
export const ABAC_SETTINGS_PATH = `${SYSTEM_ATTRIBUTES}/attribute_based_access_control`;
export const MEMBERSHIP_POLICIES_PATH = `${SYSTEM_ATTRIBUTES}/membership_policies`;
export const PERMISSION_POLICIES_PATH = `${SYSTEM_ATTRIBUTES}/permission_policies`;

type Rules = App['admin']['accessControl']['policy']['rules'] | App['admin']['permissionPolicy']['rules'];
type RuleRow = ReturnType<Rules['row']>;
type RuleOperator = Parameters<App['policyRuleOperatorMenu']['operator']>[0];
type Permission = Parameters<App['admin']['permissionPolicy']['permissionMenu']['permission']>[0];
type Role = Parameters<App['admin']['permissionPolicy']['roleMenu']['role']>[0];

export type Rule = {field: {id: string}; operator?: RuleOperator; value: string};

/** The attribute field named `name` among the ones a test set up. */
export function fieldNamed(fields: CpaFieldsMap, name: string): UserPropertyField {
    const field = Object.values(fields).find((f): f is UserPropertyField => !(f instanceof Set) && f.name === name);
    if (!field) {
        throw new Error(`No attribute field named ${name}`);
    }
    return field;
}

/**
 * Turns attribute-based access on (or off) on its System Console page and saves. The console offers Save after any
 * change, so the radio is first moved to the other value and then to the wanted one: the result is the same, and
 * the page saves whether or not the setting already had that value.
 */
export async function setAbacEnabled(app: App, enabled: boolean) {
    await app.page.goto(ABAC_SETTINGS_PATH);
    const setting = app.admin.setting('AccessControlSettings.EnableAttributeBasedAccessControl');
    const [wanted, other] = enabled ? [setting.trueRadio, setting.falseRadio] : [setting.falseRadio, setting.trueRadio];
    await expect(wanted).toBeVisible();
    await other.check();
    await wanted.check();
    await expect(wanted).toBeChecked();
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
    await expect(app.admin.saveButton).toBeSaved();
}

/** Opens System Console > Membership Policies, waiting for its list. */
export async function openMembershipPolicies(app: App): Promise<App['admin']['accessControl']['policies']> {
    await app.page.goto(MEMBERSHIP_POLICIES_PATH);
    const {policies} = app.admin.accessControl;
    await expect(policies.searchTextbox).toBeVisible();
    return policies;
}

/** Opens a membership policy's editor. */
export async function openPolicy(app: App, policyId: string): Promise<App['admin']['accessControl']['policy']> {
    await app.page.goto(`${MEMBERSHIP_POLICIES_PATH}/edit_policy/${policyId}`);
    const {policy} = app.admin.accessControl;
    await expect(policy.editPolicy.name.valueTextbox).toBeVisible();
    return policy;
}

/** Fills a rule row's value: a free-text value inline, or one typed into the value menu (Enter adds it to a list). */
export async function fillRuleValue(row: RuleRow, value: string) {
    // The row renders an inline box or a menu button, by the attribute and operator; wait for whichever it shows
    let control = 'none';
    await expect
        .poll(async () => {
            control =
                ((await row.valueInputTextbox.isVisible()) && 'inline') ||
                ((await row.value.container.isVisible()) && 'menu') ||
                'none';
            return control;
        })
        .not.toBe('none');
    if (control === 'inline') {
        await row.valueInputTextbox.fill(value);
        await row.valueInputTextbox.press('Tab');
        await expect(row.valueInputTextbox).toHaveValue(value);
        return;
    }
    await row.value.container.click();
    // The menu opens outside its row, so it is found from the page rather than from the row.
    const menu = new App(row.page).policyRuleValueMenu;
    // A single-value menu has its own box; a list's filter box takes each value
    let box = 'none';
    await expect
        .poll(async () => {
            box =
                ((await menu.value.container.isVisible()) && 'single') ||
                ((await menu.filter.container.isVisible()) && 'list') ||
                'none';
            return box;
        })
        .not.toBe('none');
    const input = box === 'single' ? menu.value.container : menu.filter.container;
    await input.fill(value);
    await expect(input).toHaveValue(value);

    // Tab commits a single value and closes the menu; a list takes each value on Enter, then Tab closes it (the
    // list's filter box keeps every other key, Escape included, from reaching the menu)
    if (box === 'single') {
        await input.press('Tab');
    } else {
        await input.press('Enter');
        await expect(input).toHaveValue('');
        await input.press('Tab');
    }
    await expect(input).not.toBeVisible();
}

/** Adds a rule to a rules table: its attribute, its operator (when not the default) and its value. */
export async function addRule(rules: Rules, rule: Rule): Promise<RuleRow> {
    const row = rules.row((await rules.rowList.keys()).length);
    await expect(rules.addButton).toBeEnabled();
    await rules.addButton.click();
    await expect(row.attributeMenu).toBeVisible();
    await expect(row.attributeMenu.attribute(rule.field)).toBeVisible();
    await row.attributeMenu.attribute(rule.field).click();
    await expect(row.attributeMenu).not.toBeVisible();
    if (rule.operator) {
        // The menu opens outside its row, so it is found from the page rather than from the row.
        const operatorMenu = new App(rules.page).policyRuleOperatorMenu;
        await row.operatorButton.click();
        await expect(operatorMenu.operator(rule.operator)).toBeVisible();
        await operatorMenu.operator(rule.operator).container.click();
        await expect(operatorMenu.operator(rule.operator)).not.toBeVisible();
    }
    await fillRuleValue(row, rule.value);
    return row;
}

/** Picks channels in the channel selector dialog, by name then by id, and adds them. */
export async function addChannels(
    app: App,
    policy: App['admin']['accessControl']['policy'],
    channels: Array<{id: string; name: string}>,
) {
    await policy.addChannelsButton.click();
    const {channels: picker} = app.channelSelectorModal;
    await expect(picker.searchCombobox).toBeVisible();
    for (const channel of channels) {
        await picker.searchCombobox.fill(channel.name);
        // This selector row handles click without an interactive role.
        await picker.results.channel(channel).click();
        await expect(picker.remove(channel.id)).toBeVisible();
    }
    await picker.saveButton.click();
    await expect(picker.saveButton).not.toBeVisible();
    for (const channel of channels) {
        await expect(policy.channels.row(channel.id)).toBeVisible();
    }
}

/**
 * Saves the policy editor. With channels assigned, Save asks to apply the policy first; confirming starts a sync job,
 * whose id this returns (null when there were no channels, so no job).
 */
export async function savePolicy(app: App, policy: App['admin']['accessControl']['policy']): Promise<string | null> {
    const hasChannels = (await policy.channels.rowList.keys()).length > 0;
    if (!hasChannels) {
        await settle(app.admin.saveButton, {wait: Api.CreateAccessControlPolicy}).click();
        await expect(app.page).toHavePath(MEMBERSHIP_POLICIES_PATH);
        return null;
    }
    await app.admin.saveButton.click();
    const {confirmModal} = policy;

    // applying it now is what starts the sync
    await expect(confirmModal.enforceCheckbox).toBeChecked();
    const job = await settle(confirmModal.confirmButton, {wait: Api.CreateJob}).click();
    await expect(app.page).toHavePath(MEMBERSHIP_POLICIES_PATH);
    return job.id;
}

/** The sync job a policy with channels started: `savePolicy` and `createMembershipPolicy` return null when it had none. */
export function syncJobId(jobId: string | null): string {
    if (jobId === null) {
        throw new Error('The policy started no sync job: it has no channels');
    }
    return jobId;
}

export type NewPolicy = {
    name: string;

    // Rules in the table editor, or an expression in the CEL editor
    rules?: Rule[];
    cel?: string;
    channels?: Array<{id: string; name: string}>;

    // Auto-add members to every channel (the channel list's header checkbox)
    autoAdd?: boolean;
};

/** Creates a membership policy in the table editor; returns its sync job's id (null with no channels). */
export async function createMembershipPolicy(app: App, options: NewPolicy) {
    const policies = await openMembershipPolicies(app);
    await policies.addButton.click();
    const {policy} = app.admin.accessControl;
    await expect(policy.editPolicy.name.valueTextbox).toBeVisible();
    await policy.editPolicy.name.valueTextbox.fill(options.name);
    await expect(policy.editPolicy.name.valueTextbox).toHaveValue(options.name);
    for (const rule of options.rules ?? []) {
        await addRule(policy.rules, rule);
    }
    if (options.cel) {
        await setCelExpression(app, policy, options.cel);
    }
    if (options.channels?.length) {
        await addChannels(app, policy, options.channels);
        if (options.autoAdd) {
            await policy.channels.autoAddAllCheckbox.check();
            await expect(policy.channels.autoAddAllCheckbox).toBeChecked();
        }
    }
    return savePolicy(app, policy);
}

/** A policy editor with a table and a CEL editor: membership policies' and permission policies'. */
export {setCelExpression};

type PolicyEditor = Parameters<typeof setCelExpression>[1];

/**
 * Opens a policy's access test (the table editor's or the CEL editor's, whichever it shows) and checks who it lists:
 * every user expected, none of the others.
 */
export async function expectAccessTest(
    app: App,
    policy: PolicyEditor,
    {client, matching = [], notMatching = []}: {client: Client4; matching?: UserProfile[]; notMatching?: UserProfile[]},
) {
    // The policy opens in the table editor or the CEL editor; wait for whichever shows its test button
    let editor = 'none';
    await expect
        .poll(async () => {
            editor =
                ((await policy.rules.testButton.isVisible()) && 'table') ||
                ((await policy.cel.testButton.isVisible()) && 'cel') ||
                'none';
            return editor;
        })
        .not.toBe('none');
    const testButton = editor === 'table' ? policy.rules.testButton : policy.cel.testButton;
    await expect(testButton).toBeVisible();
    await expect(testButton).toBeEnabled();

    // the dialog lists who its expression matches as soon as it opens
    const listed = app.page.waitForRequest((r) => r.url().includes('/access_control_policies/cel/test'));
    await settle(testButton, {wait: Api.TestAccessControlPolicyExpression}).click();
    const {expression} = (await listed).postDataJSON() as {expression: string};
    const {users} = app.policyTestModal;
    await expect(users.searchTextbox).toBeVisible();

    // The test reads the server's attribute view, which refreshes on its own schedule and so can trail users just
    // given attributes (by design): wait until it lists them, then one search finds each
    if (matching.length) {
        await waitForAttributeViewToInclude(
            client,
            expression,
            matching.map((user) => user.id),
        );
    }
    for (const user of matching) {
        await users.searchTextbox.fill(user.username);
        await expect(users.user(user)).toBeVisible();
        await expect(users.user(user)).toContainText(`@${user.username}`);
    }
    for (const user of notMatching) {
        await users.searchTextbox.fill(user.username);
        await expect(users.noUsersText).toBeVisible();
        await expect(users.user(user)).toHaveCount(0);
    }
    await app.policyTestModal.closeButton.click();
    await expect(users.searchTextbox).not.toBeVisible();
}

/** Waits for a sync job to succeed (failing at once if it fails). */
export async function waitForSyncJob(client: Client4, jobId: string, timeout = 90_000) {
    await expect
        .poll(
            async () => {
                const job = await client.getJob(jobId);
                if (['error', 'canceled', 'cancel_requested'].includes(job.status)) {
                    throw new Error(`Sync job ${jobId} failed: ${job.status}`);
                }
                return job.status;
            },
            {timeout, intervals: [500, 1000, 2000], message: `sync job ${jobId} did not succeed`},
        )
        .toBe('success');
}

/** The id of the membership policy named `name` (exactly), once search lists it. */
export async function policyIdByName(client: Client4, name: string): Promise<string> {
    let id = '';
    await expect
        .poll(
            async () => {
                const result = await client.searchAccessControlPolicies(name, 'parent', '', 100);
                id = (result?.policies ?? []).find((p) => p.name === name)?.id ?? '';
                return id;
            },
            {timeout: duration.half_min, message: `policy ${name} not found`},
        )
        .not.toBe('');
    return id;
}

/** Runs the membership policies' sync job from their page; returns the job's id. */
export async function runSyncJob(app: App): Promise<string> {
    await openMembershipPolicies(app);
    const job = await settle(app.admin.accessControl.runSyncButton, {wait: Api.CreateJob}).click();
    return job.id;
}

/** Opens System Console > Permission Policies, waiting for its list. */
export async function openPermissionPolicies(app: App): Promise<App['admin']['permissionPolicies']> {
    await app.page.goto(PERMISSION_POLICIES_PATH);
    const list = app.admin.permissionPolicies;
    await expect(list.addButton).toBeVisible();
    return list;
}

export type NewPermissionPolicy = {
    name: string;
    cel: string;
    permissions: Permission[];

    // Who it applies to; members (system_user) when left out
    role?: Role;
};

/** Creates a permission policy (its rule in the CEL editor), returning to the list. */
export async function createPermissionPolicy(
    app: App,
    options: NewPermissionPolicy,
): Promise<App['admin']['permissionPolicies']> {
    const list = await openPermissionPolicies(app);
    await list.addButton.click();
    await expect(list.edit.name.valueTextbox).toBeVisible();
    await list.edit.name.valueTextbox.fill(options.name);
    await expect(list.edit.name.valueTextbox).toHaveValue(options.name);
    const policy = app.admin.permissionPolicy;
    if (options.role) {
        await policy.roleButton.click();
        await expect(policy.roleMenu.role(options.role)).toBeVisible();
        await policy.roleMenu.role(options.role).click();
        await expect(policy.roleMenu.role(options.role)).not.toBeVisible();
    }
    await setCelExpression(app, policy, options.cel);
    for (const permission of options.permissions) {
        await policy.addPermissionButton.click();
        await expect(policy.permissionMenu.permission(permission)).toBeVisible();
        await policy.permissionMenu.permission(permission).click();
        await expect(policy.permissionMenu.permission(permission)).not.toBeVisible();
    }
    await settle(app.admin.saveButton, {wait: Api.CreateAccessControlPolicy}).click();
    await expect(app.page).toHavePath(PERMISSION_POLICIES_PATH);
    return list;
}

/** The id of the permission policy named `name` (exactly), once search lists it. */
export async function permissionPolicyIdByName(client: Client4, name: string): Promise<string> {
    let id = '';
    await expect
        .poll(
            async () => {
                const result = await client.searchPermissionPolicies(name, '', 100);
                id = (result?.policies ?? []).find((p) => p.name === name)?.id ?? '';
                return id;
            },
            {timeout: duration.half_min, message: `permission policy ${name} not found`},
        )
        .not.toBe('');
    return id;
}
