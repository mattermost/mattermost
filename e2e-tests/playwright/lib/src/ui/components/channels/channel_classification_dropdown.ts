// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class ChannelClassificationDropdown extends BaseComponent {
    readonly toggleButton: Locator;
    readonly levelDropdown: Locator;

    constructor(container: Locator) {
        super(container);
        this.toggleButton = container.getByTestId('channelClassificationToggle-button');
        this.levelDropdown = container.getByTestId('channelClassificationLevel');
    }

    levelOption(name: string): Locator {
        return this.levelDropdown.getByText(name, {exact: true});
    }
}
