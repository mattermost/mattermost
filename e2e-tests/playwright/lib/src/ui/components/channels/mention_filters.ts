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
     * The remove button of every chip, one per applied filter.
     */
    getChipRemoveButtons() {
        return this.chips.getByRole('button', {name: /^Remove .+ filter$/});
    }

    async open() {
        await this.button.click();
        await expect(this.popover).toBeVisible();
    }

    async selectTeam(teamDisplayName: string) {
        await this.popover.getByTestId('mentionFiltersTeamSelector').click();
        await this.popover.getByRole('menuitemradio', {name: teamDisplayName}).click();
    }

    /**
     * Ticks a channel in the channel picker, opening the picker first if it is closed. A channel's
     * option may carry its team name too, so the name is matched as a substring.
     */
    async selectChannel(channelDisplayName: string) {
        const selector = this.popover.getByTestId('mentionFiltersChannelSelector');
        if ((await selector.getAttribute('aria-expanded')) !== 'true') {
            await selector.click();
        }
        await this.popover.getByRole('checkbox', {name: channelDisplayName}).first().check();
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

    async done() {
        await this.popover.getByRole('button', {name: 'Done'}).click();
        await expect(this.popover).not.toBeVisible();
    }

    /**
     * Removes the chip whose label starts with the given text. A channel chip also names its team
     * when no team filter is set, so the label is matched as a prefix.
     */
    async removeChip(label: string) {
        await this.chips.getByRole('button', {name: `Remove ${label}`}).click();
    }
}
