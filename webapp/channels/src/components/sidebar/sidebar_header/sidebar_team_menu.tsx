// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {
    LightbulbOutlineIcon,
    AccountPlusOutlineIcon,
    AccountMultiplePlusOutlineIcon,
    SettingsOutlineIcon,
    AccountMultipleOutlineIcon,
    ExitToAppIcon,
    MessagePlusOutlineIcon,
    PlusIcon,
    MonitorAccountIcon,
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
    const license = useSelector(getLicense);
    const config = useSelector(getConfig);

    const havePermissionToCreateTeam = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.CREATE_TEAM}));
    const havePermissionToManageTeam = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_TEAM));
    const havePermissionToAddUserToTeam = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.ADD_USER_TO_TEAM));
    const havePermissionToInviteGuest = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.INVITE_GUEST));
    const isCloud = isCloudLicense(license);
    const isGuestAccessEnabled = config?.EnableGuestAccounts === 'true';
    const isTeamGroupConstrained = Boolean(props.currentTeam?.group_constrained);
    const isLicensedForLDAPGroups = license?.LDAPGroups === 'true';
    const experimentalPrimaryTeam = config.ExperimentalPrimaryTeam;
    const joinableTeams = useSelector(getJoinableTeamIds);
    const haveMoreJoinableTeams = joinableTeams?.length > 0;
    const canJoinAnotherTeam = !experimentalPrimaryTeam && haveMoreJoinableTeams;

    const tooltipText = props.currentTeam.description ? props.currentTeam.description : props.currentTeam.display_name;

    return (
        <Menu.Container
            menuButton={{
                id: 'sidebarTeamMenuButton',
                class: 'btn btn-sm btn-quaternary btn-inverted',
                children: (
                    <>
                        <span>{props.currentTeam.display_name}</span>
                        <i className='icon icon-chevron-down'/>
                    </>
                ),
            }}
            menuButtonTooltip={{
                text: tooltipText,
            }}
            menu={{
                id: 'sidebarTeamMenu',
            }}
        >
            {((isGuestAccessEnabled && havePermissionToInviteGuest) || havePermissionToAddUserToTeam) && (
                <InvitePeopleMenuItem/>
            )}
            {isTeamGroupConstrained && isLicensedForLDAPGroups && havePermissionToManageTeam && (
                <AddGroupsToTeamMenuItem/>
            )}
            {havePermissionToManageTeam && (
                <TeamSettingsMenuItem/>
            )}
            <ManageViewMembersMenuItem/>
            {(isTeamGroupConstrained && isLicensedForLDAPGroups && havePermissionToManageTeam) && (
                <ManageGroupsMenuItem
                    teamID={props.currentTeam.id}
                />
            )}
            {(!isTeamGroupConstrained && experimentalPrimaryTeam !== props.currentTeam.name) && (
                <LeaveTeamMenuItem/>
            )}
            {(canJoinAnotherTeam || havePermissionToCreateTeam) && <Menu.Separator/>}
            {canJoinAnotherTeam &&
                <JoinAnotherTeamMenuItem/>
            }
            {havePermissionToCreateTeam && (
                <CreateTeamMenuItem
                    isCloud={isCloud}
                />
            )}
            <Menu.Separator/>
            <LearnAboutTeamsMenuItem/>
            <PluginMenuItems/>
        </Menu.Container>
    );
}

function InvitePeopleMenuItem(props: Menu.FirstMenuItemProps) {
    const dispatch = useDispatch();

    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.INVITATION,
            dialogType: InvitationModal,
            dialogProps: {
                focusOriginElement: 'sidebarTeamMenuButton',
            },
        }));
    }, [dispatch]);

    return (
        <Menu.Item
            onClick={handleClick}
            leadingElement={(
                <AccountMultiplePlusOutlineIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            labels={(
                <>
                    <FormattedMessage
                        id='sidebarLeft.teamMenu.invitePeopleMenuItem.primaryLabel'
                        defaultMessage='Invite people'
                    />
                    <FormattedMessage
                        id='sidebarLeft.teamMenu.invitePeopleMenuItem.secondaryLabel'
                        defaultMessage='Add or invite people to the team'
                    />
                </>
            )}
            aria-haspopup='dialog'
            {...props}
        />
    );
}

function AddGroupsToTeamMenuItem(props: Menu.FirstMenuItemProps) {
    const dispatch = useDispatch();

    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.ADD_GROUPS_TO_TEAM,
            dialogType: AddGroupsToTeamModal,
            dialogProps: {
                focusOriginElement: 'sidebarTeamMenuButton',
            },
        }));
    }, [dispatch]);

    return (
        <Menu.Item
            onClick={handleClick}
            leadingElement={(
                <AccountPlusOutlineIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            labels={(
                <FormattedMessage
                    id='sidebarLeft.teamMenu.addGroupsToTeamMenuItem.primaryLabel'
                    defaultMessage='Add groups'
                />
            )}
            aria-haspopup='dialog'
            {...props}
        />
    );
}

function TeamSettingsMenuItem(props: Menu.FirstMenuItemProps) {
    const dispatch = useDispatch();

    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.TEAM_SETTINGS,
            dialogType: TeamSettingsModal,
            dialogProps: {
                focusOriginElement: 'sidebarTeamMenuButton',
            },
        }));
    }, [dispatch]);

    return (
        <Menu.Item
            leadingElement={(
                <SettingsOutlineIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            onClick={handleClick}
            labels={(
                <FormattedMessage
                    id='sidebarLeft.teamMenu.teamSettingsMenuItem.primaryLabel'
                    defaultMessage='Team settings'
                />
            )}
            aria-haspopup='dialog'
            {...props}
        />
    );
}

function ManageViewMembersMenuItem(props: Menu.FirstMenuItemProps) {
    const dispatch = useDispatch();

    const havePermissionToRemoveUserFromTeam = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.REMOVE_USER_FROM_TEAM));
    const havePermissionToManageTeamRoles = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_TEAM_ROLES));

    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.TEAM_MEMBERS,
            dialogType: TeamMembersModal,
            dialogProps: {
                focusOriginElement: 'sidebarTeamMenuButton',
            },
        }));
    }, [dispatch]);

    let label = (
        <FormattedMessage
            id='sidebarLeft.teamMenu.viewMembersMenuItem.primaryLabel'
            defaultMessage='View members'
        />
    );
    if (havePermissionToRemoveUserFromTeam && havePermissionToManageTeamRoles) {
        label = (
            <FormattedMessage
                id='sidebarLeft.teamMenu.manageMembersMenuItem.primaryLabel'
                defaultMessage='Manage members'
            />
        );
    }

    return (
        <Menu.Item
            leadingElement={(
                <AccountMultipleOutlineIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            onClick={handleClick}
            labels={label}
            aria-haspopup='dialog'
            {...props}
        />
    );
}

interface ManageGroupsMenuItemProps {
    teamID: Team['id'];
}

function ManageGroupsMenuItem({teamID}: ManageGroupsMenuItemProps) {
    const dispatch = useDispatch();

    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.MANAGE_TEAM_GROUPS,
            dialogType: TeamGroupsManageModal,
            dialogProps: {
                teamID,
            },
        }));
    }, [dispatch, teamID]);

    return (
        <Menu.Item
            leadingElement={(
                <MonitorAccountIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            onClick={handleClick}
            labels={(
                <FormattedMessage
                    id='sidebarLeft.teamMenu.manageGroupsMenuItem.primaryLabel'
                    defaultMessage='Manage groups'
                />
            )}
            aria-haspopup='dialog'
        />
    );
}

function LeaveTeamMenuItem() {
    const dispatch = useDispatch();

    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.LEAVE_TEAM,
            dialogType: LeaveTeamModal,
        }));
    }, [dispatch]);

    return (
        <Menu.Item
            leadingElement={(
                <ExitToAppIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            onClick={handleClick}
            isDestructive={true}
            labels={(
                <FormattedMessage
                    id='sidebarLeft.teamMenu.leaveTeamMenuItem.primaryLabel'
                    defaultMessage='Leave team'
                />
            )}
            aria-haspopup='dialog'
        />
    );
}

function JoinAnotherTeamMenuItem() {
    const history = useHistory();

    const handleClick = useCallback(() => {
        history.push('/select_team');
    }, [history]);

    return (
        <Menu.Item
            leadingElement={(
                <MessagePlusOutlineIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            onClick={handleClick}
            labels={(
                <FormattedMessage
                    id='sidebarLeft.teamMenu.joinAnotherTeamMenuItem.primaryLabel'
                    defaultMessage='Join another team'
                />
            )}
        />
    );
}

interface CreateTeamMenuItemProps {
    isCloud: boolean;
}

function CreateTeamMenuItem({isCloud}: CreateTeamMenuItemProps) {
    const history = useHistory();

    const cloudSubscription = useSelector(getCloudSubscription);
    const subscriptionProduct = useSelector(getSubscriptionProduct);
    const isFreeTrial = isCloud && cloudSubscription?.is_free_trial === 'true';
    const isStarterFree = isCloud && subscriptionProduct?.sku === CloudProducts.STARTER;
    const usageDeltas = useGetUsageDeltas();
    const isTeamsLimitReached = isStarterFree && !isFreeTrial && usageDeltas.teams.active >= 0;
    const isTeamCreateRestricted = isCloud && (isFreeTrial || isTeamsLimitReached);

    const handleClick = useCallback(() => {
        if (isTeamsLimitReached || isTeamCreateRestricted) {
            return;
        }

        history.push('/create_team');
    }, [history, isTeamsLimitReached]);

    return (
        <Menu.Item
            leadingElement={(
                <PlusIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            onClick={handleClick}
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
                defaultMessage: "Multiple teams allow for context-specific spaces that are more attuned to your and your teams' needs. Upgrade to the Professional plan to create unlimited teams.",
            })}
            titleEndUser={formatMessage({
                id: 'navbar_dropdown.create.modal.titleEndUser',
                defaultMessage: 'Multiple teams available in paid plans',
            })}
            messageEndUser={formatMessage({
                id: 'navbar_dropdown.create.modal.messageEndUser',
                defaultMessage: "Multiple teams allow for context-specific spaces that are more attuned to your teams' needs.",
            })}
        />
    );
}

const MATTERMOST_ACADEMY_TEAM_TRAINING_LINK = 'https://mattermost.com/pl/mattermost-academy-team-training';

function LearnAboutTeamsMenuItem() {
    const handleClick = useCallback(() => {
        window.open(MATTERMOST_ACADEMY_TEAM_TRAINING_LINK, '_blank', 'noopener noreferrer');
    }, []);

    return (
        <Menu.Item
            className='learnAboutTeamsMenuItem'
            onClick={handleClick}
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
}

function PluginMenuItems() {
    const pluginInMainMenu = useSelector(getMainMenuPluginComponents);

    if (pluginInMainMenu.length > 0) {
        const pluginMenuItems = pluginInMainMenu.map((plugin) => {
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

        return (
            <>
                <Menu.Separator/>
                {pluginMenuItems}
            </>
        );
    }

    return null;
}
