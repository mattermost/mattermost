// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from '../stores/user_store.jsx';
import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
const Modal = ReactBootstrap.Modal;
import LoadingScreen from './loading_screen.jsx';
import * as Utils from '../utils/utils.jsx';

export default class ActivityLogModal extends React.Component {
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
        let activityList = [];

        for (let i = 0; i < this.state.sessions.length; i++) {
            const currentSession = this.state.sessions[i];
            const lastAccessTime = new Date(currentSession.last_activity_at);
            const firstAccessTime = new Date(currentSession.create_at);
            let devicePlatform = currentSession.props.platform;
            let devicePicture = '';

            if (currentSession.props.platform === 'Windows') {
                devicePicture = 'fa fa-windows';
            } else if (currentSession.device_id.indexOf('apple:') === 0) {
                devicePicture = 'fa fa-apple';
                devicePlatform = 'iPhone Native App';
            } else if (currentSession.device_id.indexOf('Android:') === 0) {
                devicePlatform = 'Android Native App';
                devicePicture = 'fa fa-android';
            } else if (currentSession.props.platform === 'Macintosh' ||
                currentSession.props.platform === 'iPhone') {
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
                        <div>{`First time active: ${firstAccessTime.toDateString()}, ${lastAccessTime.toLocaleTimeString()}`}</div>
                        <div>{`OS: ${currentSession.props.os}`}</div>
                        <div>{`Browser: ${currentSession.props.browser}`}</div>
                        <div>{`Session ID: ${currentSession.id}`}</div>
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
                        <div className='report__platform'><i className={devicePicture} />{devicePlatform}</div>
                        <div className='report__info'>
                            <div>{`Last activity: ${lastAccessTime.toDateString()}, ${lastAccessTime.toLocaleTimeString()}`}</div>
                            {moreInfo}
                        </div>
                    </div>
                    <div className='activity-log__action'>
                        <button
                            onClick={this.submitRevoke.bind(this, currentSession.id)}
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
            <Modal
                show={this.props.show}
                onHide={this.onHide}
                bsSize='large'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{'Active Sessions'}</Modal.Title>
                </Modal.Header>
                <Modal.Body ref='modalBody'>
                    <p className='session-help-text'>{'Sessions are created when you log in with your email and password to a new browser on a device. Sessions let you use Mattermost for up to 30 days without having to log in again. If you want to log out sooner, use the \'Logout\' button below to end a session.'}</p>
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}

ActivityLogModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired
};
