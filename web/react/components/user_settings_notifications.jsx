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

    var sound = 'true';
    if (user.notify_props && user.notify_props.desktop_sound) {
        sound = user.notify_props.desktop_sound;
    }
    var desktop = 'all';
    if (user.notify_props && user.notify_props.desktop) {
        desktop = user.notify_props.desktop;
    }
    var email = 'true';
    if (user.notify_props && user.notify_props.email) {
        email = user.notify_props.email;
    }

    var usernameKey = false;
    var mentionKey = false;
    var customKeys = '';
    var firstNameKey = false;
    var allKey = false;
    var channelKey = false;

    if (user.notify_props) {
        if (user.notify_props.mention_keys) {
            var keys = user.notify_props.mention_keys.split(',');

            if (keys.indexOf(user.username) !== -1) {
                usernameKey = true;
                keys.splice(keys.indexOf(user.username), 1);
            } else {
                usernameKey = false;
            }

            if (keys.indexOf('@' + user.username) !== -1) {
                mentionKey = true;
                keys.splice(keys.indexOf('@' + user.username), 1);
            } else {
                mentionKey = false;
            }

            customKeys = keys.join(',');
        }

        if (user.notify_props.first_name) {
            firstNameKey = user.notify_props.first_name === 'true';
        }

        if (user.notify_props.all) {
            allKey = user.notify_props.all === 'true';
        }

        if (user.notify_props.channel) {
            channelKey = user.notify_props.channel === 'true';
        }
    }

    return {notifyLevel: desktop, enableEmail: email, soundNeeded: soundNeeded, enableSound: sound, usernameKey: usernameKey, mentionKey: mentionKey, customKeys: customKeys, customKeysChecked: customKeys.length > 0, firstNameKey: firstNameKey, allKey: allKey, channelKey: channelKey};
}

module.exports = React.createClass({
    displayName: 'NotificationsTab',
    propTypes: {
        user: React.PropTypes.object,
        updateSection: React.PropTypes.func,
        updateTab: React.PropTypes.func,
        activeSection: React.PropTypes.string,
        activeTab: React.PropTypes.string
    },
    handleSubmit: function() {
        var data = {};
        data.user_id = this.props.user.id;
        data.email = this.state.enableEmail;
        data.desktop_sound = this.state.enableSound;
        data.desktop = this.state.notifyLevel;

        var mentionKeys = [];
        if (this.state.usernameKey) {
            mentionKeys.push(this.props.user.username);
        }
        if (this.state.mentionKey) {
            mentionKeys.push('@' + this.props.user.username);
        }

        var stringKeys = mentionKeys.join(',');
        if (this.state.customKeys.length > 0 && this.state.customKeysChecked) {
            stringKeys += ',' + this.state.customKeys;
        }

        data.mention_keys = stringKeys;
        data.first_name = this.state.firstNameKey.toString();
        data.all = this.state.allKey.toString();
        data.channel = this.state.channelKey.toString();

        client.updateUserNotifyProps(data,
            function success() {
                this.props.updateSection('');
                AsyncClient.getMe();
            }.bind(this),
            function failure(err) {
                this.setState({serverError: err.message});
            }.bind(this)
        );
    },
    handleClose: function() {
        $(this.getDOMNode()).find('.form-control').each(function clearField() {
            this.value = '';
        });

        this.setState(assign({}, getNotificationsStateFromStores(), {serverError: null}));

        this.props.updateTab('general');
    },
    updateSection: function(section) {
        this.setState(this.getInitialState());
        this.props.updateSection(section);
    },
    componentDidMount: function() {
        UserStore.addChangeListener(this.onListenerChange);
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    },
    componentWillUnmount: function() {
        UserStore.removeChangeListener(this.onListenerChange);
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
        this.props.updateSection('');
    },
    onListenerChange: function() {
        var newState = getNotificationsStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    },
    getInitialState: function() {
        return getNotificationsStateFromStores();
    },
    handleNotifyRadio: function(notifyLevel) {
        this.setState({notifyLevel: notifyLevel});
        this.refs.wrapper.getDOMNode().focus();
    },
    handleEmailRadio: function(enableEmail) {
        this.setState({enableEmail: enableEmail});
        this.refs.wrapper.getDOMNode().focus();
    },
    handleSoundRadio: function(enableSound) {
        this.setState({enableSound: enableSound});
        this.refs.wrapper.getDOMNode().focus();
    },
    updateUsernameKey: function(val) {
        this.setState({usernameKey: val});
    },
    updateMentionKey: function(val) {
        this.setState({mentionKey: val});
    },
    updateFirstNameKey: function(val) {
        this.setState({firstNameKey: val});
    },
    updateAllKey: function(val) {
        this.setState({allKey: val});
    },
    updateChannelKey: function(val) {
        this.setState({channelKey: val});
    },
    updateCustomMentionKeys: function() {
        var checked = this.refs.customcheck.getDOMNode().checked;

        if (checked) {
            var text = this.refs.custommentions.getDOMNode().value;

            // remove all spaces and split string into individual keys
            this.setState({customKeys: text.replace(/ /g, ''), customKeysChecked: true});
        } else {
            this.setState({customKeys: '', customKeysChecked: false});
        }
    },
    onCustomChange: function() {
        this.refs.customcheck.getDOMNode().checked = true;
        this.updateCustomMentionKeys();
    },
    render: function() {
        var serverError = null;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        var self = this;

        var user = this.props.user;

        var desktopSection;
        if (this.props.activeSection === 'desktop') {
            var notifyActive = [false, false, false];
            if (this.state.notifyLevel === 'mention') {
                notifyActive[1] = true;
            } else if (this.state.notifyLevel === 'none') {
                notifyActive[2] = true;
            } else {
                notifyActive[0] = true;
            }

            var inputs = [];

            inputs.push(
                <div>
                    <div className='radio'>
                        <label>
                            <input type='radio' checked={notifyActive[0]} onClick={function(){self.handleNotifyRadio('all')}}>For all activity</input>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input type='radio' checked={notifyActive[1]} onClick={function(){self.handleNotifyRadio('mention')}}>Only for mentions and private messages</input>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input type='radio' checked={notifyActive[2]} onClick={function(){self.handleNotifyRadio('none')}}>Never</input>
                        </label>
                    </div>
                </div>
            );

            desktopSection = (
                <SettingItemMax
                    title='Send desktop notifications'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={function(e){self.updateSection('');e.preventDefault();}}
                />
            );
        } else {
            var describe = '';
            if (this.state.notifyLevel === 'mention') {
                describe = 'Only for mentions and private messages';
            } else if (this.state.notifyLevel === 'none') {
                describe = 'Never';
            } else {
                describe = 'For all activity';
            }

            desktopSection = (
                <SettingItemMin
                    title='Send desktop notifications'
                    describe={describe}
                    updateSection={function(){self.updateSection('desktop');}}
                />
            );
        }

        var soundSection;
        if (this.props.activeSection === 'sound' && this.state.soundNeeded) {
            var soundActive = ['', ''];
            if (this.state.enableSound === 'false') {
                soundActive[1] = 'active';
            } else {
                soundActive[0] = 'active';
            }

            var inputs = [];

            inputs.push(
                <div>
                    <div className='btn-group' data-toggle='buttons-radio'>
                        <button className={'btn btn-default '+soundActive[0]} onClick={function(){self.handleSoundRadio('true')}}>On</button>
                        <button className={'btn btn-default '+soundActive[1]} onClick={function(){self.handleSoundRadio('false')}}>Off</button>
                    </div>
                </div>
            );

            soundSection = (
                <SettingItemMax
                    title='Desktop notification sounds'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={function(e){self.updateSection('');e.preventDefault();}}
                />
            );
        } else {
            var describe = '';
            if (!this.state.soundNeeded) {
                describe = 'Please configure notification sounds in your browser settings'
            } else if (this.state.enableSound === 'false') {
                describe = 'Off';
            } else {
                describe = 'On';
            }

            soundSection = (
                <SettingItemMin
                    title='Desktop notification sounds'
                    describe={describe}
                    updateSection={function(){self.updateSection('sound');}}
                    disableOpen = {!this.state.soundNeeded}
                />
            );
        }

        var emailSection;
        if (this.props.activeSection === 'email') {
            var emailActive = ['',''];
            if (this.state.enableEmail === 'false') {
                emailActive[1] = 'active';
            } else {
                emailActive[0] = 'active';
            }

            var inputs = [];

            inputs.push(
                <div>
                    <div className='btn-group' data-toggle='buttons-radio'>
                        <button className={'btn btn-default '+emailActive[0]} onClick={function(){self.handleEmailRadio('true')}}>On</button>
                        <button className={'btn btn-default '+emailActive[1]} onClick={function(){self.handleEmailRadio('false')}}>Off</button>
                    </div>
                    <div><br/>{'Email notifications are sent for mentions and private messages after you have been away from ' + config.SiteName + ' for 5 minutes.'}</div>
                </div>
            );

            emailSection = (
                <SettingItemMax
                    title='Email notifications'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={function(e){self.updateSection('');e.preventDefault();}}
                />
            );
        } else {
            var describe = '';
            if (this.state.enableEmail === 'false') {
                describe = 'Off';
            } else {
                describe = 'On';
            }

            emailSection = (
                <SettingItemMin
                    title='Email notifications'
                    describe={describe}
                    updateSection={function(){self.updateSection('email');}}
                />
            );
        }

        var keysSection;
        if (this.props.activeSection === 'keys') {
            var inputs = [];

            if (user.first_name) {
                inputs.push(
                    <div>
                        <div className='checkbox'>
                            <label>
                                <input type='checkbox' checked={this.state.firstNameKey} onChange={function(e){self.updateFirstNameKey(e.target.checked);}}>{'Your case sensitive first name "' + user.first_name + '"'}</input>
                            </label>
                        </div>
                    </div>
                );
            }

            inputs.push(
                <div>
                    <div className='checkbox'>
                        <label>
                            <input type='checkbox' checked={this.state.usernameKey} onChange={function(e){self.updateUsernameKey(e.target.checked);}}>{'Your non-case sensitive username "' + user.username + '"'}</input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div>
                    <div className='checkbox'>
                        <label>
                            <input type='checkbox' checked={this.state.mentionKey} onChange={function(e){self.updateMentionKey(e.target.checked);}}>{'Your username mentioned "@' + user.username + '"'}</input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div>
                    <div className='checkbox'>
                        <label>
                            <input type='checkbox' checked={this.state.allKey} onChange={function(e){self.updateAllKey(e.target.checked);}}>{'Team-wide mentions "@all"'}</input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div>
                    <div className='checkbox'>
                        <label>
                            <input type='checkbox' checked={this.state.channelKey} onChange={function(e){self.updateChannelKey(e.target.checked);}}>{'Channel-wide mentions "@channel"'}</input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div>
                    <div className='checkbox'>
                        <label>
                            <input ref='customcheck' type='checkbox' checked={this.state.customKeysChecked} onChange={this.updateCustomMentionKeys}>{'Other non-case sensitive words, separated by commas:'}</input>
                        </label>
                    </div>
                    <input ref='custommentions' className='form-control mentions-input' type='text' defaultValue={this.state.customKeys} onChange={this.onCustomChange} />
                </div>
            );

            keysSection = (
                <SettingItemMax
                    title='Words that trigger mentions'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={function(e){self.updateSection('');e.preventDefault();}}
                />
            );
        } else {
            var keys = [];
            if (this.state.firstNameKey) keys.push(user.first_name);
            if (this.state.usernameKey) keys.push(user.username);
            if (this.state.mentionKey) keys.push('@'+user.username);
            if (this.state.allKey) keys.push('@all');
            if (this.state.channelKey) keys.push('@channel');
            if (this.state.customKeys.length > 0) keys = keys.concat(this.state.customKeys.split(','));

            var describe = '';
            for (var i = 0; i < keys.length; i++) {
                describe += '"' + keys[i] + '", ';
            }

            if (describe.length > 0) {
                describe = describe.substring(0, describe.length - 2);
            } else {
                describe = 'No words configured';
            }

            keysSection = (
                <SettingItemMin
                    title='Words that trigger mentions'
                    describe={describe}
                    updateSection={function(){self.updateSection('keys');}}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
                    <h4 className='modal-title' ref='title'><i className='modal-back'></i>Notifications</h4>
                </div>
                <div ref='wrapper' className='user-settings'>
                    <h3 className='tab-header'>Notifications</h3>
                    <div className='divider-dark first'/>
                    {desktopSection}
                    <div className='divider-light'/>
                    {soundSection}
                    <div className='divider-light'/>
                    {emailSection}
                    <div className='divider-light'/>
                    {keysSection}
                    <div className='divider-dark'/>
                </div>
            </div>

        );
    }
});
