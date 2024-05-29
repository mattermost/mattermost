// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ChannelMembership} from '@mattermost/types/channels';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import DropdownIcon from 'components/widgets/icons/fa_dropdown_icon';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {Constants} from 'utils/constants';
import * as Utils from 'utils/utils';

export type BaseMembership = {
    user_id: string;
    scheme_user: boolean;
    scheme_admin: boolean;
}

type Props = {
    user: UserProfile;
    membership?: BaseMembership | TeamMembership | ChannelMembership;
    scope: 'team' | 'channel';
    handleUpdateMembership: (membership: BaseMembership) => void;
    isDisabled?: boolean;
}

export type Role = 'system_admin' | 'team_admin' | 'team_user' | 'channel_admin' | 'channel_user' | 'shared_member' | 'guest';

export default class UserGridRoleDropdown extends React.PureComponent<Props> {
    private getDropDownOptions = () => {
        if (this.props.scope === 'team') {
            return {
                makeAdmin: Utils.localizeMessage('team_members_dropdown.makeAdmin', 'Make Team Admin'),
                makeMember: Utils.localizeMessage('team_members_dropdown.makeMember', 'Make Team Member'),
            };
        }

        return {
            makeAdmin: Utils.localizeMessage('channel_members_dropdown.make_channel_admin', 'Make Channel Admin'),
            makeMember: Utils.localizeMessage('channel_members_dropdown.make_channel_member', 'Make Channel Member'),
        };
    };

    private getCurrentRole = (): Role => {
        const {user, membership, scope} = this.props;

        if (user.roles.includes('system_admin')) {
            return 'system_admin';
        } else if (membership) {
            if (scope === 'team') {
                if (user.remote_id) {
                    return 'shared_member';
                } else if (membership.scheme_admin) {
                    return 'team_admin';
                } else if (membership.scheme_user) {
                    return 'team_user';
                }
            }

            if (scope === 'channel') {
                if (user.remote_id) {
                    return 'shared_member';
                } else if (membership.scheme_admin) {
                    return 'channel_admin';
                } else if (membership.scheme_user) {
                    return 'channel_user';
                }
            }
        }

        return 'guest';
    };

    private getLocalizedRole = (role: Role) => {
        switch (role) {
        case 'system_admin':
            return Utils.localizeMessage('admin.user_grid.system_admin', 'System Admin');
        case 'team_admin':
            return Utils.localizeMessage('admin.user_grid.team_admin', 'Team Admin');
        case 'channel_admin':
            return Utils.localizeMessage('admin.user_grid.channel_admin', 'Channel Admin');
        case 'shared_member':
            return Utils.localizeMessage('admin.user_grid.shared_member', 'Shared Member');
        case 'team_user':
        case 'channel_user':
            return Utils.localizeMessage('admin.group_teams_and_channels_row.member', 'Member');
        default:
            return Utils.localizeMessage('admin.user_grid.guest', 'Guest');
        }
    };

    private handleMakeAdmin = () => {
        this.props.handleUpdateMembership({
            user_id: this.props.user.id,
            scheme_admin: true,
            scheme_user: true,
        });
    };

    private handleMakeUser = () => {
        this.props.handleUpdateMembership({
            user_id: this.props.user.id,
            scheme_admin: false,
            scheme_user: true,
        });
    };

    private getAriaLabel = () => {
        const {scope} = this.props;
        if (scope === 'team') {
            return Utils.localizeMessage('team_members_dropdown.menuAriaLabel', 'Change the role of a team member');
        }
        return Utils.localizeMessage('channel_members_dropdown.menuAriaLabel', 'Change the role of channel member');
    };

    public render = (): React.ReactNode => {
        if (!this.props.membership) {
            return null;
        }

        const {user, isDisabled} = this.props;

        const {makeAdmin, makeMember} = this.getDropDownOptions();
        const currentRole = this.getCurrentRole();
        const localizedRole = this.getLocalizedRole(currentRole);
        const ariaLabel = this.getAriaLabel();

        if (currentRole === 'shared_member') {
            const sharedTooltip = (
                <Tooltip id='sharedTooltip'>
                    <FormattedMessage
                        id='shared_user_indicator.tooltip'
                        defaultMessage='From trusted organizations'
                    />
                </Tooltip>
            );

            return (
                <div className='more-modal__shared-actions'>
                    <OverlayTrigger
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement='bottom'
                        overlay={sharedTooltip}
                    >
                        <span>
                            {localizedRole}
                            <i className='shared-user-icon icon-circle-multiple-outline'/>
                        </span>
                    </OverlayTrigger>
                </div>
            );
        }

        const dropdownEnabled = !['system_admin', 'guest'].includes(currentRole);
        const showMakeAdmin = ['channel_user', 'team_user'].includes(currentRole);
        const showMakeMember = ['channel_admin', 'team_admin'].includes(currentRole);

        if (!dropdownEnabled) {
            return localizedRole;
        }

        return (
            <MenuWrapper
                isDisabled={isDisabled}
            >
                <button
                    id={`userGridRoleDropdown_${user.username}`}
                    className='dropdown-toggle theme color--link style--none'
                    type='button'
                    aria-expanded='true'
                >
                    <span>{localizedRole} </span>
                    <DropdownIcon/>
                </button>
                <Menu ariaLabel={ariaLabel}>
                    <Menu.ItemAction
                        show={showMakeAdmin}
                        onClick={this.handleMakeAdmin}
                        text={makeAdmin}
                    />
                    <Menu.ItemAction
                        show={showMakeMember}
                        onClick={this.handleMakeUser}
                        text={makeMember}
                    />
                </Menu>
            </MenuWrapper>
        );
    };
}
