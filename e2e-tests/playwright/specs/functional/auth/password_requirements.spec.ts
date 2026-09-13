// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify all password-complexity requirements are enforced on signup.
 */
test('rejects signup passwords that miss a required character class', {tag: '@authentication'}, async ({pw}) => {
    const {adminClient} = await pw.initSetup();

    try {
        await adminClient.patchConfig({
            PasswordSettings: {Lowercase: true, Number: true, Uppercase: true, Symbol: true},
        });

        await pw.hasSeenLandingPage();
        await pw.signupPage.goto();
        await pw.signupPage.toBeVisible();
        await pw.signupPage.emailInput.fill(`test-${pw.random.id()}@example.com`);
        await pw.signupPage.usernameInput.fill(`user${pw.random.id()}`);
        await pw.signupPage.termsAndPrivacyCheckBox.check();

        for (const password of ['NOLOWERCASE12345!', 'nouppercase12345!', 'NoNumberHere!!!', 'NoSymbol1234567']) {
            // # Submit a password missing a required character class
            await pw.signupPage.passwordInput.fill(password);
            await pw.signupPage.createAccountButton.click();

            // * Verify the complexity error is shown
            await expect(pw.signupPage.passwordComplexityError).toBeVisible();
        }
    } finally {
        await adminClient.patchConfig({
            PasswordSettings: {Lowercase: false, Number: false, Uppercase: false, Symbol: false},
        });
    }
});
