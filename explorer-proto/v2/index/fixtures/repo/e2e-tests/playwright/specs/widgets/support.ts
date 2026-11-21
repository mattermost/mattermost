import {expect} from '@mattermost/playwright-lib';
import type {Page} from '@playwright/test';

export async function expectWidgetCount(page: Page, count: number) {
    await expect(page.getByTestId('widget-count')).toHaveText(String(count));
}
