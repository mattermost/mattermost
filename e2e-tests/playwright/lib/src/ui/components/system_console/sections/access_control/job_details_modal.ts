// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

/**
 * "Job Details" modal in System Console > Access Control (LDAP sync jobs).
 * Rendered at page level via a portal.
 */
export default class JobDetailsModal extends BaseComponent {
    readonly searchInput: Locator;
    readonly closeButton: Locator;

    // Nested "Channel Membership Changes" modal
    readonly membershipChangesModal: Locator;

    constructor(container: Locator) {
        super(container);

        this.searchInput = container.locator('input[placeholder*="Search" i]').first();
        this.closeButton = container.locator('button[aria-label*="Close" i], .close, button:has-text("×")').first();

        this.membershipChangesModal = container
            .page()
            .locator('[role="dialog"], .modal')
            .filter({hasText: 'Channel Membership Changes'});
    }

    getChannelRowByName(name: string): Locator {
        return this.container.locator(`text=${name}`).first();
    }

    getMembershipAddedTab(): Locator {
        return this.membershipChangesModal.locator('text=/Added \\(\\d+\\)/i').first();
    }

    getMembershipRemovedTab(): Locator {
        return this.membershipChangesModal.locator('text=/Removed \\(\\d+\\)/i').first();
    }

    getMembershipChangesCloseButton(): Locator {
        return this.membershipChangesModal
            .locator('button[aria-label*="Close" i], .close, button:has-text("×")')
            .first();
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }

    async close(): Promise<void> {
        await this.closeButton.click();
    }
}
