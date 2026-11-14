// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import manifest from 'src/manifest';

import {PlaybookRun} from './playbook_run';
import {Checklist, ChecklistItem} from './playbook';

export const WEBSOCKET_PLAYBOOK_RUN_UPDATED = `custom_${manifest.id}_playbook_run_updated`;
export const WEBSOCKET_PLAYBOOK_RUN_CREATED = `custom_${manifest.id}_playbook_run_created`;
export const WEBSOCKET_PLAYBOOK_CREATED = `custom_${manifest.id}_playbook_created`;
export const WEBSOCKET_PLAYBOOK_ARCHIVED = `custom_${manifest.id}_playbook_archived`;
export const WEBSOCKET_PLAYBOOK_RESTORED = `custom_${manifest.id}_playbook_restored`;

// New WebSocket events for incremental updates
export const WEBSOCKET_PLAYBOOK_RUN_UPDATED_INCREMENTAL = `custom_${manifest.id}_playbook_run_updated_incremental`;
export const WEBSOCKET_SETTINGS_CHANGED = `custom_${manifest.id}_settings_changed`;

// Condition WebSocket events
export const WEBSOCKET_CONDITION_CREATED = `custom_${manifest.id}_condition_created`;
export const WEBSOCKET_CONDITION_UPDATED = `custom_${manifest.id}_condition_updated`;
export const WEBSOCKET_CONDITION_DELETED = `custom_${manifest.id}_condition_deleted`;

// Interfaces for incremental updates
export interface PlaybookRunUpdate {
    id: string;
    playbook_run_updated_at: number;
    changed_fields: Omit<Partial<PlaybookRun>, 'checklists'> & {
        checklists?: ChecklistUpdate[];
    };
    checklist_deletes?: string[];
    timeline_event_deletes?: string[];
    status_post_deletes?: string[];
}

export interface ChecklistUpdate {
    id: string;
    checklist_updated_at?: number;
    fields?: Omit<Partial<Checklist>, 'items'>;
    item_updates?: ChecklistItemUpdate[];
    item_deletes?: string[];
    item_inserts?: ChecklistItem[];
    items_order?: string[];
}

export interface ChecklistItemUpdate {
    id: string;
    checklist_item_updated_at?: number;
    fields: Partial<ChecklistItem>;
}
