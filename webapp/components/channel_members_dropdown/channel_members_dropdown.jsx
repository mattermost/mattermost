// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelStore from 'stores/channel_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {removeUserFromChannel, makeUserChannelAdmin, makeUserChannelMember} from 'actions/channel_actions.jsx';

import * as Utils from 'utils/utils.jsx';
import {canManageMembers} from 'utils/channel_utils.jsx';
import {Constants} from 'utils/constants.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class ChannelMembersDropdown extends React.Component {
    static propTypes = {
        channel: PropTypes.object.isRequired,
        user: PropTypes.object.isRequired,
        teamMember: PropTypes.object.isRequired,
        channelMember: PropTypes.object.isRequired,
        actions: PropTypes.shape({
            getChannelStats: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.handleRemoveFromChannel = this.handleRemoveFromChannel.bind(this);
        this.handleMakeChannelMember = this.handleMakeChannelMember.bind(this);
        this.handleMakeChannelAdmin = this.handleMakeChannelAdmin.bind(this);

        this.state = {
            serverError: null,
            user: null,
            role: null
        };
    }

    handleRemoveFromChannel() {
        removeUserFromChannel(
            this.props.channel.id,
            this.props.user.id,
            () => {
                this.props.actions.getChannelStats(this.props.channel.id);
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleMakeChannelMember() {
        makeUserChannelMember(
            this.props.channel.id,
            this.props.user.id,
            () => {
                this.props.actions.getChannelStats(this.props.channel.id);
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleMakeChannelAdmin() {
        makeUserChannelAdmin(
            this.props.channel.id,
            this.props.user.id,
            () => {
                this.props.actions.getChannelStats(this.props.channel.id);
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    // Checks if the current user has the power to change the roles of this member.
    canChangeMemberRoles() {
        if (UserStore.isSystemAdminForCurrentUser()) {
            return true;
        } else if (TeamStore.isTeamAdminForCurrentTeam()) {
            return true;
        } else if (ChannelStore.isChannelAdminForCurrentChannel()) {
            return true;
        }

        return false;
    }

    // Checks if the current user has the power to remove this member from the channel.
    canRemoveMember() {
        return canManageMembers(this.props.channel, ChannelStore.isChannelAdminForCurrentChannel(), TeamStore.isTeamAdminForCurrentTeam(), UserStore.isSystemAdminForCurrentUser());
    }

    render() {
        const supportsChannelAdmin = global.mm_license.IsLicensed === 'true';
        const isChannelAdmin = supportsChannelAdmin && Utils.isChannelAdmin(this.props.channelMember.roles);

        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='has-error'>
                    <label className='has-error control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        if (this.props.user.id === UserStore.getCurrentId()) {
            return null;
        }

        if (this.canChangeMemberRoles()) {
            let role = (
                <FormattedMessage
                    id='channel_members_dropdown.channel_member'
                    defaultMessage='Channel Member'
                />
            );

            if (isChannelAdmin) {
                role = (
                    <FormattedMessage
                        id='channel_members_dropdown.channel_admin'
                        defaultMessage='Channel Admin'
                    />
                );
            }

            let removeFromChannel = null;
            if (this.canRemoveMember() && this.props.channel.name !== Constants.DEFAULT_CHANNEL) {
                removeFromChannel = (
                    <li role='presentation'>
                        <a
                            id='removeFromChannel'
                            role='menuitem'
                            href='#'
                            onClick={this.handleRemoveFromChannel}
                        >
                            <FormattedMessage
                                id='channel_members_dropdown.remove_from_channel'
                                defaultMessage='Remove From Channel'
                            />
                        </a>
                    </li>
                );
            }

            let makeChannelMember = null;
            if (isChannelAdmin) {
                makeChannelMember = (
                    <li role='presentation'>
                        <a
                            id='makeChannelMember'
                            role='menuitem'
                            href='#'
                            onClick={this.handleMakeChannelMember}
                        >
                            <FormattedMessage
                                id='channel_members_dropdown.make_channel_member'
                                defaultMessage='Make Channel Member'
                            />
                        </a>
                    </li>
                );
            }

            let makeChannelAdmin = null;
            if (supportsChannelAdmin && !isChannelAdmin) {
                makeChannelAdmin = (
                    <li role='presentation'>
                        <a
                            id='makeChannelAdmin'
                            role='menuitem'
                            href='#'
                            onClick={this.handleMakeChannelAdmin}
                        >
                            <FormattedMessage
                                id='channel_members_dropdown.make_channel_admin'
                                defaultMessage='Make Channel Admin'
                            />
                        </a>
                    </li>
                );
            }

            if ((makeChannelMember || makeChannelAdmin) && removeFromChannel) {
                return (
                    <div className='dropdown member-drop'>
                        <a
                            id='channelMemberDropdown'
                            href='#'
                            className='dropdown-toggle theme'
                            type='button'
                            data-toggle='dropdown'
                            aria-expanded='true'
                        >
                            <span>{role} </span>
                            <span className='fa fa-chevron-down'/>
                        </a>
                        <ul
                            className='dropdown-menu member-menu'
                            role='menu'
                        >
                            {makeChannelMember}
                            {makeChannelAdmin}
                            {removeFromChannel}
                        </ul>
                        {serverError}
                    </div>
                );
            }
        }

        if (this.canRemoveMember() && this.props.channel.name !== Constants.DEFAULT_CHANNEL) {
            return (
                <button
                    id='removeMember'
                    type='button'
                    className='btn btn-danger btn-message'
                    onClick={this.handleRemoveFromChannel}
                >
                    <FormattedMessage
                        id='channel_members_dropdown.remove_member'
                        defaultMessage='Remove Member'
                    />
                </button>
            );
        }

        if (isChannelAdmin) {
            if (this.props.channel.name === Constants.DEFAULT_CHANNEL) {
                return (
                    <div/>
                );
            }

            return (
                <div>
                    <FormattedMessage
                        id='channel_members_dropdown.channel_admin'
                        defaultMessage='Channel Admin'
                    />
                </div>
            );
        }

        if (this.props.channel.name === Constants.DEFAULT_CHANNEL) {
            return (
                <div/>
            );
        }

        return (
            <div>
                <FormattedMessage
                    id='channel_members_dropdown.channel_member'
                    defaultMessage='Channel Member'
                />
            </div>
        );
    }
}
