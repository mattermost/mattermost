// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * Personal Access Tokens section within the Security tab of the Profile modal.
 *
 * Covers the expiry UI added in MM-68421:
 * - expiry preset select (#newTokenExpiry)
 * - custom date input (#newTokenExpiryCustom)
 * - enforced-expiry hint
 * - per-token status badges and expiry labels in the token list
 */
export default class PersonalAccessTokensSection extends BaseComponent {
    /** The "Edit" button that expands the Personal Access Tokens section. */
    readonly tokensEditButton: Locator;

    /** "Create Token" button — visible once the section is expanded. */
    readonly createTokenButton: Locator;

    /** Token description / name text input (#newTokenDescription). */
    readonly tokenNameInput: Locator;

    /** Expiry preset <select> (#newTokenExpiry). */
    readonly expirySelect: Locator;

    /** Custom date <input> (#newTokenExpiryCustom) — only visible when "Custom date…" is selected. */
    readonly expiryInput: Locator;

    /** "Save" button inside the create-token form. */
    readonly saveButton: Locator;

    /** The revealed token value after a successful create ("Access Token: …"). */
    readonly accessTokenValue: Locator;

    /** Inline hint shown when the admin has enforced a maximum token lifetime. */
    readonly expiryEnforcedHint: Locator;

    constructor(container: Locator) {
        super(container);

        this.tokensEditButton = container.locator('#tokensEdit');
        this.createTokenButton = container.getByRole('button', {name: en['user.settings.tokens.create']});
        this.tokenNameInput = container.locator('#newTokenDescription');
        this.expirySelect = container.locator('#newTokenExpiry');
        this.expiryInput = container.locator('#newTokenExpiryCustom');
        this.saveButton = container.getByRole('button', {name: en['user.settings.tokens.save']});
        this.accessTokenValue = container.getByText(en['user.settings.tokens.token']);
        this.expiryEnforcedHint = container.getByText(en['user.settings.tokens.expiryEnforced']);
    }

    /**
     * Returns the <option> element inside the expiry <select> matching the given text.
     * Pass a string or RegExp (e.g. /Custom date/).
     */
    getExpiryOption(text: string | RegExp): Locator {
        return this.expirySelect.locator('option', {hasText: text});
    }

    getTokenRowByName(name: string): Locator {
        return this.container.getByTestId('personalAccessTokenItem').filter({hasText: name});
    }

    tokenRow(nth: number): Locator {
        return this.container.getByTestId('personalAccessTokenItem').nth(nth);
    }

    /**
     * Returns the revoke/delete button within the given token row.
     */
    revokeButton(row: Locator): Locator {
        return row.getByRole('button', {name: en['user.settings.tokens.delete']});
    }

    /**
     * Returns the "Active" status badge within the given token row.
     */
    activeStatusBadge(row: Locator): Locator {
        return row.getByText(en['user.settings.tokens.status.active']);
    }

    /**
     * Returns the "Disabled" status badge within the given token row.
     */
    disabledStatusBadge(row: Locator): Locator {
        return row.getByText(en['user.settings.tokens.status.inactive']);
    }

    /**
     * Returns the "Never" expiry label within the given token row.
     */
    neverExpiryLabel(row: Locator): Locator {
        return row.getByText(en['user.settings.tokens.expiry.never']);
    }

    expiresSoonLabel(row: Locator, pattern: RegExp): Locator {
        return row.getByText(pattern);
    }

    validationMessage(text: string | RegExp): Locator {
        return this.container.getByText(text);
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
