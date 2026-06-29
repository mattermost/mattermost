// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class SearchResultsTeamSelector extends BaseComponent {
    readonly selectorButton: Locator;
    readonly menu: Locator;
    readonly searchInput: Locator;
    readonly allTeamsOption: Locator;

    constructor(container: Locator) {
        super(container);
        this.selectorButton = container.getByTestId('searchTeamsSelectorMenuButton');
        this.menu = container.getByTestId('searchTeamSelectorMenu');
        this.searchInput = this.menu.getByLabel(en['search_teams_selector.search_teams']);
        this.allTeamsOption = this.menu.getByText(en['search_teams_selector.all_teams'], {exact: true});
    }

    teamOption(name: string): Locator {
        return this.menu.getByRole('menuitem', {name});
    }
}
