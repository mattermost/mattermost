// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import styled from 'styled-components';

import {FormattedNumber, useIntl} from 'react-intl';

import {DateTime} from 'luxon';

import {DefaultFetchPlaybookRunsParamsTime, FetchPlaybookRunsParams, fetchParamsTimeEqual} from 'src/types/playbook_run';
import ClipboardsPlay from 'src/components/assets/icons/clipboards_play';
import Profiles from 'src/components/assets/icons/profiles';
import ClipboardsCheckmark from 'src/components/assets/icons/clipboards_checkmark';
import {PlaybookStats} from 'src/types/stats';
import {useAllowPlaybookStatsView} from 'src/hooks';

import Pill from 'src/components/widgets/pill';
import {Timestamp} from 'src/webapp_globals';
import {DateTimeFormats} from 'src/constants';

import UpgradePlaybookPlaceholder from './upgrade_playbook_placeholder';

import BarGraph from './bar_graph';

import LineGraph from './line_graph';

interface Props {
    stats: PlaybookStats
    fetchParams: FetchPlaybookRunsParams
    setFetchParams: React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>
    setFilterPill: (pill: ReactNode) => void
}

const StatsView = (props: Props) => {
    const {formatMessage} = useIntl();
    const allowStatsView = useAllowPlaybookStatsView();

    if (!allowStatsView) {
        return (
            <PlaceholderRow>
                <UpgradePlaybookPlaceholder/>
            </PlaceholderRow>
        );
    }

    const filterStarted = (index: number) => {
        if (index < 0) {
            clearFilter();
            return;
        }

        const started = props.stats.runs_started_per_week_times[index][0];
        const ended = props.stats.runs_started_per_week_times[index][1];
        const nextFetchParamsTime = {
            ...DefaultFetchPlaybookRunsParamsTime,
            started_gte: started,
            started_lt: ended,
        };

        if (!fetchParamsTimeEqual(props.fetchParams, nextFetchParamsTime)) {
            const text = formatMessage({
                defaultMessage: 'Runs started between {start} and {end}',
            }, {
                start: <Timestamp value={started}/>,
                end: <Timestamp value={ended}/>,
            });

            props.setFilterPill(pill(text));
            props.setFetchParams((oldParams) => {
                return {...oldParams, ...nextFetchParamsTime, page: 0};
            });
        }
    };

    const filterActive = (index: number) => {
        if (index < 0) {
            clearFilter();
            return;
        }

        const started = props.stats.active_runs_per_day_times[index][0];
        const ended = props.stats.active_runs_per_day_times[index][1];
        const nextFetchParamsTime = {
            ...DefaultFetchPlaybookRunsParamsTime,
            active_gte: started,
            active_lt: ended,
        };

        if (!fetchParamsTimeEqual(props.fetchParams, nextFetchParamsTime)) {
            const text = formatMessage({
                defaultMessage: 'Runs active on {date}',
            },
            {
                date: (
                    <Timestamp
                        value={started}
                        useTime={false}
                    />
                ),
            });

            props.setFilterPill(pill(text));
            props.setFetchParams((oldParams) => {
                return {...oldParams, ...nextFetchParamsTime, page: 0};
            });
        }
    };

    const clearFilter = () => {
        props.setFilterPill(null);
        props.setFetchParams((oldParams) => {
            return {...oldParams, ...DefaultFetchPlaybookRunsParamsTime, page: 0};
        });
    };

    const pill = (text: ReactNode) => (
        <PillRow>
            <Pill
                text={text}
                onClose={clearFilter}
            />
        </PillRow>
    );

    return (
        <>
            <BottomRow>
                <StatCard>
                    <ClipboardsPlayBig/>
                    <StatText>{formatMessage({defaultMessage: 'Runs currently in progress'})}</StatText>
                    <StatNum>{props.stats.runs_in_progress}</StatNum>
                </StatCard>
                <StatCard>
                    <ProfilesBig/>
                    <StatText>{formatMessage({defaultMessage: 'Participants currently active'})}</StatText>
                    <StatNum>{props.stats.participants_active}</StatNum>
                </StatCard>
                <StatCard>
                    <ClipboardsCheckmarkBig/>
                    <StatText>{formatMessage({defaultMessage: 'Runs finished in the last 30 days'})}</StatText>
                    <StatNumRow>
                        <StatNum>{props.stats.runs_finished_prev_30_days}</StatNum>
                        {percentageChange(props.stats.runs_finished_percentage_change)}
                    </StatNumRow>
                </StatCard>
                <GraphBox>
                    <LineGraph
                        title={formatMessage({defaultMessage: 'TOTAL RUNS started per week over the last 12 weeks'})}
                        labels={props.stats.runs_started_per_week_times.map(([start]) => DateTime.fromMillis(start).toLocaleString(DateTimeFormats.DATE_MED_NO_YEAR))}
                        data={props.stats.runs_started_per_week}
                        tooltipTitleCallback={(date) => formatMessage({defaultMessage: 'Week of {date}'}, {date})}
                        tooltipLabelCallback={(numTotalRuns) => formatMessage({defaultMessage: '{numTotalRuns, plural, =0 {no runs started} =1 {# run started} other {# runs started}}'}, {numTotalRuns})}
                        onClick={filterStarted}
                    />
                </GraphBox>
            </BottomRow>
            <BottomRow>
                <GraphBox>
                    <BarGraph
                        title={formatMessage({defaultMessage: 'ACTIVE RUNS per day over the last 14 days'})}
                        labels={props.stats.active_runs_per_day_times.map(([start]) => DateTime.fromMillis(start).toLocaleString(DateTimeFormats.DATE_MED_NO_YEAR))}
                        data={props.stats.active_runs_per_day}
                        tooltipTitleCallback={(date) => formatMessage({defaultMessage: 'Day: {date}'}, {date})}
                        tooltipLabelCallback={(numActiveRuns) => formatMessage({defaultMessage: '{numActiveRuns, plural, =0 {no active runs} =1 {# active run} other {# active runs}}'}, {numActiveRuns})}
                        onClick={filterActive}
                    />
                </GraphBox>
                <GraphBox>
                    <BarGraph
                        title={formatMessage({defaultMessage: 'ACTIVE PARTICIPANTS per day over the last 14 days'})}
                        labels={props.stats.active_participants_per_day_times.map(([start]) => DateTime.fromMillis(start).toLocaleString(DateTimeFormats.DATE_MED_NO_YEAR))}
                        data={props.stats.active_participants_per_day}
                        color={'--center-channel-color-40'}
                        tooltipTitleCallback={(date) => formatMessage({defaultMessage: 'Day: {date}'}, {date})}
                        tooltipLabelCallback={(numParticipants) => formatMessage({defaultMessage: '{numParticipants, plural, =0 {no active participants} =1 {# active participant} other {# active participants}}'}, {numParticipants})}
                    />
                </GraphBox>
            </BottomRow>
        </>
    );
};

const percentageChange = (change: number) => {
    if (change === 99999999 || change === 0) {
        return null;
    }
    const changeSymbol = (change > 0) ? 'icon-arrow-up' : 'icon-arrow-down';

    return (
        <PercentageChange>
            <i className={'icon ' + changeSymbol}/>
            <FormattedNumber
                value={change / 100}
                style={'percent'}
            />
        </PercentageChange>
    );
};

const PlaceholderRow = styled.div`
    height: 260px;
    margin: 32px 0;
`;

const BottomRow = styled.div`
    display: flex;
    flex-direction: row;

    > div + div {
        margin-left: 16px;
    }
`;

const StatCard = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 20px 20px 12px 20px;

    max-height: 180px;
    max-width: 167px;

    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.32);
    border-radius: 4px;

    background-color: var(--center-channel-bg);
`;

const StatText = styled.div`
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    padding-top: 10px;
`;

const StatNum = styled.div`
    font-size: 44px;
    line-height: 56px;
    color: var(--center-channel-color);
`;

const StatNumRow = styled.div`
    display: flex;
    flex-direction: row;
    width: 100%;
`;

const PercentageChange = styled.div`
    margin: auto 12px 8px auto;
    display: flex;
    flex-direction: row;
    border-radius: 10px;
    padding-right: 6px;
    background-color: rgba(var(--online-indicator-rgb), 0.08);
    color: var(--online-indicator);
    font-size: 10px;
    line-height: 15px;

    > i {
        font-size: 12px;
    }
`;

const ClipboardsPlayBig = styled(ClipboardsPlay)`
    height: 32px;
    width: auto;
`;

const ProfilesBig = styled(Profiles)`
    height: 32px;
    width: auto;
`;

const ClipboardsCheckmarkBig = styled(ClipboardsCheckmark)`
    height: 32px;
    width: auto;
`;

const GraphBox = styled.div`
    flex-grow: 1;
    max-width: 532px;
    max-height: 180px;
    background-color: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.32);
    border-radius: 4px;
`;

const PillRow = styled.div`
    margin-bottom: 20px;
`;

export default StatsView;
