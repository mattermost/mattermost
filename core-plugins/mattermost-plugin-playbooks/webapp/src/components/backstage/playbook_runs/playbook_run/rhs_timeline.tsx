// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
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

    if (!team) {
        return null;
    }

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
    flex: 1;
    flex-direction: column;
`;

const Filters = styled.div`
    display: flex;
    height: 40px;
    min-height: 40px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 0 22px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const FilterText = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
    font-weight: 600;
`;

const FilterButton = styled.div`/* stylelint-disable no-empty-source */`;

const Body = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
    margin-bottom: 20px;
`;

export const ItemList = styled.ul`
    position: relative;
    padding: 0 0 40px;
    list-style: none;

    &::before {
        position: absolute;
        top: 26px;
        bottom: 50px;
        left: 32px;
        width: 1px;
        background: #EFF1F5;
        content: '';
    }
`;

const FakeButton = styled.button`
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    background: var(--button-color-rgb);
    color: var(--button-bg);
    font-size: 11px;
    font-weight: 600;
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

        &::before {
            margin: 0 5px 0 0;
        }
    }
`;

const TextContainer = styled.span`
    display: flex;
`;
