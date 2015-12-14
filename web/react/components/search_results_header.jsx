// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
var ActionTypes = Constants.ActionTypes;
const messages = defineMessages({
    title1: {
        id: 'search_header.title1',
        defaultMessage: 'Search Results'
    },
    title2: {
        id: 'search_header.title2',
        defaultMessage: 'Recent Mentions'
    },
    close: {
        id: 'search_header.close',
        defaultMessage: 'Close'
    }
});

class SearchResultsHeader extends React.Component {
    constructor(props) {
        super(props);

        this.handleClose = this.handleClose.bind(this);
    }

    handleClose(e) {
        e.preventDefault();

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH,
            results: null
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH_TERM,
            term: null,
            do_search: false,
            is_mention_search: false
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_POST_SELECTED,
            results: null
        });
    }

    render() {
        const {formatMessage} = this.props.intl;
        var title = formatMessage(messages.title1);

        if (this.props.isMentionSearch) {
            title = formatMessage(messages.title2);
        }

        return (
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>{title}</span>
                <button
                    type='button'
                    className='sidebar--right__close'
                    aria-label={formatMessage(messages.close)}
                    title={formatMessage(messages.close)}
                    onClick={this.handleClose}
                >
                    <i className='fa fa-sign-out'/>
                </button>
            </div>
        );
    }
}

SearchResultsHeader.propTypes = {
    intl: intlShape.isRequired,
    isMentionSearch: React.PropTypes.bool
};

export default injectIntl(SearchResultsHeader);