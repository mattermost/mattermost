import React, {ComponentProps, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {OptionTypeBase, StylesConfig} from 'react-select';
import styled from 'styled-components';

import {searchProfiles} from 'mattermost-redux/actions/users';
import {getUsers} from 'mattermost-redux/selectors/entities/common';

import ActionsModal from 'src/components/actions_modal';
import Action from 'src/components/actions_modal_action';
import ProfileAutocomplete from 'src/components/backstage/profile_autocomplete';
import Trigger, {TriggerKeywords} from 'src/components/actions_modal_trigger';
import GenericModal from 'src/components/widgets/generic_modal';
import {TaskAction as TaskActionType} from 'src/types/playbook';

const ID = 'playbooks_task_actions_modal';
const KeywordsByUsersTriggerType = 'keywords_by_users';
const MarkItemAsDoneActionType = 'mark_item_as_done';

export const makeTaskActionsModalDefinition = (
    onTaskActionsChange: (newTaskActions: TaskActionType[]) => void,
    taskActions?: TaskActionType[] | null,
) => ({
    modalId: ID,
    dialogType: TaskActionsModal,
    dialogProps: {taskActions, onTaskActionsChange},
});

type KeywordsTriggerPayload = {keywords: string[]; user_ids: string[];}
export const keywordsTriggerEmptyPayload: KeywordsTriggerPayload = {keywords: [], user_ids: []};

type MarkAsDonePayload = {enabled: boolean;};
export const markAsDoneEmptyPayload: MarkAsDonePayload = {enabled: false};

const keywordsTriggerPayloadFromTaskAction = (taskAction: TaskActionType): KeywordsTriggerPayload => {
    // we only have one kind of trigger
    const triggerPayload: KeywordsTriggerPayload = taskAction.trigger?.payload ? JSON.parse(taskAction.trigger.payload) : keywordsTriggerEmptyPayload;
    return triggerPayload;
};

const markAsDonePayloadFromTaskAction = (taskAction: TaskActionType): MarkAsDonePayload => {
    // we currently only support one action per trigger
    const actionPayload: MarkAsDonePayload = (taskAction.actions?.length > 0 && taskAction.actions[0]?.payload) ? JSON.parse(taskAction.actions[0].payload) : markAsDoneEmptyPayload;
    return actionPayload;
};

type Props = {
    onTaskActionsChange: (newTaskActions: TaskActionType[]) => void,
    taskActions?: TaskActionType[] | null,
} & Partial<ComponentProps<typeof GenericModal>>;

const TaskActionsModal = ({onTaskActionsChange, taskActions, ...modalProps}: Props) => {
    const {formatMessage} = useIntl();
    const emptyTask = {} as TaskActionType;
    const taskAction = (taskActions && (taskActions.length > 0)) ? taskActions[0] : emptyTask;

    const triggerPayload = keywordsTriggerPayloadFromTaskAction(taskAction);
    const actionPayload = markAsDonePayloadFromTaskAction(taskAction);

    const [show, setShow] = useState(true);
    const users = useSelector(getUsers);
    const defaultUsers = triggerPayload.user_ids.map((user_id: string) => users[user_id]);

    const [newKeywords, setNewKeywords] = useState(triggerPayload.keywords);
    const [newUserIDs, setNewUserIDs] = useState(triggerPayload.user_ids);
    const [newIsEnabled, setNewEnabled] = useState(actionPayload.enabled);

    const dispatch = useDispatch();
    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term));
    };

    const onSave = () => {
        const newTaskAction: TaskActionType = {
            trigger: {
                type: KeywordsByUsersTriggerType,
                payload: JSON.stringify({keywords: newKeywords, user_ids: newUserIDs}),
            },
            actions: [
                {
                    type: MarkItemAsDoneActionType,
                    payload: JSON.stringify({enabled: newIsEnabled && newKeywords.length > 0}),
                },
            ],
        };
        onTaskActionsChange([newTaskAction]);
    };

    return (
        <ActionsModal
            id={'channel-actions-modal'}
            title={formatMessage({defaultMessage: 'Task actions'})}
            subtitle={formatMessage({defaultMessage: 'Automate activities for this task'})}
            show={show}
            onHide={() => {
                setShow(false);
            }}
            editable={true}
            onSave={() => {
                onSave();
                setShow(false);
            }}
            autoCloseOnConfirmButton={true}
            isValid={true}
            {...modalProps}
        >
            <TaskActionsContainer>
                <Trigger
                    title={formatMessage({defaultMessage: 'When a message with specific keywords is posted'})}
                    triggerModifier={(
                        <>
                            <TriggerKeywords
                                testId={'task-action-keywords'}
                                editable={true}
                                keywords={triggerPayload.keywords}
                                onUpdate={(updatedKeywords) => setNewKeywords(updatedKeywords)}
                            />
                            <ProfileAutocomplete
                                data-testid={'task-action-posted-by'}
                                autoFocus={false}
                                searchProfiles={searchUsers}
                                userIds={[]}
                                defaultValue={defaultUsers}
                                isDisabled={false}
                                isMultiMode={true}
                                customSelectStyles={selectStyles}
                                setValues={(newUserProfiles) => (setNewUserIDs(newUserProfiles.map((userProfile) => userProfile.id)))}
                                placeholder={formatMessage({defaultMessage: 'Posted by'})}
                            />
                        </>
                    )}
                >
                    <Action
                        enabled={(newIsEnabled && newKeywords.length > 0)}
                        title={formatMessage({defaultMessage: 'Mark the task as done'})}
                        editable={newKeywords.length > 0}
                        onToggle={() => {
                            setNewEnabled(!newIsEnabled);
                        }}
                    />
                </Trigger>
            </TaskActionsContainer>
        </ActionsModal>
    );
};

export const TaskActionsContainer = styled.div`
    display: flex;
    flex-direction: column;
    row-gap: 16px;
    @media screen and (max-height: 900px) {
        max-height: 500px;
        overflow-x: hidden;
        overflow-y: scroll;
    }
`;

const selectStyles: StylesConfig<OptionTypeBase, boolean> = {
    container: (provided) => ({
        ...provided,
        marginTop: '8px',

    }),
    control: (provided, {isDisabled}) => ({
        ...provided,
        backgroundColor: isDisabled ? 'rgba(var(--center-channel-bg-rgb),0.16)' : 'var(--center-channel-bg)',
        border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
        '&&:before': {content: 'none'},
    }),
    placeholder: (provided) => ({
        ...provided,
        marginLeft: '8px',
    }),
    input: (provided) => ({
        ...provided,
        marginLeft: '8px',
        color: 'var(--center-channel-color)',
    }),
    multiValue: (provided) => ({
        ...provided,
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
        borderRadius: '10px',
        paddingLeft: '8px',
        overflow: 'hidden',
        alignItems: 'center',
    }),
    multiValueLabel: (provided) => ({
        ...provided,
        padding: 0,
        paddingLeft: 0,
        lineHeight: '18px',
        color: 'var(--center-channel-color)',
    }),
    multiValueRemove: (provided) => ({
        ...provided,
        color: 'rgba(var(--center-channel-bg-rgb), 0.80)',
        backgroundColor: 'rgba(var(--center-channel-color-rgb),0.32)',
        borderRadius: '50%',
        margin: '4px',
        padding: 0,
        cursor: 'pointer',
        width: '13px',
        height: '13px',
        ':hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        ':active': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        '> svg': {
            height: '13px',
            width: '13px',
        },
    }),
};

export const haveAtleastOneEnabledAction = (taskActions: TaskActionType[] | null | undefined) => {
    if (taskActions) {
        for (let i = 0; i < taskActions.length; i++) {
            if (taskActions[i].actions) {
                for (let k = 0; k < taskActions[i].actions.length; k++) {
                    const payload = taskActions[i].actions[k].payload ? JSON.parse(taskActions[i].actions[k].payload) : markAsDoneEmptyPayload;
                    if (payload.enabled) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
};
