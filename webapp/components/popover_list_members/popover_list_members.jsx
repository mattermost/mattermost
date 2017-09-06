// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ProfilePicture from 'components/profile_picture.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import TeamMembersModal from 'components/team_members_modal.jsx';
import ChannelMembersModal from 'components/channel_members_modal.jsx';
import ChannelInviteModal from 'components/channel_invite_modal';

import {openDirectChannelToUser} from 'actions/channel_actions.jsx';

import {Client4} from 'mattermost-redux/client';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import {canManageMembers} from 'utils/channel_utils.jsx';

import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import {Tooltip, OverlayTrigger, Popover, Overlay} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

export default class PopoverListMembers extends React.Component {
    static propTypes = {
        channel: PropTypes.object.isRequired,
        members: PropTypes.array.isRequired,
        memberCount: PropTypes.number,
        actions: PropTypes.shape({
            getProfilesInChannel: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.showMembersModal = this.showMembersModal.bind(this);

        this.handleShowDirectChannel = this.handleShowDirectChannel.bind(this);
        this.closePopover = this.closePopover.bind(this);

        this.state = {
            showPopover: false,
            showTeamMembersModal: false,
            showChannelMembersModal: false,
            showChannelInviteModal: false
        };
    }

    componentDidUpdate() {
        $('.member-list__popover .popover-content .more-modal__body').perfectScrollbar();
    }

    handleShowDirectChannel(teammate, e) {
        e.preventDefault();

        openDirectChannelToUser(
            teammate.id,
            (channel, channelAlreadyExisted) => {
                browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + channel.name);
                if (channelAlreadyExisted) {
                    this.closePopover();
                }
            },
            () => {
                this.closePopover();
            }
        );
    }

    closePopover() {
        this.setState({showPopover: false});
    }

    showMembersModal(e) {
        e.preventDefault();

        this.setState({
            showPopover: false,
            showChannelMembersModal: true
        });
    }

    render() {
        let popoverButton;
        const popoverHtml = [];
        const members = this.props.members;
        const teamMembers = UserStore.getProfilesUsernameMap();
        const currentUserId = UserStore.getCurrentId();

        const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();
        const isTeamAdmin = TeamStore.isTeamAdminForCurrentTeam();
        const isChannelAdmin = ChannelStore.isChannelAdminForCurrentChannel();
        const membersIcon = Constants.MEMBERS_ICON_SVG;

        if (members && teamMembers) {
            members.sort((a, b) => {
                const aName = Utils.displayEntireName(a.id);
                const bName = Utils.displayEntireName(b.id);

                return aName.localeCompare(bName);
            });

            members.forEach((m, i) => {
                let messageIcon = '';
                if (currentUserId !== m.id && this.props.channel.type !== Constants.DM_CHANNEl) {
                    messageIcon = Constants.MESSAGE_ICON_SVG;
                }

                let name = '';
                if (teamMembers[m.username]) {
                    name = Utils.displayUsernameForUser(teamMembers[m.username]);
                }

                if (name) {
                    popoverHtml.push(
                        <div
                            className='more-modal__row'
                            onClick={(e) => this.handleShowDirectChannel(m, e)}
                            key={'popover-member-' + i}
                        >
                            <ProfilePicture
                                src={Client4.getProfilePictureUrl(m.id, m.last_picture_update)}
                                width='40'
                                height='40'
                            />
                            <div className='more-modal__details'>
                                <div
                                    className='more-modal__name'
                                >
                                    {name}
                                </div>
                            </div>
                            <div
                                className='more-modal__actions'
                            >
                                <span
                                    className='icon icon__message'
                                    dangerouslySetInnerHTML={{__html: messageIcon}}
                                    aria-hidden='true'
                                />
                            </div>
                        </div>
                    );
                }
            });

            if (this.props.channel.type !== Constants.GM_CHANNEL) {
                let membersName = (
                    <FormattedMessage
                        id='members_popover.manageMembers'
                        defaultMessage='Manage Members'
                    />
                );

                const manageMembers = canManageMembers(this.props.channel, isChannelAdmin, isTeamAdmin, isSystemAdmin);
                const isDefaultChannel = ChannelStore.isDefault(this.props.channel);

                if ((manageMembers === false && isDefaultChannel === false) || isDefaultChannel) {
                    membersName = (
                        <FormattedMessage
                            id='members_popover.viewMembers'
                            defaultMessage='View Members'
                        />
                    );
                }

                popoverButton = (
                    <div
                        className='more-modal__button'
                        key={'popover-member-more'}
                    >
                        <button
                            className='btn btn-link'
                            onClick={this.showMembersModal}
                        >
                            {membersName}
                        </button>
                    </div>
                );
            }
        }

        const count = this.props.memberCount;
        let countText = '-';
        if (count > 0) {
            countText = count.toString();
        }

        const title = (
            <FormattedMessage
                id='members_popover.title'
                defaultMessage='Channel Members'
            />
        );

        let channelMembersModal;
        if (this.state.showChannelMembersModal) {
            channelMembersModal = (
                <ChannelMembersModal
                    onModalDismissed={() => this.setState({showChannelMembersModal: false})}
                    showInviteModal={() => this.setState({showChannelInviteModal: true})}
                    channel={this.props.channel}
                />
            );
        }

        let teamMembersModal;
        if (this.state.showTeamMembersModal) {
            teamMembersModal = (
                <TeamMembersModal
                    onHide={() => this.setState({showTeamMembersModal: false})}
                    isAdmin={isTeamAdmin || isSystemAdmin}
                />
            );
        }

        let channelInviteModal;
        if (this.state.showChannelInviteModal) {
            channelInviteModal = (
                <ChannelInviteModal
                    onHide={() => this.setState({showChannelInviteModal: false})}
                    channel={this.props.channel}
                />
            );
        }

        const channelMembersTooltip = (
            <Tooltip id='channelMembersTooltip'>
                <FormattedMessage
                    id='channel_header.channelMembers'
                    defaultMessage='Members'
                />
            </Tooltip>
        );

        return (
            <div className={'channel-header__icon wide ' + (this.state.showPopover ? 'active' : '')}>
                <OverlayTrigger
                    trigger={['hover', 'focus']}
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='bottom'
                    overlay={channelMembersTooltip}
                >
                    <div
                        id='member_popover'
                        className='member-popover__trigger'
                        ref='member_popover_target'
                        onClick={(e) => {
                            this.setState({popoverTarget: e.target, showPopover: !this.state.showPopover});
                            this.props.actions.getProfilesInChannel(this.props.channel.id, 0);
                        }}
                    >
                        <span className='icon__text'>{countText}</span>
                        <span
                            className='icon icon__members'
                            dangerouslySetInnerHTML={{__html: membersIcon}}
                            aria-hidden='true'
                        />
                    </div>
                </OverlayTrigger>
                <Overlay
                    rootClose={true}
                    onHide={this.closePopover}
                    show={this.state.showPopover}
                    target={() => this.state.popoverTarget}
                    placement='bottom'
                >
                    <Popover
                        ref='memebersPopover'
                        className='member-list__popover'
                        id='member-list-popover'
                    >
                        <div className='more-modal__header'>
                            {title}
                        </div>
                        <div className='more-modal__body'>
                            <div className='more-modal__list'>{popoverHtml}</div>
                        </div>
                        {popoverButton}
                    </Popover>
                </Overlay>
                {channelMembersModal}
                {teamMembersModal}
                {channelInviteModal}
            </div>
        );
    }
}

