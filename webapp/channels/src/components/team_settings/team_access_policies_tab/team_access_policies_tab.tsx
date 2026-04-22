// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AccessControlPolicy, AccessControlPolicyActiveUpdate, AccessControlPolicyRule} from '@mattermost/types/access_control';
import {getMembershipRule, buildRulesWithMembership} from '@mattermost/types/access_control';
import type {ChannelSearchOpts} from '@mattermost/types/channels';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {JobTypeBase} from '@mattermost/types/jobs';
import type {UserPropertyField} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import PolicyList from 'components/admin_console/access_control/policies';
import SystemPolicyIndicator from 'components/system_policy_indicator';
import Toggle from 'components/toggle';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';

import SyncStatusFooter from './sync_status_footer';
import TeamPolicyEditor from './team_policy_editor';

import './team_access_policies_tab.scss';

type Props = {
    team: Team;
    accessControlSettings: AccessControlSettings;
    areThereUnsavedChanges: boolean;
    setAreThereUnsavedChanges: (unsaved: boolean) => void;
    showTabSwitchError: boolean;
    setShowTabSwitchError: (error: boolean) => void;
    actions: {
        searchTeamPolicies: (teamId: string, term: string, type: string, after: string, limit: number) => Promise<ActionResult>;
        fetchPolicy: (id: string, channelId?: string, teamId?: string) => Promise<ActionResult>;
        createPolicy: (policy: AccessControlPolicy, teamId?: string) => Promise<ActionResult>;
        deletePolicy: (id: string, teamId?: string) => Promise<ActionResult>;
        searchChannels: (id: string, term: string, opts: ChannelSearchOpts, teamId?: string) => Promise<ActionResult>;
        assignChannelsToAccessControlPolicy: (policyId: string, channelIds: string[], teamId?: string) => Promise<ActionResult>;
        unassignChannelsFromAccessControlPolicy: (policyId: string, channelIds: string[], teamId?: string) => Promise<ActionResult>;
        createJob: (job: JobTypeBase & {data: any}) => Promise<ActionResult>;
        updateAccessControlPoliciesActive: (states: AccessControlPolicyActiveUpdate[], teamId?: string) => Promise<ActionResult>;
    };
};

type ViewState = 'list' | 'create' | 'edit';
type SubTab = 'team_policy' | 'channel_policies';

const TeamAccessPoliciesTab = ({team, accessControlSettings, setAreThereUnsavedChanges, showTabSwitchError, actions}: Props) => {
    const {formatMessage} = useIntl();
    const [subTab, setSubTab] = useState<SubTab>('team_policy');
    const [view, setView] = useState<ViewState>('list');
    const [selectedPolicyId, setSelectedPolicyId] = useState<string | undefined>(undefined);
    const [refreshKey, setRefreshKey] = useState(0);

    // Team-level policy state (type: 'team', id = team.id)
    const abacActions = useChannelAccessControlActions(undefined, team.id);
    const [parentPolicies, setParentPolicies] = useState<AccessControlPolicy[]>([]);
    const [parentPoliciesLoading, setParentPoliciesLoading] = useState(true);
    const [teamExpression, setTeamExpression] = useState('');
    const [originalTeamExpression, setOriginalTeamExpression] = useState('');
    const [teamAutoSync, setTeamAutoSync] = useState(false);
    const [originalTeamAutoSync, setOriginalTeamAutoSync] = useState(false);
    const [teamPolicyLoaded, setTeamPolicyLoaded] = useState(false);
    const [userAttributes, setUserAttributes] = useState<UserPropertyField[]>([]);
    const [teamSaveState, setTeamSaveState] = useState<SaveChangesPanelState>();

    // Load team policy and user attributes on mount
    useEffect(() => {
        abacActions.getAccessControlFields('', 100).then((result: ActionResult) => {
            if (result.data) {
                setUserAttributes(result.data);
            }
        });

        actions.fetchPolicy(team.id, undefined, team.id).then(async (result: ActionResult) => {
            if (result.data) {
                const policy = result.data as AccessControlPolicy;
                const membershipRule = getMembershipRule(policy.rules);
                if (membershipRule) {
                    setTeamExpression(membershipRule.expression);
                    setOriginalTeamExpression(membershipRule.expression);
                }
                setTeamAutoSync(policy.active ?? false);
                setOriginalTeamAutoSync(policy.active ?? false);

                // Fetch parent policies if the team policy has imports
                if (policy.imports && policy.imports.length > 0) {
                    const parentResults = await Promise.all(
                        policy.imports.map((parentId: string) => actions.fetchPolicy(parentId, undefined, team.id)),
                    );
                    const parents: AccessControlPolicy[] = [];
                    for (const pr of parentResults) {
                        if (pr.data) {
                            parents.push(pr.data as AccessControlPolicy);
                        }
                    }
                    setParentPolicies(parents);
                }
            }
            setTeamPolicyLoaded(true);
            setParentPoliciesLoading(false);
        }).catch(() => {
            setTeamPolicyLoaded(true);
            setParentPoliciesLoading(false);
        });
    }, [team.id]);

    const teamPolicyHasChanges = teamExpression !== originalTeamExpression || teamAutoSync !== originalTeamAutoSync;

    const handleSaveTeamPolicy = useCallback(async () => {
        const rules: AccessControlPolicyRule[] = buildRulesWithMembership([], teamExpression);

        const policy: AccessControlPolicy = {
            id: team.id,
            name: `Team policy: ${team.display_name}`,
            type: 'team',
            version: 'v0.3',
            active: teamAutoSync,
            rules,
            imports: [],
            revision: 0,
            created_at: 0,
        };

        const result = await actions.createPolicy(policy, team.id);
        if (result.error) {
            setTeamSaveState('error');
            return;
        }

        await actions.updateAccessControlPoliciesActive([{id: team.id, active: teamAutoSync}], team.id);

        if (teamExpression.trim()) {
            await abacActions.createAccessControlSyncJob({policy_id: team.id, team_id: team.id});
        }

        setOriginalTeamExpression(teamExpression);
        setOriginalTeamAutoSync(teamAutoSync);
        setTeamSaveState('saved');
        setAreThereUnsavedChanges(false);
    }, [team.id, team.display_name, teamExpression, teamAutoSync, actions, abacActions, setAreThereUnsavedChanges]);

    const handleCancelTeamPolicy = useCallback(() => {
        setTeamExpression(originalTeamExpression);
        setTeamAutoSync(originalTeamAutoSync);
        setTeamSaveState(undefined);
        setAreThereUnsavedChanges(false);
    }, [originalTeamExpression, originalTeamAutoSync, setAreThereUnsavedChanges]);

    const searchPolicies = useCallback(
        (term: string, type: string, after: string, limit: number) => {
            return actions.searchTeamPolicies(team.id, term, type, after, limit);
        },
        [actions, team.id],
    );

    const teamDeletePolicy = useCallback(
        (id: string) => actions.deletePolicy(id, team.id),
        [actions, team.id],
    );

    const policyListActions = useMemo(() => ({
        searchPolicies,
        deletePolicy: teamDeletePolicy,
    }), [searchPolicies, teamDeletePolicy]);

    // Curry team.id into all editor actions
    const editorActions = useMemo(() => ({
        fetchPolicy: (id: string) => actions.fetchPolicy(id, undefined, team.id),
        createPolicy: (policy: AccessControlPolicy) => actions.createPolicy(policy, team.id),
        deletePolicy: (id: string) => actions.deletePolicy(id, team.id),
        searchChannels: (id: string, term: string, opts: ChannelSearchOpts) => actions.searchChannels(id, term, opts, team.id),
        assignChannelsToAccessControlPolicy: (policyId: string, channelIds: string[]) =>
            actions.assignChannelsToAccessControlPolicy(policyId, channelIds, team.id),
        unassignChannelsFromAccessControlPolicy: (policyId: string, channelIds: string[]) =>
            actions.unassignChannelsFromAccessControlPolicy(policyId, channelIds, team.id),
        createJob: actions.createJob,
        updateAccessControlPoliciesActive: (states: AccessControlPolicyActiveUpdate[]) =>
            actions.updateAccessControlPoliciesActive(states, team.id),

    // `actions` from connect() is stable — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [team.id]);

    const handlePolicySelected = useCallback((policy: AccessControlPolicy) => {
        setSelectedPolicyId(policy.id);
        setView('edit');
    }, []);

    const handleAddPolicy = useCallback(() => {
        setSelectedPolicyId(undefined);
        setView('create');
    }, []);

    const [hasPolicies, setHasPolicies] = useState(false);
    const handlePoliciesLoaded = useCallback((count: number) => setHasPolicies(count > 0), []);

    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleNavigateBack = useCallback((message?: string) => {
        setView('list');
        setSelectedPolicyId(undefined);
        setAreThereUnsavedChanges(false);
        setRefreshKey((prev) => prev + 1);
        if (message) {
            setSuccessMessage(message);
        }
    }, [setAreThereUnsavedChanges]);

    useEffect(() => {
        if (!successMessage) {
            return undefined;
        }
        const timer = setTimeout(() => setSuccessMessage(null), 2500);
        return () => clearTimeout(timer);
    }, [successMessage]);

    // Channel policy editor (create/edit) - full screen within the tab
    if (subTab === 'channel_policies' && (view === 'create' || view === 'edit')) {
        return (
            <div
                className='TeamAccessPoliciesTab user-settings'
                id='accessPoliciesSettings'
                aria-labelledby='access_policiesButton'
                role='tabpanel'
            >
                <TeamPolicyEditor
                    teamId={team.id}
                    policyId={selectedPolicyId}
                    accessControlSettings={accessControlSettings}
                    setAreThereUnsavedChanges={setAreThereUnsavedChanges}
                    showTabSwitchError={showTabSwitchError}
                    onNavigateBack={handleNavigateBack}
                    actions={editorActions}
                />
            </div>
        );
    }

    return (
        <div
            className='TeamAccessPoliciesTab user-settings'
            id='accessPoliciesSettings'
            aria-labelledby='access_policiesButton'
            role='tabpanel'
        >
            {/* Sub-tab navigation */}
            <div
                className='TeamAccessPoliciesTab__subtabs'
                style={{display: 'flex', gap: 0, borderBottom: '2px solid rgba(var(--center-channel-color-rgb), 0.08)', marginBottom: 20}}
            >
                <button
                    className={`btn btn-transparent TeamAccessPoliciesTab__subtab ${subTab === 'team_policy' ? 'active' : ''}`}
                    style={{
                        padding: '10px 20px',
                        fontSize: 14,
                        fontWeight: subTab === 'team_policy' ? 600 : 400,
                        color: subTab === 'team_policy' ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.64)',
                        borderBottom: subTab === 'team_policy' ? '2px solid var(--button-bg)' : '2px solid transparent',
                        marginBottom: -2,
                        borderRadius: 0,
                        background: 'none',
                    }}
                    onClick={() => setSubTab('team_policy')}
                >
                    {formatMessage({id: 'team_settings.subtab.team_policy', defaultMessage: 'Team Policy'})}
                </button>
                <button
                    className={`btn btn-transparent TeamAccessPoliciesTab__subtab ${subTab === 'channel_policies' ? 'active' : ''}`}
                    style={{
                        padding: '10px 20px',
                        fontSize: 14,
                        fontWeight: subTab === 'channel_policies' ? 600 : 400,
                        color: subTab === 'channel_policies' ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.64)',
                        borderBottom: subTab === 'channel_policies' ? '2px solid var(--button-bg)' : '2px solid transparent',
                        marginBottom: -2,
                        borderRadius: 0,
                        background: 'none',
                    }}
                    onClick={() => setSubTab('channel_policies')}
                >
                    {formatMessage({id: 'team_settings.subtab.channel_policies', defaultMessage: 'Channel Policies'})}
                </button>
            </div>

            {/* Team Policy sub-tab */}
            {subTab === 'team_policy' && (
                <div className='TeamAccessPoliciesTab__section'>
                    {!parentPoliciesLoading && parentPolicies.length > 0 && (
                        <div style={{marginBottom: 16}}>
                            <SystemPolicyIndicator
                                policies={parentPolicies}
                                resourceType='team'
                                showPolicyNames={true}
                                variant='detailed'
                            />
                        </div>
                    )}
                    <h4 className='TeamAccessPoliciesTab__title'>
                        <FormattedMessage
                            id='team_settings.team_policy.title'
                            defaultMessage='Team membership policy'
                        />
                    </h4>
                    <p
                        className='TeamAccessPoliciesTab__subtitle'
                        style={{fontSize: 13, color: 'rgba(var(--center-channel-color-rgb), 0.64)', marginBottom: 16}}
                    >
                        <FormattedMessage
                            id='team_settings.team_policy.subtitle'
                            defaultMessage='Define which users should be members of this team based on their attributes.'
                        />
                    </p>

                    {teamPolicyLoaded && userAttributes.length > 0 && (
                        <div className='TeamAccessPoliciesTab__editor'>
                            <TableEditor
                                value={teamExpression}
                                onChange={(expr) => {
                                    setTeamExpression(expr);
                                    setAreThereUnsavedChanges(true);
                                    setTeamSaveState(undefined);
                                }}
                                onParseError={() => {}}
                                userAttributes={userAttributes}
                                teamId={team.id}
                                actions={abacActions}
                                enableUserManagedAttributes={accessControlSettings?.EnableUserManagedAttributes || false}
                            />
                        </div>
                    )}

                    <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 16}}>
                        <Toggle
                            id='teamPolicyAutoSyncToggle'
                            ariaLabel={formatMessage({id: 'team_settings.team_policy.auto_sync', defaultMessage: 'Auto-add members'})}
                            size='btn-sm'
                            disabled={!teamExpression.trim()}
                            onToggle={() => {
                                setTeamAutoSync(!teamAutoSync);
                                setAreThereUnsavedChanges(true);
                                setTeamSaveState(undefined);
                            }}
                            toggled={teamAutoSync}
                            tabIndex={0}
                            toggleClassName='btn-toggle-primary'
                        />
                        <span style={{fontSize: 14, color: 'var(--center-channel-color)'}}>
                            {formatMessage({id: 'team_settings.team_policy.auto_sync', defaultMessage: 'Auto-add members based on rules'})}
                        </span>
                    </div>

                    {teamPolicyHasChanges && (
                        <SaveChangesPanel
                            handleSubmit={handleSaveTeamPolicy}
                            handleCancel={handleCancelTeamPolicy}
                            handleClose={() => setTeamSaveState(undefined)}
                            state={teamSaveState}
                        />
                    )}
                </div>
            )}

            {/* Channel Policies sub-tab */}
            {subTab === 'channel_policies' && (
                <>
                    <div className='TeamAccessPoliciesTab__header'>
                        <h4 className='TeamAccessPoliciesTab__title'>
                            <FormattedMessage
                                id='team_settings.access_policies.title'
                                defaultMessage='Channel membership policies'
                            />
                        </h4>
                        <button
                            className='btn btn-primary TeamAccessPoliciesTab__add-btn'
                            onClick={handleAddPolicy}
                        >
                            <i className='icon icon-plus'/>
                            <FormattedMessage
                                id='team_settings.access_policies.add_policy'
                                defaultMessage='Add policy'
                            />
                        </button>
                    </div>
                    <PolicyList
                        key={refreshKey}
                        hideHeader={true}
                        hideDeleteAction={true}
                        showRefreshButton={true}
                        actions={policyListActions}
                        onPolicySelected={handlePolicySelected}
                        onPoliciesLoaded={handlePoliciesLoaded}
                    />
                    <SyncStatusFooter
                        teamId={team.id}
                        hasPolicies={hasPolicies}
                    />
                    {successMessage && (
                        <SaveChangesPanel
                            handleSubmit={() => {}}
                            handleCancel={() => {}}
                            handleClose={() => setSuccessMessage(null)}
                            state={'saved'}
                            customSavedMessage={successMessage}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default TeamAccessPoliciesTab;
