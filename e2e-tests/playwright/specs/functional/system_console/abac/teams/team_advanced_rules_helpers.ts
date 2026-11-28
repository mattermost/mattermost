// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {
    Api,
    expect,
    getRandomId,
    newTestPassword,
    waitForApi,
    type App,
    type PlaywrightExtended,
} from '@mattermost/playwright-lib';

import {
    createPrivateTeam,
    createPublicTeam,
    getTeamAccessControlPolicy,
    setUserAttribute,
} from '../../../channels/team_settings/helpers';

import {enableTeamMembershipPolicies, openTeamConfig, setToggle} from './helpers';

export type MemberLabel = 'engUS' | 'engAPAC' | 'salesEU' | 'salesAPAC';
export type FixtureLabel = MemberLabel | 'newEU' | 'salesUS' | 'sysAPAC' | 'teamAdminSalesUS';

export async function expectServerRejection(
    call: () => Promise<unknown>,
    status: number,
    errorId: string,
    because: string,
): Promise<void> {
    let error: {status_code?: number; server_error_id?: string} | undefined;
    try {
        await call();
    } catch (err) {
        error = err as typeof error;
    }
    expect(error, `expected the server to refuse: ${because}`).toBeDefined();
    expect(error?.status_code, because).toBe(status);
    expect(error?.server_error_id, because).toBe(errorId);
}

export async function createFixtureUser(
    adminClient: Client4,
    label: string,
    dept: string,
    loc: string,
    departmentField: string,
    locationField: string,
): Promise<UserProfile> {
    const username = `${label.toLowerCase()}${getRandomId()}`;
    const password = newTestPassword();
    const user = await adminClient.createUser(
        {email: `${username}@sample.mattermost.com`, username, password} as any,
        '',
        '',
    );
    user.password = password;
    await setUserAttribute(adminClient, user.id, departmentField, dept);
    await setUserAttribute(adminClient, user.id, locationField, loc);
    return user;
}

export async function setupAdvancedTeamFixture(
    pw: PlaywrightExtended,
    users: Record<FixtureLabel, UserProfile>,
    createdTeamIds: string[],
    options: {members?: MemberLabel[]; publicTeam?: boolean} = {},
): Promise<{adminClient: Client4; adminUser: UserProfile; team: Team; users: Record<FixtureLabel, UserProfile>}> {
    const {members = ['engUS', 'engAPAC', 'salesEU'], publicTeam = false} = options;

    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('TeamMembershipAccessControl', true);

    const {adminClient, adminUser} = await pw.getAdminClient();
    if (!adminUser) {
        throw new Error('Admin user not found');
    }
    await enableTeamMembershipPolicies(adminClient);

    const suffix = pw.random.id();
    const team = publicTeam
        ? await createPublicTeam(adminClient, suffix)
        : await createPrivateTeam(adminClient, suffix);
    createdTeamIds.push(team.id);

    // Keep the sysadmin creator out of the roster so it is never a sync casualty.
    await adminClient.removeFromTeam(team.id, adminUser.id);

    for (const label of members) {
        await adminClient.addToTeam(team.id, users[label].id);
    }

    return {adminClient, adminUser, team, users};
}

export async function openTeamRules(app: App, team: Team): Promise<App['admin']['team']['accessRules']> {
    // The page fetches the team's policy on mount; a response landing after the toggle is switched on would reset it.
    await Promise.all([
        waitForApi(app.page, Api.GetTeamAccessControlPolicy, {params: {team_id: team.id}, timeout: 20_000}),
        openTeamConfig(app, team.display_name),
    ]);
    await setToggle(app, true);

    const rulesPanel = app.admin.team.accessRules;
    await expect(rulesPanel).toBeVisible({timeout: 15_000});
    return rulesPanel;
}

export async function getMembershipExpression(adminClient: Client4, teamId: string): Promise<string | undefined> {
    const response: any = await getTeamAccessControlPolicy(adminClient, teamId);
    return response?.policy?.rules?.find((rule: any) => rule.actions?.includes('membership'))?.expression;
}

export async function getTeamMemberIds(adminClient: Client4, teamId: string): Promise<string[]> {
    const members = await adminClient.getTeamMembers(teamId, 0, 200);
    return members.filter((m) => m.delete_at === 0).map((m) => m.user_id);
}

export async function clearMonaco(app: App): Promise<void> {
    const editor = app.admin.team.accessRules.rules.input;
    await expect(editor).toBeVisible();
    // Monaco owns its native textbox and rendered lines; the generated input supplies its scope.
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- Monaco's own editing textarea cannot take a test id
    const input = editor.locator.getByRole('textbox');
    await input.focus();
    await expect(input).toBeFocused();
    await input.press('ControlOrMeta+a');
    await expect(input).toBeFocused();
    await input.press('Delete');
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- Monaco renders its text in internal .view-lines elements, which cannot take a test id
    await expect(editor.locator.locator('.view-lines')).toHaveText('');
}

export async function addTeamAttributeRule(app: App, value: string, name: string): Promise<void> {
    const rules = app.admin.team.accessRules.rules;
    const row = rules.row((await rules.rowList.keys()).length);
    await rules.addButton.click();
    await expect(row.attributeMenu.attributeList.locator).toContainText([name]);
    const attribute = await row.attributeMenu.attributeList.itemWith({text: name});
    await expect(attribute).toBeVisible();
    await attribute.click();
    await expect(row.valueInputTextbox).toBeVisible();
    await row.valueInputTextbox.fill(value);
    await row.valueInputTextbox.press('Tab');
    await expect(row.valueInputTextbox).toHaveValue(value);
}
