// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Provider from './provider';
import type {ResultsCallback} from './provider';
import {SuggestionContainer} from './suggestion';
import type {SuggestionProps} from './suggestion';

export interface MenuAction {
    text: string;
    value: string;
}

const MenuActionSuggestion = React.forwardRef<HTMLDivElement, SuggestionProps<MenuAction>>((props, ref) => {
    const {item} = props;

    return (
        <SuggestionContainer
            ref={ref}
            {...props}
        >
            {item.text}
        </SuggestionContainer>
    );
});
MenuActionSuggestion.displayName = 'MenuActionSuggestion';

export default class MenuActionProvider extends Provider {
    private options: MenuAction[];
    private enableTermToBeOptionItem?: boolean;

    constructor(options: MenuAction[], enableTermToBeOptionItem?: boolean) {
        super();
        this.options = options;
        this.enableTermToBeOptionItem = enableTermToBeOptionItem;
    }

    handlePretextChanged(prefix: string, resultsCallback: ResultsCallback<MenuAction>): boolean {
        if (prefix.length === 0) {
            this.displayAllOptions(resultsCallback);
            return true;
        }

        if (prefix) {
            this.filterOptions(prefix, resultsCallback);
            return true;
        }

        return false;
    }

    async displayAllOptions(resultsCallback: ResultsCallback<MenuAction>) {
        const terms = this.enableTermToBeOptionItem ? this.options : this.options.map((option) => option.text);

        resultsCallback({
            matchedPretext: '',
            terms,
            items: this.options,
            component: MenuActionSuggestion,
        });
    }

    async filterOptions(prefix: string, resultsCallback: ResultsCallback<MenuAction>) {
        const filteredOptions = this.options.filter((option) => option.text.toLowerCase().includes(prefix.toLowerCase()) || option.value.toLowerCase().includes(prefix.toLowerCase()));
        const terms = this.enableTermToBeOptionItem ? filteredOptions : filteredOptions.map((option) => option.text);

        resultsCallback({
            matchedPretext: prefix,
            terms,
            items: filteredOptions,
            component: MenuActionSuggestion,
        });
    }
}
