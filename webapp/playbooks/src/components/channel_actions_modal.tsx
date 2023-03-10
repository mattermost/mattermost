// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';

import {fetchChannelActions, saveChannelAction} from 'src/client';
import {hideChannelActionsModal} from 'src/actions';
import {isChannelActionsModalVisible, isCurrentUserAdmin, isCurrentUserChannelAdmin} from 'src/selectors';
import Action from 'src/components/actions_modal_action';
import Trigger, {TriggerKeywords} from 'src/components/actions_modal_trigger';
import {
    CategorizeChannelPayload,
    ChannelActionType,
    ChannelTriggerType,
    PayloadType,
    PromptRunPlaybookFromKeywordsPayload,
    WelcomeMessageActionPayload,
} from 'src/types/channel_actions';

import ActionsModal, {ActionsContainer, TriggersContainer} from 'src/components/actions_modal';
import {CategorizeChannelChildren, RunPlaybookChildren, WelcomeActionChildren} from 'src/components/actions_modal_action_children';

interface ActionState<T extends PayloadType> {
    id: string | undefined,
    enabled: boolean,
    payload: T,
}

function useActionState<T extends PayloadType>(originalState: ActionState<T>) {
    const [actionState, setActionState] = useState(originalState);

    // Initial state used to reset to original values when the changes are not saved
    const [initialPayload, setInitialPayload] = useState(originalState.payload);
    const [initialEnabled, setInitialEnabled] = useState(originalState.enabled);

    // Reset the current state to its initial value
    const reset = useCallback(() => {
        setActionState({
            ...actionState,
            enabled: initialEnabled,
            payload: initialPayload,
        });
    }, [actionState, initialEnabled, initialPayload]);

    // Overwrite the initial values with the current state
    const overwrite = useCallback(() => {
        setInitialEnabled(actionState.enabled);
        setInitialPayload(actionState.payload);
    }, [actionState.enabled, actionState.payload]);

    const init = useCallback((initState: ActionState<T>) => {
        setActionState(initState);
        setInitialEnabled(initState.enabled);
        setInitialPayload(initState.payload);
    }, []);

    return [actionState, setActionState, init, reset, overwrite] as const;
}

const welcomeMsgEmptyState = {id: undefined, enabled: false, payload: {message: ''}};
const categorizationEmptyState = {id: undefined, enabled: false, payload: {category_name: ''}};
const promptEmptyState = {id: undefined, enabled: false, payload: {playbook_id: '', keywords: [] as string[]}};

const ChannelActionsModal = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const show = useSelector(isChannelActionsModalVisible);
    const channelID = useSelector(getCurrentChannelId);
    const isChannelAdmin = useSelector(isCurrentUserChannelAdmin);
    const isSysAdmin = useSelector(isCurrentUserAdmin);

    const [welcomeMsg, setWelcomeMsg, welcomeMsgInit, welcomeMsgReset, welcomeMsgOverwrite] = useActionState(welcomeMsgEmptyState);
    const [categorization, setCategorization, categorizationInit, categorizationReset, categorizationOverwrite] = useActionState(categorizationEmptyState);
    const [prompt, setPrompt, promptInit, promptReset, promptOverwrite] = useActionState(promptEmptyState);

    const editable = isChannelAdmin || isSysAdmin;

    useEffect(() => {
        const getActions = async (id: string) => {
            // Reset everything to the empty state as soon as the channel switches.
            // If the channel does not have the corresponding actions, the empty state will be shown.
            welcomeMsgInit(welcomeMsgEmptyState);
            categorizationInit(categorizationEmptyState);
            promptInit(promptEmptyState);

            const fetchedActions = await fetchChannelActions(id);

            fetchedActions.forEach((action) => {
                switch (action.action_type) {
                case ChannelActionType.WelcomeMessage:
                    welcomeMsgInit({id: action.id, enabled: action.enabled, payload: action.payload as WelcomeMessageActionPayload});
                    break;
                case ChannelActionType.CategorizeChannel:
                    categorizationInit({id: action.id, enabled: action.enabled, payload: action.payload as CategorizeChannelPayload});
                    break;
                case ChannelActionType.PromptRunPlaybook:
                    promptInit({id: action.id, enabled: action.enabled, payload: action.payload as PromptRunPlaybookFromKeywordsPayload});
                    break;
                }
            });
        };

        if (channelID && show) {
            getActions(channelID);
        }
    }, [channelID, show, welcomeMsgInit, categorizationInit, promptInit]);

    const onHide = () => {
        welcomeMsgReset();
        promptReset();
        categorizationReset();

        dispatch(hideChannelActionsModal());
    };

    const onSave = () => {
        const welcomeMessageAction = {
            ...welcomeMsg,
            channel_id: channelID,
            action_type: ChannelActionType.WelcomeMessage,
            trigger_type: ChannelTriggerType.NewMemberJoins,
        };
        saveChannelAction(welcomeMessageAction).then((id) => setWelcomeMsg({...welcomeMsg, id}));
        welcomeMsgOverwrite();

        const categorizeChannelAction = {
            ...categorization,
            channel_id: channelID,
            action_type: ChannelActionType.CategorizeChannel,
            trigger_type: ChannelTriggerType.NewMemberJoins,
        };
        saveChannelAction(categorizeChannelAction).then((id) => setCategorization({...categorization, id}));
        categorizationOverwrite();

        const promptRunPlaybookAction = {
            ...prompt,
            channel_id: channelID,
            action_type: ChannelActionType.PromptRunPlaybook,
            trigger_type: ChannelTriggerType.KeywordsPosted,
        };
        saveChannelAction(promptRunPlaybookAction).then((id) => setPrompt({...prompt, id}));
        promptOverwrite();

        dispatch(hideChannelActionsModal());
    };

    return (
        <ActionsModal
            id={'channel-actions-modal'}
            title={formatMessage({defaultMessage: 'Channel Actions'})}
            subtitle={formatMessage({defaultMessage: 'Channel actions allow you to automate activities for this channel'})}
            show={show}
            onHide={onHide}
            editable={editable}
            onSave={onSave}
            isValid={true}
        >
            <TriggersContainer>
                <Trigger
                    title={formatMessage({defaultMessage: 'When a user joins the channel'})}
                >
                    <ActionsContainer>
                        <Action
                            enabled={welcomeMsg.enabled}
                            title={formatMessage({defaultMessage: 'Send a temporary welcome message to the user'})}
                            editable={editable}
                            onToggle={() => setWelcomeMsg({...welcomeMsg, enabled: !welcomeMsg.enabled})}
                        >
                            <WelcomeActionChildren
                                message={welcomeMsg.payload.message}
                                onUpdate={(msg) => setWelcomeMsg({...welcomeMsg, payload: {message: msg}})}
                                editable={editable}
                            />
                        </Action>
                        <Action
                            enabled={categorization.enabled}
                            title={formatMessage({defaultMessage: 'Add the channel to a sidebar category for the user'})}
                            editable={editable}
                            onToggle={() => setCategorization({...categorization, enabled: !categorization.enabled})}
                        >
                            <CategorizeChannelChildren
                                categoryName={categorization.payload.category_name}
                                onUpdate={(name) => setCategorization({...categorization, payload: {category_name: name}})}
                                editable={editable}
                            />
                        </Action>
                    </ActionsContainer>
                </Trigger>
                <Trigger
                    title={formatMessage({defaultMessage: 'When a message with these keywords is posted'})}
                    triggerModifier={(
                        <TriggerKeywords
                            editable={editable}
                            keywords={prompt.payload.keywords}
                            onUpdate={(newKeywords) => setPrompt({...prompt, payload: {...prompt.payload, keywords: newKeywords}})}
                        />
                    )}
                >
                    <ActionsContainer>
                        <Action
                            enabled={prompt.enabled}
                            title={formatMessage({defaultMessage: 'Prompt to run a playbook'})}
                            editable={editable}
                            onToggle={() => setPrompt({...prompt, enabled: !prompt.enabled})}
                        >
                            <RunPlaybookChildren
                                playbookId={prompt.payload.playbook_id}
                                onUpdate={(newId) => setPrompt({...prompt, payload: {...prompt.payload, playbook_id: newId}})}
                                editable={editable}
                            />
                        </Action>
                    </ActionsContainer>
                </Trigger>
            </TriggersContainer>
        </ActionsModal>
    );
};

export default ChannelActionsModal;
