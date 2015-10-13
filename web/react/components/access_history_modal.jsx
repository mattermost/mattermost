// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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
        this.onHide = this.onHide.bind(this);
        this.onShow = this.onShow.bind(this);
        this.formatAuditInfo = this.formatAuditInfo.bind(this);

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
    }
    onHide() {
        $('#user_settings').modal('show');
        this.setState({moreInfo: []});
    }
    componentDidMount() {
        UserStore.addAuditsChangeListener(this.onAuditChange);
        $(React.findDOMNode(this.refs.modal)).on('shown.bs.modal', this.onShow);

        $(React.findDOMNode(this.refs.modal)).on('hidden.bs.modal', this.onHide);
    }
    componentWillUnmount() {
        UserStore.removeAuditsChangeListener(this.onAuditChange);
    }
    onAuditChange() {
        var newState = this.getStateFromStoresForAudits();
        if (!Utils.areStatesEqual(newState.audits, this.state.audits)) {
            this.setState(newState);
        }
    }
    handleMoreInfo(index) {
        var newMoreInfo = this.state.moreInfo;
        newMoreInfo[index] = true;
        this.setState({moreInfo: newMoreInfo});
    }
    formatAuditInfo(currentAudit) {
        const currentActionURL = currentAudit.action.replace(/\/api\/v[1-9]/, '');

        let currentAuditDesc = '';

        /* Handle audit formatting semi-individually for each type and
            fall back to a best guess case if none exists

            Supported audits:
                /channels
                - Create Channel
                - Create Direct Channel
                - Update Channel
                - Update Channel Description
                - Delete Channel X
                - Add User to Channel X
                - Remove User from Channel X

                /oauth
                - Register X
                - Allow Attempt/Success/Failure X

                /team
                - Revoke All Sessions X (NO CORRESPONDING ADDRESS/FUNCTION)

                - Revoke Session X
                - Update (users - ?) X
                - Update Notify (?) X
                - Login Attempt X
                - Login (success/failure) X
                - Logout (/logout) X
                - Verify Email (/verify_email) X
        */
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
            case '/channels/update_desc':
                currentAuditDesc = 'Updated the ' + channelName + ' channel/group description';
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
            switch (currentActionURL) {
            case '/oauth/register':
                break;
            case '/oauth/allow':
                break;
            case '/oauth/access_token':
                break;
            default:
                break;
            }
        } else if (currentActionURL.indexOf('/users') === 0) {
            const userInfo = currentAudit.extra_info.split(' ');
            switch (currentActionURL) {
            case '/users/login':
                if (userInfo[0] === 'attempt') {
                    currentAuditDesc = 'Login attempted';
                } else if (userInfo[0] === 'success') {
                    currentAuditDesc = 'Successful login attempt';
                } else if (userInfo[0]) {
                    currentAuditDesc = 'FAILED login attempt';
                }

                break;
            case '/users/revoke_session':
                const revokedSessionId = userInfo[0].split('=')[1];

                currentAuditDesc = 'Revoked the session with id ' + revokedSessionId;
                break;
            case '/users/newimage':
                currentAuditDesc = 'Updated your profile picture';
                break;
            case '/users/update':
                currentAuditDesc = 'Updated the general settings of your account';
                break;
            case '/users/newpassword':
                if (userInfo[0] === 'attempted') {
                    currentAuditDesc = 'Password change attempted';
                } else if (userInfo[0] === 'completed') {
                    currentAuditDesc = 'Password change success';
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
                break;
            case '/users/send_password_reset':
                break;
            case '/users/reset_password':
                break;
            case '/users/update_notify':
                break;
            default:
                break;
            }
        } else if (currentActionURL.indexOf('/hooks') === 0) {
            switch (currentActionURL) {
            case '/hooks/incoming/create':
                break;
            case '/hooks/incoming/delete':
                break;
            default:
                break;
            }
        } else {
            switch (currentActionURL) {
            case '/logout':
                break;
            case '/verify_email':
                break;
            default:
                break;
            }
        }

        /* If all else fails... */
        if (!currentAuditDesc) {
            if (currentAudit.extra_info.indexOf('revoked_all=') >= 0) {

                // do stuff
            } else {
                let currentActionDesc = ' ';
                if (currentActionURL && currentActionURL.lastIndexOf('/') !== -1) {
                    currentActionDesc = currentActionURL.substring(currentActionURL.lastIndexOf('/') + 1).replace('_', ' ');
                    currentActionDesc = Utils.toTitleCase(currentActionDesc);
                }

                let currentExtraInfoDesc = ' ';
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
                if (!currentAudit.session_id && currentAudit.action.search('/users/login') !== -1) {
                    if (currentAudit.extra_info === 'attempt') {
                        currentAudit.session_id = 'N/A (Login attempt)';
                    } else {
                        currentAudit.session_id = 'N/A (Login failure)';
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
            <div>
                <div
                    className='modal fade'
                    ref='modal'
                    id='access-history'
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
                                    <span aria-hidden='true'>{'×'}</span>
                                </button>
                                <h4
                                    className='modal-title'
                                    id='myModalLabel'
                                >
                                    {'Access History'}
                                </h4>
                            </div>
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
