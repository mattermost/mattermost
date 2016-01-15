// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';

import NavbarSearchBox from './search_bar.jsx';
import MessageWrapper from './message_wrapper.jsx';
import PopoverListMembers from './popover_list_members.jsx';
import EditChannelHeaderModal from './edit_channel_header_modal.jsx';
import EditChannelPurposeModal from './edit_channel_purpose_modal.jsx';
import ChannelInfoModal from './channel_info_modal.jsx';
import ChannelInviteModal from './channel_invite_modal.jsx';
import ChannelMembersModal from './channel_members_modal.jsx';
import ChannelNotificationsModal from './channel_notifications_modal.jsx';
import DeleteChannelModal from './delete_channel_modal.jsx';
import ToggleModalButton from './toggle_modal_button.jsx';

import ChannelStore from '../stores/channel_store.jsx';
import UserStore from '../stores/user_store.jsx';
import SearchStore from '../stores/search_store.jsx';
import PreferenceStore from '../stores/preference_store.jsx';

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import * as Utils from '../utils/utils.jsx';
import * as TextFormatting from '../utils/text_formatting.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

const Popover = ReactBootstrap.Popover;
const OverlayTrigger = ReactBootstrap.OverlayTrigger;
const Tooltip = ReactBootstrap.Tooltip;

const messages = defineMessages({
    channel: {
        id: 'channel_header.channel',
        defaultMessage: 'Channel'
    },
    group: {
        id: 'channel_header.group',
        defaultMessage: 'Group'
    },
    channelHeader: {
        id: 'channel_header.channelHeader',
        defaultMessage: 'Set Channel Header...'
    },
    viewInfo: {
        id: 'channel_header.viewInfo',
        defaultMessage: 'View Info'
    },
    addMembers: {
        id: 'chanel_header.addMembers',
        defaultMessage: 'Add Members'
    },
    manageMembers: {
        id: 'channel_header.manageMembers',
        defaultMessage: 'Manage Members'
    },
    notificationPreferences: {
        id: 'channel_header.notificationPreferences',
        defaultMessage: 'Notification Preferences'
    },
    rename: {
        id: 'channel_header.rename',
        defaultMessage: 'Rename '
    },
    deleteChannel: {
        id: 'channel_header.deleteChannel',
        defaultMessage: 'Delete '
    },
    leave: {
        id: 'channel_header.leave',
        defaultMessage: 'Leave '
    },
    recentMentions: {
        id: 'channel_header.recentMentions',
        defaultMessage: 'Recent Mentions'
    }
});

class ChannelHeader extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleLeave = this.handleLeave.bind(this);
        this.searchMentions = this.searchMentions.bind(this);

        const state = this.getStateFromStores();
        state.showEditChannelPurposeModal = false;
        state.showMembersModal = false;
        this.state = state;
    }
    getStateFromStores() {
        const extraInfo = ChannelStore.getCurrentExtraInfo();

        return {
            channel: ChannelStore.getCurrent(),
            memberChannel: ChannelStore.getCurrentMember(),
            memberTeam: UserStore.getCurrentUser(),
            users: extraInfo.members,
            userCount: extraInfo.member_count,
            searchVisible: SearchStore.getSearchResults() !== null
        };
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onListenerChange);
        ChannelStore.addExtraInfoChangeListener(this.onListenerChange);
        SearchStore.addSearchChangeListener(this.onListenerChange);
        UserStore.addChangeListener(this.onListenerChange);
        PreferenceStore.addChangeListener(this.onListenerChange);
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onListenerChange);
        ChannelStore.removeExtraInfoChangeListener(this.onListenerChange);
        SearchStore.removeSearchChangeListener(this.onListenerChange);
        UserStore.removeChangeListener(this.onListenerChange);
        PreferenceStore.removeChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        const newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(newState, this.state)) {
            this.setState(newState);
        }
        $('.channel-header__info .description').popover({placement: 'bottom', trigger: 'hover', html: true, delay: {show: 500, hide: 500}});
    }
    handleLeave() {
        Client.leaveChannel(this.state.channel.id,
            () => {
                AppDispatcher.handleViewAction({
                    type: ActionTypes.LEAVE_CHANNEL,
                    id: this.state.channel.id
                });

                const townsquare = ChannelStore.getByName('general');
                Utils.switchChannel(townsquare);
            },
            (err) => {
                AsyncClient.dispatchError(err, 'handleLeave');
            }
        );
    }
    searchMentions(e) {
        e.preventDefault();

        const user = UserStore.getCurrentUser();

        let terms = '';
        if (user.notify_props && user.notify_props.mention_keys) {
            const termKeys = UserStore.getCurrentMentionKeys();

            if (user.notify_props.all === 'true' && termKeys.indexOf('@all') !== -1) {
                termKeys.splice(termKeys.indexOf('@all'), 1);
            }

            if (user.notify_props.channel === 'true' && termKeys.indexOf('@channel') !== -1) {
                termKeys.splice(termKeys.indexOf('@channel'), 1);
            }
            terms = termKeys.join(' ');
        }

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH_TERM,
            term: terms,
            do_search: true,
            is_mention_search: true
        });
    }
    render() {
        if (this.state.channel === null) {
            return null;
        }

        const {formatMessage} = this.props.intl;
        const channel = this.state.channel;
        const recentMentionsTooltip = <Tooltip id='recentMentionsTooltip'>{formatMessage(messages.recentMentions)}</Tooltip>;
        const popoverContent = (
            <Popover
                id='hader-popover'
                bStyle='info'
                bSize='large'
                placement='bottom'
                className='description'
                onMouseOver={() => this.refs.headerOverlay.show()}
                onMouseOut={() => this.refs.headerOverlay.hide()}
            >
                <MessageWrapper
                    message={channel.header}
                />
            </Popover>
        );
        let channelTitle = channel.display_name;
        const currentId = UserStore.getCurrentId();
        const isAdmin = Utils.isAdmin(this.state.memberChannel.roles) || Utils.isAdmin(this.state.memberTeam.roles);
        const isDirect = (this.state.channel.type === 'D');

        if (isDirect) {
            if (this.state.users.length > 1) {
                let contact;
                if (this.state.users[0].id === currentId) {
                    contact = this.state.users[1];
                } else {
                    contact = this.state.users[0];
                }
                channelTitle = Utils.displayUsername(contact.id);
            }
        }

        let channelTerm = formatMessage(messages.channel);
        if (channel.type === 'P') {
            channelTerm = formatMessage(messages.group);
        }

        const dropdownContents = [];
        if (isDirect) {
            dropdownContents.push(
                <li
                    key='edit_header_direct'
                    role='presentation'
                >
                    <ToggleModalButton
                        role='menuitem'
                        dialogType={EditChannelHeaderModal}
                        dialogProps={{channel}}
                    >
                        {formatMessage(messages.channelHeader)}
                    </ToggleModalButton>
                </li>
            );
        } else {
            dropdownContents.push(
                <li
                    key='view_info'
                    role='presentation'
                >
                    <ToggleModalButton
                        role='menuitem'
                        dialogType={ChannelInfoModal}
                        dialogProps={{channel}}
                    >
                        {formatMessage(messages.viewInfo)}
                    </ToggleModalButton>
                </li>
            );

            if (!ChannelStore.isDefault(channel)) {
                dropdownContents.push(
                    <li
                        key='add_members'
                        role='presentation'
                    >
                        <ToggleModalButton
                            role='menuitem'
                            dialogType={ChannelInviteModal}
                            dialogProps={{channel}}
                        >
                            {formatMessage(messages.addMembers)}
                        </ToggleModalButton>
                    </li>
                );

                if (isAdmin) {
                    dropdownContents.push(
                        <li
                            key='manage_members'
                            role='presentation'
                        >
                            <a
                                role='menuitem'
                                href='#'
                                onClick={() => this.setState({showMembersModal: true})}
                            >
                                {formatMessage(messages.manageMembers)}
                            </a>
                        </li>
                    );
                }
            }

            dropdownContents.push(
                <li
                    key='set_channel_header'
                    role='presentation'
                >
                    <ToggleModalButton
                        role='menuitem'
                        dialogType={EditChannelHeaderModal}
                        dialogProps={{channel}}
                    >
                        <FormattedMessage
                            id='channel_header.header'
                            defaultMessage='Set {term} Header...'
                            values={{
                                term: channelTerm
                            }}
                        />
                    </ToggleModalButton>
                </li>
            );
            dropdownContents.push(
                <li
                    key='set_channel_purpose'
                    role='presentation'
                >
                    <a
                        role='menuitem'
                        href='#'
                        onClick={() => this.setState({showEditChannelPurposeModal: true})}
                    >
                        <FormattedMessage
                            id='channel_header.purpose'
                            defaultMessage='Set {term} Purpose...'
                            values={{
                                term: channelTerm
                            }}
                            />
                    </a>
                </li>
            );
            dropdownContents.push(
                <li
                    key='notification_preferences'
                    role='presentation'
                >
                    <ToggleModalButton
                        role='menuitem'
                        dialogType={ChannelNotificationsModal}
                        dialogProps={{channel}}
                    >
                        {formatMessage(messages.notificationPreferences)}
                    </ToggleModalButton>
                </li>
            );

            if (isAdmin) {
                dropdownContents.push(
                    <li
                        key='rename_channel'
                        role='presentation'
                    >
                        <a
                            role='menuitem'
                            href='#'
                            data-toggle='modal'
                            data-target='#rename_channel'
                            data-display={channel.display_name}
                            data-name={channel.name}
                            data-channelid={channel.id}
                        >
                            {formatMessage(messages.rename) + channelTerm}...
                        </a>
                    </li>
                );

                if (!ChannelStore.isDefault(channel)) {
                    dropdownContents.push(
                        <li
                            key='delete_channel'
                            role='presentation'
                        >
                            <ToggleModalButton
                                role='menuitem'
                                dialogType={DeleteChannelModal}
                                dialogProps={{channel}}
                            >
                                {formatMessage(messages.deleteChannel) + channelTerm}...
                            </ToggleModalButton>
                        </li>
                    );
                }
            }

            if (!ChannelStore.isDefault(channel)) {
                dropdownContents.push(
                    <li
                        key='leave_channel'
                        role='presentation'
                    >
                        <a
                            role='menuitem'
                            href='#'
                            onClick={this.handleLeave}
                        >
                            {formatMessage(messages.leave) + channelTerm}
                        </a>
                    </li>
                );
            }
        }

        return (
            <div>
                <table className='channel-header alt'>
                    <tbody>
                        <tr>
                            <th>
                                <div className='channel-header__info'>
                                    <div className='dropdown'>
                                        <a
                                            href='#'
                                            className='dropdown-toggle theme'
                                            type='button'
                                            id='channel_header_dropdown'
                                            data-toggle='dropdown'
                                            aria-expanded='true'
                                        >
                                            <strong className='heading'>{channelTitle} </strong>
                                            <span className='glyphicon glyphicon-chevron-down header-dropdown__icon' />
                                        </a>
                                        <ul
                                            className='dropdown-menu'
                                            role='menu'
                                            aria-labelledby='channel_header_dropdown'
                                        >
                                            {dropdownContents}
                                        </ul>
                                    </div>
                                    <OverlayTrigger
                                        trigger={['hover', 'focus']}
                                        placement='bottom'
                                        overlay={popoverContent}
                                        ref='headerOverlay'
                                    >
                                    <div
                                        onClick={TextFormatting.handleClick}
                                        className='description'
                                        dangerouslySetInnerHTML={{__html: TextFormatting.formatText(channel.header, {singleline: true, mentionHighlight: false})}}
                                    />
                                    </OverlayTrigger>
                                </div>
                            </th>
                            <th>
                                <PopoverListMembers
                                    members={this.state.users}
                                    memberCount={this.state.userCount}
                                    channelId={channel.id}
                                />
                            </th>
                            <th className='search-bar__container'><NavbarSearchBox /></th>
                            <th>
                                <div className='dropdown channel-header__links'>
                                    <OverlayTrigger
                                        delayShow={400}
                                        placement='bottom'
                                        overlay={recentMentionsTooltip}
                                    >
                                        <a
                                            href='#'
                                            type='button'
                                            onClick={this.searchMentions}
                                        >
                                            {'@'}
                                        </a>
                                    </OverlayTrigger>
                                </div>
                            </th>
                        </tr>
                    </tbody>
                </table>
                <EditChannelPurposeModal
                    show={this.state.showEditChannelPurposeModal}
                    onModalDismissed={() => this.setState({showEditChannelPurposeModal: false})}
                    channel={channel}
                />
                <ChannelMembersModal
                    show={this.state.showMembersModal}
                    onModalDismissed={() => this.setState({showMembersModal: false})}
                    channel={channel}
                />
            </div>
        );
    }
}

ChannelHeader.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(ChannelHeader);