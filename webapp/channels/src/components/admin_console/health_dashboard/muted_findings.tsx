// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';
import type {HealthFinding} from '@mattermost/types/health';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';

import {EmptyState} from './empty_state';
import FindingGroups from './finding_groups';
import type {RowState} from './finding_section';
import type {GroupBy} from './group_by_control';

type Props = RowState & {
    findings: HealthFinding[];
    groupBy: GroupBy;
};

const MutedFindings = ({findings, groupBy, ...rowState}: Props) => {
    const dispatch = useDispatch();

    useEffect(() => {
        const mutedBy = findings.flatMap((finding) => finding.muted_by || []);
        if (mutedBy.length) {
            dispatch(getMissingProfilesByIds(mutedBy));
        }
    }, [dispatch, findings]);

    return (
        <>
            <p className='HealthDashboard__mutedNote'>
                <InformationOutlineIcon
                    size={18}
                    color='currentColor'
                    aria-hidden={true}
                />
                <FormattedMessage
                    id='admin.health_dashboard.muted.note'
                    defaultMessage='Muted findings are hidden from the open list for every admin, and they keep being checked. A different problem with the same check is still reported. Unmute a finding to return it to the open list.'
                />
            </p>
            {findings.length === 0 ? (
                <EmptyState
                    title={
                        <FormattedMessage
                            id='admin.health_dashboard.muted.empty.title'
                            defaultMessage='No muted findings'
                        />
                    }
                    body={
                        <FormattedMessage
                            id='admin.health_dashboard.muted.empty.body'
                            defaultMessage='Findings muted by any admin are listed here, with who muted them and when.'
                        />
                    }
                />
            ) : (
                <FindingGroups
                    findings={findings}
                    groupBy={groupBy}
                    expandAll={true}
                    {...rowState}
                />
            )}
        </>
    );
};

export default MutedFindings;
