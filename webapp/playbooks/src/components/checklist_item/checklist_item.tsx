// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useUpdateEffect} from 'react-use';
import {useIntl} from 'react-intl';
import styled, {css} from 'styled-components';
import {DraggableProvided} from 'react-beautiful-dnd';
import {UserProfile} from '@mattermost/types/users';

import {FloatingPortal} from '@floating-ui/react-dom-interactions';

import {
    clientAddChecklistItem,
    clientEditChecklistItem,
    clientSetChecklistItemCommand,
    setDueDate as clientSetDueDate,
    setAssignee,
    setChecklistItemState,
    telemetryEvent,
} from 'src/client';
import {ChecklistItemState, ChecklistItem as ChecklistItemType, TaskAction as TaskActionType} from 'src/types/playbook';
import {TaskActionsEventTarget} from 'src/types/telemetry';
import {useUpdateRunItemTaskActions} from 'src/graphql/hooks';

import {DateTimeOption} from 'src/components/datetime_selector';

import {Mode} from 'src/components/datetime_input';

import ChecklistItemHoverMenu, {HoverMenu} from './hover_menu';
import ChecklistItemDescription from './description';
import ChecklistItemTitle from './title';
import AssignTo from './assign_to';
import Command from './command';
import {CancelSaveButtons, CheckBoxButton} from './inputs';
import {DueDateButton} from './duedate';

import TaskActions from './task_actions';
import {haveAtleastOneEnabledAction} from './task_actions_modal';

export enum ButtonsFormat {

    // All buttons are shown regardless of their state if they're editable;
    // owner name is shown completely
    Long = 'long',

    // Only buttons with a value are shown;
    // owner name is shown completely
    Mixed = 'mixed',

    // Only buttons with a value are shown;
    // owner name is not shown when other buttons have a value
    Short = 'short',
}

const defaultButtonsFormat = ButtonsFormat.Short;

interface ChecklistItemProps {
    checklistItem: ChecklistItemType;
    checklistNum: number;
    itemNum: number;
    playbookRunId?: string;
    playbookId?: string;
    channelId?: string;
    onChange?: (item: ChecklistItemState) => ReturnType<typeof setChecklistItemState> | undefined;
    draggableProvided?: DraggableProvided;
    dragging: boolean;
    readOnly: boolean;
    collapsibleDescription: boolean;
    descriptionCollapsedByDefault?: boolean;
    newItem: boolean;
    cancelAddingItem?: () => void;
    onUpdateChecklistItem?: (newItem: ChecklistItemType) => void;
    onAddChecklistItem?: (newItem: ChecklistItemType) => void;
    onDuplicateChecklistItem?: () => void;
    onDeleteChecklistItem?: () => void;
    buttonsFormat?: ButtonsFormat;
    participantUserIds: string[];
    onReadOnlyInteract?: () => void
}

export const ChecklistItem = (props: ChecklistItemProps): React.ReactElement => {
    const {formatMessage} = useIntl();
    const [showDescription, setShowDescription] = useState(!props.descriptionCollapsedByDefault);
    const [isEditing, setIsEditing] = useState(props.newItem);
    const [isHoverMenuItemOpen, setIsHoverMenuItemOpen] = useState(false);
    const [titleValue, setTitleValue] = useState(props.checklistItem.title);
    const [descValue, setDescValue] = useState(props.checklistItem.description);
    const [command, setCommand] = useState(props.checklistItem.command);
    const [taskActions, setTaskActions] = useState(props.checklistItem.task_actions);
    const [assigneeID, setAssigneeID] = useState(props.checklistItem.assignee_id);
    const [dueDate, setDueDate] = useState(props.checklistItem.due_date);
    const buttonsFormat = props.buttonsFormat ?? defaultButtonsFormat;
    const {updateRunTaskActions} = useUpdateRunItemTaskActions(props.playbookRunId);

    const toggleDescription = () => setShowDescription(!showDescription);

    const isSkipped = () => {
        return props.checklistItem.state === ChecklistItemState.Skip;
    };

    useUpdateEffect(() => {
        setTitleValue(props.checklistItem.title);
    }, [props.checklistItem.title]);

    useUpdateEffect(() => {
        setDescValue(props.checklistItem.description);
    }, [props.checklistItem.description]);

    useUpdateEffect(() => {
        setCommand(props.checklistItem.command);
    }, [props.checklistItem.command]);

    useUpdateEffect(() => {
        setAssigneeID(props.checklistItem.assignee_id);
    }, [props.checklistItem.assignee_id]);

    useUpdateEffect(() => {
        setDueDate(props.checklistItem.due_date);
    }, [props.checklistItem.due_date]);

    useUpdateEffect(() => {
        setTaskActions(taskActions);
    }, [props.checklistItem.task_actions]);

    const onAssigneeChange = async (user?: UserProfile) => {
        const userId = user?.id || '';
        setAssigneeID(userId);
        if (props.newItem) {
            return;
        }
        if (props.playbookRunId) {
            const response = await setAssignee(props.playbookRunId, props.checklistNum, props.itemNum, userId);
            if (response.error) {
                console.log(response.error); // eslint-disable-line no-console
            }
        } else {
            const newItem = {...props.checklistItem};
            newItem.assignee_id = userId;
            props.onUpdateChecklistItem?.(newItem);
        }
    };

    const onDueDateChange = async (value?: DateTimeOption | undefined | null) => {
        let timestamp = 0;
        if (value?.value) {
            timestamp = value?.value.toMillis();
        }
        setDueDate(timestamp);
        if (props.newItem) {
            return;
        }
        if (props.playbookRunId) {
            const response = await clientSetDueDate(props.playbookRunId, props.checklistNum, props.itemNum, timestamp);
            if (response.error) {
                console.log(response.error); // eslint-disable-line no-console
            }
        } else {
            const newItem = {...props.checklistItem};
            newItem.due_date = timestamp;
            props.onUpdateChecklistItem?.(newItem);
        }
    };

    const onCommandChange = async (newCommand: string) => {
        setCommand(newCommand);
        if (props.newItem) {
            return;
        }
        if (props.playbookRunId) {
            clientSetChecklistItemCommand(props.playbookRunId, props.checklistNum, props.itemNum, newCommand);
        } else {
            const newItem = {...props.checklistItem};
            newItem.command = newCommand;
            props.onUpdateChecklistItem?.(newItem);
        }
    };

    const onTaskActionsChange = async (newTaskActions: TaskActionType[]) => {
        setTaskActions(newTaskActions);
        if (props.newItem) {
            return;
        }
        if (props.playbookRunId) {
            updateRunTaskActions(props.checklistNum, props.itemNum, newTaskActions);
            telemetryEvent(TaskActionsEventTarget.UpdateActions, {
                playbookrun_id: props.playbookRunId,
            });
        } else {
            telemetryEvent(TaskActionsEventTarget.UpdateActions, {
                playbook_id: props.playbookId || '',
            });
            const newItem = {...props.checklistItem};
            newItem.task_actions = newTaskActions;
            props.onUpdateChecklistItem?.(newItem);
        }
    };

    const renderAssignTo = (): null | React.ReactNode => {
        if (buttonsFormat !== ButtonsFormat.Long && (!assigneeID && !isEditing)) {
            return null;
        }

        const shouldHideName = () => {
            if (buttonsFormat !== ButtonsFormat.Short) {
                return false;
            }

            if (isEditing) {
                return false;
            }
            if (command !== '') {
                return true;
            }
            const notFinished = [ChecklistItemState.Open, ChecklistItemState.InProgress].includes(props.checklistItem.state as ChecklistItemState);
            return dueDate > 0 && notFinished;
        };

        return (
            <AssignTo
                participantUserIds={props.participantUserIds}
                assignee_id={assigneeID || ''}
                editable={isEditing || (!props.readOnly && !isSkipped())}
                withoutName={shouldHideName()}
                onSelectedChange={onAssigneeChange}
                placement={'bottom-start'}
            />
        );
    };

    const renderCommand = (): null | React.ReactNode => {
        if (buttonsFormat !== ButtonsFormat.Long && (!command && !isEditing)) {
            return null;
        }
        return (
            <Command
                checklistNum={props.checklistNum}
                command={command}
                command_last_run={props.checklistItem.command_last_run}
                disabled={!isEditing && (props.readOnly || isSkipped())}
                itemNum={props.itemNum}
                playbookRunId={props.playbookRunId}
                isEditing={isEditing}
                onChangeCommand={onCommandChange}
            />
        );
    };

    const renderDueDate = (): null | React.ReactNode => {
        const isTaskFinishedOrSkipped = props.checklistItem.state === ChecklistItemState.Closed || isSkipped();

        if (buttonsFormat !== ButtonsFormat.Long && (!dueDate && !isEditing)) {
            return null;
        }

        return (
            <DueDateButton
                editable={isEditing || (!props.readOnly && !isSkipped())}
                date={dueDate}
                ignoreOverdue={isTaskFinishedOrSkipped}
                mode={props.playbookRunId ? Mode.DateTimeValue : Mode.DurationValue}
                onSelectedChange={onDueDateChange}
                placement={'bottom-start'}
            />
        );
    };

    const renderTaskActions = (): null | React.ReactNode => {
        const haveTaskActions = taskActions?.length > 0;
        const enabledAction = haveAtleastOneEnabledAction(taskActions);
        if (
            buttonsFormat !== ButtonsFormat.Long &&
            !isEditing &&
            !(haveTaskActions && enabledAction)
        ) {
            return null;
        }

        return (
            <TaskActions
                editable={isEditing || (!props.readOnly && !isSkipped())}
                taskActions={taskActions}
                onTaskActionsChange={onTaskActionsChange}
            />
        );
    };

    const renderRow = (): null | React.ReactNode => {
        const haveTaskActions = taskActions?.length > 0;
        if (
            buttonsFormat !== ButtonsFormat.Long &&
            !assigneeID &&
            !command &&
            !dueDate &&
            !haveTaskActions &&
            !isEditing
        ) {
            return null;
        }
        return (
            <Row>
                {renderAssignTo()}
                {renderCommand()}
                {renderDueDate()}
                {renderTaskActions()}
            </Row>
        );
    };

    const content = (
        <ItemContainer
            ref={props.draggableProvided?.innerRef}
            {...props.draggableProvided?.draggableProps}
            data-testid='checkbox-item-container'
            editing={isEditing}
            hoverMenuItemOpen={isHoverMenuItemOpen}
            $disabled={props.readOnly || isSkipped()}
        >
            <CheckboxContainer>
                {!props.readOnly && !props.dragging &&
                    <ChecklistItemHoverMenu
                        playbookRunId={props.playbookRunId}
                        participantUserIds={props.participantUserIds}
                        checklistNum={props.checklistNum}
                        itemNum={props.itemNum}
                        isSkipped={isSkipped()}
                        onEdit={() => setIsEditing(true)}
                        isEditing={isEditing}
                        onChange={props.onChange}
                        description={props.checklistItem.description}
                        showDescription={showDescription}
                        toggleDescription={toggleDescription}
                        assignee_id={assigneeID || ''}
                        onAssigneeChange={onAssigneeChange}
                        due_date={props.checklistItem.due_date}
                        onDueDateChange={onDueDateChange}
                        onDuplicateChecklistItem={props.onDuplicateChecklistItem}
                        onDeleteChecklistItem={props.onDeleteChecklistItem}
                        onItemOpenChange={setIsHoverMenuItemOpen}
                    />
                }
                <DragButton
                    title={formatMessage({defaultMessage: 'Drag me to reorder'})}
                    className={'icon icon-drag-vertical'}
                    {...props.draggableProvided?.dragHandleProps}
                    isVisible={!props.readOnly}
                    isDragging={props.dragging}
                />
                <CheckBoxButton
                    readOnly={props.readOnly}
                    disabled={isSkipped() || props.playbookRunId === undefined}
                    item={props.checklistItem}
                    onChange={(item: ChecklistItemState) => props.onChange?.(item)}
                    onReadOnlyInteract={props.onReadOnlyInteract}
                />
                <ChecklistItemTitleWrapper
                    onClick={() => props.collapsibleDescription && props.checklistItem.description !== '' && toggleDescription()}
                >
                    <ChecklistItemTitle
                        editingItem={isEditing}
                        onEdit={setTitleValue}
                        value={titleValue}
                        skipped={isSkipped()}
                        clickable={props.collapsibleDescription && props.checklistItem.description !== ''}
                    />
                </ChecklistItemTitleWrapper>
            </CheckboxContainer>
            {(descValue || isEditing) &&
                <ChecklistItemDescription
                    editingItem={isEditing}
                    showDescription={showDescription}
                    onEdit={setDescValue}
                    value={descValue}
                />
            }
            {renderRow()}
            {isEditing &&
                <CancelSaveButtons
                    onCancel={() => {
                        setIsEditing(false);
                        setTitleValue(props.checklistItem.title);
                        setDescValue(props.checklistItem.description);
                        props.cancelAddingItem?.();
                    }}
                    onSave={() => {
                        setIsEditing(false);
                        if (props.newItem) {
                            props.cancelAddingItem?.();
                            const newItem = {
                                title: titleValue,
                                command,
                                description: descValue,
                                state: ChecklistItemState.Open,
                                command_last_run: 0,
                                due_date: dueDate,
                                assignee_id: assigneeID,
                                task_actions: taskActions,
                                state_modified: 0,
                                assignee_modified: 0,
                            };
                            if (props.playbookRunId) {
                                clientAddChecklistItem(props.playbookRunId, props.checklistNum, newItem);
                            } else {
                                props.onAddChecklistItem?.(newItem);
                            }
                        } else if (props.playbookRunId) {
                            clientEditChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum, {
                                title: titleValue,
                                command,
                                description: descValue,
                            });
                        } else {
                            const newItem = {...props.checklistItem};
                            newItem.title = titleValue;
                            newItem.command = command;
                            newItem.description = descValue;
                            newItem.task_actions = taskActions;
                            props.onUpdateChecklistItem?.(newItem);
                        }
                    }}
                />
            }
        </ItemContainer>
    );

    if (props.dragging) {
        return <FloatingPortal>{content}</FloatingPortal>;
    }

    return content;
};

export const CheckboxContainer = styled.div`
    align-items: flex-start;
    display: flex;
    position: relative;

    button {
        width: 53px;
        height: 29px;
        border: 1px solid #166DE0;
        box-sizing: border-box;
        border-radius: 4px;
        font-family: Open Sans;
        font-style: normal;
        font-weight: 600;
        font-size: 12px;
        line-height: 17px;
        text-align: center;
        background: #ffffff;
        color: #166DE0;
        cursor: pointer;
        margin-right: 13px;
    }

    button:disabled {
        border: 0px;
        color: var(--button-color);
        background: rgba(var(--center-channel-color-rgb), 0.56);
        cursor: default;
    }

    &:hover {
        .checkbox-container__close {
            opacity: 1;
        }
    }

    .icon-bars {
        padding: 0 0.8rem 0 0;
    }

    input[type="checkbox"] {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background: #ffffff;
        margin: 0;
        cursor: pointer;
        margin-right: 8px;
        margin-top: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        min-width: 16px;
        height: 16px;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.24);
        box-sizing: border-box;
        border-radius: 2px;
    }

    input[type="checkbox"]:checked {
        background: var(--button-bg);
        border: 1px solid var(--button-bg);
        box-sizing: border-box;
    }

    input[type="checkbox"]::before {
        font-family: 'compass-icons', mattermosticons;
        text-rendering: auto;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        content: "\f012c";
        font-size: 12px;
        font-weight: bold;
        color: #ffffff;
        transition: transform 0.15s;
        transform: scale(0) rotate(90deg);
        position: relative;
    }

    input[type="checkbox"]:checked::before {
        transform: scale(1) rotate(0deg);
    }

    input[type="checkbox"]:disabled {
        opacity: 0.38;
    }

    label {
        font-weight: normal;
        word-break: break-word;
        display: inline;
        margin: 0;
        margin-right: 8px;
        flex-grow: 1;
    }
`;

const ChecklistItemTitleWrapper = styled.div`
    display: flex;
    flex-direction: column;
    width: 100%;
`;

const DragButton = styled.i<{isVisible: boolean, isDragging: boolean}>`
    cursor: pointer;
    width: 4px;
    margin-right: 4px;
    margin-left: 4px;
    margin-top: 1px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    opacity: 0;
    ${({isVisible}) => !isVisible && css`
        visibility: hidden;
    `}
    ${({isDragging}) => isDragging && css`
        opacity: 1;
    `}
`;

const Row = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 8px;
    row-gap: 5px;

    margin-left: 35px;
    margin-top: 8px;
    margin-right: 10px;
`;

const ItemContainer = styled.div<{editing: boolean, $disabled: boolean, hoverMenuItemOpen: boolean}>`
    margin-bottom: 4px;
    padding: 8px 0px;

    ${({hoverMenuItemOpen}) => !hoverMenuItemOpen && css`
        ${HoverMenu} {
            opacity: 0;
        }
    `}

    .checklists:not(.isDragging) & {
        // not dragging and hover or focus-within
        &:hover,
        &:focus-within {
            ${DragButton},
            ${HoverMenu} {
                opacity: 1;
            }
        }
    }

    ${({editing}) => editing && css`
        background-color: var(--button-bg-08);
    `}

    ${({$disabled, editing}) => !editing && $disabled && css`
        ${ChecklistItemTitleWrapper},
        & > ${Row} {
            opacity: 0.64;
        }

        ${HoverMenu} {
            z-index: 1;
        }
    `}

    ${({editing, $disabled}) => !editing && !$disabled && css`
        .checklists:not(.isDragging) &:hover {
            background: var(--center-channel-color-04);
        }
    `}
`;
