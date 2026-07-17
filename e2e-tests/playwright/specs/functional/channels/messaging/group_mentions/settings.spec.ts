// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SystemConsolePage, duration, expect, getRandomId, test} from '@mattermost/playwright-lib';

import {
    boardAccount,
    composeGroupMention,
    resetMentionPermissions,
    setup,
    verifyMentionDisabled,
    verifyMentionEnabled,
} from './support';

test.describe('LDAP group mentions', () => {
    /**
     * @objective Verify a custom LDAP group mention can be enabled and disabled
     */
    test('MM-23937 enables and disables a custom LDAP group mention', {tag: '@ldap'}, async ({pw}) => {
        const {adminUser, boardGroup, boardUser, team} = await setup(pw);
        const groupName = `board-test-${getRandomId()}`;

        // # Enable the group mention and assign a custom name in Group Configuration
        const {page} = await pw.testBrowser.login(adminUser);
        const consolePage = new SystemConsolePage(page);
        await consolePage.groupConfiguration.goto(boardGroup.id, boardAccount.email);
        await consolePage.groupConfiguration.setMention(true, groupName);

        // * Verify suggestions, links, and member highlighting are enabled
        let channelsPage = await composeGroupMention(pw, adminUser, team.name, groupName);
        await channelsPage.centerView.postCreate.toHaveGroupMentionSuggested(groupName);
        await verifyMentionEnabled(pw, channelsPage, boardUser, team.name, groupName);

        // # Disable the group mention in Group Configuration
        const {page: adminPage} = await pw.testBrowser.login(adminUser);
        const adminConsolePage = new SystemConsolePage(adminPage);
        await adminConsolePage.groupConfiguration.goto(boardGroup.id, boardAccount.email);
        await adminConsolePage.groupConfiguration.setMention(false);

        // * Verify suggestions, links, and member highlighting are disabled
        channelsPage = await composeGroupMention(pw, adminUser, team.name, groupName);
        await expect(channelsPage.centerView.postCreate.suggestionList).not.toBeVisible({timeout: duration.two_sec});
        await verifyMentionDisabled(pw, channelsPage, boardUser, team.name, groupName);
    });

    /**
     * @objective Verify the use_group_mentions permission controls whether a member can mention an enabled LDAP group
     */
    test('MM-23937 restricts LDAP group mentions with the group mention permission', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser, boardGroup, boardUser, regularUser, team} = await setup(pw);
        const groupName = `board-test-${getRandomId()}`;
        await adminClient.patchGroup(boardGroup.id, {allow_reference: true, name: groupName});

        try {
            // # Restore the group mention permission default
            await resetMentionPermissions(adminClient);

            // * Verify a regular member can mention the enabled group
            let channelsPage = await composeGroupMention(pw, regularUser, team.name, groupName);
            await channelsPage.centerView.postCreate.toHaveGroupMentionSuggested(groupName);
            await verifyMentionEnabled(pw, channelsPage, boardUser, team.name, groupName);

            // # Disable Group Mentions for regular members
            const {page: adminPage} = await pw.testBrowser.login(adminUser);
            const adminConsolePage = new SystemConsolePage(adminPage);
            await adminConsolePage.permissionsSystemScheme.goto();
            await adminConsolePage.permissionsSystemScheme.disableGroupMentions();

            // * Verify the regular member can no longer mention the group
            channelsPage = await composeGroupMention(pw, regularUser, team.name, groupName);
            await expect(channelsPage.centerView.postCreate.suggestionList).not.toBeVisible({
                timeout: duration.two_sec,
            });
            await verifyMentionDisabled(pw, channelsPage, boardUser, team.name, groupName);
        } finally {
            await resetMentionPermissions(adminClient);
        }
    });
});
