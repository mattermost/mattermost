// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

/**
 * Open Team Settings Modal from sidebar
 */
export async function openTeamSettingsModal(page: Page): Promise<void> {
    // Click team menu button in sidebar
    const teamMenuButton = page.locator('#sidebarTeamMenuButton');
    await teamMenuButton.click();

    // Wait for menu to appear
    await page.waitForTimeout(1000);

    // Click "Team settings" menu item
    const teamSettingsItem = page.locator('text="Team settings"').first();
    await teamSettingsItem.click();

    // Wait for modal to appear
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
}

/**
 * Navigate to specific tab in Team Settings Modal
 */
export async function switchToTab(page: Page, tabName: 'info' | 'access'): Promise<void> {
    const tabButton = page.locator(`[data-testid="${tabName}-tab-button"]`);
    await tabButton.click();
    await page.waitForTimeout(500);
}

/**
 * Update team name in Team Settings Modal
 */
export async function updateTeamName(page: Page, newName: string): Promise<void> {
    const nameInput = page.locator('input#teamName');
    await nameInput.clear();
    await nameInput.fill(newName);
}

/**
 * Update team description in Team Settings Modal
 */
export async function updateTeamDescription(page: Page, newDescription: string): Promise<void> {
    const descriptionInput = page.locator('textarea#teamDescription');
    await descriptionInput.clear();
    await descriptionInput.fill(newDescription);
}

/**
 * Upload team icon
 */
export async function uploadTeamIcon(page: Page, filePath: string): Promise<void> {
    const fileInput = page.locator('input[data-testid="uploadPicture"]');
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(1000);
}

/**
 * Remove team icon
 */
export async function removeTeamIcon(page: Page): Promise<void> {
    const removeButton = page.locator('button[data-testid="removeImageButton"]');
    await removeButton.click();
    await page.waitForTimeout(500);
}

/**
 * Toggle open invite setting
 */
export async function toggleOpenInvite(page: Page, enable: boolean): Promise<void> {
    const checkbox = page.locator('input[type="checkbox"]').first();
    const isChecked = await checkbox.isChecked();

    if (enable && !isChecked) {
        await checkbox.check();
    } else if (!enable && isChecked) {
        await checkbox.uncheck();
    }
}

/**
 * Add allowed domain
 */
export async function addAllowedDomain(page: Page, domain: string): Promise<void> {
    // React-select input is inside the container with id 'allowedDomains'
    const domainInput = page.locator('#allowedDomains input');
    await domainInput.fill(domain);
    await domainInput.press('Enter');
    await page.waitForTimeout(500);
}

/**
 * Remove allowed domain
 */
export async function removeAllowedDomain(page: Page, domain: string): Promise<void> {
    // Find the remove button by looking for the button with aria-label containing "Remove"
    // that is associated with the domain text
    const removeButton = page.locator(`div[role="button"][aria-label*="Remove ${domain}"]`);
    await removeButton.click();
    await page.waitForTimeout(500);
}

/**
 * Regenerate team invite ID
 */
export async function regenerateInviteId(page: Page): Promise<void> {
    const regenerateButton = page.locator('button:has-text("Regenerate")');
    await regenerateButton.click();

    const confirmButton = page.locator('.modal button:has-text("Confirm"), .modal button:has-text("Yes")');
    if (await confirmButton.isVisible({timeout: 2000})) {
        await confirmButton.click();
    }

    await page.waitForTimeout(1000);
}

/**
 * Verify modal is open with correct title
 */
export async function verifyModalOpen(page: Page): Promise<boolean> {
    try {
        // Check for modal by ID and that it has content
        const modal = page.locator('#teamSettingsModal[role="dialog"]');
        await expect(modal).toBeVisible({timeout: 10000});

        // Verify modal title is present
        const modalTitle = page.locator('#teamSettingsModal .modal-title:has-text("Team Settings")');
        await expect(modalTitle).toBeVisible({timeout: 5000});

        return true;
    } catch {
        return false;
    }
}

/**
 * Verify team data via API
 */
export async function verifyTeamData(
    client: Client4,
    teamId: string,
    expected: Partial<Team>,
): Promise<void> {
    const team = await client.getTeam(teamId);

    if (expected.display_name !== undefined) {
        expect(team.display_name).toBe(expected.display_name);
    }

    if (expected.description !== undefined) {
        expect(team.description).toBe(expected.description);
    }

    if (expected.allow_open_invite !== undefined) {
        expect(team.allow_open_invite).toBe(expected.allow_open_invite);
    }

    if (expected.allowed_domains !== undefined) {
        expect(team.allowed_domains).toBe(expected.allowed_domains);
    }

    if (expected.invite_id !== undefined) {
        expect(team.invite_id).toBe(expected.invite_id);
    }
}

/**
 * Verify unsaved changes warning is visible
 */
export async function verifyUnsavedChangesWarning(page: Page): Promise<boolean> {
    try {
        const warningText = page.locator('.SaveChangesPanel:has-text("You have unsaved changes")');
        await expect(warningText).toBeVisible({timeout: 3000});
        return true;
    } catch {
        return false;
    }
}

/**
 * Verify settings saved message appears
 */
export async function verifySavedMessage(page: Page): Promise<void> {
    const savedMessage = page.locator('text="Settings saved"');
    await expect(savedMessage).toBeVisible({timeout: 5000});
}

/**
 * Save changes in Team Settings Modal
 */
export async function saveTeamSettings(page: Page): Promise<void> {
    const saveButton = page.locator('button[data-testid="SaveChangesPanel__save-btn"]');
    await saveButton.waitFor({state: 'visible', timeout: 10000});
    await saveButton.click();
    await page.waitForTimeout(1000);
}

/**
 * Cancel/Undo changes in Team Settings Modal
 */
export async function cancelTeamSettings(page: Page): Promise<void> {
    const undoButton = page.locator('button[data-testid="SaveChangesPanel__cancel-btn"]');
    await undoButton.click();
    await page.waitForTimeout(500);
}

/**
 * Close Team Settings Modal
 */
export async function closeTeamSettingsModal(page: Page): Promise<void> {
    // Click the X button in modal header (the first one, not the inner one)
    const closeButton = page.locator('#teamSettingsModal .modal-header button.close').first();
    await closeButton.click();
    await page.waitForTimeout(1000);
}

/**
 * Verify modal is closed
 */
export async function verifyModalClosed(page: Page): Promise<boolean> {
    try {
        const modal = page.locator('#teamSettingsModal[role="dialog"]');
        await expect(modal).not.toBeVisible({timeout: 5000});
        return true;
    } catch {
        return false;
    }
}

/**
 * Verify tab is active
 */
export async function verifyTabActive(page: Page, tabName: 'info' | 'access'): Promise<boolean> {
    try {
        const tab = page.locator(`[data-testid="${tabName}-tab-button"]`);
        await expect(tab).toHaveAttribute('aria-selected', 'true', {timeout: 2000});
        return true;
    } catch {
        return false;
    }
}

/**
 * Verify tab exists
 */
export async function verifyTabExists(page: Page, tabName: 'info' | 'access'): Promise<boolean> {
    try {
        const tab = page.locator(`[data-testid="${tabName}-tab-button"]`);
        await expect(tab).toBeVisible({timeout: 2000});
        return true;
    } catch {
        return false;
    }
}

/**
 * Verify Save button is enabled/disabled
 */
export async function verifySaveButtonState(page: Page, shouldBeEnabled: boolean): Promise<boolean> {
    try {
        const saveButton = page.locator('button[data-testid="SaveChangesPanel__save-btn"]');

        if (shouldBeEnabled) {
            await expect(saveButton).toBeEnabled({timeout: 2000});
        } else {
            await expect(saveButton).toBeDisabled({timeout: 2000});
        }
        return true;
    } catch {
        return false;
    }
}
