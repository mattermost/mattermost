import {expect, test} from '@mattermost/playwright-lib';

test('upgrade keeps widgets', async ({page}) => {
    await page.goto('/widgets');
    await expect(page.getByText('Widgets survived')).toBeVisible();
});
