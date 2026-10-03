// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {REMOVED_FROM_CHANNEL} from 'src/types/actions';
import reducer from 'src/reducer';
import {websocketPlaybookRunIncrementalUpdateReceived} from 'src/actions';
import {PlaybookRun} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';

describe('myPlaybookRunsByTeam', () => {
    // @ts-ignore
    const initialState = reducer(undefined, {}); // eslint-disable-line no-undefined

    describe('REMOVED_FROM_CHANNEL', () => {
        const makeState = (myPlaybookRunsByTeam: any) => ({
            ...initialState,
            myPlaybookRunsByTeam,
        });

        it('should ignore a channel not in the data structure', () => {
            const state = makeState({
                teamId1: {
                    channelId1: {id: 'playbookRunId1'},
                    channelId2: {id: 'playbookRunId2'},
                },
                teamId2: {
                    channelId3: {id: 'playbookRunId3'},
                    channelId4: {id: 'playbookRunId4'},
                },
            });
            const action = {
                type: REMOVED_FROM_CHANNEL,
                channelId: 'unknown',
            };
            const expectedState = state;

            // @ts-ignore
            expect(reducer(state, action)).toStrictEqual(expectedState);
        });

        it('should remove a channel in the data structure', () => {
            const state = makeState({
                teamId1: {
                    channelId1: {id: 'playbookRunId1'},
                    channelId2: {id: 'playbookRunId2'},
                },
                teamId2: {
                    channelId3: {id: 'playbookRunId3'},
                    channelId4: {id: 'playbookRunId4'},
                },
            });
            const action = {
                type: REMOVED_FROM_CHANNEL,
                channelId: 'channelId2',
            };
            const expectedState = makeState({
                teamId1: {
                    channelId1: {id: 'playbookRunId1'},
                },
                teamId2: {
                    channelId3: {id: 'playbookRunId3'},
                    channelId4: {id: 'playbookRunId4'},
                },
            });

            // @ts-ignore
            expect(reducer(state, action)).toEqual(expectedState);
        });
    });
});

describe('websocket event actions', () => {
    // @ts-ignore
    const initialState = reducer(undefined, {}); // eslint-disable-line no-undefined

    // Create a test playbook run for testing
    const testPlaybookRun: PlaybookRun = {
        id: 'run_123',
        team_id: 'team_456',
        channel_id: 'channel_789',
        name: 'Test Run',
        owner_user_id: 'user_1',
        checklists: [
            {
                id: 'checklist_1',
                title: 'Test Checklist',
                items: [
                    {
                        id: 'item_1',
                        title: 'Test Item',
                        state: 'Open',
                        state_modified: 0,
                        assignee_id: '',
                        assignee_modified: 0,
                        command: '',
                        description: '',
                        command_last_run: 0,
                        due_date: 0,
                        task_actions: [],
                        condition_id: '',
                        condition_action: '',
                        condition_reason: '',
                    },
                ],
            },
        ],
        create_at: 1000,
        update_at: 1000,
        end_at: 0,
        post_id: '',
        participant_ids: [],
        timeline_events: [],
        status_posts: [],
        reporter_user_id: '',
        broadcast_channel_ids: [],
        status_update_enabled: false,
        previous_reminder: 0,
        reminder_post_id: '',
        reminder_message_template: '',
        reminder_timer_default_seconds: 0,
        last_status_update_at: 0,
        metrics_data: [],
        retrospective: '',
        retrospective_published_at: 0,
        retrospective_was_canceled: false,
        retrospective_reminder_interval_seconds: 0,
        retrospective_enabled: false,
        webhook_on_status_update_urls: [],
        status_update_broadcast_channels_enabled: false,
        status_update_broadcast_webhooks_enabled: false,
        create_channel_member_on_new_participant: false,
        remove_channel_member_on_removed_participant: false,
        playbook_id: '',
        summary: '',
        summary_modified_at: 0,
        current_status: 'InProgress' as any,
        type: PlaybookRunType.Playbook,
        items_order: ['checklist_1'],
    };

    const makeStateWithRun = (run: PlaybookRun) => ({
        ...initialState,
        myPlaybookRuns: {
            [run.id]: run,
        },
        myPlaybookRunsByTeam: {
            [run.team_id]: {
                [run.channel_id]: run,
            },
        },
    });

    describe('WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED', () => {
        it('should update existing run with incremental changes', () => {
            const state = makeStateWithRun(testPlaybookRun);
            const action = websocketPlaybookRunIncrementalUpdateReceived({
                id: testPlaybookRun.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    name: 'Updated Name',
                    owner_user_id: 'user_2',
                },
            });

            // @ts-ignore
            const newState = reducer(state, action);

            // Check myPlaybookRuns update
            expect(newState.myPlaybookRuns[testPlaybookRun.id].name).toBe('Updated Name');
            expect(newState.myPlaybookRuns[testPlaybookRun.id].owner_user_id).toBe('user_2');
            expect(newState.myPlaybookRuns[testPlaybookRun.id].id).toBe(testPlaybookRun.id);

            // Check myPlaybookRunsByTeam update
            expect(newState.myPlaybookRunsByTeam[testPlaybookRun.team_id]![testPlaybookRun.channel_id].name).toBe('Updated Name');
            expect(newState.myPlaybookRunsByTeam[testPlaybookRun.team_id]![testPlaybookRun.channel_id].owner_user_id).toBe('user_2');
        });

        it('should ignore updates for runs not in state', () => {
            const state = makeStateWithRun(testPlaybookRun);
            const action = websocketPlaybookRunIncrementalUpdateReceived({
                id: 'unknown_run',
                playbook_run_updated_at: 2000,
                changed_fields: {
                    name: 'Updated Name',
                },
            });

            // @ts-ignore
            const newState = reducer(state, action);

            // State should remain unchanged
            expect(newState).toEqual(state);
        });
    });
});
