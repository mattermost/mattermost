// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

import InfoSettings from './info_settings';
import AccessSettings from './access_settings';

export default class TeamSettingsModal extends BaseComponent {
    readonly closeButton;

    readonly infoTab;
    readonly accessTab;
    readonly accessPoliciesTab;

    readonly saveButton;
    readonly undoButton;
    readonly policyEditorSearchInput;
    readonly maskedChips;
    readonly policyDeleteButton;
    readonly policyNameInput: Locator;
    readonly policyBackButton: Locator;
    readonly savePanelError: Locator;
    readonly savePanelSaved: Locator;
    readonly syncStatusFooter: Locator;

    readonly infoSettings;
    readonly accessSettings;

    constructor(container: Locator) {
        super(container);

        this.closeButton = container.getByRole('button', {name: en['generic.close']});

        this.infoTab = container.getByRole('button', {name: en['team_settings_modal.infoTab']});
        this.accessTab = container.getByRole('button', {name: en['team_settings_modal.accessTab']});
        this.accessPoliciesTab = container.getByRole('button', {name: en['team_settings_modal.accessPoliciesTab']});

        this.saveButton = container.getByTestId('SaveChangesPanel__save-btn');
        this.undoButton = container.getByTestId('SaveChangesPanel__cancel-btn');
        this.policyEditorSearchInput = container.getByTestId('searchInput');
        this.maskedChips = container.getByRole('img', {name: en['admin.access_control.masked_chip.aria_label']});
        this.policyDeleteButton = container.getByRole('button', {
            name: en['admin.access_control.policy.edit_policy.delete_policy.delete'],
        });
        this.policyNameInput = container.locator('#input_policyName');
        this.policyBackButton = container.getByTestId('TeamPolicyEditor__back-btn');
        this.savePanelError = container.getByTestId('SaveChangesPanel--error');
        this.savePanelSaved = container.getByText(en['saveChangesPanel.saved']);
        this.syncStatusFooter = container.getByTestId('SyncStatusFooter');

        this.infoSettings = new InfoSettings(container);
        this.accessSettings = new AccessSettings(container);
    }

    get addPolicyButton(): Locator {
        return this.container.getByRole('button', {name: en['team_settings.access_policies.add_policy']});
    }

    get addChannelsButton(): Locator {
        return this.container.getByRole('button', {
            name: en['admin.access_control.policy.edit_policy.channel_selector.addChannels'],
        });
    }

    removePolicyButton(name?: string): Locator {
        const buttons = this.container.getByRole('button', {
            name: en['admin.access_control.policy.edit_policy.channel_selector.remove'],
        });
        if (name) {
            return this.container.getByRole('listitem').filter({hasText: name}).getByRole('button', {
                name: en['admin.access_control.policy.edit_policy.channel_selector.remove'],
            });
        }
        return buttons.first();
    }

    get teamPolicyDeleteModal(): Locator {
        return this.container.page().locator('#teamPolicyDeleteModal');
    }

    get syncNowButton(): Locator {
        return this.container.getByRole('button', {name: en['team_settings.sync_status.sync_now']});
    }

    get applyPolicyButton(): Locator {
        return this.container.page().getByRole('button', {name: en['team_settings.policy_editor.confirmation.apply']});
    }

    get policyUpdatedMessage(): Locator {
        return this.container.getByText(en['team_settings.policy_editor.policy_updated']);
    }

    policyByName(name: string): Locator {
        return this.container.getByText(name);
    }

    autoAddCheckbox(channelId: string): Locator {
        return this.container.getByTestId(`auto-add-checkbox-${channelId}`);
    }

    getPolicyMenuButton(policyId: string): Locator {
        return this.container.locator(`button[id="policy-menu-${policyId}"]`);
    }

    get policyEditorDeleteButton(): Locator {
        return this.container.getByTestId('teamPolicyDeleteButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async close() {
        await this.closeButton.click();
    }

    async openInfoTab(): Promise<InfoSettings> {
        await expect(this.infoTab).toBeVisible();
        await this.infoTab.click();

        return this.infoSettings;
    }

    async openAccessTab(): Promise<AccessSettings> {
        await expect(this.accessTab).toBeVisible();
        await this.accessTab.click();

        return this.accessSettings;
    }

    async openAccessPoliciesTab() {
        await expect(this.accessPoliciesTab).toBeVisible();
        await this.accessPoliciesTab.click();
    }

    async save() {
        await expect(this.saveButton).toBeVisible();
        await this.saveButton.click();
    }

    async undo() {
        await expect(this.undoButton).toBeVisible();
        await this.undoButton.click();
    }

    async verifySavedMessage() {
        const savedMessage = this.container.getByText(en['saveChangesPanel.saved']);
        await expect(savedMessage).toBeVisible({timeout: 5000});
    }

    async verifyUnsavedChanges() {
        const warningText = this.container.getByText(en['saveChangesPanel.message']);
        await expect(warningText).toBeVisible({timeout: 3000});
    }
}
