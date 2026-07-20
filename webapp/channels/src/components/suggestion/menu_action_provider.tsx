// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Provider from './provider';
import type {ResultsCallback} from './provider';
import {SuggestionContainer} from './suggestion';
import type {SuggestionProps} from './suggestion';

interface MenuAction {
    text: string;
    value: string;
}

const MenuActionSuggestion = React.forwardRef<HTMLLIElement, SuggestionProps<MenuAction>>((props, ref) => {
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

    constructor(options: MenuAction[]) {
        super();
        this.options = options;
    }

    handlePretextChanged(prefix: string, resultsCallback: ResultsCallback<MenuAction>) {
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
        const terms = this.options.map((option) => option.text);

        resultsCallback({
            matchedPretext: '',
            terms,
            items: this.options,
            component: MenuActionSuggestion,
        });
    }

    async filterOptions(prefix: string, resultsCallback: ResultsCallback<MenuAction>) {
        const filteredOptions = this.options.filter((option) => option.text.toLowerCase().indexOf(prefix.toLowerCase()) >= 0);
        const terms = filteredOptions.map((option) => option.text);

        resultsCallback({
            matchedPretext: prefix,
            terms,
            items: filteredOptions,
            component: MenuActionSuggestion,
        });
    }
}
