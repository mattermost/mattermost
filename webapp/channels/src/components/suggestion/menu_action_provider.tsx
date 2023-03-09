// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ProviderResults} from './generic_user_provider';

import Provider from './provider';
import Suggestion from './suggestion.jsx';

class MenuActionSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;

        let className = 'suggestion-list__item';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        return (
            <div
                className={className}
                onClick={this.handleClick}
                onMouseMove={this.handleMouseMove}
                {...Suggestion.baseProps}
            >
                {item.text}
            </div>
        );
    }
}

export default class MenuActionProvider extends Provider {
    private options: Array<Record<string, any>>;

    constructor(options: Array<Record<string, any>>) {
        super();
        this.options = options;
    }

    handlePretextChanged(prefix: string, resultsCallback: (res: ProviderResults) => void) {
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

    async displayAllOptions(resultsCallback: (res: ProviderResults) => void) {
        const terms = this.options.map((option) => option.text);

        resultsCallback({
            matchedPretext: '',
            terms,
            items: this.options,
            component: MenuActionSuggestion,
        });
    }

    async filterOptions(prefix: string, resultsCallback: (res: ProviderResults) => void) {
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
