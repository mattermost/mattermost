// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import 'bootstrap';
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
import RenameChannelModal from './rename_channel_modal.jsx';
import ToggleModalButton from './toggle_modal_button.jsx';
import StatusIcon from './status_icon.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import SearchStore from 'stores/search_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import * as Utils from 'utils/utils.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';
import Client from 'client/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import {getFlaggedPosts} from 'actions/post_actions.jsx';

import Constants from 'utils/constants.jsx';
const UserStatuses = Constants.UserStatuses;
const ActionTypes = Constants.ActionTypes;

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';
import {Tooltip, OverlayTrigger, Popover} from 'react-bootstrap';

export default class ChannelHeader extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleLeave = this.handleLeave.bind(this);
        this.searchMentions = this.searchMentions.bind(this);
        this.showRenameChannelModal = this.showRenameChannelModal.bind(this);
        this.hideRenameChannelModal = this.hideRenameChannelModal.bind(this);
        this.openRecentMentions = this.openRecentMentions.bind(this);
        this.getFlagged = this.getFlagged.bind(this);

        const state = this.getStateFromStores();
        state.showEditChannelPurposeModal = false;
        state.showMembersModal = false;
        state.showRenameChannelModal = false;
        this.state = state;
    }

    getStateFromStores() {
        const extraInfo = ChannelStore.getExtraInfo(this.props.channelId);

        return {
            channel: ChannelStore.get(this.props.channelId),
            memberChannel: ChannelStore.getMember(this.props.channelId),
            users: extraInfo.members,
            userCount: extraInfo.member_count,
            currentUser: UserStore.getCurrentUser()
        };
    }

    validState() {
        if (!this.state.channel ||
            !this.state.memberChannel ||
            !this.state.users ||
            !this.state.userCount ||
            !this.state.currentUser) {
            return false;
        }
        return true;
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.onListenerChange);
        ChannelStore.addExtraInfoChangeListener(this.onListenerChange);
        SearchStore.addSearchChangeListener(this.onListenerChange);
        PreferenceStore.addChangeListener(this.onListenerChange);
        UserStore.addChangeListener(this.onListenerChange);
        UserStore.addStatusesChangeListener(this.onListenerChange);
        $('.sidebar--left .dropdown-menu').perfectScrollbar();
        document.addEventListener('keydown', this.openRecentMentions);
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onListenerChange);
        ChannelStore.removeExtraInfoChangeListener(this.onListenerChange);
        SearchStore.removeSearchChangeListener(this.onListenerChange);
        PreferenceStore.removeChangeListener(this.onListenerChange);
        UserStore.removeChangeListener(this.onListenerChange);
        UserStore.removeStatusesChangeListener(this.onListenerChange);
        document.removeEventListener('keydown', this.openRecentMentions);
    }

    shouldComponentUpdate(nextProps) {
        return !!nextProps.channelId;
    }

    onListenerChange() {
        const newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(newState, this.state)) {
            this.setState(newState);
        }
    }

    handleLeave() {
        Client.leaveChannel(this.state.channel.id,
            () => {
                AppDispatcher.handleViewAction({
                    type: ActionTypes.LEAVE_CHANNEL,
                    id: this.state.channel.id
                });

                const townsquare = ChannelStore.getByName('town-square');
                browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + townsquare.name);
            },
            (err) => {
                AsyncClient.dispatchError(err, 'handleLeave');
            }
        );
    }

    searchMentions(e) {
        e.preventDefault();

        const user = this.state.currentUser;

        let terms = '';
        if (user.notify_props && user.notify_props.mention_keys) {
            const termKeys = UserStore.getMentionKeys(user.id);

            if (termKeys.indexOf('@channel') !== -1) {
                termKeys[termKeys.indexOf('@channel')] = '';
            }

            if (termKeys.indexOf('@all') !== -1) {
                termKeys[termKeys.indexOf('@all')] = '';
            }

            terms = termKeys.join(' ');
        }

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_SEARCH_TERM,
            term: terms,
            do_search: true,
            is_mention_search: true
        });
    }

    getFlagged(e) {
        e.preventDefault();
        getFlaggedPosts();
    }

    openRecentMentions(e) {
        if (Utils.cmdOrCtrlPressed(e) && e.shiftKey && e.keyCode === Constants.KeyCodes.M) {
            e.preventDefault();
            this.searchMentions(e);
        }
    }

    showRenameChannelModal(e) {
        e.preventDefault();

        this.setState({
            showRenameChannelModal: true
        });
    }

    hideRenameChannelModal() {
        this.setState({
            showRenameChannelModal: false
        });
    }

    getTeammateStatus() {
        const channel = this.state.channel;

        // get status for direct message channels
        if (channel.type === 'D') {
            const currentUserId = this.state.currentUser.id;
            const teammate = this.state.users.find((user) => user.id !== currentUserId);
            if (teammate) {
                return UserStore.getStatus(teammate.id);
            }
            return UserStatuses.OFFLINE;
        }
        return null;
    }

    showManagementOptions(channel, isAdmin, isSystemAdmin) {
        if (global.window.mm_license.IsLicensed !== 'true') {
            return true;
        }

        if (channel.type === Constants.OPEN_CHANNEL) {
            if (global.window.mm_config.RestrictPublicChannelManagement === Constants.PERMISSIONS_SYSTEM_ADMIN && !isSystemAdmin) {
                return false;
            }
            if (global.window.mm_config.RestrictPublicChannelManagement === Constants.PERMISSIONS_TEAM_ADMIN && !isAdmin) {
                return false;
            }
        } else if (channel.type === Constants.PRIVATE_CHANNEL) {
            if (global.window.mm_config.RestrictPrivateChannelManagement === Constants.PERMISSIONS_SYSTEM_ADMIN && !isSystemAdmin) {
                return false;
            }
            if (global.window.mm_config.RestrictPrivateChannelManagement === Constants.PERMISSIONS_TEAM_ADMIN && !isAdmin) {
                return false;
            }
        }

        return true;
    }

    render() {
        const flagIcon = Constants.FLAG_ICON_OUTLINE_SVG;

        if (!this.validState()) {
            return null;
        }

        const channel = this.state.channel;
        const recentMentionsTooltip = (
            <Tooltip id='recentMentionsTooltip'>
                <FormattedMessage
                    id='channel_header.recentMentions'
                    defaultMessage='Recent Mentions'
                />
            </Tooltip>
        );

        const flaggedTooltip = (
            <Tooltip id='flaggedTooltip'>
                <FormattedMessage
                    id='channel_header.flagged'
                    defaultMessage='Flagged Posts'
                />
            </Tooltip>
        );

        const popoverContent = (
            <Popover
                id='header-popover'
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
        const currentId = this.state.currentUser.id;
        const isAdmin = TeamStore.isTeamAdminForCurrentTeam() || UserStore.isSystemAdminForCurrentUser();
        const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();
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

        let channelTerm = (
            <FormattedMessage
                id='channel_header.channel'
                defaultMessage='Channel'
            />
        );
        if (channel.type === Constants.PRIVATE_CHANNEL) {
            channelTerm = (
                <FormattedMessage
                    id='channel_header.group'
                    defaultMessage='Group'
                />
            );
        }

        let popoverListMembers;
        if (!isDirect) {
            popoverListMembers = (
                <PopoverListMembers
                    channel={channel}
                    members={this.state.users}
                    memberCount={this.state.userCount}
                />
            );
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
                        <FormattedMessage
                            id='channel_header.channelHeader'
                            defaultMessage='Set Channel Header...'
                        />
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
                        <FormattedMessage
                            id='channel_header.viewInfo'
                            defaultMessage='View Info'
                        />
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
                            dialogProps={{channel, currentUser: this.state.currentUser}}
                        >
                            <FormattedMessage
                                id='chanel_header.addMembers'
                                defaultMessage='Add Members'
                            />
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
                                <FormattedMessage
                                    id='channel_header.manageMembers'
                                    defaultMessage='Manage Members'
                                />
                            </a>
                        </li>
                    );
                } else {
                    dropdownContents.push(
                        <li
                            key='view_members'
                            role='presentation'
                        >
                            <a
                                role='menuitem'
                                href='#'
                                onClick={() => this.setState({showMembersModal: true})}
                            >
                                <FormattedMessage
                                    id='channel_header.viewMembers'
                                    defaultMessage='View Members'
                                />
                            </a>
                        </li>
                    );
                }
            }

            dropdownContents.push(
                <li
                    key='notification_preferences'
                    role='presentation'
                >
                    <ToggleModalButton
                        role='menuitem'
                        dialogType={ChannelNotificationsModal}
                        dialogProps={{
                            channel,
                            channelMember: this.state.memberChannel,
                            currentUser: this.state.currentUser
                        }}
                    >
                        <FormattedMessage
                            id='channel_header.notificationPreferences'
                            defaultMessage='Notification Preferences'
                        />
                    </ToggleModalButton>
                </li>
            );

            const deleteOption = (
                <li
                    key='delete_channel'
                    role='presentation'
                >
                    <ToggleModalButton
                        role='menuitem'
                        dialogType={DeleteChannelModal}
                        dialogProps={{channel}}
                    >
                        <FormattedMessage
                            id='channel_header.delete'
                            defaultMessage='Delete {term}...'
                            values={{
                                term: (channelTerm)
                            }}
                        />
                    </ToggleModalButton>
                </li>
            );

            if (this.showManagementOptions(channel, isAdmin, isSystemAdmin)) {
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
                                id='channel_header.setHeader'
                                defaultMessage='Set {term} Header...'
                                values={{
                                    term: (channelTerm)
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
                                id='channel_header.setPurpose'
                                defaultMessage='Set {term} Purpose...'
                                values={{
                                    term: (channelTerm)
                                }}
                            />
                        </a>
                    </li>
                );

                dropdownContents.push(
                    <li
                        key='rename_channel'
                        role='presentation'
                    >
                        <a
                            role='menuitem'
                            href='#'
                            onClick={this.showRenameChannelModal}
                        >
                            <FormattedMessage
                                id='channel_header.rename'
                                defaultMessage='Rename {term}...'
                                values={{
                                    term: (channelTerm)
                                }}
                            />
                        </a>
                    </li>
                );

                if (!ChannelStore.isDefault(channel)) {
                    dropdownContents.push(deleteOption);
                }
            } else if (this.state.userCount === 1) {
                dropdownContents.push(deleteOption);
            }

            const canLeave = channel.type === Constants.PRIVATE_CHANNEL ? this.state.userCount > 1 : true;
            if (!ChannelStore.isDefault(channel) && canLeave) {
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
                            <FormattedMessage
                                id='channel_header.leave'
                                defaultMessage='Leave {term}'
                                values={{
                                    term: (channelTerm)
                                }}
                            />
                        </a>
                    </li>
                );
            }
        }

        return (
            <div
                id='channel-header'
                className='channel-header'
            >
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
                                            <strong className='heading'><StatusIcon status={this.getTeammateStatus()}/>{channelTitle} </strong>
                                            <span className='fa fa-chevron-down header-dropdown__icon'/>
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
                                        trigger={'click'}
                                        placement='bottom'
                                        overlay={popoverContent}
                                        rootClose={true}
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
                                {popoverListMembers}
                            </th>
                            <th className='search-bar__container'><NavbarSearchBox/></th>
                            <th>
                                <div className='dropdown channel-header__links'>
                                    <OverlayTrigger
                                        delayShow={Constants.OVERLAY_TIME_DELAY}
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
                            <th>
                                <div className='dropdown channel-header__links'>
                                    <OverlayTrigger
                                        delayShow={Constants.OVERLAY_TIME_DELAY}
                                        placement='bottom'
                                        overlay={flaggedTooltip}
                                    >
                                        <a
                                            href='#'
                                            type='button'
                                            onClick={this.getFlagged}
                                        >
                                            <span
                                                className='icon icon__flag'
                                                dangerouslySetInnerHTML={{__html: flagIcon}}
                                            />
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
                    isAdmin={isAdmin}
                />
                <RenameChannelModal
                    show={this.state.showRenameChannelModal}
                    onHide={this.hideRenameChannelModal}
                    channel={channel}
                />
            </div>
        );
    }
}

ChannelHeader.propTypes = {
    channelId: React.PropTypes.string.isRequired
};
