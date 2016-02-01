// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';

import {FormattedMessage} from 'mm-intl';

var ActionTypes = Constants.ActionTypes;

export default class SearchResultsHeader extends React.Component {
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
        var title = (
            <FormattedMessage
                id='search_header.results'
                defaultMessage='Search Results'
            />
        );

        if (this.props.isMentionSearch) {
            title = (
                <FormattedMessage
                    id='search_header.title2'
                    defaultMessage='Recent Mentions'
                />
            );
        }

        return (
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>{title}</span>
                <button
                    type='button'
                    className='sidebar--right__close'
                    aria-label='Close'
                    title='Close'
                    onClick={this.handleClose}
                >
                    <i className='fa fa-sign-out'/>
                </button>
            </div>
        );
    }
}

SearchResultsHeader.propTypes = {
    isMentionSearch: React.PropTypes.bool
};