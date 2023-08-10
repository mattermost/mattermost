// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import GroupMembersModal from 'components/admin_console/team_channel_settings/group/group_members_modal';
import ToggleModalButton from 'components/toggle_modal_button';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {ModalIdentifiers} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import type {Group} from '@mattermost/types/groups';

interface GroupRowProps {
    group: Partial<Group>;
    removeGroup: (gid: string) => void;
    setNewGroupRole: (gid: string) => void;
    type: string;
    isDisabled?: boolean;
}

export default class GroupRow extends React.PureComponent<GroupRowProps> {
    removeGroup = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        if (this.props.isDisabled) {
            return;
        }
        this.props.removeGroup(this.props.group.id!);
    };

    setNewGroupRole = () => {
        this.props.setNewGroupRole(this.props.group.id!);
    };

    displayCurrentRole = () => {
        const {group, type} = this.props;
        const channelAdmin = (
            <FormattedMessage
                id='admin.team_channel_settings.group_row.channelAdmin'
                defaultMessage='Channel Admin'
            />
        );
        const teamAdmin = (
            <FormattedMessage
                id='admin.team_channel_settings.group_row.teamAdmin'
                defaultMessage='Team Admin'
            />
        );
        const member = (
            <FormattedMessage
                id='admin.team_channel_settings.group_row.member'
                defaultMessage='Member'
            />
        );

        if (group.scheme_admin && type === 'channel') {
            return channelAdmin;
        } else if (group.scheme_admin && type === 'team') {
            return teamAdmin;
        }
        return member;
    };

    displayRoleToBe = () => {
        const {group, type} = this.props;
        if (!group.scheme_admin && type === 'channel') {
            return localizeMessage('admin.team_channel_settings.group_row.channelAdmin', 'Channel Admin');
        } else if (!group.scheme_admin && type === 'team') {
            return localizeMessage('admin.team_channel_settings.group_row.teamAdmin', 'Team Admin');
        }
        return localizeMessage('admin.team_channel_settings.group_row.member', 'Member');
    };

    render = () => {
        const {group} = this.props;
        return (
            <div
                id='group'
                className='group'
            >
                <div
                    id='group-row'
                    className='group-row'
                >
                    <span className='group-name row-content'>
                        {group.display_name || group.name}
                    </span>
                    <span className='group-description row-content'>
                        <ToggleModalButton
                            id={`${group.display_name}MembersToggle`}
                            className='color--link'
                            modalId={ModalIdentifiers.GROUP_MEMBERS}
                            dialogType={GroupMembersModal}
                            dialogProps={{
                                group,
                            }}
                        >
                            <FormattedMessage
                                id='admin.team_channel_settings.group_row.members'
                                defaultMessage='{memberCount, number} {memberCount, plural, one {member} other {members}}'
                                values={{memberCount: group.member_count}}
                            />
                        </ToggleModalButton>
                    </span>
                    <div className='group-description row-content roles'>
                        <MenuWrapper
                            isDisabled={this.props.isDisabled}
                        >
                            <div>
                                <a data-testid='current-role'>
                                    <span>{this.displayCurrentRole()}</span>
                                    <span className='caret'/>
                                </a>
                            </div>
                            <Menu
                                id='role-to-be-menu'
                                openLeft={true}
                                openUp={false}
                                ariaLabel={localizeMessage('admin.team_channel_settings.group_row.memberRole', 'Member Role')}
                            >
                                <Menu.ItemAction
                                    id='role-to-be'
                                    onClick={this.setNewGroupRole}
                                    text={this.displayRoleToBe()}
                                />
                            </Menu>
                        </MenuWrapper>
                    </div>
                    <span
                        id='group-actions'
                        className='group-actions'
                    >
                        <a
                            href='#'
                            onClick={this.removeGroup}
                            className={this.props.isDisabled ? 'disabled' : ''}
                        >
                            <FormattedMessage
                                id='admin.team_channel_settings.group_row.remove'
                                defaultMessage='Remove'
                            />
                        </a>
                    </span>
                </div>
            </div>
        );
    };
}
