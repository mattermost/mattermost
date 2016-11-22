// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import EmojiStore from 'stores/emoji_store.jsx';
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
                        src={EmojiStore.getEmojiImageUrl(emoticon)}
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
        let hasSuggestions = false;

        // look for the potential emoticons at the start of the text, after whitespace, and at the start of emoji reaction commands
        const captured = (/(^|\s|^\+|^-)(:([^:\s]*))$/g).exec(pretext);
        if (captured) {
            const prefix = captured[1];
            const text = captured[2];
            const partialName = captured[3];

            const matched = [];

            // check for text emoticons if this isn't for an emoji reaction
            if (prefix !== '-' && prefix !== '+') {
                for (const emoticon of Object.keys(Emoticons.emoticonPatterns)) {
                    if (Emoticons.emoticonPatterns[emoticon].test(text)) {
                        SuggestionStore.addSuggestion(suggestionId, text, EmojiStore.get(emoticon), EmoticonSuggestion, text);

                        hasSuggestions = true;
                    }
                }
            }

            // check for named emoji
            for (const [name, emoji] of EmojiStore.getEmojis()) {
                if (name.indexOf(partialName) !== -1) {
                    matched.push(emoji);

                    if (matched.length >= MAX_EMOTICON_SUGGESTIONS) {
                        break;
                    }
                }
            }

            // sort the emoticons so that emoticons starting with the entered text come first
            matched.sort((a, b) => {
                const aName = a.name || a.aliases[0];
                const bName = b.name || b.aliases[0];

                const aPrefix = aName.startsWith(partialName);
                const bPrefix = bName.startsWith(partialName);

                if (aPrefix === bPrefix) {
                    return aName.localeCompare(bName);
                } else if (aPrefix) {
                    return -1;
                }

                return 1;
            });

            const terms = matched.map((emoticon) => ':' + (emoticon.name || emoticon.aliases[0]) + ':');

            SuggestionStore.clearSuggestions(suggestionId);
            if (terms.length > 0) {
                SuggestionStore.addSuggestions(suggestionId, terms, matched, EmoticonSuggestion, text);

                hasSuggestions = true;
            }
        }

        if (hasSuggestions) {
            // force the selection to be cleared since the order of elements may have changed
            SuggestionStore.clearSelection(suggestionId);
        }
    }
}
