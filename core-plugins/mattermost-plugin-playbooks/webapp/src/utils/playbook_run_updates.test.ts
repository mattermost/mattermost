// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';

import {applyIncrementalUpdate} from './playbook_run_updates';

describe('playbook_run_updates utilities', () => {
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
                update_at: 1000,
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
        current_status: PlaybookRunStatus.InProgress,
        type: PlaybookRunType.Playbook,
        items_order: ['checklist_1'],
    };

    describe('applyIncrementalUpdate', () => {
        it('should apply simple field updates', () => {
            const update = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    name: 'Updated Name',
                    owner_user_id: 'user_2',
                },
            };

            const result = applyIncrementalUpdate(testPlaybookRun, update);

            expect(result.name).toBe('Updated Name');
            expect(result.owner_user_id).toBe('user_2');
            expect(result.update_at).toBe(2000);
        });

        it('should not mutate the original run', () => {
            const update = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    name: 'Updated Name',
                },
            };

            const result = applyIncrementalUpdate(testPlaybookRun, update);

            expect(result).not.toBe(testPlaybookRun); // Different objects
            expect(testPlaybookRun.name).toBe('Test Run'); // Original unchanged
            expect(result.name).toBe('Updated Name'); // Result changed
        });
    });
});