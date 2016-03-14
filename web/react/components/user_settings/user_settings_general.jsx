// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import SettingPicture from '../setting_picture.jsx';

import UserStore from '../../stores/user_store.jsx';
import ErrorStore from '../../stores/error_store.jsx';

import * as Client from '../../utils/client.jsx';
import Constants from '../../utils/constants.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import * as Utils from '../../utils/utils.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage, FormattedDate} from 'mm-intl';

const holders = defineMessages({
    usernameReserved: {
        id: 'user.settings.general.usernameReserved',
        defaultMessage: 'This username is reserved, please choose a new one.'
    },
    usernameRestrictions: {
        id: 'user.settings.general.usernameRestrictions',
        defaultMessage: "Username must begin with a letter, and contain between {min} to {max} lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'."
    },
    validEmail: {
        id: 'user.settings.general.validEmail',
        defaultMessage: 'Please enter a valid email address'
    },
    emailMatch: {
        id: 'user.settings.general.emailMatch',
        defaultMessage: 'The new emails you entered do not match.'
    },
    checkEmail: {
        id: 'user.settings.general.checkEmail',
        defaultMessage: 'Check your email at {email} to verify the address.'
    },
    newAddress: {
        id: 'user.settings.general.newAddress',
        defaultMessage: 'New Address: {email}<br />Check your email to verify the above address.'
    },
    checkEmailNoAddress: {
        id: 'user.settings.general.checkEmailNoAddress',
        defaultMessage: 'Check your email to verify your new address'
    },
    loginGitlab: {
        id: 'user.settings.general.loginGitlab',
        defaultMessage: 'Log in done through GitLab'
    },
    validImage: {
        id: 'user.settings.general.validImage',
        defaultMessage: 'Only JPG or PNG images may be used for profile pictures'
    },
    imageTooLarge: {
        id: 'user.settings.general.imageTooLarge',
        defaultMessage: 'Unable to upload profile image. File is too large.'
    },
    uploadImage: {
        id: 'user.settings.general.uploadImage',
        defaultMessage: "Click 'Edit' to upload an image."
    },
    imageUpdated: {
        id: 'user.settings.general.imageUpdated',
        defaultMessage: 'Image last updated {date}'
    },
    fullName: {
        id: 'user.settings.general.fullName',
        defaultMessage: 'Full Name'
    },
    nickname: {
        id: 'user.settings.general.nickname',
        defaultMessage: 'Nickname'
    },
    username: {
        id: 'user.settings.general.username',
        defaultMessage: 'Username'
    },
    email: {
        id: 'user.settings.general.email',
        defaultMessage: 'Email'
    },
    profilePicture: {
        id: 'user.settings.general.profilePicture',
        defaultMessage: 'Profile Picture'
    },
    close: {
        id: 'user.settings.general.close',
        defaultMessage: 'Close'
    }
});

class UserSettingsGeneralTab extends React.Component {
    constructor(props) {
        super(props);
        this.submitActive = false;

        this.submitUsername = this.submitUsername.bind(this);
        this.submitNickname = this.submitNickname.bind(this);
        this.submitName = this.submitName.bind(this);
        this.submitEmail = this.submitEmail.bind(this);
        this.submitUser = this.submitUser.bind(this);
        this.submitPicture = this.submitPicture.bind(this);

        this.updateUsername = this.updateUsername.bind(this);
        this.updateFirstName = this.updateFirstName.bind(this);
        this.updateLastName = this.updateLastName.bind(this);
        this.updateNickname = this.updateNickname.bind(this);
        this.updateEmail = this.updateEmail.bind(this);
        this.updateConfirmEmail = this.updateConfirmEmail.bind(this);
        this.updatePicture = this.updatePicture.bind(this);
        this.updateSection = this.updateSection.bind(this);

        this.state = this.setupInitialState(props);
    }
    submitUsername(e) {
        e.preventDefault();

        const user = Object.assign({}, this.props.user);
        const username = this.state.username.trim().toLowerCase();

        const {formatMessage} = this.props.intl;
        const usernameError = Utils.isValidUsername(username);
        if (usernameError === 'Cannot use a reserved word as a username.') {
            this.setState({clientError: formatMessage(holders.usernameReserved)});
            return;
        } else if (usernameError) {
            this.setState({clientError: formatMessage(holders.usernameRestrictions, {min: Constants.MIN_USERNAME_LENGTH, max: Constants.MAX_USERNAME_LENGTH})});
            return;
        }

        if (user.username === username) {
            this.updateSection('');
            return;
        }

        user.username = username;

        this.submitUser(user, false);
    }
    submitNickname(e) {
        e.preventDefault();

        const user = Object.assign({}, this.props.user);
        const nickname = this.state.nickname.trim();

        if (user.nickname === nickname) {
            this.updateSection('');
            return;
        }

        user.nickname = nickname;

        this.submitUser(user, false);
    }
    submitName(e) {
        e.preventDefault();

        const user = Object.assign({}, this.props.user);
        const firstName = this.state.firstName.trim();
        const lastName = this.state.lastName.trim();

        if (user.first_name === firstName && user.last_name === lastName) {
            this.updateSection('');
            return;
        }

        user.first_name = firstName;
        user.last_name = lastName;

        this.submitUser(user, false);
    }
    submitEmail(e) {
        e.preventDefault();

        const user = Object.assign({}, this.props.user);
        const email = this.state.email.trim().toLowerCase();
        const confirmEmail = this.state.confirmEmail.trim().toLowerCase();

        const {formatMessage} = this.props.intl;
        if (email === '' || !Utils.isEmail(email)) {
            this.setState({emailError: formatMessage(holders.validEmail), clientError: '', serverError: ''});
            return;
        }

        if (email !== confirmEmail) {
            this.setState({emailError: formatMessage(holders.emailMatch), clientError: '', serverError: ''});
            return;
        }

        if (user.email === email) {
            this.updateSection('');
            return;
        }

        user.email = email;
        this.submitUser(user, true);
    }
    submitUser(user, emailUpdated) {
        Client.updateUser(user,
            () => {
                this.updateSection('');
                AsyncClient.getMe();
                const verificationEnabled = global.window.mm_config.SendEmailNotifications === 'true' && global.window.mm_config.RequireEmailVerification === 'true' && emailUpdated;

                if (verificationEnabled) {
                    ErrorStore.storeLastError({message: this.props.intl.formatMessage(holders.checkEmail, {email: user.email})});
                    ErrorStore.emitChange();
                    this.setState({emailChangeInProgress: true});
                }
            },
            (err) => {
                let serverError;
                if (err.message) {
                    serverError = err.message;
                } else {
                    serverError = err;
                }
                this.setState({serverError, emailError: '', clientError: ''});
            }
        );
    }
    submitPicture(e) {
        e.preventDefault();

        if (!this.state.picture) {
            return;
        }

        if (!this.submitActive) {
            return;
        }

        const {formatMessage} = this.props.intl;
        const picture = this.state.picture;

        if (picture.type !== 'image/jpeg' && picture.type !== 'image/png') {
            this.setState({clientError: formatMessage(holders.validImage)});
            return;
        } else if (picture.size > Constants.MAX_FILE_SIZE) {
            this.setState({clientError: formatMessage(holders.imageTooLarge)});
            return;
        }

        var formData = new FormData();
        formData.append('image', picture, picture.name);
        this.setState({loadingPicture: true});

        Client.uploadProfileImage(formData,
            () => {
                this.submitActive = false;
                AsyncClient.getMe();
                window.location.reload();
            },
            (err) => {
                var state = this.setupInitialState(this.props);
                state.serverError = err.message;
                this.setState(state);
            }
        );
    }
    updateUsername(e) {
        this.setState({username: e.target.value});
    }
    updateFirstName(e) {
        this.setState({firstName: e.target.value});
    }
    updateLastName(e) {
        this.setState({lastName: e.target.value});
    }
    updateNickname(e) {
        this.setState({nickname: e.target.value});
    }
    updateEmail(e) {
        this.setState({email: e.target.value});
    }
    updateConfirmEmail(e) {
        this.setState({confirmEmail: e.target.value});
    }
    updatePicture(e) {
        if (e.target.files && e.target.files[0]) {
            this.setState({picture: e.target.files[0]});

            this.submitActive = true;
            this.setState({clientError: null});
        } else {
            this.setState({picture: null});
        }
    }
    updateSection(section) {
        const emailChangeInProgress = this.state.emailChangeInProgress;
        this.setState(Object.assign({}, this.setupInitialState(this.props), {emailChangeInProgress, clientError: '', serverError: '', emailError: ''}));
        this.submitActive = false;
        this.props.updateSection(section);
    }
    setupInitialState(props) {
        const user = props.user;

        return {username: user.username, firstName: user.first_name, lastName: user.last_name, nickname: user.nickname,
                        email: user.email, confirmEmail: '', picture: null, loadingPicture: false, emailChangeInProgress: false};
    }
    render() {
        const user = this.props.user;
        const {formatMessage, formatHTMLMessage} = this.props.intl;

        let clientError = null;
        if (this.state.clientError) {
            clientError = this.state.clientError;
        }
        let serverError = null;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }
        let emailError = null;
        if (this.state.emailError) {
            emailError = this.state.emailError;
        }

        let nameSection;
        const inputs = [];

        if (this.props.activeSection === 'name') {
            inputs.push(
                <div
                    key='firstNameSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>
                        <FormattedMessage
                            id='user.settings.general.firstName'
                            defaultMessage='First Name'
                        />
                    </label>
                    <div className='col-sm-7'>
                        <input
                            className='form-control'
                            type='text'
                            onChange={this.updateFirstName}
                            value={this.state.firstName}
                        />
                    </div>
                </div>
            );

            inputs.push(
                <div
                    key='lastNameSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>
                        <FormattedMessage
                            id='user.settings.general.lastName'
                            defaultMessage='Last Name'
                        />
                    </label>
                    <div className='col-sm-7'>
                        <input
                            className='form-control'
                            type='text'
                            onChange={this.updateLastName}
                            value={this.state.lastName}
                        />
                    </div>
                </div>
            );

            function notifClick(e) {
                e.preventDefault();
                this.updateSection('');
                this.props.updateTab('notifications');
            }

            const notifLink = (
                <a
                    href='#'
                    onClick={notifClick.bind(this)}
                >
                    <FormattedMessage
                        id='user.settings.general.notificationsLink'
                        defaultMessage='Notifications'
                    />
                </a>
            );

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.notificationsExtra'
                        defaultMessage='By default, you will receive mention notifications when someone types your first name. Go to {notify} settings to change this default.'
                        values={{
                            notify: (notifLink)
                        }}
                    />
                </span>
            );

            nameSection = (
                <SettingItemMax
                    title={formatMessage(holders.fullName)}
                    inputs={inputs}
                    submit={this.submitName}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                    extraInfo={extraInfo}
                />
            );
        } else {
            let fullName = '';

            if (user.first_name && user.last_name) {
                fullName = user.first_name + ' ' + user.last_name;
            } else if (user.first_name) {
                fullName = user.first_name;
            } else if (user.last_name) {
                fullName = user.last_name;
            }

            nameSection = (
                <SettingItemMin
                    title={formatMessage(holders.fullName)}
                    describe={fullName}
                    updateSection={() => {
                        this.updateSection('name');
                    }}
                />
            );
        }

        let nicknameSection;
        if (this.props.activeSection === 'nickname') {
            let nicknameLabel = (
                <FormattedMessage
                    id='user.settings.general.nickname'
                    defaultMessage='Nickname'
                />
            );
            if (Utils.isMobile()) {
                nicknameLabel = '';
            }

            inputs.push(
                <div
                    key='nicknameSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{nicknameLabel}</label>
                    <div className='col-sm-7'>
                        <input
                            className='form-control'
                            type='text'
                            onChange={this.updateNickname}
                            value={this.state.nickname}
                        />
                    </div>
                </div>
            );

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.nicknameExtra'
                        defaultMessage='Use Nickname for a name you might be called that is different from your first name and username. This is most often used when two or more people have similar sounding names and usernames.'
                    />
                </span>
            );

            nicknameSection = (
                <SettingItemMax
                    title={formatMessage(holders.nickname)}
                    inputs={inputs}
                    submit={this.submitNickname}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                    extraInfo={extraInfo}
                />
            );
        } else {
            nicknameSection = (
                <SettingItemMin
                    title={formatMessage(holders.nickname)}
                    describe={UserStore.getCurrentUser().nickname}
                    updateSection={() => {
                        this.updateSection('nickname');
                    }}
                />
            );
        }

        let usernameSection;
        if (this.props.activeSection === 'username') {
            let usernameLabel = (
                <FormattedMessage
                    id='user.settings.general.username'
                    defaultMessage='Username'
                />
            );
            if (Utils.isMobile()) {
                usernameLabel = '';
            }

            inputs.push(
                <div
                    key='usernameSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{usernameLabel}</label>
                    <div className='col-sm-7'>
                        <input
                            maxLength={Constants.MAX_USERNAME_LENGTH}
                            className='form-control'
                            type='text'
                            onChange={this.updateUsername}
                            value={this.state.username}
                        />
                    </div>
                </div>
            );

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.usernameInfo'
                        defaultMessage='Pick something easy for teammates to recognize and recall.'
                    />
                </span>
            );

            usernameSection = (
                <SettingItemMax
                    title={formatMessage(holders.username)}
                    inputs={inputs}
                    submit={this.submitUsername}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                    extraInfo={extraInfo}
                />
            );
        } else {
            usernameSection = (
                <SettingItemMin
                    title={formatMessage(holders.username)}
                    describe={UserStore.getCurrentUser().username}
                    updateSection={() => {
                        this.updateSection('username');
                    }}
                />
            );
        }

        let emailSection;
        if (this.props.activeSection === 'email') {
            const emailEnabled = global.window.mm_config.SendEmailNotifications === 'true';
            const emailVerificationEnabled = global.window.mm_config.RequireEmailVerification === 'true';
            let helpText = (
                <FormattedMessage
                    id='user.settings.general.emailHelp1'
                    defaultMessage='Email is used for sign-in, notifications, and password reset. Email requires verification if changed.'
                />
            );

            if (!emailEnabled) {
                helpText = (
                    <div className='setting-list__hint text-danger'>
                        <FormattedMessage
                            id='user.settings.general.emailHelp2'
                            defaultMessage='Email has been disabled by your system administrator. No notification emails will be sent until it is enabled.'
                        />
                    </div>
                );
            } else if (!emailVerificationEnabled) {
                helpText = (
                    <FormattedMessage
                        id='user.settings.general.emailHelp3'
                        defaultMessage='Email is used for sign-in, notifications, and password reset.'
                    />
                );
            } else if (this.state.emailChangeInProgress) {
                const newEmail = UserStore.getCurrentUser().email;
                if (newEmail) {
                    helpText = (
                        <FormattedMessage
                            id='user.settings.general.emailHelp4'
                            defaultMessage='A verification email was sent to {email}.'
                            values={{
                                email: newEmail
                            }}
                        />
                    );
                }
            }

            let submit = null;

            if (this.props.user.auth_service === '') {
                inputs.push(
                    <div key='emailSetting'>
                        <div className='form-group'>
                            <label className='col-sm-5 control-label'>
                                <FormattedMessage
                                    id='user.settings.general.primaryEmail'
                                    defaultMessage='Primary Email'
                                />
                            </label>
                            <div className='col-sm-7'>
                                <input
                                    className='form-control'
                                    type='text'
                                    onChange={this.updateEmail}
                                    value={this.state.email}
                                />
                            </div>
                        </div>
                    </div>
                );

                inputs.push(
                    <div key='confirmEmailSetting'>
                        <div className='form-group'>
                            <label className='col-sm-5 control-label'>
                                <FormattedMessage
                                    id='user.settings.general.confirmEmail'
                                    defaultMessage='Confirm Email'
                                />
                            </label>
                            <div className='col-sm-7'>
                                <input
                                    className='form-control'
                                    type='text'
                                    onChange={this.updateConfirmEmail}
                                    value={this.state.confirmEmail}
                                />
                            </div>
                        </div>
                        {helpText}
                    </div>
                );

                submit = this.submitEmail;
            } else if (this.props.user.auth_service === Constants.GITLAB_SERVICE) {
                inputs.push(
                    <div
                        key='oauthEmailInfo'
                        className='form-group'
                    >
                        <div className='setting-list__hint'>
                            <FormattedMessage
                                id='user.settings.general.emailCantUpdate'
                                defaultMessage='Log in occurs through GitLab. Email cannot be updated.'
                            />
                        </div>
                        {helpText}
                    </div>
                );
            }

            emailSection = (
                <SettingItemMax
                    title='Email'
                    inputs={inputs}
                    submit={submit}
                    server_error={serverError}
                    client_error={emailError}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            let describe = '';
            if (this.props.user.auth_service === '') {
                if (this.state.emailChangeInProgress) {
                    const newEmail = UserStore.getCurrentUser().email;
                    if (newEmail) {
                        describe = formatHTMLMessage(holders.newAddress, {email: newEmail});
                    } else {
                        describe = formatMessage(holders.checkEmailNoAddress);
                    }
                } else {
                    describe = UserStore.getCurrentUser().email;
                }
            } else if (this.props.user.auth_service === Constants.GITLAB_SERVICE) {
                describe = formatMessage(holders.loginGitlab);
            }

            emailSection = (
                <SettingItemMin
                    title={formatMessage(holders.email)}
                    describe={describe}
                    updateSection={() => {
                        this.updateSection('email');
                    }}
                />
            );
        }

        let pictureSection;
        if (this.props.activeSection === 'picture') {
            pictureSection = (
                <SettingPicture
                    title={formatMessage(holders.profilePicture)}
                    submit={this.submitPicture}
                    src={'/api/v1/users/' + user.id + '/image?time=' + user.last_picture_update}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                    picture={this.state.picture}
                    pictureChange={this.updatePicture}
                    submitActive={this.submitActive}
                    loadingPicture={this.state.loadingPicture}
                />
            );
        } else {
            let minMessage = formatMessage(holders.uploadImage);
            if (user.last_picture_update) {
                minMessage = formatMessage(holders.imageUpdated, {
                    date: (
                        <FormattedDate
                            value={new Date(user.last_picture_update)}
                            day='2-digit'
                            month='short'
                            year='numeric'
                        />
                    )
                });
            }
            pictureSection = (
                <SettingItemMin
                    title={formatMessage(holders.profilePicture)}
                    describe={minMessage}
                    updateSection={() => {
                        this.updateSection('picture');
                    }}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label={formatMessage(holders.close)}
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <div className='modal-back'>
                            <i
                                className='fa fa-angle-left'
                                onClick={this.props.collapseModal}
                            />
                        </div>
                        <FormattedMessage
                            id='user.settings.general.title'
                            defaultMessage='General Settings'
                        />
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>
                        <FormattedMessage
                            id='user.settings.general.title'
                            defaultMessage='General Settings'
                        />
                    </h3>
                    <div className='divider-dark first'/>
                    {nameSection}
                    <div className='divider-light'/>
                    {usernameSection}
                    <div className='divider-light'/>
                    {nicknameSection}
                    <div className='divider-light'/>
                    {emailSection}
                    <div className='divider-light'/>
                    {pictureSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

UserSettingsGeneralTab.propTypes = {
    intl: intlShape.isRequired,
    user: React.PropTypes.object.isRequired,
    updateSection: React.PropTypes.func.isRequired,
    updateTab: React.PropTypes.func.isRequired,
    activeSection: React.PropTypes.string.isRequired,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired
};

export default injectIntl(UserSettingsGeneralTab);
