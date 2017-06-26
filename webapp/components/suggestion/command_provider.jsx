// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Suggestion from './suggestion.jsx';

import {getSuggestedCommands} from 'actions/integration_actions.jsx';

class CommandSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;

        let className = 'command';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        return (
            <div
                className={className}
                onClick={this.handleClick}
            >
                <div className='command__title'>
                    <string>{item.suggestion} {item.hint}</string>
                </div>
                <div className='command__desc'>
                    {item.description}
                </div>
            </div>
        );
    }
}

export default class CommandProvider {
    handlePretextChanged(suggestionId, pretext) {
        if (pretext.startsWith('/')) {
            getSuggestedCommands(pretext.toLowerCase(), suggestionId, CommandSuggestion, pretext.toLowerCase());
        }
    }
}
