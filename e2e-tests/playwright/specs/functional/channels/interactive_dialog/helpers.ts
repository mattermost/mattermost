// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {APIRequestContext, Page} from '@playwright/test';
import type {Command} from '@mattermost/types/integrations';

import {
    expect,
    isWebhookTestServerReachable,
    type ChannelsPage,
    type PlaywrightExtended,
    setupWebhookTestServer,
    testConfig,
} from '@mattermost/playwright-lib';

const commandTrigger = 'multiform_dialog';

export async function setupMultiform(pw: PlaywrightExtended, request: APIRequestContext) {
    expect(
        await isWebhookTestServerReachable(request),
        `Webhook test server must be reachable at ${testConfig.webhookBaseUrl}`,
    ).toBe(true);
    await setupWebhookTestServer(request, {
        mattermostBaseUrl: testConfig.baseURL,
        adminUsername: testConfig.adminUsername,
        adminPassword: testConfig.adminPassword,
    });

    const {adminClient, team, user} = await pw.initSetup();
    await adminClient.addCommand({
        team_id: team.id,
        trigger: commandTrigger,
        method: 'P',
        username: '',
        icon_url: '',
        auto_complete: false,
        auto_complete_desc: '',
        auto_complete_hint: '',
        display_name: 'Multiform Dialog Test',
        description: 'Step-by-step form submission test',
        url: `${testConfig.webhookBaseUrl}/dialog/multistep`,
    } as Command);

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    return {channelsPage, dialog: new MultiformDialog(page)};
}

export async function openMultiform(channelsPage: ChannelsPage) {
    await channelsPage.postMessage(`/${commandTrigger}`);
}

export class MultiformDialog {
    constructor(private readonly page: Page) {}

    async expectStepOne() {
        await expect(this.page.getByRole('heading', {name: 'Step 1 - Personal Info'})).toBeVisible();
        await expect(this.page.getByRole('textbox', {name: /First Name/})).toBeVisible();
        await expect(this.page.getByRole('textbox', {name: /Email/})).toBeVisible();
        await expect(this.page.getByRole('button', {name: 'Next Step'})).toBeVisible();
    }

    async completeStepOne(firstName: string, email: string) {
        await this.page.getByRole('textbox', {name: /First Name/}).fill(firstName);
        await this.page.getByRole('textbox', {name: /Email/}).fill(email);
        await this.page.getByRole('button', {name: 'Next Step'}).click();
    }

    async submitEmptyStepOne() {
        await this.page.getByRole('button', {name: 'Next Step'}).click();
    }

    async expectRequiredFieldErrors(count: number) {
        await expect(this.page.getByText('This field is required.', {exact: true})).toHaveCount(count);
    }

    async expectStepTwo() {
        const dialog = this.page.getByRole('dialog', {name: 'Step 2 - Work Info'});
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('combobox')).toBeVisible();
        await expect(dialog.getByRole('radio', {name: 'Senior'})).toBeVisible();
        await expect(this.page.getByRole('textbox', {name: /First Name/})).toHaveCount(0);
        await expect(this.page.getByRole('textbox', {name: /Email/})).toHaveCount(0);
    }

    async completeStepTwo() {
        const dialog = this.page.getByRole('dialog', {name: 'Step 2 - Work Info'});
        await dialog.getByRole('combobox').click();
        await this.page.getByRole('option', {name: 'Engineering'}).click();
        await this.page.getByRole('radio', {name: 'Senior'}).check();
        await this.page.getByRole('button', {name: 'Next Step'}).click();
    }

    async expectStepThree() {
        const dialog = this.page.getByRole('dialog', {name: 'Step 3 - Final Details'});
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('textbox', {name: /Comments/})).toBeVisible();
        await expect(dialog.getByRole('checkbox', {name: /Terms & Conditions/})).toBeVisible();
        await expect(dialog.getByRole('button', {name: 'Complete Registration'})).toBeVisible();
        await expect(dialog.getByRole('combobox')).toHaveCount(0);
        await expect(dialog.getByRole('radio', {name: 'Senior'})).toHaveCount(0);
    }

    async completeStepThree(comments: string) {
        await this.page.getByRole('textbox', {name: /Comments/}).fill(comments);
        await this.page.getByRole('checkbox', {name: /Terms & Conditions/}).check();
        await this.page.getByRole('button', {name: 'Complete Registration'}).click();
    }

    async cancel() {
        await this.page.getByRole('button', {name: 'Cancel'}).click();
    }

    async close() {
        await this.page.getByRole('button', {name: 'Close'}).click();
    }

    async expectClosed() {
        await expect(
            this.page.getByRole('dialog', {name: /Step [123] - (Personal Info|Work Info|Final Details)/}),
        ).toHaveCount(0);
    }
}
