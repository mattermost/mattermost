// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Modal = ReactBootstrap.Modal;
import UserStore from '../stores/user_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import LoadingScreen from './loading_screen.jsx';
import * as Utils from '../utils/utils.jsx';
import {intlShape, injectIntl, defineMessages} from 'react-intl';

const messages = defineMessages({
    sessionId: {
        id: 'access_history.sessionId',
        defaultMessage: 'Session ID: '
    },
    close: {
        id: 'access_history.close',
        defaultMessage: 'Close'
    },
    title: {
        id: 'access_history.title',
        defaultMessage: 'Access History'
    },
    moreInfo: {
        id: 'access_history.moreInfo',
        defaultMessage: 'More info'
    },
    sessionWithId: {
        id: 'access_history.sessionWithId',
        defaultMessage: 'The session with id '
    },
    wasRevoked: {
        id: 'access_history.wasRevoked',
        defaultMessage: ' was revoked'
    },
    created: {
        id: 'access_history.created',
        defaultMessage: 'Created the '
    },
    channelGroup: {
        id: 'access_history.channelGroup',
        defaultMessage: ' channel/group'
    },
    established: {
        id: 'access_history.established',
        defaultMessage: 'Established a direct message channel with '
    },
    updated: {
        id: 'access_history.updated',
        defaultMessage: 'Updated the '
    },
    name: {
        id: 'access_history.name',
        defaultMessage: ' name'
    },
    header: {
        id: 'access_history.header',
        defaultMessage: ' header'
    },
    deleted: {
        id: 'access_history.deleted',
        defaultMessage: 'Deleted the channel/group with the URL '
    },
    added: {
        id: 'access_history.added',
        defaultMessage: 'Added '
    },
    removed: {
        id: 'access_history.removed',
        defaultMessage: 'Removed '
    },
    toThe: {
        id: 'access_history.toThe',
        defaultMessage: ' from the '
    },
    fromThe: {
        id: 'access_history.fromThe',
        defaultMessage: ' to the '
    },
    attemptedRegisterOAuth: {
        id: 'access_history.attemptedRegisterOAuth',
        defaultMessage: 'Attempted to register a new OAuth Application with ID '
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
    failedOAuthToken: {
        id: 'access_history.failedOAuthToken',
        defaultMessage: 'Failed to get an OAuth access token - '
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
        defaultMessage: ' by '
    },
    byAdmin: {
        id: 'access_history.byAdmin',
        defaultMessage: ' by an admin'
    },
    sentMail: {
        id: 'access_history.sentMail',
        defaultMessage: 'Sent an email to '
    },
    toResetPassword: {
        id: 'access_history.toResetPassword',
        defaultMessage: ' to reset your password'
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
        const {formatMessage} = this.props.intl;
        return formatMessage(messages.sessionWithId) + sessionId + formatMessage(messages.wasRevoked);
    }
    formatAuditInfo(currentAudit) {
        const {formatMessage, locale} = this.props.intl;

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

            let userIdField = [];
            let userId = '';
            let username = '';

            switch (currentActionURL) {
            case '/channels/create':
                if (locale === 'en') {
                    currentAuditDesc = formatMessage(messages.created) + channelName + formatMessage(messages.channelGroup);
                } else {
                    currentAuditDesc = formatMessage(messages.created) + formatMessage(messages.channelGroup) + channelName;
                }
                break;
            case '/channels/create_direct':
                currentAuditDesc = formatMessage(messages.established) + Utils.getDirectTeammate(channelObj.id).username;
                break;
            case '/channels/update':
                if (locale === 'en') {
                    currentAuditDesc = formatMessage(messages.updated) + channelName + `${formatMessage(messages.channelGroup) + formatMessage(messages.name)}`;
                } else {
                    currentAuditDesc = formatMessage(messages.updated) + `${formatMessage(messages.name) + formatMessage(messages.channelGroup)} ${channelName}`;
                }
                break;
            case '/channels/update_desc': // support the old path
            case '/channels/update_header':
                if (locale === 'en') {
                    currentAuditDesc = formatMessage(messages.updated) + channelName + `${formatMessage(messages.channelGroup) + formatMessage(messages.header)}`;
                } else {
                    currentAuditDesc = formatMessage(messages.updated) + `${formatMessage(messages.header) + formatMessage(messages.channelGroup)} ${channelName}`;
                }
                break;
            default:
                if (channelInfo[1]) {
                    userIdField = channelInfo[1].split('=');

                    if (userIdField.indexOf('user_id') >= 0) {
                        userId = userIdField[userIdField.indexOf('user_id') + 1];
                        username = UserStore.getProfile(userId).username;
                    }
                }

                if (/\/channels\/[A-Za-z0-9]+\/delete/.test(currentActionURL)) {
                    currentAuditDesc = formatMessage(messages.deleted) + channelURL;
                } else if (/\/channels\/[A-Za-z0-9]+\/add/.test(currentActionURL)) {
                    if (locale === 'en') {
                        currentAuditDesc = formatMessage(messages.added) + username + formatMessage(messages.toThe) + channelName + formatMessage(messages.channelGroup);
                    } else {
                        currentAuditDesc = formatMessage(messages.added) + username + formatMessage(messages.toThe) + formatMessage(messages.channelGroup) + channelName;
                    }
                } else if (/\/channels\/[A-Za-z0-9]+\/remove/.test(currentActionURL)) {
                    if (locale === 'en') {
                        currentAuditDesc = formatMessage(messages.removed) + username + formatMessage(messages.fromThe) + channelName + formatMessage(messages.channelGroup);
                    } else {
                        currentAuditDesc = formatMessage(messages.removed) + username + formatMessage(messages.fromThe) + formatMessage(messages.channelGroup) + channelName;
                    }
                }

                break;
            }
        } else if (currentActionURL.indexOf('/oauth') === 0) {
            const oauthInfo = currentAudit.extra_info.split(' ');

            switch (currentActionURL) {
            case '/oauth/register': {
                const clientIdField = oauthInfo[0].split('=');

                if (clientIdField[0] === 'client_id') {
                    currentAuditDesc = formatMessage(messages.attemptedRegisterOAuth) + clientIdField[1];
                }

                break;
            }
            case '/oauth/allow':
                if (oauthInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(messages.attemptedAllowOAuthAccess);
                } else if (oauthInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(messages.successfullOAuthAccess);
                } else if (oauthInfo[0] === 'fail - redirect_uri did not match registered callback') {
                    currentAuditDesc = formatMessage(messages.failedOAuthAccess);
                }

                break;
            case '/oauth/access_token':
                if (oauthInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(messages.attemptedOAuthToken);
                } else if (oauthInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(messages.successfullOAuthToken);
                } else {
                    const oauthTokenFailure = oauthInfo[0].split('-');

                    if (oauthTokenFailure[0].trim() === 'fail' && oauthTokenFailure[1]) {
                        currentAuditDesc = formatMessage(messages.failedOAuthToken) + oauthTokenFailure[1].trim();
                    }
                }

                break;
            default:
                break;
            }
        } else if (currentActionURL.indexOf('/users') === 0) {
            const userInfo = currentAudit.extra_info.split(' ');
            const userRoles = userInfo[0].split('=')[1];
            const updateType = userInfo[0].split('=')[0];
            const updateField = userInfo[0].split('=')[1];

            switch (currentActionURL) {
            case '/users/login':
                if (userInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(messages.attemptedLogin);
                } else if (userInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(messages.successfullLogin);
                } else if (userInfo[0]) {
                    currentAuditDesc = formatMessage(messages.failedLogin);
                }

                break;
            case '/users/revoke_session':
                currentAuditDesc = this.handleRevokedSession(userInfo[0].split('=')[1]);
                break;
            case '/users/newimage':
                currentAuditDesc = formatMessage(messages.updatePicture);
                break;
            case '/users/update':
                currentAuditDesc = formatMessage(messages.updateGeneral);
                break;
            case '/users/newpassword':
                if (userInfo[0] === 'attempted') {
                    currentAuditDesc = formatMessage(messages.attemptedPassword);
                } else if (userInfo[0] === 'completed') {
                    currentAuditDesc = formatMessage(messages.successfullPassword);
                } else if (userInfo[0] === 'failed - tried to update user password who was logged in through oauth') {
                    currentAuditDesc = formatMessage(messages.failedPassword);
                }

                break;
            case '/users/update_roles':
                currentAuditDesc = formatMessage(messages.updatedRol);
                if (userRoles.trim()) {
                    currentAuditDesc += userRoles;
                } else {
                    currentAuditDesc += formatMessage(messages.member);
                }

                break;
            case '/users/update_active':

                /**
                 * Either describes account activation/deactivation or a revoked session as part of an account deactivation
                 */
                if (updateType === 'active') {
                    if (updateField === 'true') {
                        currentAuditDesc = formatMessage(messages.accountActive);
                    } else if (updateField === 'false') {
                        currentAuditDesc = formatMessage(messages.accountInactive);
                    }

                    const actingUserInfo = userInfo[1].split('=');
                    if (actingUserInfo[0] === 'session_user') {
                        const actingUser = UserStore.getProfile(actingUserInfo[1]);
                        const currentUser = UserStore.getCurrentUser();
                        if (currentUser && actingUser && (Utils.isAdmin(currentUser.roles) || Utils.isSystemAdmin(currentUser.roles))) {
                            currentAuditDesc += formatMessage(messages.by) + actingUser.username;
                        } else if (currentUser && actingUser) {
                            currentAuditDesc += formatMessage(messages.byAdmin);
                        }
                    }
                } else if (updateType === 'session_id') {
                    currentAuditDesc = this.handleRevokedSession(updateField);
                }

                break;
            case '/users/send_password_reset':
                currentAuditDesc = formatMessage(messages.sentMail) + userInfo[0].split('=')[1] + formatMessage(messages.toResetPassword);
                break;
            case '/users/reset_password':
                if (userInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(messages.attemptedReset);
                } else if (userInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(messages.successfullReset);
                }

                break;
            case '/users/update_notify':
                currentAuditDesc = formatMessage(messages.updateGlobalNotifications);
                break;
            default:
                break;
            }
        } else if (currentActionURL.indexOf('/hooks') === 0) {
            const webhookInfo = currentAudit.extra_info.split(' ');

            switch (currentActionURL) {
            case '/hooks/incoming/create':
                if (webhookInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(messages.attemptedWebhookCreate);
                } else if (webhookInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(messages.succcessfullWebhookCreate);
                } else if (webhookInfo[0] === 'fail - bad channel permissions') {
                    currentAuditDesc = formatMessage(messages.failedWebhookCreate);
                }

                break;
            case '/hooks/incoming/delete':
                if (webhookInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(messages.attemptedWebhookDelete);
                } else if (webhookInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(messages.successfullWebhookDelete);
                } else if (webhookInfo[0] === 'fail - inappropriate conditions') {
                    currentAuditDesc = formatMessage(messages.failedWebhookDelete);
                }

                break;
            default:
                break;
            }
        } else {
            switch (currentActionURL) {
            case '/logout':
                currentAuditDesc = formatMessage(messages.logout);
                break;
            case '/verify_email':
                currentAuditDesc = formatMessage(messages.verified);
                break;
            default:
                break;
            }
        }

        /* If all else fails... */
        if (!currentAuditDesc) {
            /* Currently not called anywhere */
            if (currentAudit.extra_info.indexOf('revoked_all=') >= 0) {
                currentAuditDesc = formatMessage(messages.revokedAll);
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
        return currentDate.toLocaleDateString(locale, {weekday: 'long', month: 'short', day: '2-digit', year: 'numeric'}) +
            ' - ' + currentDate.toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'}) + ' | ' + currentAuditDesc;
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
                    {formatMessage(messages.moreInfo)}
                </a>
            );

            if (this.state.moreInfo[i]) {
                if (!currentAudit.session_id) {
                    currentAudit.session_id = 'N/A';

                    if (currentAudit.action.search('/users/login') >= 0) {
                        if (currentAudit.extra_info === 'attempt') {
                            currentAudit.session_id += formatMessage(messages.loginAttempt);
                        } else {
                            currentAudit.session_id += formatMessage(messages.loginFailure);
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
                    <Modal.Title>{formatMessage(messages.title)}</Modal.Title>
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