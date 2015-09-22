// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../../stores/user_store.jsx');
var SettingItemMin = require('../setting_item_min.jsx');
var SettingItemMax = require('../setting_item_max.jsx');
var SettingPicture = require('../setting_picture.jsx');
var client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');
var utils = require('../../utils/utils.jsx');
var assign = require('object-assign');

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
        this.updatePicture = this.updatePicture.bind(this);
        this.updateSection = this.updateSection.bind(this);

        this.handleClose = this.handleClose.bind(this);
        this.setupInitialState = this.setupInitialState.bind(this);

        this.state = this.setupInitialState(props);
    }
    submitUsername(e) {
        e.preventDefault();

        var user = this.props.user;
        var username = this.state.username.trim().toLowerCase();

        var usernameError = utils.isValidUsername(username);
        if (usernameError === 'Cannot use a reserved word as a username.') {
            this.setState({clientError: 'This username is reserved, please choose a new one.'});
            return;
        } else if (usernameError) {
            this.setState({clientError: "Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'."});
            return;
        }

        if (user.username === username) {
            this.setState({clientError: 'You must submit a new username'});
            return;
        }

        user.username = username;

        this.submitUser(user);
    }
    submitNickname(e) {
        e.preventDefault();

        var user = UserStore.getCurrentUser();
        var nickname = this.state.nickname.trim();

        if (user.nickname === nickname) {
            this.setState({clientError: 'You must submit a new nickname'});
            return;
        }

        user.nickname = nickname;

        this.submitUser(user);
    }
    submitName(e) {
        e.preventDefault();

        var user = UserStore.getCurrentUser();
        var firstName = this.state.firstName.trim();
        var lastName = this.state.lastName.trim();

        if (user.first_name === firstName && user.last_name === lastName) {
            this.setState({clientError: 'You must submit a new first or last name'});
            return;
        }

        user.first_name = firstName;
        user.last_name = lastName;

        this.submitUser(user);
    }
    submitEmail(e) {
        e.preventDefault();

        var user = UserStore.getCurrentUser();
        var email = this.state.email.trim().toLowerCase();

        if (user.email === email) {
            return;
        }

        if (email === '' || !utils.isEmail(email)) {
            this.setState({emailError: 'Please enter a valid email address'});
            return;
        }

        user.email = email;

        this.submitUser(user);
    }
    submitUser(user) {
        client.updateUser(user,
            function updateSuccess() {
                this.updateSection('');
                AsyncClient.getMe();
            }.bind(this),
            function updateFailure(err) {
                var state = this.setupInitialState(this.props);
                if (err.message) {
                    state.serverError = err.message;
                } else {
                    state.serverError = err;
                }
                this.setState(state);
            }.bind(this)
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

        var picture = this.state.picture;

        if (picture.type !== 'image/jpeg' && picture.type !== 'image/png') {
            this.setState({clientError: 'Only JPG or PNG images may be used for profile pictures'});
            return;
        }

        var formData = new FormData();
        formData.append('image', picture, picture.name);
        this.setState({loadingPicture: true});

        client.uploadProfileImage(formData,
            function imageUploadSuccess() {
                this.submitActive = false;
                AsyncClient.getMe();
                window.location.reload();
            }.bind(this),
            function imageUploadFailure(err) {
                var state = this.setupInitialState(this.props);
                state.serverError = err;
                this.setState(state);
            }.bind(this)
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
        this.setState(assign({}, this.setupInitialState(this.props), {clientError: '', serverError: '', emailError: ''}));
        this.submitActive = false;
        this.props.updateSection(section);
    }
    handleClose() {
        $(React.findDOMNode(this)).find('.form-control').each(function clearForms() {
            this.value = '';
        });

        this.setState(assign({}, this.setupInitialState(this.props), {clientError: null, serverError: null, emailError: null}));
        this.props.updateSection('');
    }
    componentDidMount() {
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    }
    componentWillUnmount() {
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
    }
    setupInitialState(props) {
        var user = props.user;
        var emailEnabled = global.window.config.SendEmailNotifications === 'true';
        return {username: user.username, firstName: user.first_name, lastName: user.last_name, nickname: user.nickname,
                        email: user.email, picture: null, loadingPicture: false, emailEnabled: emailEnabled};
    }
    render() {
        var user = this.props.user;

        var clientError = null;
        if (this.state.clientError) {
            clientError = this.state.clientError;
        }
        var serverError = null;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }
        var emailError = null;
        if (this.state.emailError) {
            emailError = this.state.emailError;
        }

        var nameSection;
        var inputs = [];

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
                    updateSection={function clearSection(e) {
                        this.updateSection('');
                        e.preventDefault();
                    }.bind(this)}
                    extraInfo={extraInfo}
                />
            );
        } else {
            var fullName = '';

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
                    updateSection={function updateNameSection() {
                        this.updateSection('name');
                    }.bind(this)}
                />
            );
        }

        var nicknameSection;
        if (this.props.activeSection === 'nickname') {
            let nicknameLabel = 'Nickname';
            if (utils.isMobile()) {
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
                    {'Use Nickname for a name you might be called that is different from your first name and user name.'}
                    {'This is most often used when two or more people have similar sounding names and usernames.'}
                </span>
            );

            nicknameSection = (
                <SettingItemMax
                    title='Nickname'
                    inputs={inputs}
                    submit={this.submitNickname}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={function clearSection(e) {
                        this.updateSection('');
                        e.preventDefault();
                    }.bind(this)}
                    extraInfo={extraInfo}
                />
            );
        } else {
            nicknameSection = (
                <SettingItemMin
                    title='Nickname'
                    describe={UserStore.getCurrentUser().nickname}
                    updateSection={function updateNicknameSection() {
                        this.updateSection('nickname');
                    }.bind(this)}
                />
            );
        }

        var usernameSection;
        if (this.props.activeSection === 'username') {
            let usernameLabel = 'Username';
            if (utils.isMobile()) {
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
                    updateSection={function clearSection(e) {
                        this.updateSection('');
                        e.preventDefault();
                    }.bind(this)}
                    extraInfo={extraInfo}
                />
            );
        } else {
            usernameSection = (
                <SettingItemMin
                    title='Username'
                    describe={UserStore.getCurrentUser().username}
                    updateSection={function updateUsernameSection() {
                        this.updateSection('username');
                    }.bind(this)}
                />
            );
        }
        var emailSection;
        if (this.props.activeSection === 'email') {
            let helpText = <div>Email is used for notifications, and requires verification if changed.</div>;

            if (!this.state.emailEnabled) {
                helpText = <div className='setting-list__hint text-danger'>{'Email has been disabled by your system administrator. No notification emails will be sent until it is enabled.'}</div>;
            }

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
                    {helpText}
                </div>
            );

            emailSection = (
                <SettingItemMax
                    title='Email'
                    inputs={inputs}
                    submit={this.submitEmail}
                    server_error={serverError}
                    client_error={emailError}
                    updateSection={function clearSection(e) {
                        this.updateSection('');
                        e.preventDefault();
                    }.bind(this)}
                />
            );
        } else {
            emailSection = (
                <SettingItemMin
                    title='Email'
                    describe={UserStore.getCurrentUser().email}
                    updateSection={function updateEmailSection() {
                        this.updateSection('email');
                    }.bind(this)}
                />
            );
        }

        var pictureSection;
        if (this.props.activeSection === 'picture') {
            pictureSection = (
                <SettingPicture
                    title='Profile Picture'
                    submit={this.submitPicture}
                    src={'/api/v1/users/' + user.id + '/image?time=' + user.last_picture_update}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={function clearSection(e) {
                        this.updateSection('');
                        e.preventDefault();
                    }.bind(this)}
                    picture={this.state.picture}
                    pictureChange={this.updatePicture}
                    submitActive={this.submitActive}
                    loadingPicture={this.state.loadingPicture}
                />
            );
        } else {
            var minMessage = 'Click \'Edit\' to upload an image.';
            if (user.last_picture_update) {
                minMessage = 'Image last updated ' + utils.displayDate(user.last_picture_update);
            }
            pictureSection = (
                <SettingItemMin
                    title='Profile Picture'
                    describe={minMessage}
                    updateSection={function updatePictureSection() {
                        this.updateSection('picture');
                    }.bind(this)}
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
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i className='modal-back'></i>
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
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string
};
