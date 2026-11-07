// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import {Droppable, DroppableProvided} from 'react-beautiful-dnd';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {Checklist, ChecklistItem, emptyChecklistItem} from 'src/types/playbook';
import DraggableChecklistItem from 'src/components/checklist_item/checklist_item_draggable';
import {ButtonsFormat as ItemButtonsFormat} from 'src/components/checklist_item/checklist_item';
import {PlaybookRun} from 'src/types/playbook_run';
import {Condition, ConditionExprV1} from 'src/types/conditions';
import {PropertyField} from 'src/types/properties';
import {clientDeleteChecklistItem} from 'src/client';

import ConditionHeader from './condition_header';

// disable all react-beautiful-dnd development warnings
// @ts-ignore
window['__react-beautiful-dnd-disable-dev-warnings'] = true;

interface Props {
    id: string
    playbookRun?: PlaybookRun
    playbookId?: string,
    readOnly: boolean;
    checklist: Checklist;
    checklistIndex: number;
    onUpdateChecklist: (newChecklist: Checklist) => void;
    showItem?: (checklistItem: ChecklistItem, myId: string) => boolean
    itemButtonsFormat?: ItemButtonsFormat;
    onReadOnlyInteract?: () => void;
    conditions?: Condition[];
    propertyFields?: PropertyField[];
    onDeleteCondition?: (conditionId: string) => void;
    onCreateCondition?: (expr: ConditionExprV1, itemIndex: number) => void;
    onUpdateCondition?: (conditionId: string, expr: ConditionExprV1) => void;
    newlyCreatedConditionIds?: Set<string>;
    autoAddTask?: boolean;
    onTaskAdded?: () => void;
    isChannelChecklist?: boolean;
    allChecklists?: Checklist[];
    onMoveItemToCondition?: (itemIndex: number, conditionId: string) => void;
}

const GenericChecklist = (props: Props) => {
    const {formatMessage} = useIntl();
    const myUser = useSelector(getCurrentUser);
    const [addingItem, setAddingItem] = useState(props.autoAddTask ?? false);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [newItemKey, setNewItemKey] = useState(0);

    // Auto-add task on mount if requested
    useEffect(() => {
        if (props.autoAddTask && !addingItem) {
            setAddingItem(true);
            props.onTaskAdded?.();
        }
    }, [props.autoAddTask]); // Only run when autoAddTask changes

    const onUpdateChecklistItem = (index: number, newItem: ChecklistItem) => {
        const newChecklistItems = [...props.checklist.items];
        newChecklistItems[index] = newItem;
        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);
    };

    const onAddChecklistItem = (newItem: ChecklistItem) => {
        const newChecklistItems = [...props.checklist.items];
        newChecklistItems.push(newItem);
        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);
    };

    const onDuplicateChecklistItem = (index: number) => {
        const newChecklistItems = [...props.checklist.items];
        const duplicate = {
            ...newChecklistItems[index],
            id: `temp_item_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        };
        newChecklistItems.splice(index + 1, 0, duplicate);
        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);
    };

    const onDeleteChecklistItem = (index: number) => {
        if (props.playbookRun && props.isChannelChecklist) {
            clientDeleteChecklistItem(props.playbookRun.id, props.checklistIndex, index);
        } else {
            const newChecklistItems = [...props.checklist.items];
            newChecklistItems.splice(index, 1);
            const newChecklist = {...props.checklist};
            newChecklist.items = newChecklistItems;
            props.onUpdateChecklist(newChecklist);
        }
    };

    const onOpenConditionEditor = (index: number) => {
        // Create a default condition directly with the first available field
        if (props.propertyFields && props.propertyFields.length > 0 && props.onCreateCondition) {
            const firstField = props.propertyFields.find((field) =>
                field.type === 'text' || field.type === 'select' || field.type === 'multiselect'
            );

            if (firstField) {
                let defaultValue: string | string[] = '';
                if (firstField.type === 'select' || firstField.type === 'multiselect') {
                    // Use first option if available
                    defaultValue = firstField.attrs.options?.[0]?.id ? [firstField.attrs.options[0].id] : [];
                }

                const expr: ConditionExprV1 = {
                    is: {
                        field_id: firstField.id,
                        value: defaultValue,
                    },
                };

                props.onCreateCondition(expr, index);
            }
        }
    };

    // Check if we can add conditionals (need property fields)
    const canAddConditional = props.propertyFields && props.propertyFields.length > 0 &&
        props.propertyFields.some((field) => field.type === 'text' || field.type === 'select' || field.type === 'multiselect');

    const onRemoveFromCondition = (index: number) => {
        const item = props.checklist.items[index];
        const conditionId = item.condition_id;

        // Find the last item in the condition group (before removal)
        let lastConditionItemIndex = -1;
        for (let i = props.checklist.items.length - 1; i >= 0; i--) {
            if (props.checklist.items[i].condition_id === conditionId) {
                lastConditionItemIndex = i;
                break;
            }
        }

        const newChecklistItems = [...props.checklist.items];
        const updatedItem = {...newChecklistItems[index], condition_id: ''};

        // Check if there are other items in the condition group
        const otherItemsInGroup = newChecklistItems.filter((checklistItem, idx) =>
            idx !== index && checklistItem.condition_id === conditionId
        );

        if (otherItemsInGroup.length > 0) {
            // Remove the item from its current position
            newChecklistItems.splice(index, 1);

            // Calculate the position right after the last item in the group
            // Adjust if we removed an item before the last item
            const targetIndex = index < lastConditionItemIndex ? lastConditionItemIndex : lastConditionItemIndex + 1;

            // Insert the item (with condition_id cleared) right after the group
            newChecklistItems.splice(targetIndex, 0, updatedItem);
        } else {
            // This was the only item in the group, just clear its condition_id in place
            newChecklistItems[index] = updatedItem;
        }

        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);

        // Check if this was the last item with this condition_id
        if (conditionId) {
            const remainingItemsWithCondition = newChecklistItems.filter((checklistItem) => checklistItem.condition_id === conditionId);
            if (remainingItemsWithCondition.length === 0 && props.onDeleteCondition) {
                // Delete the condition group since it's now empty
                props.onDeleteCondition(conditionId);
            }
        }
    };

    const onAssignToCondition = (index: number, conditionId: string) => {
        // If we have a parent callback for cross-checklist moves, use it
        if (props.onMoveItemToCondition) {
            props.onMoveItemToCondition(index, conditionId);
            return;
        }

        // Otherwise, handle same-checklist assignment (legacy behavior)
        const item = {...props.checklist.items[index], condition_id: conditionId};

        // Find the last item in the target condition group in the current checklist
        let lastConditionItemIndex = -1;
        for (let i = props.checklist.items.length - 1; i >= 0; i--) {
            if (props.checklist.items[i].condition_id === conditionId) {
                lastConditionItemIndex = i;
                break;
            }
        }

        // If the condition already has items, move this task to be right after the last one
        if (lastConditionItemIndex >= 0 && lastConditionItemIndex !== index) {
            const newChecklistItems = [...props.checklist.items];
            newChecklistItems.splice(index, 1);

            // Adjust the target position if we removed an item before it
            const targetIndex = index < lastConditionItemIndex ? lastConditionItemIndex : lastConditionItemIndex + 1;

            newChecklistItems.splice(targetIndex, 0, item);

            const newChecklist = {...props.checklist};
            newChecklist.items = newChecklistItems;
            props.onUpdateChecklist(newChecklist);
        } else {
            // Just update the condition_id in place
            const newChecklistItems = [...props.checklist.items];
            newChecklistItems[index] = item;
            const newChecklist = {...props.checklist};
            newChecklist.items = newChecklistItems;
            props.onUpdateChecklist(newChecklist);
        }
    };

    // Helper to determine if we should show the condition header for this item
    const shouldShowConditionHeader = (item: ChecklistItem, index: number): boolean => {
        if (!item.condition_id) {
            return false;
        }

        // Show header if:
        // 1. This is the first item in the list, OR
        // 2. The previous item has a different condition_id (or no condition)
        if (index === 0) {
            return true;
        }

        const prevItem = props.checklist.items[index - 1];
        return prevItem.condition_id !== item.condition_id;
    };

    // Use item IDs for unique React keys, fallback to title-based keys for items without IDs
    const rawKeys = props.checklist.items.map((item) => item.id || (props.id + item.title));
    const keys = generateKeys(rawKeys);

    const renderChecklistItem = (checklistItem: ChecklistItem, index: number) => {
        const hasCondition = Boolean(checklistItem.condition_id);
        const conditionId = checklistItem.condition_id;
        const showConditionHeader = shouldShowConditionHeader(checklistItem, index) && conditionId;

        return (
            <DraggableChecklistItem
                key={keys[index]}
                playbookRun={props.playbookRun}
                playbookId={props.playbookId}
                readOnly={props.readOnly}
                dragDisabled={addingItem || editingItemIndex !== null}
                checklistIndex={props.checklistIndex}
                item={checklistItem}
                itemIndex={index}
                newItem={false}
                cancelAddingItem={() => {
                    setAddingItem(false);
                }}
                onUpdateChecklistItem={(newItem: ChecklistItem) => onUpdateChecklistItem(index, newItem)}
                onDuplicateChecklistItem={() => onDuplicateChecklistItem(index)}
                onDeleteChecklistItem={() => onDeleteChecklistItem(index)}
                itemButtonsFormat={props.itemButtonsFormat}
                onReadOnlyInteract={props.onReadOnlyInteract}
                onAddConditional={canAddConditional ? () => onOpenConditionEditor(index) : undefined}
                onRemoveFromCondition={() => onRemoveFromCondition(index)}
                onAssignToCondition={(targetConditionId) => onAssignToCondition(index, targetConditionId)}
                availableConditions={(() => {
                    const currentItem = props.checklist.items[index];
                    const seenIds = new Set<string>();

                    // Helper to check if a condition has any items across all checklists
                    const conditionHasItems = (targetConditionId: string): boolean => {
                        if (!props.allChecklists) {
                            return false;
                        }
                        return props.allChecklists.some((checklist) =>
                            checklist.items.some((item) => item.condition_id === targetConditionId)
                        );
                    };

                    // Show all conditions that:
                    // 1. Have at least one item (in any checklist)
                    // 2. Are not the condition this item is already in
                    // 3. Haven't been added yet (deduplicate by ID)
                    return (props.conditions || []).filter((cond) => {
                        if (seenIds.has(cond.id)) {
                            return false;
                        }
                        const shouldInclude = cond.id !== currentItem.condition_id && conditionHasItems(cond.id);
                        if (shouldInclude) {
                            seenIds.add(cond.id);
                        }
                        return shouldInclude;
                    });
                })()}
                conditions={props.conditions}
                propertyFields={props.propertyFields}
                onEditingChange={(isEditing) => {
                    setEditingItemIndex(isEditing ? index : null);
                }}
                hasCondition={hasCondition}
                isChannelChecklist={props.isChannelChecklist}
                conditionHeader={showConditionHeader ? (
                    <ConditionHeader
                        conditionId={conditionId}
                        propertyFields={props.propertyFields || []}
                        checklistIndex={props.checklistIndex}
                        startEditing={props.newlyCreatedConditionIds?.has(conditionId)}
                        onUpdate={(expr) => {
                            if (props.onUpdateCondition) {
                                props.onUpdateCondition(conditionId, expr);
                            }
                        }}
                        onDelete={() => {
                            if (props.onDeleteCondition) {
                                props.onDeleteCondition(conditionId);
                            }
                        }}
                    />
                ) : undefined}
            />
        );
    };

    // Determine if drag and drop should be disabled
    const isDragDropDisabled = addingItem || editingItemIndex !== null;

    return (
        <Droppable
            droppableId={props.checklistIndex.toString()}
            direction='vertical'
            type='checklist-item'
            isDropDisabled={isDragDropDisabled}
        >
            {(droppableProvided: DroppableProvided) => (
                <ChecklistContainer className='checklist'>
                    <div
                        ref={droppableProvided.innerRef}
                        {...droppableProvided.droppableProps}
                    >
                        {/* Render all items in flat list with condition headers */}
                        {props.checklist.items.map((item, index) => {
                            // Skip filtered items
                            if (props.showItem && !props.showItem(item, myUser.id)) {
                                return null;
                            }

                            return renderChecklistItem(item, index);
                        })}

                        {addingItem &&
                            <DraggableChecklistItem
                                key={`new_checklist_item_${newItemKey}`}
                                playbookRun={props.playbookRun}
                                playbookId={props.playbookId}
                                readOnly={props.readOnly}
                                dragDisabled={true}
                                checklistIndex={props.checklistIndex}
                                item={emptyChecklistItem()}
                                itemIndex={-1}
                                newItem={true}
                                cancelAddingItem={() => {
                                    setAddingItem(false);
                                }}
                                onAddChecklistItem={onAddChecklistItem}
                                itemButtonsFormat={props.itemButtonsFormat}
                                onReadOnlyInteract={props.onReadOnlyInteract}
                                onEditingChange={() => {
                                    // New item is always in editing mode, so we don't need to track it separately
                                    // addingItem state already handles disabling drag & drop
                                }}
                                onSaveAndAddNew={() => {
                                    // Increment key to force a new component instance with fresh state
                                    setNewItemKey((prev) => prev + 1);

                                    // Keep adding mode active after saving to create a new item
                                    setAddingItem(true);
                                }}
                            />
                        }
                        {droppableProvided.placeholder}
                        {props.readOnly ? null : (
                            <AddTaskLink
                                disabled={props.readOnly}
                                onClick={() => {
                                    setNewItemKey((prev) => prev + 1);
                                    setAddingItem(true);
                                }}
                                data-testid={`add-new-task-${props.checklistIndex}`}
                            >
                                <IconWrapper>
                                    <i className='icon icon-plus'/>
                                </IconWrapper>
                                {formatMessage({defaultMessage: 'Add a task'})}
                            </AddTaskLink>
                        )}
                    </div>
                </ChecklistContainer>
            )}
        </Droppable>
    );
};

const IconWrapper = styled.div`
    padding: 3px 0 0 1px;
    margin: 0;
`;

const ChecklistContainer = styled.div`
    padding: 8px 0;
    border:  1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 0 0 4px 4px;
    border-top: 0;
    background-color: var(--center-channel-bg);
`;

const AddTaskLink = styled.button`
    display: flex;
    width: 100%;
    height: 44px;
    flex-direction: row;
    align-items: center;
    border: none;
    background: none;
    color: var(--center-channel-color-64);
    cursor: pointer;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;

    &:hover:not(:disabled) {
        background-color: var(--button-bg-08);
        color: var(--button-bg);
    }
`;

export const generateKeys = (arr: string[]): string[] => {
    const keys: string[] = [];
    const itemsMap = new Map<string, number>();
    for (let i = 0; i < arr.length; i++) {
        const num = itemsMap.get(arr[i]) || 0;
        keys.push(arr[i] + String(num));
        itemsMap.set(arr[i], num + 1);
    }
    return keys;
};

export default GenericChecklist;
