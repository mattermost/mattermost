// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';

import UserStore from '../../stores/user_store.jsx';

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import * as Utils from '../../utils/utils.jsx';

const messages = defineMessages({
    allActivity: {
        id: 'user.settings.notification.allActivity',
        defaultMessage: 'For all activity'
    },
    onlyMentions: {
        id: 'user.settings.notifications.onlyMentions',
        defaultMessage: 'Only for mentions and direct messages'
    },
    never: {
        id: 'user.settings.notifications.never',
        defaultMessage: 'Never'
    },
    info: {
        id: 'user.settings.notifications.info',
        defaultMessage: 'Desktop notifications are available on Firefox, Safari, and Chrome.'
    },
    desktop: {
        id: 'user.settings.notifications.desktop',
        defaultMessage: 'Send desktop notifications'
    },
    on: {
        id: 'user.settings.notifications.on',
        defaultMessage: 'On'
    },
    off: {
        id: 'user.settings.notifications.off',
        defaultMessage: 'Off'
    },
    soundsInfo: {
        id: 'user.settings.notifications.soundInfo',
        defaultMessage: 'Desktop notification sounds are available on Firefox, Safari, Chrome, Internet Explorer, and Edge.'
    },
    desktopSounds: {
        id: 'user.settings.notifications.desktopSounds',
        defaultMessage: 'Desktop notification sounds'
    },
    soundConfig: {
        id: 'user.settings.notification.soundConfig',
        defaultMessage: 'Please configure notification sounds in your browser settings'
    },
    emailInfo1: {
        id: 'user.settings.notifications.emailInfo1',
        defaultMessage: 'Email notifications are sent for mentions and direct messages after you’ve been offline for more than 60 seconds or away from '
    },
    emailInfo2: {
        id: 'user.settings.notifications.emailInfo2',
        defaultMessage: ' for more than 5 minutes.'
    },
    emailNotifications: {
        id: 'user.settings.notifications.emailNotifications',
        defaultMessage: 'Email notifications'
    },
    sensitiveName: {
        id: 'user.settings.notifications.sensitiveName',
        defaultMessage: 'Your case sensitive first name "'
    },
    sensitiveUsername: {
        id: 'user.settings.notifications.sensitiveUsername',
        defaultMessage: 'Your non-case sensitive username "'
    },
    usernameMention: {
        id: 'user.settings.notifications.usernameMention',
        defaultMessage: 'Your username mentioned "@'
    },
    teamWide: {
        id: 'user.settings.notifications.teamWide',
        defaultMessage: 'Team-wide mentions "@all"'
    },
    channelWide: {
        id: 'user.settings.notifications.channelWide',
        defaultMessage: 'Channel-wide mentions "@channel"'
    },
    sensitiveWords: {
        id: 'user.settings.notifications.sensitiveWords',
        defaultMessage: 'Other non-case sensitive words, separated by commas:'
    },
    wordsTrigger: {
        id: 'user.settings.notifications.wordsTrigger',
        defaultMessage: 'Words that trigger mentions'
    },
    noWords: {
        id: 'user.settings.notifications.noWords',
        defaultMessage: 'No words configured'
    },
    close: {
        id: 'user.settings.notifications.close',
        defaultMessage: 'Close'
    },
    title: {
        id: 'user.settings.notifications.title',
        defaultMessage: 'Notification Settings'
    }
});

function getNotificationsStateFromStores() {
    var user = UserStore.getCurrentUser();
    var soundNeeded = !Utils.isBrowserFirefox();

    var sound = 'true';
    if (user.notify_props && user.notify_props.desktop_sound) {
        sound = user.notify_props.desktop_sound;
    }
    var desktop = 'default';
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

            if (keys.indexOf(user.username) === -1) {
                usernameKey = false;
            } else {
                usernameKey = true;
                keys.splice(keys.indexOf(user.username), 1);
            }

            if (keys.indexOf('@' + user.username) === -1) {
                mentionKey = false;
            } else {
                mentionKey = true;
                keys.splice(keys.indexOf('@' + user.username), 1);
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

    return {notifyLevel: desktop, enableEmail: email, soundNeeded: soundNeeded, enableSound: sound,
            usernameKey: usernameKey, mentionKey: mentionKey, customKeys: customKeys, customKeysChecked: customKeys.length > 0,
            firstNameKey: firstNameKey, allKey: allKey, channelKey: channelKey};
}

class NotificationsTab extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.updateSection = this.updateSection.bind(this);
        this.updateState = this.updateState.bind(this);
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

        Client.updateUserNotifyProps(data,
            function success() {
                this.props.updateSection('');
                AsyncClient.getMe();
            }.bind(this),
            function failure(err) {
                this.setState({serverError: err.message});
            }.bind(this)
        );
    }
    handleCancel(e) {
        this.updateState();
        this.props.updateSection('');
        e.preventDefault();
    }
    updateSection(section) {
        this.updateState();
        this.props.updateSection(section);
    }
    updateState() {
        const newState = getNotificationsStateFromStores();
        if (!Utils.areObjectsEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    componentDidMount() {
        UserStore.addChangeListener(this.onListenerChange);
    }
    componentWillUnmount() {
        UserStore.removeChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        this.updateState();
    }
    handleNotifyRadio(notifyLevel) {
        this.setState({notifyLevel: notifyLevel});
        ReactDOM.findDOMNode(this.refs.wrapper).focus();
    }
    handleEmailRadio(enableEmail) {
        this.setState({enableEmail: enableEmail});
        ReactDOM.findDOMNode(this.refs.wrapper).focus();
    }
    handleSoundRadio(enableSound) {
        this.setState({enableSound: enableSound});
        ReactDOM.findDOMNode(this.refs.wrapper).focus();
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
        var checked = ReactDOM.findDOMNode(this.refs.customcheck).checked;

        if (checked) {
            var text = ReactDOM.findDOMNode(this.refs.custommentions).value;

            // remove all spaces and split string into individual keys
            this.setState({customKeys: text.replace(/ /g, ''), customKeysChecked: true});
        } else {
            this.setState({customKeys: '', customKeysChecked: false});
        }
    }
    onCustomChange() {
        ReactDOM.findDOMNode(this.refs.customcheck).checked = true;
        this.updateCustomMentionKeys();
    }
    render() {
        const {formatMessage} = this.props.intl;
        var serverError = null;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

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
                                onChange={this.handleNotifyRadio.bind(this, 'all')}
                            />
                            {formatMessage(messages.allActivity)}
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[1]}
                                onChange={this.handleNotifyRadio.bind(this, 'mention')}
                            />
                            {formatMessage(messages.onlyMentions)}
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[2]}
                                onChange={this.handleNotifyRadio.bind(this, 'none')}
                            />
                            {formatMessage(messages.never)}
                        </label>
                    </div>
                </div>
            );

            const extraInfo = <span>{formatMessage(messages.info)}</span>;

            desktopSection = (
                <SettingItemMax
                    title={formatMessage(messages.desktop)}
                    extraInfo={extraInfo}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={this.handleCancel}
                />
            );
        } else {
            let describe = '';
            if (this.state.notifyLevel === 'mention') {
                describe = formatMessage(messages.onlyMentions);
            } else if (this.state.notifyLevel === 'none') {
                describe = formatMessage(messages.never);
            } else {
                describe = formatMessage(messages.allActivity);
            }

            handleUpdateDesktopSection = function updateDesktopSection() {
                this.props.updateSection('desktop');
            }.bind(this);

            desktopSection = (
                <SettingItemMin
                    title={formatMessage(messages.desktop)}
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
                                onChange={this.handleSoundRadio.bind(this, 'true')}
                            />
                            {formatMessage(messages.on)}
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={soundActive[1]}
                                onChange={this.handleSoundRadio.bind(this, 'false')}
                            />
                            {formatMessage(messages.off)}
                        </label>
                        <br/>
                     </div>
                 </div>
            );

            const extraInfo = <span>{formatMessage(messages.soundsInfo)}</span>;

            soundSection = (
                <SettingItemMax
                    title={formatMessage(messages.desktopSounds)}
                    extraInfo={extraInfo}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={this.handleCancel}
                />
            );
        } else {
            let describe = '';
            if (!this.state.soundNeeded) {
                describe = formatMessage(messages.soundConfig);
            } else if (this.state.enableSound === 'false') {
                describe = formatMessage(messages.off);
            } else {
                describe = formatMessage(messages.on);
            }

            handleUpdateSoundSection = function updateSoundSection() {
                this.props.updateSection('sound');
            }.bind(this);

            soundSection = (
                <SettingItemMin
                    title={formatMessage(messages.desktopSounds)}
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
                                onChange={this.handleEmailRadio.bind(this, 'true')}
                            />
                            {formatMessage(messages.on)}
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={emailActive[1]}
                                onChange={this.handleEmailRadio.bind(this, 'false')}
                            />
                            {formatMessage(messages.off)}
                        </label>
                        <br/>
                    </div>
                    <div><br/>{formatMessage(messages.emailInfo1) + global.window.mm_config.SiteName + formatMessage(messages.emailInfo2)}</div>
                </div>
            );

            emailSection = (
                <SettingItemMax
                    title={formatMessage(messages.emailNotifications)}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={this.handleCancel}
                />
            );
        } else {
            let describe = '';
            if (this.state.enableEmail === 'false') {
                describe = formatMessage(messages.off);
            } else {
                describe = formatMessage(messages.on);
            }

            handleUpdateEmailSection = function updateEmailSection() {
                this.props.updateSection('email');
            }.bind(this);

            emailSection = (
                <SettingItemMin
                    title={formatMessage(messages.emailNotifications)}
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
                    this.updateFirstNameKey(e.target.checked);
                }.bind(this);
                inputs.push(
                    <div key='userNotificationFirstNameOption'>
                        <div className='checkbox'>
                            <label>
                                <input
                                    type='checkbox'
                                    checked={this.state.firstNameKey}
                                    onChange={handleUpdateFirstNameKey}
                                />
                                {formatMessage(messages.sensitiveName) + user.first_name + '"'}
                            </label>
                        </div>
                    </div>
                );
            }

            handleUpdateUsernameKey = function handleUsernameKeyChange(e) {
                this.updateUsernameKey(e.target.checked);
            }.bind(this);
            inputs.push(
                <div key='userNotificationUsernameOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.usernameKey}
                                onChange={handleUpdateUsernameKey}
                            />
                            {formatMessage(messages.sensitiveName) + user.username + '"'}
                        </label>
                    </div>
                </div>
            );

            handleUpdateMentionKey = function handleMentionKeyChange(e) {
                this.updateMentionKey(e.target.checked);
            }.bind(this);
            inputs.push(
                <div key='userNotificationMentionOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.mentionKey}
                                onChange={handleUpdateMentionKey}
                            />
                            {formatMessage(messages.usernameMention) + user.username + '"'}
                        </label>
                    </div>
                </div>
            );

            handleUpdateAllKey = function handleAllKeyChange(e) {
                this.updateAllKey(e.target.checked);
            }.bind(this);
            inputs.push(
                <div key='userNotificationAllOption'>
                    <div className='checkbox hidden'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.allKey}
                                onChange={handleUpdateAllKey}
                            />
                            {formatMessage(messages.teamWide)}
                        </label>
                    </div>
                </div>
            );

            handleUpdateChannelKey = function handleChannelKeyChange(e) {
                this.updateChannelKey(e.target.checked);
            }.bind(this);
            inputs.push(
                <div key='userNotificationChannelOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.channelKey}
                                onChange={handleUpdateChannelKey}
                            />
                            {formatMessage(messages.channelWide)}
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
                            />
                            {formatMessage(messages.sensitiveWords)}
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

            keysSection = (
                <SettingItemMax
                    title={formatMessage(messages.wordsTrigger)}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={this.handleCancel}
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

            // if (this.state.allKey) {
            //     keys.push('@all');
            // }

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
                describe = formatMessage(messages.noWords);
            }

            handleUpdateKeysSection = function updateKeysSection() {
                this.props.updateSection('keys');
            }.bind(this);

            keysSection = (
                <SettingItemMin
                    title={formatMessage(messages.wordsTrigger)}
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
                        aria-label={formatMessage(messages.close)}
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
                        {formatMessage(messages.title)}
                    </h4>
                </div>
                <div
                    ref='wrapper'
                    className='user-settings'
                >
                    <h3 className='tab-header'>{formatMessage(messages.title)}</h3>
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
    intl: intlShape.isRequired,
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string,
    activeTab: React.PropTypes.string,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired
};

export default injectIntl(NotificationsTab);