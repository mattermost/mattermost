// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from '../stores/user_store.jsx';
import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
const Modal = ReactBootstrap.Modal;
import LoadingScreen from './loading_screen.jsx';
import * as Utils from '../utils/utils.jsx';
import {intlShape, injectIntl, defineMessages, FormattedDate} from 'react-intl';

const messages = defineMessages({
    firstTime: {
        id: 'activity_log.firstTime',
        defaultMessage: 'First time active:'
    },
    os: {
        id: 'activity_log.os',
        defaultMessage: 'OS:'
    },
    browser: {
        id: 'activity_log.browser',
        defaultMessage: 'Browser:'
    },
    sessionId: {
        id: 'activity_log.sessionId',
        defaultMessage: 'Session ID:'
    },
    moreInfo: {
        id: 'activity_log.moreInfo',
        defaultMessage: 'More info'
    },
    lastActivity: {
        id: 'activity_log.lastActivity',
        defaultMessage: 'Last activity:'
    },
    logout: {
        id: 'activity_log.logout',
        defaultMessage: 'Logout'
    },
    close: {
        id: 'activity_log.close',
        defaultMessage: 'Close'
    },
    activeSessions: {
        id: 'activity_log.activeSessions',
        defaultMessage: 'Active Sessions'
    },
    sessionsDescription: {
        id: 'activity_log.sessionsDescription',
        defaultMessage: 'Sessions are created when you log in with your email and password to a new browser on a device. Sessions let you use Mattermost for up to 30 days without having to log in again. If you want to log out sooner, use the \'Logout\' button below to end a session.'
    }
});

class ActivityLogModal extends React.Component {
    constructor(props) {
        super(props);

        this.submitRevoke = this.submitRevoke.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleMoreInfo = this.handleMoreInfo.bind(this);
        this.onHide = this.onHide.bind(this);
        this.onShow = this.onShow.bind(this);

        let state = this.getStateFromStores();
        state.moreInfo = [];

        this.state = state;
    }
    getStateFromStores() {
        return {
            sessions: UserStore.getSessions(),
            serverError: null,
            clientError: null
        };
    }
    submitRevoke(altId, e) {
        e.preventDefault();
        var modalContent = $(e.target).closest('.modal-content');
        modalContent.addClass('animation--highlight');
        setTimeout(() => {
            modalContent.removeClass('animation--highlight');
        }, 1500);
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
    onShow() {
        AsyncClient.getSessions();

        if ($(window).width() > 768) {
            $(ReactDOM.findDOMNode(this.refs.modalBody)).perfectScrollbar();
            $(ReactDOM.findDOMNode(this.refs.modalBody)).css('max-height', $(window).height() - 200);
        } else {
            $(ReactDOM.findDOMNode(this.refs.modalBody)).css('max-height', $(window).height() - 150);
        }
    }
    onHide() {
        this.setState({moreInfo: []});
        this.props.onHide();
    }
    componentDidMount() {
        UserStore.addSessionsChangeListener(this.onListenerChange);

        if (this.props.show) {
            this.onShow();
        }
    }
    componentDidUpdate(prevProps) {
        if (this.props.show && !prevProps.show) {
            this.onShow();
        }
    }
    componentWillUnmount() {
        UserStore.removeSessionsChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        const newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(newState.sessions, this.state.sessions)) {
            this.setState(newState);
        }
    }
    handleMoreInfo(index) {
        let newMoreInfo = this.state.moreInfo;
        newMoreInfo[index] = true;
        this.setState({moreInfo: newMoreInfo});
    }
    render() {
        const {formatMessage} = this.props.intl;
        let activityList = [];

        for (let i = 0; i < this.state.sessions.length; i++) {
            const currentSession = this.state.sessions[i];
            const lastAccessTime = new Date(currentSession.last_activity_at);
            const firstAccessTime = new Date(currentSession.create_at);
            let devicePlatform = currentSession.props.platform;
            let devicePicture = '';

            if (currentSession.props.platform === 'Windows') {
                devicePicture = 'fa fa-windows';
            } else if (currentSession.props.platform === 'Macintosh' || currentSession.props.platform === 'iPhone') {
                devicePicture = 'fa fa-apple';
            } else if (currentSession.props.platform === 'Linux') {
                if (currentSession.props.os.indexOf('Android') >= 0) {
                    devicePlatform = 'Android';
                    devicePicture = 'fa fa-android';
                } else {
                    devicePicture = 'fa fa-linux';
                }
            }

            let moreInfo;
            if (this.state.moreInfo[i]) {
                moreInfo = (
                    <div>
                        <div>{formatMessage(messages.firstTime)}
                            <FormattedDate
                                value={firstAccessTime}
                                hour='2-digit'
                                minute='2-digit'
                                second='2-digit'
                                day='2-digit'
                                month='short'
                                year='numeric'
                            />
                        </div>
                        <div>{`${formatMessage(messages.os)} ${currentSession.props.os}`}</div>
                        <div>{`${formatMessage(messages.browser)} ${currentSession.props.browser}`}</div>
                        <div>{`${formatMessage(messages.sessionId)} ${currentSession.id}`}</div>
                    </div>
                );
            } else {
                moreInfo = (
                    <a
                        className='theme'
                        href='#'
                        onClick={this.handleMoreInfo.bind(this, i)}
                    >
                        {formatMessage(messages.moreInfo)}
                    </a>
                );
            }

            activityList[i] = (
                <div
                    key={'activityLogEntryKey' + i}
                    className='activity-log__table'
                >
                    <div className='activity-log__report'>
                        <div className='report__platform'><i className={devicePicture} />{devicePlatform}</div>
                        <div className='report__info'>
                            <div>{formatMessage(messages.lastActivity)}
                                <FormattedDate
                                    value={lastAccessTime}
                                    hour='2-digit'
                                    minute='2-digit'
                                    second='2-digit'
                                    day='2-digit'
                                    month='short'
                                    year='numeric'
                                />
                            </div>
                            {moreInfo}
                        </div>
                    </div>
                    <div className='activity-log__action'>
                        <button
                            onClick={this.submitRevoke.bind(this, currentSession.id)}
                            className='btn btn-primary'
                        >
                            {formatMessage(messages.logout)}
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
            <Modal
                show={this.props.show}
                onHide={this.onHide}
                bsSize='large'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{formatMessage(messages.activeSessions)}</Modal.Title>
                </Modal.Header>
                <Modal.Body ref='modalBody'>
                    <p className='session-help-text'>{formatMessage(messages.sessionsDescription)}</p>
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}

ActivityLogModal.propTypes = {
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired
};

export default injectIntl(ActivityLogModal);