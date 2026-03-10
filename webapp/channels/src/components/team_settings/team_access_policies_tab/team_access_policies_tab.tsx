// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import PolicyList from 'components/admin_console/access_control/policies';

import './team_access_policies_tab.scss';

type Props = {
    team: Team;
    actions: {
        searchTeamPolicies: (teamId: string, term: string, type: string, after: string, limit: number) => Promise<ActionResult>;
    };
};

const TeamAccessPoliciesTab = ({team, actions}: Props) => {
    const {formatMessage} = useIntl();
    const [refreshKey, setRefreshKey] = useState(0);

    const searchPolicies = useCallback(
        (term: string, type: string, after: string, limit: number) => {
            return actions.searchTeamPolicies(team.id, term, type, after, limit);
        },
        [actions, team.id],
    );

    const deletePolicy = useCallback(async () => ({data: true} as ActionResult), []);

    const policyActions = useMemo(() => ({
        searchPolicies,
        deletePolicy,
    }), [searchPolicies, deletePolicy]);

    const handlePolicySelected = useCallback(() => {
        // Read-only for now; future stories will add navigation to policy detail
    }, []);

    const handleRefresh = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

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
                        defaultMessage='Access policies'
                    />
                </h4>
                <div className='TeamAccessPoliciesTab__header-actions'>
                    <button
                        className='TeamAccessPoliciesTab__refresh-btn style--none'
                        onClick={handleRefresh}
                        aria-label={formatMessage({id: 'team_settings.access_policies.refresh', defaultMessage: 'Refresh list'})}
                        title={formatMessage({id: 'team_settings.access_policies.refresh', defaultMessage: 'Refresh list'})}
                    >
                        <i className='icon icon-refresh'/>
                    </button>
                    <button
                        className='btn btn-primary TeamAccessPoliciesTab__add-btn'
                        disabled={true}
                        title={formatMessage({id: 'team_settings.access_policies.add_coming_soon', defaultMessage: 'Coming soon'})}
                    >
                        <i className='icon icon-plus'/>
                        <FormattedMessage
                            id='team_settings.access_policies.add_policy'
                            defaultMessage='Add policy'
                        />
                    </button>
                </div>
            </div>
            <PolicyList
                key={refreshKey}
                simpleMode={true}
                actions={policyActions}
                onPolicySelected={handlePolicySelected}
            />
        </div>
    );
};

export default TeamAccessPoliciesTab;
