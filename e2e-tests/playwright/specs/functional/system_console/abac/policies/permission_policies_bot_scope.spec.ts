// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Bot} from '@mattermost/types/bots';
import type {UserProfile} from '@mattermost/types/users';

import {
    expect,
    test,
    enableABAC,
    getAdminClient,
    getFileFromAsset,
    getRandomId,
    newTestPassword,
    PlaywrightClient4,
    testConfig,
} from '@mattermost/playwright-lib';

import {
    createPermissionPolicy,
    createPrivateChannelForABAC,
    createUserAttributeField,
    getPolicyIdByName,
    navigateToPermissionPoliciesPage,
} from '../support';
import {ensureABACEnabled, waitForPolicy} from '../file_access/helpers';

const ABAC_UPLOAD_DENIED = 'api.file.upload_file.abac_denied.app_error';
const WRAPPER_PREFIX = '!user.isbot || ';

type UploadResult = {status: number; errorId?: string};

async function uploadStatus(client: Client4, channelId: string): Promise<UploadResult> {
    const formData = new FormData();
    formData.set('channel_id', channelId);
    formData.set('client_ids', getRandomId());
    formData.set('files', getFileFromAsset('sample_text_file.txt'), 'sample_text_file.txt');
    try {
        await client.uploadFile(formData);
        return {status: 201};
    } catch (error: any) {
        return {status: error?.status_code, errorId: error?.server_error_id};
    }
}

function tokenClient(token: string): PlaywrightClient4 {
    const client = new PlaywrightClient4();
    client.setUrl(testConfig.baseURL);
    client.setToken(token);
    return client;
}

async function botTokenClient(adminClient: Client4, botUserId: string): Promise<PlaywrightClient4> {
    const {token} = await adminClient.createUserAccessToken(botUserId, 'e2e');
    if (!token) {
        throw new Error(`No access token returned for bot ${botUserId}`);
    }
    return tokenClient(token);
}

async function policyLookupStatus(client: Client4, policyId: string): Promise<number | undefined> {
    try {
        await client.getAccessControlPolicy(policyId);
        return 200;
    } catch (error: any) {
        return error?.status_code;
    }
}

async function expectUploadEventually(client: Client4, channelId: string, expected: UploadResult) {
    await expect
        .poll(() => uploadStatus(client, channelId), {timeout: 30_000, intervals: [500, 1000, 2000]})
        .toEqual(expected);
}

// Test 2 enforces the policy that test 1 creates through the UI, so the tests run serially.
test.describe('Permission Policies - Bot accounts scope', () => {
    test.describe.configure({mode: 'serial'});

    let adminClient: Client4;
    let adminUser: UserProfile;
    let licensed = true;
    let fieldId = '';
    let fieldName = '';
    let channelId = '';
    let humanClient: PlaywrightClient4;
    let botWith: Bot;
    let botWithout: Bot;
    let botWithClient: PlaywrightClient4;
    let botWithoutClient: PlaywrightClient4;
    let policyName = '';
    let policyId = '';

    test.beforeAll(async () => {
        test.setTimeout(240_000);

        const admin = await getAdminClient();
        if (!admin.adminUser) {
            throw new Error('Admin user not found — cannot proceed with Bot accounts policy tests');
        }
        adminClient = admin.adminClient;
        adminUser = admin.adminUser;

        const lic = await adminClient.getClientLicenseOld();
        if (lic?.IsLicensed !== 'true') {
            licensed = false;
            return;
        }

        await adminClient.patchConfig({
            ServiceSettings: {EnableBotAccountCreation: true, EnableUserAccessTokens: true},
            AccessControlSettings: {EnableAttributeBasedAccessControl: true, EnableUserManagedAttributes: true},
        } as any);
        await ensureABACEnabled(adminClient);

        fieldName = `BotClearance${getRandomId()}`;
        const field = await createUserAttributeField(adminClient, fieldName);
        fieldId = field.id;
        expect(fieldId).toBeTruthy();

        await expect
            .poll(async () => (await adminClient.getAccessControlFields('', 100)).some((f) => f.name === fieldName), {
                timeout: 30_000,
            })
            .toBe(true);

        const team = await adminClient.createTeam({
            name: `bot-scope-${getRandomId()}`,
            display_name: 'Bot Scope',
            type: 'O',
        } as any);
        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        channelId = channel.id;

        const username = `human${getRandomId()}`;
        const password = newTestPassword();
        const human = await adminClient.createUser(
            {email: `${username}@example.com`, username, password} as any,
            '',
            '',
        );
        await adminClient.addToTeam(team.id, human.id);
        await adminClient.addToChannel(human.id, channelId);
        humanClient = new PlaywrightClient4();
        humanClient.setUrl(testConfig.baseURL);
        await humanClient.login(username, password);

        botWith = await adminClient.createBot({username: `botwith${getRandomId()}`, display_name: 'Bot With'});
        botWithout = await adminClient.createBot({username: `botwithout${getRandomId()}`, display_name: 'Bot Without'});
        for (const bot of [botWith, botWithout]) {
            await adminClient.addToTeam(team.id, bot.user_id);
            await adminClient.addToChannel(bot.user_id, channelId);
        }

        await adminClient.updateUserCustomProfileAttributesValues(botWith.user_id, {[fieldId]: 'Secret'});

        botWithClient = await botTokenClient(adminClient, botWith.user_id);
        botWithoutClient = await botTokenClient(adminClient, botWithout.user_id);

        const baselineMessage = 'baseline upload must succeed before the Bot accounts policy exists';
        expect(await uploadStatus(humanClient, channelId), baselineMessage).toEqual({status: 201});
        expect(await uploadStatus(botWithClient, channelId), baselineMessage).toEqual({status: 201});
        expect(await uploadStatus(botWithoutClient, channelId), baselineMessage).toEqual({status: 201});
    });

    test.beforeEach(async () => {
        test.skip(!licensed, 'No ABAC license');
        await ensureABACEnabled(adminClient);
    });

    test.afterAll(async () => {
        if (!adminClient) {
            return;
        }
        await ensureABACEnabled(adminClient).catch(() => {});

        for (const bot of [botWith, botWithout]) {
            if (bot?.user_id) {
                await adminClient.disableBot(bot.user_id).catch(() => {});
            }
        }

        let id = policyId;
        if (!id && policyName) {
            const candidate = await getPolicyIdByName(adminClient, policyName, 1);
            if (candidate) {
                const policy = await adminClient.getAccessControlPolicy(candidate).catch(() => null);
                if (policy?.name === policyName) {
                    id = candidate;
                }
            }
        }

        // A policy whose field is deleted first becomes masked and undeletable, so the field is only
        // deleted once a 404 proves the policy is gone. Any other outcome fails here and keeps the field.
        if (id) {
            await adminClient.deleteAccessControlPolicy(id).catch(() => {});
            await expect
                .poll(() => policyLookupStatus(adminClient, id), {
                    timeout: 15_000,
                    message: `policy ${id} was not confirmed deleted; keeping field ${fieldName} (${fieldId})`,
                })
                .toBe(404);
        }
        if (fieldId) {
            await adminClient.deleteCustomProfileAttributeField(fieldId).catch(() => {});
        }
    });

    /**
     * @objective Verify a sysadmin can create a Bot accounts permission policy in the System Console,
     * that it is stored as a bot-guarded system_user rule flagged with props.bot_scope, listed as "Bot accounts", and reopens
     * in the table editor with the guard hidden.
     *
     * @precondition
     * An Enterprise Advanced license, attribute-based access control enabled, and a custom user attribute field
     */
    test(
        'creates a Bot accounts policy, lists it as Bot accounts, and reopens it unwrapped',
        {tag: '@abac_permission_policies'},
        async ({pw}) => {
            test.setTimeout(pw.duration.four_min);

            // # Log in as sysadmin and open Permission Policies
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await enableABAC(page);
            await ensureABACEnabled(adminClient);
            await navigateToPermissionPoliciesPage(page);

            // # Create a Bot accounts policy granting Upload Files to bots with the attribute
            policyName = `PP Bot Scope ${getRandomId()}`;
            const typedRule = `user.attributes.${fieldName} == "Secret"`;
            await createPermissionPolicy(page, {
                name: policyName,
                role: 'bot',
                celExpression: typedRule,
                permissions: ['Upload Files'],
                adminClient,
            });

            await waitForPolicy(adminClient, policyName);
            policyId = (await getPolicyIdByName(adminClient, policyName))!;
            expect(policyId).toBeTruthy();

            // * Verify the stored policy is a system_user rule wrapped with the bot guard and flagged with props.bot_scope
            const stored = await adminClient.getAccessControlPolicy(policyId);
            expect(stored.name).toBe(policyName);
            expect(stored.roles).toEqual(['system_user']);
            expect(stored.rules?.length).toBe(1);
            expect(stored.rules![0].expression.startsWith(WRAPPER_PREFIX)).toBe(true);
            expect(stored.rules![0].expression).toContain(typedRule);
            expect(stored.rules![0].actions).toEqual(['upload_file_attachment']);
            expect(stored.props?.bot_scope).toBe(true);

            // * Verify the list shows the policy as Bot accounts, not Members
            await navigateToPermissionPoliciesPage(page);
            await page.getByPlaceholder('Search').fill(policyName);
            const row = page.locator('.DataGrid_row').filter({hasText: policyName});
            await expect(row).toBeVisible({timeout: 15_000});
            await expect(row.getByText('Bot accounts', {exact: true})).toBeVisible();
            await expect(row.getByText('Members', {exact: true})).toHaveCount(0);
            await expect(row.getByText('Upload Files')).toBeVisible();

            // # Reopen the policy
            await row.locator('.policy-name').click();
            await expect(page).toHaveURL(new RegExp(`/permission_policies/edit_policy/${policyId}`));
            await page.waitForLoadState('networkidle');

            // * Verify the details page shows the Bot accounts scope and the unwrapped rule in table mode
            await expect(page.locator('#pp-role-selector-btn')).toContainText('Bot accounts');
            const table = page.getByTestId('table-editor');
            await expect(table).toBeVisible({timeout: 15_000});
            await expect(table.locator('.table-editor__row')).toHaveCount(1);
            await expect(page.locator('#attribute-selector-button-0')).toContainText(fieldName);
            await expect(
                table.locator('.table-editor__row').first().locator('.values-editor__simple-input'),
            ).toHaveValue('Secret');
            await expect(page.getByText('!user.isbot')).toHaveCount(0);

            // * Verify simulation is available for a Bot accounts policy
            await expect(page.getByRole('button', {name: 'Simulate rules'})).toBeEnabled();

            // * Verify Bot accounts is the last role option
            await page.locator('#pp-role-selector-btn').click();
            const options = page.locator('[id^="pp-role-option-"]');
            await expect(options.last()).toHaveAttribute('id', 'pp-role-option-bot');
            await page.keyboard.press('Escape');

            // # Switch to Advanced Mode
            await page.getByRole('button', {name: 'Switch to Advanced Mode'}).click();

            // * Verify the CEL editor shows the unwrapped rule without the bot guard
            const editorLines = page.locator('.monaco-editor .view-lines').first();
            await expect(editorLines).toBeVisible({timeout: 10_000});
            await expect(editorLines).toContainText(fieldName);
            await expect(editorLines).not.toContainText('isbot');

            // # Leave without saving
            await page.goto('/admin_console/system_attributes/permission_policies');
        },
    );

    /**
     * @objective Verify a saved Bot accounts policy constrains only bots on file upload: humans are
     * unaffected, a bot with the attribute is allowed, and a bot without it is denied by ABAC.
     *
     * @precondition
     * The Bot accounts policy created by the previous test, and bot personal access tokens
     */
    test(
        'enforces the Bot accounts policy on file upload: human allowed, bot with attribute allowed, bot without denied',
        {tag: '@abac_permission_policies'},
        async ({pw}) => {
            test.setTimeout(pw.duration.two_min);
            test.skip(!policyId, 'policy from the UI test is missing');

            const denied = {status: 403, errorId: ABAC_UPLOAD_DENIED};
            const allowed = {status: 201};

            // # Upload a file to the channel as each bot and the human through the API
            // * Verify the bot without the attribute is denied once the policy is live
            await expectUploadEventually(botWithoutClient, channelId, denied);

            // * Verify the bot with the attribute and the human can still upload
            await expectUploadEventually(botWithClient, channelId, allowed);
            await expectUploadEventually(humanClient, channelId, allowed);

            // * Verify each decision is stable on a repeat upload
            expect(await uploadStatus(botWithoutClient, channelId)).toEqual(denied);
            expect(await uploadStatus(botWithClient, channelId)).toEqual(allowed);
            expect(await uploadStatus(humanClient, channelId)).toEqual(allowed);
        },
    );
});
