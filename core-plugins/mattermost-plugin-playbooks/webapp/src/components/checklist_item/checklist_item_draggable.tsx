// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Draggable, DraggableProvided, DraggableStateSnapshot} from 'react-beautiful-dnd';

import {setChecklistItemState} from 'src/client';
import {ChecklistItem, ButtonsFormat as ItemButtonsFormat} from 'src/components/checklist_item/checklist_item';
import {ChecklistItemState, ChecklistItem as ChecklistItemType} from 'src/types/playbook';
import {PlaybookRun} from 'src/types/playbook_run';
import {Condition} from 'src/types/conditions';
import {PropertyField} from 'src/types/properties';

interface Props {
    playbookRun?: PlaybookRun;
    playbookId?: string;
    checklistIndex: number;
    item: ChecklistItemType;
    itemIndex: number;
    newItem: boolean;
    readOnly?: boolean;
    dragDisabled?: boolean;
    cancelAddingItem: () => void;
    onUpdateChecklistItem?: (newItem: ChecklistItemType) => void;
    onAddChecklistItem?: (newItem: ChecklistItemType) => void;
    onDuplicateChecklistItem?: () => void;
    onDeleteChecklistItem?: () => void;
    itemButtonsFormat?: ItemButtonsFormat;
    onReadOnlyInteract?: () => void;
    onAddConditional?: () => void;
    onRemoveFromCondition?: () => void;
    onAssignToCondition?: (conditionId: string) => void;
    availableConditions?: Condition[];
    conditions?: Condition[];
    propertyFields?: PropertyField[];
    onEditingChange?: (isEditing: boolean) => void;
    hasCondition?: boolean;
    conditionHeader?: React.ReactNode;
    onSaveAndAddNew?: () => void;
    isChannelChecklist?: boolean;
}

const DraggableChecklistItem = (props: Props) => {
    const draggableId = props.item.id || (props.item.title + props.itemIndex);
    return (
        <Draggable
            draggableId={draggableId}
            index={props.itemIndex}
            isDragDisabled={props.dragDisabled}
        >
            {(draggableProvided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                <ChecklistItem
                    checklistItem={props.item}
                    checklistNum={props.checklistIndex}
                    itemNum={props.itemIndex}
                    playbookRunId={props.playbookRun?.id}
                    playbookId={props.playbookId}
                    participantUserIds={props.playbookRun?.participant_ids ?? []}
                    onChange={(newState: ChecklistItemState) => {
                        return props.playbookRun && setChecklistItemState(props.playbookRun.id, props.checklistIndex, props.itemIndex, newState, props.item.id);
                    }}
                    draggableProvided={draggableProvided}
                    dragging={snapshot.isDragging || snapshot.combineWith != null}
                    readOnly={props.readOnly ?? false}
                    dragDisabled={props.dragDisabled}
                    collapsibleDescription={true}
                    newItem={props.newItem}
                    cancelAddingItem={props.cancelAddingItem}
                    onUpdateChecklistItem={props.onUpdateChecklistItem}
                    onAddChecklistItem={props.onAddChecklistItem}
                    onDuplicateChecklistItem={props.onDuplicateChecklistItem}
                    onDeleteChecklistItem={props.onDeleteChecklistItem}
                    buttonsFormat={props.itemButtonsFormat}
                    onReadOnlyInteract={props.onReadOnlyInteract}
                    onAddConditional={props.onAddConditional}
                    onRemoveFromCondition={props.onRemoveFromCondition}
                    onAssignToCondition={props.onAssignToCondition}
                    availableConditions={props.availableConditions}
                    conditions={props.conditions}
                    propertyFields={props.propertyFields}
                    onEditingChange={props.onEditingChange}
                    hasCondition={props.hasCondition}
                    conditionHeader={props.conditionHeader}
                    onSaveAndAddNew={props.onSaveAndAddNew}
                    isChannelChecklist={props.isChannelChecklist}
                />
            )}
        </Draggable>
    );
};

export default DraggableChecklistItem;
