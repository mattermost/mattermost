// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var LoadingScreen = require('./loading_screen.jsx');
var utils = require('../utils/utils.jsx');

function getStateFromStoresForSessions() {
    return {
        sessions: UserStore.getSessions(),
        serverError: null,
        clientError: null
    };
}

module.exports = React.createClass({
    displayName: 'ActivityLogModal',
    submitRevoke: function(altId) {
        Client.revokeSession(altId,
            function(data) {
                AsyncClient.getSessions();
            }.bind(this),
            function(err) {
                var state = getStateFromStoresForSessions();
                state.serverError = err;
                this.setState(state);
            }.bind(this)
        );
    },
    componentDidMount: function() {
        UserStore.addSessionsChangeListener(this.onListenerChange);
        $(this.refs.modal.getDOMNode()).on('shown.bs.modal', function (e) {
            AsyncClient.getSessions();
        });

        var self = this;
        $(this.refs.modal.getDOMNode()).on('hidden.bs.modal', function(e) {
            $('#user_settings1').modal('show');
            self.setState({moreInfo: []});
        });
    },
    componentWillUnmount: function() {
        UserStore.removeSessionsChangeListener(this.onListenerChange);
    },
    onListenerChange: function() {
        var newState = getStateFromStoresForSessions();
        if (!utils.areStatesEqual(newState.sessions, this.state.sessions)) {
            this.setState(newState);
        }
    },
    handleMoreInfo: function(index) {
        var newMoreInfo = this.state.moreInfo;
        newMoreInfo[index] = true;
        this.setState({moreInfo: newMoreInfo});
    },
    getInitialState: function() {
        var initialState = getStateFromStoresForSessions();
        initialState.moreInfo = [];
        return initialState;
    },
    render: function() {
        var activityList = [];
        var serverError = this.state.serverError;

        // Squash any false-y value for server error into null
        if (!serverError) {
            serverError = null;
        }

        for (var i = 0; i < this.state.sessions.length; i++) {
            var currentSession = this.state.sessions[i];
            var lastAccessTime = new Date(currentSession.last_activity_at);
            var firstAccessTime = new Date(currentSession.create_at);
            var devicePicture = '';

            if (currentSession.props.platform === 'Windows') {
                devicePicture = 'fa fa-windows';
            }
            else if (currentSession.props.platform === 'Macintosh' || currentSession.props.platform === 'iPhone') {
                devicePicture = 'fa fa-apple';
            }
            else if (currentSession.props.platform === 'Linux') {
                devicePicture = 'fa fa-linux';
            }

            var moreInfo;
            if (this.state.moreInfo[i]) {
                moreInfo = (
                    <div>
                        <div>{'First time active: ' + firstAccessTime.toDateString() + ', ' + lastAccessTime.toLocaleTimeString()}</div>
                        <div>{'OS: ' + currentSession.props.os}</div>
                        <div>{'Browser: ' + currentSession.props.browser}</div>
                        <div>{'Session ID: ' + currentSession.alt_id}</div>
                    </div>
                );
            } else {
                moreInfo = (<a className='theme' href='#' onClick={this.handleMoreInfo.bind(this, i)}>More info</a>);
            }

            activityList[i] = (
                <div className='activity-log__table'>
                    <div className='activity-log__report'>
                        <div className='report__platform'><i className={devicePicture} />{currentSession.props.platform}</div>
                        <div className='report__info'>
                            <div>{'Last activity: ' + lastAccessTime.toDateString() + ', ' + lastAccessTime.toLocaleTimeString()}</div>
                            {moreInfo}
                        </div>
                    </div>
                    <div className='activity-log__action'><button onClick={this.submitRevoke.bind(this, currentSession.alt_id)} className='btn btn-primary'>Logout</button></div>
                </div>
            );
        }

        var content;
        if (this.state.sessions.loading) {
            content = (<LoadingScreen />);
        } else {
            content = (<form role='form'>{activityList}</form>);
        }

        return (
            <div>
                <div className='modal fade' ref='modal' id='activity-log' tabIndex='-1' role='dialog' aria-hidden='true'>
                    <div className='modal-dialog modal-lg'>
                        <div className='modal-content'>
                            <div className='modal-header'>
                                <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
                                <h4 className='modal-title' id='myModalLabel'>Active Sessions</h4>
                            </div>
                            <p className='session-help-text'>Sessions are created when you log in with your email and password to a new browser on a device. Sessions let you use Mattermost for up to 30 days without having to log in again. If you want to log out sooner, use the 'Logout' button below to end a session.</p>
                            <div ref='modalBody' className='modal-body'>
                                {content}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});
