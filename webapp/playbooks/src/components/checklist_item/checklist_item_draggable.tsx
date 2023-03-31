// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Draggable, DraggableProvided, DraggableStateSnapshot} from 'react-beautiful-dnd';

import {setChecklistItemState} from 'src/client';
import {ChecklistItem, ButtonsFormat as ItemButtonsFormat} from 'src/components/checklist_item/checklist_item';
import {ChecklistItemState, ChecklistItem as ChecklistItemType} from 'src/types/playbook';
import {PlaybookRun} from 'src/types/playbook_run';

interface Props {
    playbookRun?: PlaybookRun;
    playbookId?: string;
    checklistIndex: number;
    item: ChecklistItemType;
    itemIndex: number;
    newItem: boolean;
    readOnly?: boolean;
    cancelAddingItem: () => void;
    onUpdateChecklistItem?: (newItem: ChecklistItemType) => void;
    onAddChecklistItem?: (newItem: ChecklistItemType) => void;
    onDuplicateChecklistItem?: () => void;
    onDeleteChecklistItem?: () => void;
    itemButtonsFormat?: ItemButtonsFormat;
    onReadOnlyInteract?: () => void
}

const DraggableChecklistItem = (props: Props) => {
    return (
        <Draggable
            draggableId={props.item.title + props.itemIndex}
            index={props.itemIndex}
        >
            {(draggableProvided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                <ChecklistItem
                    checklistItem={props.item}
                    checklistNum={props.checklistIndex}
                    itemNum={props.itemIndex}
                    playbookRunId={props.playbookRun?.id}
                    playbookId={props.playbookId}
                    participantUserIds={props.playbookRun?.participant_ids ?? []}
                    onChange={(newState: ChecklistItemState) => props.playbookRun && setChecklistItemState(props.playbookRun.id, props.checklistIndex, props.itemIndex, newState)}
                    draggableProvided={draggableProvided}
                    dragging={snapshot.isDragging || snapshot.combineWith != null}
                    readOnly={props.readOnly ?? false}
                    collapsibleDescription={true}
                    newItem={props.newItem}
                    cancelAddingItem={props.cancelAddingItem}
                    onUpdateChecklistItem={props.onUpdateChecklistItem}
                    onAddChecklistItem={props.onAddChecklistItem}
                    onDuplicateChecklistItem={props.onDuplicateChecklistItem}
                    onDeleteChecklistItem={props.onDeleteChecklistItem}
                    buttonsFormat={props.itemButtonsFormat}
                    onReadOnlyInteract={props.onReadOnlyInteract}
                />
            )}
        </Draggable>
    );
};

export default DraggableChecklistItem;
