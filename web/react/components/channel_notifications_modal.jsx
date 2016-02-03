// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Modal = ReactBootstrap.Modal;
import SettingItemMin from './setting_item_min.jsx';
import SettingItemMax from './setting_item_max.jsx';

import * as Client from '../utils/client.jsx';
import UserStore from '../stores/user_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';

import {FormattedMessage} from 'mm-intl';

export default class ChannelNotificationsModal extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);
        this.updateSection = this.updateSection.bind(this);

        this.handleSubmitNotifyLevel = this.handleSubmitNotifyLevel.bind(this);
        this.handleUpdateNotifyLevel = this.handleUpdateNotifyLevel.bind(this);
        this.createNotifyLevelSection = this.createNotifyLevelSection.bind(this);

        this.handleSubmitMarkUnreadLevel = this.handleSubmitMarkUnreadLevel.bind(this);
        this.handleUpdateMarkUnreadLevel = this.handleUpdateMarkUnreadLevel.bind(this);
        this.createMarkUnreadLevelSection = this.createMarkUnreadLevelSection.bind(this);

        const member = ChannelStore.getMember(props.channel.id);
        this.state = {
            notifyLevel: member.notify_props.desktop,
            markUnreadLevel: member.notify_props.mark_unread,
            channelId: ChannelStore.getCurrentId(),
            activeSection: ''
        };
    }
    componentWillReceiveProps(nextProps) {
        if (!this.props.show && nextProps.show) {
            this.onListenerChange();
            ChannelStore.addChangeListener(this.onListenerChange);
        } else {
            ChannelStore.removeChangeListener(this.onListenerChange);
        }
    }
    onListenerChange() {
        const curChannelId = ChannelStore.getCurrentId();

        if (!curChannelId) {
            return;
        }

        const newState = {channelId: curChannelId};
        const member = ChannelStore.getMember(curChannelId);

        if (member.notify_props.desktop !== this.state.notifyLevel || member.notify_props.mark_unread !== this.state.mark_unread) {
            newState.notifyLevel = member.notify_props.desktop;
            newState.markUnreadLevel = member.notify_props.mark_unread;
        }

        this.setState(newState);
    }
    updateSection(section) {
        this.setState({activeSection: section});
    }
    handleSubmitNotifyLevel() {
        var channelId = this.state.channelId;
        var notifyLevel = this.state.notifyLevel;

        if (ChannelStore.getMember(channelId).notify_props.desktop === notifyLevel) {
            this.updateSection('');
            return;
        }

        var data = {};
        data.channel_id = channelId;
        data.user_id = UserStore.getCurrentId();
        data.desktop = notifyLevel;

        Client.updateNotifyProps(data,
            () => {
                var member = ChannelStore.getMember(channelId);
                member.notify_props.desktop = notifyLevel;
                ChannelStore.setChannelMember(member);
                this.updateSection('');
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }
    handleUpdateNotifyLevel(notifyLevel) {
        this.setState({notifyLevel});
    }
    createNotifyLevelSection(serverError) {
        var handleUpdateSection;

        const user = UserStore.getCurrentUser();
        const globalNotifyLevel = user.notify_props.desktop;

        let globalNotifyLevelName;
        if (globalNotifyLevel === 'all') {
            globalNotifyLevelName = (
                <FormattedMessage
                    id='channel_notifications.allActivity'
                    defaultMessage='For all activity'
                />
            );
        } else if (globalNotifyLevel === 'mention') {
            globalNotifyLevelName = (
                <FormattedMessage
                    id='channel_notifications.onlyMentions'
                    defaultMessage='Only for mentions'
                />
            );
        } else {
            globalNotifyLevelName = (
                <FormattedMessage
                    id='channel_notifications.never'
                    defaultMessage='Never'
                />
            );
        }

        const sendDesktop = (
            <FormattedMessage
                id='channel_notifications.sendDesktop'
                defaultMessage='Send desktop notifications'
            />
        );

        if (this.state.activeSection === 'desktop') {
            var notifyActive = [false, false, false, false];
            if (this.state.notifyLevel === 'default') {
                notifyActive[0] = true;
            } else if (this.state.notifyLevel === 'all') {
                notifyActive[1] = true;
            } else if (this.state.notifyLevel === 'mention') {
                notifyActive[2] = true;
            } else {
                notifyActive[3] = true;
            }

            var inputs = [];

            inputs.push(
                <div key='channel-notification-level-radio'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[0]}
                                onChange={this.handleUpdateNotifyLevel.bind(this, 'default')}
                            />
                            <FormattedMessage
                                id='channel_notifications.globalDefault'
                                defaultMessage='Global default ({notifyLevel}'
                                values={{
                                    notifyLevel: (globalNotifyLevelName)
                                }}
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[1]}
                                onChange={this.handleUpdateNotifyLevel.bind(this, 'all')}
                            />
                            <FormattedMessage id='channel_notifications.allActivity' />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[2]}
                                onChange={this.handleUpdateNotifyLevel.bind(this, 'mention')}
                            />
                            <FormattedMessage id='channel_notifications.onlyMentions' />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[3]}
                                onChange={this.handleUpdateNotifyLevel.bind(this, 'none')}
                            />
                            <FormattedMessage id='channel_notifications.never' />
                        </label>
                    </div>
                </div>
            );

            handleUpdateSection = function updateSection(e) {
                this.updateSection('');
                this.onListenerChange();
                e.preventDefault();
            }.bind(this);

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='channel_notifications.override'
                        defaultMessage='Selecting an option other than "Default" will override the global notification settings. Desktop notifications are available on Firefox, Safari, and Chrome.'
                    />
                </span>
            );

            return (
                <SettingItemMax
                    title={sendDesktop}
                    inputs={inputs}
                    submit={this.handleSubmitNotifyLevel}
                    server_error={serverError}
                    updateSection={handleUpdateSection}
                    extraInfo={extraInfo}
                />
            );
        }

        var describe;
        if (this.state.notifyLevel === 'default') {
            describe = (
                <FormattedMessage
                    id='channel_notifications.globalDefault'
                    values={{
                        notifyLevel: (globalNotifyLevelName)
                    }}
                />
            );
        } else if (this.state.notifyLevel === 'mention') {
            describe = (<FormattedMessage id='channel_notifications.onlyMentions' />);
        } else if (this.state.notifyLevel === 'all') {
            describe = (<FormattedMessage id='channel_notifications.allActivity' />);
        } else {
            describe = (<FormattedMessage id='channel_notifications.never' />);
        }

        handleUpdateSection = function updateSection(e) {
            this.updateSection('desktop');
            e.preventDefault();
        }.bind(this);

        return (
            <SettingItemMin
                title={sendDesktop}
                describe={describe}
                updateSection={handleUpdateSection}
            />
        );
    }

    handleSubmitMarkUnreadLevel() {
        const channelId = this.state.channelId;
        const markUnreadLevel = this.state.markUnreadLevel;

        if (ChannelStore.getMember(channelId).notify_props.mark_unread === markUnreadLevel) {
            this.updateSection('');
            return;
        }

        const data = {
            channel_id: channelId,
            user_id: UserStore.getCurrentId(),
            mark_unread: markUnreadLevel
        };

        Client.updateNotifyProps(data,
            () => {
                var member = ChannelStore.getMember(channelId);
                member.notify_props.mark_unread = markUnreadLevel;
                ChannelStore.setChannelMember(member);
                this.updateSection('');
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleUpdateMarkUnreadLevel(markUnreadLevel) {
        this.setState({markUnreadLevel});
    }

    createMarkUnreadLevelSection(serverError) {
        let content;

        const markUnread = (
            <FormattedMessage
                id='channel_notifications.markUnread'
                defaultMessage='Mark Channel Unread'
            />
        );
        if (this.state.activeSection === 'markUnreadLevel') {
            const inputs = [(
                <div key='channel-notification-unread-radio'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={this.state.markUnreadLevel === 'all'}
                                onChange={this.handleUpdateMarkUnreadLevel.bind(this, 'all')}
                            />
                                <FormattedMessage
                                    id='channel_notifications.allUnread'
                                    defaultMessage='For all unread messages'
                                />
                        </label>
                        <br />
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={this.state.markUnreadLevel === 'mention'}
                                onChange={this.handleUpdateMarkUnreadLevel.bind(this, 'mention')}
                            />
                            <FormattedMessage id='channel_notifications.onlyMentions' />
                        </label>
                        <br />
                    </div>
                </div>
            )];

            const handleUpdateSection = function handleUpdateSection(e) {
                this.updateSection('');
                this.onListenerChange();
                e.preventDefault();
            }.bind(this);

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='channel_notifications.unreadInfo'
                        defaultMessage='The channel name is bolded in the sidebar when there are unread messages. Selecting "Only for mentions" will bold the channel only when you are mentioned.'
                    />
                </span>
            );

            content = (
                <SettingItemMax
                    title={markUnread}
                    inputs={inputs}
                    submit={this.handleSubmitMarkUnreadLevel}
                    server_error={serverError}
                    updateSection={handleUpdateSection}
                    extraInfo={extraInfo}
                />
            );
        } else {
            let describe;

            if (!this.state.markUnreadLevel || this.state.markUnreadLevel === 'all') {
                describe = (
                    <FormattedMessage
                        id='channel_notifications.allUnread'
                        defaultMessage='For all unread messages'
                    />
                );
            } else {
                describe = (<FormattedMessage id='channel_notifications.onlyMentions' />);
            }

            const handleUpdateSection = function handleUpdateSection(e) {
                this.updateSection('markUnreadLevel');
                e.preventDefault();
            }.bind(this);

            content = (
                <SettingItemMin
                    title={markUnread}
                    describe={describe}
                    updateSection={handleUpdateSection}
                />
            );
        }

        return content;
    }

    render() {
        var serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        return (
            <Modal
                show={this.props.show}
                dialogClassName='settings-modal'
                onHide={this.props.onHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='channel_notifications.preferences'
                            defaultMessage='Notification Preferences for '
                        />
                        <span className='name'>{this.props.channel.display_name}</span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='settings-table'>
                        <div className='settings-content'>
                            <div
                                ref='wrapper'
                                className='user-settings'
                            >
                                <br/>
                                <div className='divider-dark first'/>
                                {this.createNotifyLevelSection(serverError)}
                                <div className='divider-light'/>
                                {this.createMarkUnreadLevelSection(serverError)}
                                <div className='divider-dark'/>
                            </div>
                        </div>
                    </div>
                    {serverError}
                </Modal.Body>
            </Modal>
        );
    }
}

ChannelNotificationsModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired
};
