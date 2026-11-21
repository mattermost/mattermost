import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {WidgetPanel} from '@/ui/components/widget_panel';

export default class ChannelsPage {
    readonly page: Page;
    readonly widgetPanel;
    readonly saveButton;

    constructor(page: Page) {
        this.page = page;
        this.widgetPanel = new WidgetPanel(page.getByTestId('widget-panel'));
        this.saveButton = page.getByRole('button', {name: 'Save widget'});
    }

    async goto(teamName = '', channelName = '') {
        await this.page.goto(`/${teamName}/channels/${channelName}`);
    }

    async toBeVisible() {
        await expect(this.page.locator('#app-root')).toBeVisible();
    }
}
