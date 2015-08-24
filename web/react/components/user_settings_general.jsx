// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var ConfigStore = require('../stores/config_store.jsx');
var SettingItemMin = require('./setting_item_min.jsx');
var SettingItemMax = require('./setting_item_max.jsx');
var SettingPicture = require('./setting_picture.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var utils = require('../utils/utils.jsx');
var assign = require('object-assign');

module.exports = React.createClass({
    displayName: 'GeneralTab',
    submitActive: false,
    submitUsername: function(e) {
        e.preventDefault();

        var user = this.props.user;
        var username = this.state.username.trim();

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
    },
    submitNickname: function(e) {
        e.preventDefault();

        var user = UserStore.getCurrentUser();
        var nickname = this.state.nickname.trim();

        if (user.nickname === nickname) {
            this.setState({clientError: 'You must submit a new nickname'});
            return;
        }

        user.nickname = nickname;

        this.submitUser(user);
    },
    submitName: function(e) {
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
    },
    submitEmail: function(e) {
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
    },
    submitUser: function(user) {
        client.updateUser(user,
            function() {
                this.updateSection('');
                AsyncClient.getMe();
            }.bind(this),
            function(err) {
                var state = this.getInitialState();
                if (err.message) {
                    state.serverError = err.message;
                } else {
                    state.serverError = err;
                }
                this.setState(state);
            }.bind(this)
        );
    },
    submitPicture: function(e) {
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
            function() {
                this.submitActive = false;
                AsyncClient.getMe();
                window.location.reload();
            }.bind(this),
            function(err) {
                var state = this.getInitialState();
                state.serverError = err;
                this.setState(state);
            }.bind(this)
        );
    },
    updateUsername: function(e) {
        this.setState({username: e.target.value});
    },
    updateFirstName: function(e) {
        this.setState({firstName: e.target.value});
    },
    updateLastName: function(e) {
        this.setState({lastName: e.target.value});
    },
    updateNickname: function(e) {
        this.setState({nickname: e.target.value});
    },
    updateEmail: function(e) {
        this.setState({email: e.target.value});
    },
    updatePicture: function(e) {
        if (e.target.files && e.target.files[0]) {
            this.setState({picture: e.target.files[0]});

            this.submitActive = true;
            this.setState({clientError: null});
        } else {
            this.setState({picture: null});
        }
    },
    updateSection: function(section) {
        this.setState(assign({}, this.getInitialState(), {clientError: ''}));
        this.submitActive = false;
        this.props.updateSection(section);
    },
    handleClose: function() {
        $(this.getDOMNode()).find('.form-control').each(function() {
            this.value = '';
        });

        this.setState(assign({}, this.getInitialState(), {clientError: null, serverError: null, emailError: null}));
        this.props.updateSection('');
    },
    componentDidMount: function() {
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    },
    componentWillUnmount: function() {
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
    },
    getInitialState: function() {
        var user = this.props.user;
        var emailEnabled = !ConfigStore.getSettingAsBoolean('ByPassEmail', false);

        return {username: user.username, firstName: user.first_name, lastName: user.last_name, nickname: user.nickname,
                 email: user.email, picture: null, loadingPicture: false, emailEnabled: emailEnabled};
    },
    render: function() {
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
        var self = this;
        var inputs = [];

        if (this.props.activeSection === 'name') {
            inputs.push(
                <div className='form-group'>
                    <label className='col-sm-5 control-label'>First Name</label>
                    <div className='col-sm-7'>
                        <input className='form-control' type='text' onChange={this.updateFirstName} value={this.state.firstName}/>
                    </div>
                </div>
            );

            inputs.push(
                <div className='form-group'>
                    <label className='col-sm-5 control-label'>Last Name</label>
                    <div className='col-sm-7'>
                        <input className='form-control' type='text' onChange={this.updateLastName} value={this.state.lastName}/>
                    </div>
                </div>
            );

            nameSection = (
                <SettingItemMax
                    title='Full Name'
                    inputs={inputs}
                    submit={this.submitName}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={function(e) {
                        self.updateSection('');
                        e.preventDefault();
                    }}
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
                    updateSection={function() {
                        self.updateSection('name');
                    }}
                />
            );
        }

        var nicknameSection;
        if (this.props.activeSection === 'nickname') {
            inputs.push(
                <div className='form-group'>
                    <label className='col-sm-5 control-label'>{utils.isMobile() ? '' : 'Nickname'}</label>
                    <div className='col-sm-7'>
                        <input className='form-control' type='text' onChange={this.updateNickname} value={this.state.nickname}/>
                    </div>
                </div>
            );

            nicknameSection = (
                <SettingItemMax
                    title='Nickname'
                    inputs={inputs}
                    submit={this.submitNickname}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={function(e) {
                        self.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            nicknameSection = (
                <SettingItemMin
                    title='Nickname'
                    describe={UserStore.getCurrentUser().nickname}
                    updateSection={function() {
                        self.updateSection('nickname');
                    }}
                />
            );
        }

        var usernameSection;
        if (this.props.activeSection === 'username') {
            inputs.push(
                <div className='form-group'>
                    <label className='col-sm-5 control-label'>{utils.isMobile() ? '' : 'Username'}</label>
                    <div className='col-sm-7'>
                        <input className='form-control' type='text' onChange={this.updateUsername} value={this.state.username}/>
                    </div>
                </div>
            );

            usernameSection = (
                <SettingItemMax
                    title='Username'
                    inputs={inputs}
                    submit={this.submitUsername}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={function(e) {
                        self.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            usernameSection = (
                <SettingItemMin
                    title='Username'
                    describe={UserStore.getCurrentUser().username}
                    updateSection={function() {
                        self.updateSection('username');
                    }}
                />
            );
        }
        var emailSection;
        if (this.props.activeSection === 'email') {
            let helpText = <div>Email is used for notifications, and requires verification if changed.</div>;

            if (!this.state.emailEnabled) {
                helpText = <div className='text-danger'><br />Email has been disabled by your system administrator. No notification emails will be sent until it is enabled.</div>;
            }

            inputs.push(
                <div>
                    <div className='form-group'>
                        <label className='col-sm-5 control-label'>Primary Email</label>
                        <div className='col-sm-7'>
                            <input className='form-control' type='text' onChange={this.updateEmail} value={this.state.email}/>
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
                    updateSection={function(e) {
                        self.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            emailSection = (
                <SettingItemMin
                    title='Email'
                    describe={UserStore.getCurrentUser().email}
                    updateSection={function() {
                        self.updateSection('email');
                    }}
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
                    updateSection={function(e) {
                        self.updateSection('');
                        e.preventDefault();
                    }}
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
                    updateSection={function() {
                        self.updateSection('picture');
                    }}
                />
            );
        }
        return (
            <div>
                <div className='modal-header'>
                    <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
                    <h4 className='modal-title' ref='title'><i className='modal-back'></i>General Settings</h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>General Settings</h3>
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
});
