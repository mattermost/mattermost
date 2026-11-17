// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The filters at the top of the Recent Mentions panel: the Filters button, the popover it opens and
 * the row of chips showing what is applied. The popover renders in a portal outside the panel, so it
 * is looked up from the page.
 */
export default class MentionFilters {
    readonly button: Locator;
    readonly chips: Locator;
    readonly popover: Locator;

    constructor(panel: Locator) {
        this.button = panel.getByTestId('mentionFiltersButton');
        this.chips = panel.getByTestId('mentionFilterChips');
        this.popover = panel.page().getByTestId('mentionFiltersPopover');
    }

    /**
     * Every applied-filter chip. A removable chip is itself the button, labelled "Remove ... filter".
     */
    getChipRemoveButtons() {
        return this.chips.getByRole('button', {name: /^Remove .+ filter$/});
    }

    async open() {
        await this.button.click();
        await expect(this.popover).toBeVisible();
    }

    async selectTeam(teamDisplayName: string) {
        await this.popover.getByRole('combobox', {name: 'Team'}).click();
        await this.popover.getByRole('option', {name: teamDisplayName, exact: true}).click();
    }

    /**
     * Picks a channel in the channel picker, then closes its menu so it doesn't cover the rest of the
     * popover. A channel's option may carry its team name too, so the name is matched as a substring.
     */
    async selectChannel(channelDisplayName: string) {
        const picker = this.popover.getByRole('combobox', {name: 'Channel or Direct Messages'});
        await picker.fill(channelDisplayName);
        await this.popover.getByRole('option', {name: channelDisplayName}).first().click();
        if ((await picker.getAttribute('aria-expanded')) === 'true') {
            await picker.press('Escape');
        }
        await expect(picker).toHaveAttribute('aria-expanded', 'false');
    }

    /**
     * Ticks a mention type, such as 'Directly mentioning you'.
     */
    async selectMentionType(label: string) {
        await this.popover.getByRole('checkbox', {name: label, exact: true}).check();
    }

    /**
     * Picks a date range, such as 'Today' or 'Last 7 days'.
     */
    async selectDate(label: string) {
        await this.popover.getByRole('radio', {name: label, exact: true}).check();
    }

    async reset() {
        await this.popover.getByRole('button', {name: 'Reset'}).click();
    }

    async apply() {
        await this.popover.getByRole('button', {name: 'Apply'}).click();
        await expect(this.popover).not.toBeVisible();
    }

    /**
     * Removes the chip whose label starts with the given text. A channel chip also names its team
     * when no team filter is set, so the label is matched as a prefix. The chip's remove icon is
     * hidden from the accessibility tree, so it is found by its data attribute.
     */
    async removeChip(label: string) {
        const chip = this.chips.getByRole('button', {name: `Remove ${label}`});
        await chip.locator('[data-chip-remove]').click();
    }
}
