// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import {Permissions} from 'mattermost-redux/constants';

import {emitUserLoggedOutEvent} from 'actions/global_actions';

import AboutBuildModal from 'components/about_build_modal';
import AddGroupsToTeamModal from 'components/add_groups_to_team_modal';
import CustomStatusModal from 'components/custom_status/custom_status_modal';
import InvitationModal from 'components/invitation_modal';
import LeaveTeamModal from 'components/leave_team_modal';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import TeamGroupsManageModal from 'components/team_groups_manage_modal';
import TeamMembersModal from 'components/team_members_modal';
import TeamSettingsModal from 'components/team_settings_modal';
import UserAccountAwayMenuItem from 'components/user_account_menu/user_account_away_menuitem';
import UserAccountCustomStatusMenuItem from 'components/user_account_menu/user_account_custom_status_menuitem';
import UserAccountDndMenuItem from 'components/user_account_menu/user_account_dnd_menuitem';
import UserAccountOfflineMenuItem from 'components/user_account_menu/user_account_offline_menuitem';
import UserAccountOnlineMenuItem from 'components/user_account_menu/user_account_online_menuitem';
import UserSettingsModal from 'components/user_settings/modal';
import Menu from 'components/widgets/menu/menu';

import {ModalIdentifiers, UserStatuses} from 'utils/constants';
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

    openCustomStatusModal = (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>): void => {
        event.stopPropagation();
        this.props.actions.openModal({
            modalId: ModalIdentifiers.CUSTOM_STATUS,
            dialogType: CustomStatusModal,
        });
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

        const isCustomStatusSet = !this.props.isCustomStatusExpired && this.props.customStatus && ((this.props.customStatus.text && this.props.customStatus.text.length > 0) || (this.props.customStatus.emoji && this.props.customStatus.emoji.length > 0));
        const shouldConfirmBeforeStatusChange = this.props.autoResetPref === '' && this.props.status === UserStatuses.OUT_OF_OFFICE;

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
                    <UserAccountOnlineMenuItem
                        userId={this.props.userId}
                        shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                        isStatusOnline={this.props.status === UserStatuses.ONLINE}
                    />
                    <UserAccountAwayMenuItem
                        userId={this.props.userId}
                        shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                        isStatusAway={this.props.status === UserStatuses.AWAY}
                    />
                    <UserAccountDndMenuItem
                        userId={this.props.userId}
                        shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                        timezone={this.props.timezone}
                        isStatusDnd={this.props.status === UserStatuses.DND}
                    />
                    <UserAccountOfflineMenuItem
                        userId={this.props.userId}
                        shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                        isStatusOffline={this.props.status === UserStatuses.OFFLINE}
                    />
                </Menu.Group>
                <Menu.Group>
                    {this.props.isCustomStatusEnabled && !isCustomStatusSet && (
                        <Menu.ItemAction
                            id='setCustomStatus'
                            onClick={this.openCustomStatusModal}
                            icon={
                                <i
                                    className='icon icon-emoticon-plus-outline'
                                    style={{color: 'var(--sidebar-text)'}}
                                />
                            }
                            text={formatMessage({id: 'userAccountMenu.setCustomStatusMenuItem.noStatusSet', defaultMessage: 'Set custom status'})}
                        />
                    )}
                    {this.props.isCustomStatusEnabled && isCustomStatusSet && (
                        <UserAccountCustomStatusMenuItem
                            timezone={this.props.timezone}
                            customStatus={this.props.customStatus}
                            openCustomStatusModal={this.openCustomStatusModal}
                        />
                    )}
                </Menu.Group>
                <Menu.Group>
                    <Menu.ItemAction
                        id='recentMentions'
                        onClick={this.onRecentMentionItemClick}
                        icon={
                            <i
                                className='icon icon-at'
                                style={{color: 'var(--sidebar-text)'}}
                            />
                        }
                        text={formatMessage({id: 'sidebar_right_menu.recentMentions', defaultMessage: 'Recent Mentions'})}
                    />
                    <Menu.ItemAction
                        id='flaggedPosts'
                        onClick={this.onShowFlaggedPostItemClick}
                        icon={
                            <i
                                className='icon icon-bookmark'
                                style={{color: 'var(--sidebar-text)'}}
                            />
                        }
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
                        icon={
                            <i
                                className='icon icon-account-outline'
                                style={{color: 'var(--sidebar-text)'}}
                            />
                        }
                    />
                    <Menu.ItemToggleModalRedux
                        id='accountSettings'
                        modalId={ModalIdentifiers.USER_SETTINGS}
                        dialogType={UserSettingsModal}
                        dialogProps={{isContentProductSettings: true}}
                        text={formatMessage({id: 'navbar_dropdown.accountSettings', defaultMessage: 'Settings'})}
                        icon={
                            <i
                                className='icon icon-cog-outline'
                                style={{color: 'var(--sidebar-text)'}}
                            />
                        }
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
                            icon={
                                <i
                                    className='icon icon-account-multiple-plus-outline'
                                    style={{color: 'var(--sidebar-text)'}}
                                />
                            }
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
                                icon={
                                    <i
                                        className='icon icon-account-plus-outline'
                                        style={{color: 'var(--sidebar-text)'}}
                                    />
                                }
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
                            icon={
                                <i
                                    className='icon icon-cog-outline'
                                    style={{color: 'var(--sidebar-text)'}}
                                />
                            }
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
                            icon={
                                <i
                                    className='icon icon-account-multiple-plus-outline'
                                    style={{color: 'var(--sidebar-text)'}}
                                />
                            }
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
                            icon={
                                <i
                                    className='icon icon-account-multiple-outline'
                                    style={{color: 'var(--sidebar-text)'}}
                                />
                            }
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
                            icon={
                                <i
                                    className='icon icon-account-multiple-outline'
                                    style={{color: 'var(--sidebar-text)'}}
                                />
                            }
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
                            icon={
                                <i
                                    className='icon icon-plus'
                                    style={{color: 'var(--sidebar-text)'}}
                                />
                            }
                        />
                    </SystemPermissionGate>
                    <Menu.ItemLink
                        id='joinTeam'
                        show={!this.props.experimentalPrimaryTeam && this.props.moreTeamsToJoin}
                        to='/select_team'
                        text={formatMessage({id: 'navbar_dropdown.join', defaultMessage: 'Join Another Team'})}
                        icon={
                            <i
                                className='icon icon-plus-box-outline'
                                style={{color: 'var(--sidebar-text)'}}
                            />
                        }
                    />
                    <Menu.ItemToggleModalRedux
                        id='leaveTeam'
                        show={!this.props.teamIsGroupConstrained && this.props.experimentalPrimaryTeam !== this.props.teamName}
                        modalId={ModalIdentifiers.LEAVE_TEAM}
                        dialogType={LeaveTeamModal}
                        text={formatMessage({id: 'navbar_dropdown.leave', defaultMessage: 'Leave Team'})}
                        icon={
                            <i
                                className='icon icon-exit-to-app'
                                style={{color: 'var(--sidebar-text)'}}
                            />
                        }
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
                        icon={
                            <i
                                className='icon icon-help-circle-outline'
                                style={{color: 'var(--sidebar-text)'}}
                            />
                        }
                    />
                    <Menu.ItemExternalLink
                        id='reportLink'
                        show={Boolean(this.props.reportAProblemLink)}
                        url={this.props.reportAProblemLink}
                        text={formatMessage({id: 'navbar_dropdown.report', defaultMessage: 'Report a Problem'})}
                        icon={
                            <i
                                className='icon icon-alert-outline'
                                style={{color: 'var(--sidebar-text)'}}
                            />
                        }
                    />
                    <Menu.ItemExternalLink
                        id='nativeAppLink'
                        show={this.props.appDownloadLink}
                        url={safeAppDownloadLink}
                        text={formatMessage({id: 'navbar_dropdown.nativeApps', defaultMessage: 'Download Apps'})}
                        icon={
                            <i
                                className='icon icon-cellphone'
                                style={{color: 'var(--sidebar-text)'}}
                            />
                        }
                    />
                    <Menu.ItemToggleModalRedux
                        id='about'
                        modalId={ModalIdentifiers.ABOUT}
                        dialogType={AboutBuildModal}
                        text={formatMessage({id: 'navbar_dropdown.about', defaultMessage: 'About {appTitle}'}, {appTitle: this.props.siteName || 'Mattermost'})}
                        icon={
                            <i
                                className='icon icon-information-outline'
                                style={{color: 'var(--sidebar-text)'}}
                            />
                        }
                    />
                </Menu.Group>
                <Menu.Group>
                    <Menu.ItemAction
                        id='logout'
                        onClick={this.onLogoutItemClick}
                        text={formatMessage({id: 'navbar_dropdown.logout', defaultMessage: 'Log Out'})}
                        icon={
                            <i
                                className='icon icon-logout-variant'
                                style={{color: 'var(--sidebar-text)'}}
                            />
                        }
                    />
                </Menu.Group>
            </Menu>
        );
    }
}

export default injectIntl(MobileSidebarRightItems);
