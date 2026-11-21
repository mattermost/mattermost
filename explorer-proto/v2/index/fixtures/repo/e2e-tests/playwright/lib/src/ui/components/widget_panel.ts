import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export class WidgetPanel {
    readonly container: Locator;
    readonly closeButton;

    constructor(container: Locator) {
        this.container = container;
        this.closeButton = container.getByRole('button', {name: 'Close widgets'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getItem(name: string): Locator {
        return this.container.getByRole('link', {name, exact: true});
    }

    async openItem(name: string) {
        await this.getItem(name).click();
        await expect(this.container.getByText('Item opened')).toBeVisible();
    }
}
