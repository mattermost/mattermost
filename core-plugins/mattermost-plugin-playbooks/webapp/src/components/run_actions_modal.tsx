// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useUpdateEffect} from 'react-use';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {PlaybookRun} from 'src/types/playbook_run';
import {useUpdateRun} from 'src/graphql/hooks';
import Action from 'src/components/actions_modal_action';
import Trigger from 'src/components/actions_modal_trigger';
import ActionsModal, {ActionsContainer, TriggersContainer} from 'src/components/actions_modal';
import BroadcastChannelSelector from 'src/components/broadcast_channel_selector';
import PatternedTextArea from 'src/components/patterned_text_area';

interface Props {
    playbookRun: PlaybookRun;
    readOnly: boolean;
    show: boolean;
    onHide: () => void;
}

const RunActionsModal = ({playbookRun, readOnly, show, onHide}: Props) => {
    const {formatMessage} = useIntl();
    const teamId = playbookRun.team_id || '';

    const [broadcastToChannelsEnabled, setBroadcastToChannelsEnabled] = useState(playbookRun.status_update_broadcast_channels_enabled);
    const [sendOutgoingWebhookEnabled, setSendOutgoingWebhookEnabled] = useState(playbookRun.status_update_broadcast_webhooks_enabled);

    const [createChannelMemberEnabled, setCreateChannelMemberEnabled] = useState(playbookRun.create_channel_member_on_new_participant);
    const [removeChannelMemberEnabled, setRemoveChannelMemberEnabled] = useState(playbookRun.remove_channel_member_on_removed_participant);

    const [channelIds, setChannelIds] = useState(playbookRun.broadcast_channel_ids);
    const [webhooks, setWebhooks] = useState(playbookRun.webhook_on_status_update_urls);
    const [isValid, setIsValid] = useState<boolean>(true);
    const updateRun = useUpdateRun(playbookRun.id);

    useUpdateEffect(() => {
        setBroadcastToChannelsEnabled(playbookRun.status_update_broadcast_channels_enabled);
    }, [playbookRun.status_update_broadcast_channels_enabled]);

    useUpdateEffect(() => {
        setSendOutgoingWebhookEnabled(playbookRun.status_update_broadcast_webhooks_enabled);
    }, [playbookRun.status_update_broadcast_webhooks_enabled]);

    useUpdateEffect(() => {
        setCreateChannelMemberEnabled(playbookRun.create_channel_member_on_new_participant);
    }, [playbookRun.create_channel_member_on_new_participant]);

    useUpdateEffect(() => {
        setRemoveChannelMemberEnabled(playbookRun.remove_channel_member_on_removed_participant);
    }, [playbookRun.remove_channel_member_on_removed_participant]);

    useUpdateEffect(() => {
        setChannelIds(playbookRun.broadcast_channel_ids);
    }, [playbookRun.broadcast_channel_ids]);

    useUpdateEffect(() => {
        setWebhooks(playbookRun.webhook_on_status_update_urls);
    }, [playbookRun.webhook_on_status_update_urls]);

    const onSave = () => {
        updateRun({
            statusUpdateBroadcastChannelsEnabled: broadcastToChannelsEnabled,
            broadcastChannelIDs: channelIds,
            statusUpdateBroadcastWebhooksEnabled: sendOutgoingWebhookEnabled,
            webhookOnStatusUpdateURLs: webhooks,
            createChannelMemberOnNewParticipant: createChannelMemberEnabled,
            removeChannelMemberOnRemovedParticipant: removeChannelMemberEnabled,
        });
    };

    return (
        <ActionsModal
            id={'run-actions-modal'}
            title={formatMessage({defaultMessage: 'Run Actions'})}
            subtitle={formatMessage({defaultMessage: 'Run actions allow you to automate activities for this channel'})}
            show={show}
            onHide={onHide}
            editable={!readOnly}
            onSave={onSave}
            isValid={isValid}
            autoCloseOnConfirmButton={true}
        >
            <TriggersContainer>
                <Trigger
                    title={formatMessage({defaultMessage: 'When a status update is posted'})}
                >
                    <ActionsContainer>
                        <Action
                            enabled={broadcastToChannelsEnabled}
                            title={formatMessage({defaultMessage: 'Broadcast update to selected channels'})}
                            editable={!readOnly}
                            onToggle={() => setBroadcastToChannelsEnabled((prev: boolean) => !prev)}
                        >
                            <BroadcastChannelSelector
                                id='run-actions-broadcast'
                                enabled={!readOnly && broadcastToChannelsEnabled}
                                channelIds={channelIds}
                                onChannelsSelected={setChannelIds}
                                teamId={teamId}
                            />
                        </Action>
                        <Action
                            enabled={sendOutgoingWebhookEnabled}
                            title={formatMessage({defaultMessage: 'Send outgoing webhook'})}
                            editable={!readOnly}
                            onToggle={() => setSendOutgoingWebhookEnabled((prev: boolean) => !prev)}
                        >
                            <PatternedTextArea
                                enabled={!readOnly && sendOutgoingWebhookEnabled}
                                placeholderText={formatMessage({defaultMessage: 'Enter webhook'})}
                                errorText={formatMessage({defaultMessage: 'Invalid webhook URLs'})}
                                input={webhooks.join('\n')}
                                pattern={'https?://.*'}
                                delimiter={'\n'}
                                onChange={(newWebhooks: string) => setWebhooks(newWebhooks.split('\n'))}
                                rows={3}
                                maxRows={64}
                                maxErrorText={formatMessage({defaultMessage: 'Invalid entry: the maximum number of webhooks allowed is 64'})}
                                resize={'vertical'}
                                onValidationChange={(valid) => setIsValid(valid)}
                            />
                            <HelpText>
                                {formatMessage({defaultMessage: 'Please enter one webhook per line'})}
                            </HelpText>
                        </Action>
                    </ActionsContainer>
                </Trigger>

                <Trigger
                    title={formatMessage({defaultMessage: 'When a participant joins the run'})}
                >
                    <ActionsContainer>
                        <Action
                            enabled={createChannelMemberEnabled}
                            title={formatMessage({defaultMessage: 'Add them to the run channel'})}
                            editable={!readOnly}
                            onToggle={() => setCreateChannelMemberEnabled(!createChannelMemberEnabled)}
                        />
                    </ActionsContainer>
                </Trigger>

                <Trigger
                    title={formatMessage({defaultMessage: 'When a participant leaves the run'})}
                >
                    <ActionsContainer>
                        <Action
                            enabled={removeChannelMemberEnabled}
                            title={formatMessage({defaultMessage: 'Remove them from the run channel'})}
                            editable={!readOnly}
                            onToggle={() => setRemoveChannelMemberEnabled(!removeChannelMemberEnabled)}
                        />
                    </ActionsContainer>
                </Trigger>
            </TriggersContainer>
        </ActionsModal>
    );
};

const HelpText = styled.div`
    margin-top: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
`;

export default RunActionsModal;
