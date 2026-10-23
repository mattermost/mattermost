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
const ABAC_DOWNLOAD_DENIED = 'api.file.get_file.abac_denied.app_error';
const DOWNLOAD_ACTION = 'download_file_attachment';

type ApiResult = {status: number; errorId?: string};

async function uploadStatus(client: Client4, channelId: string): Promise<ApiResult> {
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

async function downloadStatus(client: Client4, fileId: string): Promise<ApiResult> {
    const response = await fetch(client.getFileUrl(fileId, 0), {
        headers: {Authorization: `Bearer ${client.getToken()}`},
    });
    if (response.ok) {
        await response.body?.cancel();
        return {status: response.status};
    }
    const body = await response.json().catch(() => null);
    return {status: response.status, errorId: body?.id};
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

async function createDownloadPolicy(
    adminClient: Client4,
    options: {name: string; role: 'system_user' | 'system_bot'; expression: string},
): Promise<string> {
    const saved = await adminClient.updateOrCreateAccessControlPolicy({
        id: '',
        name: options.name,
        type: 'permission',
        active: true,
        revision: 1,
        version: 'v0.3',
        roles: [options.role],
        imports: [],
        rules: [{actions: [DOWNLOAD_ACTION], expression: options.expression}],
        props: {},
    });
    return saved.id;
}

async function expectEventually(probe: () => Promise<ApiResult>, expected: ApiResult) {
    await expect.poll(probe, {timeout: 30_000, intervals: [500, 1000, 2000]}).toEqual(expected);
}

// Tests 2 and 3 rely on the Bot accounts upload policy that test 1 creates through the UI, so the tests run serially.
// Test 3 also creates its own download policies and reuses the shared bots, human, channel, and file.
test.describe('Permission Policies - Bot accounts scope', () => {
    test.describe.configure({mode: 'serial'});

    let adminClient: Client4;
    let adminUser: UserProfile;
    let fieldId = '';
    let fieldName = '';
    let channelId = '';
    let fileId = '';
    let humanClient: PlaywrightClient4;
    let botSecret: Bot;
    let botMember: Bot;
    let botSecretClient: PlaywrightClient4;
    let botMemberClient: PlaywrightClient4;
    let policyName = '';
    let policyId = '';
    const downloadPolicyIds: string[] = [];

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

        botSecret = await adminClient.createBot({username: `botsecret${getRandomId()}`, display_name: 'Bot Secret'});
        botMember = await adminClient.createBot({username: `botmember${getRandomId()}`, display_name: 'Bot Member'});
        for (const bot of [botSecret, botMember]) {
            await adminClient.addToTeam(team.id, bot.user_id);
            await adminClient.addToChannel(bot.user_id, channelId);
        }

        await adminClient.updateUserCustomProfileAttributesValues(botSecret.user_id, {[fieldId]: 'Secret'});
        await adminClient.updateUserCustomProfileAttributesValues(botMember.user_id, {[fieldId]: 'Member'});
        expect(await adminClient.getUserCustomProfileAttributesValues(botSecret.user_id)).toMatchObject({
            [fieldId]: 'Secret',
        });
        expect(await adminClient.getUserCustomProfileAttributesValues(botMember.user_id)).toMatchObject({
            [fieldId]: 'Member',
        });

        botSecretClient = await botTokenClient(adminClient, botSecret.user_id);
        botMemberClient = await botTokenClient(adminClient, botMember.user_id);

        const fileForm = new FormData();
        fileForm.set('channel_id', channelId);
        fileForm.set('client_ids', getRandomId());
        fileForm.set('files', getFileFromAsset('sample_text_file.txt'), 'sample_text_file.txt');
        const {file_infos: fileInfos} = await adminClient.uploadFile(fileForm);
        fileId = fileInfos[0].id;
        await adminClient.createPost({
            channel_id: channelId,
            message: 'Bot accounts download fixture',
            file_ids: [fileId],
        });

        const baselineUpload = 'baseline upload must succeed before the Bot accounts policy exists';
        expect(await uploadStatus(humanClient, channelId), baselineUpload).toEqual({status: 201});
        expect(await uploadStatus(botSecretClient, channelId), baselineUpload).toEqual({status: 201});
        expect(await uploadStatus(botMemberClient, channelId), baselineUpload).toEqual({status: 201});

        const baselineDownload = 'baseline download must succeed before any download policy exists';
        expect(await downloadStatus(humanClient, fileId), baselineDownload).toEqual({status: 200});
        expect(await downloadStatus(botSecretClient, fileId), baselineDownload).toEqual({status: 200});
        expect(await downloadStatus(botMemberClient, fileId), baselineDownload).toEqual({status: 200});
    });

    test.beforeEach(async ({pw}) => {
        await pw.skipIfNoLicense();
        await ensureABACEnabled(adminClient);
    });

    test.afterAll(async () => {
        test.setTimeout(120_000);
        if (!adminClient) {
            return;
        }
        await ensureABACEnabled(adminClient).catch(() => {});

        for (const bot of [botSecret, botMember]) {
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
        // deleted once a 404 proves every policy is gone. Any other outcome fails here and keeps the field.
        const ids = [id, ...downloadPolicyIds].filter(Boolean);
        for (const pid of ids) {
            await adminClient.deleteAccessControlPolicy(pid).catch(() => {});
        }
        for (const pid of ids) {
            await expect
                .poll(() => policyLookupStatus(adminClient, pid), {
                    timeout: 15_000,
                    message: `policy ${pid} was not confirmed deleted; keeping field ${fieldName} (${fieldId})`,
                })
                .toBe(404);
        }
        if (fieldId) {
            await adminClient.deleteCustomProfileAttributeField(fieldId).catch(() => {});
        }
    });

    /**
     * @objective Verify a sysadmin can create a Bot accounts permission policy in the System Console,
     * that it is stored as a system_bot policy with the plain expression, listed as "Bot accounts", and
     * reopens in the table editor.
     *
     * @precondition
     * An Enterprise Advanced license, attribute-based access control enabled, and a custom user attribute field
     */
    test(
        'creates a Bot accounts policy stored as system_bot, lists it as Bot accounts, and reopens it',
        {tag: '@abac_permission_policies'},
        async ({pw}) => {
            test.setTimeout(pw.duration.four_min);

            // # Log in as sysadmin and open Permission Policies
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await enableABAC(page);
            await ensureABACEnabled(adminClient);
            await navigateToPermissionPoliciesPage(page);

            // # Create a Bot accounts policy granting Upload Files to bots holding "Secret"
            policyName = `PP Bot Scope ${getRandomId()}`;
            const typedRule = `user.attributes.${fieldName} == "Secret"`;
            await createPermissionPolicy(page, {
                name: policyName,
                role: 'system_bot',
                celExpression: typedRule,
                permissions: ['Upload Files'],
                adminClient,
            });

            await waitForPolicy(adminClient, policyName);
            policyId = (await getPolicyIdByName(adminClient, policyName))!;
            expect(policyId).toBeTruthy();

            // * Verify the stored policy uses the system_bot role and the plain expression
            const stored = await adminClient.getAccessControlPolicy(policyId);
            expect(stored.name).toBe(policyName);
            expect(stored.roles).toEqual(['system_bot']);
            expect(stored.rules?.length).toBe(1);
            expect(stored.rules![0].expression.trim()).toBe(typedRule);
            expect(stored.rules![0].actions).toEqual(['upload_file_attachment']);
            expect(stored.props?.bot_scope).toBeUndefined();

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

            // * Verify the details page shows the Bot accounts scope and the rule in table mode
            await expect(page.locator('#pp-role-selector-btn')).toContainText('Bot accounts');
            const table = page.getByTestId('table-editor');
            await expect(table).toBeVisible({timeout: 15_000});
            await expect(table.locator('.table-editor__row')).toHaveCount(1);
            await expect(page.locator('#attribute-selector-button-0')).toContainText(fieldName);
            await expect(
                table.locator('.table-editor__row').first().locator('.values-editor__simple-input'),
            ).toHaveValue('Secret');

            // * Verify simulation is available for a Bot accounts policy
            await expect(page.getByRole('button', {name: 'Simulate rules'})).toBeEnabled();

            // * Verify Bot accounts is the last role option
            await page.locator('#pp-role-selector-btn').click();
            const options = page.locator('[id^="pp-role-option-"]');
            await expect(options.last()).toHaveAttribute('id', 'pp-role-option-system_bot');
            await page.keyboard.press('Escape');

            // # Switch to Advanced Mode
            await page.getByRole('button', {name: 'Switch to Advanced Mode'}).click();

            // * Verify the CEL editor shows the stored rule
            const editorLines = page.locator('.monaco-editor .view-lines').first();
            await expect(editorLines).toBeVisible({timeout: 10_000});
            await expect(editorLines).toContainText(fieldName);

            // # Leave without saving
            await page.goto('/admin_console/system_attributes/permission_policies');
        },
    );

    /**
     * @objective Verify a saved Bot accounts policy constrains only bots on file upload: humans are
     * unaffected, botSecret ("Secret") is allowed, and botMember ("Member") is denied by ABAC.
     *
     * @precondition
     * The Bot accounts policy created by the previous test, no Members upload policy, botSecret holding "Secret" and
     * botMember holding "Member", and bot personal access tokens
     */
    test(
        'enforces the Bot accounts policy on file upload: human allowed, bot with "Secret" allowed, bot with "Member" denied',
        {tag: '@abac_permission_policies'},
        async ({pw}) => {
            test.setTimeout(pw.duration.two_min);
            test.skip(!policyId, 'policy from the UI test is missing');

            const denied = {status: 403, errorId: ABAC_UPLOAD_DENIED};
            const allowed = {status: 201};

            // # Upload a file to the channel as each bot and the human through the API
            // * Verify botMember is denied once the policy is live
            await expectEventually(() => uploadStatus(botMemberClient, channelId), denied);

            // * Verify botSecret and the human can still upload
            await expectEventually(() => uploadStatus(botSecretClient, channelId), allowed);
            await expectEventually(() => uploadStatus(humanClient, channelId), allowed);

            // * Verify each decision is stable on a repeat upload
            expect(await uploadStatus(botMemberClient, channelId)).toEqual(denied);
            expect(await uploadStatus(botSecretClient, channelId)).toEqual(allowed);
            expect(await uploadStatus(humanClient, channelId)).toEqual(allowed);
        },
    );

    /**
     * @objective Verify Bot accounts policies apply per permission: with no Bot accounts download policy,
     * bots are evaluated against the Members download policy (the bot passing it downloads, the bot failing
     * it is denied). Once a Bot accounts download policy exists it replaces the Members policy for bots: the
     * bot passing only the Bot accounts rule downloads, the bot passing only the Members rule is denied, and a
     * human failing the Members rule is still denied.
     *
     * @precondition
     * The Bot accounts upload policy created by the first test, botSecret holding "Secret" and botMember holding
     * "Member", a server paired with the enterprise build that resolves system_bot policies, and bot personal
     * access tokens
     */
    test(
        'falls back to Members for bots without a Bot accounts download policy, then lets a bot that passes one download',
        {tag: '@abac_permission_policies'},
        async ({pw}) => {
            test.setTimeout(pw.duration.two_min);
            test.skip(!policyId, 'Bot accounts upload policy from the UI test is missing');

            const suffix = getRandomId();
            const denied = {status: 403, errorId: ABAC_DOWNLOAD_DENIED};
            const allowed = {status: 200};

            // # Create a Members download policy that only botMember ("Member") satisfies
            downloadPolicyIds.push(
                await createDownloadPolicy(adminClient, {
                    name: `PP Members Download ${suffix}`,
                    role: 'system_user',
                    expression: `user.attributes.${fieldName} == "Member"`,
                }),
            );

            // * Verify the human failing the Members policy is denied once it is live
            await expectEventually(() => downloadStatus(humanClient, fileId), denied);

            // * Verify bots with no Bot accounts download policy are evaluated against the Members policy
            await expectEventually(() => downloadStatus(botSecretClient, fileId), denied);
            await expectEventually(() => downloadStatus(botMemberClient, fileId), allowed);

            // # Create a Bot accounts download policy that only botSecret ("Secret") satisfies
            downloadPolicyIds.push(
                await createDownloadPolicy(adminClient, {
                    name: `PP Bot Download ${suffix}`,
                    role: 'system_bot',
                    expression: `user.attributes.${fieldName} == "Secret"`,
                }),
            );

            // * Verify botSecret downloads although it fails the Members policy
            await expectEventually(() => downloadStatus(botSecretClient, fileId), allowed);

            // * Verify botMember is denied although it passes the Members policy, so Members no longer applies to bots
            await expectEventually(() => downloadStatus(botMemberClient, fileId), denied);

            // * Verify each decision is stable on a repeat download
            expect(await downloadStatus(humanClient, fileId)).toEqual(denied);
            expect(await downloadStatus(botMemberClient, fileId)).toEqual(denied);
            expect(await downloadStatus(botSecretClient, fileId)).toEqual(allowed);
        },
    );
});
