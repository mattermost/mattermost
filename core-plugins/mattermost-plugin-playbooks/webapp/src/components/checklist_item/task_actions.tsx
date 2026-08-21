// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

import {haveAtleastOneEnabledAction} from 'src/components/checklist_item/task_actions_modal';
import {TaskAction as TaskActionType} from 'src/types/playbook';
import {openTaskActionsModal} from 'src/actions';
import {OVERLAY_DELAY} from 'src/constants';

interface TaskActionsProps {
    taskActions?: TaskActionType[] | null
    onTaskActionsChange: (newTaskActions: TaskActionType[]) => void;
    editable: boolean;
    isEditing?: boolean;
}

const TaskActions = (props: TaskActionsProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const lenTasks = props.taskActions ? props.taskActions.length : 0;
    const hasEnabledActions = haveAtleastOneEnabledAction(props.taskActions);

    const label = (
        <FormattedMessage
            defaultMessage='{actions, plural, =0 {Task Actions} one {# action} other {# actions}}'
            values={{actions: hasEnabledActions ? lenTasks : 0}}
        />
    );

    let taskActionsButton = (
        <TaskActionsContainer
            data-testid='task-actions-button'
            $editable={props.editable}
            $isPlaceholder={!hasEnabledActions}
            onClick={() => {
                if (props.editable) {
                    dispatch(openTaskActionsModal(props.onTaskActionsChange, props.taskActions));
                }
            }}
        >
            <ActionIcon className={'icon-lightning-bolt-outline icon-12'}/>
            {hasEnabledActions && (
                <TaskActionsTextContainer>
                    {label}
                </TaskActionsTextContainer>
            )}
        </TaskActionsContainer>
    );

    const tooltipText = formatMessage({defaultMessage: 'Task Actions'});

    // when no actions, add tooltip
    if (!hasEnabledActions) {
        taskActionsButton = (
            <OverlayTrigger
                placement='top'
                delay={OVERLAY_DELAY}
                overlay={<Tooltip id='task-actions-tooltip'>{tooltipText}</Tooltip>}
            >
                {taskActionsButton}
            </OverlayTrigger>
        );
    }

    return taskActionsButton;
};

export default TaskActions;

const TaskActionsContainer = styled.div<{$editable: boolean; $isPlaceholder: boolean;}>`
    align-items: center;
    background: ${({$isPlaceholder}) => ($isPlaceholder ? 'transparent' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    border-radius: 13px;
    border: ${({$isPlaceholder}) => ($isPlaceholder ? '1px solid rgba(var(--center-channel-color-rgb), 0.08)' : 'none')}; ;
    color: ${({$isPlaceholder}) => ($isPlaceholder ? 'rgba(var(--center-channel-color-rgb), 0.64)' : 'var(--center-channel-color)')};
    display: flex;
    flex-flow: row wrap;
    height: 24px;
    max-width: 100%;
    min-width: 24px;
    justify-content: center;
    ${({$isPlaceholder}) => !$isPlaceholder && css`
        padding: 2px 4px;
    `}
    ${({$editable}) => $editable && css`
        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.16);
            color: var(--center-channel-color);
            cursor: pointer;
        }
    `}
`;

const ActionIcon = styled.i`
    display: flex;
    width: 20px;
    height: 20px;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    text-align: center;
`;

const TaskActionsTextContainer = styled.div`
    display: flex;
    align-items: center;
    padding-bottom:  1px;
    margin-left: 3px;
    margin-right: 8px;
    font-size: 12px;
    text-align: center;
    white-space: nowrap;
`;
