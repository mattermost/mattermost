// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Emoticons from 'utils/emoticons.jsx';
import SuggestionStore from 'stores/suggestion_store.jsx';

import Suggestion from './suggestion.jsx';

const MAX_EMOTICON_SUGGESTIONS = 40;

class EmoticonSuggestion extends Suggestion {
    render() {
        const text = this.props.term;
        const emoticon = this.props.item;

        let className = 'emoticon-suggestion';
        if (this.props.isSelection) {
            className += ' suggestion--selected';
        }

        return (
            <div
                className={className}
                onClick={this.handleClick}
            >
                <div className='pull-left'>
                    <img
                        alt={text}
                        className='emoticon-suggestion__image'
                        src={emoticon.path}
                        title={text}
                    />
                </div>
                <div className='pull-left'>
                    {text}
                </div>
            </div>
        );
    }
}

export default class EmoticonProvider {
    handlePretextChanged(suggestionId, pretext) {
        const captured = (/(?:^|\s)(:([a-zA-Z0-9_+\-]*))$/g).exec(pretext);
        if (captured) {
            const text = captured[1];
            const partialName = captured[2];

            const matched = [];

            for (const [name, emoticon] of Emoticons.getEmoticonsByName()) {
                if (name.indexOf(partialName) !== -1) {
                    matched.push(emoticon);

                    if (matched.length >= MAX_EMOTICON_SUGGESTIONS) {
                        break;
                    }
                }
            }

            // sort the emoticons so that emoticons starting with the entered text come first
            matched.sort((a, b) => {
                const aPrefix = a.alias.startsWith(partialName);
                const bPrefix = b.alias.startsWith(partialName);

                if (aPrefix === bPrefix) {
                    return a.alias.localeCompare(b.alias);
                } else if (aPrefix) {
                    return -1;
                }

                return 1;
            });

            const terms = matched.map((emoticon) => ':' + emoticon.alias + ':');

            if (terms.length > 0) {
                SuggestionStore.addSuggestions(suggestionId, terms, matched, EmoticonSuggestion, text);

                // force the selection to be cleared since the order of elements may have changed
                SuggestionStore.clearSelection(suggestionId);
            }
        }
    }
}
