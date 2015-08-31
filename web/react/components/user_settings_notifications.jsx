// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
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

    var curChannel = ChannelStore.getCurrent().display_name;

    return {notifyLevel: desktop, enableEmail: email, soundNeeded: soundNeeded, enableSound: sound,
            usernameKey: usernameKey, mentionKey: mentionKey, customKeys: customKeys, customKeysChecked: customKeys.length > 0,
            firstNameKey: firstNameKey, allKey: allKey, channelKey: channelKey, curChannel: curChannel};
}

export default class NotificationsTab extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.updateSection = this.updateSection.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleNotifyRadio = this.handleNotifyRadio.bind(this);
        this.handleEmailRadio = this.handleEmailRadio.bind(this);
        this.handleSoundRadio = this.handleSoundRadio.bind(this);
        this.updateUsernameKey = this.updateUsernameKey.bind(this);
        this.updateMentionKey = this.updateMentionKey.bind(this);
        this.updateFirstNameKey = this.updateFirstNameKey.bind(this);
        this.updateAllKey = this.updateAllKey.bind(this);
        this.updateChannelKey = this.updateChannelKey.bind(this);
        this.updateCustomMentionKeys = this.updateCustomMentionKeys.bind(this);
        this.onCustomChange = this.onCustomChange.bind(this);

        this.state = getNotificationsStateFromStores();
    }
    handleSubmit() {
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
    }
    handleClose() {
        $(React.findDOMNode(this)).find('.form-control').each(function clearField() {
            this.value = '';
        });

        this.setState(assign({}, getNotificationsStateFromStores(), {serverError: null}));

        this.props.updateTab('general');
    }
    updateSection(section) {
        this.setState(this.getInitialState());
        this.props.updateSection(section);
    }
    componentDidMount() {
        UserStore.addChangeListener(this.onListenerChange);
        ChannelStore.addChangeListener(this.onListenerChange);
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    }
    componentWillUnmount() {
        UserStore.removeChangeListener(this.onListenerChange);
        ChannelStore.removeChangeListener(this.onListenerChange);
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
        this.props.updateSection('');
    }
    onListenerChange() {
        var newState = getNotificationsStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    handleNotifyRadio(notifyLevel) {
        this.setState({notifyLevel: notifyLevel});
        this.refs.wrapper.getDOMNode().focus();
    }
    handleEmailRadio(enableEmail) {
        this.setState({enableEmail: enableEmail});
        this.refs.wrapper.getDOMNode().focus();
    }
    handleSoundRadio(enableSound) {
        this.setState({enableSound: enableSound});
        this.refs.wrapper.getDOMNode().focus();
    }
    updateUsernameKey(val) {
        this.setState({usernameKey: val});
    }
    updateMentionKey(val) {
        this.setState({mentionKey: val});
    }
    updateFirstNameKey(val) {
        this.setState({firstNameKey: val});
    }
    updateAllKey(val) {
        this.setState({allKey: val});
    }
    updateChannelKey(val) {
        this.setState({channelKey: val});
    }
    updateCustomMentionKeys() {
        var checked = this.refs.customcheck.getDOMNode().checked;

        if (checked) {
            var text = this.refs.custommentions.getDOMNode().value;

            // remove all spaces and split string into individual keys
            this.setState({customKeys: text.replace(/ /g, ''), customKeysChecked: true});
        } else {
            this.setState({customKeys: '', customKeysChecked: false});
        }
    }
    onCustomChange() {
        this.refs.customcheck.getDOMNode().checked = true;
        this.updateCustomMentionKeys();
    }
    render() {
        var serverError = null;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        var self = this;

        var user = this.props.user;

        var desktopSection;
        var handleUpdateDesktopSection;
        if (this.props.activeSection === 'desktop') {
            var notifyActive = [false, false, false];
            if (this.state.notifyLevel === 'mention') {
                notifyActive[1] = true;
            } else if (this.state.notifyLevel === 'none') {
                notifyActive[2] = true;
            } else {
                notifyActive[0] = true;
            }

            let inputs = [];

            inputs.push(
                <div key='userNotificationLevelOption'>
                    <div className='radio'>
                        <label>
                            <input type='radio'
                                checked={notifyActive[0]}
                                onChange={self.handleNotifyRadio.bind(this, 'all')}
                            >
                                For all activity
                            </input>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[1]}
                                onChange={self.handleNotifyRadio.bind(this, 'mention')}
                            >
                                Only for mentions and private messages
                            </input>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[2]}
                                onChange={self.handleNotifyRadio.bind(this, 'none')}
                            >
                                Never
                            </input>
                        </label>
                    </div>
                </div>
            );

            handleUpdateDesktopSection = function updateDesktopSection(e) {
                self.props.updateSection('');
                e.preventDefault();
            };

            let extraInfo = (
                <div className='setting-list__hint'>
                    These settings will override the global notification settings for the <b>{this.state.curChannel}</b> channel
                </div>
            );

            desktopSection = (
                <SettingItemMax
                    title='Send desktop notifications'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={handleUpdateDesktopSection}
                    extraInfo={extraInfo}
                />
            );
        } else {
            let describe = '';
            if (this.state.notifyLevel === 'mention') {
                describe = 'Only for mentions and private messages';
            } else if (this.state.notifyLevel === 'none') {
                describe = 'Never';
            } else {
                describe = 'For all activity';
            }

            handleUpdateDesktopSection = function updateDesktopSection() {
                self.props.updateSection('desktop');
            };

            desktopSection = (
                <SettingItemMin
                    title='Send desktop notifications'
                    describe={describe}
                    updateSection={handleUpdateDesktopSection}
                />
            );
        }

        var soundSection;
        var handleUpdateSoundSection;
        if (this.props.activeSection === 'sound' && this.state.soundNeeded) {
            var soundActive = [false, false];
            if (this.state.enableSound === 'false') {
                soundActive[1] = true;
            } else {
                soundActive[0] = true;
            }

            let inputs = [];

            inputs.push(
                <div key='userNotificationSoundOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={soundActive[0]}
                                onChange={self.handleSoundRadio.bind(this, 'true')}
                            >
                                On
                            </input>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={soundActive[1]}
                                onChange={self.handleSoundRadio.bind(this, 'false')}
                            >
                                Off
                            </input>
                        </label>
                        <br/>
                     </div>
                 </div>
            );

            handleUpdateSoundSection = function updateSoundSection(e) {
                self.props.updateSection('');
                e.preventDefault();
            };

            soundSection = (
                <SettingItemMax
                    title='Desktop notification sounds'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={handleUpdateSoundSection}
                />
            );
        } else {
            let describe = '';
            if (!this.state.soundNeeded) {
                describe = 'Please configure notification sounds in your browser settings';
            } else if (this.state.enableSound === 'false') {
                describe = 'Off';
            } else {
                describe = 'On';
            }

            handleUpdateSoundSection = function updateSoundSection() {
                self.props.updateSection('sound');
            };

            soundSection = (
                <SettingItemMin
                    title='Desktop notification sounds'
                    describe={describe}
                    updateSection={handleUpdateSoundSection}
                    disableOpen = {!this.state.soundNeeded}
                />
            );
        }

        var emailSection;
        var handleUpdateEmailSection;
        if (this.props.activeSection === 'email') {
            var emailActive = [false, false];
            if (this.state.enableEmail === 'false') {
                emailActive[1] = true;
            } else {
                emailActive[0] = true;
            }

            let inputs = [];

            inputs.push(
                <div key='userNotificationEmailOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={emailActive[0]}
                                onChange={self.handleEmailRadio.bind(this, 'true')}
                            >
                                On
                            </input>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={emailActive[1]}
                                onChange={self.handleEmailRadio.bind(this, 'false')}
                            >
                                Off
                            </input>
                        </label>
                        <br/>
                    </div>
                    <div><br/>{'Email notifications are sent for mentions and private messages after you have been away from ' + config.SiteName + ' for 5 minutes.'}</div>
                </div>
            );

            handleUpdateEmailSection = function updateEmailSection(e) {
                self.props.updateSection('');
                e.preventDefault();
            };

            emailSection = (
                <SettingItemMax
                    title='Email notifications'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={handleUpdateEmailSection}
                />
            );
        } else {
            let describe = '';
            if (this.state.enableEmail === 'false') {
                describe = 'Off';
            } else {
                describe = 'On';
            }

            handleUpdateEmailSection = function updateEmailSection() {
                self.props.updateSection('email');
            };

            emailSection = (
                <SettingItemMin
                    title='Email notifications'
                    describe={describe}
                    updateSection={handleUpdateEmailSection}
                />
            );
        }

        var keysSection;
        var handleUpdateKeysSection;
        if (this.props.activeSection === 'keys') {
            let inputs = [];

            let handleUpdateFirstNameKey;
            let handleUpdateUsernameKey;
            let handleUpdateMentionKey;
            let handleUpdateAllKey;
            let handleUpdateChannelKey;

            if (user.first_name) {
                handleUpdateFirstNameKey = function handleFirstNameKeyChange(e) {
                    self.updateFirstNameKey(e.target.checked);
                };
                inputs.push(
                    <div key='userNotificationFirstNameOption'>
                        <div className='checkbox'>
                            <label>
                                <input
                                    type='checkbox'
                                    checked={this.state.firstNameKey}
                                    onChange={handleUpdateFirstNameKey}
                                >
                                    {'Your case sensitive first name "' + user.first_name + '"'}
                                </input>
                            </label>
                        </div>
                    </div>
                );
            }

            handleUpdateUsernameKey = function handleUsernameKeyChange(e) {
                self.updateUsernameKey(e.target.checked);
            };
            inputs.push(
                <div key='userNotificationUsernameOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.usernameKey}
                                onChange={handleUpdateUsernameKey}
                            >
                                {'Your non-case sensitive username "' + user.username + '"'}
                            </input>
                        </label>
                    </div>
                </div>
            );

            handleUpdateMentionKey = function handleMentionKeyChange(e) {
                self.updateMentionKey(e.target.checked);
            };
            inputs.push(
                <div key='userNotificationMentionOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.mentionKey}
                                onChange={handleUpdateMentionKey}
                            >
                                {'Your username mentioned "@' + user.username + '"'}
                            </input>
                        </label>
                    </div>
                </div>
            );

            handleUpdateAllKey = function handleAllKeyChange(e) {
                self.updateAllKey(e.target.checked);
            };
            inputs.push(
                <div key='userNotificationAllOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.allKey}
                                onChange={handleUpdateAllKey}
                            >
                                {'Team-wide mentions "@all"'}
                            </input>
                        </label>
                    </div>
                </div>
            );

            handleUpdateChannelKey = function handleChannelKeyChange(e) {
                self.updateChannelKey(e.target.checked);
            };
            inputs.push(
                <div key='userNotificationChannelOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.channelKey}
                                onChange={handleUpdateChannelKey}
                            >
                                {'Channel-wide mentions "@channel"'}
                            </input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div key='userNotificationCustomOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                ref='customcheck'
                                type='checkbox'
                                checked={this.state.customKeysChecked}
                                onChange={this.updateCustomMentionKeys}
                            >
                                {'Other non-case sensitive words, separated by commas:'}
                            </input>
                        </label>
                    </div>
                    <input
                        ref='custommentions'
                        className='form-control mentions-input'
                        type='text'
                        defaultValue={this.state.customKeys}
                        onChange={this.onCustomChange}
                    />
                </div>
            );

            handleUpdateKeysSection = function updateKeysSection(e) {
                self.props.updateSection('');
                e.preventDefault();
            };
            keysSection = (
                <SettingItemMax
                    title='Words that trigger mentions'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={handleUpdateKeysSection}
                />
            );
        } else {
            let keys = [];
            if (this.state.firstNameKey) {
                keys.push(user.first_name);
            }
            if (this.state.usernameKey) {
                keys.push(user.username);
            }
            if (this.state.mentionKey) {
                keys.push('@' + user.username);
            }
            if (this.state.allKey) {
                keys.push('@all');
            }
            if (this.state.channelKey) {
                keys.push('@channel');
            }
            if (this.state.customKeys.length > 0) {
                keys = keys.concat(this.state.customKeys.split(','));
            }

            let describe = '';
            for (var i = 0; i < keys.length; i++) {
                describe += '"' + keys[i] + '", ';
            }

            if (describe.length > 0) {
                describe = describe.substring(0, describe.length - 2);
            } else {
                describe = 'No words configured';
            }

            handleUpdateKeysSection = function updateKeysSection() {
                self.props.updateSection('keys');
            };

            keysSection = (
                <SettingItemMin
                    title='Words that trigger mentions'
                    describe={describe}
                    updateSection={handleUpdateKeysSection}
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
                        <span aria-hidden='true'>&times;</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i className='modal-back'></i>
                        Notifications
                    </h4>
                </div>
                <div
                    ref='wrapper'
                    className='user-settings'
                >
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
}

NotificationsTab.defaultProps = {
    user: null,
    activeSection: '',
    activeTab: ''
};
NotificationsTab.propTypes = {
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string,
    activeTab: React.PropTypes.string
};
