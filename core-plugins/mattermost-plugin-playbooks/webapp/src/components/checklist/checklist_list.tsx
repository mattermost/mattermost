// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import {
    DragDropContext,
    Draggable,
    DraggableProvided,
    DraggableStateSnapshot,
    DropResult,
    Droppable,
    DroppableProvided,
} from 'react-beautiful-dnd';

import classNames from 'classnames';

import {FloatingPortal} from '@floating-ui/react';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {PlaybookRunType, PlaybookUpdates} from 'src/graphql/generated/graphql';
import {
    conditionCreated,
    conditionDeleted,
    conditionUpdated,
    playbookRunUpdated,
} from 'src/actions';
import {Checklist, ChecklistItem} from 'src/types/playbook';
import {
    clientAddChecklist,
    clientDeleteChecklist,
    clientMoveChecklist,
    clientMoveChecklistItem,
    deletePlaybookCondition,
    updatePlaybookCondition,
} from 'src/client';
import {ButtonsFormat as ItemButtonsFormat} from 'src/components/checklist_item/checklist_item';

import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';

import {usePlaybookAttributes, useProxyState} from 'src/hooks';
import {usePlaybookConditions} from 'src/hooks/conditions';
import {getDistinctAssignees} from 'src/utils';
import {ConditionExprV1} from 'src/types/conditions';

import CollapsibleChecklist, {ChecklistInputComponent, TitleHelpTextWrapper} from './collapsible_checklist';

import GenericChecklist, {generateKeys} from './generic_checklist';

// disable all react-beautiful-dnd development warnings
// @ts-ignore
window['__react-beautiful-dnd-disable-dev-warnings'] = true;

// Helper function to check if a task is adjacent to other tasks in its condition group
const isTaskAdjacentToConditionGroup = (
    items: ChecklistItem[],
    taskIndex: number,
    conditionId: string
): boolean => {
    // Check if there's another task with the same condition_id immediately before or after
    const hasPrevSibling = taskIndex > 0 && items[taskIndex - 1].condition_id === conditionId;
    const hasNextSibling = taskIndex < items.length - 1 && items[taskIndex + 1].condition_id === conditionId;

    return hasPrevSibling || hasNextSibling;
};

interface Props {
    playbookRun?: PlaybookRun;
    playbook?: Loaded<FullPlaybook>;
    isReadOnly: boolean;
    checklistsCollapseState: Record<number, boolean>;
    onChecklistCollapsedStateChange: (checklistIndex: number, state: boolean) => void;
    onEveryChecklistCollapsedStateChange: (state: Record<number, boolean>) => void;
    showItem?: (checklistItem: ChecklistItem, myId: string) => boolean;
    itemButtonsFormat?: ItemButtonsFormat;
    onReadOnlyInteract?: () => void;
    autoAddTask?: boolean;
    onTaskAdded?: () => void;
}

const ChecklistList = ({
    playbookRun,
    playbook: inPlaybook,
    isReadOnly,
    checklistsCollapseState,
    onChecklistCollapsedStateChange,
    onEveryChecklistCollapsedStateChange,
    showItem,
    itemButtonsFormat,
    onReadOnlyInteract,
    autoAddTask,
    onTaskAdded,
}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [addingChecklist, setAddingChecklist] = useState(false);
    const [newChecklistName, setNewChecklistName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [newlyCreatedConditionIds, setNewlyCreatedConditionIds] = useState<Set<string>>(new Set());

    const updatePlaybook = useUpdatePlaybook(inPlaybook?.id);
    const {conditions, createCondition} = usePlaybookConditions(inPlaybook?.id || '');
    const propertyFields = usePlaybookAttributes(inPlaybook?.id || '');
    const [playbook, setPlaybook] = useProxyState(inPlaybook, useCallback((updatedPlaybook) => {
        const updatedChecklists = updatedPlaybook?.checklists.map((cl) => ({
            ...cl,
            items: cl.items.map((ci) => ({
                title: ci.title,
                description: ci.description,
                state: ci.state,
                stateModified: ci.state_modified || 0,
                assigneeID: ci.assignee_id || '',
                assigneeModified: ci.assignee_modified || 0,
                command: ci.command,
                commandLastRun: ci.command_last_run,
                dueDate: ci.due_date,
                taskActions: ci.task_actions,
                conditionID: ci.condition_id,
            })),
        }));
        const updates: PlaybookUpdates = {
            checklists: updatedChecklists,
        };

        if (updatedPlaybook) {
            const preAssignees = getDistinctAssignees(updatedPlaybook.checklists);
            if (preAssignees.length && !updatedPlaybook.invite_users_enabled) {
                updates.inviteUsersEnabled = true;
            }

            // Append all assignees found in the updated checklists and clear duplicates
            // Only update the invited users when new assignees were added
            const invitedUsers = new Set([...updatedPlaybook.invited_user_ids, ...preAssignees]);
            if (invitedUsers.size > updatedPlaybook.invited_user_ids.length) {
                updates.invitedUserIDs = [...invitedUsers];
            }
        }

        updatePlaybook(updates);
    }, [updatePlaybook]), 0);
    const checklists = playbookRun?.checklists || playbook?.checklists || [];
    const finished = (playbookRun !== undefined) && (playbookRun.current_status === PlaybookRunStatus.Finished);
    const archived = playbook != null && playbook.delete_at !== 0 && !playbookRun;
    const readOnly = finished || archived || isReadOnly;

    if (!playbook && !playbookRun) {
        return null;
    }

    const setChecklistsForPlaybook = (newChecklists: Checklist[]) => {
        if (!playbook) {
            return;
        }

        const updated = newChecklists.map((cl) => {
            return {
                ...cl,
                items: cl.items.map((ci) => {
                    return {
                        ...ci,
                        state_modified: ci.state_modified || 0,
                        assignee_id: ci.assignee_id || '',
                        assignee_modified: ci.assignee_modified || 0,
                    };
                }),
            };
        });

        setPlaybook({...playbook, checklists: updated});
    };

    const onRenameChecklist = (index: number, title: string) => {
        const newChecklists = [...checklists];
        newChecklists[index].title = title;
        setChecklistsForPlaybook(newChecklists);
    };

    const onDuplicateChecklist = (index: number) => {
        const originalChecklist = checklists[index];
        const newChecklist = {
            ...originalChecklist,
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            items: originalChecklist.items.map((item) => ({
                ...item,
                id: `temp_item_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            })),
        };
        const newChecklists = [...checklists, newChecklist];
        setChecklistsForPlaybook(newChecklists);
    };

    const onDeleteChecklist = (index: number) => {
        if (playbookRun && playbookRun.type === PlaybookRunType.ChannelChecklist) {
            clientDeleteChecklist(playbookRun.id, index);
        } else {
            const newChecklists = [...checklists];
            newChecklists.splice(index, 1);
            setChecklistsForPlaybook(newChecklists);
        }
    };

    const onUpdateChecklist = (index: number, newChecklist: Checklist) => {
        const newChecklists = [...checklists];
        newChecklists[index] = {...newChecklist};
        setChecklistsForPlaybook(newChecklists);
    };

    const onDeleteCondition = async (conditionId: string) => {
        try {
            // Remove condition from all items that reference it
            const newChecklists = checklists.map((checklist) => ({
                ...checklist,
                items: checklist.items.map((item) => ({
                    ...item,
                    condition_id: item.condition_id === conditionId ? '' : item.condition_id,
                })),
            }));
            setChecklistsForPlaybook(newChecklists);

            // Delete the condition on the server
            await deletePlaybookCondition(playbook?.id || '', conditionId);

            // Dispatch Redux action to remove from store immediately
            dispatch(conditionDeleted(conditionId, playbook?.id || ''));
        } catch (error) {
            console.error('Failed to delete condition:', error); // eslint-disable-line no-console
        }
    };

    const onCreateCondition = async (checklistIndex: number, itemIndex: number, expr: ConditionExprV1) => {
        try {
            // Create the condition on the server
            const result = await createCondition({
                version: 1,
                condition_expr: expr,
                playbook_id: playbook?.id || '',
            });

            // Mark this condition as newly created so it starts in edit mode
            setNewlyCreatedConditionIds((prev) => new Set(prev).add(result.id));

            // Dispatch Redux action to add to store immediately
            dispatch(conditionCreated(result));

            // Update the item with the new condition_id
            const newChecklists = [...checklists];
            const newItems = [...newChecklists[checklistIndex].items];
            newItems[itemIndex] = {
                ...newItems[itemIndex],
                condition_id: result.id,
            };
            newChecklists[checklistIndex] = {
                ...newChecklists[checklistIndex],
                items: newItems,
            };
            setChecklistsForPlaybook(newChecklists);

            // Remove from newly created set after a short delay to allow initial edit
            setTimeout(() => {
                setNewlyCreatedConditionIds((prev) => {
                    const next = new Set(prev);
                    next.delete(result.id);
                    return next;
                });
            }, 100);
        } catch (error) {
            console.error('Failed to create condition:', error); // eslint-disable-line no-console
        }
    };

    const onUpdateCondition = async (conditionId: string, expr: ConditionExprV1) => {
        try {
            const existingCondition = conditions.find((c) => c.id === conditionId);
            if (!existingCondition) {
                return;
            }

            // Update the condition on the server
            const updatedCondition = await updatePlaybookCondition(playbook?.id || '', conditionId, {
                ...existingCondition,
                condition_expr: expr,
            });

            // Dispatch Redux action to update the store immediately
            dispatch(conditionUpdated(updatedCondition));
        } catch (error) {
            console.error('Failed to update condition:', error); // eslint-disable-line no-console
        }
    };

    const onMoveItemToCondition = (sourceChecklistIndex: number, itemIndex: number, conditionId: string) => {
        // Find the target checklist that contains items with this condition_id
        let targetChecklistIndex = -1;
        let lastConditionItemIndex = -1;

        // Search for the last item with this condition_id across all checklists
        for (let checklistIdx = checklists.length - 1; checklistIdx >= 0; checklistIdx--) {
            const checklist = checklists[checklistIdx];
            for (let itemIdx = checklist.items.length - 1; itemIdx >= 0; itemIdx--) {
                if (checklist.items[itemIdx].condition_id === conditionId) {
                    targetChecklistIndex = checklistIdx;
                    lastConditionItemIndex = itemIdx;
                    break;
                }
            }
            if (targetChecklistIndex >= 0) {
                break;
            }
        }

        const newChecklists = [...checklists];
        const sourceChecklist = checklists[sourceChecklistIndex];
        const item = {...sourceChecklist.items[itemIndex], condition_id: conditionId};

        if (targetChecklistIndex >= 0 && targetChecklistIndex !== sourceChecklistIndex) {
            // Move item to a different checklist
            const newSourceItems = [...sourceChecklist.items];
            newSourceItems.splice(itemIndex, 1);

            const targetChecklist = checklists[targetChecklistIndex];
            const newTargetItems = [...targetChecklist.items];

            // Insert after the last item in the condition group
            newTargetItems.splice(lastConditionItemIndex + 1, 0, item);

            newChecklists[sourceChecklistIndex] = {...sourceChecklist, items: newSourceItems};
            newChecklists[targetChecklistIndex] = {...targetChecklist, items: newTargetItems};
        } else if (targetChecklistIndex >= 0) {
            // Same checklist - reorder within it
            const newItems = [...sourceChecklist.items];
            newItems.splice(itemIndex, 1);

            // Adjust target position if we removed an item before it
            const targetIndex = itemIndex < lastConditionItemIndex ? lastConditionItemIndex : lastConditionItemIndex + 1;
            newItems.splice(targetIndex, 0, item);

            newChecklists[sourceChecklistIndex] = {...sourceChecklist, items: newItems};
        } else {
            // No existing items with this condition - just update the condition_id in place
            const newItems = [...sourceChecklist.items];
            newItems[itemIndex] = item;
            newChecklists[sourceChecklistIndex] = {...sourceChecklist, items: newItems};
        }

        setChecklistsForPlaybook(newChecklists);
    };

    const onDragStart = () => {
        setIsDragging(true);
    };

    const onDragEnd = (result: DropResult) => {
        setIsDragging(false);

        // If the item is dropped out of any droppable zones, do nothing
        if (!result.destination) {
            return;
        }

        const [srcIdx, dstIdx] = [result.source.index, result.destination.index];

        // If the source and desination are the same, do nothing
        if (result.destination.droppableId === result.source.droppableId && srcIdx === dstIdx) {
            return;
        }

        // Copy the data to modify it
        const newChecklists = [...checklists];

        // Move a checklist item, either inside of the same checklist, or between checklists
        if (result.type === 'checklist-item') {
            // Simple flat list - droppableId is just the checklist index
            const srcChecklistIdx = parseInt(result.source.droppableId, 10);
            const dstChecklistIdx = parseInt(result.destination.droppableId, 10);

            if (srcChecklistIdx === dstChecklistIdx) {
                // Moving within the same checklist - simple reorder
                const newChecklistItems = [...checklists[srcChecklistIdx].items];
                const [moved] = newChecklistItems.splice(srcIdx, 1);

                // Check if we should update the condition_id based on adjacent tasks
                let updatedItem = moved;

                // Temporarily insert to check what's adjacent
                newChecklistItems.splice(dstIdx, 0, moved);

                // Check if dropped adjacent to a condition group
                const prevItem = dstIdx > 0 ? newChecklistItems[dstIdx - 1] : null;
                const nextItem = dstIdx < newChecklistItems.length - 1 ? newChecklistItems[dstIdx + 1] : null;

                // Determine if we should join a condition group or leave one
                const prevConditionId = prevItem?.condition_id || '';
                const nextConditionId = nextItem?.condition_id || '';

                if (prevConditionId && prevConditionId === nextConditionId) {
                    // Dropped between two tasks in the same condition group - join that group
                    updatedItem = {...moved, condition_id: prevConditionId};
                } else if (moved.condition_id) {
                    // Check if still adjacent to original condition group
                    const isStillAdjacentToOriginalGroup = isTaskAdjacentToConditionGroup(
                        newChecklistItems,
                        dstIdx,
                        moved.condition_id
                    );

                    if (!isStillAdjacentToOriginalGroup) {
                        // Separated from original group - remove condition
                        updatedItem = {...moved, condition_id: ''};
                    }
                }

                // Remove the temporarily inserted item
                newChecklistItems.splice(dstIdx, 1);

                // Insert the final item (either original or updated)
                newChecklistItems.splice(dstIdx, 0, updatedItem);

                newChecklists[srcChecklistIdx] = {
                    ...newChecklists[srcChecklistIdx],
                    items: newChecklistItems,
                };
            } else {
                // Moving between different checklists
                const srcChecklist = checklists[srcChecklistIdx];
                const dstChecklist = checklists[dstChecklistIdx];

                // Remove from source
                const newSrcChecklistItems = [...srcChecklist.items];
                const [moved] = newSrcChecklistItems.splice(srcIdx, 1);

                // Insert into destination temporarily to check adjacency
                const newDstChecklistItems = [...dstChecklist.items];
                newDstChecklistItems.splice(dstIdx, 0, moved);

                // Check if dropped adjacent to a condition group in the destination checklist
                const prevItem = dstIdx > 0 ? newDstChecklistItems[dstIdx - 1] : null;
                const nextItem = dstIdx < newDstChecklistItems.length - 1 ? newDstChecklistItems[dstIdx + 1] : null;

                const prevConditionId = prevItem?.condition_id || '';
                const nextConditionId = nextItem?.condition_id || '';

                let updatedItem = moved;

                if (prevConditionId && prevConditionId === nextConditionId) {
                    // Dropped between two tasks in the same condition group - join that group
                    updatedItem = {...moved, condition_id: prevConditionId};
                } else {
                    // Not between condition group items - clear condition_id
                    updatedItem = {...moved, condition_id: ''};
                }

                // Remove the temporarily inserted item and insert the updated one
                newDstChecklistItems.splice(dstIdx, 1);
                newDstChecklistItems.splice(dstIdx, 0, updatedItem);

                // Update both checklists
                newChecklists[srcChecklistIdx] = {
                    ...srcChecklist,
                    items: newSrcChecklistItems,
                };
                newChecklists[dstChecklistIdx] = {
                    ...dstChecklist,
                    items: newDstChecklistItems,
                };
            }

            // Persist the new data in the server
            if (playbookRun) {
                clientMoveChecklistItem(playbookRun.id, srcChecklistIdx, srcIdx, dstChecklistIdx, dstIdx);
            }
        }

        // Move a whole checklist
        if (result.type === 'checklist') {
            const [moved] = newChecklists.splice(srcIdx, 1);
            newChecklists.splice(dstIdx, 0, moved);

            if (playbookRun) {
                // The collapsed state of a checklist in the store is linked to the index in the list,
                // so we need to shift all indices between srcIdx and dstIdx to the left (or to the
                // right, depending on whether srcIdx < dstIdx) one position
                const newState = {...checklistsCollapseState};
                if (srcIdx < dstIdx) {
                    for (let i = srcIdx; i < dstIdx; i++) {
                        newState[i] = checklistsCollapseState[i + 1];
                    }
                } else {
                    for (let i = dstIdx + 1; i <= srcIdx; i++) {
                        newState[i] = checklistsCollapseState[i - 1];
                    }
                }
                newState[dstIdx] = checklistsCollapseState[srcIdx];

                onEveryChecklistCollapsedStateChange(newState);

                // Persist the new data in the server
                clientMoveChecklist(playbookRun.id, srcIdx, dstIdx);
            }
        }

        // Update the store with the new checklists
        if (playbookRun) {
            dispatch(playbookRunUpdated({
                ...playbookRun,
                checklists: newChecklists,
            }));
        } else {
            setChecklistsForPlaybook(newChecklists);
        }
    };

    let addChecklist = (
        <AddChecklistLink
            disabled={archived}
            onClick={(e) => {
                e.stopPropagation();
                setAddingChecklist(true);
            }}
            data-testid={'add-a-checklist-button'}
        >
            <IconWrapper>
                <i className='icon icon-plus'/>
            </IconWrapper>
            {formatMessage({defaultMessage: 'Add a section'})}
        </AddChecklistLink>
    );

    if (addingChecklist) {
        addChecklist = (
            <NewChecklist>
                <ChecklistInputComponent
                    title={newChecklistName}
                    setTitle={setNewChecklistName}
                    onCancel={() => {
                        setAddingChecklist(false);
                        setNewChecklistName('');
                    }}
                    onSave={() => {
                        const finalTitle = newChecklistName.trim() || 'Untitled section';
                        if (playbookRun) {
                            const newChecklist: Omit<Checklist, 'id'> = {title: finalTitle, items: [] as ChecklistItem[]};
                            clientAddChecklist(playbookRun.id, newChecklist);
                        } else {
                            const newChecklist: Checklist = {
                                title: finalTitle,
                                items: [] as ChecklistItem[],
                            };
                            setChecklistsForPlaybook([...checklists, newChecklist]);
                        }
                        setTimeout(() => setNewChecklistName(''), 300);
                        setAddingChecklist(false);
                    }}
                />
            </NewChecklist>
        );
    }

    const keys = generateKeys(checklists.map((checklist, index) => checklist.title + index));

    return (
        <>
            <DragDropContext
                onDragEnd={onDragEnd}
                onDragStart={onDragStart}
            >
                <Droppable
                    droppableId={'all-checklists'}
                    direction={'vertical'}
                    type={'checklist'}
                >
                    {(droppableProvided: DroppableProvided) => (
                        <ChecklistsContainer
                            {...droppableProvided.droppableProps}
                            className={classNames('checklists', {isDragging})}
                            ref={droppableProvided.innerRef}
                        >
                            {checklists.map((checklist: Checklist, checklistIndex: number) => (
                                <Draggable
                                    key={keys[checklistIndex]}
                                    draggableId={checklist.title + checklistIndex}
                                    index={checklistIndex}
                                >
                                    {(draggableProvided: DraggableProvided, snapshot: DraggableStateSnapshot) => {
                                        const component = (
                                            <CollapsibleChecklist
                                                draggableProvided={draggableProvided}
                                                title={checklist.title}
                                                items={checklist.items}
                                                index={checklistIndex}
                                                collapsed={Boolean(checklistsCollapseState[checklistIndex])}
                                                setCollapsed={(newState) => onChecklistCollapsedStateChange(checklistIndex, newState)}
                                                disabled={readOnly}
                                                playbookRunID={playbookRun?.id}
                                                onRenameChecklist={onRenameChecklist}
                                                onDuplicateChecklist={onDuplicateChecklist}
                                                onDeleteChecklist={onDeleteChecklist}
                                                isChannelChecklist={playbookRun?.type === PlaybookRunType.ChannelChecklist}
                                                titleHelpText={playbook ? (
                                                    <TitleHelpTextWrapper>
                                                        {formatMessage(
                                                            {defaultMessage: '{numTasks, number} {numTasks, plural, one {task} other {tasks}}'},
                                                            {numTasks: checklist.items.length},
                                                        )}
                                                    </TitleHelpTextWrapper>
                                                ) : undefined}
                                            >
                                                <GenericChecklist
                                                    id={playbookRun?.id || ''}
                                                    playbookRun={playbookRun}
                                                    playbookId={playbook?.id || playbookRun?.playbook_id || ''}
                                                    readOnly={readOnly}
                                                    checklist={checklist}
                                                    checklistIndex={checklistIndex}
                                                    onUpdateChecklist={(newChecklist: Checklist) => onUpdateChecklist(checklistIndex, newChecklist)}
                                                    showItem={showItem}
                                                    itemButtonsFormat={itemButtonsFormat}
                                                    onReadOnlyInteract={onReadOnlyInteract}
                                                    conditions={conditions}
                                                    propertyFields={propertyFields || []}
                                                    onDeleteCondition={onDeleteCondition}
                                                    onCreateCondition={(expr, itemIndex) => onCreateCondition(checklistIndex, itemIndex, expr)}
                                                    onUpdateCondition={onUpdateCondition}
                                                    newlyCreatedConditionIds={newlyCreatedConditionIds}
                                                    autoAddTask={autoAddTask && checklistIndex === 0}
                                                    onTaskAdded={onTaskAdded}
                                                    isChannelChecklist={playbookRun?.type === PlaybookRunType.ChannelChecklist}
                                                    allChecklists={checklists}
                                                    onMoveItemToCondition={(itemIndex: number, conditionId: string) => onMoveItemToCondition(checklistIndex, itemIndex, conditionId)}
                                                />
                                            </CollapsibleChecklist>
                                        );

                                        if (snapshot.isDragging) {
                                            return <FloatingPortal>{component}</FloatingPortal>;
                                        }

                                        return component;
                                    }}
                                </Draggable>
                            ))}
                            {droppableProvided.placeholder}
                        </ChecklistsContainer>
                    )}
                </Droppable>
                {!readOnly && addChecklist}
            </DragDropContext>
        </>
    );
};

const AddChecklistLink = styled.button`
    display: flex;
    width: 100%;
    height: 44px;
    flex-direction: row;
    align-items: center;
    border: 1px dashed;
    border-color: var(--center-channel-color-16);
    border-radius: 4px;
    background: none;
    color: var(--center-channel-color-64);
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;

    &:hover:not(:disabled) {
        background-color: var(--button-bg-08);
        color: var(--button-bg);
    }
`;

const NewChecklist = styled.div`
    position: sticky;
    z-index: 1;
    top: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    border-radius: 4px 4px 0 0;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
`;

const ChecklistsContainer = styled.div`
    :is(:first-child) {
        margin-top: 12px;
    }
`;

const IconWrapper = styled.div`
    padding: 3px 0 0 1px;
    margin: 0;
`;

export default ChecklistList;
