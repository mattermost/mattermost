// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

export default class PostDeletedModal extends React.Component {
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
                                    aria-label='Close'
                                >
                                    <span aria-hidden='true'>{'×'}</span>
                                </button>
                                <h4
                                    className='modal-title'
                                    id='myModalLabel'
                                >
                                    {'Comment could not be posted'}
                                </h4>
                            </div>
                            <div className='modal-body'>
                                <p>{'Someone deleted the message on which you tried to post a comment.'}</p>
                            </div>
                            <div className='modal-footer'>
                                <button
                                    type='button'
                                    className='btn btn-primary'
                                    data-dismiss='modal'
                                >
                                    {'Okay'}
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
