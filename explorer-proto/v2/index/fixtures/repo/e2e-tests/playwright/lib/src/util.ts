import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export async function createWidgetFixture(client: any, teamId: string) {
    await client.createWidgetChannel(teamId);
    await client.addWidgetMember(teamId);
}

export async function expectBannerText(page: Page, text: string) {
    await expect(page.getByTestId('banner')).toHaveText(text);
}
