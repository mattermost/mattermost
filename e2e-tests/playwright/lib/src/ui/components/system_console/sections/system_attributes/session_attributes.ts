// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

const SESSION_ATTRIBUTES_URL = '/admin_console/system_attributes/session_attributes';

// PATCH route the page hits when committing staged edits (one request per changed field).
const PATCH_FIELD_URL_FRAGMENT = '/properties/groups/session_attributes/session/fields/';

/**
 * System Console -> System Attributes -> Session Attributes
 *
 * Page object for the seeded session-attribute listing/tuning UI. Rows are keyed
 * by the server-assigned property field id (resolve it via the property fields
 * API before calling row-scoped accessors).
 */
export default class SessionAttributes {
    readonly container: Locator;
    private readonly page;

    readonly saveButton: Locator;
    readonly cancelButton: Locator;

    constructor(container: Locator) {
        this.container = container.getByTestId('sessionAttributes');
        this.page = container.page();

        this.saveButton = this.page.getByTestId('saveSetting');
        this.cancelButton = this.page.locator('#cancelButtonSettings');
    }

    // ── Visibility ──────────────────────────────────────────────────────

    async goto() {
        await this.page.goto(SESSION_ATTRIBUTES_URL);
        await this.page.waitForLoadState('networkidle');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    // ── Row accessors (keyed by server field id) ────────────────────────

    row(fieldId: string): Locator {
        return this.container.locator(`#sessionAttributes-row-${fieldId}`);
    }

    displayName(fieldId: string): Locator {
        return this.row(fieldId).getByTestId('session-attribute-display-name');
    }

    serverLabel(fieldId: string): Locator {
        return this.row(fieldId).getByTestId('session-attribute-server-label');
    }

    type(fieldId: string): Locator {
        return this.row(fieldId).getByTestId('session-attribute-type');
    }

    platforms(fieldId: string): Locator {
        return this.row(fieldId).getByTestId('session-attribute-platforms');
    }

    ttl(fieldId: string): Locator {
        return this.row(fieldId).getByTestId('session-attribute-ttl');
    }

    grace(fieldId: string): Locator {
        return this.row(fieldId).getByTestId('session-attribute-grace');
    }

    status(fieldId: string): Locator {
        return this.row(fieldId).getByTestId('session-attribute-status');
    }

    dotMenuButton(fieldId: string): Locator {
        return this.row(fieldId).getByTestId(`session-attribute-dotmenu-${fieldId}`);
    }

    dotMenu(fieldId: string): Locator {
        return this.page.locator(`#session-attribute-dotmenu-${fieldId}-menu`);
    }

    // ── Row actions (stage edits locally; commit via saveAndWaitForSettled) ──

    async openDotMenu(fieldId: string) {
        await this.dotMenuButton(fieldId).click();

        // Wait for the popover to actually open. Opening a second dot menu right
        // after the previous one closed can otherwise race the closing overlay,
        // where the click lands on the fading backdrop instead of the button.
        await expect(this.dotMenu(fieldId)).toBeVisible();
    }

    /**
     * Stage a TTL preset (in seconds) for a field via its dot menu.
     */
    async setTtlPreset(fieldId: string, seconds: number) {
        await this.chooseDurationPreset(fieldId, 'ttl', /Time-to-live/, seconds);
    }

    /**
     * Stage a grace-period preset (in seconds) for a field via its dot menu.
     */
    async setGracePreset(fieldId: string, seconds: number) {
        await this.chooseDurationPreset(fieldId, 'grace', /Grace Period/, seconds);
    }

    /**
     * Open a duration submenu and pick a preset.
     *
     * The submenu opens on hover or ArrowRight and collapses on mouse-leave.
     * Hover the trigger, then click the option before the pointer leaves, and
     * retry the whole sequence via toPass so a half-open popover cannot stack.
     */
    private async chooseDurationPreset(fieldId: string, kind: 'ttl' | 'grace', triggerName: RegExp, seconds: number) {
        // Scope the trigger to this row's open menu. The "Time-to-live"/"Grace
        // Period" labels are identical across every row, so a page-wide lookup
        // could match a not-yet-unmounted menu from another row and trip
        // Playwright's strict mode.
        const trigger = this.dotMenu(fieldId).getByRole('menuitem', {name: triggerName});
        const option = this.page.getByTestId(`session-attribute-${kind}-option-${fieldId}-${seconds}`);

        await this.row(fieldId).scrollIntoViewIfNeeded();

        await expect(async () => {
            await this.page.keyboard.press('Escape');
            await this.page.keyboard.press('Escape');
            await expect(this.dotMenu(fieldId)).toBeHidden({timeout: 5000});

            await this.dotMenuButton(fieldId).click();
            await expect(trigger).toBeVisible({timeout: 3000});
            // SubMenu opens on hover or ArrowRight and closes on mouse-leave, so keep
            // the pointer on the trigger while the option is clicked.
            await trigger.hover();
            await trigger.press('ArrowRight');
            await expect(option).toBeVisible({timeout: 3000});
            await option.click();
            await expect(this.dotMenu(fieldId)).toBeHidden({timeout: 5000});
        }).toPass({timeout: 30000, intervals: [250, 500, 1000]});
    }

    /**
     * One-click enable (no confirmation modal) for a currently disabled field.
     */
    async enable(fieldId: string) {
        await this.openDotMenu(fieldId);
        await this.page.getByTestId(`session-attribute-enable-${fieldId}`).click();
    }

    /**
     * Open the disable confirmation modal for a currently enabled field. The
     * stage only happens after confirmDisable().
     */
    async openDisableModal(fieldId: string) {
        await this.openDotMenu(fieldId);
        await this.page.getByTestId(`session-attribute-disable-${fieldId}`).click();
    }

    disableModal(): Locator {
        return this.page.getByRole('dialog').filter({hasText: 'Disable attribute'});
    }

    async confirmDisable() {
        await this.disableModal().getByRole('button', {name: 'Disable', exact: true}).click();
    }

    // ── Save / Cancel ───────────────────────────────────────────────────

    async cancel() {
        await this.cancelButton.click();
    }

    /**
     * Click Save and wait for the property-field PATCH round-trip to complete,
     * then assert the button returns to disabled (no pending changes).
     *
     * Note: this awaits the first matching PATCH only, so it assumes edits were
     * staged on a single field. Every current spec stages one field per save; a
     * future multi-field save would need to await one response per changed field.
     */
    async saveAndWaitForSettled() {
        await expect(this.saveButton).toBeEnabled();

        const savePatchPromise = this.page.waitForResponse(
            (resp) => resp.url().includes(PATCH_FIELD_URL_FRAGMENT) && resp.request().method() === 'PATCH',
        );

        await this.saveButton.click();
        await savePatchPromise;
        await expect(this.saveButton).toBeDisabled({timeout: 10000});
    }
}
