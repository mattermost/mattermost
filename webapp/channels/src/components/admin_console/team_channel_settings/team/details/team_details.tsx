// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {SyncableType} from '@mattermost/types/groups';
import type {Group, SyncablePatch} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import BlockableLink from 'components/admin_console/blockable_link';
import ConfirmModal from 'components/confirm_modal';
import FormError from 'components/form_error';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {getHistory} from 'utils/browser_history';

import {TeamGroups} from './team_groups';
import TeamMembers from './team_members/index';
import {TeamModes} from './team_modes';
import {TeamProfile} from './team_profile';

import SaveChangesPanel from '../../../save_changes_panel';
import {NeedDomainsError, NeedGroupsError, UsersWillBeRemovedError} from '../../errors';
import RemoveConfirmModal from '../../remove_confirm_modal';

export type Props = {
    teamID: string;
    team?: Team;
    totalGroups: number;
    groups: Group[];
    allGroups: Record<string, Group>;
    isDisabled?: boolean;
    isLicensedForLDAPGroups?: boolean;
    actions: {
        setNavigationBlocked: (blocked: boolean) => void;
        getTeam: (teamId: string) => Promise<ActionResult>;
        linkGroupSyncable: (groupId: string, syncableId: string, syncableType: SyncableType, patch: SyncablePatch) => Promise<ActionResult>;
        unlinkGroupSyncable: (groupId: string, syncableId: string, syncableType: SyncableType) => Promise<ActionResult>;
        membersMinusGroupMembers: (teamId: string, groupIds: string[], page?: number, perPage?: number) => Promise<ActionResult>;
        getGroups: (teamId: string, q?: string, page?: number, perPage?: number, filterAllowReference?: boolean) => Promise<ActionResult>;
        patchTeam: (team: Team) => Promise<ActionResult>;
        patchGroupSyncable: (groupId: string, syncableId: string, syncableType: SyncableType, patch: Partial<SyncablePatch>) => Promise<ActionResult>;
        addUserToTeam: (teamId: string, userId: string) => Promise<ActionResult>;
        removeUserFromTeam: (teamId: string, userId: string) => Promise<ActionResult>;
        updateTeamMemberSchemeRoles: (teamId: string, userId: string, isSchemeUser: boolean, isSchemeAdmin: boolean) => Promise<ActionResult>;
        deleteTeam: (teamId: string) => Promise<ActionResult>;
        unarchiveTeam: (teamId: string) => Promise<ActionResult>;
    };
};

type State = {
    groups: Group[];
    syncChecked: boolean;
    allAllowedChecked: boolean;
    allowedDomainsChecked: boolean;
    allowedDomains: string;
    saving: boolean;
    showRemoveConfirmation: boolean;
    usersToRemoveCount: number;
    usersToRemove: {[id: string]: UserProfile};
    usersToAdd: {[id: string]: UserProfile};
    rolesToUpdate: {
        [userId: string]: {
            schemeUser: boolean;
            schemeAdmin: boolean;
        };
    };
    totalGroups: number;
    saveNeeded: boolean;
    serverError: JSX.Element | undefined;
    previousServerError: JSX.Element | undefined;
    isLocalArchived: boolean;
    showArchiveConfirmModal: boolean;
};

export default class TeamDetails extends React.PureComponent<Props, State> {
    static defaultProps = {
        team: {display_name: '', id: ''} as Team,
    };

    constructor(props: Props) {
        super(props);
        const team = props.team;
        this.state = {
            groups: props.groups,
            syncChecked: Boolean(team?.group_constrained),
            allAllowedChecked: Boolean(team?.allow_open_invite),
            allowedDomainsChecked: Boolean(team?.allowed_domains),
            allowedDomains: team?.allowed_domains || '',
            saving: false,
            showRemoveConfirmation: false,
            usersToRemoveCount: 0,
            usersToRemove: {},
            usersToAdd: {},
            rolesToUpdate: {},
            totalGroups: props.totalGroups,
            saveNeeded: false,
            serverError: undefined,
            previousServerError: undefined,
            isLocalArchived: team ? team.delete_at > 0 : true,
            showArchiveConfirmModal: false,
        };
    }

    componentDidUpdate(prevProps: Props) {
        const {totalGroups, team} = this.props;
        if (prevProps.team?.id !== team?.id || totalGroups !== prevProps.totalGroups) {
            this.setState({
                totalGroups,
                syncChecked: Boolean(team?.group_constrained),
                allAllowedChecked: Boolean(team?.allow_open_invite),
                allowedDomainsChecked: Boolean(team?.allowed_domains),
                allowedDomains: team?.allowed_domains || '',
                isLocalArchived: team ? team.delete_at > 0 : true,
            });
        }
    }

    componentDidMount() {
        const {teamID, actions} = this.props;
        actions.getTeam(teamID).
            then(() => actions.getGroups(teamID)).
            then(() => this.setState({groups: this.props.groups}));
    }

    setNewGroupRole = (gid: string) => {
        const groups = cloneDeep(this.state.groups).map((g) => {
            if (g.id === gid) {
                g.scheme_admin = !g.scheme_admin;
            }
            return g;
        });
        this.processGroupsChange(groups);
    };

    handleSubmit = async () => {
        const {team, groups: origGroups, teamID, actions} = this.props;
        if (!team) {
            return;
        }

        this.setState({showRemoveConfirmation: false, saving: true});
        const {groups, allAllowedChecked, allowedDomainsChecked, allowedDomains, syncChecked, usersToAdd, usersToRemove, rolesToUpdate} = this.state;

        let serverError: JSX.Element | undefined;

        if (this.teamToBeArchived()) {
            let saveNeeded = false;
            const result = await actions.deleteTeam(team.id);
            if ('error' in result) {
                serverError = <FormError error={result.error.message}/>;
                saveNeeded = true;
            }
            this.setState({serverError, saving: false, saveNeeded, usersToRemoveCount: 0, rolesToUpdate: {}, usersToAdd: {}, usersToRemove: {}});
            actions.setNavigationBlocked(saveNeeded);
            if (!saveNeeded) {
                getHistory().push('/admin_console/user_management/teams');
            }
            return;
        } else if (this.teamToBeRestored() && !this.state.serverError) {
            const result = await actions.unarchiveTeam(team.id);
            if ('error' in result) {
                serverError = <FormError error={result.error.message}/>;
            }
            this.setState({serverError, previousServerError: undefined});
        }

        let saveNeeded = false;
        if (allowedDomainsChecked && allowedDomains.trim().length === 0) {
            saveNeeded = true;
            serverError = <NeedDomainsError/>;
        } else if (this.state.groups.length === 0 && syncChecked) {
            serverError = <NeedGroupsError/>;
            saveNeeded = true;
        } else {
            const patchTeamPromise = actions.patchTeam({
                ...team,
                group_constrained: syncChecked,
                allowed_domains: allowedDomainsChecked ? allowedDomains : '',
                allow_open_invite: allAllowedChecked,
            });
            const patchTeamSyncable = groups.
                filter((g) => {
                    return origGroups.some((group) => group.id === g.id && group.scheme_admin !== g.scheme_admin);
                }).
                map((g) => actions.patchGroupSyncable(g.id, teamID, SyncableType.Team, {scheme_admin: g.scheme_admin}));
            const unlink = origGroups.
                filter((g) => {
                    return !groups.some((group) => group.id === g.id);
                }).
                map((g) => actions.unlinkGroupSyncable(g.id, teamID, SyncableType.Team));
            const link = groups.
                filter((g) => {
                    return !origGroups.some((group) => group.id === g.id);
                }).
                map((g) => actions.linkGroupSyncable(g.id, teamID, SyncableType.Team, {auto_add: true, scheme_admin: g.scheme_admin}));
            const result = await Promise.all([patchTeamPromise, ...patchTeamSyncable, ...unlink, ...link]);
            const resultWithError = result.find((r) => r.error);
            if (resultWithError) {
                serverError = <FormError error={resultWithError.error?.message}/>;
            } else {
                if (unlink.length > 0) {
                    trackEvent('admin_team_config_page', 'groups_removed_from_team', {count: unlink.length, team_id: teamID});
                }
                if (link.length > 0) {
                    trackEvent('admin_team_config_page', 'groups_added_to_team', {count: link.length, team_id: teamID});
                }
                await actions.getGroups(teamID);
            }
        }

        const usersToAddList = Object.values(usersToAdd);
        const usersToRemoveList = Object.values(usersToRemove);
        const userRolesToUpdate = Object.keys(rolesToUpdate);
        const usersToUpdate = usersToAddList.length > 0 || usersToRemoveList.length > 0 || userRolesToUpdate.length > 0;
        if (usersToUpdate && !syncChecked) {
            const addUserActions: Array<Promise<ActionResult>> = [];
            const removeUserActions: Array<Promise<ActionResult>> = [];
            const {addUserToTeam, removeUserFromTeam, updateTeamMemberSchemeRoles} = this.props.actions;
            usersToAddList.forEach((user) => {
                addUserActions.push(addUserToTeam(teamID, user.id));
            });
            usersToRemoveList.forEach((user) => {
                removeUserActions.push(removeUserFromTeam(teamID, user.id));
            });

            if (addUserActions.length > 0) {
                const result = await Promise.all(addUserActions);
                const resultWithError = result.find((r) => r.error);
                const count = result.filter((r) => r.data).length;
                if (resultWithError) {
                    serverError = <FormError error={resultWithError.error?.message}/>;
                }
                if (count > 0) {
                    trackEvent('admin_team_config_page', 'members_added_to_team', {count, team_id: teamID});
                }
            }

            if (removeUserActions.length > 0) {
                const result = await Promise.all(removeUserActions);
                const resultWithError = result.find((r) => r.error);
                const count = result.filter((r) => r.data).length;
                if (resultWithError) {
                    serverError = <FormError error={resultWithError.error?.message}/>;
                }
                if (count > 0) {
                    trackEvent('admin_team_config_page', 'members_removed_from_team', {count, team_id: teamID});
                }
            }

            const rolesToPromote: Array<Promise<ActionResult>> = [];
            const rolesToDemote: Array<Promise<ActionResult>> = [];
            userRolesToUpdate.forEach((userId) => {
                const {schemeUser, schemeAdmin} = rolesToUpdate[userId];
                if (schemeAdmin) {
                    rolesToPromote.push(updateTeamMemberSchemeRoles(teamID, userId, schemeUser, schemeAdmin));
                } else {
                    rolesToDemote.push(updateTeamMemberSchemeRoles(teamID, userId, schemeUser, schemeAdmin));
                }
            });

            if (rolesToPromote.length > 0) {
                const result = await Promise.all(rolesToPromote);
                const resultWithError = result.find((r) => r.error);
                const count = result.filter((r) => r.data).length;
                if (resultWithError) {
                    serverError = <FormError error={resultWithError.error?.message}/>;
                }
                if (count > 0) {
                    trackEvent('admin_team_config_page', 'members_elevated_to_team_admin', {count, team_id: teamID});
                }
            }

            if (rolesToDemote.length > 0) {
                const result = await Promise.all(rolesToDemote);
                const resultWithError = result.find((r) => r.error);
                const count = result.filter((r) => r.data).length;
                if (resultWithError) {
                    serverError = <FormError error={resultWithError.error?.message}/>;
                }
                if (count > 0) {
                    trackEvent('admin_team_config_page', 'admins_demoted_to_team_member', {count, team_id: teamID});
                }
            }
        }

        this.setState({usersToRemoveCount: 0, rolesToUpdate: {}, usersToAdd: {}, usersToRemove: {}, serverError, saving: false, saveNeeded}, () => {
            actions.setNavigationBlocked(saveNeeded);
            if (!saveNeeded && !serverError) {
                getHistory().push('/admin_console/user_management/teams');
            }
        });
    };

    setToggles = (syncChecked: boolean, allAllowedChecked: boolean, allowedDomainsChecked: boolean, allowedDomains: string) => {
        this.setState({
            saveNeeded: true,
            syncChecked,
            allAllowedChecked: !syncChecked && allAllowedChecked,
            allowedDomainsChecked: !syncChecked && allowedDomainsChecked,
            allowedDomains,
        }, () => this.processGroupsChange(this.state.groups));
        this.props.actions.setNavigationBlocked(true);
    };

    async processGroupsChange(groups: Group[]) {
        const {teamID, actions} = this.props;
        actions.setNavigationBlocked(true);

        let serverError: JSX.Element | undefined;
        let usersToRemoveCount = 0;
        if (this.state.syncChecked) {
            try {
                if (groups.length === 0) {
                    serverError = <NeedGroupsError warning={true}/>;
                } else {
                    const result = await actions.membersMinusGroupMembers(teamID, groups.map((g) => g.id));
                    usersToRemoveCount = result.data ? result.data.total_count : 0;
                    if (usersToRemoveCount > 0) {
                        serverError = (
                            <UsersWillBeRemovedError
                                total={usersToRemoveCount}
                                users={result.data.users}
                                scope={'team'}
                                scopeId={this.props.teamID}
                            />
                        );
                    }
                }
            } catch (ex) {
                serverError = ex;
            }
        }
        this.setState({groups, usersToRemoveCount, saveNeeded: true, serverError});
    }

    addUsersToAdd = (users: UserProfile[]) => {
        let {usersToRemoveCount} = this.state;
        const {usersToAdd, usersToRemove} = this.state;
        const usersToAddCopy = cloneDeep(usersToAdd);
        users.forEach((user) => {
            if (usersToRemove[user.id]?.id === user.id) {
                delete usersToRemove[user.id];
                usersToRemoveCount -= 1;
            } else {
                usersToAddCopy[user.id] = user;
            }
        });
        this.setState({usersToAdd: {...usersToAddCopy}, usersToRemove: {...usersToRemove}, usersToRemoveCount, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    addUserToRemove = (user: UserProfile) => {
        let {usersToRemoveCount} = this.state;
        const {usersToAdd, usersToRemove, rolesToUpdate} = this.state;
        if (usersToAdd[user.id]?.id === user.id) {
            delete usersToAdd[user.id];
        } else if (usersToRemove[user.id]?.id !== user.id) {
            usersToRemoveCount += 1;
            usersToRemove[user.id] = user;
        }
        delete rolesToUpdate[user.id];
        this.setState({usersToRemove: {...usersToRemove}, usersToAdd: {...usersToAdd}, rolesToUpdate: {...rolesToUpdate}, usersToRemoveCount, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    addRolesToUpdate = (userId: string, schemeUser: boolean, schemeAdmin: boolean) => {
        const {rolesToUpdate} = this.state;
        rolesToUpdate[userId] = {schemeUser, schemeAdmin};
        this.setState({rolesToUpdate: {...rolesToUpdate}, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    handleGroupRemoved = (gid: string) => {
        const groups = this.state.groups.filter((g) => g.id !== gid);
        this.setState({totalGroups: this.state.totalGroups - 1});
        this.processGroupsChange(groups);
    };

    handleGroupChange = (groupIDs: string[]) => {
        const groups = [...this.state.groups, ...groupIDs.map((gid) => this.props.allGroups[gid])];
        this.setState({totalGroups: this.state.totalGroups + groupIDs.length});
        this.processGroupsChange(groups);
    };

    hideRemoveUsersModal = () => this.setState({showRemoveConfirmation: false});

    hideArchiveConfirmModal = () => this.setState({showArchiveConfirmModal: false});

    onSave = () => {
        if (this.teamToBeArchived()) {
            this.setState({showArchiveConfirmModal: true});
        } else if (this.state.usersToRemoveCount > 0) {
            this.setState({showRemoveConfirmation: true});
        } else {
            this.handleSubmit();
        }
    };

    teamToBeArchived = () => {
        const {isLocalArchived} = this.state;
        const isServerArchived = this.props.team?.delete_at !== 0;
        return isLocalArchived && !isServerArchived;
    };

    teamToBeRestored = () => {
        const {isLocalArchived} = this.state;
        const isServerArchived = this.props.team?.delete_at !== 0;
        return !isLocalArchived && isServerArchived;
    };

    onToggleArchive = () => {
        const {isLocalArchived, serverError, previousServerError} = this.state;
        const {isDisabled} = this.props;
        if (isDisabled) {
            return;
        }

        const newState: Partial<State> = {
            saveNeeded: true,
            isLocalArchived: !isLocalArchived,
            previousServerError: undefined,
            serverError: undefined,
        };

        if (newState.isLocalArchived) {
            // if the channel is being archived then clear the other server
            // errors, they're no longer relevant.
            newState.previousServerError = serverError;
            newState.serverError = undefined;
        } else {
            // if the channel is being unarchived (maybe the user had toggled
            // and untoggled) the button, so reinstate any server errors that
            // were present.
            newState.serverError = previousServerError;
            newState.previousServerError = undefined;
        }
        this.props.actions.setNavigationBlocked(true);
        this.setState(newState as State);
    };

    render = () => {
        const {team, isLicensedForLDAPGroups} = this.props;

        if (!team) {
            return null;
        }

        const {totalGroups, saving, saveNeeded, serverError, groups, allAllowedChecked, allowedDomainsChecked, allowedDomains, syncChecked, showRemoveConfirmation, usersToRemoveCount, isLocalArchived, showArchiveConfirmModal} = this.state;
        const missingGroup = (og: {id: string}) => !groups.find((g) => g.id === og.id);
        const removedGroups = this.props.groups.filter(missingGroup);
        const nonArchivedContent = (
            <>
                <RemoveConfirmModal
                    amount={usersToRemoveCount}
                    inChannel={false}
                    show={showRemoveConfirmation}
                    onCancel={this.hideRemoveUsersModal}
                    onConfirm={this.handleSubmit}
                />

                <TeamModes
                    allAllowedChecked={allAllowedChecked}
                    allowedDomainsChecked={allowedDomainsChecked}
                    allowedDomains={allowedDomains}
                    syncChecked={syncChecked}
                    onToggle={this.setToggles}
                    isDisabled={this.props.isDisabled}
                    isLicensedForLDAPGroups={isLicensedForLDAPGroups}
                />

                {isLicensedForLDAPGroups &&
                    <TeamGroups
                        syncChecked={syncChecked}
                        team={team}
                        groups={groups}
                        removedGroups={removedGroups}
                        totalGroups={totalGroups}
                        onAddCallback={this.handleGroupChange}
                        onGroupRemoved={this.handleGroupRemoved}
                        setNewGroupRole={this.setNewGroupRole}
                        isDisabled={this.props.isDisabled}
                    />
                }

                {!syncChecked &&
                    <TeamMembers
                        onRemoveCallback={this.addUserToRemove}
                        onAddCallback={this.addUsersToAdd}
                        usersToRemove={this.state.usersToRemove}
                        usersToAdd={this.state.usersToAdd}
                        updateRole={this.addRolesToUpdate}
                        teamId={this.props.teamID}
                        isDisabled={this.props.isDisabled}
                    />
                }
            </>
        );

        return (
            <div className='wrapper--fixed'>
                <AdminHeader withBackButton={true}>
                    <div>
                        <BlockableLink
                            to='/admin_console/user_management/teams'
                            className='fa fa-angle-left back'
                        />
                        <FormattedMessage
                            id='admin.team_settings.team_detail.group_configuration'
                            defaultMessage='Team Configuration'
                        />
                    </div>
                </AdminHeader>

                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <TeamProfile
                            team={team}
                            onToggleArchive={this.onToggleArchive}
                            isArchived={isLocalArchived}
                            isDisabled={this.props.isDisabled}
                            saveNeeded={this.state.saveNeeded}
                        />
                        <ConfirmModal
                            show={showArchiveConfirmModal}
                            title={
                                <FormattedMessage
                                    id='admin.team_settings.team_detail.archive_confirm.title'
                                    defaultMessage='Save and Archive Team'
                                />
                            }
                            message={
                                <FormattedMessage
                                    id='admin.team_settings.team_detail.archive_confirm.message'
                                    defaultMessage={'Archiving will remove the team from the user interface but it\'s contents remain in the database and may still be accessible with the API. Are you sure you wish to save and archive this team?'}
                                />
                            }
                            confirmButtonText={
                                <FormattedMessage
                                    id='admin.team_settings.team_detail.archive_confirm.button'
                                    defaultMessage='Archive'
                                />
                            }
                            onConfirm={this.handleSubmit}
                            onCancel={this.hideArchiveConfirmModal}
                        />
                        {!isLocalArchived && nonArchivedContent}
                    </div>
                </div>

                <SaveChangesPanel
                    saving={saving}
                    cancelLink='/admin_console/user_management/teams'
                    saveNeeded={saveNeeded}
                    onClick={this.onSave}
                    serverError={serverError}
                    isDisabled={this.props.isDisabled}
                />
            </div>
        );
    };
}
