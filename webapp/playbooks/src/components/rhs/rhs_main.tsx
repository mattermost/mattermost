// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import styled from 'styled-components';

import {useQuery} from '@apollo/client';

import {setRHSOpen} from 'src/actions';
import RHSRunDetails from 'src/components/rhs/rhs_run_details';
import {ToastProvider} from 'src/components/backstage/toast_banner';
import {navigateToChannel} from 'src/browser_routing';
import {usePlaybooksCrud} from 'src/hooks';
import LoadingSpinner from 'src/components/assets/loading_spinner';

import {telemetryEvent} from 'src/client';

import {PlaybookRunEventTarget} from 'src/types/telemetry';

import {graphql} from 'src/graphql/generated/gql';

import RHSRunList, {FilterType, RunListOptions} from './rhs_run_list';
import RHSHome from './rhs_home';

const RHSRunsQuery = graphql(/* GraphQL */`
    query RHSRuns(
        $channelID: String!,
        $sort: String!,
        $direction: String!,
        $status: String!,
        $first: Int,
        $after: String,
    ) {
        runs(
            channelID: $channelID,
            sort: $sort,
            direction: $direction,
            statuses: [$status],
            first: $first,
            after: $after,
        ) {
            totalCount
            edges {
                node {
                    id
                    name
                    participantIDs
                    ownerUserID
                    playbookID
                    playbook {
                        title
                    }
                    numTasksClosed
                    numTasks
                    lastUpdatedAt
                    type
                }
            }
            pageInfo {
                endCursor
                hasNextPage
            }
        }
    }
`);

const useFilteredSortedRuns = (channelID: string, listOptions: RunListOptions) => {
    const inProgressResult = useQuery(RHSRunsQuery, {
        variables: {
            channelID,
            sort: listOptions.sort,
            direction: listOptions.direction,
            first: 8,
            status: 'InProgress',
        },
        fetchPolicy: 'cache-and-network',
    });
    const runsInProgress = inProgressResult.data?.runs.edges.map((edge) => edge.node);
    const numRunsInProgress = inProgressResult.data?.runs.totalCount ?? 0;
    const hasMoreInProgress = inProgressResult.data?.runs.pageInfo.hasNextPage ?? false;

    const finishedResult = useQuery(RHSRunsQuery, {
        variables: {
            channelID,
            sort: listOptions.sort,
            direction: listOptions.direction,
            first: 8,
            status: 'Finished',
        },
        fetchPolicy: 'cache-and-network',
    });
    const runsFinished = finishedResult.data?.runs.edges.map((edge) => edge.node);
    const numRunsFinished = finishedResult.data?.runs.totalCount ?? 0;
    const hasMoreFinished = finishedResult.data?.runs.pageInfo.hasNextPage ?? false;

    const getMoreInProgress = () => {
        return inProgressResult.fetchMore({
            variables: {
                after: inProgressResult.data?.runs.pageInfo.endCursor,
            },
        });
    };

    const getMoreFinished = () => {
        return finishedResult.fetchMore({
            variables: {
                after: finishedResult.data?.runs.pageInfo.endCursor,
            },
        });
    };

    const error = inProgressResult.error || finishedResult.error;

    const refetch = () => {
        inProgressResult.refetch();
        finishedResult.refetch();
    };

    return {
        runsInProgress,
        numRunsInProgress,
        runsFinished,
        numRunsFinished,
        getMoreInProgress,
        getMoreFinished,
        hasMoreInProgress,
        hasMoreFinished,
        refetch,
        error,
    };
};

const useSetRHSState = () => {
    const dispatch = useDispatch();

    // Let other parts of the app know if we are open or not
    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, [dispatch]);
};

const defaultListOptions : RunListOptions = {
    sort: 'create_at',
    direction: 'DESC',
    filter: FilterType.InProgress,
};

// RightHandSidebar the sidebar for integration of playbooks into channels
//
// Rules for automatic display:
// * No Runs Ever -> RHS Home
// * Only Finished Runs -> Runs list blank state
// * Single active run (ignoring finished) -> Details page for that run (back button goes to runs list)
// * Multiple active runs -> Runs list
const RightHandSidebar = () => {
    useSetRHSState();
    const currentTeam = useSelector(getCurrentTeam);
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const [currentRunId, setCurrentRunId] = useState<string|undefined>();
    const [skipNextDetailNav, setSkipNextDetailNav] = useState(false);
    const [listOptions, setListOptions] = useState<RunListOptions>(defaultListOptions);
    const fetchedRuns = useFilteredSortedRuns(currentChannelId, listOptions);
    const {playbooks, isLoading} = usePlaybooksCrud({team_id: currentTeam.id}, {infinitePaging: true});

    // If there is only one active run in this channel select it.
    useEffect(() => {
        if (fetchedRuns.runsInProgress && fetchedRuns.runsInProgress.length === 1) {
            const singleRunID = fetchedRuns.runsInProgress[0].id;
            if (singleRunID !== currentRunId && !skipNextDetailNav) {
                setCurrentRunId(singleRunID);
            }
        }
        if (skipNextDetailNav) {
            setSkipNextDetailNav(false);
        }
    }, [currentChannelId, fetchedRuns.runsInProgress?.length]);

    // Reset the list options on channel change
    useEffect(() => {
        setListOptions(defaultListOptions);
    }, [currentChannelId]);

    if (!fetchedRuns.runsInProgress || !fetchedRuns.runsFinished) {
        return <RHSLoading/>;
    }

    const clearCurrentRunId = () => {
        fetchedRuns.refetch();
        setCurrentRunId(undefined);
    };

    const handleOnCreateRun = (runId: string, channelId: string, statsData: object) => {
        telemetryEvent(PlaybookRunEventTarget.Create, {...statsData, place: 'channels_rhs_runlist'});
        if (channelId === currentChannelId) {
            fetchedRuns.refetch();
            setCurrentRunId(runId);
            return;
        }
        navigateToChannel(currentTeam.name, channelId);
    };

    // Not a channel
    if (!currentChannelId) {
        return <RHSHome/>;
    }

    // No playbooks
    if (!isLoading && playbooks?.length === 0) {
        return <RHSHome/>;
    }

    // Wait for full load to avoid flashing
    if (isLoading) {
        return null;
    }

    // If we have a run selected and it's in the current channel show that
    if (currentRunId && [...fetchedRuns.runsInProgress, ...fetchedRuns.runsFinished].find((run) => run.id === currentRunId)) {
        return (
            <RHSRunDetails
                runID={currentRunId}
                onBackClick={clearCurrentRunId}
            />
        );
    }

    const runsList = listOptions.filter === FilterType.InProgress ? fetchedRuns.runsInProgress : (fetchedRuns.runsFinished ?? []);
    const getMoreRuns = listOptions.filter === FilterType.InProgress ? fetchedRuns.getMoreInProgress : fetchedRuns.getMoreFinished;
    const hasMore = listOptions.filter === FilterType.InProgress ? fetchedRuns.hasMoreInProgress : fetchedRuns.hasMoreFinished;

    // We have more than one run, and the currently selected run isn't in this channel.
    return (
        <RHSRunList
            runs={runsList}
            onSelectRun={(runID: string) => {
                setCurrentRunId(runID);
            }}
            options={listOptions}
            setOptions={setListOptions}
            onRunCreated={handleOnCreateRun}
            getMore={getMoreRuns}
            hasMore={hasMore}
            numInProgress={fetchedRuns.numRunsInProgress}
            numFinished={fetchedRuns.numRunsFinished}
            onLinkRunToChannel={() => setSkipNextDetailNav(true)}
        />
    );
};

const RHSLoading = () => (
    <Centered>
        <LoadingSpinner/>
    </Centered>
);

const Centered = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
`;

const RHSWrapped = () => {
    return (
        <ToastProvider>
            <RightHandSidebar/>
        </ToastProvider>
    );
};

export default RHSWrapped;

