// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {hidePlaybookActionsModal} from 'src/actions';
import {isPlaybookActionsModalVisible} from 'src/selectors';
import Action from 'src/components/actions_modal_action';
import Trigger from 'src/components/actions_modal_trigger';
import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';
import ActionsModal, {ActionsContainer, TriggersContainer} from 'src/components/actions_modal';
import {CategorizeChannelChildren, WelcomeActionChildren} from 'src/components/actions_modal_action_children';

interface Props {
    playbook: Loaded<FullPlaybook>;
    readOnly: boolean;
}

const PlaybookActionsModal = ({playbook, readOnly}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const show = useSelector(isPlaybookActionsModalVisible);
    const updatePlaybook = useUpdatePlaybook(playbook.id);

    const [welcomeMessageEnabled, setWelcomeMessageEnabled] = useState(playbook.message_on_join_enabled);
    const [categorizeChannelEnabled, setCategorizeChannelEnabled] = useState(playbook.categorize_channel_enabled);
    const [welcomeMessage, setWelcomeMessage] = useState(playbook.message_on_join);
    const [categoryName, setCategoryName] = useState(playbook.category_name);
    const archived = playbook.delete_at !== 0;

    const onHide = () => {
        setWelcomeMessageEnabled(playbook.message_on_join_enabled);
        setWelcomeMessage(playbook.message_on_join);
        setCategoryName(playbook.category_name);
        setCategorizeChannelEnabled(playbook.categorize_channel_enabled);
        dispatch(hidePlaybookActionsModal());
    };

    const onSave = () => {
        if (welcomeMessage === '' && welcomeMessageEnabled) {
            setWelcomeMessageEnabled(false);
        }
        if (categoryName === '' && categorizeChannelEnabled) {
            setCategorizeChannelEnabled(false);
        }
        updatePlaybook({
            categoryName: categoryName ?? '',
            categorizeChannelEnabled: categorizeChannelEnabled && categoryName !== '',
            messageOnJoin: welcomeMessage,
            messageOnJoinEnabled: welcomeMessageEnabled && welcomeMessage !== '',
        });
        dispatch(hidePlaybookActionsModal());
    };

    return (
        <ActionsModal
            id={'playbooks-actions-modal'}
            title={formatMessage({defaultMessage: 'Channel Actions'})}
            subtitle={formatMessage({defaultMessage: 'Channel actions allow you to automate activities for the channel'})}
            show={show}
            onHide={onHide}
            editable={!readOnly}
            onSave={onSave}
            isValid={true}
        >
            <TriggersContainer>
                <Trigger
                    title={formatMessage({defaultMessage: 'When a user joins the channel'})}
                >
                    <ActionsContainer>
                        <Action
                            enabled={welcomeMessageEnabled}
                            title={formatMessage({defaultMessage: 'Send a temporary welcome message to the user'})}
                            editable={!readOnly && !archived}
                            onToggle={() => setWelcomeMessageEnabled(!welcomeMessageEnabled)}
                        >
                            <WelcomeActionChildren
                                message={welcomeMessage}
                                onUpdate={(msg) => setWelcomeMessage(msg.trim())}
                                editable={!readOnly}
                            />
                        </Action>
                        <Action
                            id='user-joins-channel-categorize'
                            enabled={categorizeChannelEnabled}
                            title={formatMessage({defaultMessage: 'Add the channel to a sidebar category for the user'})}
                            editable={!readOnly && !archived}
                            onToggle={() => setCategorizeChannelEnabled(!categorizeChannelEnabled)}
                        >
                            <CategorizeChannelChildren
                                categoryName={categoryName}
                                onUpdate={(name: string) => setCategoryName(name.trim())}
                                editable={!readOnly}
                            />
                        </Action>
                    </ActionsContainer>
                </Trigger>
            </TriggersContainer>
        </ActionsModal>
    );
};

export default PlaybookActionsModal;
