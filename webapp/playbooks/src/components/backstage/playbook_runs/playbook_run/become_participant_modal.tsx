// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';
import {useSelector} from 'react-redux';
import {General} from 'mattermost-webapp/packages/mattermost-redux/src/constants';
import {getCurrentUserId} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/common';

import GenericModal from 'src/components/widgets/generic_modal';

import CheckboxInput from 'src/components/backstage/runs_list/checkbox_input';

import {PlaybookRun} from 'src/types/playbook_run';
import {useChannel} from 'src/hooks';
import {isCurrentUserChannelMember} from 'src/selectors';
import {useManageRunMembership} from 'src/graphql/hooks';

import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

import {requestJoinChannel, telemetryEvent} from 'src/client';
import {PlaybookRunEventTarget} from 'src/types/telemetry';

interface Props {
    playbookRun: PlaybookRun | undefined;
    show: boolean;
    hideModal: () => void;
    from: string;
}

const BecomeParticipantsModal = ({playbookRun, show, hideModal, from}: Props) => {
    const {formatMessage} = useIntl();

    const currentUserId = useSelector(getCurrentUserId);
    const [checkboxState, setCheckboxState] = useState(false);
    const {addToRun} = useManageRunMembership(playbookRun?.id);
    const addToast = useToaster().add;
    const channelId = playbookRun?.channel_id ?? '';
    const playbookRunId = playbookRun?.id || '';
    const [channel, meta] = useChannel(channelId);
    const isPrivateChannelWithAccess = meta.error === null && channel?.type === General.PRIVATE_CHANNEL;
    const isChannelMember = useSelector(isCurrentUserChannelMember(channelId)) || isPrivateChannelWithAccess;
    const noAccessToJoinTheChannel = meta.error !== null && meta.error.status_code === 403;

    const renderExtraMsg = () => {
        // no extra info if already a channel member
        if (isChannelMember) {
            return null;
        }

        if (playbookRun?.create_channel_member_on_new_participant) {
            return (
                <ExtraInfoContainer>
                    <LightningBoltOutlineIcon
                        size={18}
                        color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                    />
                    {formatMessage({defaultMessage: 'You’ll also be added to the channel linked to this run.'})}
                </ExtraInfoContainer>
            );
        }

        const text = noAccessToJoinTheChannel ? formatMessage({defaultMessage: 'Request access to the channel linked to this run'}) : formatMessage({defaultMessage: 'Also add me to the channel linked to this run'});
        return (
            <StyledCheckboxInput
                testId={'also-add-to-channel'}
                text={text}
                checked={checkboxState}
                onChange={(checked) => setCheckboxState(checked)}
            />
        );
    };

    const header = (
        <Header>
            {formatMessage({defaultMessage: 'Become a participant'})}
        </Header>
    );

    const onConfirm = () => {
        const forceJoinChannel = !noAccessToJoinTheChannel && checkboxState;

        addToRun([currentUserId], forceJoinChannel)
            .then(() => {
                addToast({
                    content: formatMessage({defaultMessage: 'You\'ve joined this run.'}),
                    toastStyle: ToastStyle.Success,
                });

                // if no permissions to join the channel and checkbox is selected send a join request
                if (noAccessToJoinTheChannel && checkboxState) {
                    requestJoinChannel(playbookRunId);
                }
            })
            .catch(() => addToast({
                content: formatMessage({defaultMessage: 'It wasn\'t possible to join the run'}),
                toastStyle: ToastStyle.Failure,
            }));
        telemetryEvent(PlaybookRunEventTarget.Participate, {playbookrun_id: playbookRunId, from, trigger: 'participate', count: '1'});

        hideModal();
    };

    return (
        <StyledGenericModal
            id={'become-participant-modal'}
            modalHeaderText={header}
            show={show}
            onHide={hideModal}

            confirmButtonText={formatMessage({defaultMessage: 'Participate'})}
            showCancel={true}
            handleConfirm={onConfirm}

            onExited={() => {
                setCheckboxState(false);
            }}

            isConfirmDestructive={false}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={false}
            enforceFocus={true}
            components={{
                FooterContainer: StyledFooterContainer,
            }}
        >
            <Body>
                {formatMessage({defaultMessage: 'As a participant, you’ll be able to update the run summary, check off tasks, post status updates and edit the retrospective.'})}
                {renderExtraMsg()}
            </Body>

        </StyledGenericModal>
    );
};

const StyledGenericModal = styled(GenericModal)`
    &&& {
        .GenericModal__header {
            h1 {
                margin: 20px auto 0 auto;
            }
        }
    }
`;

const Header = styled.div`
    font-size: 22px;
`;

const Body = styled.div`
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    text-align: center;
`;

const StyledFooterContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 24px;
`;

const ExtraInfoContainer = styled.div`
    display: flex;
    flex-direction: row;

    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    justify-content: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-top: 12px;
    align-items: center;
`;

const StyledCheckboxInput = styled(CheckboxInput)`
    font-weight: normal;
    padding: 10px 16px 10px 0;
    margin-right: auto;
    white-space: normal;

    &:hover {
        background-color: transparent;
    }
`;

export default BecomeParticipantsModal;
