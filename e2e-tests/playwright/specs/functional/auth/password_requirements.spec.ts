// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {openSignup} from './support';

/**
 * @objective Verify all password-complexity requirements are enforced on signup.
 */
test(
    'MM-T1774 rejects signup passwords that miss a required character class',
    {tag: '@authentication'},
    async ({pw, page}) => {
        const {adminClient} = await pw.initSetup();

        await adminClient.patchConfig({
            PasswordSettings: {Lowercase: true, Number: true, Uppercase: true, Symbol: true},
        });

        const app = await openSignup(pw, page);
        const card = app.signup.card;
        const email = `test-${pw.random.id()}@example.com`;
        await card.email.container.fill(email);
        await expect(card.email.container).toHaveValue(email);
        const username = `user${pw.random.id()}`;
        await card.username.container.fill(username);
        await expect(card.username.container).toHaveValue(username);
        await card.termsCheckbox.set(true);
        await expect(card.termsCheckbox).toBeChecked();

        for (const password of ['NOLOWERCASE12345!', 'nouppercase12345!', 'NoNumberHere!!!', 'NoSymbol1234567']) {
            // # Submit a password missing a required character class
            await card.password.container.fill(password);
            await expect(card.password.container).toHaveValue(password);
            // Editing clears the previous submit error; observe that reset before testing the next character class.
            await expect(card.password.validationAlert).toHaveCount(0);
            await card.createAccountButton.click();

            // * Verify the complexity error is shown
            await expect(card.password.validationAlert).toBeVisible();
            await expect(card.password.validationAlert).toHaveText(
                /Your password must be \d+-72 characters long and include both lowercase and uppercase letters, numbers, and special characters\./,
            );
        }
    },
);
