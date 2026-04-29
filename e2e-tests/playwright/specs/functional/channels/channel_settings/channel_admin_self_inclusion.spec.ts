// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Channel Settings → Access Control regression test for the
 * "Test access rule" results for top-level OR rules.
 * @reference MM-68538
 */

import {Client4} from '@mattermost/client';
import type {Page} from '@playwright/test';
import type {UserPropertyField} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

import {ChannelsPage, expect, newTestPassword, test} from '@mattermost/playwright-lib';

const PROGRAM_OPTIONS = [
    {name: 'Artemis', color: '#FF8800'},
    {name: 'Helios', color: '#00AAFF'},
];

// CEL the table editor emits for `<field> has any of [Artemis, Helios]`.
// See rowToCEL() in webapp/.../table_editor/table_editor.tsx.
function buildTwoValueOrExpression(attributeName: string): string {
    return `("Artemis" in user.attributes.${attributeName} || "Helios" in user.attributes.${attributeName})`;
}

function buildAliceExcludingExpression(attributeName: string): string {
    return `"Helios" in user.attributes.${attributeName}`;
}

type ProgramField = {
    id: string;
    optionIdByName: Record<string, string>;
};

// Create a multiselect CPA field directly via the REST API.
async function ensureProgramMultiselectField(adminClient: Client4, fieldName: string): Promise<ProgramField> {
    const baseRoute = `${adminClient.getBaseRoute()}/custom_profile_attributes/fields`;

    const created: UserPropertyField = await (adminClient as any).doFetch(baseRoute, {
        method: 'POST',
        body: JSON.stringify({
            name: fieldName,
            type: 'multiselect',
            attrs: {
                managed: 'admin',
                visibility: 'when_set',
                options: PROGRAM_OPTIONS,
            },
        }),
    });

    const options: Array<{id: string; name: string}> =
        ((created as any)?.attrs?.options as Array<{id: string; name: string}>) ?? [];
    const optionIdByName: Record<string, string> = {};
    for (const opt of options) {
        optionIdByName[opt.name] = opt.id;
    }
    for (const expected of PROGRAM_OPTIONS) {
        if (!optionIdByName[expected.name]) {
            throw new Error(
                `Multiselect field "${fieldName}" was created without an id for option "${expected.name}"; ` +
                    `got: ${JSON.stringify(options)}`,
            );
        }
    }

    return {id: created.id, optionIdByName};
}

async function createUserWithProgram(
    adminClient: Client4,
    programField: ProgramField,
    program: string[],
    teamId: string,
    prefix: string,
): Promise<UserProfile> {
    const password = newTestPassword();
    const id = Math.random().toString(36).substring(2, 9);
    const user = await adminClient.createUser(
        {
            email: `${prefix}-${id}@sample.mattermost.com`,
            username: `${prefix}${id}`,
            password,
        } as UserProfile,
        '',
        '',
    );
    user.password = password;

    // Multiselect values must be sent as option IDs not names.
    const optionIds = program.map((name) => {
        const optionId = programField.optionIdByName[name];
        if (!optionId) {
            throw new Error(`Program option "${name}" not found in field options`);
        }
        return optionId;
    });
    await adminClient.updateUserCustomProfileAttributesValues(user.id, {[programField.id]: optionIds});

    // Suppress tutorials/onboarding so UI navigation is stable.
    await adminClient.savePreferences(user.id, [
        {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
        {user_id: user.id, category: 'onboarding_task_list', name: 'onboarding_task_list_show', value: 'false'},
        {user_id: user.id, category: 'onboarding_task_list', name: 'onboarding_task_list_open', value: 'false'},
    ]);

    await adminClient.addToTeam(teamId, user.id);
    return user;
}

async function createChannelAccessRule(
    adminClient: Client4,
    channel: {id: string; display_name: string},
    expression: string,
) {
    await (adminClient as any).doFetch(`${adminClient.getBaseRoute()}/access_control_policies`, {
        method: 'PUT',
        body: JSON.stringify({
            id: channel.id,
            name: channel.display_name,
            type: 'channel',
            active: false,
            revision: 1,
            created_at: Date.now(),
            rules: [{actions: ['membership'], expression}],
            imports: [],
        }),
    });
}

async function openAccessControlSettings(channelsPage: ChannelsPage) {
    const channelSettings = await channelsPage.openChannelSettings();
    const accessControlTab = channelSettings.container.getByRole('tab', {name: /Membership Policy/i});
    await expect(accessControlTab).toBeVisible({timeout: 10000});
    await accessControlTab.click();

    return channelSettings;
}

async function verifyTestAccessRuleDisabled(page: Page) {
    await expect(page.getByRole('button', {name: /Test access rule/i})).toBeDisabled({timeout: 10000});
}

async function testAccessRuleAndVerifyUser(page: Page, username: string) {
    const testButton = page.getByRole('button', {name: /Test access rule/i});
    await expect(testButton).toBeEnabled({timeout: 10000});
    await testButton.click();

    const modal = page.locator('.TestResultsModal').filter({hasText: 'Access Rule Test Results'});
    await expect(modal).toBeVisible({timeout: 10000});

    await modal.getByRole('textbox', {name: /Search users/i}).fill(username);
    await expect(modal.getByText(`@${username}`)).toBeVisible({timeout: 10000});
}

test.describe('Channel Settings → Membership Policy', () => {
    test('MM-68538 channel admin can test access rule for multiselect "has any of" with multiple values', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();

        // Enable ABAC + user-managed attributes so the Membership Policy tab and
        // the test access rule flow are available.
        await adminClient.patchConfig({
            AccessControlSettings: {
                EnableAttributeBasedAccessControl: true,
                EnableUserManagedAttributes: true,
            },
        });

        // CPA name must be a valid CEL identifier segment; keep alphanumeric + underscore.
        const programFieldName = `Program_mm68538_${Math.random().toString(36).substring(2, 14)}`;
        const programField = await ensureProgramMultiselectField(adminClient, programFieldName);

        const aliceExcludingExpression = buildAliceExcludingExpression(programFieldName);
        const twoValueOrExpression = buildTwoValueOrExpression(programFieldName);

        // Several users matching the OR. Without the fix, SearchUsers ordered
        // by Users.Id ASC would return whichever of the matching users has the
        // lowest Id, so populating multiple matches makes the assertion robust
        // regardless of which Id alice ends up with.
        const alice = await createUserWithProgram(adminClient, programField, ['Artemis'], team.id, 'alice');
        await createUserWithProgram(adminClient, programField, ['Helios'], team.id, 'bob');
        await createUserWithProgram(adminClient, programField, ['Artemis'], team.id, 'carol');

        // Private channel where alice is the channel admin and the only one
        // with the manage_channel_access_rules permission. Bob/carol exist
        // purely to populate the OR-matching candidate set.
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `mm68538-${Math.random().toString(36).substring(2, 8)}`,
            display_name: `MM-68538 ${Math.random().toString(36).substring(2, 6)}`,
            type: 'P',
        } as any);
        await adminClient.addToChannel(alice.id, channel.id);
        await adminClient.updateChannelMemberSchemeRoles(channel.id, alice.id, true, true);

        await createChannelAccessRule(adminClient, channel, aliceExcludingExpression);

        // Alice can open Channel Settings → Membership Policy as channel admin
        // and test the existing rule through the same UI users exercise.
        const {page} = await pw.testBrowser.login(alice);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const excludingRuleSettings = await openAccessControlSettings(channelsPage);
        await verifyTestAccessRuleDisabled(page);
        await excludingRuleSettings.close();

        await createChannelAccessRule(adminClient, channel, twoValueOrExpression);

        const includingRuleSettings = await openAccessControlSettings(channelsPage);
        await testAccessRuleAndVerifyUser(page, alice.username);

        await includingRuleSettings.close();
    });
});
