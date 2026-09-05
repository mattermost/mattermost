// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaybookRun, StatusPost} from 'src/types/playbook_run';
import {Checklist, ChecklistItem} from 'src/types/playbook';
import {TimelineEvent} from 'src/types/rhs';
import {ChecklistUpdate, PlaybookRunUpdate} from 'src/types/websocket_events';

// Helper function to apply incremental updates idempotently
export function applyIncrementalUpdate(currentRun: PlaybookRun, update: PlaybookRunUpdate): PlaybookRun {
    // Check if this update is older than the current state
    if (currentRun.update_at && update.playbook_run_updated_at &&
        update.playbook_run_updated_at > 0 &&
        currentRun.update_at > update.playbook_run_updated_at) {
        // We already have a newer update, skip this one
        return currentRun;
    }

    // Create a new run object with the timestamp update
    // If update timestamp is 0 or missing, preserve original timestamp
    const newUpdateAt = update.playbook_run_updated_at && update.playbook_run_updated_at > 0 ?
        update.playbook_run_updated_at :
        currentRun.update_at;

    let updatedRun = {
        ...currentRun,
        update_at: newUpdateAt,
    };

    // Apply checklist deletions first
    if (update.checklist_deletes && update.checklist_deletes.length > 0) {
        const deleteSet = new Set(update.checklist_deletes);
        updatedRun = {
            ...updatedRun,
            checklists: updatedRun.checklists.filter((checklist) => checklist.id && !deleteSet.has(checklist.id)),
        };
    }

    // Apply timeline event deletions
    if (update.timeline_event_deletes && update.timeline_event_deletes.length > 0) {
        const deleteSet = new Set(update.timeline_event_deletes);
        const filteredEvents = updatedRun.timeline_events?.filter((event) => event.id && !deleteSet.has(event.id)) || [];
        updatedRun = {
            ...updatedRun,
            timeline_events: filteredEvents,
        };
    }

    // Apply status post deletions
    if (update.status_post_deletes && update.status_post_deletes.length > 0) {
        const deleteSet = new Set(update.status_post_deletes);
        updatedRun = {
            ...updatedRun,
            status_posts: updatedRun.status_posts?.filter((post) => post.id && !deleteSet.has(post.id)) || [],
        };
    }

    // Apply the changed fields to get a new run
    updatedRun = applyChangedFields(updatedRun, update.changed_fields);

    return updatedRun;
}

// Helper function to apply changed fields to a playbook run
function applyChangedFields(run: PlaybookRun, changedFields: PlaybookRunUpdate['changed_fields']): PlaybookRun {
    const {timeline_events, checklists, status_posts, ...basicFields} = changedFields;

    // Apply only valid basic fields with type safety
    const validBasicFields = Object.fromEntries(
        Object.entries(basicFields).filter(([field]) => field in run)
    );

    let updatedRun = {...run, ...validBasicFields};

    // Handle timeline events specially by merging them with existing events
    if (timeline_events) {
        updatedRun = applyTimelineUpdates(updatedRun, timeline_events);
    }

    // Handle status posts specially by merging them with existing posts
    if (status_posts) {
        updatedRun = applyStatusPostUpdates(updatedRun, status_posts);
    }

    // Apply checklist updates if provided by the server
    if (checklists) {
        updatedRun = applyChecklistUpdates(updatedRun, checklists);
    }

    return updatedRun;
}

// Helper function to apply timeline updates
function applyTimelineUpdates(run: PlaybookRun, timelineEvents: TimelineEvent[]): PlaybookRun {
    // If we don't have any existing timeline events, just set them
    if (!run.timeline_events || !Array.isArray(run.timeline_events)) {
        return {
            ...run,
            timeline_events: [...timelineEvents],
        };
    }

    // Merge new timeline events with existing ones
    // Create a map of existing events by ID for quick lookup
    const existingEventsMap = new Map<string, TimelineEvent>();
    run.timeline_events.forEach((event) => {
        if (event?.id) {
            existingEventsMap.set(event.id, event);
        }
    });

    // Process each event from the update
    timelineEvents.forEach((newEvent) => {
        if (newEvent?.id) {
            // If an event with this ID already exists, replace it
            // Otherwise, it's a new event to add
            existingEventsMap.set(newEvent.id, newEvent);
        }
    });

    // Convert the map back to an array and sort by create_at
    const updatedEvents = Array.from(existingEventsMap.values());
    updatedEvents.sort((a, b) => a.create_at - b.create_at);

    return {
        ...run,
        timeline_events: updatedEvents,
    };
}

// Helper function to apply status post updates
function applyStatusPostUpdates(run: PlaybookRun, statusPosts: StatusPost[]): PlaybookRun {
    // If we don't have any existing status posts, just set them
    if (!run.status_posts || !Array.isArray(run.status_posts)) {
        return {
            ...run,
            status_posts: [...statusPosts],
        };
    }

    // Create a map of existing posts by ID for efficient lookup
    const existingPostsMap = new Map<string, StatusPost>();
    run.status_posts.forEach((post) => {
        if (post?.id) {
            existingPostsMap.set(post.id, post);
        }
    });

    // Process each post from the update
    statusPosts.forEach((newPost) => {
        if (newPost?.id) {
            // Add new post or update existing one
            existingPostsMap.set(newPost.id, newPost);
        }
    });

    // Convert the map back to an array and sort by create_at
    const updatedPosts = Array.from(existingPostsMap.values());
    updatedPosts.sort((a, b) => a.create_at - b.create_at);

    return {
        ...run,
        status_posts: updatedPosts,
    };
}

// Utility to create a Map from an array of objects with IDs
const mapFromChecklists = (checklists: Checklist[]) => {
    return new Map(
        checklists
            .filter((checklist) => checklist.id != null)
            .map((checklist) => [checklist.id!, checklist])
    );
};

// Helper to create a new checklist from an update
function createNewChecklist(update: ChecklistUpdate): Checklist {
    const baseChecklist: Checklist = {
        id: update.id,
        title: '',
        items: update.item_inserts ? [...update.item_inserts] : [],
    };

    // Apply field updates if provided
    if (update.fields) {
        return {
            ...baseChecklist,
            ...update.fields,
        };
    }

    return baseChecklist;
}

// Helper to apply item-level updates to a checklist
function applyItemUpdates(items: ChecklistItem[], update: ChecklistUpdate): ChecklistItem[] {
    let updatedItems = [...items];

    // Apply item updates
    if (update.item_updates && update.item_updates.length > 0) {
        for (const itemUpdate of update.item_updates) {
            const itemIndex = updatedItems.findIndex((item) => item.id === itemUpdate.id);
            if (itemIndex !== -1) {
                updatedItems[itemIndex] = {
                    ...updatedItems[itemIndex],
                    ...itemUpdate.fields,
                };
            }
        }
    }

    // Apply item deletions using Set for efficient lookup
    if (update.item_deletes && update.item_deletes.length > 0) {
        const deleteSet = new Set(update.item_deletes);
        updatedItems = updatedItems.filter((item) => item.id && !deleteSet.has(item.id));
    }

    // Apply item insertions with duplicate prevention
    if (update.item_inserts && update.item_inserts.length > 0) {
        const existingItemIds = new Set(updatedItems.map((item) => item.id).filter(Boolean));

        // Deduplicate within the payload itself and filter out existing items
        const uniqueNewItems = update.item_inserts.filter((item, index, array) =>
            item.id && !existingItemIds.has(item.id) &&
            array.findIndex((i) => i.id === item.id) === index
        );

        updatedItems = [...updatedItems, ...uniqueNewItems];
    }

    return updatedItems;
}

// Helper function to reorder items according to items_order array
function reorderItemsByOrder(items: ChecklistItem[], itemsOrder: string[]): ChecklistItem[] {
    const itemsMap = new Map(items.map((item) => [item.id, item]));
    const orderedItems: ChecklistItem[] = [];

    // Add items in the order specified by items_order
    for (const itemId of itemsOrder) {
        const item = itemsMap.get(itemId);
        if (item) {
            orderedItems.push(item);
            itemsMap.delete(itemId);
        }
    }

    // Add any remaining items that weren't in items_order
    for (const remainingItem of itemsMap.values()) {
        orderedItems.push(remainingItem);
    }

    return orderedItems;
}

// Helper to apply field updates to an existing checklist
function applyUpdateToChecklist(checklist: Checklist, update: ChecklistUpdate): Checklist {
    let updatedChecklist = {...checklist};

    // Apply checklist field updates
    if (update.fields) {
        for (const [field, value] of Object.entries(update.fields)) {
            if (field in updatedChecklist && field !== 'items') {
                updatedChecklist = {
                    ...updatedChecklist,
                    [field]: value,
                };
            }
        }
    }

    // Handle items_order (checklist item ordering) from dedicated field
    if (update.items_order) {
        updatedChecklist = {
            ...updatedChecklist,
            items_order: update.items_order,
        };
    }

    // Apply item-level updates
    let updatedItems = applyItemUpdates(updatedChecklist.items, update);

    // Reorder items according to items_order if provided
    if (update.items_order && update.items_order.length > 0) {
        updatedItems = reorderItemsByOrder(updatedItems, update.items_order);
    }

    return {
        ...updatedChecklist,
        items: updatedItems,
    };
}

// Helper function to apply checklist updates
function applyChecklistUpdates(run: PlaybookRun, updates: ChecklistUpdate[]): PlaybookRun {
    const checklistsMap = mapFromChecklists(run.checklists);
    const newChecklistIds: string[] = [];

    for (const update of updates) {
        const existingChecklist = checklistsMap.get(update.id);

        if (existingChecklist) {
            // Existing checklist found - apply updates
            const updatedChecklist = applyUpdateToChecklist(existingChecklist, update);
            checklistsMap.set(update.id, updatedChecklist);
        } else {
            // Checklist not found - create new one
            const newChecklist = createNewChecklist(update);
            checklistsMap.set(update.id, newChecklist);
            newChecklistIds.push(update.id);
        }
    }

    // Preserve original order + append new checklists at the end
    const orderedChecklists: Checklist[] = [];

    // Add existing checklists in their original order
    for (const originalChecklist of run.checklists) {
        if (!originalChecklist.id) {
            // Skip checklists without IDs - they can't be updated incrementally
            continue;
        }
        const updated = checklistsMap.get(originalChecklist.id);
        if (updated) {
            orderedChecklists.push(updated);
        }
    }

    // Add new checklists at the end
    for (const newId of newChecklistIds) {
        const newChecklist = checklistsMap.get(newId);
        if (newChecklist) {
            orderedChecklists.push(newChecklist);
        }
    }

    return {
        ...run,
        checklists: orderedChecklists,
    };
}