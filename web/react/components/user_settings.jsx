// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var SettingItemMin = require('./setting_item_min.jsx');
var SettingItemMax = require('./setting_item_max.jsx');
var SettingPicture = require('./setting_picture.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var utils = require('../utils/utils.jsx');
var Constants = require('../utils/constants.jsx');

function getNotificationsStateFromStores() {
    var user = UserStore.getCurrentUser();
    var sound = (!user.notify_props || user.notify_props.desktop_sound == undefined) ? "true" : user.notify_props.desktop_sound;
    var desktop = (!user.notify_props || user.notify_props.desktop == undefined) ? "all" : user.notify_props.desktop;
    var email = (!user.notify_props || user.notify_props.email == undefined) ? "true" : user.notify_props.email;

    var username_key = false;
    var mention_key = false;
    var custom_keys = "";
    var first_name_key = false;

    if (!user.notify_props) {
        mention_keys = user.username;
        if (user.full_name.length > 0) mention_keys += ","+ user.full_name.split(" ")[0];
    } else {
        if (user.notify_props.mention_keys !== undefined) {
            var keys = user.notify_props.mention_keys.split(',');

            if (keys.indexOf(user.username) !== -1) {
                username_key = true;
                keys.splice(keys.indexOf(user.username), 1);
            } else {
                username_key = false;
            }

            if (keys.indexOf('@'+user.username) !== -1) {
                mention_key = true;
                keys.splice(keys.indexOf('@'+user.username), 1);
            } else {
                mention_key = false;
            }

            custom_keys = keys.join(',');
        }

        if (user.notify_props.first_name !== undefined) {
            first_name_key = user.notify_props.first_name === "true";
        }
    }

    return { notify_level: desktop, enable_email: email, enable_sound: sound, username_key: username_key, mention_key: mention_key, custom_keys: custom_keys, custom_keys_checked: custom_keys.length > 0, first_name_key: first_name_key };
}


var NotificationsTab = React.createClass({
    handleSubmit: function() {
        data = {}
        data["user_id"] = this.props.user.id;
        data["email"] = this.state.enable_email;
        data["desktop_sound"] = this.state.enable_sound;
        data["desktop"] = this.state.notify_level;

        var mention_keys = [];
        if (this.state.username_key) mention_keys.push(this.props.user.username);
        if (this.state.mention_key) mention_keys.push('@'+this.props.user.username);

        var string_keys = mention_keys.join(',');
        if (this.state.custom_keys.length > 0 && this.state.custom_keys_checked) {
            string_keys += ',' + this.state.custom_keys;
        }

        data["mention_keys"] = string_keys;
        data["first_name"] = this.state.first_name_key ? "true" : "false";

        client.updateUserNotifyProps(data,
            function(data) {
                this.props.updateSection("");
                AsyncClient.getMe();
            }.bind(this),
            function(err) {
                this.setState({ server_error: err.message });
            }.bind(this)
        );
    },
    componentDidMount: function() {
        UserStore.addChangeListener(this._onChange);
    },
    componentWillUnmount: function() {
        UserStore.removeChangeListener(this._onChange);
    },
    _onChange: function() {
        var newState = getNotificationsStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    },
    getInitialState: function() {
        return getNotificationsStateFromStores();
    },
    handleNotifyRadio: function(notifyLevel) {
        this.setState({ notify_level: notifyLevel });
        this.refs.wrapper.getDOMNode().focus();
    },
    handleEmailRadio: function(enableEmail) {
        this.setState({ enable_email: enableEmail });
        this.refs.wrapper.getDOMNode().focus();
    },
    handleSoundRadio: function(enableSound) {
        this.setState({ enable_sound: enableSound });
        this.refs.wrapper.getDOMNode().focus();
    },
    updateUsernameKey: function(val) {
        this.setState({ username_key: val });
    },
    updateMentionKey: function(val) {
        this.setState({ mention_key: val });
    },
    updateFirstNameKey: function(val) {
        this.setState({ first_name_key: val });
    },
    updateCustomMentionKeys: function() {
        var checked = this.refs.customcheck.getDOMNode().checked;

        if (checked) {
            var text = this.refs.custommentions.getDOMNode().value;

            // remove all spaces and split string into individual keys
            this.setState({ custom_keys: text.replace(/ /g, ''), custom_keys_checked: true });
        } else {
            this.setState({ custom_keys: "", custom_keys_checked: false });
        }
    },
    onCustomChange: function() {
        this.refs.customcheck.getDOMNode().checked = true;
        this.updateCustomMentionKeys();
    },
    render: function() {
        var server_error = this.state.server_error ? this.state.server_error : null;

        var self = this;

        var desktopSection;
        if (this.props.activeSection === 'desktop') {
            var notifyActive = [false, false, false];
            if (this.state.notify_level === "mention") {
                notifyActive[1] = true;
            } else if (this.state.notify_level === "none") {
                notifyActive[2] = true;
            } else {
                notifyActive[0] = true;
            }

            var inputs = [];

            inputs.push(
                <div className="col-sm-12">
                    <div className="radio">
                        <label>
                            <input type="radio" checked={notifyActive[0]} onClick={function(){self.handleNotifyRadio("all")}}>For all activity</input>
                        </label>
                        <br/>
                    </div>
                    <div className="radio">
                        <label>
                            <input type="radio" checked={notifyActive[1]} onClick={function(){self.handleNotifyRadio("mention")}}>Only for mentions and direct messages</input>
                        </label>
                        <br/>
                    </div>
                    <div className="radio">
                        <label>
                            <input type="radio" checked={notifyActive[2]} onClick={function(){self.handleNotifyRadio("none")}}>Never</input>
                        </label>
                    </div>
                </div>
            );

            desktopSection = (
                <SettingItemMax
                    title="Send desktop notifications"
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={server_error}
                    updateSection={function(e){self.props.updateSection("");e.preventDefault();}}
                />
            );
        } else {
            var describe = "";
            if (this.state.notify_level === "mention") {
                describe = "Only for mentions and direct messages";
            } else if (this.state.notify_level === "none") {
                describe = "Never";
            } else {
                describe = "For all activity";
            }

            desktopSection = (
                <SettingItemMin
                    title="Send desktop notifications"
                    describe={describe}
                    updateSection={function(){self.props.updateSection("desktop");}}
                />
            );
        }

        var soundSection;
        if (this.props.activeSection === 'sound') {
            var soundActive = ["",""];
            if (this.state.enable_sound === "false") {
                soundActive[1] = "active";
            } else {
                soundActive[0] = "active";
            }

            var inputs = [];

            inputs.push(
                <div className="col-sm-12">
                    <div className="btn-group" data-toggle="buttons-radio">
                        <button className={"btn btn-default "+soundActive[0]} onClick={function(){self.handleSoundRadio("true")}}>On</button>
                        <button className={"btn btn-default "+soundActive[1]} onClick={function(){self.handleSoundRadio("false")}}>Off</button>
                    </div>
                </div>
            );

            soundSection = (
                <SettingItemMax
                    title="Desktop notification sounds"
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={server_error}
                    updateSection={function(e){self.props.updateSection("");e.preventDefault();}}
                />
            );
        } else {
            var describe = "";
            if (this.state.enable_sound === "false") {
                describe = "Off";
            } else {
                describe = "On";
            }

            soundSection = (
                <SettingItemMin
                    title="Desktop notification sounds"
                    describe={describe}
                    updateSection={function(){self.props.updateSection("sound");}}
                />
            );
        }

        var emailSection;
        if (this.props.activeSection === 'email') {
            var emailActive = ["",""];
            if (this.state.enable_email === "false") {
                emailActive[1] = "active";
            } else {
                emailActive[0] = "active";
            }

            var inputs = [];

            inputs.push(
                <div className="col-sm-12">
                    <div className="btn-group" data-toggle="buttons-radio">
                        <button className={"btn btn-default "+emailActive[0]} onClick={function(){self.handleEmailRadio("true")}}>On</button>
                        <button className={"btn btn-default "+emailActive[1]} onClick={function(){self.handleEmailRadio("false")}}>Off</button>
                    </div>
                    <div><br/>{"Email notifications are sent for mentions and direct messages after you have been away from " + config.SiteName + " for 5 minutes."}</div>
                </div>
            );

            emailSection = (
                <SettingItemMax
                    title="Email notifications"
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={server_error}
                    updateSection={function(e){self.props.updateSection("");e.preventDefault();}}
                />
            );
        } else {
            var describe = "";
            if (this.state.enable_email === "false") {
                describe = "Off";
            } else {
                describe = "On";
            }

            emailSection = (
                <SettingItemMin
                    title="Email notifications"
                    describe={describe}
                    updateSection={function(){self.props.updateSection("email");}}
                />
            );
        }

        var keysSection;
        if (this.props.activeSection === 'keys') {
            var user = this.props.user;
            var first_name = "";
            if (user.full_name.length > 0) {
                first_name = user.full_name.split(' ')[0];
            }

            var inputs = [];

            if (first_name != "") {
                inputs.push(
                    <div className="col-sm-12">
                        <div className="checkbox">
                            <label>
                                <input type="checkbox" checked={this.state.first_name_key} onChange={function(e){self.updateFirstNameKey(e.target.checked);}}>{'Your case sensitive first name "' + first_name + '"'}</input>
                            </label>
                        </div>
                    </div>
                );
            }

            inputs.push(
                <div className="col-sm-12">
                    <div className="checkbox">
                        <label>
                            <input type="checkbox" checked={this.state.username_key} onChange={function(e){self.updateUsernameKey(e.target.checked);}}>{'Your non-case sensitive username "' + user.username + '"'}</input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div className="col-sm-12">
                    <div className="checkbox">
                        <label>
                            <input type="checkbox" checked={this.state.mention_key} onChange={function(e){self.updateMentionKey(e.target.checked);}}>{'Your username mentioned "@' + user.username + '"'}</input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div className="col-sm-12">
                    <div className="checkbox">
                        <label>
                            <input ref="customcheck" type="checkbox" checked={this.state.custom_keys_checked} onChange={this.updateCustomMentionKeys}>{'Other non-case sensitive words, separated by commas:'}</input>
                        </label>
                    </div>
                    <input ref="custommentions" className="form-control mentions-input" type="text" defaultValue={this.state.custom_keys} onChange={this.onCustomChange} />
                </div>
            );

            keysSection = (
                <SettingItemMax
                    title="Words that trigger mentions"
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={server_error}
                    updateSection={function(e){self.props.updateSection("");e.preventDefault();}}
                />
            );
        } else {
            var keys = [];
            if (this.state.first_name_key) {
                var first_name = "";
                var user = this.props.user;
                if (user.full_name.length > 0) first_name = user.full_name.split(' ')[0];
                if (first_name != "") keys.push(first_name);
            }
            if (this.state.username_key) keys.push(this.props.user.username);
            if (this.state.mention_key) keys.push('@'+this.props.user.username);
            if (this.state.custom_keys.length > 0) keys = keys.concat(this.state.custom_keys.split(','));

            var describe = "";
            for (var i = 0; i < keys.length; i++) {
                describe += '"' + keys[i] + '", ';
            }

            if (describe.length > 0) {
                describe = describe.substring(0, describe.length - 2);
            } else {
                describe = "No words configured";
            }

            keysSection = (
                <SettingItemMin
                    title="Words that trigger mentions"
                    describe={describe}
                    updateSection={function(){self.props.updateSection("keys");}}
                />
            );
        }

        return (
            <div>
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title"><i className="modal-back"></i>Notifications</h4>
                </div>
                <div ref="wrapper" className="user-settings">
                    <h3 className="tab-header">Notifications</h3>
                    <div className="divider-dark first"/>
                    {desktopSection}
                    <div className="divider-light"/>
                    {soundSection}
                    <div className="divider-light"/>
                    {emailSection}
                    <div className="divider-light"/>
                    {keysSection}
                    <div className="divider-dark"/>
                </div>
            </div>

        );
    }
});

function getStateFromStoresForSessions() {
  return {
    sessions: UserStore.getSessions(),
    server_error: null,
    client_error: null
  };
}

var SessionsTab = React.createClass({
    submitRevoke: function(altId) {
        client.revokeSession(altId,
            function(data) {
                AsyncClient.getSessions();
            }.bind(this),
            function(err) {
                state = this.getStateFromStoresForSessions();
                state.server_error = err;
                this.setState(state);
            }.bind(this)
        );
    },
    componentDidMount: function() {
        UserStore.addSessionsChangeListener(this._onChange);
        AsyncClient.getSessions();
    },
    componentWillUnmount: function() {
        UserStore.removeSessionsChangeListener(this._onChange);
    },
    _onChange: function() {
        this.setState(getStateFromStoresForSessions());
    },
    getInitialState: function() {
        return getStateFromStoresForSessions();
    },
    render: function() {
        var server_error = this.state.server_error ? this.state.server_error : null;

        return (
            <div>
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title"><i className="modal-back"></i>Sessions</h4>
                </div>
                <div className="user-settings">
                    <h3 className="tab-header">Sessions</h3>
                    <div className="divider-dark first"/>
                    { server_error }
                    <div className="table-responsive" style={{ maxWidth: "560px", maxHeight: "300px" }}>
                        <table className="table-condensed small">
                            <thead>
                            <tr><th>Id</th><th>Platform</th><th>OS</th><th>Browser</th><th>Created</th><th>Last Activity</th><th>Revoke</th></tr>
                            </thead>
                            <tbody>
                            {
                                this.state.sessions.map(function(value, index) {
                                    return (
                                        <tr key={ "" + index }>
                                            <td style={{ whiteSpace: "nowrap" }}>{ value.alt_id }</td>
                                            <td style={{ whiteSpace: "nowrap" }}>{value.props.platform}</td>
                                            <td style={{ whiteSpace: "nowrap" }}>{value.props.os}</td>
                                            <td style={{ whiteSpace: "nowrap" }}>{value.props.browser}</td>
                                            <td style={{ whiteSpace: "nowrap" }}>{ new Date(value.create_at).toLocaleString() }</td>
                                            <td style={{ whiteSpace: "nowrap" }}>{ new Date(value.last_activity_at).toLocaleString() }</td>
                                            <td><button onClick={this.submitRevoke.bind(this, value.alt_id)} className="pull-right btn btn-primary">Revoke</button></td>
                                        </tr>
                                    );
                                }, this)
                            }
                            </tbody>
                        </table>
                    </div>
                    <div className="divider-dark"/>
                </div>
            </div>
        );
    }
});

function getStateFromStoresForAudits() {
  return {
    audits: UserStore.getAudits()
  };
}

var AuditTab = React.createClass({
    componentDidMount: function() {
        UserStore.addAuditsChangeListener(this._onChange);
        AsyncClient.getAudits();
    },
    componentWillUnmount: function() {
        UserStore.removeAuditsChangeListener(this._onChange);
    },
    _onChange: function() {
        this.setState(getStateFromStoresForAudits());
    },
    getInitialState: function() {
        return getStateFromStoresForAudits();
    },
    render: function() {
        return (
            <div>
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title"><i className="modal-back"></i>Activity Log</h4>
                </div>
                <div className="user-settings">
                    <h3 className="tab-header">Activity Log</h3>
                    <div className="divider-dark first"/>
                    <div className="table-responsive" style={{ maxWidth: "560px", maxHeight: "300px" }}>
                        <table className="table-condensed small">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Action</th>
                                    <th>IP Address</th>
                                    <th>Session</th>
                                    <th>Other Info</th>
                                </tr>
                            </thead>
                            <tbody>
                            {
                                this.state.audits.map(function(value, index) {
                                    return (
                                        <tr key={ "" + index }>
                                            <td style={{ whiteSpace: "nowrap" }}>{ new Date(value.create_at).toLocaleString() }</td>
                                            <td style={{ whiteSpace: "nowrap" }}>{ value.action.replace("/api/v1", "") }</td>
                                            <td style={{ whiteSpace: "nowrap" }}>{ value.ip_address }</td>
                                            <td style={{ whiteSpace: "nowrap" }}>{ value.session_id }</td>
                                            <td style={{ whiteSpace: "nowrap" }}>{ value.extra_info }</td>
                                        </tr>
                                    );
                                }, this)
                            }
                            </tbody>
                        </table>
                    </div>
                    <div className="divider-dark"/>
                </div>
            </div>
        );
    }
});

var SecurityTab = React.createClass({
    submitPassword: function(e) {
        e.preventDefault();

        var user = UserStore.getCurrentUser();
        var currentPassword = this.state.current_password;
        var newPassword = this.state.new_password;
        var confirmPassword = this.state.confirm_password;

        if (currentPassword === '') {
            this.setState({ password_error: "Please enter your current password" });
            return;
        }

        if (newPassword.length < 5) {
            this.setState({ password_error: "New passwords must be at least 5 characters" });
            return;
        }

        if (newPassword != confirmPassword) {
            this.setState({ password_error: "The new passwords you entered do not match" });
            return;
        }

        var data = {};
        data.user_id = user.id;
        data.current_password = currentPassword;
        data.new_password = newPassword;

        client.updatePassword(data,
            function(data) {
                this.updateSection("");
                AsyncClient.getMe();
                this.setState({ current_password: '', new_password: '', confirm_password: '' });
            }.bind(this),
            function(err) {
                state = this.getInitialState();
                state.server_error = err;
                this.setState(state);
            }.bind(this)
        );
    },
    updateCurrentPassword: function(e) {
        this.setState({ current_password: e.target.value });
    },
    updateNewPassword: function(e) {
        this.setState({ new_password: e.target.value });
    },
    updateConfirmPassword: function(e) {
        this.setState({ confirm_password: e.target.value });
    },
    getInitialState: function() {
        return { current_password: '', new_password: '', confirm_password: '' };
    },
    render: function() {
        var server_error = this.state.server_error ? this.state.server_error : null;
        var password_error = this.state.password_error ? this.state.password_error : null;

        var passwordSection;
        var self = this;
        if (this.props.activeSection === 'password') {
            var inputs = [];

            inputs.push(
                <div>
                    <label className="col-sm-5 control-label">Current Password</label>
                    <div className="col-sm-7">
                        <input className="form-control" type="password" onChange={this.updateCurrentPassword} value={this.state.current_password}/>
                    </div>
                </div>
            );
            inputs.push(
                <div>
                    <label className="col-sm-5 control-label">New Password</label>
                    <div className="col-sm-7">
                        <input className="form-control" type="password" onChange={this.updateNewPassword} value={this.state.new_password}/>
                    </div>
                </div>
            );
            inputs.push(
                <div>
                    <label className="col-sm-5 control-label">Retype New Password</label>
                    <div className="col-sm-7">
                        <input className="form-control" type="password" onChange={this.updateConfirmPassword} value={this.state.confirm_password}/>
                    </div>
                </div>
            );

            passwordSection = (
                <SettingItemMax
                    title="Password"
                    inputs={inputs}
                    submit={this.submitPassword}
                    server_error={server_error}
                    client_error={password_error}
                    updateSection={function(e){self.props.updateSection("");e.preventDefault();}}
                />
            );
        } else {
            var d = new Date(this.props.user.last_password_update);
            var hour = d.getHours() < 10 ? "0" + d.getHours() : String(d.getHours());
            var min = d.getMinutes() < 10 ? "0" + d.getMinutes() : String(d.getMinutes());
            var dateStr = "Last updated " + Constants.MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + " at " + hour + ":" + min;

            passwordSection = (
                <SettingItemMin
                    title="Password"
                    describe={dateStr}
                    updateSection={function(){self.props.updateSection("password");}}
                />
            );
        }

        return (
            <div>
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title"><i className="modal-back"></i>Security Settings</h4>
                </div>
                <div className="user-settings">
                    <h3 className="tab-header">Security Settings</h3>
                    <div className="divider-dark first"/>
                    { passwordSection }
                    <div className="divider-dark"/>
                </div>
            </div>
        );
    }
});

var GeneralTab = React.createClass({
    submitActive: false,
    submitUsername: function(e) {
        e.preventDefault();

        var user = this.props.user;
        var username = this.state.username.trim();

        var username_error = utils.isValidUsername(username);
        if (username_error === "Cannot use a reserved word as a username.") {
            this.setState({client_error: "This username is reserved, please choose a new one." });
            return;
        } else if (username_error) {
            this.setState({client_error: "Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'." });
            return;
        }

        if (user.username === username) {
            this.setState({client_error: "You must submit a new username"});
            return;
        }

        user.username = username;

        this.submitUser(user);
    },
    submitName: function(e) {
        e.preventDefault();

        var user = UserStore.getCurrentUser();
        var firstName = this.state.first_name.trim();
        var lastName = this.state.last_name.trim();

        var fullName = firstName + ' ' + lastName;

        if (user.full_name === fullName) {
            this.setState({client_error: "You must submit a new name"})
            return;
        }

        user.full_name = fullName;

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
            this.setState({ email_error: "Please enter a valid email address" });
            return;
        }

        user.email = email;

        this.submitUser(user);
    },
    submitUser: function(user) {
        client.updateUser(user,
            function(data) {
                this.updateSection("");
                AsyncClient.getMe();
            }.bind(this),
            function(err) {
                state = this.getInitialState();
                state.server_error = err;
                this.setState(state);
            }.bind(this)
        );
    },
    submitPicture: function(e) {
        e.preventDefault();

        if (!this.state.picture) return;

        if(!this.submitActive) return;

        formData = new FormData();
        formData.append('image', this.state.picture, this.state.picture.name);

        client.uploadProfileImage(formData,
            function(data) {
                this.submitActive = false;
                window.location.reload();
            }.bind(this),
            function(err) {
                state = this.getInitialState();
                state.server_error = err;
                this.setState(state);
            }.bind(this)
        );
    },
    updateUsername: function(e) {
        this.setState({ username: e.target.value });
    },
    updateFirstName: function(e) {
        this.setState({ first_name: e.target.value });
    },
    updateLastName: function(e) {
        this.setState({ last_name: e.target.value});
    },
    updateEmail: function(e) {
        this.setState({ email: e.target.value});
    },
    updatePicture: function(e) {
        if (e.target.files && e.target.files[0]) {
            this.setState({ picture: e.target.files[0] });
        } else {
            this.setState({ picture: null });
        }

        this.submitActive = true
    },
    updateSection: function(section) {
        this.setState({client_error:""})
        this.submitActive = false
        this.props.updateSection(section);
    },
    getInitialState: function() {
        var user = this.props.user;

        var splitStr = user.full_name.split(' ');
        var firstName = splitStr.shift();
        var lastName = splitStr.join(' ');

        return { username: user.username, first_name: firstName, last_name: lastName,
                 email: user.email, picture: null };
    },
    render: function() {
        var user = this.props.user;

        var client_error = this.state.client_error ? this.state.client_error : null;
        var server_error = this.state.server_error ? this.state.server_error : null;
        var email_error = this.state.email_error ? this.state.email_error : null;

        var nameSection;
        var self = this;

        if (this.props.activeSection === 'name') {
            var inputs = [];

            inputs.push(
                <div>
                    <label className="col-sm-5 control-label">First Name</label>
                    <div className="col-sm-7">
                        <input className="form-control" type="text" onChange={this.updateFirstName} value={this.state.first_name}/>
                    </div>
                </div>
            );

            inputs.push(
                <div>
                    <label className="col-sm-5 control-label">Last Name</label>
                    <div className="col-sm-7">
                        <input className="form-control" type="text" onChange={this.updateLastName} value={this.state.last_name}/>
                    </div>
                </div>
            );

            nameSection = (
                <SettingItemMax
                    title="Name"
                    inputs={inputs}
                    submit={this.submitName}
                    server_error={server_error}
                    client_error={client_error}
                    updateSection={function(e){self.updateSection("");e.preventDefault();}}
                />
            );
        } else {
            nameSection = (
                <SettingItemMin
                    title="Name"
                    describe={UserStore.getCurrentUser().full_name}
                    updateSection={function(){self.updateSection("name");}}
                />
            );
        }

        var usernameSection;
        if (this.props.activeSection === 'username') {
            var inputs = [];

            inputs.push(
                <div>
                    <label className="col-sm-5 control-label">{utils.isMobile() ? "": "Username"}</label>
                    <div className="col-sm-7">
                        <input className="form-control" type="text" onChange={this.updateUsername} value={this.state.username}/>
                    </div>
                </div>
            );

            usernameSection = (
                <SettingItemMax
                    title="Username"
                    inputs={inputs}
                    submit={this.submitUsername}
                    server_error={server_error}
                    client_error={client_error}
                    updateSection={function(e){self.updateSection("");e.preventDefault();}}
                />
            );
        } else {
            usernameSection = (
                <SettingItemMin
                    title="Username"
                    describe={UserStore.getCurrentUser().username}
                    updateSection={function(){self.updateSection("username");}}
                />
            );
        }
        var emailSection;
        if (this.props.activeSection === 'email') {
            var inputs = [];

            inputs.push(
                <div>
                    <label className="col-sm-5 control-label">Primary Email</label>
                    <div className="col-sm-7">
                        <input className="form-control" type="text" onChange={this.updateEmail} value={this.state.email}/>
                    </div>
                </div>
            );

            emailSection = (
                <SettingItemMax
                    title="Email"
                    inputs={inputs}
                    submit={this.submitEmail}
                    server_error={server_error}
                    client_error={email_error}
                    updateSection={function(e){self.updateSection("");e.preventDefault();}}
                />
            );
        } else {
            emailSection = (
                <SettingItemMin
                    title="Email"
                    describe={UserStore.getCurrentUser().email}
                    updateSection={function(){self.updateSection("email");}}
                />
            );
        }

        var pictureSection;
        if (this.props.activeSection === 'picture') {
            pictureSection = (
                <SettingPicture
                    title="Profile Picture"
                    submit={this.submitPicture}
                    src={"/api/v1/users/" + user.id + "/image"}
                    server_error={server_error}
                    client_error={email_error}
                    updateSection={function(e){self.updateSection("");e.preventDefault();}}
                    picture={this.state.picture}
                    pictureChange={this.updatePicture}
                    submitActive={this.submitActive}
                />
            );

        } else {
            pictureSection = (
                <SettingItemMin
                    title="Profile Picture"
                    describe="Picture inside."
                    updateSection={function(){self.updateSection("picture");}}
                />
            );
        }
        return (
            <div>
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title"><i className="modal-back"></i>General Settings</h4>
                </div>
                <div className="user-settings">
                    <h3 className="tab-header">General Settings</h3>
                    <div className="divider-dark first"/>
                    {nameSection}
                    <div className="divider-light"/>
                    {usernameSection}
                    <div className="divider-light"/>
                    {emailSection}
                    <div className="divider-light"/>
                    {pictureSection}
                    <div className="divider-dark"/>
                </div>
            </div>
        );
    }
});


var AppearanceTab = React.createClass({
    submitTheme: function(e) {
        e.preventDefault();
        var user = UserStore.getCurrentUser();
        if (!user.props) user.props = {};
        user.props.theme = this.state.theme;

        client.updateUser(user,
            function(data) {
                this.props.updateSection("");
                window.location.reload();
            }.bind(this),
            function(err) {
                state = this.getInitialState();
                state.server_error = err;
                this.setState(state);
            }.bind(this)
        );
    },
    updateTheme: function(e) {
        var hex = utils.rgb2hex(e.target.style.backgroundColor);
        this.setState({ theme: hex.toLowerCase() });
    },
    componentDidMount: function() {
        if (this.props.activeSection === "theme") {
            $(this.refs[this.state.theme].getDOMNode()).addClass('active-border');
        }
    },
    componentDidUpdate: function() {
        if (this.props.activeSection === "theme") {
            $('.color-btn').removeClass('active-border');
            $(this.refs[this.state.theme].getDOMNode()).addClass('active-border');
        }
    },
    getInitialState: function() {
        var user = UserStore.getCurrentUser();
        var theme = config.ThemeColors != null ? config.ThemeColors[0] : "#2389d7";
        if (user.props && user.props.theme) {
            theme = user.props.theme;
        }
        return { theme: theme.toLowerCase() };
    },
    render: function() {
        var server_error = this.state.server_error ? this.state.server_error : null;


        var themeSection;
        var self = this;

        if (config.ThemeColors != null) {
            if (this.props.activeSection === 'theme') {
                var theme_buttons = [];

                for (var i = 0; i < config.ThemeColors.length; i++) {
                    theme_buttons.push(<button ref={config.ThemeColors[i]} type="button" className="btn btn-lg color-btn" style={{backgroundColor: config.ThemeColors[i]}} onClick={this.updateTheme} />);
                }

                var inputs = [];

                inputs.push(
                    <li className="row setting-list-item form-group">
                        <div className="btn-group" data-toggle="buttons-radio">
                            { theme_buttons }
                        </div>
                    </li>
                );

                themeSection = (
                    <SettingItemMax
                        title="Theme"
                        inputs={inputs}
                        submit={this.submitTheme}
                        server_error={server_error}
                        updateSection={function(e){self.props.updateSection("");e.preventDefault;}}
                    />
                );
            } else {
                themeSection = (
                    <SettingItemMin
                        title="Theme"
                        describe={this.state.theme}
                        updateSection={function(){self.props.updateSection("theme");}}
                    />
                );
            }
        }

        return (
            <div>
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title"><i className="modal-back"></i>Appearance Settings</h4>
                </div>
                <div className="user-settings">
                    <h3 className="tab-header">Appearance Settings</h3>
                    <div className="divider-dark first"/>
                    {themeSection}
                    <div className="divider-dark"/>
                </div>
            </div>
        );
     }
});

module.exports = React.createClass({
    componentDidMount: function() {
        UserStore.addChangeListener(this._onChange);
    },
    componentWillUnmount: function() {
        UserStore.removeChangeListener(this._onChange);
    },
    _onChange: function () {
        var user = UserStore.getCurrentUser();
        if (!utils.areStatesEqual(this.state.user, user)) {
            this.setState({ user: user });
        }
    },
    getInitialState: function() {
        return { user: UserStore.getCurrentUser() };
    },
    render: function() {
        if (this.props.activeTab === 'general') {
            return (
                <div>
                    <GeneralTab user={this.state.user} activeSection={this.props.activeSection} updateSection={this.props.updateSection} />
                </div>
            );
        } else if (this.props.activeTab === 'security') {
            return (
                <div>
                    <SecurityTab user={this.state.user} activeSection={this.props.activeSection} updateSection={this.props.updateSection} />
                </div>
            );
        } else if (this.props.activeTab === 'notifications') {
            return (
                <div>
                    <NotificationsTab user={this.state.user} activeSection={this.props.activeSection} updateSection={this.props.updateSection} />
                </div>
            );

        /* Temporarily removing sessions and activity_log tabs

        } else if (this.props.activeTab === 'sessions') {
            return (
                <div>
                    <SessionsTab activeSection={this.props.activeSection} updateSection={this.props.updateSection} />
                </div>
            );
        } else if (this.props.activeTab === 'activity_log') {
            return (
                <div>
                    <AuditTab activeSection={this.props.activeSection} updateSection={this.props.updateSection} />
                </div>
            );
        */

        } else if (this.props.activeTab === 'appearance') {
            return (
                <div>
                    <AppearanceTab activeSection={this.props.activeSection} updateSection={this.props.updateSection} />
                </div>
            );
        } else {
            return <div/>;
        }
    }
});
