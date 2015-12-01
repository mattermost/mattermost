// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import * as Client from '../utils/client.jsx';
import Constants from '../utils/constants.jsx';
import SuggestionStore from '../stores/suggestion_store.jsx';

class CommandSuggestion extends React.Component {
    render() {
        const {item, isSelection, onClick} = this.props;

        let className = 'command-name';
        if (isSelection) {
            className += ' command--selected';
        }

        return (
            <div
                className={className}
                onClick={onClick}
            >
                <div className='command__title'>
                    <string>{item.suggestion}</string>
                </div>
                <div className='command__desc'>
                    {item.description}
                </div>
            </div>
        );
    }
}

CommandSuggestion.propTypes = {
    item: React.PropTypes.object.isRequired,
    isSelection: React.PropTypes.bool,
    onClick: React.PropTypes.func
};

export default class CommandProvider {
    handlePretextChanged(suggestionId, pretext) {
        if (pretext.startsWith('/')) {
            SuggestionStore.setMatchedPretext(suggestionId, pretext);

            Client.executeCommand(
                '',
                pretext,
                true,
                (data) => {
                    this.handleCommandsReceived(suggestionId, pretext, data.suggestions);
                }
            );
        }
    }

    handleCommandsReceived(suggestionId, matchedPretext, commandSuggestions) {
        const terms = commandSuggestions.map(({suggestion}) => suggestion);

        AppDispatcher.handleServerAction({
            type: Constants.ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS,
            id: suggestionId,
            matchedPretext,
            terms,
            items: commandSuggestions,
            component: CommandSuggestion
        });
    }
}
