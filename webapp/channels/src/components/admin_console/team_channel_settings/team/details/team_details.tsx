// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlPolicy, AccessControlPolicyRule} from '@mattermost/types/access_control';
import {getMembershipRule, buildRulesWithMembership} from '@mattermost/types/access_control';
import {SyncableType} from '@mattermost/types/groups';
import type {Group, SyncablePatch} from '@mattermost/types/groups';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BlockableLink from 'components/admin_console/blockable_link';
import ConfirmModal from 'components/confirm_modal';
import FormError from 'components/form_error';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {getHistory} from 'utils/browser_history';
import Constants from 'utils/constants';

import {TeamAccessControl} from './team_access_control_policy';
import {TeamGroups} from './team_groups';
import TeamLevelAccessRules from './team_level_access_rules';
import TeamMembers from './team_members/index';
import TeamMembershipSyncFooter from './team_membership_sync_footer';
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
    abacSupported?: boolean;
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
        getTeamAccessControlPolicy: (teamId: string) => Promise<ActionResult>;
        getAccessControlPolicy: (id: string) => Promise<ActionResult>;
        assignTeamToAccessControlPolicy: (policyId: string, teamId: string) => Promise<ActionResult>;
        unassignTeamsFromAccessControlPolicy: (policyId: string, teamIds: string[]) => Promise<ActionResult>;
        searchPolicies: (term: string, type: string, after: string, limit: number) => Promise<ActionResult>;
        updateAccessControlPoliciesActive: (states: Array<{id: string; active: boolean}>) => Promise<ActionResult>;
        createAccessControlTeamSyncJob: (data: {policy_id?: string}) => Promise<ActionResult>;
        getTeamStats: (teamId: string) => Promise<ActionResult>;
        saveTeamAccessPolicy: (policy: AccessControlPolicy) => Promise<ActionResult>;
        getAccessControlFields: (after: string, limit: number) => Promise<ActionResult>;
        searchUsersForExpression: (expression: string, term: string, after: string, limit: number, channelId?: string, teamId?: string) => Promise<ActionResult>;
    };
};

type State = {
    name: string;
    description: string;
    nameError?: React.ReactNode;
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
    policyEnforced: boolean;
    accessControlPolicies: AccessControlPolicy[];
    accessControlPoliciesToRemove: string[];

    // Ids of the policies already assigned on the server when the page loaded.
    originalPolicyIds: string[];

    showAbacSaveConfirm: boolean;
    abacAffectedCount: number | null;
    abacQualifyingCount: number | null;

    // Team-level access rules state
    teamRulesExpression: string;
    teamRulesOriginalExpression: string;
    teamRulesExistingRules: AccessControlPolicyRule[];
    teamRulesAutoSync: boolean;
    teamRulesOriginalAutoSync: boolean;
    teamRulesHaveChanges: boolean;
    userAttributes: UserPropertyField[];
    attributesLoaded: boolean;
};

export default class TeamDetails extends React.PureComponent<Props, State> {
    static defaultProps = {
        team: {display_name: '', id: ''} as Team,
    };

    constructor(props: Props) {
        super(props);
        const team = props.team;
        this.state = {
            name: team?.display_name || '',
            description: team?.description || '',
            nameError: undefined,
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
            policyEnforced: Boolean(team?.policy_enforced),
            accessControlPolicies: [],
            accessControlPoliciesToRemove: [],
            originalPolicyIds: [],
            showAbacSaveConfirm: false,
            abacAffectedCount: null,
            abacQualifyingCount: null,

            // Team-level access rules state
            teamRulesExpression: '',
            teamRulesOriginalExpression: '',
            teamRulesExistingRules: [],
            teamRulesAutoSync: false,
            teamRulesOriginalAutoSync: false,
            teamRulesHaveChanges: false,
            userAttributes: [],
            attributesLoaded: false,
        };
    }

    componentDidUpdate(prevProps: Props) {
        const {totalGroups, team} = this.props;
        const teamChanged = prevProps.team?.id !== team?.id;
        const policyEnforcedChanged = team?.policy_enforced !== prevProps.team?.policy_enforced;
        if (teamChanged) {
            this.setState({
                totalGroups,
                name: team?.display_name || '',
                description: team?.description || '',
                nameError: undefined,
                syncChecked: Boolean(team?.group_constrained),
                allAllowedChecked: Boolean(team?.allow_open_invite),
                allowedDomainsChecked: Boolean(team?.allowed_domains),
                allowedDomains: team?.allowed_domains || '',
                isLocalArchived: team ? team.delete_at > 0 : true,
                policyEnforced: Boolean(team?.policy_enforced),
            });
            if (this.props.abacSupported && team?.id) {
                this.loadUserAttributes();
                this.fetchAccessControlPolicies(team.id);
            }
        } else if (policyEnforcedChanged) {
            // Prop-driven policy_enforced change while the team is unchanged.
            this.setState({policyEnforced: Boolean(team?.policy_enforced)});
        } else if (totalGroups !== prevProps.totalGroups) {
            // getGroups resolving after mount must update the count without
            // recomputing form fields and clobbering unsaved edits.
            this.setState({totalGroups});
        }
    }

    componentDidMount() {
        const {teamID, actions} = this.props;
        actions.getTeam(teamID).
            then(() => actions.getGroups(teamID)).
            then(() => this.setState({groups: this.props.groups}));
        if (this.props.abacSupported) {
            this.loadUserAttributes();
            this.fetchAccessControlPolicies(teamID);
        }
    }

    private loadUserAttributes = async () => {
        if (this.state.attributesLoaded) {
            return;
        }
        try {
            const result = await this.props.actions.getAccessControlFields('', 100);
            if (result.error) {
                this.setState({userAttributes: [], attributesLoaded: true});
                return;
            }
            let attributes: UserPropertyField[] = [];
            if (result.data && Array.isArray(result.data)) {
                attributes = result.data;
            } else if (result.data && result.data.fields && Array.isArray(result.data.fields)) {
                attributes = result.data.fields;
            } else if (result.data && result.data.attributes && Array.isArray(result.data.attributes)) {
                attributes = result.data.attributes;
            } else if (Array.isArray(result)) {
                attributes = result as UserPropertyField[];
            }
            this.setState({userAttributes: attributes, attributesLoaded: true});
        } catch {
            this.setState({userAttributes: [], attributesLoaded: true});
        }
    };

    private fetchAccessControlPolicies = (teamId: string) => {
        if (!teamId) {
            return;
        }

        this.props.actions.getTeamAccessControlPolicy(teamId).then((result) => {
            if (!result.data) {
                return;
            }

            const {policy, enforced} = result.data as {policy: AccessControlPolicy | null; enforced: boolean};
            if (!policy) {
                this.setState({accessControlPolicies: [], policyEnforced: enforced, originalPolicyIds: []});
                return;
            }

            // Extract team-level rules and auto-sync from the child policy regardless of imports.
            const membershipRule = getMembershipRule(policy.rules);
            const rulesExpression = membershipRule?.expression || '';
            const autoSync = policy.active ?? false;

            this.setState({
                teamRulesExpression: rulesExpression,
                teamRulesOriginalExpression: rulesExpression,
                teamRulesExistingRules: policy.rules || [],
                teamRulesAutoSync: autoSync,
                teamRulesOriginalAutoSync: autoSync,
                teamRulesHaveChanges: false,
            });

            const parentIds = policy.imports || [];
            if (parentIds.length === 0) {
                this.setState({accessControlPolicies: [], policyEnforced: enforced, originalPolicyIds: []});
                return;
            }

            Promise.all(parentIds.map((policyId) =>
                this.props.actions.getAccessControlPolicy(policyId).then((policyResult) => {
                    if (policyResult.error) {
                        throw new Error(policyResult.error.message || 'Failed to fetch policy');
                    }
                    return policyResult.data as AccessControlPolicy;
                }),
            )).then((policies) => {
                this.setState({
                    accessControlPolicies: policies,
                    policyEnforced: enforced,
                    originalPolicyIds: policies.map((p) => p.id),
                });
            });
        });
    };

    private handleTeamRulesChange = (hasChanges: boolean, expression: string, autoSync: boolean) => {
        const hasRealTeamRulesChanges = hasChanges && (
            expression !== this.state.teamRulesOriginalExpression ||
            autoSync !== this.state.teamRulesOriginalAutoSync
        );

        this.setState({
            teamRulesExpression: expression,
            teamRulesAutoSync: autoSync,
            teamRulesHaveChanges: hasChanges,
            policyEnforced: true,
        });

        if (hasRealTeamRulesChanges) {
            this.setState({saveNeeded: true});
            this.props.actions.setNavigationBlocked(true);
        }
    };

    setPolicyEnforced = (policyEnforced: boolean) => {
        this.setState({policyEnforced, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    onPolicySelected = (policy: AccessControlPolicy, autoAdd?: boolean) => {
        const {accessControlPolicies} = this.state;
        if (accessControlPolicies.find((p) => p.id === policy.id)) {
            return;
        }

        // The team child policy carries a single auto-add flag (teamRulesAutoSync,
        // persisted as the child's active). Seed it from the checkbox chosen in the
        // selection modal, which itself defaults to the parent policy's own active.
        // The parent policy is never modified — only the team child's flag changes.
        this.setState({
            accessControlPolicies: [...accessControlPolicies, policy],
            policyEnforced: true,
            saveNeeded: true,
            teamRulesAutoSync: autoAdd === undefined ? this.state.teamRulesAutoSync : autoAdd,
        });
        this.props.actions.setNavigationBlocked(true);
    };

    onAutoAddChange = (autoAdd: boolean) => {
        // Toggle auto-add on an already-linked team from the Membership policies
        // list. Updates only the team child's flag (teamRulesAutoSync → child
        // active on save); the linked parent policy is left untouched.
        this.setState({
            teamRulesAutoSync: autoAdd,
            policyEnforced: true,
            saveNeeded: true,
        });
        this.props.actions.setNavigationBlocked(true);
    };

    onPolicyRemove = (policyId: string) => {
        const {accessControlPolicies, accessControlPoliciesToRemove} = this.state;
        this.setState({
            accessControlPoliciesToRemove: [...accessControlPoliciesToRemove, policyId],
            accessControlPolicies: accessControlPolicies.filter((policy) => policy.id !== policyId),
            saveNeeded: true,
        });
        this.props.actions.setNavigationBlocked(true);
    };

    onPolicyRemoveAll = () => {
        const {accessControlPolicies, accessControlPoliciesToRemove} = this.state;
        this.setState({
            accessControlPoliciesToRemove: [...accessControlPoliciesToRemove, ...accessControlPolicies.map((p) => p.id)],
            accessControlPolicies: [],
            saveNeeded: true,
        });
        this.props.actions.setNavigationBlocked(true);
    };

    handleNameChange = (name: string) => {
        this.setState({name, nameError: undefined, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    handleDescriptionChange = (description: string) => {
        this.setState({description, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    setNewGroupRole = (gid: string) => {
        const groups = cloneDeep(this.state.groups).map((g) => {
            if (g.id === gid) {
                g.scheme_admin = !g.scheme_admin;
            }
            return g;
        });
        this.processGroupsChange(groups);
    };

    getTeamNameError = (): React.ReactNode => {
        if (this.state.name.trim().length < Constants.MIN_TEAMNAME_LENGTH) {
            return (
                <FormattedMessage
                    id='admin.team_settings.team_detail.teamNameRestrictions'
                    defaultMessage='Team name must be {min} or more characters up to a maximum of {max}.'
                    values={{min: Constants.MIN_TEAMNAME_LENGTH, max: Constants.MAX_TEAMNAME_LENGTH}}
                />
            );
        }
        return undefined;
    };

    handleSubmit = async () => {
        const {team, groups: origGroups, teamID, actions} = this.props;
        if (!team) {
            return;
        }

        this.setState({showRemoveConfirmation: false, showArchiveConfirmModal: false, saving: true});
        const {name, description, groups, allAllowedChecked, allowedDomainsChecked, allowedDomains, syncChecked, usersToAdd, usersToRemove, rolesToUpdate} = this.state;

        let serverError: JSX.Element | undefined;

        const nameError = this.getTeamNameError();
        if (nameError) {
            this.setState({nameError, saving: false, saveNeeded: true});
            actions.setNavigationBlocked(true);
            return;
        }

        if (this.teamToBeArchived()) {
            let saveNeeded = false;
            const patchTeamResult = await actions.patchTeam({
                ...team,
                display_name: name.trim(),
                description,
            });
            if (patchTeamResult.error) {
                serverError = <FormError error={patchTeamResult.error?.message}/>;
                saveNeeded = true;
                this.setState({serverError, saving: false, saveNeeded, usersToRemoveCount: 0, rolesToUpdate: {}, usersToAdd: {}, usersToRemove: {}});
                actions.setNavigationBlocked(saveNeeded);
                return;
            }

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
            const patchTeamSyncable = groups.
                filter((g) => {
                    return origGroups.some((group) => group.id === g.id && group.scheme_admin !== g.scheme_admin);
                }).
                map((g) => actions.patchGroupSyncable(g.id, teamID, SyncableType.Team, {scheme_admin: g.scheme_admin}));

            const link = groups.
                filter((g) => {
                    return !origGroups.some((group) => group.id === g.id);
                }).
                map((g) => actions.linkGroupSyncable(g.id, teamID, SyncableType.Team, {auto_add: true, scheme_admin: g.scheme_admin}));

            const groupResult = await Promise.all([...patchTeamSyncable, ...link]);
            const groupResultWithError = groupResult.find((r) => r.error);

            if (groupResultWithError) {
                serverError = <FormError error={groupResultWithError.error?.message}/>;
            }

            const patchTeamResult = await actions.patchTeam({
                ...team,
                display_name: name.trim(),
                description,
                group_constrained: syncChecked,
                allowed_domains: allowedDomainsChecked ? allowedDomains : '',
                allow_open_invite: allAllowedChecked,
            });

            if (patchTeamResult.error) {
                serverError = <FormError error={patchTeamResult.error?.message}/>;
            }

            const unlink = origGroups.
                filter((g) => {
                    return !groups.some((group) => group.id === g.id);
                }).
                map((g) => actions.unlinkGroupSyncable(g.id, teamID, SyncableType.Team));

            let unlinkResultWithError: ActionResult | undefined;
            if (unlink.length > 0) {
                const unlinkResult = await Promise.all(unlink);
                unlinkResultWithError = unlinkResult.find((r) => r.error);
                if (unlinkResultWithError) {
                    serverError = <FormError error={unlinkResultWithError.error?.message}/>;
                }
            }

            if (!patchTeamResult.error && !groupResultWithError && !unlinkResultWithError) {
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
                if (resultWithError) {
                    serverError = <FormError error={resultWithError.error?.message}/>;
                }
            }

            if (removeUserActions.length > 0) {
                const result = await Promise.all(removeUserActions);
                const resultWithError = result.find((r) => r.error);
                if (resultWithError) {
                    serverError = <FormError error={resultWithError.error?.message}/>;
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
                if (resultWithError) {
                    serverError = <FormError error={resultWithError.error?.message}/>;
                }
            }

            if (rolesToDemote.length > 0) {
                const result = await Promise.all(rolesToDemote);
                const resultWithError = result.find((r) => r.error);
                if (resultWithError) {
                    serverError = <FormError error={resultWithError.error?.message}/>;
                }
            }
        }

        if (this.props.abacSupported) {
            const {policyEnforced, accessControlPolicies, accessControlPoliciesToRemove, teamRulesExpression, teamRulesAutoSync, teamRulesHaveChanges, teamRulesExistingRules} = this.state;

            // Allow save when there are custom rules even without parent policies.
            const hasTeamRules = teamRulesExpression && teamRulesExpression.trim().length > 0;
            const hasParentPolicies = accessControlPolicies.length > 0;

            if (policyEnforced && !hasTeamRules && !hasParentPolicies) {
                serverError = (
                    <FormError
                        error={
                            <FormattedMessage
                                id='admin.team_settings.team_detail.policy_required_error'
                                defaultMessage='You must select a membership policy or define custom access rules when attribute based team access is enabled.'
                            />}
                    />
                );
                saveNeeded = true;
                this.setState({serverError, saving: false, saveNeeded, showAbacSaveConfirm: false});
                actions.setNavigationBlocked(saveNeeded);
                return;
            }

            // Assign only policies not already on the server.
            const policiesToAssign = accessControlPolicies.filter((policy) => !this.state.originalPolicyIds.includes(policy.id));
            if (policiesToAssign.length > 0) {
                const result = await Promise.all(
                    policiesToAssign.map((policy) =>
                        actions.assignTeamToAccessControlPolicy(policy.id, teamID),
                    ),
                );
                const resultWithError = result.find((r) => r.error);
                if (resultWithError) {
                    serverError = <FormError error={resultWithError.error?.message}/>;
                    saveNeeded = true;
                }
            }

            if (accessControlPoliciesToRemove.length > 0) {
                const result = await Promise.all(
                    accessControlPoliciesToRemove.map((policyId) =>
                        actions.unassignTeamsFromAccessControlPolicy(policyId, [teamID]),
                    ),
                );
                const resultWithError = result.find((r) => r.error);
                if (resultWithError) {
                    serverError = <FormError error={resultWithError.error?.message}/>;
                    saveNeeded = true;
                }
            }

            // Save the team-level rules policy when rules have changes or there are parent policies.
            if (!saveNeeded && policyEnforced && (teamRulesHaveChanges || hasParentPolicies)) {
                try {
                    const teamPolicy: AccessControlPolicy = {
                        id: teamID,
                        name: team.display_name || teamID,
                        type: 'team',
                        revision: 1,
                        created_at: Date.now(),
                        active: false,
                        imports: accessControlPolicies.map((p) => p.id),
                        rules: buildRulesWithMembership(teamRulesExistingRules, teamRulesExpression),
                    };

                    const policyResult = await actions.saveTeamAccessPolicy(teamPolicy);
                    if ('error' in policyResult) {
                        serverError = <FormError error={policyResult.error.message}/>;
                        saveNeeded = true;
                    } else {
                        const activeResult = await actions.updateAccessControlPoliciesActive([{id: teamID, active: teamRulesAutoSync}]);
                        if (activeResult.error) {
                            serverError = <FormError error={activeResult.error?.message}/>;
                            saveNeeded = true;
                        }

                        // Kick an immediate reconcile so membership changes apply on
                        // save rather than waiting for the hourly scheduler. The sync
                        // worker decides removal vs. add by team privacy and the
                        // policy's active flag, so this must fire whenever an enforced
                        // policy is saved — custom rules OR a linked parent policy —
                        // not only when auto-add is on; otherwise non-qualifying
                        // members linger on strict teams until the periodic scheduler
                        // runs. On advisory (public) teams the worker no-ops.
                        if (!saveNeeded && (hasTeamRules || hasParentPolicies || teamRulesAutoSync)) {
                            await actions.createAccessControlTeamSyncJob({policy_id: teamID});
                        }

                        if (!saveNeeded) {
                            this.setState({
                                teamRulesOriginalExpression: teamRulesExpression,
                                teamRulesOriginalAutoSync: teamRulesAutoSync,
                                teamRulesHaveChanges: false,
                                originalPolicyIds: accessControlPolicies.map((p) => p.id),
                            });
                        }
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    serverError = <FormError error={message || 'Failed to save team access rules'}/>;
                    saveNeeded = true;
                }
            } else if (!saveNeeded && policyEnforced && !teamRulesHaveChanges) {
                // auto-add flag may have changed independently via a future toggle; update active status.
                const autoSyncChanged = teamRulesAutoSync !== this.state.teamRulesOriginalAutoSync;
                if (autoSyncChanged) {
                    const activeResult = await actions.updateAccessControlPoliciesActive([{id: teamID, active: teamRulesAutoSync}]);
                    if (activeResult.error) {
                        serverError = <FormError error={activeResult.error?.message}/>;
                        saveNeeded = true;
                    }
                    if (!saveNeeded && teamRulesAutoSync && !this.state.teamRulesOriginalAutoSync) {
                        await actions.createAccessControlTeamSyncJob({policy_id: teamID});
                    }
                }
            }
        }

        this.setState({
            usersToRemoveCount: 0,
            rolesToUpdate: {},
            usersToAdd: {},
            usersToRemove: {},
            accessControlPoliciesToRemove: serverError ? this.state.accessControlPoliciesToRemove : [],
            serverError,
            saving: false,
            saveNeeded,
            showAbacSaveConfirm: false,
            abacAffectedCount: null,
            abacQualifyingCount: null,
        }, () => {
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

    // Combine the team's own membership expression with the expressions of any
    // linked parent policies, ANDed together. The ad-hoc searchUsersForExpression
    // endpoint does NOT resolve imports server-side, so the effective expression
    // must be assembled here (mirrors the sync job and the channel access-rules tab).
    private combineTeamAndPolicyExpressions = (teamExpression: string): string => {
        const parentExpressions = this.state.accessControlPolicies.
            map((policy) => getMembershipRule(policy.rules)?.expression).
            filter((expr): expr is string => Boolean(expr && expr.trim()));

        const allExpressions: string[] = [];
        if (teamExpression.trim()) {
            allExpressions.push(teamExpression.trim());
        }
        allExpressions.push(...parentExpressions);

        if (allExpressions.length === 0) {
            return '';
        }
        if (allExpressions.length === 1) {
            return allExpressions[0]!;
        }
        return allExpressions.map((expr) => `(${expr})`).join(' && ');
    };

    onSave = async () => {
        const nameError = this.getTeamNameError();
        if (nameError) {
            this.setState({nameError, saveNeeded: true});
            this.props.actions.setNavigationBlocked(true);
            return;
        }

        if (this.teamToBeArchived()) {
            this.setState({showArchiveConfirmModal: true});
            return;
        }
        if (this.state.usersToRemoveCount > 0) {
            this.setState({showRemoveConfirmation: true});
            return;
        }

        const hasAbacChanges = this.props.abacSupported && this.state.policyEnforced && (
            this.state.accessControlPolicies.some((p) => !this.state.originalPolicyIds.includes(p.id)) ||
            this.state.accessControlPoliciesToRemove.length > 0 ||
            this.state.teamRulesHaveChanges
        );

        if (hasAbacChanges) {
            let affectedCount: number | null = null;
            let qualifyingCount: number | null = null;
            try {
                const statsResult = await this.props.actions.getTeamStats(this.props.teamID);
                const totalMembers = (statsResult?.data as {total_member_count?: number} | null)?.total_member_count ?? null;
                const effectiveExpression = this.combineTeamAndPolicyExpressions(this.state.teamRulesExpression ?? '');
                if (totalMembers !== null && effectiveExpression.trim()) {
                    const exprResult = await this.props.actions.searchUsersForExpression(
                        effectiveExpression,
                        '',
                        '',
                        1,
                        undefined,
                        this.props.teamID,
                    );
                    const qualifying = (exprResult?.data as {total?: number} | null)?.total ?? null;
                    qualifyingCount = qualifying;
                    affectedCount = qualifying === null ? totalMembers : totalMembers - qualifying;
                } else {
                    affectedCount = totalMembers;
                }
            } catch {
                affectedCount = null;
                qualifyingCount = null;
            }
            this.setState({showAbacSaveConfirm: true, abacAffectedCount: affectedCount, abacQualifyingCount: qualifyingCount});
            return;
        }

        this.handleSubmit();
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
            newState.previousServerError = serverError;
            newState.serverError = undefined;
        } else {
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

        const {totalGroups, saving, saveNeeded, serverError, groups, allAllowedChecked, allowedDomainsChecked, allowedDomains, syncChecked, showRemoveConfirmation, usersToRemoveCount, isLocalArchived, showArchiveConfirmModal, showAbacSaveConfirm, abacAffectedCount, abacQualifyingCount} = this.state;
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
                    abacSupported={this.props.abacSupported}
                    policyEnforced={this.state.policyEnforced}
                    policyEnforcedToggleAvailable={this.state.accessControlPolicies.length === 0}
                    onPolicyEnforcedToggle={this.setPolicyEnforced}
                />

                {this.props.abacSupported && this.state.policyEnforced && (
                    <>
                        <TeamAccessControl
                            parentPolicies={this.state.accessControlPolicies}
                            autoAddMembers={this.state.teamRulesAutoSync}
                            actions={{
                                onPolicySelected: this.onPolicySelected,
                                onPolicyRemove: this.onPolicyRemove,
                                onAutoAddChange: this.onAutoAddChange,
                                searchPolicies: this.props.actions.searchPolicies,
                            }}
                        />

                        <TeamLevelAccessRules
                            team={team}
                            userAttributes={this.state.userAttributes}
                            onRulesChange={this.handleTeamRulesChange}
                            initialExpression={this.state.teamRulesExpression}
                            initialAutoSync={this.state.teamRulesAutoSync}
                            isDisabled={this.props.isDisabled}
                            syncFooter={
                                <TeamMembershipSyncFooter
                                    teamId={this.props.teamID}
                                    hasAbacPolicy={true}
                                />
                            }
                        />
                    </>
                )}

                {isLicensedForLDAPGroups && !this.state.policyEnforced &&
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
                            name={this.state.name}
                            description={this.state.description}
                            nameError={this.state.nameError}
                            onNameChange={this.handleNameChange}
                            onDescriptionChange={this.handleDescriptionChange}
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
                        <ConfirmModal
                            show={showAbacSaveConfirm}
                            title={
                                <FormattedMessage
                                    id='admin.team_settings.team_detail.save_confirm.title'
                                    defaultMessage='Apply membership policy'
                                />
                            }
                            message={
                                <div>
                                    {abacQualifyingCount === 0 && !team.allow_open_invite && (
                                        <p className='text-warning'>
                                            <FormattedMessage
                                                id='admin.team_settings.team_detail.save_confirm.empty_team_warning'
                                                defaultMessage='Warning: No current members meet the criteria. Saving may result in an empty private team.'
                                            />
                                        </p>
                                    )}
                                    {abacQualifyingCount !== 0 && abacAffectedCount !== null && abacAffectedCount > 0 && (
                                        <p>
                                            <FormattedMessage
                                                id='admin.team_settings.team_detail.save_confirm.body'
                                                defaultMessage='{count} {count, plural, one {member does} other {members do}} not currently meet the criteria and will be affected at next sync.'
                                                values={{count: abacAffectedCount}}
                                            />
                                        </p>
                                    )}
                                    <p>
                                        <FormattedMessage
                                            id='admin.team_settings.team_detail.save_confirm.question'
                                            defaultMessage='Are you sure you want to apply the membership policy?'
                                        />
                                    </p>
                                </div>
                            }
                            confirmButtonText={
                                <FormattedMessage
                                    id='admin.team_settings.team_detail.save_confirm.confirm'
                                    defaultMessage='Apply'
                                />
                            }
                            cancelButtonText={
                                <FormattedMessage
                                    id='admin.team_settings.team_detail.save_confirm.cancel'
                                    defaultMessage='Cancel'
                                />
                            }
                            onConfirm={this.handleSubmit}
                            onCancel={() => this.setState({showAbacSaveConfirm: false, abacAffectedCount: null, abacQualifyingCount: null, saving: false})}
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
