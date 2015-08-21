// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SettingItemMin = require('./setting_item_min.jsx');
var SettingItemMax = require('./setting_item_max.jsx');

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');

export default class ChannelNotifications extends React.Component {
    constructor(props) {
        super(props);
        this.onListenerChange = this.onListenerChange.bind(this);
        this.updateSection = this.updateSection.bind(this);
        this.handleUpdate = this.handleUpdate.bind(this);
        this.handleRadioClick = this.handleRadioClick.bind(this);
        this.handleQuietToggle = this.handleQuietToggle.bind(this);
        this.state = {notifyLevel: '', title: '', channelId: '', activeSection: ''};
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onListenerChange);

        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function showModal(e) {
            var button = e.relatedTarget;
            var channelId = button.getAttribute('data-channelid');

            var notifyLevel = ChannelStore.getMember(channelId).notify_level;
            var quietMode = false;

            if (notifyLevel === 'quiet') {
                quietMode = true;
            }

            self.setState({notifyLevel: notifyLevel, quietMode: quietMode, title: button.getAttribute('data-title'), channelId: channelId});
        });
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        if (!this.state.channelId) {
            return;
        }

        var notifyLevel = ChannelStore.getMember(this.state.channelId).notify_level;
        var quietMode = false;
        if (notifyLevel === 'quiet') {
            quietMode = true;
        }

        var newState = this.state;
        newState.notifyLevel = notifyLevel;
        newState.quietMode = quietMode;

        if (!utils.areStatesEqual(this.state, newState)) {
            this.setState(newState);
        }
    }
    updateSection(section) {
        this.setState({activeSection: section});
    }
    handleUpdate() {
        var channelId = this.state.channelId;
        var notifyLevel = this.state.notifyLevel;
        if (this.state.quietMode) {
            notifyLevel = 'quiet';
        }

        var data = {};
        data.channel_id = channelId;
        data.user_id = UserStore.getCurrentId();
        data.notify_level = notifyLevel;

        if (!data.notify_level || data.notify_level.length === 0) {
            return;
        }

        client.updateNotifyLevel(data,
            function success() {
                var member = ChannelStore.getMember(channelId);
                member.notify_level = notifyLevel;
                ChannelStore.setChannelMember(member);
                this.updateSection('');
            }.bind(this),
            function error(err) {
                this.setState({serverError: err.message});
            }.bind(this)
        );
    }
    handleRadioClick(notifyLevel) {
        this.setState({notifyLevel: notifyLevel, quietMode: false});
        this.refs.modal.getDOMNode().focus();
    }
    handleQuietToggle(quietMode) {
        this.setState({notifyLevel: 'none', quietMode: quietMode});
        this.refs.modal.getDOMNode().focus();
    }
    render() {
        var serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var self = this;
        var describe = '';
        var inputs = [];

        var handleUpdateSection;

        var desktopSection;
        if (this.state.activeSection === 'desktop') {
            var notifyActive = [false, false, false];
            if (this.state.notifyLevel === 'mention') {
                notifyActive[1] = true;
            } else if (this.state.notifyLevel === 'all') {
                notifyActive[0] = true;
            } else {
                notifyActive[2] = true;
            }

            inputs.push(
                <div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[0]}
                                onChange={self.handleRadioClick.bind(this, 'all')}
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
                                onChange={self.handleRadioClick.bind(this, 'mention')}
                            >
                                Only for mentions
                            </input>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[2]}
                                onChange={self.handleRadioClick.bind(this, 'none')}
                            >
                                Never
                            </input>
                        </label>
                    </div>
                </div>
            );

            handleUpdateSection = function updateSection(e) {
                self.updateSection('');
                self.onListenerChange();
                e.preventDefault();
            };

            desktopSection = (
                <SettingItemMax
                    title='Send desktop notifications'
                    inputs={inputs}
                    submit={this.handleUpdate}
                    server_error={serverError}
                    updateSection={handleUpdateSection}
                />
            );
        } else {
            if (this.state.notifyLevel === 'mention') {
                describe = 'Only for mentions';
            } else if (this.state.notifyLevel === 'all') {
                describe = 'For all activity';
            } else {
                describe = 'Never';
            }

            handleUpdateSection = function updateSection(e) {
                self.updateSection('desktop');
                e.preventDefault();
            };

            desktopSection = (
                <SettingItemMin
                    title='Send desktop notifications'
                    describe={describe}
                    updateSection={handleUpdateSection}
                />
            );
        }

        var quietSection;
        if (this.state.activeSection === 'quiet') {
            var quietActive = [false, false];
            if (this.state.quietMode) {
                quietActive[0] = true;
            } else {
                quietActive[1] = true;
            }

            inputs.push(
                <div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={quietActive[0]}
                                onChange={self.handleQuietToggle.bind(this, true)}
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
                                checked={quietActive[1]}
                                onChange={self.handleQuietToggle.bind(this, false)}
                            >
                                Off
                            </input>
                        </label>
                        <br/>
                    </div>
                </div>
            );

            inputs.push(
                <div>
                    <br/>
                    Enabling quiet mode will turn off desktop notifications and only mark the channel as unread if you have been mentioned.
                </div>
            );

            handleUpdateSection = function updateSection(e) {
                self.updateSection('');
                self.onListenerChange();
                e.preventDefault();
            };

            quietSection = (
                <SettingItemMax
                    title='Quiet mode'
                    inputs={inputs}
                    submit={this.handleUpdate}
                    server_error={serverError}
                    updateSection={handleUpdateSection}
                />
            );
        } else {
            if (this.state.quietMode) {
                describe = 'On';
            } else {
                describe = 'Off';
            }

            handleUpdateSection = function updateSection(e) {
                self.updateSection('quiet');
                e.preventDefault();
            };

            quietSection = (
                <SettingItemMin
                    title='Quiet mode'
                    describe={describe}
                    updateSection={handleUpdateSection}
                />
            );
        }

        return (
            <div
                className='modal fade'
                id='channel_notifications'
                ref='modal'
                tabIndex='-1'
                role='dialog'
                aria-hidden='true'
            >
                <div className='modal-dialog settings-modal'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <button
                                type='button'
                                className='close'
                                data-dismiss='modal'
                            >
                                <span aria-hidden='true'>&times;</span>
                                <span className='sr-only'>Close</span>
                            </button>
                            <h4 className='modal-title'>Notification Preferences for <span className='name'>{this.state.title}</span></h4>
                        </div>
                        <div className='modal-body'>
                            <div className='settings-table'>
                            <div className='settings-content'>
                                <div
                                    ref='wrapper'
                                    className='user-settings'
                                >
                                    <br/>
                                    <div className='divider-dark first'/>
                                    {desktopSection}
                                    <div className='divider-light'/>
                                    {quietSection}
                                    <div className='divider-dark'/>
                                </div>
                            </div>
                            </div>
                            {serverError}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
