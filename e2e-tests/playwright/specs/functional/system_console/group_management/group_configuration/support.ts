// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SystemConsolePage, getRandomId} from '@mattermost/playwright-lib';

export async function setup(pw: any, teamDisplayName = `AAA Test ${getRandomId()}`) {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient, adminUser} = await pw.getAdminClient();
    await adminClient.initializeOpenLdap();
    const group = await adminClient.getOrLinkLdapGroup('board');
    const team = await adminClient.createTeam({
        ...(await pw.random.team()),
        display_name: teamDisplayName,
    });
    await adminClient.addToTeam(team.id, adminUser.id);
    const channel = await adminClient.createPublicChannel(team.id, `Group Config ${getRandomId()}`);

    await adminClient.resetLdapGroup(group.id);

    const {page} = await pw.testBrowser.login(adminUser);
    const consolePage = new SystemConsolePage(page);
    await consolePage.groupConfiguration.goto(group.id);
    await consolePage.groupConfiguration.expectNoTeamOrChannelMemberships();
    return {adminClient, channel, consolePage, group, team};
}

export async function saveAndReload(consolePage: SystemConsolePage, groupId: string) {
    await consolePage.groupConfiguration.save();
    await consolePage.groupConfiguration.goto(groupId);
}

export async function discardAndReload(consolePage: SystemConsolePage, groupId: string) {
    await consolePage.groupConfiguration.attemptToLeave();
    await consolePage.groupConfiguration.goto(groupId);
}
