// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {GlobalState} from '@mattermost/types/store';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {DateTime} from 'luxon';
import {useIntl} from 'react-intl';
import Scrollbars from 'react-custom-scrollbars';

import {renderThumbVertical, renderTrackHorizontal, renderView} from 'src/components/rhs/rhs_shared';

import TimelineEventItem from 'src/components/backstage/playbook_runs/playbook_run/retrospective/timeline_event_item';
import {PlaybookRun} from 'src/types/playbook_run';
import {clientRemoveTimelineEvent} from 'src/client';
import MultiCheckbox, {CheckboxOption} from 'src/components/multi_checkbox';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {useTimelineEvents} from 'src/components/backstage/playbook_runs/playbook_run/timeline_utils';
import {TimelineEventsFilter} from 'src/types/rhs';

interface Props {
    playbookRun: PlaybookRun;
    role: Role;
    options: CheckboxOption[];
    selectOption: (value: string, checked: boolean) => void;
    eventsFilter: TimelineEventsFilter;
}

const RHSTimeline = ({playbookRun, role, options, selectOption, eventsFilter}: Props) => {
    const {formatMessage} = useIntl();
    const channelNamesMap = useSelector(getChannelsNameMapInCurrentTeam);
    const team = useSelector((state: GlobalState) => getTeam(state, playbookRun.team_id));

    const [filteredEvents] = useTimelineEvents(playbookRun, eventsFilter);

    return (
        <Container data-testid='timeline-view'>
            <Filters>
                <FilterText>
                    {formatMessage(
                        {defaultMessage: 'Showing {filteredNum} of {totalNum} events'},
                        {filteredNum: filteredEvents.length, totalNum: playbookRun.timeline_events.length}
                    )}
                </FilterText>
                <FilterButton>
                    <MultiCheckbox
                        dotMenuButton={FakeButton}
                        options={options}
                        onselect={selectOption}
                        placement='bottom-end'
                        icon={
                            <TextContainer>
                                <i className='icon icon-filter-variant'/>
                                {formatMessage({defaultMessage: 'Filter'})}
                            </TextContainer>
                        }
                    />
                </FilterButton>
            </Filters>
            <Body>
                <Scrollbars
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                    renderTrackHorizontal={renderTrackHorizontal}
                    style={{position: 'relative'}}
                >
                    <ItemList>
                        {filteredEvents.map((event, i, events) => {
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
                                    runCreateAt={DateTime.fromMillis(playbookRun.create_at)}
                                    channelNames={channelNamesMap}
                                    team={team}
                                    deleteEvent={() => clientRemoveTimelineEvent(playbookRun.id, event.id)}
                                    editable={role === Role.Participant}
                                />
                            );
                        })}
                    </ItemList>
                </Scrollbars>
            </Body>
        </Container>
    );
};

export default RHSTimeline;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
`;

const Filters = styled.div`
    display: flex;
    flex-direction: row;
    height: 40px;
    min-height: 40px;
    justify-content: space-between;
    align-items: center;
    padding: 0 22px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const FilterText = styled.div`
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const FilterButton = styled.div``;

const Body = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
    margin-bottom: 20px;
`;

export const ItemList = styled.ul`
    padding: 0 0 40px 0;
    list-style: none;
    position: relative;

    :before {
        content: '';
        position: absolute;
        top: 26px;
        left: 32px;
        width: 1px;
        bottom: 50px;
        background: #EFF1F5;
    }
`;

const FakeButton = styled.div`
    display: inline-flex;
    align-items: center;
    color: var(--button-bg);
    background: var(--button-color-rgb);
    padding: 5px 10px;
    font-weight: 600;
    font-size: 11px;
    transition: all 0.15s ease-out;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.12);
    }

    &:active  {
        background: rgba(var(--button-bg-rgb), 0.16);
    }

    i {
        display: flex;
        font-size: 12px;

        &:before {
            margin: 0 5px 0 0;
        }
    }
`;

const TextContainer = styled.span`
    display: flex;
`;
