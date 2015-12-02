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

            const terms = [];
            const names = [];

            for (const emoticon of Emoticons.emoticonMap.keys()) {
                if (emoticon.indexOf(partialName) !== -1) {
                    terms.push(':' + emoticon + ':');
                    names.push(emoticon);

                    if (terms.length >= MAX_EMOTICON_SUGGESTIONS) {
                        break;
                    }
                }
            }

            if (terms.length > 0) {
                SuggestionStore.setMatchedPretext(suggestionId, text);
                SuggestionStore.addSuggestions(suggestionId, terms, names, EmoticonSuggestion);
            }
        }
    }
}
