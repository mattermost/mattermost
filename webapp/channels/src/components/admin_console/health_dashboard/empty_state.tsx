// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import {CheckCircleOutlineIcon} from '@mattermost/compass-icons/components';

import type {HealthFindingTab} from 'mattermost-redux/utils/health_utils';

type Props = {
    title: React.ReactNode;
    body: React.ReactNode;
    icon?: boolean;
};

export const EmptyState = ({title, body, icon = false}: Props) => (
    <div className='HealthDashboard__empty'>
        {icon && (
            <CheckCircleOutlineIcon
                className='HealthDashboard__emptyIcon'
                size={48}
                color='currentColor'
                aria-hidden={true}
            />
        )}
        <p className='HealthDashboard__emptyTitle'>{title}</p>
        <p>{body}</p>
    </div>
);

const titles = defineMessages<HealthFindingTab>({
    open: {id: 'admin.health_dashboard.all_clear.title', defaultMessage: 'All clear'},
    critical: {id: 'admin.health_dashboard.empty_tab.critical', defaultMessage: 'No critical findings'},
    warning: {id: 'admin.health_dashboard.empty_tab.warning', defaultMessage: 'No warning findings'},
    info: {id: 'admin.health_dashboard.empty_tab.info', defaultMessage: 'No info findings'},
    resolved: {id: 'admin.health_dashboard.empty_tab.resolved', defaultMessage: 'Nothing resolved in the last 7 days'},
    unknown: {id: 'admin.health_dashboard.empty_tab.unknown', defaultMessage: 'Every check could be evaluated'},
});

const severityBody = defineMessages({
    severity: {id: 'admin.health_dashboard.empty_tab.severity_body', defaultMessage: 'Nothing at this severity is firing.'},
});

const bodies = defineMessages({
    open: {id: 'admin.health_dashboard.all_clear.body', defaultMessage: 'Nothing is firing and every check could be evaluated.'},
    resolved: {id: 'admin.health_dashboard.empty_tab.resolved_body', defaultMessage: 'Findings that clear on their own are listed here for 7 days.'},
    unknown: {id: 'admin.health_dashboard.empty_tab.unknown_body', defaultMessage: 'Checks that cannot run are listed here as unknown, never as healthy.'},
});

function bodyFor(tab: HealthFindingTab): MessageDescriptor {
    if (tab === 'open' || tab === 'resolved' || tab === 'unknown') {
        return bodies[tab];
    }
    return severityBody.severity;
}

export const TabEmptyState = ({tab}: {tab: HealthFindingTab}) => (
    <EmptyState
        icon={true}
        title={<FormattedMessage {...titles[tab]}/>}
        body={<FormattedMessage {...bodyFor(tab)}/>}
    />
);
