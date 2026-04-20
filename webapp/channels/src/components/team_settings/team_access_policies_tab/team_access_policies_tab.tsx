// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlPolicy, AccessControlPolicyActiveUpdate} from '@mattermost/types/access_control';
import type {ChannelSearchOpts} from '@mattermost/types/channels';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {JobTypeBase} from '@mattermost/types/jobs';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import PolicyList from 'components/admin_console/access_control/policies';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

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

const TeamAccessPoliciesTab = ({team, accessControlSettings, setAreThereUnsavedChanges, showTabSwitchError, actions}: Props) => {
    const [view, setView] = useState<ViewState>('list');
    const [selectedPolicyId, setSelectedPolicyId] = useState<string | undefined>(undefined);
    const [refreshKey, setRefreshKey] = useState(0);

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

    if (view === 'create' || view === 'edit') {
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
        </div>
    );
};

export default TeamAccessPoliciesTab;
