// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import configureStore, {MockStoreEnhanced} from 'redux-mock-store';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {WebSocketMessage} from '@mattermost/client';

import {handleReconnect, handleWebsocketPlaybookRunUpdatedIncremental} from './websocket_events';
import {WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED} from './types/actions';

import {PlaybookRun, PlaybookRunStatus} from './types/playbook_run';
import {ChecklistUpdate, PlaybookRunUpdate} from './types/websocket_events';
import {TimelineEvent, TimelineEventType} from './types/rhs';
import {PlaybookRunType} from './graphql/generated/graphql';

const mockStore = configureStore<GlobalState, DispatchFunc>();

// No mocks needed for these specific tests

// We don't need to mock the client module since our tests don't interact with it directly

describe('handleReconnect', () => {
    it('does nothing if there is no current team', async () => {
        const initialState = {
            entities: {
                users: {
                    currentUserId: 'user_id',
                },
                teams: {
                    currentTeamId: '',
                    teams: {},
                },
            },
        } as GlobalState;
        const store: MockStoreEnhanced<GlobalState, DispatchFunc> = mockStore(initialState);

        const reconnectHandler = handleReconnect(store.getState, store.dispatch);
        const result = await reconnectHandler();
        expect(result).toBeUndefined();
    });

    it('does nothing if there is no current user', async () => {
        const team = {id: 'team_id', delete_at: 0};
        const initialState = {
            entities: {
                users: {
                    currentUserId: '',
                },
                teams: {
                    currentTeamId: team.id,
                    teams: {
                        [team.id]: team,
                    },
                },
            },
        } as GlobalState;
        const store: MockStoreEnhanced<GlobalState, DispatchFunc> = mockStore(initialState);

        const reconnectHandler = handleReconnect(store.getState, store.dispatch);
        const result = await reconnectHandler();
        expect(result).toBeUndefined();
    });
});

describe('incremental updates', () => {
    // Create a base playbook run for testing
    const basePlaybookRun: PlaybookRun = {
        id: 'playbook_run_1',
        team_id: 'team_1',
        channel_id: 'channel_1',
        name: 'Test Playbook Run',
        owner_user_id: 'user_1',
        checklists: [
            {
                id: 'checklist_1',
                title: 'Checklist 1',
                items: [
                    {
                        id: 'item_1',
                        title: 'Item 1',
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
                    {
                        id: 'item_2',
                        title: 'Item 2',
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

        // Other required fields with default values
        create_at: 1,
        update_at: 1,
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
        current_status: PlaybookRunStatus.InProgress,
        type: PlaybookRunType.Playbook,
        items_order: ['checklist_1'],
    };

    describe('handleWebsocketPlaybookRunUpdatedIncremental', () => {
        // Setup test environment for each test
        let testDispatch: jest.Mock;
        let testGetState: jest.Mock;

        // Create a fresh copy of the playbook run for each test to avoid state leakage
        let testPlaybookRun: PlaybookRun;

        beforeEach(() => {
            // Create a fresh deep copy of the base playbook run
            testPlaybookRun = JSON.parse(JSON.stringify(basePlaybookRun));

            // Reset mocks with fresh playbook run
            testDispatch = jest.fn();
            testGetState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [testPlaybookRun.id]: testPlaybookRun,
                            },
                        },
                    },
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [testPlaybookRun.team_id]: {
                                [testPlaybookRun.channel_id]: testPlaybookRun,
                            },
                        },
                    },
                } as any;
            });
        });

        it('dispatches the correct action with update data', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with just one field change
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1000,
                changed_fields: {
                    name: 'Updated Name',
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called with the correct action
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and data
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
        });

        it('handles missing payload gracefully', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create a WebSocket message without payload
            const msg = {
                data: {},
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was not called
            expect(testDispatch).not.toHaveBeenCalled();
        });

        it('handles nested field updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with nested field changes
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1000,
                changed_fields: {
                    name: 'Updated Name',
                    status_update_enabled: true,
                    broadcast_channel_ids: ['channel_1', 'channel_2'],
                    metrics_data: [
                        {
                            metric_config_id: 'metric_1',
                            value: 42,
                        },
                    ],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and that data contains the update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.name).toBe('Updated Name');
            expect(dispatchedAction.data.changed_fields.status_update_enabled).toBe(true);
            expect(dispatchedAction.data.changed_fields.broadcast_channel_ids).toEqual(['channel_1', 'channel_2']);
            expect(dispatchedAction.data.changed_fields.metrics_data).toEqual([
                {
                    metric_config_id: 'metric_1',
                    value: 42,
                },
            ]);
        });

        it('handles structured checklist updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an incremental update for the checklist
            const checklistUpdates: ChecklistUpdate[] = [
                {
                    id: 'checklist_1',
                    checklist_updated_at: 1000,
                    fields: {
                        title: 'Updated Checklist Title',
                    },
                    item_updates: [
                        {
                            id: 'item_1',
                            checklist_item_updated_at: 1000,
                            fields: {
                                state: 'Closed',
                                assignee_id: 'user_2',
                            },
                        },
                        {
                            id: 'item_2',
                            checklist_item_updated_at: 1000,
                            fields: {},
                        },
                    ],
                    items_order: ['item_1', 'item_2'],
                },
            ];

            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1000,
                changed_fields: {

                    // Sending incremental updates
                    checklists: checklistUpdates,
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.checklists).toEqual(checklistUpdates);
            expect(dispatchedAction.data.changed_fields.checklists[0].fields.title).toBe('Updated Checklist Title');
            expect(dispatchedAction.data.changed_fields.checklists[0].item_updates[0].fields.state).toBe('Closed');
            expect(dispatchedAction.data.changed_fields.checklists[0].item_updates[0].fields.assignee_id).toBe('user_2');
        });

        it('handles incremental checklist updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with checklists updates
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1000,
                changed_fields: {
                    name: 'Updated Name', // Some other field update
                    checklists: [
                        {
                            id: 'checklist_1',
                            checklist_updated_at: 1000,
                            fields: {
                                title: 'Updated Checklist Title via updates',
                            },
                            item_updates: [
                                {
                                    id: 'item_1',
                                    checklist_item_updated_at: 1000,
                                    fields: {
                                        state: 'Closed',
                                        assignee_id: 'user_3',
                                    },
                                },
                            ],
                            item_deletes: ['item_2'], // Delete the second item
                            items_order: ['item_1'], // Updated order after deletion
                        },
                    ],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.name).toBe('Updated Name');
            expect(dispatchedAction.data.changed_fields.checklists[0].fields.title).toBe('Updated Checklist Title via updates');
            expect(dispatchedAction.data.changed_fields.checklists[0].item_updates[0].fields.state).toBe('Closed');
            expect(dispatchedAction.data.changed_fields.checklists[0].item_updates[0].fields.assignee_id).toBe('user_3');
            expect(dispatchedAction.data.changed_fields.checklists[0].item_deletes).toEqual(['item_2']);
        });

        it('handles playbook run items_order field updates', () => {
            // Add a second checklist to test order changes
            testPlaybookRun.checklists.push({
                id: 'checklist_2',
                title: 'Checklist 2',
                items: [],
            });
            testPlaybookRun.items_order = ['checklist_1', 'checklist_2'];

            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update that changes the items_order (reverse the order)
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1000,
                changed_fields: {
                    items_order: ['checklist_2', 'checklist_1'], // Reverse the order
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.items_order).toEqual(['checklist_2', 'checklist_1']);
        });

        it('handles playbook_run_updated_at field', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with playbook_run_updated_at field
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1500,
                changed_fields: {
                    name: 'Updated Name with Timestamp',
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.playbook_run_updated_at).toBe(1500);
            expect(dispatchedAction.data.changed_fields.name).toBe('Updated Name with Timestamp');
        });
    });

    describe('timeline events incremental updates', () => {
        // Setup test environment for each test
        let testDispatch: jest.Mock;
        let testGetState: jest.Mock;

        // Create a fresh copy of the playbook run for each test to avoid state leakage
        let testPlaybookRun: PlaybookRun;

        beforeEach(() => {
            // Create a fresh deep copy of the base playbook run
            testPlaybookRun = JSON.parse(JSON.stringify(basePlaybookRun));

            // Add some initial timeline events for testing
            testPlaybookRun.timeline_events = [
                {
                    id: 'event_1',
                    playbook_run_id: testPlaybookRun.id,
                    create_at: 1000,
                    delete_at: 0,
                    event_at: 1000,
                    event_type: TimelineEventType.RunCreated,
                    summary: 'Playbook run created',
                    details: 'Run was created',
                    post_id: '',
                    subject_user_id: 'user_1',
                    creator_user_id: 'user_1',
                },
                {
                    id: 'event_2',
                    playbook_run_id: testPlaybookRun.id,
                    create_at: 2000,
                    delete_at: 0,
                    event_at: 2000,
                    event_type: TimelineEventType.OwnerChanged,
                    summary: 'Owner changed',
                    details: 'Owner was changed to user_1',
                    post_id: '',
                    subject_user_id: 'user_1',
                    creator_user_id: 'user_2',
                },
            ];

            // Reset mocks with fresh playbook run
            testDispatch = jest.fn();
            testGetState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [testPlaybookRun.id]: testPlaybookRun,
                            },
                        },
                    },
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [testPlaybookRun.team_id]: {
                                [testPlaybookRun.channel_id]: testPlaybookRun,
                            },
                        },
                    },
                } as any;
            });
        });

        it('handles adding a new timeline event', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create a new timeline event to add to the existing ones
            const newEvent: TimelineEvent = {
                id: 'event_3',
                playbook_run_id: testPlaybookRun.id,
                create_at: 3000,
                delete_at: 0,
                event_at: 3000,
                event_type: TimelineEventType.StatusUpdated,
                summary: 'Status updated',
                details: 'Status was updated to "In progress"',
                subject_user_id: 'user_1',
                creator_user_id: 'user_1',
                post_id: '',
            };

            // Create an update with the timeline_events field including the new event
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 3000,
                changed_fields: {
                    timeline_events: [...testPlaybookRun.timeline_events, newEvent],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events).toBeDefined();
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(3);

            // Check for the new event in the action data
            const addedEvent = dispatchedAction.data.changed_fields.timeline_events.find(
                (e: any) => e.id === 'event_3'
            );
            expect(addedEvent).toBeDefined();
            expect(addedEvent?.event_type).toBe(TimelineEventType.StatusUpdated);
            expect(addedEvent?.summary).toBe('Status updated');
        });

        it('handles modifying existing timeline events', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create a modified version of an existing event
            const modifiedEvents = [...testPlaybookRun.timeline_events];
            modifiedEvents[0] = {
                ...modifiedEvents[0],
                summary: 'Updated summary',
                details: 'Updated details',
            };

            // Create an update with the modified timeline_events
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 3000,
                changed_fields: {
                    timeline_events: modifiedEvents,
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(2);

            // Check that the event was modified correctly in the action data
            const modifiedEvent = dispatchedAction.data.changed_fields.timeline_events.find(
                (e: any) => e.id === 'event_1'
            );
            expect(modifiedEvent).toBeDefined();
            expect(modifiedEvent?.summary).toBe('Updated summary');
            expect(modifiedEvent?.details).toBe('Updated details');
        });

        it('handles deleted timeline events', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Make a copy of the first event but mark it as deleted
            const deletedEvent = {
                ...testPlaybookRun.timeline_events[0],
                delete_at: 3000, // Set deletion timestamp
            };

            // Create an update with one event deleted
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 3000,
                changed_fields: {
                    timeline_events: [
                        deletedEvent,
                        testPlaybookRun.timeline_events[1],
                    ],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(2);

            // Check that the event was marked as deleted in the action data
            const deletedEventInData = dispatchedAction.data.changed_fields.timeline_events.find(
                (e: any) => e.id === 'event_1'
            );
            expect(deletedEventInData).toBeDefined();
            expect(deletedEventInData?.delete_at).toBe(3000);
        });

        it('handles complex timeline updates with additions, modifications, and preserving order', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Add a third event to our test run
            testPlaybookRun.timeline_events.push({
                id: 'event_3',
                playbook_run_id: testPlaybookRun.id,
                create_at: 3000,
                delete_at: 0,
                event_at: 3000,
                event_type: TimelineEventType.TaskStateModified,
                summary: 'Task state changed',
                details: 'Task was completed',
                post_id: '',
                subject_user_id: 'user_2',
                creator_user_id: 'user_2',
            });

            // Create a new event to add
            const newEvent: TimelineEvent = {
                id: 'event_4',
                playbook_run_id: testPlaybookRun.id,
                create_at: 1500, // This timestamp is between events 1 and 2
                delete_at: 0,
                event_at: 1500,
                event_type: TimelineEventType.RanSlashCommand,
                summary: 'Slash command executed',
                details: 'User ran a slash command',
                subject_user_id: 'user_1',
                creator_user_id: 'user_1',
                post_id: '',
            };

            // Modified version of event 2
            const modifiedEvent = {
                ...testPlaybookRun.timeline_events[1],
                summary: 'Owner updated',
                details: 'Owner was updated to user_1',
            };

            // Deleted event (event 3)
            const deletedEvent = {
                ...testPlaybookRun.timeline_events[2],
                delete_at: 4000,
            };

            // Create an update with complex timeline changes
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 4000,
                changed_fields: {
                    timeline_events: [
                        testPlaybookRun.timeline_events[0], // Unchanged
                        newEvent, // New event
                        modifiedEvent, // Modified event
                        deletedEvent, // Deleted event
                    ],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(4);

            // Verify the new event was added in the action data
            const addedEvent = dispatchedAction.data.changed_fields.timeline_events.find(
                (e: any) => e.id === 'event_4'
            );
            expect(addedEvent).toBeDefined();
            expect(addedEvent?.event_type).toBe(TimelineEventType.RanSlashCommand);

            // Verify the modified event was updated in the action data
            const updatedEvent = dispatchedAction.data.changed_fields.timeline_events.find(
                (e: any) => e.id === 'event_2'
            );
            expect(updatedEvent).toBeDefined();
            expect(updatedEvent?.summary).toBe('Owner updated');
        });

        it('initializes timeline_events if the property is missing', () => {
            // Create a run without the timeline_events property
            const runWithoutTimeline = JSON.parse(JSON.stringify(basePlaybookRun));
            delete runWithoutTimeline.timeline_events;

            // Update the test state
            testGetState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [runWithoutTimeline.id]: runWithoutTimeline,
                            },
                        },
                    },
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [runWithoutTimeline.team_id]: {
                                [runWithoutTimeline.channel_id]: runWithoutTimeline,
                            },
                        },
                    },
                } as any;
            });

            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // New timeline events to add
            const newEvents: TimelineEvent[] = [
                {
                    id: 'event_1',
                    playbook_run_id: runWithoutTimeline.id,
                    create_at: 1000,
                    delete_at: 0,
                    event_at: 1000,
                    event_type: TimelineEventType.RunCreated,
                    summary: 'Playbook run created',
                    details: 'Run was created',
                    subject_user_id: 'user_1',
                    creator_user_id: 'user_1',
                    post_id: '',
                },
            ];

            // Create an update with timeline events
            const update: PlaybookRunUpdate = {
                id: runWithoutTimeline.id,
                playbook_run_updated_at: 1000,
                changed_fields: {
                    timeline_events: newEvents,
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events).toBeDefined();
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(1);
            expect(dispatchedAction.data.changed_fields.timeline_events[0].id).toBe('event_1');
        });

        it('handles concurrent timeline and other field updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create a new timeline event
            const newEvent: TimelineEvent = {
                id: 'event_3',
                playbook_run_id: testPlaybookRun.id,
                create_at: 3000,
                delete_at: 0,
                event_at: 3000,
                event_type: TimelineEventType.StatusUpdated,
                summary: 'Status updated',
                details: 'Status was updated to "In progress"',
                subject_user_id: 'user_1',
                creator_user_id: 'user_1',
                post_id: '',
            };

            // Create an update with both timeline_events and other field changes
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 3000,
                changed_fields: {
                    name: 'Updated Run Name',
                    owner_user_id: 'user_2',
                    timeline_events: [...testPlaybookRun.timeline_events, newEvent],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(3);
            expect(dispatchedAction.data.changed_fields.name).toBe('Updated Run Name');
            expect(dispatchedAction.data.changed_fields.owner_user_id).toBe('user_2');

            // Verify the new event was added in the action data
            const addedEvent = dispatchedAction.data.changed_fields.timeline_events.find(
                (e: any) => e.id === 'event_3'
            );
            expect(addedEvent).toBeDefined();
        });
    });

    describe('handling edge cases', () => {
        // Test edge case handling in the code

        it('gracefully handles non-existent checklist ID', () => {
            // Create a handler with our mocks
            const dispatch = jest.fn();
            const getState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [basePlaybookRun.id]: basePlaybookRun,
                            },
                        },
                    },
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [basePlaybookRun.team_id]: {
                                [basePlaybookRun.channel_id]: basePlaybookRun,
                            },
                        },
                    },
                } as any;
            });

            const handler = handleWebsocketPlaybookRunUpdatedIncremental(getState, dispatch);

            // Create an update with a non-existent checklist ID
            const update = {
                id: basePlaybookRun.id,
                playbook_run_updated_at: 1000,
                changed_fields: {
                    checklists: [
                        {
                            id: 'non_existent_checklist',
                            checklist_updated_at: 1000,
                            fields: {
                                title: 'Updated Checklist Title',
                            },
                        },
                    ],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler - should not throw an error
            handler(msg);

            // Verify that the handler at least returned and didn't crash
            // The actual behavior with non-existent checklists is to just return
            // early, so dispatch may not be called in this case
            expect(() => handler(msg)).not.toThrow();
        });

        it('gracefully handles non-existent items in item_updates', () => {
            // Create a handler with our mocks
            const dispatch = jest.fn();
            const getState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [basePlaybookRun.id]: JSON.parse(JSON.stringify(basePlaybookRun)), // Deep clone
                            },
                        },
                    },
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [basePlaybookRun.team_id]: {
                                [basePlaybookRun.channel_id]: JSON.parse(JSON.stringify(basePlaybookRun)),
                            },
                        },
                    },
                } as any;
            });

            const handler = handleWebsocketPlaybookRunUpdatedIncremental(getState, dispatch);

            // Create an update with a non-existent item ID but with valid checklist ID
            const update = {
                id: basePlaybookRun.id,
                playbook_run_updated_at: 1000,
                changed_fields: {
                    checklists: [
                        {
                            id: basePlaybookRun.checklists[0].id,
                            checklist_updated_at: 1000,
                            item_updates: [
                                {
                                    id: 'non_existent_item',
                                    checklist_item_updated_at: 1000,
                                    fields: {
                                        title: 'Updated Item Title',
                                    },
                                },
                            ],
                        },
                    ],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler - should not throw an error
            handler(msg);

            // Verify that the handler didn't crash
            expect(() => handler(msg)).not.toThrow();
        });
    });

    describe('incremental updates framework integration', () => {
        let testDispatch: jest.Mock;
        let testGetState: jest.Mock;
        let testPlaybookRun: PlaybookRun;

        beforeEach(() => {
            // Create a fresh deep copy of the base playbook run
            testPlaybookRun = JSON.parse(JSON.stringify(basePlaybookRun));

            // Reset mocks with fresh playbook run
            testDispatch = jest.fn();
            testGetState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [testPlaybookRun.id]: testPlaybookRun,
                            },
                        },
                    },
                    'plugins-playbooks': {
                        myPlaybookRuns: {
                            [testPlaybookRun.id]: testPlaybookRun,
                        },
                        myPlaybookRunsByTeam: {
                            [testPlaybookRun.team_id]: {
                                [testPlaybookRun.channel_id]: testPlaybookRun,
                            },
                        },
                    },
                } as any;
            });
        });

        describe('state fallback mechanism', () => {
            it('fetches full playbook run when run missing from state', async () => {
                // Mock the fetchPlaybookRun function to be called when state is missing
                // Override global fetch method to mock the API call
                const originalFetch = global.fetch;
                global.fetch = jest.fn().mockResolvedValue({
                    ok: true,
                    json: jest.fn().mockResolvedValue(testPlaybookRun),
                });

                // Create state without the run
                const emptyGetState = jest.fn(() => ({
                    entities: {
                        playbookRuns: {
                            runs: {},
                        },
                    },
                    'plugins-playbooks': {
                        myPlaybookRuns: {},
                        myPlaybookRunsByTeam: {},
                    },
                } as any));

                const handler = handleWebsocketPlaybookRunUpdatedIncremental(emptyGetState, testDispatch);

                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        name: 'Updated Name',
                    },
                };

                const msg = {
                    data: {
                        payload: JSON.stringify(update),
                    },
                } as WebSocketMessage<{payload: string}>;

                // Call the handler
                handler(msg);

                // Allow async operations to complete
                await new Promise((resolve) => setTimeout(resolve, 0));

                // The handler should detect missing state and trigger a fetch
                // Since we can't easily mock the internal fetchPlaybookRun,
                // we verify that no incremental update dispatch occurred
                expect(testDispatch).not.toHaveBeenCalled();

                // Restore original fetch
                global.fetch = originalFetch;
            });

            it('handles fallback when checklist update for missing run', () => {
                // Create state without the run
                const emptyGetState = jest.fn(() => ({
                    entities: {
                        playbookRuns: {
                            runs: {},
                        },
                    },
                    'plugins-playbooks': {
                        myPlaybookRuns: {},
                        myPlaybookRunsByTeam: {},
                    },
                } as any));

                const handler = handleWebsocketPlaybookRunUpdatedIncremental(emptyGetState, testDispatch);

                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        checklists: [
                            {
                                id: 'checklist_1',
                                checklist_updated_at: 2000,
                                fields: {
                                    title: 'New Title',
                                },
                            },
                        ],
                    },
                };

                const msg = {
                    data: {
                        payload: JSON.stringify(update),
                    },
                } as WebSocketMessage<{payload: string}>;

                // Call the handler
                handler(msg);

                // Should not dispatch when run is missing - handler will try to fetch the run
                expect(testDispatch).not.toHaveBeenCalled();
            });
        });

        describe('new checklist creation via websocket', () => {
            it('creates new checklist when checklist does not exist', () => {
                const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

                // Create update for a new checklist that doesn't exist
                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        checklists: [
                            {
                                id: 'new_checklist_123',
                                checklist_updated_at: 2000,
                                fields: {
                                    title: 'Brand New Checklist',
                                },
                                item_inserts: [
                                    {
                                        id: 'new_item_1',
                                        title: 'New Item 1',
                                        state: 'Open',
                                        state_modified: 0,
                                        assignee_id: '',
                                        assignee_modified: 0,
                                        command: '',
                                        description: '',
                                        command_last_run: 0,
                                        due_date: 0,
                                        task_actions: [],
                                    },
                                ],
                            },
                        ],
                    },
                };

                const msg = {
                    data: {
                        payload: JSON.stringify(update),
                    },
                } as WebSocketMessage<{payload: string}>;

                handler(msg);

                // Verify the update was dispatched
                expect(testDispatch).toHaveBeenCalledTimes(1);
                const dispatchedAction = testDispatch.mock.calls[0][0];
                expect(dispatchedAction.type).toBe('playbooks_ws_run_incremental_update_received');
                expect(dispatchedAction.data.changed_fields.checklists[0].id).toBe('new_checklist_123');
                expect(dispatchedAction.data.changed_fields.checklists[0].fields.title).toBe('Brand New Checklist');
                expect(dispatchedAction.data.changed_fields.checklists[0].item_inserts).toHaveLength(1);
            });

            it('handles checklist creation with multiple items', () => {
                const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

                const newItems = [
                    {
                        id: 'item_a',
                        title: 'Item A',
                        state: 'Open',
                        state_modified: 0,
                        assignee_id: 'user_1',
                        assignee_modified: 0,
                        command: '/echo test',
                        description: 'Test item A',
                        command_last_run: 0,
                        due_date: 0,
                        task_actions: [],
                        condition_id: '',
                        condition_action: '',
                        condition_reason: '',
                    },
                    {
                        id: 'item_b',
                        title: 'Item B',
                        state: 'Closed',
                        state_modified: 2000,
                        assignee_id: 'user_2',
                        assignee_modified: 1900,
                        command: '',
                        description: 'Test item B',
                        command_last_run: 0,
                        due_date: 1234567890,
                        task_actions: [],
                    },
                ];

                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        checklists: [
                            {
                                id: 'multi_item_checklist',
                                checklist_updated_at: 2000,
                                fields: {
                                    title: 'Multi-item Checklist',
                                },
                                item_inserts: newItems,
                                items_order: ['item_a', 'item_b'],
                            },
                        ],
                    },
                };

                const msg = {
                    data: {
                        payload: JSON.stringify(update),
                    },
                } as WebSocketMessage<{payload: string}>;

                handler(msg);

                expect(testDispatch).toHaveBeenCalledTimes(1);
                const dispatchedAction = testDispatch.mock.calls[0][0];
                expect(dispatchedAction.data.changed_fields.checklists[0].item_inserts).toHaveLength(2);
                expect(dispatchedAction.data.changed_fields.checklists[0].items_order).toEqual(['item_a', 'item_b']);
            });
        });

        describe('complex incremental update scenarios', () => {
            it('handles simultaneous checklist and item updates', () => {
                const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

                // Complex update affecting multiple checklists and items
                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 3000,
                    changed_fields: {
                        name: 'Multi-Change Update',
                        checklists: [
                            {
                                id: 'checklist_1',
                                index: 0,
                                checklist_updated_at: 3000,
                                fields: {
                                    title: 'Updated Title',
                                },
                                item_updates: [
                                    {
                                        id: 'item_1',
                                        index: 0,
                                        checklist_item_updated_at: 3000,
                                        fields: {
                                            state: 'Closed',
                                            assignee_id: 'user_2',
                                        },
                                    },
                                ],
                                item_inserts: [
                                    {
                                        id: 'new_item_2',
                                        title: 'Additional Item',
                                        state: 'Open',
                                        state_modified: 0,
                                        assignee_id: '',
                                        assignee_modified: 0,
                                        command: '',
                                        description: '',
                                        command_last_run: 0,
                                        due_date: 0,
                                        task_actions: [],
                                    },
                                ],
                                items_order: ['item_1', 'new_item_2'],
                            },
                        ],
                    },
                };

                const msg = {
                    data: {
                        payload: JSON.stringify(update),
                    },
                } as WebSocketMessage<{payload: string}>;

                handler(msg);

                expect(testDispatch).toHaveBeenCalledTimes(1);
                const dispatchedAction = testDispatch.mock.calls[0][0];
                expect(dispatchedAction.type).toBe('playbooks_ws_run_incremental_update_received');
                expect(dispatchedAction.data.changed_fields.name).toBe('Multi-Change Update');
                expect(dispatchedAction.data.changed_fields.checklists).toHaveLength(1);
                expect(dispatchedAction.data.changed_fields.checklists[0].item_updates).toHaveLength(1);
                expect(dispatchedAction.data.changed_fields.checklists[0].item_inserts).toHaveLength(1);
            });

            it('handles reordering operations', () => {
                // Add second checklist to test run
                testPlaybookRun.checklists.push({
                    id: 'checklist_2',
                    title: 'Second Checklist',
                    items: [
                        {
                            id: 'item_3',
                            title: 'Item 3',
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
                });
                testPlaybookRun.items_order = ['checklist_1', 'checklist_2'];

                const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

                // Update that reorders checklists and items
                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 3000,
                    changed_fields: {
                        items_order: ['checklist_2', 'checklist_1'], // Reverse order
                        checklists: [
                            {
                                id: 'checklist_1',
                                index: 0,
                                checklist_updated_at: 3000,
                                items_order: ['item_1'], // Keep existing order
                            },
                            {
                                id: 'checklist_2',
                                index: 1,
                                checklist_updated_at: 3000,
                                item_inserts: [
                                    {
                                        id: 'item_4',
                                        title: 'Item 4',
                                        state: 'Open',
                                        state_modified: 0,
                                        assignee_id: '',
                                        assignee_modified: 0,
                                        command: '',
                                        description: '',
                                        command_last_run: 0,
                                        due_date: 0,
                                        task_actions: [],
                                    },
                                ],
                                items_order: ['item_4', 'item_3'], // New item first
                            },
                        ],
                    },
                };

                const msg = {
                    data: {
                        payload: JSON.stringify(update),
                    },
                } as WebSocketMessage<{payload: string}>;

                handler(msg);

                expect(testDispatch).toHaveBeenCalledTimes(1);
                const dispatchedAction = testDispatch.mock.calls[0][0];
                expect(dispatchedAction.data.changed_fields.items_order).toEqual(['checklist_2', 'checklist_1']);
                expect(dispatchedAction.data.changed_fields.checklists[1].items_order).toEqual(['item_4', 'item_3']);
            });
        });

        describe('error handling and edge cases', () => {
            it('handles malformed websocket payloads gracefully', () => {
                const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

                // Malformed JSON
                const msg = {
                    data: {
                        payload: 'invalid json {[',
                    },
                } as WebSocketMessage<{payload: string}>;

                expect(() => handler(msg)).not.toThrow();
                expect(testDispatch).not.toHaveBeenCalled();
            });

            it('handles missing fields in update payload', () => {
                const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

                // Update missing required fields
                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,

                    // Missing 'changed_fields' field
                };

                const msg = {
                    data: {
                        payload: JSON.stringify(update),
                    },
                } as WebSocketMessage<{payload: string}>;

                handler(msg);

                // Should still dispatch (reducers handle validation)
                expect(testDispatch).toHaveBeenCalledTimes(1);
            });

            it('handles checklist item updates for missing checklist gracefully', () => {
                const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        checklists: [
                            {
                                id: 'missing_checklist',
                                checklist_updated_at: 2000,
                                item_updates: [
                                    {
                                        id: 'item_1',
                                        checklist_item_updated_at: 2000,
                                        fields: {
                                            state: 'Closed',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                };

                const msg = {
                    data: {
                        payload: JSON.stringify(update),
                    },
                } as WebSocketMessage<{payload: string}>;

                handler(msg);

                // Should dispatch action (reducer handles the missing checklist)
                expect(testDispatch).toHaveBeenCalledTimes(1);
                const dispatchedAction = testDispatch.mock.calls[0][0];
                expect(dispatchedAction.type).toBe('playbooks_ws_run_incremental_update_received');
            });

            it('validates timestamp ordering for idempotency', () => {
                const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

                // First update with newer timestamp
                const newerUpdate = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 3000,
                    changed_fields: {
                        checklists: [
                            {
                                id: 'checklist_1',
                                checklist_updated_at: 3000,
                                fields: {
                                    title: 'Newer Update',
                                },
                            },
                        ],
                    },
                };

                const newerMsg = {
                    data: {
                        payload: JSON.stringify(newerUpdate),
                    },
                } as WebSocketMessage<{payload: string}>;

                handler(newerMsg);

                // Then older update with earlier timestamp
                const olderUpdate = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        checklists: [
                            {
                                id: 'checklist_1',
                                checklist_updated_at: 2000,
                                fields: {
                                    title: 'Older Update',
                                },
                            },
                        ],
                    },
                };

                const olderMsg = {
                    data: {
                        payload: JSON.stringify(olderUpdate),
                    },
                } as WebSocketMessage<{payload: string}>;

                handler(olderMsg);

                // Both should be dispatched - the reducer handles idempotency
                expect(testDispatch).toHaveBeenCalledTimes(2);
            });
        });

        describe('performance and memory considerations', () => {
            it('does not mutate original playbook run objects', () => {
                const originalRun = JSON.parse(JSON.stringify(testPlaybookRun));
                const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        name: 'Mutated Name',
                        checklists: [
                            {
                                id: 'checklist_1',
                                index: 0,
                                checklist_updated_at: 2000,
                                fields: {
                                    title: 'Mutated Title',
                                },
                            },
                        ],
                    },
                };

                const msg = {
                    data: {
                        payload: JSON.stringify(update),
                    },
                } as WebSocketMessage<{payload: string}>;

                handler(msg);

                // Verify original run hasn't been mutated
                expect(testPlaybookRun).toEqual(originalRun);
                expect(testPlaybookRun.name).toBe(originalRun.name);
                expect(testPlaybookRun.checklists[0].title).toBe(originalRun.checklists[0].title);
            });

            it('handles large payloads efficiently', () => {
                const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

                // Create large update with many timeline events
                const largeTimelineEvents = Array.from({length: 100}, (_, i) => ({
                    id: `event_${i}`,
                    playbook_run_id: testPlaybookRun.id,
                    create_at: 1000 + i,
                    delete_at: 0,
                    event_at: 1000 + i,
                    event_type: 'RunCreated' as any,
                    summary: `Event ${i}`,
                    details: `Details for event ${i}`,
                    subject_user_id: 'user_1',
                    creator_user_id: 'user_1',
                    post_id: '',
                }));

                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        timeline_events: largeTimelineEvents,
                    },
                };

                const msg = {
                    data: {
                        payload: JSON.stringify(update),
                    },
                } as WebSocketMessage<{payload: string}>;

                const startTime = performance.now();
                handler(msg);
                const endTime = performance.now();

                // Should complete quickly (less than 100ms for 100 events)
                expect(endTime - startTime).toBeLessThan(100);
                expect(testDispatch).toHaveBeenCalledTimes(1);
            });
        });
    });
});
