import {createWidgetFixture, expect, expectBannerText, test} from '@mattermost/playwright-lib';

import {expectWidgetCount} from './support';
import {missingHelper} from './missing';

test.describe('Widget flow', {tag: ['@widgets', '@widget_flow']}, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag({WidgetFlag: true});
    });

    /**
     * @objective Verify the widget panel opens an item and shows the banner.
     */
    test('MM-T9101 opens a widget item @inline', {tag: '@channels'}, async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();
        const channel = await adminClient.createPublicChannel(team.id, `Widgets ${pw.random.id()}`);
        await adminClient.patchConfig({WidgetSettings: {EnableBanner: true}} as any);
        await createWidgetFixture(adminClient, team.id);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);

        // # Open the Zeta item
        await channelsPage.widgetPanel.openItem('Zeta');
        await channelsPage.saveButton.click();

        await test.step('check the banner', async () => {
            // * Banner and count are shown
            await expect(page.getByText('Welcome banner', {exact: true})).toBeVisible();
            await expectBannerText(page, 'Welcome');
            await expectWidgetCount(page, 3);
        });
        await expect(channelsPage.widgetPanel.getItem('Zeta')).not.toHaveText('Gone');
        await expect.poll(() => page.url()).toContain('/widgets');
    });

    test('MM-T9102 two actors see the same panel', async ({pw}) => {
        const {team, user, adminUser} = await pw.initSetup();
        const first = await pw.testBrowser.login(user);
        const second = await pw.testBrowser.login(adminUser);
        await first.channelsPage.goto(team.name, 'town-square');
        await second.channelsPage.goto(team.name, 'town-square');
        await first.page.getByRole('button', {name: 'Close widgets'}).click();
        await expect(second.page.getByTestId('widget-panel')).toBeVisible();
    });

    test('MM-T9103 uses a computed locator', async ({pw}) => {
        const {user} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(user);
        const selector = pickSelector(user);
        await page.locator(selector).click();
        await missingHelper(page);
    });

    for (const kind of ['alpha', 'beta']) {
        test(`generated ${kind} widget`, async ({pw}) => {
            const {user} = await pw.initSetup();
            const {page} = await pw.testBrowser.login(user);
            await page.getByText(`${kind} widget`).click();
        });
    }

    test.skip('MM-T9104 skipped', async ({page}) => {
        await page.getByText('never').click();
    });
});

function pickSelector(user: {id: string}) {
    return `#${user.id}`;
}
