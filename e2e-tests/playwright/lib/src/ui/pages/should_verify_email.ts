// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ShouldVerifyEmailPage {
    readonly page: Page;
    readonly title: ReturnType<Page['getByText']>;
    readonly message: ReturnType<Page['getByText']>;
    readonly resendButton: ReturnType<Page['getByRole']>;
    readonly sentConfirmation: ReturnType<Page['getByText']>;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByText('You’re almost done!');
        this.message = page.getByText('Please verify your email address. Check your inbox for an email.');
        this.resendButton = page.getByRole('button', {name: 'Resend Email'});
        this.sentConfirmation = page.getByText('Verification email sent');
    }

    async toBeVisible() {
        await expect(this.title).toBeVisible();
        await expect(this.message).toBeVisible();
    }
}
