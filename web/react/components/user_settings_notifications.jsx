var UserStore = require('../stores/user_store.jsx');
var SettingItemMin = require('./setting_item_min.jsx');
var SettingItemMax = require('./setting_item_max.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var utils = require('../utils/utils.jsx');
var assign = require('object-assign');

function getNotificationsStateFromStores() {
    var user = UserStore.getCurrentUser();
    var soundNeeded = !utils.isBrowserFirefox();
    var sound = (!user.notify_props || user.notify_props.desktop_sound == undefined) ? "true" : user.notify_props.desktop_sound;
    var desktop = (!user.notify_props || user.notify_props.desktop == undefined) ? "all" : user.notify_props.desktop;
    var email = (!user.notify_props || user.notify_props.email == undefined) ? "true" : user.notify_props.email;

    var username_key = false;
    var mention_key = false;
    var custom_keys = "";
    var first_name_key = false;
    var all_key = false;
    var channel_key = false;

    if (user.notify_props) {
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

        if (user.notify_props.all !== undefined) {
            all_key = user.notify_props.all === "true";
        }

        if (user.notify_props.channel !== undefined) {
            channel_key = user.notify_props.channel === "true";
        }
    }

    return { notify_level: desktop, enable_email: email, soundNeeded: soundNeeded, enable_sound: sound, username_key: username_key, mention_key: mention_key, custom_keys: custom_keys, custom_keys_checked: custom_keys.length > 0, first_name_key: first_name_key, all_key: all_key, channel_key: channel_key };
}


module.exports = React.createClass({
    displayName: 'NotificationsTab',
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
        data["all"] = this.state.all_key ? "true" : "false";
        data["channel"] = this.state.channel_key ? "true" : "false";

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
    handleClose: function() {
        $(this.getDOMNode()).find(".form-control").each(function() {
            this.value = "";
        });

        this.setState(assign({},getNotificationsStateFromStores(),{server_error: null}));

        this.props.updateTab('general');
    },
    componentDidMount: function() {
        UserStore.addChangeListener(this._onChange);
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    },
    componentWillUnmount: function() {
        UserStore.removeChangeListener(this._onChange);
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
        this.props.updateSection('');
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
    updateAllKey: function(val) {
        this.setState({ all_key: val });
    },
    updateChannelKey: function(val) {
        this.setState({ channel_key: val });
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

        var user = this.props.user;

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
                <div>
                    <div className="radio">
                        <label>
                            <input type="radio" checked={notifyActive[0]} onClick={function(){self.handleNotifyRadio("all")}}>For all activity</input>
                        </label>
                        <br/>
                    </div>
                    <div className="radio">
                        <label>
                            <input type="radio" checked={notifyActive[1]} onClick={function(){self.handleNotifyRadio("mention")}}>Only for mentions and private messages</input>
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
                describe = "Only for mentions and private messages";
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
        if (this.props.activeSection === 'sound' && this.state.soundNeeded) {
            var soundActive = ["",""];
            if (this.state.enable_sound === "false") {
                soundActive[1] = "active";
            } else {
                soundActive[0] = "active";
            }

            var inputs = [];

            inputs.push(
                <div>
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
            if (!this.state.soundNeeded) {
                describe = "Please configure notification sounds in your browser settings"
            } else if (this.state.enable_sound === "false") {
                describe = "Off";
            } else {
                describe = "On";
            }

            soundSection = (
                <SettingItemMin
                    title="Desktop notification sounds"
                    describe={describe}
                    updateSection={function(){self.props.updateSection("sound");}}
                    disableOpen = {!this.state.soundNeeded}
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
                <div>
                    <div className="btn-group" data-toggle="buttons-radio">
                        <button className={"btn btn-default "+emailActive[0]} onClick={function(){self.handleEmailRadio("true")}}>On</button>
                        <button className={"btn btn-default "+emailActive[1]} onClick={function(){self.handleEmailRadio("false")}}>Off</button>
                    </div>
                    <div><br/>{"Email notifications are sent for mentions and private messages after you have been away from " + config.SiteName + " for 5 minutes."}</div>
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
            var inputs = [];

            if (user.first_name) {
                inputs.push(
                    <div>
                        <div className="checkbox">
                            <label>
                                <input type="checkbox" checked={this.state.first_name_key} onChange={function(e){self.updateFirstNameKey(e.target.checked);}}>{'Your case sensitive first name "' + user.first_name + '"'}</input>
                            </label>
                        </div>
                    </div>
                );
            }

            inputs.push(
                <div>
                    <div className="checkbox">
                        <label>
                            <input type="checkbox" checked={this.state.username_key} onChange={function(e){self.updateUsernameKey(e.target.checked);}}>{'Your non-case sensitive username "' + user.username + '"'}</input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div>
                    <div className="checkbox">
                        <label>
                            <input type="checkbox" checked={this.state.mention_key} onChange={function(e){self.updateMentionKey(e.target.checked);}}>{'Your username mentioned "@' + user.username + '"'}</input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div>
                    <div className="checkbox">
                        <label>
                            <input type="checkbox" checked={this.state.all_key} onChange={function(e){self.updateAllKey(e.target.checked);}}>{'Team-wide mentions "@all"'}</input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div>
                    <div className="checkbox">
                        <label>
                            <input type="checkbox" checked={this.state.channel_key} onChange={function(e){self.updateChannelKey(e.target.checked);}}>{'Channel-wide mentions "@channel"'}</input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div>
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
            if (this.state.first_name_key) keys.push(user.first_name);
            if (this.state.username_key) keys.push(user.username);
            if (this.state.mention_key) keys.push('@'+user.username);
            if (this.state.all_key) keys.push('@all');
            if (this.state.channel_key) keys.push('@channel');
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
