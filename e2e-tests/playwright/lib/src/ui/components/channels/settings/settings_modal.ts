// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import en from '@/i18n';
import {BaseComponent} from '@/ui/base_component';

import AdvancedSettings from './advanced_settings';
import DisplaySettings from './display_settings';
import NotificationsSettings from './notifications_settings';
import SecuritySettings from './security_settings';
import SidebarSettings from './sidebar_settings';

export default class SettingsModal extends BaseComponent {
    readonly content;
    readonly closeButton;

    readonly notificationsTab;
    readonly displayTab;
    readonly sidebarTab;
    readonly advancedTab;
    readonly securityTab;

    readonly notificationsSettings;
    readonly displaySettings;
    readonly sidebarSettings;
    readonly advancedSettings;
    readonly securitySettings;

    constructor(container: Locator) {
        super(container);

        this.content = container.getByTestId('settingsModalContent');
        this.closeButton = container.getByRole('button', {name: en['generic.close']});

        this.notificationsTab = container.getByRole('tab', {name: en['user.settings.modal.notifications']});
        this.displayTab = container.getByRole('tab', {name: en['user.settings.modal.display']});
        this.sidebarTab = container.getByRole('tab', {name: en['user.settings.modal.sidebar']});
        this.advancedTab = container.getByRole('tab', {name: en['user.settings.modal.advanced']});
        this.securityTab = container.getByRole('tab', {name: en['user.settings.modal.security']});

        this.notificationsSettings = new NotificationsSettings(
            container.getByRole('tabpanel', {name: en['user.settings.modal.notifications']}),
        );
        this.displaySettings = new DisplaySettings(
            container.getByRole('tabpanel', {name: en['user.settings.modal.display']}),
        );
        this.sidebarSettings = new SidebarSettings(
            container.getByRole('tabpanel', {name: en['user.settings.modal.sidebar']}),
        );
        this.advancedSettings = new AdvancedSettings(
            container.getByRole('tabpanel', {name: en['user.settings.modal.advanced']}),
        );
        this.securitySettings = new SecuritySettings(
            container.getByRole('tabpanel', {name: en['user.settings.modal.security']}),
        );
    }

    get personalAccessTokensSection() {
        return this.securitySettings.personalAccessTokensSection;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async getContainerId() {
        return (await this.container.getAttribute('id')) ?? '';
    }

    async openNotificationsTab() {
        await expect(this.notificationsTab).toBeVisible();
        await this.notificationsTab.click();

        await this.notificationsSettings.toBeVisible();

        return this.notificationsSettings;
    }

    async openDisplayTab() {
        await expect(this.displayTab).toBeVisible();
        await this.displayTab.click();

        await this.displaySettings.toBeVisible();

        return this.displaySettings;
    }

    async openSidebarTab() {
        await expect(this.sidebarTab).toBeVisible();
        await this.sidebarTab.click();

        await this.sidebarSettings.toBeVisible();

        return this.sidebarSettings;
    }

    async openAdvancedTab() {
        await expect(this.advancedTab).toBeVisible();
        await this.advancedTab.click();

        await this.advancedSettings.toBeVisible();

        return this.advancedSettings;
    }

    async openSecurityTab() {
        await expect(this.securityTab).toBeVisible();
        await this.securityTab.click();

        await this.securitySettings.toBeVisible();

        return this.securitySettings;
    }

    async close() {
        await this.container.getByLabel(en['generic.close']).click();

        await expect(this.container).not.toBeVisible();
    }
}
