// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class RankedValuePicker extends BaseComponent {
    menu(): Locator {
        return this.container.page().getByRole('menu', {name: en['admin.userManagement.userDetail.selectOption']});
    }

    menuItems(): Locator {
        return this.menu().getByRole('menuitemradio');
    }

    valueOption(name: string): Locator {
        return this.menu().getByText(name, {exact: true});
    }

    async open(): Promise<void> {
        await this.container.click();
    }

    async select(name: string): Promise<void> {
        await this.open();
        await this.valueOption(name).click();
    }
}
