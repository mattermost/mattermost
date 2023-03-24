// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {DateTime} from 'luxon';

import {useSelector} from 'react-redux';
import {GlobalState} from '@mattermost/types/store';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {Section, SectionHeader} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_styles';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {PlaybookRun} from 'src/types/playbook_run';
import TimelineEventItem from 'src/components/backstage/playbook_runs/playbook_run/retrospective/timeline_event_item';
import {ItemList} from 'src/components/backstage/playbook_runs/playbook_run/rhs_timeline';
import {TimelineEventsFilterDefault} from 'src/types/rhs';
import {clientRemoveTimelineEvent} from 'src/client';

import {useTimelineEvents} from './timeline_utils';

const SHOWED_EVENTS = 5;

interface Props {
    run: PlaybookRun;
    role: Role;
    onViewTimeline: () => void;
}

const RHSInfoActivity = ({run, role, onViewTimeline}: Props) => {
    const {formatMessage} = useIntl();
    const [filteredEvents] = useTimelineEvents(run, TimelineEventsFilterDefault);
    const channelNamesMap = useSelector(getChannelsNameMapInCurrentTeam);
    const team = useSelector((state: GlobalState) => getTeam(state, run.team_id));

    return (
        <Section>
            <SectionHeader
                title={formatMessage({defaultMessage: 'Recent Activity'})}
                link={{
                    onClick: onViewTimeline,
                    name: formatMessage({defaultMessage: 'View all'}),
                }}
            />
            <ItemList data-testid={'rhs-timeline'}>
                {filteredEvents.slice(0, SHOWED_EVENTS).map((event, i, events) => {
                    let prevEventAt;
                    if (i !== events.length - 1) {
                        prevEventAt = DateTime.fromMillis(events[i + 1].event_at);
                    }
                    return (
                        <TimelineEventItem
                            key={event.id}
                            event={event}
                            prevEventAt={prevEventAt}
                            parent={'rhs'}
                            runCreateAt={DateTime.fromMillis(run.create_at)}
                            channelNames={channelNamesMap}
                            team={team}
                            deleteEvent={() => clientRemoveTimelineEvent(run.id, event.id)}
                            editable={role === Role.Participant}
                        />
                    );
                })}
            </ItemList>
        </Section>
    );
};

export default RHSInfoActivity;

