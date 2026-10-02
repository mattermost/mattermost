// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {HealthFinding, HealthFindingFilter, HealthFindingList, HealthFindingSeverity} from '@mattermost/types/health';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AdminHeader from 'components/widgets/admin_console/admin_header';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {orderAreas} from './area';
import FindingList from './finding_list';
import SeveritySummary from './severity_summary';
import UnknownNotice from './unknown_notice';

import './health_dashboard.scss';

export type Props = {
    findingsByArea: Record<string, HealthFinding[]>;
    unknownFindings: HealthFinding[];
    severityCounts: Record<HealthFindingSeverity, number>;
    lastEvaluatedAt: number;
    actions: {
        getHealthFindings: (filter?: HealthFindingFilter) => Promise<ActionResult<HealthFindingList>>;
    };
};

const EmptyState = ({title, body}: {title: React.ReactNode; body: React.ReactNode}) => (
    <div className='HealthDashboard__empty'>
        <p className='HealthDashboard__emptyTitle'>{title}</p>
        <p>{body}</p>
    </div>
);

const HealthDashboard = ({findingsByArea, unknownFindings, severityCounts, lastEvaluatedAt, actions}: Props) => {
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        actions.getHealthFindings().then(({error}) => {
            setFailed(Boolean(error));
            setLoading(false);
        });
    }, [actions]);

    const areas = orderAreas(findingsByArea);

    let content;
    if (loading) {
        content = <LoadingSpinner/>;
    } else if (failed) {
        content = (
            <EmptyState
                title={
                    <FormattedMessage
                        id='admin.health_dashboard.error.title'
                        defaultMessage='Health findings could not be loaded'
                    />
                }
                body={
                    <FormattedMessage
                        id='admin.health_dashboard.error.body'
                        defaultMessage='Reload the page to try again.'
                    />
                }
            />
        );
    } else if (lastEvaluatedAt === 0) {
        content = (
            <EmptyState
                title={
                    <FormattedMessage
                        id='admin.health_dashboard.empty.title'
                        defaultMessage='Not evaluated yet'
                    />
                }
                body={
                    <FormattedMessage
                        id='admin.health_dashboard.empty.body'
                        defaultMessage='The first health check runs within an hour of enabling the feature.'
                    />
                }
            />
        );
    } else {
        let firingContent;
        if (areas.length > 0) {
            firingContent = areas.map((area) => (
                <FindingList
                    key={area}
                    area={area}
                    findings={findingsByArea[area]}
                />
            ));
        } else if (unknownFindings.length > 0) {
            firingContent = (
                <EmptyState
                    title={
                        <FormattedMessage
                            id='admin.health_dashboard.no_firing.title'
                            defaultMessage='No firing findings'
                        />
                    }
                    body={
                        <FormattedMessage
                            id='admin.health_dashboard.no_firing.body'
                            defaultMessage='Some checks could not be evaluated, so this is not an all-clear.'
                        />
                    }
                />
            );
        } else {
            firingContent = (
                <EmptyState
                    title={
                        <FormattedMessage
                            id='admin.health_dashboard.all_clear.title'
                            defaultMessage='No problems found'
                        />
                    }
                    body={
                        <FormattedMessage
                            id='admin.health_dashboard.all_clear.body'
                            defaultMessage='Every health check passed on the last evaluation.'
                        />
                    }
                />
            );
        }

        content = (
            <>
                <SeveritySummary
                    severityCounts={severityCounts}
                    unknownCount={unknownFindings.length}
                    lastEvaluatedAt={lastEvaluatedAt}
                />
                {firingContent}
                <UnknownNotice findings={unknownFindings}/>
            </>
        );
    }

    return (
        <div className='wrapper--fixed HealthDashboard'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.health_dashboard.title'
                    defaultMessage='Site health'
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {content}
                </div>
            </div>
        </div>
    );
};

export default HealthDashboard;
