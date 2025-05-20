// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import {Permissions} from 'mattermost-redux/constants';

import {emitUserLoggedOutEvent} from 'actions/global_actions';
import {trackEvent} from 'actions/telemetry_actions';

import AboutBuildModal from 'components/about_build_modal';
import AddGroupsToTeamModal from 'components/add_groups_to_team_modal';
import InvitationModal from 'components/invitation_modal';
import LeaveTeamModal from 'components/leave_team_modal';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import TeamGroupsManageModal from 'components/team_groups_manage_modal';
import TeamMembersModal from 'components/team_members_modal';
import TeamSettingsModal from 'components/team_settings_modal';
import UserSettingsModal from 'components/user_settings/modal';
import LeaveTeamIcon from 'components/widgets/icons/leave_team_icon';
import Menu from 'components/widgets/menu/menu';

import {ModalIdentifiers} from 'utils/constants';
import {makeUrlSafe} from 'utils/url';

import type {PropsFromRedux} from './index';

export interface Props extends PropsFromRedux, WrappedComponentProps {
    usageDeltaTeams: number;
}

export class MobileSidebarRightItems extends React.PureComponent<Props> {
    static defaultProps = {
        pluginMenuItems: [],
    };

    onRecentMentionItemClick = (e: Event): void => {
        e.preventDefault();

        if (this.props.isMentionSearch) {
            this.props.actions.closeRightHandSide();
        } else {
            this.props.actions.closeRhsMenu();
            this.props.actions.showMentions();
        }
    };

    onShowFlaggedPostItemClick = (e: Event): void => {
        e.preventDefault();
        this.props.actions.showFlaggedPosts();
        this.props.actions.closeRhsMenu();
    };

    onLogoutItemClick = (): void => {
        emitUserLoggedOutEvent();
    };

    render() {
        const {formatMessage} = this.props.intl;

        const safeAppDownloadLink = makeUrlSafe(this.props.appDownloadLink || '');
        const teamsLimitReached = this.props.isStarterFree && !this.props.isFreeTrial && this.props.usageDeltaTeams >= 0;

        const pluginItems = this.props.pluginMenuItems.map((item) => (
            <Menu.ItemAction
                id={item.id + '_pluginmenuitem'}
                key={item.id + '_pluginmenuitem'}
                onClick={() => {
                    if (item.action) {
                        item.action();
                    }
                }}
                text={item.text}
                icon={item.mobileIcon}
            />
        ));

        return (
            <Menu
                ariaLabel={formatMessage({id: 'navbar_dropdown.menuAriaLabel', defaultMessage: 'main menu'})}
            >
                <Menu.Group>
                    <SystemPermissionGate
                        permissions={[Permissions.SYSCONSOLE_WRITE_BILLING]}
                    >
                        <Menu.CloudTrial
                            id='menuCloudTrial'
                        />
                    </SystemPermissionGate>
                </Menu.Group>
                <Menu.Group>
                    <SystemPermissionGate
                        permissions={[Permissions.SYSCONSOLE_WRITE_ABOUT_EDITION_AND_LICENSE]}
                    >
                        <Menu.StartTrial
                            id='startTrial'
                        />
                    </SystemPermissionGate>
                </Menu.Group>
                <Menu.Group>
                    <Menu.ItemAction
                        id='recentMentions'
                        onClick={this.onRecentMentionItemClick}
                        icon={<i className='mentions'>{'@'}</i>}
                        text={formatMessage({id: 'sidebar_right_menu.recentMentions', defaultMessage: 'Recent Mentions'})}
                    />
                    <Menu.ItemAction
                        id='flaggedPosts'
                        onClick={this.onShowFlaggedPostItemClick}
                        icon={<i className='fa fa-bookmark'/>}
                        text={formatMessage({id: 'sidebar_right_menu.flagged', defaultMessage: 'Saved messages'})}
                    />
                </Menu.Group>
                <Menu.Group>
                    <Menu.ItemToggleModalRedux
                        id='profileSettings'
                        modalId={ModalIdentifiers.USER_SETTINGS}
                        dialogType={UserSettingsModal}
                        dialogProps={{isContentProductSettings: false}}
                        text={formatMessage({id: 'navbar_dropdown.profileSettings', defaultMessage: 'Profile'})}
                        icon={<i className='fa fa-user'/>}
                    />
                    <Menu.ItemToggleModalRedux
                        id='accountSettings'
                        modalId={ModalIdentifiers.USER_SETTINGS}
                        dialogType={UserSettingsModal}
                        dialogProps={{isContentProductSettings: true}}
                        text={formatMessage({id: 'navbar_dropdown.accountSettings', defaultMessage: 'Settings'})}
                        icon={<i className='fa fa-cog'/>}
                    />
                </Menu.Group>
                <Menu.Group>
                    <TeamPermissionGate
                        teamId={this.props.teamId}
                        permissions={[Permissions.MANAGE_TEAM]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='addGroupsToTeam'
                            show={this.props.teamIsGroupConstrained && this.props.isLicensedForLDAPGroups}
                            modalId={ModalIdentifiers.ADD_GROUPS_TO_TEAM}
                            dialogType={AddGroupsToTeamModal}
                            text={formatMessage({id: 'navbar_dropdown.addGroupsToTeam', defaultMessage: 'Add Groups to Team'})}
                            icon={<i className='fa fa-user-plus'/>}
                        />
                    </TeamPermissionGate>
                    {this.props.guestAccessEnabled && (
                        <TeamPermissionGate
                            teamId={this.props.teamId}
                            permissions={[Permissions.ADD_USER_TO_TEAM, Permissions.INVITE_GUEST]}
                        >
                            <Menu.ItemToggleModalRedux
                                id='invitePeople'
                                modalId={ModalIdentifiers.INVITATION}
                                dialogType={InvitationModal}
                                text={formatMessage({
                                    id: 'navbar_dropdown.invitePeople',
                                    defaultMessage: 'Invite People',
                                })}
                                extraText={formatMessage({
                                    id: 'navbar_dropdown.invitePeopleExtraText',
                                    defaultMessage: 'Add people to the team',
                                })}
                                icon={<i className='fa fa-user-plus'/>}
                                onClick={() => trackEvent('ui', 'click_sidebar_team_dropdown_invite_people')}
                            />
                        </TeamPermissionGate>
                    )}
                </Menu.Group>
                <Menu.Group>
                    <TeamPermissionGate
                        teamId={this.props.teamId}
                        permissions={[Permissions.MANAGE_TEAM]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='teamSettings'
                            modalId={ModalIdentifiers.TEAM_SETTINGS}
                            dialogType={TeamSettingsModal}
                            text={formatMessage({id: 'navbar_dropdown.teamSettings', defaultMessage: 'Team Settings'})}
                            icon={<i className='fa fa-globe'/>}
                        />
                    </TeamPermissionGate>
                    <TeamPermissionGate
                        teamId={this.props.teamId}
                        permissions={[Permissions.MANAGE_TEAM]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='manageGroups'
                            show={this.props.teamIsGroupConstrained && this.props.isLicensedForLDAPGroups}
                            modalId={ModalIdentifiers.MANAGE_TEAM_GROUPS}
                            dialogProps={{
                                teamID: this.props.teamId,
                            }}
                            dialogType={TeamGroupsManageModal}
                            text={formatMessage({id: 'navbar_dropdown.manageGroups', defaultMessage: 'Manage Groups'})}
                            icon={<i className='fa fa-user-plus'/>}
                        />
                    </TeamPermissionGate>
                    <TeamPermissionGate
                        teamId={this.props.teamId}
                        permissions={[Permissions.REMOVE_USER_FROM_TEAM, Permissions.MANAGE_TEAM_ROLES]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='manageMembers'
                            modalId={ModalIdentifiers.TEAM_MEMBERS}
                            dialogType={TeamMembersModal}
                            text={formatMessage({id: 'navbar_dropdown.manageMembers', defaultMessage: 'Manage Members'})}
                            icon={<i className='fa fa-users'/>}
                        />
                    </TeamPermissionGate>
                    <TeamPermissionGate
                        teamId={this.props.teamId}
                        permissions={[Permissions.REMOVE_USER_FROM_TEAM, Permissions.MANAGE_TEAM_ROLES]}
                        invert={true}
                    >
                        <Menu.ItemToggleModalRedux
                            id='viewMembers'
                            modalId={ModalIdentifiers.TEAM_MEMBERS}
                            dialogType={TeamMembersModal}
                            text={formatMessage({id: 'navbar_dropdown.viewMembers', defaultMessage: 'View Members'})}
                            icon={<i className='fa fa-users'/>}
                        />
                    </TeamPermissionGate>
                </Menu.Group>
                <Menu.Group>
                    <SystemPermissionGate permissions={[Permissions.CREATE_TEAM]}>
                        <Menu.ItemLink
                            id='createTeam'
                            show={!teamsLimitReached}
                            to='/create_team'
                            text={formatMessage({id: 'navbar_dropdown.create', defaultMessage: 'Create a Team'})}
                            icon={<i className='fa fa-plus-square'/>}
                        />
                    </SystemPermissionGate>
                    <Menu.ItemLink
                        id='joinTeam'
                        show={!this.props.experimentalPrimaryTeam && this.props.moreTeamsToJoin}
                        to='/select_team'
                        text={formatMessage({id: 'navbar_dropdown.join', defaultMessage: 'Join Another Team'})}
                        icon={<i className='fa fa-plus-square'/>}
                    />
                    <Menu.ItemToggleModalRedux
                        id='leaveTeam'
                        show={!this.props.teamIsGroupConstrained && this.props.experimentalPrimaryTeam !== this.props.teamName}
                        modalId={ModalIdentifiers.LEAVE_TEAM}
                        dialogType={LeaveTeamModal}
                        text={formatMessage({id: 'navbar_dropdown.leave', defaultMessage: 'Leave Team'})}
                        icon={<LeaveTeamIcon/>}
                    />
                </Menu.Group>
                <Menu.Group>
                    {pluginItems}
                </Menu.Group>
                <Menu.Group>
                    <Menu.ItemExternalLink
                        id='helpLink'
                        show={Boolean(this.props.helpLink)}
                        url={this.props.helpLink}
                        text={formatMessage({id: 'navbar_dropdown.help', defaultMessage: 'Help'})}
                        icon={<i className='fa fa-question'/>}
                    />
                    <Menu.ItemExternalLink
                        id='reportLink'
                        show={Boolean(this.props.reportAProblemLink)}
                        url={this.props.reportAProblemLink}
                        text={formatMessage({id: 'navbar_dropdown.report', defaultMessage: 'Report a Problem'})}
                        icon={<i className='fa fa-phone'/>}
                    />
                    <Menu.ItemExternalLink
                        id='nativeAppLink'
                        show={this.props.appDownloadLink}
                        url={safeAppDownloadLink}
                        text={formatMessage({id: 'navbar_dropdown.nativeApps', defaultMessage: 'Download Apps'})}
                        icon={<i className='fa fa-mobile'/>}
                    />
                    <Menu.ItemToggleModalRedux
                        id='about'
                        modalId={ModalIdentifiers.ABOUT}
                        dialogType={AboutBuildModal}
                        text={formatMessage({id: 'navbar_dropdown.about', defaultMessage: 'About {appTitle}'}, {appTitle: this.props.siteName || 'Mattermost'})}
                        icon={<i className='fa fa-info'/>}
                    />
                </Menu.Group>
                <Menu.Group>
                    <Menu.ItemAction
                        id='logout'
                        onClick={this.onLogoutItemClick}
                        text={formatMessage({id: 'navbar_dropdown.logout', defaultMessage: 'Log Out'})}
                        icon={<i className='fa fa-sign-out'/>}
                    />
                </Menu.Group>
            </Menu>
        );
    }
}

export default injectIntl(MobileSidebarRightItems);
