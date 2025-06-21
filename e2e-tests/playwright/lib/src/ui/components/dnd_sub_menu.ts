// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class DndSubMenu {
    readonly container: Locator;

    readonly dontClear;
    readonly after30mins;
    readonly after1hour;
    readonly after2hours;
    readonly afterTomorrow;
    readonly chooseDateAndTime;

    constructor(container: Locator) {
        this.container = container;

        this.dontClear = container.getByRole('menuitem', {name: "Don't clear"});
        this.after30mins = container.getByRole('menuitem', {name: '30 mins'});
        this.after1hour = container.getByRole('menuitem', {name: '1 hour'});
        this.after2hours = container.getByRole('menuitem', {name: '2 hours'});
        this.afterTomorrow = container.getByRole('menuitem', {name: 'Tomorrow'});
        this.after30mins = container.getByRole('menuitem', {name: '30 mins'});
        this.chooseDateAndTime = container.getByRole('menuitem', {name: 'Choose date and time'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
