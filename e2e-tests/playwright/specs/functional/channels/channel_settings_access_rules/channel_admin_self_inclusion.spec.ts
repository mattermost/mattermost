// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Channel Settings → Access Control regression test for the
 * top-level OR self-exclusion bug.
 * @reference MM-68538
 */

import {Client4} from '@mattermost/client';
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

// CEL for `has any of [Artemis]` (single disjunct, no top-level OR).
function buildSingleValueExpression(attributeName: string): string {
    return `"Artemis" in user.attributes.${attributeName}`;
}

// CEL that excludes alice (sanity check for the assertion direction).
function buildNonMatchingOrExpression(attributeName: string): string {
    return `("DoesNotMatch1" in user.attributes.${attributeName} || "DoesNotMatch2" in user.attributes.${attributeName})`;
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

test.describe('Channel Settings → Access Control', () => {
    test('MM-68538 channel admin can test access rule for multiselect "has any of" with multiple values', async ({pw}) => {
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();

        // Enable ABAC + user-managed attributes so the Access Control tab and
        // the validate_requester endpoint are available.
        await adminClient.patchConfig({
            AccessControlSettings: {
                EnableAttributeBasedAccessControl: true,
                EnableUserManagedAttributes: true,
            },
        });

        // CPA name must be a valid CEL identifier segment; keep alphanumeric + underscore.
        const programFieldName = `Program_mm68538_${Math.random().toString(36).substring(2, 14)}`;
        const programField = await ensureProgramMultiselectField(adminClient, programFieldName);

        const singleValueExpression = buildSingleValueExpression(programFieldName);
        const twoValueOrExpression = buildTwoValueOrExpression(programFieldName);
        const nonMatchingExpression = buildNonMatchingOrExpression(programFieldName);

        // Several users matching the OR. Without the fix, SearchUsers ordered
        // by Users.Id ASC would return whichever of the matching users has the
        // lowest Id, so populating multiple matches makes the assertion robust
        // regardless of which Id alice ends up with.
        const alice = await createUserWithProgram(adminClient, programField, ['Artemis'], team.id, 'alice');
        const bob = await createUserWithProgram(adminClient, programField, ['Helios'], team.id, 'bob');
        const carol = await createUserWithProgram(adminClient, programField, ['Artemis'], team.id, 'carol');

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

        // Sanity-check that bob and carol exist on the server (referenced
        // implicitly via the OR query); silences the unused-var lint without
        // adding noisy assertions to the test.
        expect(bob.id).toBeTruthy();
        expect(carol.id).toBeTruthy();

        // Authenticate alice via the API so we can call the same endpoint the
        // table editor uses for its self-exclusion check.
        const {client: aliceClient} = await pw.makeClient(
            {username: alice.username, password: alice.password!},
            {useCache: false},
        );

        // Single-value rule: Used here as a baseline so a future regression that
        // breaks the channel-admin code path entirely doesn't pass silently.
        const singleValueResult = await aliceClient.validateExpressionAgainstRequester(
            singleValueExpression,
            channel.id,
        );
        expect(singleValueResult.requester_matches).toBe(true);

        // Two-value rule: the regression.
        const orResult = await aliceClient.validateExpressionAgainstRequester(
            twoValueOrExpression,
            channel.id,
        );
        expect(orResult.requester_matches).toBe(true);

        // Reverse sanity check: an OR expression that legitimately excludes
        // alice still returns false. Without this assertion a regression that
        // unconditionally returned true would falsely pass the test.
        const nonMatchingResult = await aliceClient.validateExpressionAgainstRequester(
            nonMatchingExpression,
            channel.id,
        );
        expect(nonMatchingResult.requester_matches).toBe(false);

        // UI sanity: alice can actually open Channel Settings → Access
        // Control. This confirms she has the manage_channel_access_rules
        // permission via the channel_admin role and that the API assertions
        // above exercise the same code path the user hits when they click
        // "Test access rule".
        const {page} = await pw.testBrowser.login(alice);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();
        const accessControlTab = channelSettings.container.getByRole('tab', {name: /Access Control/i});
        await expect(accessControlTab).toBeVisible({timeout: 10000});
        await accessControlTab.click();

        // Access Rules editor should render without the self-exclusion
        // confirmation modal popping up. The modal id is not stable, so we
        // assert by its title text from channel_settings_access_rules_tab.tsx.
        await expect(page.getByText('Cannot save access rules')).not.toBeVisible({timeout: 2000});

        await channelSettings.close();
    });
});
