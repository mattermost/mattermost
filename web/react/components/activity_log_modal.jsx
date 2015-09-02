// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const UserStore = require('../stores/user_store.jsx');
const Client = require('../utils/client.jsx');
const AsyncClient = require('../utils/async_client.jsx');
const LoadingScreen = require('./loading_screen.jsx');
const Utils = require('../utils/utils.jsx');

export default class ActivityLogModal extends React.Component {
    constructor(props) {
        super(props);

        this.submitRevoke = this.submitRevoke.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleMoreInfo = this.handleMoreInfo.bind(this);

        this.state = this.getStateFromStores();
        this.state.moreInfo = [];
    }
    getStateFromStores() {
        return {
            sessions: UserStore.getSessions(),
            serverError: null,
            clientError: null
        };
    }
    submitRevoke(altId) {
        Client.revokeSession(altId,
            function handleRevokeSuccess() {
                AsyncClient.getSessions();
            },
            function handleRevokeError(err) {
                let state = this.getStateFromStores();
                state.serverError = err;
                this.setState(state);
            }.bind(this)
        );
    }
    componentDidMount() {
        UserStore.addSessionsChangeListener(this.onListenerChange);
        $(React.findDOMNode(this.refs.modal)).on('shown.bs.modal', function handleShow() {
            AsyncClient.getSessions();
        });

        $(React.findDOMNode(this.refs.modal)).on('hidden.bs.modal', function handleHide() {
            $('#user_settings').modal('show');
            this.setState({moreInfo: []});
        }.bind(this));
    }
    componentWillUnmount() {
        UserStore.removeSessionsChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        const newState = this.getStateFromStores();
        if (!Utils.areStatesEqual(newState.sessions, this.state.sessions)) {
            this.setState(newState);
        }
    }
    handleMoreInfo(index) {
        let newMoreInfo = this.state.moreInfo;
        newMoreInfo[index] = true;
        this.setState({moreInfo: newMoreInfo});
    }
    render() {
        let activityList = [];

        for (let i = 0; i < this.state.sessions.length; i++) {
            const currentSession = this.state.sessions[i];
            const lastAccessTime = new Date(currentSession.last_activity_at);
            const firstAccessTime = new Date(currentSession.create_at);
            let devicePicture = '';

            if (currentSession.props.platform === 'Windows') {
                devicePicture = 'fa fa-windows';
            } else if (currentSession.props.platform === 'Macintosh' || currentSession.props.platform === 'iPhone') {
                devicePicture = 'fa fa-apple';
            } else if (currentSession.props.platform === 'Linux') {
                devicePicture = 'fa fa-linux';
            }

            let moreInfo;
            if (this.state.moreInfo[i]) {
                moreInfo = (
                    <div>
                        <div>{`First time active: ${firstAccessTime.toDateString()}, ${lastAccessTime.toLocaleTimeString()}`}</div>
                        <div>{`OS: ${currentSession.props.os}`}</div>
                        <div>{`Browser: ${currentSession.props.browser}`}</div>
                        <div>{`Session ID: ${currentSession.alt_id}`}</div>
                    </div>
                );
            } else {
                moreInfo = (
                    <a
                        className='theme'
                        href='#'
                        onClick={this.handleMoreInfo.bind(this, i)}
                    >
                        More info
                    </a>
                );
            }

            activityList[i] = (
                <div
                    key={'activityLogEntryKey' + i}
                    className='activity-log__table'
                >
                    <div className='activity-log__report'>
                        <div className='report__platform'><i className={devicePicture} />{currentSession.props.platform}</div>
                        <div className='report__info'>
                            <div>{`Last activity: ${lastAccessTime.toDateString()}, ${lastAccessTime.toLocaleTimeString()}`}</div>
                            {moreInfo}
                        </div>
                    </div>
                    <div className='activity-log__action'>
                        <button
                            onClick={this.submitRevoke.bind(this, currentSession.alt_id)}
                            className='btn btn-primary'
                        >
                            Logout
                        </button>
                    </div>
                </div>
            );
        }

        let content;
        if (this.state.sessions.loading) {
            content = <LoadingScreen />;
        } else {
            content = <form role='form'>{activityList}</form>;
        }

        return (
            <div>
                <div
                    className='modal fade'
                    ref='modal'
                    id='activity-log'
                    tabIndex='-1'
                    role='dialog'
                    aria-hidden='true'
                >
                    <div className='modal-dialog modal-lg'>
                        <div className='modal-content'>
                            <div className='modal-header'>
                                <button
                                    type='button'
                                    className='close'
                                    data-dismiss='modal'
                                    aria-label='Close'
                                >
                                    <span aria-hidden='true'>&times;</span>
                                </button>
                                <h4
                                    className='modal-title'
                                    id='myModalLabel'
                                >
                                    Active Sessions
                                </h4>
                            </div>
                            <p className='session-help-text'>Sessions are created when you log in with your email and password to a new browser on a device. Sessions let you use Mattermost for up to 30 days without having to log in again. If you want to log out sooner, use the 'Logout' button below to end a session.</p>
                            <div
                                ref='modalBody'
                                className='modal-body'
                            >
                                {content}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
