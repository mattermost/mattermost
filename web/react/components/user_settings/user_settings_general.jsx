// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import SettingPicture from '../setting_picture.jsx';

import UserStore from '../../stores/user_store.jsx';
import ErrorStore from '../../stores/error_store.jsx';

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import * as Utils from '../../utils/utils.jsx';

export default class UserSettingsGeneralTab extends React.Component {
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

        const usernameError = Utils.isValidUsername(username);
        if (usernameError === 'Cannot use a reserved word as a username.') {
            this.setState({clientError: 'This username is reserved, please choose a new one.'});
            return;
        } else if (usernameError) {
            this.setState({clientError: "Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'."});
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

        if (email === '' || !Utils.isEmail(email)) {
            this.setState({emailError: 'Please enter a valid email address.', clientError: '', serverError: ''});
            return;
        }

        if (email !== confirmEmail) {
            this.setState({emailError: 'The new emails you entered do not match.', clientError: '', serverError: ''});
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
                    ErrorStore.storeLastError({message: 'Check your email at ' + user.email + ' to verify the address.'});
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

        const picture = this.state.picture;

        if (picture.type !== 'image/jpeg' && picture.type !== 'image/png') {
            this.setState({clientError: 'Only JPG or PNG images may be used for profile pictures.'});
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
                    <label className='col-sm-5 control-label'>{'First Name'}</label>
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
                    <label className='col-sm-5 control-label'>{'Last Name'}</label>
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
                    {'Notifications'}
                </a>
            );

            const extraInfo = (
                <span>
                    {'By default, you will receive mention notifications when someone types your first name. '}
                    {'Go to '} {notifLink} {'settings to change this default.'}
                </span>
            );

            nameSection = (
                <SettingItemMax
                    title='Full Name'
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
                    title='Full Name'
                    describe={fullName}
                    updateSection={() => {
                        this.updateSection('name');
                    }}
                />
            );
        }

        let nicknameSection;
        if (this.props.activeSection === 'nickname') {
            let nicknameLabel = 'Nickname';
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
                    {'Use Nickname for a name you might be called that is different from your first name and username. This is most often used when two or more people have similar sounding names and usernames.'}
                </span>
            );

            nicknameSection = (
                <SettingItemMax
                    title='Nickname'
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
                    title='Nickname'
                    describe={UserStore.getCurrentUser().nickname}
                    updateSection={() => {
                        this.updateSection('nickname');
                    }}
                />
            );
        }

        let usernameSection;
        if (this.props.activeSection === 'username') {
            let usernameLabel = 'Username';
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
                            className='form-control'
                            type='text'
                            onChange={this.updateUsername}
                            value={this.state.username}
                        />
                    </div>
                </div>
            );

            const extraInfo = (<span>{'Pick something easy for teammates to recognize and recall.'}</span>);

            usernameSection = (
                <SettingItemMax
                    title='Username'
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
                    title='Username'
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
            let helpText = 'Email is used for sign-in, notifications, and password reset. Email requires verification if changed.';

            if (!emailEnabled) {
                helpText = <div className='setting-list__hint text-danger'>{'Email has been disabled by your system administrator. No notification emails will be sent until it is enabled.'}</div>;
            } else if (!emailVerificationEnabled) {
                helpText = 'Email is used for sign-in, notifications, and password reset.';
            } else if (this.state.emailChangeInProgress) {
                const newEmail = UserStore.getCurrentUser().email;
                if (newEmail) {
                    helpText = 'A verification email was sent to ' + newEmail + '.';
                }
            }

            let submit = null;

            if (this.props.user.auth_service === '') {
                inputs.push(
                    <div key='emailSetting'>
                        <div className='form-group'>
                            <label className='col-sm-5 control-label'>{'Primary Email'}</label>
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
                            <label className='col-sm-5 control-label'>{'Confirm Email'}</label>
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
            } else {
                inputs.push(
                    <div
                        key='oauthEmailInfo'
                        className='form-group'
                    >
                        <div className='setting-list__hint'>{'Log in occurs through GitLab. Email cannot be updated.'}</div>
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
                        describe = 'New Address: ' + newEmail + '\nCheck your email to verify the above address.';
                    } else {
                        describe = 'Check your email to verify your new address';
                    }
                } else {
                    describe = UserStore.getCurrentUser().email;
                }
            } else {
                describe = 'Log in done through GitLab';
            }

            emailSection = (
                <SettingItemMin
                    title='Email'
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
                    title='Profile Picture'
                    submit={this.submitPicture}
                    src={'/api/v1/users/' + user.id + '/image?time=' + user.last_picture_update + '&' + Utils.getSessionIndex()}
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
            let minMessage = 'Click \'Edit\' to upload an image.';
            if (user.last_picture_update) {
                minMessage = 'Image last updated ' + Utils.displayDate(user.last_picture_update);
            }
            pictureSection = (
                <SettingItemMin
                    title='Profile Picture'
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
                        aria-label='Close'
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i
                            className='modal-back'
                            onClick={this.props.collapseModal}
                        />
                        {'General Settings'}
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>{'General Settings'}</h3>
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
    user: React.PropTypes.object.isRequired,
    updateSection: React.PropTypes.func.isRequired,
    updateTab: React.PropTypes.func.isRequired,
    activeSection: React.PropTypes.string.isRequired,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired
};
