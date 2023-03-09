// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import {Droppable, DroppableProvided} from 'react-beautiful-dnd';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {Checklist, ChecklistItem, emptyChecklistItem} from 'src/types/playbook';
import DraggableChecklistItem from 'src/components/checklist_item/checklist_item_draggable';
import {ButtonsFormat as ItemButtonsFormat} from 'src/components/checklist_item/checklist_item';
import {PlaybookRun} from 'src/types/playbook_run';

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
}

const GenericChecklist = (props: Props) => {
    const {formatMessage} = useIntl();
    const myUser = useSelector(getCurrentUser);
    const [addingItem, setAddingItem] = useState(false);

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
        const duplicate = {...newChecklistItems[index]};
        newChecklistItems.splice(index + 1, 0, duplicate);
        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);
    };

    const onDeleteChecklistItem = (index: number) => {
        const newChecklistItems = [...props.checklist.items];
        newChecklistItems.splice(index, 1);
        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);
    };

    const keys = generateKeys(props.checklist.items.map((item) => props.id + item.title));

    return (

        <Droppable
            droppableId={props.checklistIndex.toString()}
            direction='vertical'
            type='checklist-item'
        >
            {(droppableProvided: DroppableProvided) => (
                <ChecklistContainer className='checklist'>
                    <div
                        ref={droppableProvided.innerRef}
                        {...droppableProvided.droppableProps}
                    >
                        {props.checklist.items.map((checklistItem: ChecklistItem, index: number) => {
                            // filtering here because we need to maintain the index values
                            // because we refer to checklist items by their index
                            if (props.showItem ? !props.showItem(checklistItem, myUser.id) : false) {
                                return null;
                            }

                            return (
                                <DraggableChecklistItem
                                    key={keys[index]}
                                    playbookRun={props.playbookRun}
                                    playbookId={props.playbookId}
                                    readOnly={props.readOnly}
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
                                />
                            );
                        })}
                        {addingItem &&
                            <DraggableChecklistItem
                                key={'new_checklist_item'}
                                playbookRun={props.playbookRun}
                                playbookId={props.playbookId}
                                readOnly={props.readOnly}
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
                            />
                        }
                        {droppableProvided.placeholder}
                        {props.readOnly ? null : (
                            <AddTaskLink
                                disabled={props.readOnly}
                                onClick={() => {
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
    background-color: var(--center-channel-bg);
    border-radius: 0 0 4px 4px;
    border:  1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-top: 0;
    padding: 8px 0px;
`;

const AddTaskLink = styled.button`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    height: 44px;
    width: 100%;

    background: none;
    border: none;

    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;

    color: var(--center-channel-color-64);

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
