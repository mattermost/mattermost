// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Modal = ReactBootstrap.Modal;
var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var LoadingScreen = require('./loading_screen.jsx');
var Utils = require('../utils/utils.jsx');

export default class AccessHistoryModal extends React.Component {
    constructor(props) {
        super(props);

        this.onAuditChange = this.onAuditChange.bind(this);
        this.handleMoreInfo = this.handleMoreInfo.bind(this);
        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);
        this.formatAuditInfo = this.formatAuditInfo.bind(this);
        this.handleRevokedSession = this.handleRevokedSession.bind(this);

        const state = this.getStateFromStoresForAudits();
        state.moreInfo = [];

        this.state = state;
    }
    getStateFromStoresForAudits() {
        return {
            audits: UserStore.getAudits()
        };
    }
    onShow() {
        AsyncClient.getAudits();

        $(ReactDOM.findDOMNode(this.refs.modalBody)).css('max-height', $(window).height() - 300);
        if ($(window).width() > 768) {
            $(ReactDOM.findDOMNode(this.refs.modalBody)).perfectScrollbar();
        }
    }
    onHide() {
        this.setState({moreInfo: []});
        this.props.onHide();
    }
    componentDidMount() {
        UserStore.addAuditsChangeListener(this.onAuditChange);

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
        UserStore.removeAuditsChangeListener(this.onAuditChange);
    }
    onAuditChange() {
        var newState = this.getStateFromStoresForAudits();
        if (!Utils.areObjectsEqual(newState.audits, this.state.audits)) {
            this.setState(newState);
        }
    }
    handleMoreInfo(index) {
        var newMoreInfo = this.state.moreInfo;
        newMoreInfo[index] = true;
        this.setState({moreInfo: newMoreInfo});
    }
    handleRevokedSession(sessionId) {
        return 'The session with id ' + sessionId + ' was revoked';
    }
    formatAuditInfo(currentAudit) {
        const currentActionURL = currentAudit.action.replace(/\/api\/v[1-9]/, '');

        let currentAuditDesc = '';

        if (currentActionURL.indexOf('/channels') === 0) {
            const channelInfo = currentAudit.extra_info.split(' ');
            const channelNameField = channelInfo[0].split('=');

            let channelURL = '';
            let channelObj;
            let channelName = '';
            if (channelNameField.indexOf('name') >= 0) {
                channelURL = channelNameField[channelNameField.indexOf('name') + 1];
                channelObj = ChannelStore.getByName(channelURL);
                if (channelObj) {
                    channelName = channelObj.display_name;
                } else {
                    channelName = channelURL;
                }
            }

            switch (currentActionURL) {
            case '/channels/create':
                currentAuditDesc = 'Created the ' + channelName + ' channel/group';
                break;
            case '/channels/create_direct':
                currentAuditDesc = 'Established a direct message channel with ' + Utils.getDirectTeammate(channelObj.id).username;
                break;
            case '/channels/update':
                currentAuditDesc = 'Updated the ' + channelName + ' channel/group name';
                break;
            case '/channels/update_desc': // support the old path
            case '/channels/update_header':
                currentAuditDesc = 'Updated the ' + channelName + ' channel/group header';
                break;
            default:
                let userIdField = [];
                let userId = '';
                let username = '';

                if (channelInfo[1]) {
                    userIdField = channelInfo[1].split('=');

                    if (userIdField.indexOf('user_id') >= 0) {
                        userId = userIdField[userIdField.indexOf('user_id') + 1];
                        username = UserStore.getProfile(userId).username;
                    }
                }

                if (/\/channels\/[A-Za-z0-9]+\/delete/.test(currentActionURL)) {
                    currentAuditDesc = 'Deleted the channel/group with the URL ' + channelURL;
                } else if (/\/channels\/[A-Za-z0-9]+\/add/.test(currentActionURL)) {
                    currentAuditDesc = 'Added ' + username + ' to the ' + channelName + ' channel/group';
                } else if (/\/channels\/[A-Za-z0-9]+\/remove/.test(currentActionURL)) {
                    currentAuditDesc = 'Removed ' + username + ' from the ' + channelName + ' channel/group';
                }

                break;
            }
        } else if (currentActionURL.indexOf('/oauth') === 0) {
            const oauthInfo = currentAudit.extra_info.split(' ');

            switch (currentActionURL) {
            case '/oauth/register':
                const clientIdField = oauthInfo[0].split('=');

                if (clientIdField[0] === 'client_id') {
                    currentAuditDesc = 'Attempted to register a new OAuth Application with ID ' + clientIdField[1];
                }

                break;
            case '/oauth/allow':
                if (oauthInfo[0] === 'attempt') {
                    currentAuditDesc = 'Attempted to allow a new OAuth service access';
                } else if (oauthInfo[0] === 'success') {
                    currentAuditDesc = 'Successfully gave a new OAuth service access';
                } else if (oauthInfo[0] === 'fail - redirect_uri did not match registered callback') {
                    currentAuditDesc = 'Failed to allow a new OAuth service access - the redirect URI did not match the previously registered callback';
                }

                break;
            case '/oauth/access_token':
                if (oauthInfo[0] === 'attempt') {
                    currentAuditDesc = 'Attempted to get an OAuth access token';
                } else if (oauthInfo[0] === 'success') {
                    currentAuditDesc = 'Successfully added a new OAuth service';
                } else {
                    const oauthTokenFailure = oauthInfo[0].split('-');

                    if (oauthTokenFailure[0].trim() === 'fail' && oauthTokenFailure[1]) {
                        currentAuditDesc = 'Failed to get an OAuth access token - ' + oauthTokenFailure[1].trim();
                    }
                }

                break;
            default:
                break;
            }
        } else if (currentActionURL.indexOf('/users') === 0) {
            const userInfo = currentAudit.extra_info.split(' ');

            switch (currentActionURL) {
            case '/users/login':
                if (userInfo[0] === 'attempt') {
                    currentAuditDesc = 'Attempted to login';
                } else if (userInfo[0] === 'success') {
                    currentAuditDesc = 'Successfully logged in';
                } else if (userInfo[0]) {
                    currentAuditDesc = 'FAILED login attempt';
                }

                break;
            case '/users/revoke_session':
                currentAuditDesc = this.handleRevokedSession(userInfo[0].split('=')[1]);
                break;
            case '/users/newimage':
                currentAuditDesc = 'Updated your profile picture';
                break;
            case '/users/update':
                currentAuditDesc = 'Updated the general settings of your account';
                break;
            case '/users/newpassword':
                if (userInfo[0] === 'attempted') {
                    currentAuditDesc = 'Attempted to change password';
                } else if (userInfo[0] === 'completed') {
                    currentAuditDesc = 'Successfully changed password';
                } else if (userInfo[0] === 'failed - tried to update user password who was logged in through oauth') {
                    currentAuditDesc = 'Failed to change password - tried to update user password who was logged in through oauth';
                }

                break;
            case '/users/update_roles':
                const userRoles = userInfo[0].split('=')[1];

                currentAuditDesc = 'Updated user role(s) to ';
                if (userRoles.trim()) {
                    currentAuditDesc += userRoles;
                } else {
                    currentAuditDesc += 'member';
                }

                break;
            case '/users/update_active':
                const updateType = userInfo[0].split('=')[0];
                const updateField = userInfo[0].split('=')[1];

                /* Either describes account activation/deactivation or a revoked session as part of an account deactivation */
                if (updateType === 'active') {
                    if (updateField === 'true') {
                        currentAuditDesc = 'Account made active';
                    } else if (updateField === 'false') {
                        currentAuditDesc = 'Account made inactive';
                    }

                    const actingUserInfo = userInfo[1].split('=');
                    if (actingUserInfo[0] === 'session_user') {
                        const actingUser = UserStore.getProfile(actingUserInfo[1]);
                        const currentUser = UserStore.getCurrentUser();
                        if (currentUser && actingUser && (Utils.isAdmin(currentUser.roles) || Utils.isSystemAdmin(currentUser.roles))) {
                            currentAuditDesc += ' by ' + actingUser.username;
                        } else if (currentUser && actingUser) {
                            currentAuditDesc += ' by an admin';
                        }
                    }
                } else if (updateType === 'session_id') {
                    currentAuditDesc = this.handleRevokedSession(updateField);
                }

                break;
            case '/users/send_password_reset':
                currentAuditDesc = 'Sent an email to ' + userInfo[0].split('=')[1] + ' to reset your password';
                break;
            case '/users/reset_password':
                if (userInfo[0] === 'attempt') {
                    currentAuditDesc = 'Attempted to reset password';
                } else if (userInfo[0] === 'success') {
                    currentAuditDesc = 'Successfully reset password';
                }

                break;
            case '/users/update_notify':
                currentAuditDesc = 'Updated your global notification settings';
                break;
            default:
                break;
            }
        } else if (currentActionURL.indexOf('/hooks') === 0) {
            const webhookInfo = currentAudit.extra_info.split(' ');

            switch (currentActionURL) {
            case '/hooks/incoming/create':
                if (webhookInfo[0] === 'attempt') {
                    currentAuditDesc = 'Attempted to create a webhook';
                } else if (webhookInfo[0] === 'success') {
                    currentAuditDesc = 'Successfully created a webhook';
                } else if (webhookInfo[0] === 'fail - bad channel permissions') {
                    currentAuditDesc = 'Failed to create a webhook - bad channel permissions';
                }

                break;
            case '/hooks/incoming/delete':
                if (webhookInfo[0] === 'attempt') {
                    currentAuditDesc = 'Attempted to delete a webhook';
                } else if (webhookInfo[0] === 'success') {
                    currentAuditDesc = 'Successfully deleted a webhook';
                } else if (webhookInfo[0] === 'fail - inappropriate conditions') {
                    currentAuditDesc = 'Failed to delete a webhook - inappropriate conditions';
                }

                break;
            default:
                break;
            }
        } else {
            switch (currentActionURL) {
            case '/logout':
                currentAuditDesc = 'Logged out of your account';
                break;
            case '/verify_email':
                currentAuditDesc = 'Sucessfully verified your email address';
                break;
            default:
                break;
            }
        }

        /* If all else fails... */
        if (!currentAuditDesc) {
            /* Currently not called anywhere */
            if (currentAudit.extra_info.indexOf('revoked_all=') >= 0) {
                currentAuditDesc = 'Revoked all current sessions for the team';
            } else {
                let currentActionDesc = '';
                if (currentActionURL && currentActionURL.lastIndexOf('/') !== -1) {
                    currentActionDesc = currentActionURL.substring(currentActionURL.lastIndexOf('/') + 1).replace('_', ' ');
                    currentActionDesc = Utils.toTitleCase(currentActionDesc);
                }

                let currentExtraInfoDesc = '';
                if (currentAudit.extra_info) {
                    currentExtraInfoDesc = currentAudit.extra_info;

                    if (currentExtraInfoDesc.indexOf('=') !== -1) {
                        currentExtraInfoDesc = currentExtraInfoDesc.substring(currentExtraInfoDesc.indexOf('=') + 1);
                    }
                }
                currentAuditDesc = currentActionDesc + ' ' + currentExtraInfoDesc;
            }
        }

        const currentDate = new Date(currentAudit.create_at);
        const currentAuditInfo = currentDate.toDateString() + ' - ' + currentDate.toLocaleTimeString(navigator.language, {hour: '2-digit', minute: '2-digit'}) + ' | ' + currentAuditDesc;
        return currentAuditInfo;
    }
    render() {
        var accessList = [];

        for (var i = 0; i < this.state.audits.length; i++) {
            const currentAudit = this.state.audits[i];
            const currentAuditInfo = this.formatAuditInfo(currentAudit);

            var moreInfo = (
                <a
                    href='#'
                    className='theme'
                    onClick={this.handleMoreInfo.bind(this, i)}
                >
                    {'More info'}
                </a>
            );

            if (this.state.moreInfo[i]) {
                if (!currentAudit.session_id) {
                    currentAudit.session_id = 'N/A';

                    if (currentAudit.action.search('/users/login') >= 0) {
                        if (currentAudit.extra_info === 'attempt') {
                            currentAudit.session_id += ' (Login attempt)';
                        } else {
                            currentAudit.session_id += ' (Login failure)';
                        }
                    }
                }

                moreInfo = (
                    <div>
                        <div>{'IP: ' + currentAudit.ip_address}</div>
                        <div>{'Session ID: ' + currentAudit.session_id}</div>
                    </div>
                );
            }

            var divider = null;
            if (i < this.state.audits.length - 1) {
                divider = (<div className='divider-light'></div>);
            }

            accessList[i] = (
                <div
                    key={'accessHistoryEntryKey' + i}
                    className='access-history__table'
                >
                    <div className='access__report'>
                        <div className='report__time'>{currentAuditInfo}</div>
                        <div className='report__info'>
                            {moreInfo}
                        </div>
                        {divider}
                    </div>
                </div>
            );
        }

        var content;
        if (this.state.audits.loading) {
            content = (<LoadingScreen />);
        } else {
            content = (<form role='form'>{accessList}</form>);
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.onHide}
                bsSize='large'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{'Access History'}</Modal.Title>
                </Modal.Header>
                <Modal.Body ref='modalBody'>
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}

AccessHistoryModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired
};
