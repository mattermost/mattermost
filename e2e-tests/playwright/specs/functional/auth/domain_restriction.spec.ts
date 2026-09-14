// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const ALLOWED_DOMAINS = 'mattermost.com, test.com';

/**
 * @objective Verify signup succeeds when the email belongs to an allowed domain.
 */
test('MM-T1756 allows signup when the email domain is on the allow list', {tag: '@authentication'}, async ({pw}) => {
    const {adminClient} = await pw.initSetup();

    try {
        await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ALLOWED_DOMAINS}});

        const username = `test${pw.random.id()}`;
        await pw.hasSeenLandingPage();
        await pw.signupPage.goto();
        await pw.signupPage.toBeVisible();

        // # Create an account with an allowed-domain email
        await pw.signupPage.create({
            email: `${username}@mattermost.com`,
            username,
            password: pw.newTestPassword(),
        });

        // * Verify the account is created and the team-join page is shown
        await pw.selectTeamPage.toBeVisible();
    } finally {
        await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ''}});
    }
});

/**
 * @objective Verify changing a profile email to a disallowed domain is rejected.
 */
test('MM-T1757 rejects a profile email change to a disallowed domain', {tag: '@authentication'}, async ({pw}) => {
    const {adminClient, user} = await pw.initSetup();

    try {
        await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ALLOWED_DOMAINS}});

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Try to change the profile email to a disallowed domain
        const profileModal = await channelsPage.openProfileModal();
        await profileModal.changeEmail(`user-${pw.random.id()}@example.com`, user.password);

        // * Verify the domain restriction error is shown
        await expect(profileModal.domainRestrictionError).toBeVisible();
    } finally {
        await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ''}});
    }
});

/**
 * @objective Verify signup through a team invite is rejected for a disallowed domain.
 */
test(
    'MM-T1758 rejects team-invite signup when the email domain is not allowed',
    {tag: '@authentication'},
    async ({pw}) => {
        const {adminClient, team} = await pw.initSetup();

        try {
            await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ALLOWED_DOMAINS}});

            const username = `test${pw.random.id()}`;
            await pw.hasSeenLandingPage();
            await pw.signupPage.goto(`/signup_user_complete/?id=${team.invite_id}`);
            await pw.signupPage.toBeVisible();

            // # Attempt signup with a disallowed-domain email
            await pw.signupPage.create(
                {
                    email: `${username}@example.com`,
                    username,
                    password: pw.newTestPassword(),
                },
                false,
            );

            // * Verify the domain restriction error is shown
            await expect(pw.signupPage.domainRestrictionError).toBeVisible();
        } finally {
            await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ''}});
        }
    },
);
