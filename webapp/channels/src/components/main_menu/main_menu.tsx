// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl, IntlShape} from 'react-intl';

import {Permissions} from 'mattermost-redux/constants';

import * as GlobalActions from 'actions/global_actions';
import {Constants, ModalIdentifiers} from 'utils/constants';
import {cmdOrCtrlPressed, isKeyPressed} from 'utils/keyboard';
import {makeUrlSafe} from 'utils/url';
import * as UserAgent from 'utils/user_agent';
import InvitationModal from 'components/invitation_modal';

import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';

import LeaveTeamIcon from 'components/widgets/icons/leave_team_icon';

import LeaveTeamModal from 'components/leave_team_modal';
import UserSettingsModal from 'components/user_settings/modal';
import TeamMembersModal from 'components/team_members_modal';
import TeamSettingsModal from 'components/team_settings_modal';
import AboutBuildModal from 'components/about_build_modal';
import AddGroupsToTeamModal from 'components/add_groups_to_team_modal';

import Menu from 'components/widgets/menu/menu';
import TeamGroupsManageModal from 'components/team_groups_manage_modal';

import {trackEvent} from 'actions/telemetry_actions';
import {ModalData} from 'types/actions';
import {PluginComponent} from 'types/store/plugins';
import {UserProfile} from '@mattermost/types/users';

export type Props = {
    mobile: boolean;
    id?: string;
    teamId?: string;
    teamName?: string;
    siteName?: string;
    currentUser?: UserProfile;
    appDownloadLink?: string;
    enableCommands: boolean;
    enableIncomingWebhooks: boolean;
    enableOAuthServiceProvider: boolean;
    enableOutgoingWebhooks: boolean;
    canManageSystemBots: boolean;
    canManageIntegrations: boolean;
    experimentalPrimaryTeam?: string;
    helpLink?: string;
    reportAProblemLink?: string;
    moreTeamsToJoin: boolean;
    pluginMenuItems?: PluginComponent[];
    isMentionSearch?: boolean;
    teamIsGroupConstrained: boolean;
    isLicensedForLDAPGroups?: boolean;
    intl: IntlShape;
    teamUrl: string;
    isFirstAdmin: boolean;
    isCloud: boolean;
    isStarterFree: boolean;
    isFreeTrial: boolean;
    usageDeltaTeams: number;
    location: {
        pathname: string;
    };
    guestAccessEnabled: boolean;
    canInviteTeamMember: boolean;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        showMentions: () => void;
        showFlaggedPosts: () => void;
        closeRightHandSide: () => void;
        closeRhsMenu: () => void;
    };

};
export class MainMenu extends React.PureComponent<Props> {
    static defaultProps = {
        teamType: '',
        mobile: false,
        pluginMenuItems: [],
    };

    async componentDidMount(): Promise<void> {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount(): void {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = (e: KeyboardEvent): void => {
        if (cmdOrCtrlPressed(e) && e.shiftKey && isKeyPressed(e, Constants.KeyCodes.A)) {
            e.preventDefault();
            this.props.actions.openModal({modalId: ModalIdentifiers.USER_SETTINGS, dialogType: UserSettingsModal, dialogProps: {isContentProductSettings: true}});
        }
    };

    handleEmitUserLoggedOutEvent = (): void => {
        GlobalActions.emitUserLoggedOutEvent();
    };

    getFlagged = (e: Event): void => {
        e.preventDefault();
        this.props.actions.showFlaggedPosts();
        this.props.actions.closeRhsMenu();
    };

    searchMentions = (e: Event): void => {
        e.preventDefault();

        if (this.props.isMentionSearch) {
            this.props.actions.closeRightHandSide();
        } else {
            this.props.actions.closeRhsMenu();
            this.props.actions.showMentions();
        }
    };

    render() {
        const {
            appDownloadLink,
            currentUser,
            teamIsGroupConstrained,
            isLicensedForLDAPGroups,
            teamId = '',
            guestAccessEnabled,
            canInviteTeamMember,
        } = this.props;

        const safeAppDownloadLink = makeUrlSafe(appDownloadLink || '');

        if (!currentUser) {
            return null;
        }

        const pluginItems = this.props.pluginMenuItems?.map((item) => (
            <Menu.ItemAction
                id={item.id + '_pluginmenuitem'}
                key={item.id + '_pluginmenuitem'}
                onClick={() => {
                    if (item.action) {
                        item.action();
                    }
                }}
                text={item.text}
                icon={this.props.mobile && item.mobileIcon}
            />
        ));

        const someIntegrationEnabled = this.props.enableIncomingWebhooks || this.props.enableOutgoingWebhooks || this.props.enableCommands || this.props.enableOAuthServiceProvider || this.props.canManageSystemBots;
        const showIntegrations = !this.props.mobile && someIntegrationEnabled && this.props.canManageIntegrations;

        const {formatMessage} = this.props.intl;

        let invitePeopleModal = null;
        if (guestAccessEnabled || canInviteTeamMember) {
            invitePeopleModal = (
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
                    icon={this.props.mobile && <i className='fa fa-user-plus'/>}
                    onClick={() => trackEvent('ui', 'click_sidebar_team_dropdown_invite_people')}
                />
            );
        }

        return this.props.mobile ? (
            <Menu
                id={this.props.id}
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
                        onClick={this.searchMentions}
                        icon={<i className='mentions'>{'@'}</i>}
                        text={formatMessage({id: 'sidebar_right_menu.recentMentions', defaultMessage: 'Recent Mentions'})}
                    />
                    <Menu.ItemAction
                        id='flaggedPosts'
                        onClick={this.getFlagged}
                        icon={<i className='fa fa-bookmark'/>}
                        text={formatMessage({id: 'sidebar_right_menu.flagged', defaultMessage: 'Saved Posts'})}
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
                        teamId={teamId}
                        permissions={[Permissions.MANAGE_TEAM]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='addGroupsToTeam'
                            show={teamIsGroupConstrained && isLicensedForLDAPGroups}
                            modalId={ModalIdentifiers.ADD_GROUPS_TO_TEAM}
                            dialogType={AddGroupsToTeamModal}
                            text={formatMessage({id: 'navbar_dropdown.addGroupsToTeam', defaultMessage: 'Add Groups to Team'})}
                            icon={<i className='fa fa-user-plus'/>}
                        />
                    </TeamPermissionGate>
                    <TeamPermissionGate
                        teamId={teamId}
                        permissions={[Permissions.ADD_USER_TO_TEAM, Permissions.INVITE_GUEST]}
                    >
                        {invitePeopleModal}
                    </TeamPermissionGate>
                </Menu.Group>
                <Menu.Group>
                    <TeamPermissionGate
                        teamId={teamId}
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
                        teamId={teamId}
                        permissions={[Permissions.MANAGE_TEAM]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='manageGroups'
                            show={teamIsGroupConstrained && isLicensedForLDAPGroups}
                            modalId={ModalIdentifiers.MANAGE_TEAM_GROUPS}
                            dialogProps={{
                                teamID: teamId,
                            }}
                            dialogType={TeamGroupsManageModal}
                            text={formatMessage({id: 'navbar_dropdown.manageGroups', defaultMessage: 'Manage Groups'})}
                            icon={<i className='fa fa-user-plus'/>}
                        />
                    </TeamPermissionGate>
                    <TeamPermissionGate
                        teamId={teamId}
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
                        teamId={teamId}
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
                            show={true}
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
                        show={!teamIsGroupConstrained && this.props.experimentalPrimaryTeam !== this.props.teamName}
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
                    <Menu.ItemLink
                        id='integrations'
                        show={showIntegrations}
                        to={'/' + this.props.teamName + '/integrations'}
                        text={formatMessage({id: 'navbar_dropdown.integrations', defaultMessage: 'Integrations'})}
                    />
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
                        show={this.props.appDownloadLink && !UserAgent.isMobileApp()}
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
                        onClick={this.handleEmitUserLoggedOutEvent}
                        text={formatMessage({id: 'navbar_dropdown.logout', defaultMessage: 'Log Out'})}
                        icon={<i className='fa fa-sign-out'/>}
                    />
                </Menu.Group>
            </Menu>
        ) : (
            <Menu
                id={this.props.id}
                ariaLabel={formatMessage({id: 'sidebar.team_menu.menuAriaLabel', defaultMessage: 'team menu'})}
            >
                <Menu.Group>
                    <TeamPermissionGate
                        teamId={teamId}
                        permissions={[Permissions.MANAGE_TEAM]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='addGroupsToTeam'
                            show={teamIsGroupConstrained && isLicensedForLDAPGroups}
                            modalId={ModalIdentifiers.ADD_GROUPS_TO_TEAM}
                            dialogType={AddGroupsToTeamModal}
                            text={formatMessage({id: 'navbar_dropdown.addGroupsToTeam', defaultMessage: 'Add Groups to Team'})}
                        />
                    </TeamPermissionGate>
                    <TeamPermissionGate
                        teamId={teamId}
                        permissions={[Permissions.ADD_USER_TO_TEAM, Permissions.INVITE_GUEST]}
                    >
                        {invitePeopleModal}
                    </TeamPermissionGate>
                    <TeamPermissionGate
                        teamId={teamId}
                        permissions={[Permissions.MANAGE_TEAM]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='teamSettings'
                            modalId={ModalIdentifiers.TEAM_SETTINGS}
                            dialogType={TeamSettingsModal}
                            text={formatMessage({id: 'navbar_dropdown.teamSettings', defaultMessage: 'Team Settings'})}
                        />
                    </TeamPermissionGate>
                    <TeamPermissionGate
                        teamId={teamId}
                        permissions={[Permissions.MANAGE_TEAM]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='manageGroups'
                            show={teamIsGroupConstrained && isLicensedForLDAPGroups}
                            modalId={ModalIdentifiers.MANAGE_TEAM_GROUPS}
                            dialogProps={{teamID: teamId}}
                            dialogType={TeamGroupsManageModal}
                            text={formatMessage({id: 'navbar_dropdown.manageGroups', defaultMessage: 'Manage Groups'})}
                        />
                    </TeamPermissionGate>
                    <TeamPermissionGate
                        teamId={teamId}
                        permissions={[Permissions.REMOVE_USER_FROM_TEAM, Permissions.MANAGE_TEAM_ROLES]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='manageMembers'
                            modalId={ModalIdentifiers.TEAM_MEMBERS}
                            dialogType={TeamMembersModal}
                            text={formatMessage({id: 'navbar_dropdown.manageMembers', defaultMessage: 'Manage Members'})}
                        />
                    </TeamPermissionGate>
                    <TeamPermissionGate
                        teamId={teamId}
                        permissions={[Permissions.REMOVE_USER_FROM_TEAM, Permissions.MANAGE_TEAM_ROLES]}
                        invert={true}
                    >
                        <Menu.ItemToggleModalRedux
                            id='viewMembers'
                            modalId={ModalIdentifiers.TEAM_MEMBERS}
                            dialogType={TeamMembersModal}
                            text={formatMessage({id: 'navbar_dropdown.viewMembers', defaultMessage: 'View Members'})}
                        />
                    </TeamPermissionGate>
                    <Menu.ItemLink
                        id='joinTeam'
                        show={!this.props.experimentalPrimaryTeam && this.props.moreTeamsToJoin}
                        to='/select_team'
                        text={formatMessage({id: 'navbar_dropdown.join', defaultMessage: 'Join Another Team'})}
                    />
                    <Menu.ItemToggleModalRedux
                        id='leaveTeam'
                        className='destructive'
                        show={!teamIsGroupConstrained && this.props.experimentalPrimaryTeam !== this.props.teamName}
                        modalId={ModalIdentifiers.LEAVE_TEAM}
                        dialogType={LeaveTeamModal}
                        text={formatMessage({id: 'navbar_dropdown.leave', defaultMessage: 'Leave Team'})}
                    />
                </Menu.Group>
                <Menu.Group>
                    <SystemPermissionGate permissions={[Permissions.CREATE_TEAM]}>
                        <Menu.ItemLink
                            id='createTeam'
                            to='/create_team'
                            text={formatMessage({id: 'navbar_dropdown.create', defaultMessage: 'Create a Team'})}
                        />
                    </SystemPermissionGate>
                </Menu.Group>
                <Menu.Group>
                    {pluginItems}
                </Menu.Group>
            </Menu>
        );
    }
}

export default injectIntl(MainMenu);
