// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {
    ChevronDownIcon,
    LightbulbOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {Team} from '@mattermost/types/teams';

import {Permissions} from 'mattermost-redux/constants';
import {getCloudSubscription, getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles_helpers';
import {getJoinableTeamIds} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';
import {getMainMenuPluginComponents} from 'selectors/plugins';

import AddGroupsToTeamModal from 'components/add_groups_to_team_modal';
import useGetUsageDeltas from 'components/common/hooks/useGetUsageDeltas';
import InvitationModal from 'components/invitation_modal';
import LeaveTeamModal from 'components/leave_team_modal';
import * as Menu from 'components/menu';
import TeamGroupsManageModal from 'components/team_groups_manage_modal';
import TeamMembersModal from 'components/team_members_modal';
import TeamSettingsModal from 'components/team_settings_modal';
import RestrictedIndicator from 'components/widgets/menu/menu_items/restricted_indicator';

import {FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS} from 'utils/cloud_utils';
import {LicenseSkus, ModalIdentifiers, MattermostFeatures, CloudProducts} from 'utils/constants';
import {isCloudLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

interface Props {
    currentTeam: Team;
}

export default function SidebarTeamMenu(props: Props) {
    const history = useHistory();

    const dispatch = useDispatch();

    const license = useSelector(getLicense);
    const config = useSelector(getConfig);

    const havePermissionToCreateTeam = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.CREATE_TEAM}));
    const havePermissionToManageTeam = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_TEAM));
    const havePermissionToAddUserToTeam = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.ADD_USER_TO_TEAM));
    const havePermissionToRemoveUserFromTeam = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.REMOVE_USER_FROM_TEAM));
    const havePermissionToManageTeamRoles = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_TEAM_ROLES));
    const havePermissionToInviteGuest = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.INVITE_GUEST));

    const isTeamGroupConstrained = Boolean(props.currentTeam?.group_constrained);
    const isLicensedForLDAPGroups = license?.LDAPGroups === 'true';
    const isGuestAccessEnabled = config?.EnableGuestAccounts === 'true';
    const experimentalPrimaryTeam = config.ExperimentalPrimaryTeam;
    const joinableTeams = useSelector(getJoinableTeamIds);
    const haveMoreJoinableTeams = joinableTeams?.length > 0;
    const isCloud = isCloudLicense(license);
    const cloudSubscription = useSelector(getCloudSubscription);
    const subscriptionProduct = useSelector(getSubscriptionProduct);
    const isFreeTrial = isCloud && cloudSubscription?.is_free_trial === 'true';
    const isStarterFree = isCloud && subscriptionProduct?.sku === CloudProducts.STARTER;
    const usageDeltas = useGetUsageDeltas();
    const isTeamsLimitReached = isStarterFree && !isFreeTrial && usageDeltas.teams.active >= 0;
    const isTeamCreateRestricted = isCloud && (isFreeTrial || isTeamsLimitReached);
    const pluginInMainMenu = useSelector(getMainMenuPluginComponents);
    const tooltipText = props.currentTeam.description ? props.currentTeam.description : props.currentTeam.display_name;

    const onAddGroupsToTeamMenuItemClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.ADD_GROUPS_TO_TEAM,
            dialogType: AddGroupsToTeamModal,
        }));
    }, [dispatch]);

    const onInvitePeopleMenuItemClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.INVITATION,
            dialogType: InvitationModal,
        }));
    }, [dispatch]);

    const onTeamSettingsMenuItemClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.TEAM_SETTINGS,
            dialogType: TeamSettingsModal,
        }));
    }, [dispatch]);

    const onManageGroupsMenuItemClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.MANAGE_TEAM_GROUPS,
            dialogType: TeamGroupsManageModal,
            dialogProps: {
                teamID: props.currentTeam.id,
            },
        }));
    }, [dispatch, props.currentTeam.id]);

    const onManageViewMembersMenuItemClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.TEAM_MEMBERS,
            dialogType: TeamMembersModal,
        }));
    }, [dispatch]);

    const onJoinAnotherTeamMenuItemClick = useCallback(() => {
        history.push('/select_team');
    }, [history]);

    const onLeaveTeamMenuItemClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.LEAVE_TEAM,
            dialogType: LeaveTeamModal,
        }));
    }, [dispatch]);

    const onCreateTeamMenuItemClick = useCallback(() => {
        if (isTeamsLimitReached) {
            return;
        }

        history.push('/create_team');
    }, [history, isTeamsLimitReached]);

    const onLearnAboutTeamsMenuItemClick = useCallback(() => {
        window.open('https://mattermost.com/pl/mattermost-academy-team-training', '_blank', 'noopener noreferrer');
    }, []);

    let addGroupsToTeamMenuItem: JSX.Element | null = null;
    if (isTeamGroupConstrained && isLicensedForLDAPGroups && havePermissionToManageTeam) {
        addGroupsToTeamMenuItem = (
            <Menu.Item
                id='addGroupsToTeamMenuItem'
                onClick={onAddGroupsToTeamMenuItemClick}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.teamMenu.addGroupsToTeamMenuItem.primaryLabel'
                        defaultMessage='Add groups to team'
                    />
                )}
            />
        );
    }

    let invitePeopleMenuItem: JSX.Element | null = null;
    if (isGuestAccessEnabled && havePermissionToAddUserToTeam && havePermissionToInviteGuest) {
        invitePeopleMenuItem = (
            <Menu.Item
                id='invitePeopleMenuItem'
                onClick={onInvitePeopleMenuItemClick}
                labels={(
                    <>
                        <FormattedMessage
                            id='sidebarLeft.teamMenu.invitePeopleMenuItem.primaryLabel'
                            defaultMessage='Invite people'
                        />
                        <FormattedMessage
                            id='sidebarLeft.teamMenu.invitePeopleMenuItem.secondaryLabel'
                            defaultMessage='Add people to the team'
                        />
                    </>
                )}
            />
        );
    }

    let teamSettingsMenuItem: JSX.Element | null = null;
    if (havePermissionToManageTeam) {
        teamSettingsMenuItem = (
            <Menu.Item
                id='teamSettingsMenuItem'
                onClick={onTeamSettingsMenuItemClick}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.teamMenu.teamSettingsMenuItem.primaryLabel'
                        defaultMessage='Team settings'
                    />
                )}
            />
        );
    }

    let manageGroupsMenuItem: JSX.Element | null = null;
    if (isTeamGroupConstrained && isLicensedForLDAPGroups && havePermissionToManageTeam) {
        manageGroupsMenuItem = (
            <Menu.Item
                id='manageGroupsMenuItem'
                onClick={onManageGroupsMenuItemClick}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.teamMenu.manageGroupsMenuItem.primaryLabel'
                        defaultMessage='Manage groups'
                    />
                )}
            />
        );
    }

    let manageViewMembersMenuItem: JSX.Element | null = null;
    if (havePermissionToRemoveUserFromTeam && havePermissionToManageTeamRoles) {
        manageViewMembersMenuItem = (
            <Menu.Item
                id='manageMembersMenuItem'
                onClick={onManageViewMembersMenuItemClick}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.teamMenu.manageMembersMenuItem.primaryLabel'
                        defaultMessage='Manage members'
                    />
                )}
            />
        );
    } else {
        manageViewMembersMenuItem = (
            <Menu.Item
                id='viewMembersMenuItem'
                onClick={onManageViewMembersMenuItemClick}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.teamMenu.viewMembersMenuItem.primaryLabel'
                        defaultMessage='View members'
                    />
                )}
            />
        );
    }

    let joinAnotherTeamMenuItem: JSX.Element | null = null;
    if (!experimentalPrimaryTeam && haveMoreJoinableTeams) {
        joinAnotherTeamMenuItem = (
            <Menu.Item
                id='joinAnotherTeamMenuItem'
                onClick={onJoinAnotherTeamMenuItemClick}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.teamMenu.joinAnotherTeamMenuItem.primaryLabel'
                        defaultMessage='Join another team'
                    />
                )}
            />
        );
    }

    let leaveTeamMenuItem: JSX.Element | null = null;
    if (!isTeamGroupConstrained && experimentalPrimaryTeam !== props.currentTeam.name) {
        leaveTeamMenuItem = (
            <Menu.Item
                id='leaveTeamMenuItem'
                onClick={onLeaveTeamMenuItemClick}
                isDestructive={true}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.teamMenu.leaveTeamMenuItem.primaryLabel'
                        defaultMessage='Leave team'
                    />
                )}
            />
        );
    }

    let createTeamMenuItem: JSX.Element | null = null;
    if (havePermissionToCreateTeam) {
        createTeamMenuItem = (
            <Menu.Item
                id='createTeamMenuItem'
                disabled={isTeamsLimitReached}
                onClick={onCreateTeamMenuItemClick}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.teamMenu.createTeamMenuItem.primaryLabel'
                        defaultMessage='Create a team'
                    />
                )}
                trailingElements={isTeamCreateRestricted && <RestrictedIndicatorForCreateTeam isFreeTrial={isFreeTrial}/>}
            />
        );
    }

    const learnAboutTeamsMenuItem = (
        <Menu.Item
            key='learnAboutTeamsMenuItem'
            id='learnAboutTeamsMenuItem'
            onClick={onLearnAboutTeamsMenuItemClick}
            leadingElement={(
                <LightbulbOutlineIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            labels={(
                <FormattedMessage
                    id='sidebarLeft.teamMenu.learnAboutTeamsMenuItem.primaryLabel'
                    defaultMessage='Learn about teams'
                />
            )}
        />
    );

    let pluginMenuItems: JSX.Element[] | null = null;
    if (pluginInMainMenu.length > 0) {
        pluginMenuItems = pluginInMainMenu.map((plugin) => {
            function handleClick() {
                if (plugin.action) {
                    plugin.action();
                }
            }

            return (
                <Menu.Item
                    id={`${plugin.id}_pluginmenuitem`}
                    key={plugin.id}
                    onClick={handleClick}
                    labels={<span>{plugin.text}</span>}
                />
            );
        });
    }

    return (
        <Menu.Container
            menuButton={{
                id: 'sidebarTeamMenuButton',
                class: 'btn btn-sm',
                children: (
                    <>
                        <span>{props.currentTeam.display_name}</span>
                        <ChevronDownIcon size={18}/>
                    </>
                ),
            }}
            menuButtonTooltip={{
                text: tooltipText,
            }}
            menu={{
                id: 'sidebarTeamMenu',
                width: '225px',
            }}

        >
            {addGroupsToTeamMenuItem}
            {invitePeopleMenuItem}
            {teamSettingsMenuItem}
            {manageGroupsMenuItem}
            {manageViewMembersMenuItem}
            {joinAnotherTeamMenuItem}
            {leaveTeamMenuItem}
            {Boolean(createTeamMenuItem) && <Menu.Separator/>}
            {createTeamMenuItem}
            {Boolean(learnAboutTeamsMenuItem) && <Menu.Separator/>}
            {learnAboutTeamsMenuItem}
            {Boolean(pluginMenuItems) && <Menu.Separator/>}
            {pluginMenuItems}
        </Menu.Container>
    );
}

function RestrictedIndicatorForCreateTeam({isFreeTrial}: {isFreeTrial: boolean}) {
    const {formatMessage} = useIntl();
    return (
        <RestrictedIndicator
            feature={MattermostFeatures.CREATE_MULTIPLE_TEAMS}
            minimumPlanRequiredForFeature={LicenseSkus.Professional}
            blocked={!isFreeTrial}
            tooltipMessage={formatMessage({
                id: 'navbar_dropdown.create.tooltip.cloudFreeTrial',
                defaultMessage: 'During your trial you are able to create multiple teams. These teams will be archived after your trial.',
            })}
            titleAdminPreTrial={formatMessage({
                id: 'navbar_dropdown.create.modal.titleAdminPreTrial',
                defaultMessage: 'Try unlimited teams with a free trial',
            })}
            messageAdminPreTrial={formatMessage({
                id: 'navbar_dropdown.create.modal.messageAdminPreTrial',
                defaultMessage: 'Create unlimited teams with one of our paid plans. Get the full experience of Enterprise when you start a free, {trialLength} day trial.',
            },
            {
                trialLength: FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS,
            },
            )}
            titleAdminPostTrial={formatMessage({
                id: 'navbar_dropdown.create.modal.titleAdminPostTrial',
                defaultMessage: 'Upgrade to create unlimited teams',
            })}
            messageAdminPostTrial={formatMessage({
                id: 'navbar_dropdown.create.modal.messageAdminPostTrial',
                defaultMessage: 'Multiple teams allow for context-specific spaces that are more attuned to your and your teams’ needs. Upgrade to the Professional plan to create unlimited teams.',
            })}
            titleEndUser={formatMessage({
                id: 'navbar_dropdown.create.modal.titleEndUser',
                defaultMessage: 'Multiple teams available in paid plans',
            })}
            messageEndUser={formatMessage({
                id: 'navbar_dropdown.create.modal.messageEndUser',
                defaultMessage: 'Multiple teams allow for context-specific spaces that are more attuned to your teams’ needs.',
            })}
            padding='0'
        />
    );
}
