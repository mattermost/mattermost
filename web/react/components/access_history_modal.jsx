// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Modal = ReactBootstrap.Modal;
import UserStore from '../stores/user_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import LoadingScreen from './loading_screen.jsx';
import * as Utils from '../utils/utils.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    sessionRevoked: {
        id: 'access_history.sessionRevoked',
        defaultMessage: 'The session with id {sessionId} was revoked'
    },
    channelCreated: {
        id: 'access_history.channelCreated',
        defaultMessage: 'Created the {channelName} channel/group'
    },
    establishedDM: {
        id: 'access_history.establishedDM',
        defaultMessage: 'Established a direct message channel with {username}'
    },
    nameUpdated: {
        id: 'access_history.nameUpdated',
        defaultMessage: 'Updated the {channelName} channel/group name'
    },
    headerUpdated: {
        id: 'access_history.headerUpdated',
        defaultMessage: 'Updated the {channelName} channel/group header'
    },
    channelDeleted: {
        id: 'access_history.channelDeleted',
        defaultMessage: 'Deleted the channel/group with the URL {url}'
    },
    userAdded: {
        id: 'access_history.userAdded',
        defaultMessage: 'Added {username} to the {channelName} channel/group'
    },
    userRemoved: {
        id: 'access_history.userRemoved',
        defaultMessage: 'Removed {username} to the {channelName} channel/group'
    },
    attemptedRegisterApp: {
        id: 'access_history.attemptedRegisterApp',
        defaultMessage: 'Attempted to register a new OAuth Application with ID {id}'
    },
    attemptedAllowOAuthAccess: {
        id: 'access_history.attemptedAllowOAuthAccess',
        defaultMessage: 'Attempted to allow a new OAuth service access'
    },
    successfullOAuthAccess: {
        id: 'access_history.successfullOAuthAccess',
        defaultMessage: 'Successfully gave a new OAuth service access'
    },
    failedOAuthAccess: {
        id: 'access_history.failedOAuthAccess',
        defaultMessage: 'Failed to allow a new OAuth service access - the redirect URI did not match the previously registered callback'
    },
    attemptedOAuthToken: {
        id: 'access_history.attemptedOAuthToken',
        defaultMessage: 'Attempted to get an OAuth access token'
    },
    successfullOAuthToken: {
        id: 'access_history.successfullOAuthToken',
        defaultMessage: 'Successfully added a new OAuth service'
    },
    oauthTokenFailed: {
        id: 'access_history.oauthTokenFailed',
        defaultMessage: 'Failed to get an OAuth access token - {token}'
    },
    attemptedLogin: {
        id: 'access_history.attemptedLogin',
        defaultMessage: 'Attempted to login'
    },
    successfullLogin: {
        id: 'access_history.successfullLogin',
        defaultMessage: 'Successfully logged in'
    },
    failedLogin: {
        id: 'access_history.failedLogin',
        defaultMessage: 'FAILED login attempt'
    },
    updatePicture: {
        id: 'access_history.updatePicture',
        defaultMessage: 'Updated your profile picture'
    },
    updateGeneral: {
        id: 'access_history.updateGeneral',
        defaultMessage: 'Updated the general settings of your account'
    },
    attemptedPassword: {
        id: 'access_history.attemptedPassword',
        defaultMessage: 'Attempted to change password'
    },
    successfullPassword: {
        id: 'access_history.successfullPassword',
        defaultMessage: 'Successfully changed password'
    },
    failedPassword: {
        id: 'access_history.failedPassword',
        defaultMessage: 'Failed to change password - tried to update user password who was logged in through oauth'
    },
    updatedRol: {
        id: 'access_history.updatedRol',
        defaultMessage: 'Updated user role(s) to '
    },
    member: {
        id: 'access_history.member',
        defaultMessage: 'member'
    },
    accountActive: {
        id: 'access_history.accountActive',
        defaultMessage: 'Account made active'
    },
    accountInactive: {
        id: 'access_history.accountInactive',
        defaultMessage: 'Account made inactive'
    },
    by: {
        id: 'access_history.by',
        defaultMessage: ' by {username}'
    },
    byAdmin: {
        id: 'access_history.byAdmin',
        defaultMessage: ' by an admin'
    },
    sentEmail: {
        id: 'access_history.sentEmail',
        defaultMessage: 'Sent an email to {email} to reset your password'
    },
    attemptedReset: {
        id: 'access_history.attemptedReset',
        defaultMessage: 'Attempted to reset password'
    },
    successfullReset: {
        id: 'access_history.successfullReset',
        defaultMessage: 'Successfully reset password'
    },
    updateGlobalNotifications: {
        id: 'access_history.updateGlobalNotifications',
        defaultMessage: 'Updated your global notification settings'
    },
    attemptedWebhookCreate: {
        id: 'access_history.attemptedWebhookCreate',
        defaultMessage: 'Attempted to create a webhook'
    },
    succcessfullWebhookCreate: {
        id: 'access_history.successfullWebhookCreate',
        defaultMessage: 'Successfully created a webhook'
    },
    failedWebhookCreate: {
        id: 'access_history.failedWebhookCreate',
        defaultMessage: 'Failed to create a webhook - bad channel permissions'
    },
    attemptedWebhookDelete: {
        id: 'access_history.attemptedWebhookDelete',
        defaultMessage: 'Attempted to delete a webhook'
    },
    successfullWebhookDelete: {
        id: 'access_history.successfullWebhookDelete',
        defaultMessage: 'Successfully deleted a webhook'
    },
    failedWebhookDelete: {
        id: 'access_history.failedWebhookDelete',
        defaultMessage: 'Failed to delete a webhook - inappropriate conditions'
    },
    logout: {
        id: 'access_history.logout',
        defaultMessage: 'Logged out of your account'
    },
    verified: {
        id: 'access_history.verified',
        defaultMessage: 'Sucessfully verified your email address'
    },
    revokedAll: {
        id: 'access_history.revokedAll',
        defaultMessage: 'Revoked all current sessions for the team'
    },
    loginAttempt: {
        id: 'access_history.loginAttempt',
        defaultMessage: ' (Login attempt)'
    },
    loginFailure: {
        id: 'access_history.loginFailure',
        defaultMessage: ' (Login failure)'
    }
});

class AccessHistoryModal extends React.Component {
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
        return this.props.intl.formatMessage(holders.sessionRevoked, {sessionId: sessionId});
    }
    formatAuditInfo(currentAudit) {
        const currentActionURL = currentAudit.action.replace(/\/api\/v[1-9]/, '');

        const {formatMessage} = this.props.intl;
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
                currentAuditDesc = formatMessage(holders.channelCreated, {channelName: channelName});
                break;
            case '/channels/create_direct':
                currentAuditDesc = formatMessage(holders.establishedDM, {username: Utils.getDirectTeammate(channelObj.id).username});
                break;
            case '/channels/update':
                currentAuditDesc = formatMessage(holders.nameUpdated, {channelName: channelName});
                break;
            case '/channels/update_desc': // support the old path
            case '/channels/update_header':
                currentAuditDesc = formatMessage(holders.headerUpdated, {channelName: channelName});
                break;
            default: {
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
                    currentAuditDesc = formatMessage(holders.channelDeleted, {url: channelURL});
                } else if (/\/channels\/[A-Za-z0-9]+\/add/.test(currentActionURL)) {
                    currentAuditDesc = formatMessage(holders.userAdded, {username: username, channelName: channelName});
                } else if (/\/channels\/[A-Za-z0-9]+\/remove/.test(currentActionURL)) {
                    currentAuditDesc = formatMessage(holders.userRemoved, {username: username, channelName: channelName});
                }

                break;
            }
            }
        } else if (currentActionURL.indexOf('/oauth') === 0) {
            const oauthInfo = currentAudit.extra_info.split(' ');

            switch (currentActionURL) {
            case '/oauth/register': {
                const clientIdField = oauthInfo[0].split('=');

                if (clientIdField[0] === 'client_id') {
                    currentAuditDesc = formatMessage(holders.attemptedRegisterApp, {id: clientIdField[1]});
                }

                break;
            }
            case '/oauth/allow':
                if (oauthInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(holders.attemptedAllowOAuthAccess);
                } else if (oauthInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.successfullOAuthAccess);
                } else if (oauthInfo[0] === 'fail - redirect_uri did not match registered callback') {
                    currentAuditDesc = formatMessage(holders.failedOAuthAccess);
                }

                break;
            case '/oauth/access_token':
                if (oauthInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(holders.attemptedOAuthToken);
                } else if (oauthInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.successfullOAuthToken);
                } else {
                    const oauthTokenFailure = oauthInfo[0].split('-');

                    if (oauthTokenFailure[0].trim() === 'fail' && oauthTokenFailure[1]) {
                        currentAuditDesc = formatMessage(oauthTokenFailure, {token: oauthTokenFailure[1].trim()});
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
                    currentAuditDesc = formatMessage(holders.attemptedLogin);
                } else if (userInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.successfullLogin);
                } else if (userInfo[0]) {
                    currentAuditDesc = formatMessage(holders.failedLogin);
                }

                break;
            case '/users/revoke_session':
                currentAuditDesc = this.handleRevokedSession(userInfo[0].split('=')[1]);
                break;
            case '/users/newimage':
                currentAuditDesc = formatMessage(holders.updatePicture);
                break;
            case '/users/update':
                currentAuditDesc = formatMessage(holders.updateGeneral);
                break;
            case '/users/newpassword':
                if (userInfo[0] === 'attempted') {
                    currentAuditDesc = formatMessage(holders.attemptedPassword);
                } else if (userInfo[0] === 'completed') {
                    currentAuditDesc = formatMessage(holders.successfullPassword);
                } else if (userInfo[0] === 'failed - tried to update user password who was logged in through oauth') {
                    currentAuditDesc = formatMessage(holders.failedPassword);
                }

                break;
            case '/users/update_roles': {
                const userRoles = userInfo[0].split('=')[1];

                currentAuditDesc = formatMessage(holders.updatedRol);
                if (userRoles.trim()) {
                    currentAuditDesc += userRoles;
                } else {
                    currentAuditDesc += formatMessage(holders.member);
                }

                break;
            }
            case '/users/update_active': {
                const updateType = userInfo[0].split('=')[0];
                const updateField = userInfo[0].split('=')[1];

                /* Either describes account activation/deactivation or a revoked session as part of an account deactivation */
                if (updateType === 'active') {
                    if (updateField === 'true') {
                        currentAuditDesc = formatMessage(holders.accountActive);
                    } else if (updateField === 'false') {
                        currentAuditDesc = formatMessage(holders.accountInactive);
                    }

                    const actingUserInfo = userInfo[1].split('=');
                    if (actingUserInfo[0] === 'session_user') {
                        const actingUser = UserStore.getProfile(actingUserInfo[1]);
                        const currentUser = UserStore.getCurrentUser();
                        if (currentUser && actingUser && (Utils.isAdmin(currentUser.roles) || Utils.isSystemAdmin(currentUser.roles))) {
                            currentAuditDesc += formatMessage(holders.by, {username: actingUser.username});
                        } else if (currentUser && actingUser) {
                            currentAuditDesc += formatMessage(holders.byAdmin);
                        }
                    }
                } else if (updateType === 'session_id') {
                    currentAuditDesc = this.handleRevokedSession(updateField);
                }

                break;
            }
            case '/users/send_password_reset':
                currentAuditDesc = formatMessage(holders.sentEmail, {email: userInfo[0].split('=')[1]});
                break;
            case '/users/reset_password':
                if (userInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(holders.attemptedReset);
                } else if (userInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.successfullReset);
                }

                break;
            case '/users/update_notify':
                currentAuditDesc = formatMessage(holders.updateGlobalNotifications);
                break;
            default:
                break;
            }
        } else if (currentActionURL.indexOf('/hooks') === 0) {
            const webhookInfo = currentAudit.extra_info.split(' ');

            switch (currentActionURL) {
            case '/hooks/incoming/create':
                if (webhookInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(holders.attemptedWebhookCreate);
                } else if (webhookInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.succcessfullWebhookCreate);
                } else if (webhookInfo[0] === 'fail - bad channel permissions') {
                    currentAuditDesc = formatMessage(holders.failedWebhookCreate);
                }

                break;
            case '/hooks/incoming/delete':
                if (webhookInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(holders.attemptedWebhookDelete);
                } else if (webhookInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.successfullWebhookDelete);
                } else if (webhookInfo[0] === 'fail - inappropriate conditions') {
                    currentAuditDesc = formatMessage(holders.failedWebhookDelete);
                }

                break;
            default:
                break;
            }
        } else {
            switch (currentActionURL) {
            case '/logout':
                currentAuditDesc = formatMessage(holders.logout);
                break;
            case '/verify_email':
                currentAuditDesc = formatMessage(holders.verified);
                break;
            default:
                break;
            }
        }

        /* If all else fails... */
        if (!currentAuditDesc) {
            /* Currently not called anywhere */
            if (currentAudit.extra_info.indexOf('revoked_all=') >= 0) {
                currentAuditDesc = formatMessage(holders.revokedAll);
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
        const currentAuditInfo = currentDate.toLocaleDateString(global.window.mm_locale, {month: 'short', day: '2-digit', year: 'numeric'}) + ' - ' +
            currentDate.toLocaleTimeString(global.window.mm_locale, {hour: '2-digit', minute: '2-digit'}) + ' | ' + currentAuditDesc;
        return currentAuditInfo;
    }
    render() {
        var accessList = [];

        const {formatMessage} = this.props.intl;
        for (var i = 0; i < this.state.audits.length; i++) {
            const currentAudit = this.state.audits[i];
            const currentAuditInfo = this.formatAuditInfo(currentAudit);

            var moreInfo = (
                <a
                    href='#'
                    className='theme'
                    onClick={this.handleMoreInfo.bind(this, i)}
                >
                    <FormattedMessage
                        id='access_history.moreInfo'
                        defaultMessage='More info'
                    />
                </a>
            );

            if (this.state.moreInfo[i]) {
                if (!currentAudit.session_id) {
                    currentAudit.session_id = 'N/A';

                    if (currentAudit.action.search('/users/login') >= 0) {
                        if (currentAudit.extra_info === 'attempt') {
                            currentAudit.session_id += formatMessage(holders.loginAttempt);
                        } else {
                            currentAudit.session_id += formatMessage(holders.loginFailure);
                        }
                    }
                }

                moreInfo = (
                    <div>
                        <div>
                            <FormattedMessage
                                id='access_history.ip'
                                defaultMessage='IP: {ip}'
                                values={{
                                    ip: currentAudit.ip_address
                                }}
                            />
                        </div>
                        <div>
                            <FormattedMessage
                                id='access_history.session'
                                defaultMessage='Session ID: {id}'
                                values={{
                                    id: currentAudit.session_id
                                }}
                            />
                        </div>
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
                    <Modal.Title>
                        <FormattedMessage
                            id='access_history.title'
                            defaultMessage='Access History'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body ref='modalBody'>
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}

AccessHistoryModal.propTypes = {
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired
};

export default injectIntl(AccessHistoryModal);