// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import UserStore from '../stores/user_store.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
var ActionTypes = Constants.ActionTypes;

const messages = defineMessages({
    close: {
        id: 'post_delete.close',
        defaultMessage: 'Close'
    },
    notPosted: {
        id: 'post_delete.notPosted',
        defaultMessage: 'Comment could not be posted'
    },
    someone: {
        id: 'post_delete.someone',
        defaultMessage: 'Someone deleted the message on which you tried to post a comment.'
    },
    okay: {
        id: 'post_delete.okay',
        defaultMessage: 'Okay'
    }
});

class PostDeletedModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleClose = this.handleClose.bind(this);

        this.state = {};
    }
    componentDidMount() {
        $(ReactDOM.findDOMNode(this.refs.modal)).on('hidden.bs.modal', () => {
            this.handleClose();
        });
    }
    handleClose() {
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
        var currentUser = UserStore.getCurrentUser();

        if (currentUser != null) {
            return (
                <div
                    className='modal fade'
                    ref='modal'
                    id='post_deleted'
                    tabIndex='-1'
                    role='dialog'
                    aria-hidden='true'
                >
                    <div className='modal-dialog'>
                        <div className='modal-content'>
                            <div className='modal-header'>
                                <button
                                    type='button'
                                    className='close'
                                    data-dismiss='modal'
                                    aria-label={formatMessage(messages.close)}
                                >
                                    <span aria-hidden='true'>{'×'}</span>
                                </button>
                                <h4
                                    className='modal-title'
                                    id='myModalLabel'
                                >
                                    {formatMessage(messages.notPosted)}
                                </h4>
                            </div>
                            <div className='modal-body'>
                                <p>{formatMessage(messages.someone)}</p>
                            </div>
                            <div className='modal-footer'>
                                <button
                                    type='button'
                                    className='btn btn-primary'
                                    data-dismiss='modal'
                                >
                                    {formatMessage(messages.okay)}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return <div/>;
    }
}

PostDeletedModal.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(PostDeletedModal);