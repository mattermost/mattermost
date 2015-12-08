// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SuggestionStore from '../../stores/suggestion_store.jsx';
import * as Emoticons from '../../utils/emoticons.jsx';

const MAX_EMOTICON_SUGGESTIONS = 40;

class EmoticonSuggestion extends React.Component {
    render() {
        const text = this.props.term;
        const name = this.props.item;

        let className = 'emoticon-suggestion';
        if (this.props.isSelection) {
            className += ' suggestion--selected';
        }

        return (
            <div
                className={className}
                onClick={this.props.onClick}
            >
                <div className='pull-left'>
                    <img
                        alt={text}
                        className='emoticon-suggestion__image'
                        src={Emoticons.getImagePathForEmoticon(name)}
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

EmoticonSuggestion.propTypes = {
    item: React.PropTypes.string.isRequired,
    term: React.PropTypes.string.isRequired,
    isSelection: React.PropTypes.bool,
    onClick: React.PropTypes.func
};

export default class EmoticonProvider {
    handlePretextChanged(suggestionId, pretext) {
        const captured = (/(?:^|\s)(:([a-zA-Z0-9_+\-]*))$/g).exec(pretext);
        if (captured) {
            const text = captured[1];
            const partialName = captured[2];

            const names = [];

            for (const emoticon of Emoticons.emoticonMap.keys()) {
                if (emoticon.indexOf(partialName) !== -1) {
                    names.push(emoticon);

                    if (names.length >= MAX_EMOTICON_SUGGESTIONS) {
                        break;
                    }
                }
            }

            // sort the emoticons so that emoticons starting with the entered text come first
            names.sort((a, b) => {
                const aPrefix = a.startsWith(partialName);
                const bPrefix = b.startsWith(partialName);

                if (aPrefix === bPrefix) {
                    return a.localeCompare(b);
                } else if (aPrefix) {
                    return -1;
                }

                return 1;
            });

            const terms = names.map((name) => ':' + name + ':');

            if (terms.length > 0) {
                SuggestionStore.setMatchedPretext(suggestionId, text);
                SuggestionStore.addSuggestions(suggestionId, terms, names, EmoticonSuggestion);

                // force the selection to be cleared since the order of elements may have changed
                SuggestionStore.clearSelection(suggestionId);
            }
        }
    }
}
