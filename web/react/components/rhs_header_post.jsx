// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
const messages = defineMessages({
    details: {
        id: 'rhs_header.details',
        defaultMessage: 'Message Details'
    }
});

class RhsHeaderPost extends React.Component {
    constructor(props) {
        super(props);

        this.handleClose = this.handleClose.bind(this);
        this.handleBack = this.handleBack.bind(this);

        this.state = {};
    }
    handleClose(e) {
        e.preventDefault();

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH,
            results: null
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_POST_SELECTED,
            results: null
        });
    }
    handleBack(e) {
        e.preventDefault();

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH_TERM,
            term: this.props.fromSearch,
            do_search: true,
            is_mention_search: this.props.isMentionSearch
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_POST_SELECTED,
            results: null
        });
    }
    render() {
        const {formatMessage} = this.props.intl;
        let back;
        if (this.props.fromSearch) {
            back = (
                <a
                    href='#'
                    onClick={this.handleBack}
                    className='sidebar--right__back'
                >
                    <i className='fa fa-chevron-left'></i>
                </a>
            );
        }

        return (
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>{back} {formatMessage(messages.details)}</span>
                <button
                    type='button'
                    className='sidebar--right__close'
                    aria-label='Close'
                    onClick={this.handleClose}
                >
                    <i className='fa fa-sign-out'/>
                </button>
            </div>
        );
    }
}

RhsHeaderPost.defaultProps = {
    isMentionSearch: false,
    fromSearch: ''
};
RhsHeaderPost.propTypes = {
    intl: intlShape.isRequired,
    isMentionSearch: React.PropTypes.bool,
    fromSearch: React.PropTypes.string
};

export default injectIntl(RhsHeaderPost);