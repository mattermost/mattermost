// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, defineMessages, FormattedMessage} from 'react-intl';
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

const severityBody = defineMessage({id: 'admin.health_dashboard.empty_tab.severity_body', defaultMessage: 'Nothing at this severity is firing.'});

const bodies: Record<HealthFindingTab, MessageDescriptor> = {
    open: defineMessage({id: 'admin.health_dashboard.all_clear.body', defaultMessage: 'Nothing is firing and every check could be evaluated.'}),
    critical: severityBody,
    warning: severityBody,
    info: severityBody,
    resolved: defineMessage({id: 'admin.health_dashboard.empty_tab.resolved_body', defaultMessage: 'Findings that clear on their own are listed here for 7 days.'}),
    unknown: defineMessage({id: 'admin.health_dashboard.empty_tab.unknown_body', defaultMessage: 'Checks that cannot run are listed here as unknown, never as healthy.'}),
};

// Muted findings are still there, so a tab emptied by muting must not read as all clear.
export const TabEmptyState = ({tab, muted}: {tab: HealthFindingTab; muted: number}) => {
    if (muted > 0) {
        return (
            <EmptyState
                title={
                    <FormattedMessage
                        id='admin.health_dashboard.empty_tab.muted_title'
                        defaultMessage='{count, plural, one {# finding here is muted} other {# findings here are muted}}'
                        values={{count: muted}}
                    />
                }
                body={
                    <FormattedMessage
                        id='admin.health_dashboard.empty_tab.muted_body'
                        defaultMessage='Muted findings are still checked but hidden from this list. Open Muted to review or unmute them.'
                    />
                }
            />
        );
    }

    return (
        <EmptyState
            icon={true}
            title={<FormattedMessage {...titles[tab]}/>}
            body={<FormattedMessage {...bodies[tab]}/>}
        />
    );
};
