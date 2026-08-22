// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ChannelNotificationPreferencesModal {
    readonly container: Locator;

    readonly muteChannelCheckbox;
    readonly ignoreMentionsCheckbox;
    readonly mentionsOnlyRadio;
    readonly saveButton;

    constructor(container: Locator) {
        this.container = container;

        this.muteChannelCheckbox = container.getByRole('checkbox', {name: /Mute channel/i});
        this.ignoreMentionsCheckbox = container.getByRole('checkbox', {
            name: 'Ignore mentions for @channel, @here and @all',
        });
        this.mentionsOnlyRadio = container
            .getByRole('group', {name: 'Notify me about…'})
            .first()
            .getByRole('radio', {name: /Mentions, direct messages, and keywords only/});
        this.saveButton = container.getByRole('button', {name: 'Save'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await this.container.getByText('Mute or ignore').waitFor();
    }

    async save() {
        await this.saveButton.click();
        await expect(this.container).not.toBeVisible();
    }

    async selectMentionsOnly() {
        await this.mentionsOnlyRadio.check();
        await expect(this.mentionsOnlyRadio).toBeChecked();
    }
}
