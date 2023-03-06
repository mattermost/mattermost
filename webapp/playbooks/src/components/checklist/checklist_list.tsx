// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
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

import {FloatingPortal} from '@floating-ui/react-dom-interactions';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {playbookRunUpdated} from 'src/actions';
import {Checklist, ChecklistItem} from 'src/types/playbook';
import {clientAddChecklist, clientMoveChecklist, clientMoveChecklistItem} from 'src/client';
import {ButtonsFormat as ItemButtonsFormat} from 'src/components/checklist_item/checklist_item';

import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';

import {useProxyState} from 'src/hooks';
import {PlaybookUpdates} from 'src/graphql/generated/graphql';
import {getDistinctAssignees} from 'src/utils';

import CollapsibleChecklist, {ChecklistInputComponent, TitleHelpTextWrapper} from './collapsible_checklist';

import GenericChecklist, {generateKeys} from './generic_checklist';

// disable all react-beautiful-dnd development warnings
// @ts-ignore
window['__react-beautiful-dnd-disable-dev-warnings'] = true;

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
}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [addingChecklist, setAddingChecklist] = useState(false);
    const [newChecklistName, setNewChecklistName] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const updatePlaybook = useUpdatePlaybook(inPlaybook?.id);
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
        const newChecklist = {...checklists[index]};
        const newChecklists = [...checklists, newChecklist];
        setChecklistsForPlaybook(newChecklists);
    };

    const onDeleteChecklist = (index: number) => {
        const newChecklists = [...checklists];
        newChecklists.splice(index, 1);
        setChecklistsForPlaybook(newChecklists);
    };

    const onUpdateChecklist = (index: number, newChecklist: Checklist) => {
        const newChecklists = [...checklists];
        newChecklists[index] = {...newChecklist};
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
        const newChecklists = Array.from(checklists);

        // Move a checklist item, either inside of the same checklist, or between checklists
        if (result.type === 'checklist-item') {
            const srcChecklistIdx = parseInt(result.source.droppableId, 10);
            const dstChecklistIdx = parseInt(result.destination.droppableId, 10);

            if (srcChecklistIdx === dstChecklistIdx) {
                // Remove the dragged item from the checklist
                const newChecklistItems = Array.from(checklists[srcChecklistIdx].items);
                const [removed] = newChecklistItems.splice(srcIdx, 1);

                // Add the dragged item to the checklist
                newChecklistItems.splice(dstIdx, 0, removed);
                newChecklists[srcChecklistIdx] = {
                    ...newChecklists[srcChecklistIdx],
                    items: newChecklistItems,
                };
            } else {
                const srcChecklist = checklists[srcChecklistIdx];
                const dstChecklist = checklists[dstChecklistIdx];

                // Remove the dragged item from the source checklist
                const newSrcChecklistItems = Array.from(srcChecklist.items);
                const [moved] = newSrcChecklistItems.splice(srcIdx, 1);

                // Add the dragged item to the destination checklist
                const newDstChecklistItems = Array.from(dstChecklist.items);
                newDstChecklistItems.splice(dstIdx, 0, moved);

                // Modify the new checklists array with the new source and destination checklists
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
            {formatMessage({defaultMessage: 'Add a checklist'})}
        </AddChecklistLink>
    );

    if (addingChecklist) {
        addChecklist = (
            <NewChecklist>
                <Icon className={'icon-chevron-down'}/>
                <ChecklistInputComponent
                    title={newChecklistName}
                    setTitle={setNewChecklistName}
                    onCancel={() => {
                        setAddingChecklist(false);
                        setNewChecklistName('');
                    }}
                    onSave={() => {
                        const newChecklist = {title: newChecklistName, items: [] as ChecklistItem[]};
                        if (playbookRun) {
                            clientAddChecklist(playbookRun.id, newChecklist);
                        } else {
                            setChecklistsForPlaybook([...checklists, newChecklist]);
                        }
                        setTimeout(() => setNewChecklistName(''), 300);
                        setAddingChecklist(false);
                    }}
                />
            </NewChecklist>
        );
    }

    const keys = generateKeys(checklists.map((checklist) => checklist.title));

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
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    height: 44px;
    width: 100%;

    background: none;
    border: none;

    border-radius: 4px;
    border: 1px dashed;
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;

    border-color: var(--center-channel-color-16);
    color: var(--center-channel-color-64);

    &:hover:not(:disabled) {
        background-color: var(--button-bg-08);
        color: var(--button-bg);
    }
`;

const NewChecklist = styled.div`
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
    z-index: 1;
    position: sticky;
    top: 48px; // height of rhs_checklists MainTitle
    border-radius: 4px 4px 0px 0px;

    display: flex;
    flex-direction: row;
    align-items: center;
`;

const Icon = styled.i`
    position: relative;
    top: 2px;
    margin: 0 0 0 6px;

    font-size: 18px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const ChecklistsContainer = styled.div`
`;

const IconWrapper = styled.div`
    padding: 3px 0 0 1px;
    margin: 0;
`;

export default ChecklistList;
