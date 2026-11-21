// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
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
import {RunStatus} from 'src/graphql/generated/graphql';

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
                    currentStatus
                    channelID
                    teamID
                    propertyFields {
                        id
                        name
                        type
                        attrs {
                            sort_order: sortOrder
                            options {
                                id
                                name
                                color
                            }
                            parent_id: parentID
                        }
                    }
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
    const [currentRunId, setCurrentRunId] = useState<string | undefined>();
    const autoSelectCheckedForChannel = useRef<string | undefined>();
    const [autoAddTaskRunId, setAutoAddTaskRunId] = useState<string|undefined>();
    const [listOptions, setListOptions] = useState<RunListOptions>(defaultListOptions);
    const fetchedRuns = useFilteredSortedRuns(currentChannelId, listOptions);
    const {isLoading} = usePlaybooksCrud({team_id: currentTeam?.id}, {infinitePaging: true});

    useEffect(() => {
        // reset filter state
        setListOptions(defaultListOptions);
    }, [currentChannelId]);

    // auto-select single in-progress run in channel if applicable
    useEffect(() => {
        if (currentChannelId && currentChannelId !== autoSelectCheckedForChannel.current) {
            setCurrentRunId(() => {
                if (fetchedRuns.runsInProgress) {
                    autoSelectCheckedForChannel.current = currentChannelId; // mark that we've checked this channel

                    if (fetchedRuns.runsInProgress.length === 1) {
                        return fetchedRuns.runsInProgress[0].id; // auto-select the single in-progress run
                    }

                    return undefined; // no auto-select
                }

                return undefined; // clear immediately - wait until runsInProgress is loaded
            });
        }
    }, [currentChannelId, fetchedRuns.runsInProgress]);

    if (!fetchedRuns.runsInProgress || !fetchedRuns.runsFinished) {
        return <RHSLoading/>;
    }

    const clearCurrentRunId = () => {
        fetchedRuns.refetch();
        setCurrentRunId(undefined);
    };

    const handleOnCreateRun = (runId: string, channelId: string, statsData: {autoAddTask?: boolean}) => {
        if (channelId === currentChannelId) {
            fetchedRuns.refetch();
            setCurrentRunId(runId);
            if (statsData.autoAddTask) {
                setAutoAddTaskRunId(runId);
            }
            return;
        }

        if (currentTeam) {
            navigateToChannel(currentTeam.name, channelId);
        }
    };

    // Not a channel
    if (!currentChannelId) {
        return <RHSHome/>;
    }

    // Wait for full load to avoid flashing
    if (isLoading) {
        return null;
    }

    // If we have a run selected and it's in the current channel show that
    if (currentRunId) {
        const currentRun = [...fetchedRuns.runsInProgress, ...fetchedRuns.runsFinished].find((run) => run.id === currentRunId);
        if (currentRun) {
            // Only auto-add task if this run matches autoAddTaskRunId AND the run is still in progress
            const shouldAutoAddTask = currentRunId === autoAddTaskRunId && currentRun.currentStatus === RunStatus.InProgress;
            return (
                <RHSRunDetails
                    runID={currentRunId}
                    onBackClick={clearCurrentRunId}
                    autoAddTask={shouldAutoAddTask}
                    onTaskAdded={() => setAutoAddTaskRunId(undefined)}
                />
            );
        }
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
        />
    );
};

const RHSLoading = () => (
    <Centered>
        <LoadingSpinner/>
    </Centered>
);

const Centered = styled.div`
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
`;

const RHSWrapped = () => {
    return (
        <ToastProvider>
            <RightHandSidebar/>
        </ToastProvider>
    );
};

export default RHSWrapped;

