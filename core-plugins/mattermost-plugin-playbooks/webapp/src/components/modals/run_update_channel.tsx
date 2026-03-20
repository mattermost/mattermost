// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useEffect, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import GenericModal, {Description, InlineLabel} from 'src/components/widgets/generic_modal';
import {useRun} from 'src/hooks';
import ChannelSelector from 'src/components/backstage/channel_selector';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';

const ID = 'playbook_run_update';

type Props = {
    playbookRunId: string;
    teamId: string;
    onSubmit: (newChannelId: string, newChannelName: string) => void;
} & Partial<ComponentProps<typeof GenericModal>>;

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: UpdateRunModal,
    dialogProps: props,
});

const UpdateRunModal = ({
    playbookRunId,
    teamId,
    onSubmit,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const [channelId, setChannelId] = useState('');
    const [channelName, setChannelName] = useState('');
    const [run] = useRun(playbookRunId);

    useEffect(() => {
        if (run) {
            setChannelId(run.channel_id);
        }
    }, [run, run?.channel_id]);

    return (
        <StyledGenericModal
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={formatMessage({defaultMessage: 'Save'})}
            showCancel={true}
            isConfirmDisabled={!(channelId !== '' && channelId !== run?.channel_id)}
            handleConfirm={() => onSubmit(channelId, channelName)}
            id={ID}
            modalHeaderText={
                <Header>
                    {formatMessage({defaultMessage: 'Move to a different channel'})}
                </Header>
            }
            {...modalProps}
        >
            <Body>
                <Description>
                    {formatMessage({defaultMessage: 'Are you sure you want to move {name} to a different channel?'}, {name: run?.name})}
                </Description>
                <InlineLabel>{formatMessage({defaultMessage: 'Select channel'})}</InlineLabel>
                <StyledChannelSelector
                    id={'link_existing_channel_selector'}
                    data-testid={'run-update-channel-selector'}
                    onChannelSelected={(channel_id: string, channel_name: string) => {
                        setChannelId(channel_id);
                        setChannelName(channel_name);
                    }}
                    channelIds={[channelId]}
                    isClearable={false}
                    selectComponents={{ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
                    isDisabled={false}
                    captureMenuScroll={false}
                    shouldRenderValue={true}
                    teamId={teamId}
                    isMulti={false}
                />
            </Body>
        </StyledGenericModal>
    );
};

const StyledGenericModal = styled(GenericModal)`
    &&& {
        h1 {
            width:100%;
        }

        .modal-header {
            padding: 24px 31px 5px;
            margin-bottom: 0;
        }

        .modal-content {
            padding: 0;
        }

        .modal-body {
            padding: 10px 31px;
        }

        .modal-footer {
           padding: 0 31px 28px;
        }
    }
`;

const Header = styled.div`
    display: flex;
    flex-direction: column;
`;

const Body = styled.div`
    display: flex;
    flex-direction: column;

    & > div, & > input {
        margin-bottom: 12px;
    }
`;

export const StyledChannelSelector = styled(ChannelSelector)`

    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .playbooks-rselect__control {
        height: 48px;
        padding: 4px 16px 4px 3.2rem;

        &::before {
            position: absolute;
            top: 13px;
            left: 16px;
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f0349';
            font-family: compass-icons, mattermosticons;
            font-size: 18px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    }
`;
