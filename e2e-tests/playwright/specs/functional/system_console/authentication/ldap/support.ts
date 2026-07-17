// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

export const ldapUsers = {
    admin: {username: 'dev.one', password: 'Password1', email: 'success+devone@simulator.amazonses.com'},
    member: {username: 'test.one', password: 'Password1', email: 'success+testone@simulator.amazonses.com'},
    guest: {username: 'board.one', password: 'Password1', email: 'success+boardone@simulator.amazonses.com'},
    guestFilterOne: {username: 'test.two', password: 'Password1', email: 'success+testtwo@simulator.amazonses.com'},
    guestFilterTwo: {
        username: 'test.three',
        password: 'Password1',
        email: 'success+testthree@simulator.amazonses.com',
    },
};

export type LdapAccount = (typeof ldapUsers)[keyof typeof ldapUsers];

export async function setupLdap(pw: any) {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient} = await pw.getAdminClient();
    await adminClient.configureOpenLdap();
    await adminClient.resetOpenLdapTestState();
    await adminClient.patchConfig({
        GuestAccountsSettings: {Enable: true},
    });
    await adminClient.testLdap();
    await adminClient.runLdapSync();
}

export async function getLdapUser(adminClient: any, account: LdapAccount) {
    const user = await adminClient.getOrCreateLdapUser(account);
    return {...user, password: account.password} as UserProfile;
}

export async function removeFromAllTeams(adminClient: any, user: UserProfile) {
    const teams = await adminClient.getTeamsForUser(user.id);
    await Promise.all(teams.map((team: {id: string}) => adminClient.removeFromTeam(team.id, user.id)));
}

export async function loginFromPage(pw: any, account: LdapAccount) {
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    const loginResponse = pw.loginPage.page.waitForResponse(
        (response: {url: () => string; request: () => {method: () => string}}) =>
            response.request().method() === 'POST' && response.url().endsWith('/api/v4/users/login'),
    );
    await pw.loginPage.loginWithLdap(account.username, account.password);
    return loginResponse;
}
