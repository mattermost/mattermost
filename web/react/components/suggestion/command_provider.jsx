// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as AsyncClient from '../../utils/async_client.jsx';

class CommandSuggestion extends React.Component {
    render() {
        const {item, isSelection, onClick} = this.props;

        let className = 'command-name';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        return (
            <div
                className={className}
                onClick={onClick}
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

CommandSuggestion.propTypes = {
    item: React.PropTypes.object.isRequired,
    isSelection: React.PropTypes.bool,
    onClick: React.PropTypes.func
};

export default class CommandProvider {
    handlePretextChanged(suggestionId, pretext) {
        if (pretext.startsWith('/')) {
            AsyncClient.getSuggestedCommands(pretext, suggestionId, CommandSuggestion);
        }
    }
}
